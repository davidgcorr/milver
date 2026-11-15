import { stringifySignal, parseSignal } from '@/signal-json';
import { ProjectContext } from '@/project/context';
import { defaultRender } from '@/block-code';
import { buildBlockModule } from '@/block-code';
import type { BlockData } from '@/model';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { defaultModule, type Port } from '@/model';
import type { ModuleDependency, WasmConfig, RendererConfig } from '@/code-config';
import { isSignal, type Preview, type Signal } from '@/runtime';
export const PreviewContext = createContext<{ values: Preview; emit: (id: string, port: string, value: Signal, event?: boolean) => void; setValue: (id: string, value: string) => void; saveState: (id: string, state: Record<string, Signal>) => void; setProperty: (id: string, path: string, value: Signal) => void; report: (id: string, error: string) => void }>({ values: {}, emit: () => {}, setValue: () => {}, saveState: () => {}, setProperty: () => {}, report: () => {} });
export { moduleDocument, type ModuleOptions } from './module-document';
import { moduleDocument } from './module-document';
let renderBundle: Promise<string> | undefined;
export const loadRenderBundle = () => renderBundle ??= import('../generated/block-ui.js?raw').then(module => module.default).catch(error => { renderBundle = undefined; throw error; });
let mathBundle: Promise<string> | undefined;
export const loadMathBundle = () => mathBundle ??= import('../generated/block-math.js?raw').then(m => m.default).catch(error => { mathBundle = undefined; throw error; });
export function ModuleMask({ id, source, render, state, value, color, background, ports, dependencies, wasm, renderer, renderEnabled = true, block: blockProperties, interactive = false }: { block?: Record<string, unknown>; id: string; source?: string; render?: string; state?: BlockData['state']; value: string; color: string; background: string; ports: Port[]; dependencies?: ModuleDependency[]; wasm?: WasmConfig; renderer?: RendererConfig; renderEnabled?: boolean; interactive?: boolean }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const { values, emit, setValue, saveState, setProperty, report } = useContext(PreviewContext);
  const project = useContext(ProjectContext);
  const builtins = project.modules.filter(m => m.builtin);
  const [mathSource, setMathSource] = useState<string>();
  const shared = project.modules.filter(m => !m.builtin).flatMap(m => [...(m.dependencies ?? []), { specifier: m.alias, ...(m.url ? { url: m.url } : { source: m.source }) }]);
  const allDependencies = [...new Map([...(dependencies ?? []), ...shared, ...builtins.map(m => ({ specifier: m.alias, source: '' }))].map(d => [d.specifier, d])).values()];
  const savedState = useRef<BlockData['state']>(undefined);
  const stateInput = state === savedState.current ? undefined : state;
  const initialState = useRef(state); initialState.current = state;
  const inputs = stringifySignal(values[id]?.inputs ?? {});
  const block = stringifySignal({ id, label: 'Block', width: 240, height: 190, ...blockProperties });
  const settings = JSON.stringify({ dependencies: allDependencies, ports: ports.map(({ id, type, variable }) => ({ id, type, variable })), wasm, renderer });
  const visualSource=render??(source===undefined||/\bfunction\s+run\s*\(/.test(source)?defaultRender:undefined);
  const code = useMemo(() => {
    try { return visualSource !== undefined ? buildBlockModule(source ?? defaultModule, visualSource, renderEnabled) : source ?? defaultModule; }
    catch (error) { return `export default function(){throw new Error(${JSON.stringify(String(error))});}`; }
  }, [source, visualSource, renderEnabled]);
  const needsUI = visualSource !== undefined || /React\.createElement|\blatex\s*\(/.test(code);
  const [uiSource, setUISource] = useState<string>();
  const needsMath = builtins.length > 0;
  useEffect(() => { let active = true; if (needsMath) void loadMathBundle().then(source => { if (active) setMathSource(source); }).catch(error => { if (active) report(id, String(error)); }); return () => { active = false; }; }, [needsMath, id, report]);
  const [uiError, setUIError] = useState('');
  useEffect(() => { let active = true; if (needsUI) void loadRenderBundle().then(source => { if (active) { setUISource(source); setUIError(''); } }).catch(error => { if (active) { setUIError('Could not load renderer.'); report(id, String(error)); } }); return () => { active = false; }; }, [needsUI, id, report]);
  const document = useMemo(() => {
    const token = crypto.randomUUID();
    // Keep the large bundled library out of settings serialized on every live update.
    // Inject it only when this iframe document actually needs rebuilding.
    const options = JSON.parse(settings);
    options.dependencies = options.dependencies.map((dependency: ModuleDependency) => builtins.some(m => m.alias === dependency.specifier) ? { ...dependency, source: mathSource ?? '' } : dependency);
    return { token, source: (needsUI && !uiSource || needsMath && !mathSource) ? `<!doctype html><html><body style="font:11px system-ui;color:#737373">${uiError || 'Loading renderer…'}</body></html>` : moduleDocument(code, { ...options, state: initialState.current, ...(needsUI ? { uiSource } : {}), token }) };
  }, [code, settings, needsUI, uiSource, uiError, needsMath, mathSource]);
  const latest = useRef({ inputs, value, color, background, state, block }); latest.current = { inputs, value, color, background, state: stateInput, block };
  const token = useRef(document.token); token.current = document.token;
  useEffect(() => {
    const send = () => { const data = latest.current; frame.current?.contentWindow?.postMessage({ type: 'mask-input', ...data, color: frame.current ? getComputedStyle(frame.current).color : data.color, inputs: parseSignal(data.inputs), block: parseSignal(data.block) }, '*'); };
    const receive = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow || e.data?.token !== token.current) return;
      if (e.data.type === 'mask-ready') { if(frame.current)frame.current.dataset.milverReady='true';send(); }
      if (e.data.type === 'mask-output' && typeof e.data.port === 'string' && isSignal(e.data.value)) emit(id, e.data.port, e.data.value, e.data.event === true);
      if (e.data.type === 'mask-value' && typeof e.data.value === 'string' && e.data.value.length <= 100000) setValue(id, e.data.value);
      if (e.data.type === 'mask-state' && isSignal(e.data.state) && e.data.state && !Array.isArray(e.data.state) && typeof e.data.state === 'object') { savedState.current = e.data.state; saveState(id, e.data.state); }
      if (e.data.type === 'mask-property' && typeof e.data.path === 'string' && isSignal(e.data.value)) setProperty(id, e.data.path, e.data.value);
      if (e.data.type === 'mask-status') report(id, '');
      if (e.data.type === 'mask-error') report(id, String(e.data.error ?? 'JavaScript error'));
      if (e.data.type === 'mask-error') ports.filter(p => p.type === 'output').forEach(p => emit(id, p.id, null));
    };
    window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
  }, [id, emit, setValue, saveState, setProperty, report, settings]);
  useEffect(() => { frame.current?.contentWindow?.postMessage({ type: 'mask-input', inputs: parseSignal(inputs), state: stateInput, value, block: parseSignal(block), color: frame.current ? getComputedStyle(frame.current).color : color, background }, '*'); }, [inputs, state, value, color, background, document, block]);
  return <iframe data-milver-block-id={id} key={document.token} ref={frame} title="JavaScript block mask" className={`module-mask ${interactive ? 'mask-interactive nodrag nopan nowheel' : ''}`} tabIndex={interactive ? 0 : -1} sandbox="allow-scripts" srcDoc={document.source}/>;
}

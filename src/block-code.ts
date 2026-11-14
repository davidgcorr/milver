import { transform } from 'sucrase';
import type { BlockData } from './model';

export const defaultLogic = `async function run() {
  state.result = inputs.input1 ?? Number(value);
  emit(state.result);
}`;
export const defaultRender = `function render({ state, block }) {
  // state.result comes from run(); block contains the current block properties.
  const fontSize = 24;
  return <div style={{ padding: 16, fontSize, textAlign: 'center' }}>
    <small style={{ display: 'block', fontSize: 11, opacity: 0.6 }}>{block.label}</small>
    <strong>{String(state.result ?? 'Connect an input')}</strong>
  </div>;
}`;
export const controlledPaths = ['label', 'description', 'value', 'width', 'height', 'visuals.background', 'visuals.foreground', 'visuals.radius', 'visuals.opacity', 'visuals.shadow', 'visuals.strokeWidth', 'visuals.strokeColor', 'visuals.showHeader', 'visuals.showLabel', 'visuals.showValue', 'visuals.showPortLabels'] as const;
export type ControlledPath = typeof controlledPaths[number];
export const isControlled = (data: BlockData, path: string) => data.controlledProperties?.includes(path as ControlledPath) ?? false;

export function completeFunction(source: string, name: 'run' | 'render'): string {
  if (new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`).test(source)) return source.trim().replace(/^export\s+(?:default\s+)?/, '');
  return `${name === 'run' || /\bawait\b/.test(source) ? 'async ' : ''}function ${name}() {\n${source.split('\n').map(line => '  ' + line).join('\n')}\n}`;
}
export function insertFunctionSnippet(source: string, snippet: string): string {
  const closing = source.lastIndexOf('}');
  return closing < 0 ? source + '\n' + snippet : source.slice(0, closing) + '\n' + snippet.split('\n').map(line => '  ' + line).join('\n') + '\n' + source.slice(closing);
}

// The lifecycle adapter stays out of the two user-editable function bodies.
export function buildBlockModule(logic: string, renderSource: string): string {
  const runSource = completeFunction(logic, 'run');
  const drawSource = completeFunction(renderSource, 'render');
  // Saved async/imperative renderers keep their lifecycle. New synchronous JSX
  // renderers are mounted as real React components, so hooks are valid.
  const component = !/\basync\s+function\s+render\s*\(/.test(drawSource)
    && (!/\belement\s*[.[]|\blatex\s*\(\s*element\b/.test(drawSource) || /<[A-Za-z>]|React\.createElement/.test(drawSource));
  const source = `export default async function mount(api) {
  let { inputs = {}, variables = {}, value } = api;
  const { element, state = {}, modules = {}, emit, emitEvent, setValue, setProperty, wasm, ports, renderer } = api;
  let block = { ...api.block, value, state };
  const { React, Button, Slider, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Latex, MathValue, Iframe, BlockRenderBoundary, latex, describeValue, formatValue } = api.ui ?? {};
  const { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } = React ?? {};
  const actions = {};
  let reactRoot, cleanup, disposed = false, executing = false, queued = false, renderedDuringRun = false;
  let disposers = [];
  const onCleanup = fn => disposers.push(fn);
  const setState = patch => { const next = typeof patch === 'function' ? patch(state) : patch; Object.assign(state, next); requestRender(); };
  const scope = () => ({ ...api.ui, element, wasm, inputs, variables, value, state, setState, block, modules, actions, emit, emitEvent, setValue, setProperty, onCleanup, render, renderer, ports });
  const View = (${drawSource});
  ${runSource}
  async function render() {
    if (disposed) return;
    if (executing) renderedDuringRun = true;
    if (${component}) {
      if (!React || !api.ui?.createRoot) throw new Error('React rendering is not available.');
      reactRoot ??= api.ui.createRoot(element, api.reportError ? { onUncaughtError: error => queueMicrotask(() => api.reportError(error)) } : undefined);
      const component = React.createElement(View, scope());
      reactRoot.render(BlockRenderBoundary ? React.createElement(BlockRenderBoundary, { onError: error => queueMicrotask(() => api.reportError?.(error)) }, component) : component);
    } else {
      if (typeof cleanup === 'function') await cleanup();
      const result = await View(scope());
      if (React?.isValidElement(result) || Array.isArray(result)) {
        reactRoot ??= api.ui.createRoot(element);
        reactRoot.render(result);
      } else cleanup = result;
    }
  }
  function requestRender() {
    if (disposed || executing || queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; if (!disposed) Promise.resolve(render()).catch(error => api.reportError?.(error)); });
  }
  const unsubscribe = ${component} ? api.subscribeState?.(requestRender) : undefined;
  async function execute() {
    executing = true; renderedDuringRun = false;
    try {
      for (const dispose of disposers.splice(0)) await dispose();
      await run(scope());
    } finally { executing = false; }
    if (${component} || !renderedDuringRun) await render();
  }
  try { await execute(); }
  catch (error) { disposed = true; unsubscribe?.(); reactRoot?.unmount(); for (const dispose of disposers.splice(0)) await dispose(); throw error; }
  return {
    async update(nextInputs, nextValue, nextVariables, nextBlock) {
      inputs = nextInputs; value = nextValue; variables = nextVariables ?? {};
      block = { ...block, ...nextBlock, value, state };
      await execute();
    },
    async invokeAction(name, args = []) { if (!Object.hasOwn(actions, name) || typeof actions[name] !== 'function') throw new Error('Unknown block action: ' + name); return await actions[name](...args); },
    inspect() { return { inputs, value, state, block, actions: Object.keys(actions) }; },
    async destroy() { disposed = true; unsubscribe?.(); reactRoot?.unmount(); for (const dispose of disposers.splice(0)) await dispose(); if (typeof cleanup === 'function') await cleanup(); }
  };
}`;
  return transform(source, { transforms: ['jsx'], jsxRuntime: 'classic', production: true, disableESTransforms: true }).code;
}

import type { BlockNode } from '@/model';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';
import { Button } from './ui/button';
import { InspectorSection } from './inspector-section';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { ChevronDown, Code2, CircleHelp } from 'lucide-react';
export function BlockHelp({ node, insert, render = false }: { node: BlockNode; insert: (snippet: string) => void; render?: boolean }) {
  const input = node.data.ports.find(p => p.type === 'input');
  const variable = input?.variable ?? input?.id ?? 'input1';
  const propertySnippet = `const size = defineProperty('size', { type: 'number', label: 'Size', default: 24, min: 10, max: 72, step: 1 });`;
  const snippets = render ? [
    ['Inspector parameter', propertySnippet + `\nreturn <div style={{ fontSize: size }}>{String(state.result ?? '')}</div>;`],
    ['React component', `return <div style={{ padding: 16 }}><strong>{String(state.result ?? '')}</strong></div>;`],
    ['LaTeX value', `return <Latex tex={String(state.result ?? 0)} fontSize={24}/>;`],
    ['Source button', `return <Button onClick={() => setValue(String(Number(value) + 1))}>Increment</Button>;`],
    ['Control appearance', `useEffect(() => { setProperty('visuals.background', inputs.input1 ?? '#f5f5f5'); }, [inputs.input1]);
return <div style={{padding:16}}>{block.label}</div>;`],
    ['React state', `const [expanded, setExpanded] = useState(false);
return <Button onClick={() => setExpanded(!expanded)}>{expanded ? block.label : 'Expand'}</Button>;`],
  ] : [
    ['Inspector parameter', `const gain = defineProperty('gain', { type: 'number', label: 'Gain', default: 2, min: 0, max: 100, step: 0.1 });\nemit((inputs[${JSON.stringify(variable)}] ?? 0) * gain);`],
    ['Read input and emit', `state.result = inputs[${JSON.stringify(variable)}] ?? 0;\nemit(state.result);\nawait render();`],
    ['Matrix product', `state.result = modules.tensorMath.matmul(inputs.input1, inputs.input2);\nemit(state.result);\nawait render();`],
    ['Attention', `state.result = modules.tensorMath.attention(inputs.input1, inputs.input2, inputs.input3);\nemit(state.result);\nawait render();`],
    ['Saved state', `state.calls = (state.calls ?? 0) + 1;\nawait render();`],
  ];
  const computation = !!node.data.operation;
  const python = node.data.kind === 'python';
  return <InspectorSection title="Code help & snippets" icon={CircleHelp} className="block-help">
    <div className="block-help-body">
      <div className="help-overview"><strong>{node.data.label}</strong>{node.data.description && <p>{node.data.description}</p>}</div>
      <p>{render ? 'A React component returning JSX. Rendering updates automatically; use hooks for visuals and Code/actions for behavior.' : python ? 'Python source is saved for your own runtime.' : computation ? 'This block runs in the project runtime. Return a result object keyed by output variables or publish with emit(value).' : node.data.render !== undefined ? 'Code runs when inputs or properties change. Publish outputs with emit(), and share results with Render through saved state.' : 'This block uses the original mount API. Its source is preserved for compatibility.'}</p>
      {!python && <>
        <div className="help-scope">{(computation ? ['inputs', 'modules', 'state', 'parameters', 'tick'] : ['inputs', 'state', 'value', 'block', 'modules']).map(name => <Badge key={name} variant="secondary">{name}</Badge>)}</div>
        <Separator/>
        <dl className="help-reference">
          <div><dt>Inputs & outputs</dt><dd>{node.data.ports.filter(p => p.type === 'input').map(p => <span key={p.id}><code>inputs[{JSON.stringify(p.variable ?? p.id)}]</code>{' '}</span>)}{!input && 'No input ports. ' }Publish with <code>emit(value, 'output1')</code>. Libraries are available as <code>modules.alias</code>.</dd></div>
          <div><dt>{render ? 'Rendering & actions' : 'State & cleanup'}</dt><dd>{render ? <>React hooks, Button, Slider, Select, <code>&lt;MathValue/&gt;</code> and <code>&lt;Latex/&gt;</code> are available. Use <code>setState()</code> to repaint and <code>actions</code> for behavior defined in Code.</> : <><code>state</code> is shared and saved in project JSON. Call <code>await render()</code> to repaint. Use <code>onCleanup(fn)</code> to dispose timers and other resources.</>}</dd></div>
          <div><dt>Inspector parameters</dt><dd><code>defineProperty(name, options)</code> adds an editable field and returns its saved value. Types: number, text, boolean, color, select.</dd></div>
          <div><dt>Appearance</dt><dd><code>block</code> exposes live properties. <code>setProperty(path, value)</code> controls and locks an inspector field.</dd></div>
        </dl>
        <Separator/>
        <h4 className="help-section-title">Examples</h4>
        <div className="help-snippets">{snippets.map(([title, code]) => <Collapsible key={title} className="help-snippet">
          <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="snippet-trigger"><Code2/><span>{title}</span><ChevronDown className="section-chevron"/></Button></CollapsibleTrigger>
          <CollapsibleContent><div className="snippet-content"><pre>{code}</pre><Button size="xs" variant="secondary" onClick={() => insert(code)}>{render ? 'Use example' : 'Insert snippet'}</Button></div></CollapsibleContent>
        </Collapsible>)}</div>
      </>}
    </div>
  </InspectorSection>;
}

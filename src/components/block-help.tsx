import type { BlockNode } from '@/model';
import { Button } from './ui/button';
import { CircleHelp } from 'lucide-react';
export function BlockHelp({ node, insert, render = false }: { node: BlockNode; insert: (snippet: string) => void; render?: boolean }) {
  const input = node.data.ports.find(p => p.type === 'input');
  const variable = input?.variable ?? input?.id ?? 'input1';
  const snippets = render ? [
    ['React component', `return <div style={{ padding: 16 }}><strong>{String(state.result ?? '')}</strong></div>;`],
    ['LaTeX value', `return <Latex tex={String(state.result ?? 0)} fontSize={24}/>;`],
    ['Source button', `return <Button onClick={() => setValue(String(Number(value) + 1))}>Increment</Button>;`],
    ['Control appearance', `useEffect(() => { setProperty('visuals.background', inputs.input1 ?? '#f5f5f5'); }, [inputs.input1]);
return <div style={{padding:16}}>{block.label}</div>;`],
    ['React state', `const [expanded, setExpanded] = useState(false);
return <Button onClick={() => setExpanded(!expanded)}>{expanded ? block.label : 'Expand'}</Button>;`],
  ] : [
    ['Read input and emit', `state.result = inputs[${JSON.stringify(variable)}] ?? 0;\nemit(state.result);\nawait render();`],
    ['Matrix product', `state.result = modules.tensorMath.matmul(inputs.input1, inputs.input2);\nemit(state.result);\nawait render();`],
    ['Attention', `state.result = modules.tensorMath.attention(inputs.input1, inputs.input2, inputs.input3);\nemit(state.result);\nawait render();`],
    ['Saved state', `state.calls = (state.calls ?? 0) + 1;\nawait render();`],
  ];
  return <details className="block-help"><Button asChild variant="ghost" size="sm"><summary><CircleHelp/>Block help & snippets</summary></Button><div className="block-help-body"><strong>{node.data.label}</strong><p>{node.data.description}</p><p><code>state</code> is shared and saved. <code>value</code> is the parameter string. Inputs: {node.data.ports.filter(p => p.type === 'input').map(p => `inputs[${JSON.stringify(p.variable ?? p.id)}]`).join(', ') || 'none'}. Outputs use <code>emit()</code>. Render is a synchronous React component. It has React hooks, Button, Slider, Select, <code>&lt;MathValue/&gt;</code> and <code>&lt;Latex/&gt;</code>. <code>block</code> exposes the live properties; <code>modules.alias</code> exposes imports. <code>actions</code> carries behavior defined in Code. Use <code>setState()</code> or change saved state to repaint; <code>setProperty()</code> controls and locks an inspector field.</p>{snippets.map(([title, code]) => <div key={title}><div className="snippet-heading"><span>{title}</span><Button size="xs" variant="outline" onClick={() => insert(code)}>{render ? 'Use example' : 'Insert'}</Button></div><pre>{code}</pre></div>)}</div></details>;
}

import { jsRecipes, applyJsRecipe } from '@/js-recipes';
import { viewerLogic, viewerRender } from '@/viewer-code';
import { CodeEditor } from './code-editor';
import { BlockHelp } from './block-help';
import { completeFunction, buildBlockModule } from '@/block-code';
import { useEffect, useState } from 'react';
import { defaultRender } from '@/block-code';
import { type BlockData, type BlockNode } from '@/model';
import { Button } from './ui/button';
import { Field } from './editor-ui';
import { VisualProperties } from './visual-properties';

export function RenderProperties({ node, update, resize }: { node: BlockNode; update: (patch: Partial<BlockData>) => void; resize: (dimension: 'width' | 'height', value: number) => void }) {
  const source = completeFunction(node.data.render ?? (node.data.kind === 'renderer' ? viewerRender : defaultRender), 'render');
  const template = node.data.kind === 'renderer' ? viewerRender : node.data.recipe && jsRecipes[node.data.recipe] ? applyJsRecipe(node,node.data.recipe).data.render ?? defaultRender : defaultRender;
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(source);
  useEffect(() => setDraft(source), [node.id, source]);
  return <><VisualProperties node={node} update={update} resize={resize}/>{['javascript', 'renderer'].includes(node.data.kind) && <section className="property-section">
    {(node.data.render !== undefined || node.data.kind === 'renderer') ? <><h3>React component</h3><p className="field-help">A React component returning JSX. Shared scope: <code>inputs</code>, <code>state</code>, <code>block</code>, <code>modules</code>. Rendering updates automatically; use hooks for visuals and Code/actions for behavior.</p>
    <Field label="render({ inputs, state, block, modules })"><CodeEditor label="Render function source" value={draft} onChange={setDraft}/></Field>
    <BlockHelp node={node} render insert={snippet => setDraft(completeFunction(snippet, 'render'))}/>
    {error && <p className="code-error" role="alert">{error}</p>}
    <Button variant="outline" size="sm" onClick={() => { setDraft(template); setError(''); }}>Use React template</Button>
    <Button size="sm" disabled={draft === source || draft.length > 100000} onClick={() => { try { buildBlockModule(node.data.module ?? (node.data.kind === 'renderer' ? viewerLogic : ''), draft); update({ render: draft }); setError(''); } catch (e) { setError(String(e)); } }}>Apply render</Button></> : <p className="field-help">This saved block draws through its original mount function in Code.</p>}
  </section>}</>;
}

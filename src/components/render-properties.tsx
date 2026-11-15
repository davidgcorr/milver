import { Code2 } from 'lucide-react';
import { InspectorSection } from './inspector-section';
import {renderAvailable} from '@/block-functions';
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
  const available=renderAvailable(node.data),disabled=!available||node.data.renderEnabled===false||node.data.visuals?.showValue===false;
  const [error, setError] = useState('');
  const [draft, setDraft] = useState(source);
  useEffect(() => setDraft(source), [node.id, source]);
  return <><VisualProperties node={node} update={update} resize={resize}/><InspectorSection title="Render function" icon={Code2}><section className={`property-section ${disabled?'function-disabled':''}`} aria-disabled={disabled}>
    <>
    {available&&<label className="visibility-option"><span>Enable render function</span><input aria-label="Enable render function" type="checkbox" checked={node.data.renderEnabled!==false} onChange={event=>update({renderEnabled:event.target.checked})}/></label>}
    {disabled&&<p className="field-help">{!available?'Rendering is managed by the project runtime for this block.':node.data.visuals?.showValue===false?'Mask content is hidden. Enable it in Appearance to use the render function.':'Render is disabled; Code and outputs continue to run.'}</p>}
    <Field label="render({ inputs, state, block, modules })"><CodeEditor disabled={disabled} label="Render function source" value={draft} onChange={setDraft}/></Field>
    {!disabled&&<BlockHelp node={node} render insert={snippet => setDraft(completeFunction(snippet, 'render'))}/>}
    {error && <p className="code-error" role="alert">{error}</p>}
    <div className="code-editor-actions"><Button disabled={disabled} variant="outline" size="sm" onClick={() => { setDraft(template); setError(''); }}>Use React template</Button>
    <Button size="sm" disabled={disabled || draft === source || draft.length > 100000} onClick={() => { try { buildBlockModule(node.data.module ?? (node.data.kind === 'renderer' ? viewerLogic : ''), draft); update({ render: completeFunction(draft,'render') }); setError(''); } catch (e) { setError(String(e)); } }}>Apply render</Button></div></>
  </section></InspectorSection></>;
}

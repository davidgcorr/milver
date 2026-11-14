import type { BlockData } from '@/model';
import { isControlled } from '@/block-code';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Field } from './editor-ui';
export function IframeProperties({ data, update }: { data: BlockData; update: (patch: Partial<BlockData>) => void }) {
  let config={mode:'html',html:'',url:'https://example.com'},invalid=false;
  try{config={...config,...JSON.parse(data.value)};}catch{invalid=true;}
  const locked=isControlled(data,'value');
  const change=(patch:Partial<typeof config>)=>{update({value:JSON.stringify({...config,...patch})});};
  return <><Field label="Embedded page"><div className="segmented"><Button size="sm" disabled={locked} variant={config.mode==='html'?'secondary':'ghost'} aria-pressed={config.mode==='html'} onClick={()=>change({mode:'html'})}>HTML</Button><Button size="sm" disabled={locked} variant={config.mode==='url'?'secondary':'ghost'} aria-pressed={config.mode==='url'} onClick={()=>change({mode:'url'})}>URL</Button></div></Field>
    {config.mode==='url'?<Field label="Page URL"><Input aria-label="Iframe page URL" aria-describedby="iframe-url-help" disabled={locked} placeholder="https://example.com/embedded-app" value={config.url} onChange={event=>change({url:event.target.value})}/><p id="iframe-url-help" className="field-help">Use an HTTP(S) page that allows embedding. It must listen for <code>milver-input</code> messages to receive connected values.</p></Field>:<Field label="Page HTML"><Textarea aria-label="Iframe page HTML" disabled={locked} rows={10} spellCheck={false} value={config.html} onChange={event=>change({html:event.target.value})}/></Field>}
    <p className="field-help">The page receives <code>{`{ type: 'milver-input', inputs: { input1, input2 }, block: { id, label } }`}</code>. Reply with <code>{`{ type: 'milver-output', value: ... }`}</code> using <code>parent.postMessage(message, '*')</code>. An optional <code>milver-ready</code> message requests the latest inputs. Updates do not reload the page.</p>
    {invalid&&<p role="alert" className="code-error">Invalid iframe settings. Repair the parameter in the block JSON.</p>}
  </>;
}

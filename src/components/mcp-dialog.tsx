import {useEffect,useState} from 'react';
import {Copy} from 'lucide-react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './ui/dialog';
import {Button} from './ui/button';
import {Textarea} from './ui/textarea';
import {Field} from './editor-ui';
import '../mcp/browser';
const connectionCode=`// Browser console, injected browser agent, or same-page connector:
const tools = window.milverMcp.tools;
await window.milverMcp.call('milver_get_state', {});
// Guide: ${new URL(import.meta.env.BASE_URL+'docs/browser-mcp/',location.origin).href}
`;
export function McpDialog({close}:{close:()=>void}){
  const [,refresh]=useState(0),[name,setName]=useState('milver_get_state'),[args,setArgs]=useState('{}'),[result,setResult]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{const update=()=>refresh(value=>value+1);window.addEventListener('milver-mcp-status',update);return()=>window.removeEventListener('milver-mcp-status',update);},[]);
  const api=window.milverMcp,tool=api?.tools.find(tool=>tool.name===name);
  return <Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="mcp-dialog"><DialogHeader><DialogTitle>Browser MCP control</DialogTitle><DialogDescription>Control this open editor through browser-local tools. No backend or public HTTP endpoint.</DialogDescription></DialogHeader>
    <p className="field-help">{api?.tools.length??0} tools · {api?.status.nativeTools?`${api.status.nativeTools} native WebMCP tools registered`:'WebMCP unavailable; browser bridge active'} · {api?.status.connections??0} MessagePort clients</p>
    {api?.status.nativeError&&<p className="field-help">Native registration: {api.status.nativeError}</p>}
    <Field label="Tool"><select aria-label="MCP tool" value={name} onChange={event=>setName(event.target.value)}>{api?.tools.map(tool=><option key={tool.name} value={tool.name}>{tool.name}</option>)}</select></Field>
    <p className="field-help">{tool?.description}</p>
    <details><summary>Input schema</summary><pre className="mcp-output">{JSON.stringify(tool?.inputSchema,null,2)}</pre></details>
    <Field label="JSON arguments"><Textarea aria-label="MCP arguments" value={args} rows={4} onChange={event=>setArgs(event.target.value)}/></Field>
    <div className="module-toolbar"><Button size="sm" disabled={busy||!api} onClick={async()=>{setBusy(true);try{const reply=await api!.call(name,JSON.parse(args));setResult(reply.content.map(item=>item.text).join('\n'));}catch(error){setResult(String(error));}finally{setBusy(false);}}}>{busy?'Running…':'Run tool'}</Button><Button size="sm" variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(connectionCode);setResult('Connection code copied.');}catch(error){setResult(String(error));}}}><Copy/>Copy connection code</Button></div>
    <pre className="mcp-output" aria-label="MCP result">{result||connectionCode}</pre>
    <p className="field-help"><a href={import.meta.env.BASE_URL+'docs/browser-mcp/'} target="_blank" rel="noreferrer">Connection guide</a> · <a href={import.meta.env.BASE_URL+'mcp/'} target="_blank" rel="noreferrer">MCP discovery</a> · <a href={import.meta.env.BASE_URL+'mcp/connection.json'} target="_blank" rel="noreferrer">Connection JSON</a></p>
    <p className="field-help">Native WebMCP is detected on document.modelContext. Other browsers can use window.milverMcp or the same-window MessagePort bridge. Desktop MCP clients need a browser connector; this static page does not listen on /mcp. Tools can edit code and project data just like the editor.</p>
  </DialogContent></Dialog>;
}

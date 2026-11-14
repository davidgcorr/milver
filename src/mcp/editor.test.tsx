// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {beforeEach,afterEach,expect,it,vi} from 'vitest';
import App from '../App';
import {serializeDiagram} from '../model';
import {MessageChannel} from 'node:worker_threads';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
beforeEach(()=>{vi.stubGlobal('DOMMatrixReadOnly',class{m22=1;});vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});localStorage.clear();localStorage.setItem('milver.diagram.v1',serializeDiagram({version:1,name:'MCP test',nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}}));});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();localStorage.clear();});
async function workspace(test:()=>Promise<void>){const host=document.createElement('div');document.body.append(host);const root=createRoot(host);try{await act(async()=>root.render(createElement(App)));await test();await act(async()=>new Promise<void>(resolve=>requestAnimationFrame(()=>resolve())));}finally{await act(async()=>root.unmount());host.remove();}expect(window.milverMcp).toBeUndefined();}
async function call(name:string,args:Record<string,unknown>={}){let reply:any;await act(async()=>{reply=await window.milverMcp!.call('milver_'+name,args);});if(reply.isError)throw new Error(reply.content[0].text);return reply.structuredContent;}
it('uses real editor transactions for math wiring, properties, JSON patches, selection and undo',async()=>workspace(async()=>{
 await call('create_block',{recipe:'Matrix',id:'matrix',position:{x:10,y:20}});await call('create_block',{recipe:'Transpose',id:'transpose',position:{x:310,y:20}});
 let project=await call('get_project');expect(project.modules.length).toBeGreaterThan(0);
 const output=project.nodes[0].data.ports.find((p:any)=>p.type==='output').id,input=project.nodes[1].data.ports.find((p:any)=>p.type==='input').id;
 await call('connect',{source:'matrix',target:'transpose',sourceHandle:output,targetHandle:input,id:'wire'});
 await call('update_block',{id:'matrix',data:{visuals:{shadow:12,strokeWidth:3,strokeColor:'#ff0000',opacity:.7}}});
 const frame=document.querySelector<HTMLElement>('[data-id="matrix"] .diagram-block')!;expect(frame.style.borderWidth).toBe('3px');expect(frame.style.borderColor).toBe('rgb(255, 0, 0)');expect(frame.style.boxShadow).toContain('12px');
 await call('patch_project',{operations:[{op:'replace',path:'/nodes/0/data/label',value:'Renamed matrix'}]});
 expect((await call('get_project')).nodes[0].data.label).toBe('Renamed matrix');
 const failed=await window.milverMcp!.call('milver_patch_project',{operations:[{op:'replace',path:'/nodes/0/data/label',value:'Invalid'},{op:'add',path:'/nodes/0/data/visuals/strokeWidth',value:-1}]});expect(failed.isError).toBe(true);expect((await call('get_project')).nodes[0].data.label).toBe('Renamed matrix');
 await call('history',{action:'undo'});expect((await call('get_project')).nodes[0].data.label).toBe('Matrix');await call('history',{action:'redo'});
 await call('select',{nodes:['matrix']});expect((await call('get_state')).selectedNodes).toEqual(['matrix']);
 await call('clipboard',{action:'duplicate'});expect((await call('get_project')).nodes).toHaveLength(3);
 await call('delete_blocks',{ids:['matrix']});expect((await call('get_project')).edges).toHaveLength(0);
 await call('clear_canvas');expect((await call('get_project')).nodes).toHaveLength(0);
}));
it('controls UI drafts, CodeMirror, inspector sizing, storage, libraries, examples and exports',async()=>workspace(async()=>{
 await call('create_block',{recipe:'DOM',id:'block'});
 await call('workspace',{patch:{inspector:true,inspectorWidth:511,inspectorTab:'render'}});
 expect(document.querySelector('[aria-label="Resize inspector"]')!.getAttribute('aria-valuenow')).toBe('511');
 let controls=(await call('ui',{action:'list',limit:1000})).result as any[];
 const editor=controls.find(c=>c.tag==='div'&&document.querySelector(c.selector)?.closest('.cm-editor'));expect(editor).toBeTruthy();
 const code='function render({block}) { return <div>{block.label}</div>; }';
 await call('ui',{action:'fill',selector:editor.selector,value:code});
 controls=(await call('ui',{action:'list',limit:1000})).result;const apply=controls.find((c:any)=>c.tag==='button'&&c.label.includes('Apply render'));expect(apply).toBeTruthy();
 await call('ui',{action:'click',selector:apply.selector});expect((await call('get_project')).nodes[0].data.render).toBe(code);
 await call('libraries',{action:'put',module:{id:'helper',alias:'helper',kind:'javascript',source:'export const n=2;'}});expect((await call('libraries',{action:'list'})).result).toHaveLength(1);
 const saved=await call('saved_blocks',{action:'save',id:'block',name:'Custom'});await call('saved_blocks',{action:'insert',id:saved.id});expect((await call('get_project')).nodes).toHaveLength(2);
 const stored=await call('projects',{action:'save'});await call('projects',{action:'rename',id:stored.id,name:'Stored'});expect((await call('projects',{action:'get',id:stored.id})).name).toBe('Stored');
 expect((await call('export',{format:'json'})).text).toContain('function render');expect((await call('export',{format:'svg'})).text).toContain('<svg');
 await call('load_example',{id:'nanogpt'});expect((await call('get_project')).nodes.length).toBeGreaterThan(2);
 await call('projects',{action:'open',id:stored.id});expect((await call('get_project')).nodes).toHaveLength(2);
 await call('projects',{action:'remove',id:stored.id});expect((await call('projects',{action:'list'})).result).toHaveLength(0);
}));
it('exposes an initialized JSON-RPC MessagePort session and rejects foreign connections',async()=>workspace(async()=>{
 const channel=new MessageChannel(),foreign=new MessageChannel();
 try{
 window.dispatchEvent(new MessageEvent('message',{source:window,origin:'https://foreign.invalid',data:{type:'milver-mcp-connect'},ports:[foreign.port1 as any]}));expect(window.milverMcp!.status.connections).toBe(0);
 window.dispatchEvent(new MessageEvent('message',{source:window,origin:location.origin,data:{type:'milver-mcp-connect'},ports:[channel.port1 as any]}));expect(window.milverMcp!.status.connections).toBe(1);
 const request=(message:any)=>new Promise<any>(resolve=>{channel.port2.once('message',resolve);channel.port2.postMessage(message);});
 expect((await request({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-11-25',clientInfo:{name:'test'},capabilities:{}}})).result.serverInfo.name).toBe('milver-browser');
 channel.port2.postMessage({jsonrpc:'2.0',method:'notifications/initialized'});
 expect((await request({jsonrpc:'2.0',id:2,method:'tools/list'})).result.tools.length).toBeGreaterThan(25);
 const resource=await request({jsonrpc:'2.0',id:3,method:'resources/read',params:{uri:'milver://project/current'}});expect(JSON.parse(resource.result.contents[0].text).name).toBe('MCP test');
 }finally{channel.port1.close();channel.port2.close();foreign.port1.close();foreign.port2.close();}
}));
it('registers the same tools with native document.modelContext and aborts registrations on unmount',async()=>{
 const registrations:any[]=[];const registerTool=vi.fn(async(tool,options)=>{registrations.push({tool,options});});Object.defineProperty(document,'modelContext',{value:{registerTool},configurable:true});
 try{await workspace(async()=>{await act(async()=>new Promise(resolve=>setTimeout(resolve,0)));expect(registerTool).toHaveBeenCalledTimes(window.milverMcp!.tools.length);const native=registrations.find(r=>r.tool.name==='milver_get_project');expect((await native.tool.execute({})).structuredContent.name).toBe('MCP test');expect(native.options.signal.aborted).toBe(false);});expect(registrations.every(r=>r.options.signal.aborted)).toBe(true);}finally{delete (document as any).modelContext;}
});

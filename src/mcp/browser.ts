import {createMcpServer,browserInstructions} from './server';
import {editorTools,type EditorAdapter} from './tools';
import {serializeDiagram} from '../model';
import {stringifySignal} from '../signal-json';
export type BrowserMcp=ReturnType<typeof createMcpServer>&{request:(message:unknown)=>Promise<any>;status:{enabled:boolean;nativeTools:number;nativeError?:string;connections:number};dispose:()=>void};
declare global{interface Window{milverMcp?:BrowserMcp}}
let nativeQueue:Promise<unknown>=Promise.resolve();
export function installBrowserMcp(api:EditorAdapter):BrowserMcp{
  const tools=editorTools(api);
  const server=createMcpServer(tools,uri=>uri==='milver://project/current'?JSON.parse(serializeDiagram(api.getProject())):uri==='milver://editor/state'?api.inspect():{instructions:browserInstructions,tools:server.tools});
  const direct=server.session(),controller=new AbortController(),ports=new Map<MessagePort,ReturnType<typeof server.session>>();
  const status:BrowserMcp['status']={enabled:true,nativeTools:0,connections:0};
  const notify=()=>window.dispatchEvent(new Event('milver-mcp-status'));
  const connect=(event:MessageEvent)=>{
    if(event.source!==window||event.origin!==location.origin||event.data?.type!=='milver-mcp-connect'||event.ports.length!==1)return;
    const port=event.ports[0],session=server.session();ports.set(port,session);status.connections=ports.size;notify();
    port.onmessage=async event=>{const response=await session.request(event.data);if(response!==null&&!controller.signal.aborted)port.postMessage(typeof event.data==='string'?stringifySignal(response):response);};
    const disconnect=()=>{session.close();port.close();ports.delete(port);status.connections=ports.size;notify();};
    port.onmessageerror=disconnect;port.addEventListener('close',disconnect,{once:true});port.start();
  };
  window.addEventListener('message',connect);
  const modelContext=(document as any).modelContext??(navigator as any).modelContext;
  nativeQueue=nativeQueue.catch(()=>{}).then(async()=>{
    if(controller.signal.aborted||!modelContext?.registerTool)return;
    const results=await Promise.allSettled(tools.map(async tool=>{
      await modelContext.registerTool({name:tool.name,description:tool.description,inputSchema:tool.inputSchema,annotations:{readOnlyHint:tool.annotations.readOnlyHint},execute:(args:Record<string,unknown>,context?:{signal?:AbortSignal})=>server.call(tool.name,args,context?.signal)}, {signal:controller.signal});return tool.name;
    }));
    if(controller.signal.aborted)return;
    status.nativeTools=results.filter(result=>result.status==='fulfilled').length;
    const failed=results.find(result=>result.status==='rejected');if(failed?.status==='rejected')status.nativeError=String(failed.reason);notify();
  });
  const instance:BrowserMcp={...server,request:direct.request,status,dispose(){controller.abort();direct.close();for(const[port,session]of ports){session.close();port.close();}ports.clear();status.enabled=false;status.connections=0;window.removeEventListener('message',connect);if(window.milverMcp===instance)delete window.milverMcp;notify();}};
  window.milverMcp=instance;notify();return instance;
}

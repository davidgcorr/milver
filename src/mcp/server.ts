import { stringifySignal } from '../signal-json';
import type {Tool} from './tools';
export const protocolVersion='2025-11-25';
export const browserInstructions='milver browser-only control. Read milver_get_state and milver_get_catalog first. Project edits validate atomically and support undo. Inputs/state/libraries/code/render/geometry/parents are portable JSON. Use milver_ui to discover and operate remaining controls, with frame=<block ID> for mounted block DOM. This is a local MessagePort transport, not an HTTP server.';
export type ToolResult={content:{type:'text';text:string}[];structuredContent?:Record<string,unknown>;isError?:boolean};
export function validate(schema:Record<string,any>,value:any,path='arguments'):void {
  if(schema.enum&&!schema.enum.some((item:any)=>Object.is(item,value)))throw new Error(`${path}: unsupported value.`);
  if(schema.type==='object'){if(!value||typeof value!=='object'||Array.isArray(value))throw new Error(`${path}: expected object.`);for(const key of schema.required??[])if(!Object.hasOwn(value,key))throw new Error(`${path}.${key}: required.`);for(const[key,item]of Object.entries(value)){if(['__proto__','constructor','prototype'].includes(key))throw new Error(`${path}: unsafe property.`);if(schema.properties?.[key])validate(schema.properties[key],item,`${path}.${key}`);else if(schema.additionalProperties===false)throw new Error(`${path}.${key}: unknown property.`);}}
  if(schema.type==='array'){if(!Array.isArray(value))throw new Error(`${path}: expected array.`);value.forEach((item,i)=>validate(schema.items??{},item,`${path}[${i}]`));}
  if(schema.type==='string'&&typeof value!=='string')throw new Error(`${path}: expected string.`);
  if(schema.type==='boolean'&&typeof value!=='boolean')throw new Error(`${path}: expected boolean.`);
  if(schema.type==='number'&&(typeof value!=='number'||!Number.isFinite(value)))throw new Error(`${path}: expected finite number.`);
  if(typeof value==='number'&&(schema.minimum!==undefined&&value<schema.minimum||schema.maximum!==undefined&&value>schema.maximum))throw new Error(`${path}: outside allowed range.`);
}
export function createMcpServer(tools:Tool[],readResource:(uri:string)=>unknown){
  let queue:Promise<unknown>=Promise.resolve();
  const descriptors=tools.map(({execute:_,...tool})=>tool);
  const call=(name:string,args:Record<string,any>={},signal?:AbortSignal):Promise<ToolResult>=>{
    const task=queue.then(async()=>{try{signal?.throwIfAborted();const tool=tools.find(tool=>tool.name===name);if(!tool)throw new Error(`Unknown tool ${name}`);validate(tool.inputSchema,args);const result=await tool.execute(args,signal);const normalized=JSON.parse(stringifySignal(result??null));return {content:[{type:'text' as const,text:stringifySignal(normalized,2)}],structuredContent:normalized&&typeof normalized==='object'&&!Array.isArray(normalized)?normalized:{result:normalized}};}catch(error){return {content:[{type:'text' as const,text:error instanceof Error?error.message:String(error)}],isError:true};}});
    queue=task.catch(()=>{});return task;
  };
  const session=()=>{
    let initialized=false,ready=false,closed=false;const pending=new Map<string|number,AbortController>();
    const request=async(raw:unknown):Promise<any>=>{
      let message:any,id:any=null;
      const error=(code:number,text:string)=>({jsonrpc:'2.0',id,error:{code,message:text}});
      try{message=typeof raw==='string'?JSON.parse(raw):raw;}catch{return error(-32700,'Invalid JSON.');}
      if(!message||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string')return error(-32600,'Invalid JSON-RPC request.');
      const notification=!Object.hasOwn(message,'id');id=message.id;
      if(!notification&&typeof id!=='string'&&!(typeof id==='number'&&Number.isFinite(id)))return {...error(-32600,'Request ID must be a string or number.'),id:null};
      if(closed)return notification?null:error(-32000,'Session closed.');
      if(notification){if(message.method==='notifications/initialized'&&initialized)ready=true;if(message.method==='notifications/cancelled')pending.get(message.params?.requestId)?.abort();return null;}
      if(message.method==='ping')return {jsonrpc:'2.0',id,result:{}};
      if(message.method==='initialize'){
        if(initialized)return error(-32600,'Session already initialized.');
        if(typeof message.params?.protocolVersion!=='string'||!message.params?.clientInfo||!message.params?.capabilities)return error(-32602,'protocolVersion, clientInfo and capabilities are required.');
        initialized=true;return {jsonrpc:'2.0',id,result:{protocolVersion,capabilities:{tools:{listChanged:false},resources:{listChanged:false,subscribe:false}},serverInfo:{name:'milver-browser',version:'1.0.0'},instructions:browserInstructions}};
      }
      if(!ready)return error(-32002,'Initialize the session and send notifications/initialized first.');
      if(pending.has(id))return error(-32600,'Duplicate in-flight request ID.');
      const controller=new AbortController();pending.set(id,controller);
      try{
        let result:any;
        switch(message.method){
          case 'tools/list':result={tools:descriptors};break;
          case 'tools/call':if(typeof message.params?.name!=='string'||!tools.some(tool=>tool.name===message.params.name))return error(-32602,'Unknown tool.');result=await call(message.params.name,message.params.arguments??{},controller.signal);break;
          case 'resources/list':result={resources:[{uri:'milver://project/current',name:'Current project',mimeType:'application/json'},{uri:'milver://editor/state',name:'Editor state',mimeType:'application/json'},{uri:'milver://editor/tools',name:'Tool schemas and instructions',mimeType:'application/json'}]};break;
          case 'resources/read':{const uri=message.params?.uri;if(!['milver://project/current','milver://editor/state','milver://editor/tools'].includes(uri))return error(-32602,'Unknown resource.');result={contents:[{uri,mimeType:'application/json',text:stringifySignal(readResource(uri),2)}]};break;}
          default:return error(-32601,'Method not found.');
        }
        return {jsonrpc:'2.0',id,result};
      }catch(cause){return error(-32603,cause instanceof Error?cause.message:String(cause));}finally{pending.delete(id);}
    };
    return {request,close(){closed=true;for(const controller of pending.values())controller.abort();pending.clear();}};
  };
  return {tools:descriptors,call,session};
}

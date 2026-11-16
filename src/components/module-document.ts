import type { ModuleSources } from '../project/module-sources';
import { browserUi } from '../mcp/dom';
import { signalReplacer, signalReviver } from '../signal-json';
import sandboxStyles from '../sandbox-ui.css?raw';
import type { Port } from '../model';
import type { ModuleDependency, WasmConfig, RendererConfig } from '../code-config';
import { isSignal, type Signal } from '../runtime';
export type ModuleOptions = { moduleSources?: ModuleSources; dependencies?: ModuleDependency[]; ports?: Pick<Port, 'id' | 'type' | 'variable'>[]; wasm?: WasmConfig; token?: string; state?: Record<string, Signal>; uiSource?: string; renderer?: RendererConfig };
export function moduleDocument(source: string, options: ModuleOptions = {}): string {
  const encode = (value: unknown) => JSON.stringify(value, signalReplacer).replace(/</g, '\\u003c');
  return `<!doctype html><html><head><style>${sandboxStyles}html,body,#mask{margin:0;width:100%;height:100%;overflow:hidden}body{font:12px system-ui}#mask{display:grid;place-items:center}pre{white-space:pre-wrap;color:#dc2626;font:10px monospace;padding:8px}input,select,button{font:inherit;accent-color:currentColor}button{cursor:pointer}</style></head><body><div id="mask"></div><script type="module">
const wireReplacer = (${signalReplacer.toString()}), wireReviver = (${signalReviver.toString()});
const element = document.getElementById('mask'), config=${encode(options)};
const validSignal=(${isSignal.toString()});
let mount, current, pending, running=false, modules={}, ui, lastInput;
// Observed state contains Proxies, which postMessage cannot structured-clone.
// The wire contract is bounded JSON, so always send a detached JSON snapshot.
const send = data => parent.postMessage(JSON.parse(JSON.stringify({...data, token:config.token}, wireReplacer), wireReviver), '*');
const report = error => { const previous=current;current=undefined;try{const cleanup=typeof previous==='function'?previous():previous?.destroy?.();Promise.resolve(cleanup).catch(()=>{});}catch{} element.replaceChildren(); const p=document.createElement('pre');p.textContent=error?.message || String(error);element.append(p);send({type:'mask-error',error:error?.message || String(error)}); };
addEventListener('error', e=>report(e.error || e.message));
addEventListener('unhandledrejection', e=>report(e.reason));
let stateQueued=false;const stateListeners=new Set();
const subscribeState=listener=>{stateListeners.add(listener);return()=>stateListeners.delete(listener);};
const stateTarget=JSON.parse(JSON.stringify(config.state??{}), wireReviver), proxies=new WeakMap();
const persistState=()=>{for(const listener of stateListeners)listener();if(stateQueued)return;stateQueued=true;queueMicrotask(()=>{stateQueued=false;if(validSignal(stateTarget))send({type:'mask-state',state:stateTarget});else report(new Error('State must be bounded JSON data.'));});};
function observe(value){if(!value||typeof value!=='object')return value;if(proxies.has(value))return proxies.get(value);const proxy=new Proxy(value,{get:(target,key)=>observe(target[key]),set(target,key,value){if(['__proto__','constructor','prototype'].includes(String(key)))throw new Error('Invalid state key');if(Object.is(target[key],value))return true;target[key]=value;persistState();return true;},deleteProperty(target,key){delete target[key];persistState();return true;}});proxies.set(value,proxy);return proxy;}
const state=observe(stateTarget);
const setProperty=(path,value)=>{if(typeof path==='string'&&validSignal(value))send({type:'mask-property',path,value});};
const outputPorts=(config.ports??[]).filter(p=>p.type==='output');
const emit=(value, port=outputPorts[0]?.id??'out-0', event=false)=>{const resolved=outputPorts.find(p=>p.variable===port)?.id??port;if(validSignal(value))send({type:'mask-output',port:resolved,value,...(event?{event:true}:{})});else report(new Error('Output must be bounded JSON data (numbers (including infinity), strings, arrays, or objects; NaN is not supported).'));};
const emitEvent=(value,port)=>emit(value,port,true);
const setValue=value=>{if(typeof value==='string'&&value.length<=100000)send({type:'mask-value',value});};
async function flush() {
 if(running || !mount) return; running=true;
 try { while(pending) {
   const next=pending;pending=null;
   const inputKey=JSON.stringify([next.inputs,next.value,next.color,next.background,next.block], wireReplacer);
   const stateChanged=next.state&&JSON.stringify(next.state,wireReplacer)!==JSON.stringify(stateTarget,wireReplacer);
   if(lastInput===inputKey&&!stateChanged&&current)continue;
   if(stateChanged){for(const key of Object.keys(stateTarget))delete stateTarget[key];Object.assign(stateTarget,next.state);}
   lastInput=inputKey;
   send({type:'mask-status',error:''});
   document.body.style.color=next.color;element.style.background=next.background;
   const inputs={...next.inputs},variables={};
   (config.ports??[]).filter(p=>p.type==='input').forEach((p,i)=>{inputs['input'+(i+1)]=next.inputs[p.id]??null;});
   for(const p of config.ports??[])if(p.type==='input'&&p.variable){inputs[p.variable]=next.inputs[p.id]??null;variables[p.variable]=next.inputs[p.id]??null;}
   if(current && typeof current.update==='function')await current.update(inputs,next.value,variables,next.block);
   else {
     if(typeof current==='function')await current();else if(current?.destroy)await current.destroy();
     element.replaceChildren();current=await mount({element,inputs,variables,value:next.value,emit,emitEvent,setValue,modules,state,setProperty,subscribeState,reportError:report,block:next.block,ui,renderer:config.renderer,wasm:config.wasm,ports:config.ports});
   }
 } } catch(error) { report(error); } finally { running=false; }
}
const browserUi=(${browserUi.toString()});
addEventListener('message',async e=>{if(e.source!==parent||e.data?.type!=='mask-command')return;try{const request=e.data;let result;if(request.action==='inspect')result=current?.inspect?.()??{state,actions:[]};else if(request.action==='ui')result=browserUi(request.command,document);else if(request.action==='action'){if(!current?.invokeAction)throw new Error('This renderer does not expose actions.');result=await current.invokeAction(request.name,request.args??[]);}else throw new Error('Unknown block command.');send({type:'mask-command-result',requestId:request.requestId,result:result??null});}catch(error){send({type:'mask-command-result',requestId:e.data.requestId,error:error?.message??String(error)});}});
addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='mask-input'){pending=e.data;flush();}});
const urls=[];
addEventListener('pagehide',()=>{if(typeof current==='function')current();else current?.destroy?.();urls.forEach(url=>URL.revokeObjectURL(url));});
try {
 if(config.uiSource){const uiUrl=URL.createObjectURL(new Blob([config.uiSource],{type:'text/javascript'}));urls.push(uiUrl);ui=await import(uiUrl);}
 modules.React=ui?.React;modules.ReactDOM=ui?.ReactDOM;modules.shadcn=ui ? {Button:ui.Button,Slider:ui.Slider,Select:ui.Select,SelectTrigger:ui.SelectTrigger,SelectValue:ui.SelectValue,SelectContent:ui.SelectContent,SelectItem:ui.SelectItem} : {};
 const imports=Object.create(null);
 // Embedded React libraries must use the same React instance as the block UI.
 if(ui?.React){
   globalThis.__milverReactUI=ui;
   const bridge=(specifier,expression,namespace,defaultExport=false)=>{
     const names=Object.keys(namespace??{}).filter(name=>/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)&&name!=='default'&&name!=='__esModule');
     const source='const namespace='+expression+';'+(defaultExport?'export default namespace;':'')+names.map(name=>'export const '+name+'=namespace['+JSON.stringify(name)+'];').join('');
     const url=URL.createObjectURL(new Blob([source],{type:'text/javascript'}));urls.push(url);imports[specifier]=url;
   };
   bridge('react','globalThis.__milverReactUI.React',ui.React,true);
   if(ui.ReactDOM)bridge('react-dom','globalThis.__milverReactUI.ReactDOM',ui.ReactDOM,true);
   bridge('react-dom/client','globalThis.__milverReactUI.ReactDOMClient',ui.ReactDOMClient??{});
   if(ui.jsxRuntime)bridge('react/jsx-runtime','globalThis.__milverReactUI.jsxRuntime',ui.jsxRuntime);
 }

 for(const [name,entry] of Object.entries(config.moduleSources??{})){const url=URL.createObjectURL(new Blob([entry.resolvedSource],{type:'text/javascript'}));urls.push(url);imports[name]=url;}
 for(const d of config.dependencies??[]){if(imports[d.specifier])continue;if(d.url)imports[d.specifier]=imports[d.url]??d.url;else{const url=URL.createObjectURL(new Blob([d.source],{type:'text/javascript'}));urls.push(url);imports[d.specifier]=url;}}
 const map=document.createElement('script');map.type='importmap';map.textContent=JSON.stringify({imports});document.head.append(map);
 modules={...modules,...Object.fromEntries(await Promise.all(Object.keys(imports).map(async name=>[name,await import(name)])))};
 for(const namespace of Object.values(modules)){if(namespace?.tf){await namespace.ready;modules.tf??=namespace.tf;modules.tensorMath??=namespace;}}
 const url=URL.createObjectURL(new Blob([${encode(source)}],{type:'text/javascript'}));urls.push(url);const module=await import(url);mount=module.default;
 if(typeof mount!=='function')throw new Error('Export a default mount function.');send({type:'mask-ready'});flush();
} catch(error){report(error);}
</script></body></html>`;
}

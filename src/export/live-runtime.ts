import {moduleDocument,type ModuleOptions} from '../components/module-document';
import {runtimeDocument} from '../project/sandbox';
import {isSignal,signalsEqual,type Signal} from '../runtime';
import {parseSignal} from '../signal-json';
import type {ProjectPlan} from '../project/graph';
import type {ExternalValue,ExecutionResult} from '../project/engine';
export type ExportBlock={id:string;frameKey?:string;source:string;options:ModuleOptions;block:Record<string,any>;value:string;color:string;background:string};
export type ExportRuntimeConfig={blocks:ExportBlock[];plan:ProjectPlan;uiSource:string;workerSource:string;mathSource:string;controlledPaths:readonly string[]};

// Runs in the publication, including when that publication is itself embedded.
// Executable project code stays in opaque child frames and the computation worker.
export function mountExport(config:ExportRuntimeConfig){
 const records=new Map<string,{definition:ExportBlock;frame:HTMLIFrameElement;token:string;ready:boolean;inputs:Record<string,Signal>}>();
 const external:Record<string,ExternalValue>={};let result:ExecutionResult|undefined,ready=false,busy=false,pending=false,disposed=false;
 const runtimeToken=crypto.randomUUID(),runtime=document.createElement('iframe');
 runtime.hidden=true;runtime.title='Export project computation';runtime.setAttribute('sandbox','allow-scripts');
 function execute(){if(disposed)return;if(!ready||busy){pending=true;return;}pending=false;busy=true;runtime.contentWindow?.postMessage({type:'execute',token:runtimeToken,id:1,plan:config.plan,external,mode:'live'},'*');}
 let scheduled=false;
 function schedule(){if(scheduled||disposed)return;scheduled=true;queueMicrotask(()=>{scheduled=false;execute();});}
 function send(record:ReturnType<typeof records.get>){if(!record?.ready)return;const d=record.definition;record.frame.contentWindow?.postMessage({type:'mask-input',inputs:record.inputs,value:d.value,block:d.block,color:d.color,background:d.background},'*');}
 function error(message:string){let banner=document.getElementById('export-runtime-error');if(!banner){banner=document.createElement('div');banner.id='export-runtime-error';banner.setAttribute('role','alert');banner.style.cssText='position:fixed;bottom:38px;left:12px;max-width:80vw;padding:8px;background:#fff1f2;color:#9f1239;font:12px system-ui;z-index:10';document.body.append(banner);}banner.textContent=message;}
 const receive=(event:MessageEvent)=>{
  if(disposed)return;
  if(event.source===runtime.contentWindow&&event.data?.token===runtimeToken){
   const message=event.data;
   if(message.type==='ready'){ready=true;schedule();}
   if(message.type==='result'){busy=false;result=message.result;for(const[id,record]of records){record.inputs=result?.nodes[id]?.inputs??{};send(record);}if(pending)schedule();}
   if(message.type==='fatal'||message.type==='error'){busy=false;error(String(message.error));}
   return;
  }
  const record=[...records.values()].find(record=>event.source===record.frame.contentWindow&&event.data?.token===record.token);if(!record)return;
  const message=event.data,d=record.definition;
  if(message.type==='mask-ready'){record.ready=true;record.inputs=result?.nodes[d.id]?.inputs??{};send(record);}
  if(message.type==='mask-output'&&d.options.ports?.some(port=>port.type==='output'&&port.id===message.port)&&isSignal(message.value)){
   const previous=external[d.id]??{values:{},events:{}};if(!message.event&&signalsEqual(previous.values[message.port] as Signal,message.value))return;
   external[d.id]={values:{...previous.values,[message.port]:message.value},events:{...previous.events,...(message.event?{[message.port]:(previous.events?.[message.port]??0)+1}:{})}};schedule();
  }
  if(message.type==='mask-error'){external[d.id]={values:Object.fromEntries((d.options.ports??[]).filter(port=>port.type==='output').map(port=>[port.id,null]))};schedule();}
  if(message.type==='mask-value'&&typeof message.value==='string'&&message.value.length<=100000&&message.value!==d.value){d.value=message.value;d.block.value=message.value;const node=config.plan.nodes.find(node=>node.id===d.id);if(node)node.data.value=message.value;send(record);schedule();}
  if(message.type==='mask-state'&&isSignal(message.state)&&message.state&&typeof message.state==='object'&&!Array.isArray(message.state))d.options.state=message.state;
  if(message.type==='mask-property'&&config.controlledPaths.includes(message.path)&&isSignal(message.value)){
   const path=message.path as string,value=message.value;
   const limits:Record<string,[number,number]>={width:[120,2000],height:[90,2000],'visuals.opacity':[0,1],'visuals.radius':[0,60],'visuals.shadow':[0,40],'visuals.strokeWidth':[0,12]};
   if(limits[path]&&(typeof value!=='number'||!Number.isFinite(value)||value<limits[path][0]||value>limits[path][1]))return;
   if(/visuals\.(background|foreground|strokeColor)$/.test(path)&&(typeof value!=='string'||!/^#[0-9a-f]{6}$/i.test(value)))return;
   if(path.startsWith('visuals.show')&&typeof value!=='boolean')return;
   if(['label','description','value'].includes(path)&&typeof value!=='string')return;
   const target=path.startsWith('visuals.')?(d.block.visuals??={}):d.block,key=path.split('.').at(-1)!;if(signalsEqual(target[key],value))return;target[key]=value;
   if(path==='value'){d.value=String(value);const node=config.plan.nodes.find(node=>node.id===d.id);if(node)node.data.value=d.value;schedule();}
   if(path==='visuals.foreground')d.color=String(value);if(path==='visuals.background')d.background=String(value);
   const group=record.frame.closest<SVGGElement>('[data-block]'),visuals=d.block.visuals??{};
   if(group){if(visuals.opacity!==undefined)group.style.opacity=String(visuals.opacity);const shape=group.querySelector<SVGElement>(':scope>rect,:scope>ellipse,:scope>g[filter]>rect');if(shape){if(visuals.background)shape.setAttribute('fill',visuals.background);if(visuals.strokeColor)shape.setAttribute('stroke',visuals.strokeColor);if(visuals.strokeWidth!==undefined)shape.setAttribute('stroke-width',String(visuals.strokeWidth));if(visuals.radius!==undefined)shape.setAttribute('rx',String(visuals.radius));}}
   send(record);
  }
 };
 window.addEventListener('message',receive);
 for(const definition of config.blocks){
  const existing=[...document.querySelectorAll<HTMLIFrameElement>('iframe[data-export-key]')].find(frame=>frame.dataset.exportKey===definition.frameKey);
  const frame=existing??document.createElement('iframe');if(!existing){frame.hidden=true;document.body.append(frame);}
  const token=crypto.randomUUID();frame.setAttribute('sandbox','allow-scripts');frame.title=String(definition.block.label??'Block render');
  records.set(definition.id,{definition,frame,token,ready:false,inputs:{}});
  const dependencies=definition.options.dependencies?.map(dependency=>dependency.source==='__MILVER_BUILTIN_MATH__'?{...dependency,source:config.mathSource}:dependency);
  frame.srcdoc=moduleDocument(definition.source,{...definition.options,dependencies,uiSource:config.uiSource,token});
 }
 runtime.srcdoc=runtimeDocument(config.workerSource,runtimeToken);document.body.append(runtime);
 const timer=config.plan.nodes.some(node=>['Clock','Counter'].includes(node.data.recipe??''))?setInterval(schedule,50):undefined;
 const dispose=()=>{if(disposed)return;disposed=true;window.removeEventListener('pagehide',dispose);clearInterval(timer);window.removeEventListener('message',receive);runtime.contentWindow?.postMessage({type:'stop',token:runtimeToken},'*');runtime.remove();for(const record of records.values())record.frame.remove();};
 window.addEventListener('pagehide',dispose,{once:true});return dispose;
}
export function startExport(){const data=document.getElementById('export-runtime');if(data)mountExport(parseSignal(data.textContent??'{}') as ExportRuntimeConfig);}

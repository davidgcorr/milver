import {buildBlockModule,controlledPaths} from '../block-code';
import {defaultModule,type Canvas,type Diagram} from '../model';
import {compileProject,nodeKey} from '../project/graph';
import {viewerLogic,viewerRender} from '../viewer-code';
import type {ExportPage} from './scene';
import type {ExportBlock,ExportRuntimeConfig} from './live-runtime';
export async function liveConfig(project:Diagram,pages:ExportPage[]):Promise<{config:ExportRuntimeConfig;runtime:string}|undefined>{
 const blocks:ExportBlock[]=[];
 const visit=(canvas:Canvas,path:string[])=>{canvas.nodes.forEach((node,index)=>{
  if(['javascript','renderer'].includes(node.data.kind)){
   const data=node.data,page=pages.find(page=>JSON.stringify(page.path)===JSON.stringify(path));let source:string;
   try{const logic=data.module??(data.kind==='renderer'?viewerLogic:defaultModule),render=data.render??(data.kind==='renderer'?viewerRender:undefined);source=render===undefined?logic:buildBlockModule(logic,render);}catch(error){source=`export default function(){throw new Error(${JSON.stringify(String(error))});}`;}
   const dependencies=[...new Map([...(data.dependencies??[]),...(project.modules??[]).flatMap(module=>[...(module.dependencies??[]),{specifier:module.alias,...(module.builtin?{source:'__MILVER_BUILTIN_MATH__'}:module.url?{url:module.url}:{source:module.source})}])].map(dependency=>[dependency.specifier,dependency])).values()];
   blocks.push({id:nodeKey(path,node.id),...(page?{frameKey:`${page.index}-${index}`}:{ }),source,options:{ports:data.ports,state:data.state,dependencies,wasm:data.wasm,renderer:data.renderer},block:{...data,state:undefined,module:undefined,render:undefined,canvas:undefined,id:node.id,width:node.width??164,height:node.height??116,position:node.position},value:data.value,color:data.visuals?.foreground??'',background:data.visuals?.background??'transparent'});
  }
  if(node.data.canvas)visit(node.data.canvas,[...path,node.id]);
 });};visit(project,[]);if(!blocks.length)return;
 const [ui,math,worker,runtime]=await Promise.all([import('../generated/block-ui.js?raw'),project.modules?.some(module=>module.builtin)?import('../generated/block-math.js?raw'):Promise.resolve({default:''}),import('../../public/project-runtime.js?raw'),import('../generated/export-runtime.js?raw')]);
 const plan=compileProject(project);for(const node of plan.nodes)if(node.data.kind==='javascript')node.data.nativeRecipe=false;
 return {config:{blocks,plan,uiSource:ui.default,mathSource:math.default,workerSource:worker.default,controlledPaths},runtime:runtime.default};
}

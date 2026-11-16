import { buildBlockModule } from '../block-code';
import { usesBlockFunctions } from '../block-functions';
import { parseDiagram, serializeDiagram, type Canvas, type Diagram } from '../model';
import { captureModuleSources } from '../project/module-sources';
import type { ProjectModule } from '../project/schema';
export async function exportProjectJson(project: Diagram, fetcher: typeof fetch = fetch): Promise<string> {
  const sources: {source?:string;url?:string}[]=[];
  const libraries=(modules:ProjectModule[])=>modules.forEach(module=>{if(!module.builtin)sources.push(module);sources.push(...(module.dependencies??[]));});
  const block=(data: Diagram['nodes'][number]['data'])=>{
    sources.push(...(data.dependencies??[]));
    if(data.module) {
      // JSX is compiled for import discovery; the original editable code is untouched.
      sources.push({source:usesBlockFunctions(data)?buildBlockModule(data.module,data.render!,false):data.kind==='compute'?data.module:undefined});
    }
    if(data.render && usesBlockFunctions(data))sources.push({source:buildBlockModule('function run() {}',data.render)});
    if(data.canvas)visit(data.canvas);
  };
  const visit=(canvas:Canvas)=>canvas.nodes.forEach(node=>block(node.data));
  libraries(project.modules??[]);visit(project);
  for(const saved of project.myBlocks??[]){libraries(saved.modules??[]);block(saved.data);}
  let moduleSources;
  try { moduleSources={...project.moduleSources,...await captureModuleSources(sources,project.moduleSources,fetcher)}; }
  catch(error){throw new Error(`JSON backup failed: ${error instanceof Error?error.message:String(error)}`);}
  const json=serializeDiagram({...project,...(Object.keys(moduleSources).length?{moduleSources}:{})});
  parseDiagram(json);
  return json;
}

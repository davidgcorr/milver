import { expect, it } from 'vitest';
import { defaultTheme, exampleDiagram, makeNode, parseDiagram, serializeDiagram } from './model';
import { makeJsNode } from './js-recipes';
import { createExport } from './export/download';
import { defaultExportOptions } from './export/scene';
import { storeProject, renameProject } from './project-store';
import { compileProject, definitionKey } from './project/graph';
import { ModuleLoader } from './project/loader';

function completeProject() {
  const diagram=exampleDiagram();
  diagram.metadata={author:'Backup test',createdAt:'2026-11-16',updatedAt:'2026-11-16'};
  diagram.theme={...defaultTheme,rough:true,roughness:2,canvasBackground:'aurora',showGrid:false};
  diagram.modules=[{id:'helper',alias:'helper',filename:'helper.js',source:"// Exact source, including whitespace\nexport const answer = 41;\n",dependencies:[{specifier:'inline',source:'export const extra=1;'}],draft:{alias:'unfinished alias',content:'export const unfinished =',remote:false}}, {id:'remote',alias:'remote',url:'https://example.com/library.js',dependencies:[{specifier:'remote-helper',url:'https://example.com/helper.js'}]}];
  diagram.moduleSources=Object.fromEntries(['https://example.com/library.js','https://example.com/helper.js'].map(url=>[url,{source:'export const remoteValue=7;',resolvedSource:'export const remoteValue=7;',baseUrl:url}]));
  const shared=makeNode('module',{x:0,y:0},'shared');shared.data.projectModuleId='helper';
  const code=makeNode('compute',{x:200,y:0},'code');
  code.data.module="\nimport { answer } from './helper.js';\nexport async function run() { return { result: answer + 1 }; }\n";
  code.data.codeDraft='export async function run() { /* unfinished';
  code.data.state={counter:3,nested:{items:[1,null,'data',Infinity,-Infinity]}};
  const js=makeJsNode('WebAssembly',{x:400,y:0},'js');
  js.data.module='\nasync function run() { emit(state.count); }\n';js.data.render='\nfunction render() { return <div>Saved</div>; }\n';
  js.data.codeDraft='async function run() { emit(99); }';js.data.renderDraft='function render() { return <div>Draft</div>; }';
  js.data.dependencies=[{specifier:'local',source:'export default 123;'}];
  js.data.renderEnabled=false;js.data.controlledProperties=['label','visuals.background'];
  js.data.visuals={background:'#112233',foreground:'#ffffff',showHeader:false,showPortLabels:false,showValue:true,showLabel:true,shadow:8,shadowColor:'#445566',strokeWidth:3,strokeColor:'#778899',opacity:0.7,radius:14};
  js.data.propertyFields={size:{type:'number',label:'Size',default:24,min:10,max:50,step:2}};js.data.parameters={size:30};
  js.data.renderer={precision:5,slice:2,fontSize:30};
  const parent=makeNode('subsystem',{x:0,y:400},'parent');parent.data.canvas!.nodes.push(code,shared,js);parent.data.canvas!.nodes[0].width=44;parent.data.canvas!.nodes[0].height=36;
  diagram.nodes.push(parent);
  diagram.edges[0].data={mask:'spiral',route:'bezier',points:[{x:200,y:100}],color:'#123456',width:3,animation:'glow',speed:4,animationSize:12,reverse:true};
  diagram.myBlocks=[{id:'saved-js',name:'Saved JS',width:js.width!,height:js.height!,data:structuredClone(js.data),modules:structuredClone(diagram.modules)}];
  return diagram;
}
it('backs up and restores all project data, exact JS source, dependencies, binaries and unapplied drafts',async()=>{
  const original=completeProject();
  // JSON always exports the whole document, even when opened inside a nested canvas.
  const exported=await createExport(original,['parent'],'json',{...defaultExportOptions,scope:'current'});
  const json=await exported.blob.text(),restored=parseDiagram(json);
  expect(restored).toEqual(original);
  expect(parseDiagram(serializeDiagram(restored))).toEqual(restored);
  expect(parseDiagram(renameProject(storeProject(restored),'Renamed').json)).toEqual({...original,name:'Renamed'});
  const compute=restored.nodes.at(-1)!.data.canvas!.nodes.find(n=>n.id==='code')!;
  const loader=new ModuleLoader(restored.modules!,{createURL:source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`});
  const module=await loader.code(compute.data.module!);
  expect(await (module.run as Function)()).toEqual({result:42});loader.dispose();
});
it('keeps draft library and block edits out of execution identity',()=>{
  const project=completeProject(),before=definitionKey(compileProject(project));
  project.modules![0].draft={alias:'different',content:'not valid JS',remote:true};
  project.nodes.at(-1)!.data.canvas!.nodes.find(n=>n.id==='code')!.data.codeDraft='another unfinished edit';
  expect(definitionKey(compileProject(project))).toBe(before);
});
it('validates drafts instead of silently losing malformed draft data',()=>{
  const project=completeProject();(project.modules![0].draft as any).content=42;
  expect(()=>parseDiagram(serializeDiagram(project))).toThrow('library draft');
  const other=completeProject();(other.nodes[0].data as any).codeDraft={code:'bad'};
  expect(()=>parseDiagram(serializeDiagram(other))).toThrow('code draft');
});

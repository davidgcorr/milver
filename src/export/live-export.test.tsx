// @vitest-environment jsdom
import {act} from 'react';
import {expect,it,vi} from 'vitest';
import {Script} from 'node:vm';
import {JSDOM} from 'jsdom';
import * as ui from '../sandbox-ui';
import {makeJsNode} from '../js-recipes';
import {parseSignal} from '../signal-json';
import {exportHtml} from './html';
import {defaultExportOptions} from './scene';
import {liveConfig} from './live-config';
import {mountExport} from './live-runtime';
import {sandbox} from '../test-utils/module-sandbox';
import {compileProject} from '../project/graph';
import {ProjectEngine} from '../project/engine';
import type {Diagram} from '../model';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
function project():Diagram{
 const a=makeJsNode('DOM',{x:0,y:0},'source'),b=makeJsNode('DOM',{x:300,y:0},'sink');
 a.data.module=`async function run({state,emit}) { state.result = 7; emit(state.result); }`;
 a.data.render=`function render({state}) { return <strong>Actual visual {state.result}</strong>; }`;
 b.data.module=`async function run({state,inputs,emit,modules}) { state.result = modules.helper.double(inputs.input1 ?? 0); emit(state.result); }`;
 b.data.render=`function render({state}) { return <Button>{state.result}</Button>; }`;
 return {version:1,name:'Live HTML',nodes:[a,b],edges:[{id:'wire',source:'source',sourceHandle:'out-0',target:'sink',targetHandle:'in-0'}],viewport:{x:0,y:0,zoom:1},modules:[{id:'helper',alias:'helper',source:'export const double = n => n*2;'}]};
}
it('exports actual sandboxed render frames and safely packages JSX, state, libraries and runtimes once',async()=>{
 const diagram=project();diagram.nodes[0].data.value='</script><script>injected()</script>';diagram.nodes[0].data.state={infinite:Infinity};
 const html=await exportHtml(diagram,[],defaultExportOptions),dom=new JSDOM(html),doc=dom.window.document;
 expect(doc.querySelectorAll('.sheet>iframe[sandbox="allow-scripts"]')).toHaveLength(2);expect(doc.querySelector('foreignObject')).toBeNull();
 expect(doc.querySelector('main')!.textContent).not.toContain('DOM');
 expect(doc.querySelector('main')!.textContent).not.toContain('JS module');
 const config=parseSignal(doc.getElementById('export-runtime')!.textContent!);
 expect(config.blocks[0].value).toBe(diagram.nodes[0].data.value);expect(config.blocks[0].options.state.infinite).toBe(Infinity);
 expect(config.blocks[0].source).toContain('Actual visual');expect(config.blocks[1].options.dependencies[0]).toMatchObject({specifier:'helper'});
 expect(config.uiSource.length).toBeGreaterThan(100000);expect(config.workerSource.length).toBeGreaterThan(10000);
 expect(doc.querySelectorAll('script')).toHaveLength(4);expect(html.includes('<script>injected()')).toBe(false);
 for(const script of doc.querySelectorAll('script:not([type="application/json"])'))expect(()=>new Script(script.textContent!)).not.toThrow();
 dom.window.close();
});
it('mounts the exact exported functions with React and passes emitted values through imported JS logic to the next renderer',async()=>{
 const diagram=project(),pages=[{index:0,path:[],canvas:diagram,parent:null,title:diagram.name}],live=(await liveConfig(diagram,pages))!;
 const elements=[document.createElement('div'),document.createElement('div')];elements.forEach(element=>document.body.append(element));
 const runs:Awaited<ReturnType<typeof sandbox>>[]=[];
 try{
 for(const[index,block]of live.config.blocks.entries())await act(async()=>{const run=await sandbox(block.source,block.options.dependencies,block.options.state,{element:elements[index],ui,ports:diagram.nodes[index].data.ports});runs.push(run);await run.send(block.value,{},block.block);});
 expect(elements[0].textContent).toBe('Actual visual 7');
 const value=runs[0].messages.find(message=>message.type==='mask-output').value;
 await act(async()=>runs[1].send('',{'in-0':value},live.config.blocks[1].block));
 expect(elements[1].querySelector('button')!.textContent).toBe('14');
 expect(runs.flatMap(run=>run.messages).filter(message=>message.type==='mask-error')).toEqual([]);
 }finally{for(const run of runs)await act(async()=>run.dispose());elements.forEach(element=>element.remove());}
});
it('routes authenticated renderer/worker messages, propagates inputs, updates source values and cleans up exported runtimes',async()=>{
 const diagram=project(),pages=[{index:0,path:[],canvas:diagram,parent:null,title:diagram.name}],live=(await liveConfig(diagram,pages))!;
 const host=document.createElement('div');host.innerHTML='<iframe data-export-key="0-0"></iframe><iframe data-export-key="0-1"></iframe>';document.body.append(host);
 const dispose=mountExport(live.config),frames=[...host.querySelectorAll('iframe')],runtime=document.querySelector<HTMLIFrameElement>('iframe[title="Export project computation"]')!;
 const calls=vi.spyOn(runtime.contentWindow!,'postMessage'),toSink=vi.spyOn(frames[1].contentWindow!,'postMessage');
 const token=JSON.parse(runtime.srcdoc.match(/const token=("[^"]+")/)![1]);
 const frameToken=(index:number)=>JSON.parse(frames[index].srcdoc.match(/config=([^\n]+);\n/)![1]).token;
 const message=(source:Window|null,data:any)=>window.dispatchEvent(new MessageEvent('message',{source,data}));
 try{
 message(runtime.contentWindow,{type:'ready',token});await Promise.resolve();expect(calls).toHaveBeenCalled();
 message(frames[0].contentWindow,{type:'mask-output',token:'foreign',port:'out-0',value:999});await Promise.resolve();expect(calls).toHaveBeenCalledTimes(1);
 message(frames[0].contentWindow,{type:'mask-ready',token:frameToken(0)});message(frames[1].contentWindow,{type:'mask-ready',token:frameToken(1)});
 message(frames[0].contentWindow,{type:'mask-output',token:frameToken(0),port:'out-0',value:7});
 message(runtime.contentWindow,{type:'result',token,result:{nodes:{[live.config.blocks[1].id]:{inputs:{'in-0':7}}}}});await Promise.resolve();
 expect(toSink).toHaveBeenLastCalledWith(expect.objectContaining({type:'mask-input',inputs:{'in-0':7}}),'*');
 expect(calls.mock.calls.at(-1)![0].external[live.config.blocks[0].id].values['out-0']).toBe(7);
 message(frames[0].contentWindow,{type:'mask-state',token:frameToken(0),state:{result:9}});expect(live.config.blocks[0].block.state).toBeUndefined();
 message(frames[0].contentWindow,{type:'mask-value',token:frameToken(0),value:'9'});expect(live.config.plan.nodes[0].data.value).toBe('9');
 }finally{dispose();host.remove();vi.restoreAllMocks();}expect(document.querySelector('iframe[title="Export project computation"]')).toBeNull();
});
it('uses the project engine to preserve nested/external routing while renderer frames own JavaScript execution',async()=>{
 const diagram=project(),plan=compileProject(diagram);plan.nodes.forEach(node=>node.data.nativeRecipe=false);
 const engine=new ProjectEngine({},[]);
 try{const results=await engine.execute(plan,{[plan.nodes[0].id]:{values:{'out-0':7}},[plan.nodes[1].id]:{values:{'out-0':14}}});expect(results.nodes[plan.nodes[1].id].inputs).toEqual({'in-0':7});}finally{await engine.dispose();}
});
it('renders exported matrices and operators with bundled math and the saved JSX render functions',async()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
 const {mathLibrary}=await import('../default-libraries');const diagram=project();diagram.modules=[mathLibrary];diagram.nodes=[makeJsNode('Matrix',{x:0,y:0},'matrix'),makeJsNode('Transpose',{x:300,y:0},'transpose')];diagram.edges=[{id:'wire',source:'matrix',sourceHandle:'out-0',target:'transpose',targetHandle:'in-0'}];diagram.nodes[0].data.value='[[1,2],[3,4]]';
 const config=(await liveConfig(diagram,[{index:0,path:[],canvas:diagram,parent:null,title:diagram.name}]))!.config;
 const elements=[document.createElement('div'),document.createElement('div')];elements.forEach(element=>document.body.append(element));const runs:Awaited<ReturnType<typeof sandbox>>[]=[];
 try{
 for(const[index,block]of config.blocks.entries()){
  const deps=block.options.dependencies!.map(dependency=>dependency.source==='__MILVER_BUILTIN_MATH__'?{...dependency,source:config.mathSource}:dependency);
  await act(async()=>{const run=await sandbox(block.source,deps,block.options.state,{element:elements[index],ui,ports:diagram.nodes[index].data.ports});runs.push(run);if(index===0)await run.send(block.value,{},block.block);});
 }
 const matrix=runs[0].messages.find(message=>message.type==='mask-output').value;expect(matrix).toEqual([[1,2],[3,4]]);
 await act(async()=>runs[1].send(config.blocks[1].value,{'in-0':matrix},config.blocks[1].block));
 expect(runs[1].messages.filter(message=>message.type==='mask-output').at(-1).value).toEqual([[1,3],[2,4]]);
 expect(elements[0].querySelector('math')).not.toBeNull();expect(elements[1].querySelector('math')).not.toBeNull();
 expect(runs.flatMap(run=>run.messages).filter(message=>message.type==='mask-error')).toEqual([]);
 }finally{for(const run of runs)await act(async()=>run.dispose());elements.forEach(element=>element.remove());vi.unstubAllGlobals();}
});

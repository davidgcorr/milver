// @vitest-environment jsdom
import { act } from 'react';
import { beforeAll,expect,it,vi } from 'vitest';
import * as ui from './sandbox-ui';
import { sandbox } from './test-utils/module-sandbox';
import { buildBlockModule } from './block-code';
import { makeJsNode } from './js-recipes';
import { demoLibrary } from './interactive-recipes';
import { parseDiagram,serializeDiagram } from './model';
import projectJson from '../examples/interactive-blocks.json?raw';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
beforeAll(()=>vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}}));
const outputs=(run:Awaited<ReturnType<typeof sandbox>>)=>run.messages.filter(message=>message.type==='mask-output').map(message=>message.value);
async function mount(recipe:string,inputs:Record<string,unknown>={}) {
  const node=makeJsNode(recipe,{x:0,y:0}),element=document.createElement('div');document.body.append(element);let run!:Awaited<ReturnType<typeof sandbox>>;
  await act(async()=>{run=await sandbox(buildBlockModule(node.data.module!,node.data.render!),recipe==='LibraryBadge'?[{specifier:demoLibrary.alias,source:demoLibrary.source}]:[],{}, {element,ui,ports:node.data.ports});});
  const block={...node.data,state:undefined,module:undefined,render:undefined,id:node.id,width:260,height:200};
  const send=(next:Record<string,unknown>,properties=block)=>act(async()=>run.send(node.data.value,next,properties));
  await send(inputs);
  return {node,element,run,block,send,dispose:async()=>{await act(async()=>run.dispose());element.remove();}};
}
it('mounts a genuine React component, keeps hook state, and reads new inputs and live block properties',async()=>{
  const view=await mount('MetricCard',{'in-0':42,'in-1':'#ec4899'});
  try {
    expect(view.element.textContent).toContain('42');
    await act(async()=>view.element.querySelector<HTMLElement>('[style*="border-radius"]')!.click());
    expect(view.element.textContent).toContain('260 × 200');
    await view.send({'in-0':75,'in-1':'#10b981'},{...view.block,width:320,label:'Live metric'});
    expect(view.element.textContent).toContain('75');expect(view.element.textContent).toContain('320 × 200');expect(view.element.textContent).toContain('Live metric');
    expect(outputs(view.run)).toEqual([42,75]);expect(view.run.messages.filter(message=>message.type==='mask-error')).toEqual([]);
  }finally{await view.dispose();}
});
it('runs actions in code, saves state and rerenders after a React event without rerunning logic',async()=>{
  const view=await mount('ActionButton',{'in-0':true,'in-1':{answer:42}});
  try {
    await act(async()=>view.element.querySelector<HTMLButtonElement>('button')!.click());
    expect(outputs(view.run).at(-1)).toEqual({clicks:1,payload:{answer:42}});
    expect(view.element.textContent).toContain('1');
    expect(view.run.messages.some(message=>message.type==='mask-state'&&message.state.clicks===1)).toBe(true);
    await view.send({'in-0':false,'in-1':'changed'});
    expect(view.element.querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
    expect(view.element.textContent).toContain('Disabled by input');
    const count=outputs(view.run).length;await act(async()=>view.element.querySelector<HTMLButtonElement>('button')!.click());expect(outputs(view.run)).toHaveLength(count);
  }finally{await view.dispose();}
});
it('makes imported modules available to both code and JSX rendering and controls block properties from inputs',async()=>{
  const library=await mount('LibraryBadge',{'in-0':1234.5}),appearance=await mount('InputAppearance',{'in-0':'My input','in-1':'#e0f2fe','in-2':300});
  try {
    expect(library.element.textContent).toContain('1,234.5');expect(outputs(library.run)).toEqual([1234.5]);
    for(const [path,value] of [['label','My input'],['visuals.background','#e0f2fe'],['width',300]])expect(appearance.run.messages).toContainEqual(expect.objectContaining({type:'mask-property',path,value}));
    await appearance.send({'in-0':'My input','in-1':'#e0f2fe','in-2':300},{...appearance.block,label:'My input',width:300});
    expect(appearance.element.textContent).toContain('My input');expect(appearance.element.textContent).toContain('300px');
  }finally{await library.dispose();await appearance.dispose();}
});
it('updates from timer-driven state and clears the timer on input changes and unmount',async()=>{
  const view=await mount('Pulse',{'in-0':true,'in-1':80});
  try {
    const before=view.element.innerHTML;
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,90));});
    expect(view.element.innerHTML).not.toBe(before);expect(outputs(view.run).at(-1)).toBe(1);
    await view.send({'in-0':false,'in-1':80});
    const count=outputs(view.run).length;await act(async()=>{await new Promise(resolve=>setTimeout(resolve,100));});expect(outputs(view.run)).toHaveLength(count);
  }finally{await view.dispose();}
});
it('round trips component functions, example libraries and input wiring without a second definition',()=>{
  const project=parseDiagram(projectJson);expect(parseDiagram(serializeDiagram(project))).toEqual(project);
  expect(project.modules?.some(module=>module.alias==='demo')).toBe(true);
  for(const name of ['MetricCard','ProgressRing','ActionButton','InputAppearance','Pulse','Toggle','LibraryBadge']) {
    const node=makeJsNode(name,{x:0,y:0});expect(node.data.render).toMatch(/^function render\(/);expect(node.data.render).toContain('return <');
  }
});
it('supports setState updaters and React effects with cleanup, without rerunning code for local UI edits',async()=>{
  const element=document.createElement('div');document.body.append(element);
  const logic=`async function run({inputs,state,modules,emit}) { state.result = await modules.helper.double(inputs.input1); state.clicks ??= 0; emit(state.result); }`;
  const render=`function render({inputs,state,setState,block}) {
    useEffect(() => { setProperty('description','effect '+inputs.input1); return () => setProperty('description','cleanup '+inputs.input1); }, [inputs.input1]);
    return <Button onClick={() => setState(current => ({clicks:current.clicks+1}))}>{block.label}: {state.result} / {state.clicks}</Button>;
  }`;
  const ports=makeJsNode('DOM',{x:0,y:0}).data.ports;let run!:Awaited<ReturnType<typeof sandbox>>;
  try{
    await act(async()=>{run=await sandbox(buildBlockModule(logic,render),[{specifier:'helper',source:'export async function double(x){return x*2;}'}],{}, {element,ui,ports});await run.send('',{'in-0':3},{label:'Scope'});});
    expect(element.textContent).toContain('Scope: 6 / 0');
    await act(async()=>element.querySelector<HTMLButtonElement>('button')!.click());
    expect(element.textContent).toContain('6 / 1');expect(outputs(run)).toEqual([6]);
    await act(async()=>run.send('',{'in-0':5},{label:'Updated'}));
    expect(element.textContent).toContain('Updated: 10 / 1');expect(outputs(run)).toEqual([6,10]);
    expect(run.messages).toContainEqual(expect.objectContaining({type:'mask-property',path:'description',value:'cleanup 3'}));
    await act(async()=>run.dispose());
    expect(run.messages).toContainEqual(expect.objectContaining({type:'mask-property',value:'cleanup 5'}));
  }finally{element.remove();}
});
it('contains a component error and mounts a working component on the next input',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{}),element=document.createElement('div');document.body.append(element);let run!:Awaited<ReturnType<typeof sandbox>>;
  try{
    const ports=makeJsNode('DOM',{x:0,y:0}).data.ports;
    await act(async()=>{run=await sandbox(buildBlockModule('state.result=inputs.input1;','function render({state}) { if(state.result < 0)throw new Error("Bad visual input");return <strong>{state.result}</strong>; }'),[],{}, {element,ui,ports});await run.send('',{'in-0':-1});});
    await act(async()=>{await new Promise(resolve=>setTimeout(resolve,0));});
    expect(run.messages.some(message=>message.type==='mask-error'&&message.error==='Bad visual input')).toBe(true);
    await act(async()=>run.send('',{'in-0':42}));
    expect(element.querySelector('strong')?.textContent).toBe('42');
  }finally{if(run)await act(async()=>run.dispose());element.remove();log.mockRestore();}
});
it('shares the bundled React instance through imported library namespaces',async()=>{
  const element=document.createElement('div');document.body.append(element);let run!:Awaited<ReturnType<typeof sandbox>>;
  try {
    await act(async()=>{run=await sandbox(buildBlockModule('state.same = modules.react.default === React;emit(state.same);',`function render({state,modules}) {
      const [count,setCount] = modules.react.useState(0);
      return <Button onClick={() => setCount(count+1)}>{String(state.same)} / {count}</Button>;
    }`),[],{}, {element,ui});await run.send('');});
    expect(outputs(run)).toEqual([true]);
    await act(async()=>element.querySelector<HTMLButtonElement>('button')!.click());expect(element.textContent).toContain('true / 1');
  }finally{if(run)await act(async()=>run.dispose());element.remove();}
});
it('renders the final async code result even after an explicit intermediate render',async()=>{
  const element=document.createElement('div');document.body.append(element);let run!:Awaited<ReturnType<typeof sandbox>>;
  try{
    await act(async()=>{run=await sandbox(buildBlockModule(`async function run(){state.result='loading';await render();await Promise.resolve();state.result='ready';emit(state.result);}`,`function render({state}){return <strong>{state.result}</strong>;}`),[],{}, {element,ui});await run.send('');});
    expect(element.textContent).toBe('ready');expect(outputs(run)).toEqual(['ready']);
  }finally{if(run)await act(async()=>run.dispose());element.remove();}
});

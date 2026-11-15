// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {readFile,readdir} from 'node:fs/promises';
import {makeNode,parseDiagram,serializeDiagram,type Canvas} from './model';
import {makeJsNode,jsRecipes} from './js-recipes';
import {normalizeFunctions} from './block-functions';
import {buildBlockModule} from './block-code';
import {sandbox} from './test-utils/module-sandbox';
import * as ui from './sandbox-ui';
import {RenderProperties} from './components/render-properties';
import {TooltipProvider} from './components/ui/tooltip';
import {liveConfig} from './export/live-config';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('keeps every palette recipe and every saved example on the common full-function schema',async()=>{
 for(const[name,recipe]of Object.entries(jsRecipes)){
  expect(recipe.source,name).toMatch(/^(?:async )?function run\(/);expect(recipe.render,name).toMatch(/^(?:async )?function render\(/);
  expect(recipe.source,name).not.toMatch(/element\.|innerHTML|document\.createElement|export default/);
  expect(makeJsNode(name,{x:0,y:0}).data.module).toBe(recipe.source);
 }
 const walk=(canvas:Canvas)=>{for(const node of canvas.nodes){expect(node.data.module,node.data.label).toMatch(/^(?:\/\/[^\n]*\n)*(?:async )?function run\(/);expect(node.data.render,node.data.label).toMatch(/^(?:async )?function render\(/);expect(node.data.module,node.data.label).not.toMatch(/innerHTML|element\.|export default/);if(node.data.canvas)walk(node.data.canvas);}};
 for(const filename of await readdir('examples'))if(filename.endsWith('.json')){
  const raw=await readFile('examples/'+filename,'utf8'),project=parseDiagram(raw);walk(project);expect(parseDiagram(serializeDiagram(project))).toEqual(project);
  // The shipped file itself is canonical, not just its in-memory migration.
  walk(JSON.parse(raw));
 }
});
it('preserves custom legacy behavior while moving DOM work into a full Render function',async()=>{
 const node=makeNode('javascript',{x:0,y:0});node.data.module=`export default function mount({element,value,emit}){element.innerHTML='<strong>Custom '+value+'</strong>';emit(Number(value)*3);}`;delete node.data.render;
 const data=normalizeFunctions(node.data);expect(data.module).not.toContain('innerHTML');expect(data.render).toContain('innerHTML');expect(data.module).toMatch(/^async function run/);expect(data.render).toMatch(/^async function render/);
 const element=document.createElement('div');document.body.append(element);const run=await sandbox(buildBlockModule(data.module!,data.render!),[],{},{element,ui,ports:data.ports});
 try{await run.send('4',{});expect(element.textContent).toBe('Custom 4');expect(run.messages).toContainEqual(expect.objectContaining({type:'mask-output',value:12}));await run.send('5',{});expect(element.querySelectorAll('strong')).toHaveLength(1);expect(element.textContent).toBe('Custom 5');}finally{await act(async()=>run.dispose());element.remove();}
});
it('greys out unused and disabled render functions while preserving their source and keeping Code active',async()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);let node=makeNode('subsystem',{x:0,y:0});
 const view=()=>createElement(TooltipProvider,null,createElement(RenderProperties,{node,update:patch=>node={...node,data:{...node.data,...patch}},resize(){}}));
 try{
 await act(async()=>root.render(view()));expect(host.querySelector('[aria-disabled="true"]')).not.toBeNull();expect(host.textContent).toContain('managed by the project runtime');
 node=makeJsNode('Button',{x:0,y:0});node.data.renderEnabled=false;const original=node.data.render;
 await act(async()=>root.render(view()));expect(host.querySelector('.function-disabled')).not.toBeNull();expect(host.textContent).toContain('Code and outputs continue');
 await act(async()=>host.querySelector<HTMLInputElement>('[aria-label="Enable render function"]')!.click());expect(node.data.renderEnabled).toBe(true);expect(node.data.render).toBe(original);
 const element=document.createElement('div');document.body.append(element);const run=await sandbox(buildBlockModule(node.data.module!,node.data.render!,false),[],{},{element,ui,ports:node.data.ports});
 try{await run.send(node.data.value,{});expect(element.textContent).toBe('');expect(run.messages).toContainEqual(expect.objectContaining({type:'mask-output',value:0}));}finally{await act(async()=>run.dispose());element.remove();}
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
it('keeps exported sliders tunable across repeated edits without waiting for parent acknowledgements',async()=>{
 vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
 const node=makeJsNode('Slider',{x:0,y:0}),project={version:1 as const,name:'Slider',nodes:[node],edges:[],viewport:{x:0,y:0,zoom:1}};
 const config=(await liveConfig(project,[{index:0,path:[],title:'Slider',parent:null,canvas:project}]))!.config;
 const block=config.blocks[0],element=document.createElement('div');document.body.append(element);let run:Awaited<ReturnType<typeof sandbox>>;
 await act(async()=>{run=await sandbox(block.source,[],{},{element,ui,ports:node.data.ports});});
 try{
 await run!.send(node.data.value,{},block.block);const slider=element.querySelector('[role="slider"]')!;
 for(const expected of [51,52,53]){await act(async()=>slider.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));expect(slider.getAttribute('aria-valuenow')).toBe(String(expected));expect(run!.messages.filter(message=>message.type==='mask-output').at(-1).value).toBe(expected);}
 const track=element.querySelector<HTMLElement>('[data-slot="slider"]')!;
 track.getBoundingClientRect=()=>({left:0,right:100,top:0,bottom:20,width:100,height:20,x:0,y:0,toJSON(){}});
 let captured=false;track.setPointerCapture=()=>{captured=true;};track.hasPointerCapture=()=>captured;track.releasePointerCapture=()=>{captured=false;};
 const pointer=async(type:string,x:number)=>act(async()=>{const event=new MouseEvent(type,{bubbles:true,clientX:x,button:0});Object.defineProperty(event,'pointerId',{value:1});track.dispatchEvent(event);});
 await pointer('pointerdown',70);await pointer('pointermove',80);await pointer('pointerup',80);
 expect(slider.getAttribute('aria-valuenow')).toBe('80');
 const saved=run!.messages.filter(message=>message.type==='mask-value').at(-1).value;await run!.send(saved,{},block.block);expect(slider.getAttribute('aria-valuenow')).toBe('80');expect(element.querySelector('[role="slider"]')).toBe(slider);
 }finally{await act(async()=>run!.dispose());element.remove();vi.unstubAllGlobals();}
});
it('provides the two-slope matrix example with UI in JSX and output logic in Code',async()=>{
 const node=makeJsNode('MatrixActivation',{x:0,y:0}),element=document.createElement('div');document.body.append(element);const run=await sandbox(buildBlockModule(node.data.module!,node.data.render!),[],{},{element,ui,ports:node.data.ports});
 try{await run.send('[[-2,0,3]]',{},node.data);const negative=element.querySelector<HTMLInputElement>('[aria-label="Negative slope α"]')!;expect(negative).not.toBeNull();await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(negative,'0.5');negative.dispatchEvent(new Event('input',{bubbles:true}));});expect(run.messages.filter(message=>message.type==='mask-output').at(-1).value).toEqual([[-1,0,3]]);expect(node.data.module).not.toContain('element');expect(node.data.render).toContain('return <div');}finally{await act(async()=>run.dispose());element.remove();}
});

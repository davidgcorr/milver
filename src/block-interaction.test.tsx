// @vitest-environment jsdom
import { act, createElement, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { ReactFlowProvider } from '@xyflow/react';
import { beforeAll, expect, it, vi } from 'vitest';
import { Block } from './components/block-node';
import { ModuleMask, loadRenderBundle } from './components/module-mask';
import { makeJsNode } from './js-recipes';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
beforeAll(()=>vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}unobserve(){}}));

it('loads the render bundle for freshly inserted blocks and sends inputs to the new iframe',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const node=makeJsNode('Button',{x:0,y:0},'button');
  const props={id:node.id,source:node.data.module,render:node.data.render,ports:node.data.ports,value:node.data.value,color:'#171717',background:'#ffffff'};
  await act(async()=>root.render(createElement(ModuleMask,props)));
  await act(async()=>{await loadRenderBundle();});
  let frame=host.querySelector('iframe')!;
  expect(frame.srcdoc).not.toContain('Loading renderer…');
  expect(frame.srcdoc).toContain('uiSource');
  const first=frame;
  // Simulate dropping another fresh block, without reloading the page.
  await act(async()=>root.render(createElement(ModuleMask,{...props,key:'new',id:'new-button'})));
  await act(async()=>{await loadRenderBundle();});
  frame=host.querySelector('iframe')!;
  expect(frame).not.toBe(first);
  expect(frame.srcdoc).not.toContain('Loading renderer…');
  const config=JSON.parse(frame.srcdoc.split('config=')[1].split(';\nconst validSignal')[0]);
  const send=vi.spyOn(frame.contentWindow!,'postMessage');
  await act(async()=>window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,data:{type:'mask-ready',token:config.token}})));
  expect(send).toHaveBeenCalledWith(expect.objectContaining({type:'mask-input',value:node.data.value}), '*');
  await act(async()=>root.unmount());host.remove();
});

it('enables block controls only on double click and disables them on outside click',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const node=makeJsNode('DOM',{x:0,y:0},'editable');
  await act(async()=>root.render(createElement(ReactFlowProvider,null,createElement(Block,{id:node.id,data:node.data,selected:true,type:'block',dragging:false,zIndex:0,isConnectable:true,positionAbsoluteX:0,positionAbsoluteY:0,selectable:true,deletable:true,draggable:true} as any))));
  const card=host.querySelector('.diagram-block')!;
  expect(host.querySelector('.mask-interaction-toggle')).toBeNull();
  await act(async()=>card.dispatchEvent(new MouseEvent('click',{bubbles:true})));
  expect(host.querySelector('.module-mask')?.classList.contains('mask-interactive')).toBe(false);
  await act(async()=>card.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
  expect(host.querySelector('.module-mask')?.classList.contains('mask-interactive')).toBe(true);
  await act(async()=>document.body.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})));
  expect(host.querySelector('.module-mask')?.classList.contains('mask-interactive')).toBe(false);
  await act(async()=>root.unmount());host.remove();
});

it('keeps a math block iframe mounted through saved-state and value updates',async()=>{
  const { ProjectContext }=await import('./project/context');
  const { mathLibrary }=await import('./default-libraries');
  const { loadMathBundle }=await import('./components/module-mask');
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const node=makeJsNode('Matrix',{x:0,y:0},'matrix');
  const props={id:node.id,source:node.data.module,render:node.data.render,ports:node.data.ports,value:node.data.value,color:'#171717',background:'#ffffff'};
  function View(extra: Record<string,unknown>) {
    const context=useContext(ProjectContext);
    return createElement(ProjectContext.Provider,{value:{...context,modules:[mathLibrary]}},createElement(ModuleMask,{...props,...extra}));
  }
  const view=(extra:Record<string,unknown>={})=>createElement(View,extra);
  try {
    await act(async()=>root.render(view()));
    await act(async()=>{await Promise.all([loadRenderBundle(),loadMathBundle()]);});
    const frame=host.querySelector('iframe')!;
    expect(frame.srcdoc).not.toContain('Loading renderer…');
    const config=JSON.parse(frame.srcdoc.split('config=')[1].split(';\nconst validSignal')[0]);
    expect(config.dependencies[0].source.length).toBeGreaterThan(100000);
    await act(async()=>root.render(view({state:{result:[[2,3],[4,5]]},value:'[[2,3],[4,5]]'})));
    expect(host.querySelector('iframe')).toBe(frame);
  } finally {await act(async()=>root.unmount());host.remove();}
});

it('edits all text datatypes on double click, commits once on exit, and preserves the renderer iframe',async()=>{
  const {PreviewContext}=await import('./components/module-mask');
  for(const recipe of ['String','Boolean','Number','Vector','Matrix','Tensor']){
    const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
    const node=makeJsNode(recipe,{x:0,y:0},recipe),setValue=vi.fn();
    function View(){const preview=useContext(PreviewContext);return createElement(PreviewContext.Provider,{value:{...preview,setValue}},createElement(ReactFlowProvider,null,createElement(Block,{id:node.id,data:node.data,selected:true,type:'block',dragging:false,zIndex:0,isConnectable:true,positionAbsoluteX:0,positionAbsoluteY:0,selectable:true,deletable:true,draggable:true} as any)));}
    try{
      await act(async()=>root.render(createElement(View)));
      const frame=host.querySelector('iframe');
      await act(async()=>host.querySelector('.diagram-block')!.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
      const field=host.querySelector('textarea')!;
      expect(field.value).toBe(node.data.value);expect(document.activeElement).toBe(field);
      const next=({String:'Edited text',Boolean:'false',Number:'9',Vector:'[9]',Matrix:'[[9]]',Tensor:'[[[9]]]'} as Record<string,string>)[recipe];
      await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value')!.set!.call(field,next);field.dispatchEvent(new Event('input',{bubbles:true}));});
      expect(setValue).not.toHaveBeenCalled();
      await act(async()=>document.body.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})));
      expect(setValue).toHaveBeenCalledExactlyOnceWith(node.id,next);
      expect(host.querySelector('textarea')).toBeNull();expect(host.querySelector('iframe')).toBe(frame);
      await act(async()=>host.querySelector('.diagram-block')!.dispatchEvent(new MouseEvent('dblclick',{bubbles:true})));
      await act(async()=>host.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
      expect(setValue).toHaveBeenCalledTimes(1);expect(host.querySelector('textarea')).toBeNull();
    }finally{await act(async()=>root.unmount());host.remove();}
  }
});

it('temporarily hides type information in Excalidraw mode and restores original block visibility',async()=>{
  const {RoughContext}=await import('./components/rough-shapes');
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const node=makeJsNode('String',{x:0,y:0},'string');node.data.visuals={showLabel:false};
  const view=(excalidraw:boolean)=>createElement(RoughContext.Provider,{value:{enabled:excalidraw,roughness:1}},createElement(ReactFlowProvider,null,createElement(Block,{id:node.id,data:node.data,selected:false,type:'block',dragging:false,zIndex:0,isConnectable:true,positionAbsoluteX:0,positionAbsoluteY:0,selectable:true,deletable:true,draggable:true} as any)));
  try{
    await act(async()=>root.render(view(true)));
    expect(host.querySelector('.rough-block-outline')).not.toBeNull();
    expect(host.querySelectorAll('.react-flow__handle .rough-port-outline')).toHaveLength(node.data.ports.length);
    expect(host.querySelectorAll('.react-flow__handle')).toHaveLength(node.data.ports.length);
    for(const port of host.querySelectorAll('.rough-port-outline')){expect(port.querySelector('[fill="#ffffff"]')).not.toBeNull();for(const path of port.querySelectorAll('path'))expect(['none','#ffffff']).toContain(path.getAttribute('fill'));}
    expect(host.querySelector('.block-type-trail,.block-type-expand')).toBeNull();
    expect(host.querySelector('.block-footer')?.textContent).toBe('String');
    await act(async()=>root.render(view(false)));
    expect(host.querySelector('.block-type-trail')).not.toBeNull();expect(host.querySelector('.block-footer')).toBeNull();
    expect(host.querySelector('.rough-port-outline')).toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();}
});

it('updates rough corners from the theme and honors a block radius override',async()=>{
  const {RoughContext}=await import('./components/rough-shapes');
  const node=makeJsNode('String',{x:0,y:0},'corners');
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const view=(radius:number)=>createElement(RoughContext.Provider,{value:{enabled:true,roughness:1,radius}},createElement(ReactFlowProvider,null,createElement(Block,{id:node.id,data:node.data,selected:false,type:'block',dragging:false,zIndex:0,isConnectable:true,positionAbsoluteX:0,positionAbsoluteY:0,selectable:true,deletable:true,draggable:true} as any)));
  const path=()=>host.querySelector('.rough-block-outline path')!.getAttribute('d');
  try{
    await act(async()=>root.render(view(0)));const square=path();
    await act(async()=>root.render(view(28)));expect(path()).not.toBe(square);
    node.data.visuals={radius:0};
    await act(async()=>root.render(view(28)));expect(path()).toBe(square);
    node.data.visuals={radius:40};
    await act(async()=>root.render(view(0)));expect(path()).not.toBe(square);
  }finally{await act(async()=>root.unmount());host.remove();}
});

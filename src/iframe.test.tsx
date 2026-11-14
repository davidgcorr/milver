// @vitest-environment jsdom
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {expect,it,vi} from 'vitest';
import * as ui from './sandbox-ui';
import {sandbox} from './test-utils/module-sandbox';
import {buildBlockModule} from './block-code';
import {makeJsNode} from './js-recipes';
import {parseDiagram,serializeDiagram} from './model';
import projectJson from '../examples/iframe-inputs.json?raw';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('updates iframe inputs without navigation, resends on ready/load and accepts replies only from its own frame',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),reply=vi.fn();
  const view=(value:number)=>createElement(ui.Iframe,{html:'<div>test</div>',title:'Test embed',data:{input1:value},onMessage:reply});
  try{
    await act(async()=>root.render(view(2)));
    const frame=host.querySelector('iframe')!,send=vi.spyOn(frame.contentWindow!,'postMessage');
    await act(async()=>frame.dispatchEvent(new Event('load')));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({type:'milver-input',inputs:{input1:2}}),'*');
    await act(async()=>root.render(view(Infinity)));
    expect(host.querySelector('iframe')).toBe(frame);expect(frame.srcdoc).toBe('<div>test</div>');
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({inputs:{input1:Infinity}}),'*');
    await act(async()=>window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,data:{type:'milver-ready'}})));
    expect(send).toHaveBeenLastCalledWith(expect.objectContaining({inputs:{input1:Infinity}}),'*');
    await act(async()=>window.dispatchEvent(new MessageEvent('message',{source:window,data:{type:'milver-output',value:99}})));expect(reply).not.toHaveBeenCalled();
    await act(async()=>window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,data:{type:'milver-output',value:{result:4}}})));expect(reply).toHaveBeenCalledWith({result:4});
    expect(frame.sandbox?.toString()??frame.getAttribute('sandbox')).toContain('allow-scripts');
    expect(frame.getAttribute('sandbox')).not.toContain('allow-same-origin');
    await act(async()=>root.unmount());
    await act(async()=>window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,data:{type:'milver-output',value:'stale'}})));expect(reply).toHaveBeenCalledTimes(1);
  }finally{if(host.childNodes.length)await act(async()=>root.unmount());host.remove();}
});
it.each(['IframeMetric','IframeChart'])('passes real block inputs through the %s HTML script and returns its output',async recipe=>{
  const node=makeJsNode(recipe,{x:0,y:0}),config=JSON.parse(node.data.value),host=document.createElement('div');document.body.append(host);
  let run!:Awaited<ReturnType<typeof sandbox>>,page:JSDOM|undefined;
  const parentMessage=vi.spyOn(window,'postMessage');let frame:HTMLIFrameElement;
  try{
    await act(async()=>{run=await sandbox(buildBlockModule(node.data.module!,node.data.render!),[],{}, {element:host,ui,ports:node.data.ports});await run.send(node.data.value,{'in-0':recipe==='IframeMetric'?7:[[2,5,3]],'in-1':'#ec4899'});});
    frame=host.querySelector('iframe')!;
    parentMessage.mockImplementation(message=>queueMicrotask(()=>window.dispatchEvent(new MessageEvent('message',{source:frame.contentWindow,data:JSON.parse(JSON.stringify(message))}))));
    vi.spyOn(frame.contentWindow!,'postMessage').mockImplementation(message=>page!.window.dispatchEvent(new page!.window.MessageEvent('message',{source:window,data:message})));
    page=new JSDOM(config.html,{runScripts:'dangerously',beforeParse(child){Object.defineProperty(child,'parent',{value:window});}});
    await act(async()=>{frame.dispatchEvent(new Event('load'));await new Promise(resolve=>setTimeout(resolve,0));});
    const output=()=>run.messages.filter(message=>message.type==='mask-output').at(-1)?.value;
    expect(output()).toEqual(recipe==='IframeMetric'?{received:7,doubled:14}:{count:3,total:10,maximum:5});
    await act(async()=>run.send(node.data.value,{'in-0':recipe==='IframeMetric'?11:[4,6],'in-1':'#10b981'}));
    expect(output()).toEqual(recipe==='IframeMetric'?{received:11,doubled:22}:{count:2,total:10,maximum:6});
    expect(host.querySelector('iframe')).toBe(frame);
    if(recipe==='IframeMetric'){expect(page.window.document.getElementById('metric')!.textContent).toBe('11');expect(page.window.document.getElementById('card')!.style.color).toBe('rgb(16, 185, 129)');}
    else {expect(page.window.document.getElementById('bars')!.children).toHaveLength(2);expect((page.window.document.getElementById('bars')!.firstElementChild as HTMLElement).style.backgroundColor).toBe('rgb(16, 185, 129)');}
    expect(run.messages.filter(message=>message.type==='mask-error')).toEqual([]);
  }finally{if(run)await act(async()=>run.dispose());page?.window.close();parentMessage.mockRestore();host.remove();}
});
it('round trips iframe pages, editable functions, library-independent examples and wiring',()=>{
  const project=parseDiagram(projectJson);expect(parseDiagram(serializeDiagram(project))).toEqual(project);
  expect(project.nodes.some(node=>node.data.recipe==='IframeMetric')).toBe(true);expect(project.nodes.some(node=>node.data.recipe==='IframeChart')).toBe(true);
  expect(project.edges).toHaveLength(6);
});

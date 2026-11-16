// @vitest-environment jsdom
import { act, createElement, useContext, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { exampleDiagram, makeNode, parseDiagram, serializeDiagram } from './model';
import { CodeProperties } from './components/code-properties';
import { RenderProperties } from './components/render-properties';
import { ProjectModules } from './components/project-modules';
import { ProjectContext } from './project/context';
import { TooltipProvider } from './components/ui/tooltip';
vi.mock('./components/code-editor',()=>({CodeEditor:({value,onChange,label}:any)=>createElement('textarea',{'aria-label':label,value,onInput:(event:any)=>onChange(event.currentTarget.value),onChange:()=>{}})}));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
(globalThis as any).ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};
it('saves code and render drafts across JSON import and applies them only on request',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  let node=makeNode('javascript',{x:0,y:0});const original=node.data.module,originalRender=node.data.render;
  function View(){const[current,setCurrent]=useState(node);const update=(patch:any)=>{node={...node,data:{...node.data,...patch}};setCurrent(node);};return createElement(TooltipProvider,null,createElement(CodeProperties,{node:current,update}),createElement(RenderProperties,{node:current,update,resize(){}}));}
  const input=async(label:string,text:string)=>{const field=host.querySelector<HTMLTextAreaElement>(`[aria-label="${label}"]`)!;field.value=text;await act(async()=>field.dispatchEvent(new Event('input',{bubbles:true})));};
  try{
    await act(async()=>root.render(createElement(View)));
    await input('JavaScript source','async function run() { emit(42); }');
    await input('Render function source','function render() { return <div>Draft</div>; }');
    expect(node.data.module).toBe(original);expect(node.data.render).toBe(originalRender);
    const project=exampleDiagram();project.nodes=[node];project.edges=[];
    node=parseDiagram(serializeDiagram(project)).nodes[0];
    await act(async()=>root.render(createElement(View,{key:'restored'})));
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="JavaScript source"]')!.value).toBe(node.data.codeDraft);
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Render function source"]')!.value).toBe(node.data.renderDraft);
    await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Apply code')!.click());
    expect(node.data.module).toContain('emit(42)');expect(node.data.codeDraft).toBeUndefined();expect(node.data.render).toBe(originalRender);
    await act(async()=>[...host.querySelectorAll('button')].find(button=>button.textContent==='Apply render')!.click());
    expect(node.data.render).toContain('<div>Draft</div>');expect(node.data.renderDraft).toBeUndefined();
  }finally{await act(async()=>root.unmount());host.remove();}
});
it('includes unapplied library source in JSON without replacing its active exports',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  let project=exampleDiagram();project.modules=[{id:'helper',alias:'helper',source:'export const value=1;'}];
  function View(){const defaults=useContext(ProjectContext);const[modules,setModules]=useState(project.modules!);return createElement(TooltipProvider,null,createElement(ProjectContext.Provider,{value:{...defaults,modules,updateModule:module=>{project={...project,modules:project.modules!.map(current=>current.id===module.id?module:current)};setModules(project.modules!);}}},createElement(ProjectModules)));}
  try{
    await act(async()=>root.render(createElement(View)));
    const editor=host.querySelector<HTMLTextAreaElement>('[aria-label="Source for helper"]')!;
    editor.value='export const unfinished =';await act(async()=>editor.dispatchEvent(new Event('input',{bubbles:true})));
    expect(project.modules![0].source).toBe('export const value=1;');
    project=parseDiagram(serializeDiagram(project));
    await act(async()=>root.render(createElement(View,{key:'restored'})));
    expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Source for helper"]')!.value).toBe('export const unfinished =');
  }finally{await act(async()=>root.unmount());host.remove();}
});

// @vitest-environment jsdom
import { act } from 'react';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it } from 'vitest';
import { makeJsNode } from './js-recipes';
import { buildBlockModule } from './block-code';
import { parseDiagram,serializeDiagram,makeNode } from './model';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('renders JavaScript objects, arrays and scalar values as formatted JSON in an editable general viewer',async()=>{
  const node=makeJsNode('GeneralView',{x:0,y:0});
  const diagram={version:1 as const,name:'Viewers',nodes:[node,makeNode('renderer',{x:300,y:0})],edges:[],viewport:{x:0,y:0,zoom:1}};
  expect(parseDiagram(serializeDiagram(diagram))).toEqual(diagram);expect(diagram.nodes[1].data.label).toBe('Math viewer');
  const module=await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(buildBlockModule(node.data.module!,node.data.render!)).toString('base64')}`);
  const element=document.createElement('div');document.body.append(element);let mounted:any;
  try{
    await act(async()=>{mounted=await module.default({inputs:{input1:{name:'Ada',active:true,values:[1,2],limit:Infinity}},state:{},value:'',element,ui:{React,createRoot}});});
    expect(JSON.parse(element.querySelector('pre')!.textContent!)).toEqual({name:'Ada',active:true,values:[1,2],limit:'Infinity'});
    for(const value of [false,0,'hello',[1,{x:2}]]) {
      await act(async()=>mounted.update({input1:value},''));expect(JSON.parse(element.querySelector('pre')!.textContent!)).toEqual(value);
    }
  }finally{if(mounted)await act(async()=>mounted.destroy());element.remove();}
});

import { expect,it } from 'vitest';
import * as React from 'react';
import { parseCsv } from './csv';
import { makeJsNode } from './js-recipes';
import { buildBlockModule } from './block-code';
import { parseDiagram,serializeDiagram } from './model';
it('parses quoted CSV fields, escaped quotes, multiline cells, BOM, numeric rows and headers',()=>{
  expect(parseCsv('\uFEFF1,2\r\n3,4\r\n')).toEqual([[1,2],[3,4]]);
  expect(parseCsv('name,note\nAda,"a,b"\nLin,"first\nsecond"',{header:true})).toEqual([{name:'Ada',note:'a,b'},{name:'Lin',note:'first\nsecond'}]);
  expect(parseCsv('"say ""hello""",2')).toEqual([['say "hello"',2]]);
  expect(parseCsv('01;2.5\n3;4',{delimiter:';',numeric:false})).toEqual([['01','2.5'],['3','4']]);
  expect(parseCsv('')).toEqual([]);
  expect(()=>parseCsv('a,b\n1')).toThrow('same number');
  expect(()=>parseCsv('"unfinished')).toThrow('Unclosed');
  expect(()=>parseCsv('__proto__,b\n1,2',{header:true})).toThrow('safe');
  expect(()=>parseCsv('a,a\n1,2',{header:true})).toThrow('unique');
});
it.each(['Text','CSV'])('executes the editable %s source and round trips the complete definition',async recipe=>{
  const node=makeJsNode(recipe,{x:0,y:0});
  if(recipe==='Text')node.data.value='hello\n  world';
  const diagram={version:1 as const,name:'Sources',nodes:[node],edges:[],viewport:{x:0,y:0,zoom:1}};
  expect(parseDiagram(serializeDiagram(diagram))).toEqual(diagram);
  const module=await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(buildBlockModule(node.data.module!,node.data.render!)).toString('base64')}`);
  const output:unknown[]=[];
  const mounted=await module.default({inputs:{},state:{},value:node.data.value,element:{},emit:(v:unknown)=>output.push(v),ui:{React,createRoot:()=>({render(){},unmount(){}})}});
  expect(output).toEqual(recipe==='Text'?['hello\n  world']:[[[1,2],[3,4]]]);await mounted.destroy();
});

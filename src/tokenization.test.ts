import { expect,it } from 'vitest';
import * as React from 'react';
import { makeJsNode } from './js-recipes';
import { buildBlockModule } from './block-code';
import { parseDiagram } from './model';
import dictionaryJson from '../examples/tokenization-dictionary.json?raw';
async function run(name:string,inputs:Record<string,unknown>,value?:string) {
  const node=makeJsNode(name,{x:0,y:0});
  const module=await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(buildBlockModule(node.data.module!,node.data.render!)).toString('base64')}`);
  const state:any={},outputs:unknown[]=[];
  const mounted=await module.default({inputs,state,value:value??node.data.value,element:{style:{}},emit:(v:unknown)=>outputs.push(v),ui:{React,latex(){},createRoot:()=>({render(){},unmount(){}})}});
  await mounted.destroy();return {state,outputs};
}
it('maps words and punctuation through an editable dictionary with an unknown token',async()=>{
  const {state,outputs}=await run('WordTokenizer',{input1:'The cat!'});
  expect(state.tokens).toEqual(['the','cat','!']);expect(outputs).toEqual([[1,2,0]]);
  expect((await run('WordTokenizer',{input1:'猫'})).outputs).toEqual([[0]]);
});
it('tokenizes dictionary into subword IDs and looks up compatible embedding rows',async()=>{
  const {state,outputs}=await run('SubwordTokenizer',{input1:'dictionary'});
  expect(state.tokens).toEqual(['dict','ion','ary']);expect(outputs).toEqual([[1,2,3]]);
  const diagram=parseDiagram(dictionaryJson),embedding=diagram.nodes.find(n=>n.id==='embedding')!;
  expect((await run('Embedding',{input1:outputs[0]},embedding.data.value)).outputs).toEqual([[[1,0],[0,1],[1,1]]]);
  expect((await run('SubwordTokenizer',{input1:'dictionary?'})).outputs).toEqual([[1,2,3,0]]);
  await expect(run('Embedding',{input1:[99]})).rejects.toThrow('Token IDs');
});

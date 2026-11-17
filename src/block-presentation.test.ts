import { expect,it } from 'vitest';
import { blockPresentation } from './block-presentation';
import { makeJsNode,jsRecipes } from './js-recipes';
import { parseDiagram,serializeDiagram } from './model';
it.each([
  ['Text',['Data sources','Text']],['CSV',['Data sources','CSV']],['String',['Data types','String']],['Boolean',['Data types','Boolean']],
  ['MatMul',['Operators & functions','Matrix multiply']],
  ['DOM',['JavaScript','Module']],['WebAssembly',['JavaScript','WebAssembly']],
  ['WordTokenizer',['JavaScript','Module','Word tokenizer']],
  ['Three.js',['JavaScript','Module','Three.js']],
])('preserves the %s identity through JSON independently of the block name',(recipe,trail)=>{
  const node=makeJsNode(recipe,{x:0,y:0});node.data.label='My renamed instance';
  const restored=parseDiagram(serializeDiagram({version:1,name:'Identity',nodes:[node],edges:[],viewport:{x:0,y:0,zoom:1}}));
  expect(blockPresentation(restored.nodes[0].data)).toMatchObject({trail,symbol:jsRecipes[recipe].symbol});
});

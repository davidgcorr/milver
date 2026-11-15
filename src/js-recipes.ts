import { iframeRecipes } from './iframe-recipes';
import { interactiveRecipes, demoLibrary } from './interactive-recipes';
import { dataSourceRecipes } from './data-source-recipes';
import { tokenizerRecipes } from './tokenizer-recipes';
import { operatorRecipes, sinkRecipes } from './operator-recipes';
import { defaultLogic, defaultRender, completeFunction } from './block-code';
import { makeNode, type BlockNode } from './model';
import {standardRecipes} from './standard-recipes';

// A working two-i32 add module; imported binaries replace this in JSON.
export const exampleWasm = 'AGFzbQEAAAABBwFgAn9/AX8DAgEABwcBA2FkZAAACgkBBwAgACABags=';
export type JsRecipe = { description?: string; label: string; symbol: string; category: string; source: string; render?: string; value: string; inputs: number; outputs: number };
export const jsRecipes: Record<string, JsRecipe> = {
  ...operatorRecipes, ...sinkRecipes, ...tokenizerRecipes, ...dataSourceRecipes, ...interactiveRecipes, ...iframeRecipes,
  ...Object.fromEntries(['DOM','LaTeX','Three.js'].map(label => [label, { label: label === 'DOM' ? 'Module' : `${label} example`, symbol: label === 'DOM' ? 'JS' : label === 'LaTeX' ? 'ƒ' : '3D', category: 'JavaScript code blocks', source:'', value: '1', inputs: 1, outputs: 1 }])),
  MatrixActivation: {label:'Matrix activation controls',symbol:'αβ',category:'Examples',source:'',value:'[[-3,-2,-1,0,1,2],[3,-4,5,-6,7,-8],[0,2,-2,4,-4,6]]',inputs:1,outputs:1},
  Number: { label: 'Number', symbol: '123', category: 'JavaScript datatypes', source: '', value: '1', inputs: 0, outputs: 1 },
  Boolean: { label: 'Boolean', symbol: 'T/F', category: 'JavaScript datatypes', source: '', value: 'true', inputs: 0, outputs: 1 },
  String: { label: 'String', symbol: 'abc', category: 'JavaScript datatypes', source: '', value: 'Hello', inputs: 0, outputs: 1 },
  Vector: { label: 'Vector', symbol: '[x]', category: 'JavaScript datatypes', source: '', value: '[1,2,3]', inputs: 0, outputs: 1 },
  Matrix: { label: 'Matrix', symbol: '▦', category: 'JavaScript datatypes', source: '', value: '[[1,2],[3,4]]', inputs: 0, outputs: 1 },
  Tensor: { label: 'Tensor', symbol: '▧', category: 'JavaScript datatypes', source: '', value: '[[[1,2],[3,4]],[[5,6],[7,8]]]', inputs: 0, outputs: 1 },
  Counter: { label: 'Counter', symbol: '◷', category: 'Examples', source: '', value: '1000', inputs: 0, outputs: 1 },
  Clock: { label: 'Counter', symbol: '◷', category: 'Examples', source: '', value: '1000', inputs: 0, outputs: 1 },
  Trigger: { label: 'Trigger', symbol: '↑', category: 'Examples', source: '', value: '', inputs: 1, outputs: 1 },
  Slider: { label: 'Slider', symbol: '☷', category: 'JavaScript sources', source: '', value: '{"min":0,"max":100,"step":1,"initial":50}', inputs: 0, outputs: 1 },
  Selector: { label: 'Selector', symbol: '▾', category: 'JavaScript sources', source: '', value: '{"options":["A","B","C"],"selected":0}', inputs: 0, outputs: 1 },
  Button: { label: 'Button', symbol: '↖', category: 'JavaScript sources', source: '', value: '{"label":"Click","count":0}', inputs: 0, outputs: 1 },
  WebAssembly: { label: 'WebAssembly', symbol: 'WA', category: 'JavaScript code blocks', source: '', value: '', inputs: 2, outputs: 1 },
} satisfies Record<string, { label: string; symbol: string; category: string; source: string; render?: string; value: string; inputs: number; outputs: number }>;
// Catalog and inserted blocks expose exactly the same full functions.
for(const[name,recipe]of Object.entries(jsRecipes)){
  const standard=standardRecipes[name];
  recipe.source=completeFunction(standard?.logic??recipe.source,'run');
  recipe.render=completeFunction(standard?.render??recipe.render??defaultRender,'render');
}
export const wasmSource=standardRecipes.WebAssembly.logic;
export function applyJsRecipe(node: BlockNode, name: string): BlockNode {
  const recipe = jsRecipes[name as keyof typeof jsRecipes];
  if (!recipe) throw new Error('Unknown JavaScript recipe.');
  const ports = [
    ...Array.from({ length: recipe.inputs }, (_, i) => ({ id: `in-${i}`, name: `in ${i + 1}`, type: 'input' as const, side: 'left' as const, variable: `input${i + 1}` })),
    ...Array.from({ length: recipe.outputs }, (_, i) => ({ id: `out-${i}`, name: 'out', type: 'output' as const, side: 'right' as const, variable: `output${i + 1}` })),
  ];
  const { render: _render, state: _state, ...data } = node.data;
  const result: BlockNode = { ...node, data: { ...data, kind: 'javascript', renderEnabled:true, recipe: name, label: recipe.label, description: recipe.description ?? data.description, module: recipe.source, ...('render' in recipe ? { render: recipe.render as string, state: {} } : {}), value: recipe.value, ports, ...(name === 'WebAssembly' ? { wasm: { filename: 'add.wasm', base64: exampleWasm, exportName: 'add' } } : {}) } };
  if (result.data.render !== undefined) { result.data.module = completeFunction(result.data.module ?? '', 'run'); result.data.render = completeFunction(result.data.render, 'render'); }
  return result;
}
export function makeJsNode(name: string, position: { x: number; y: number }, id?: string) { return applyJsRecipe(makeNode('javascript', position, id), name); }

export const exampleLibraries = {
  LibraryBadge: demoLibrary,
  'Three.js': { alias: 'THREE', url: 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js' },
} satisfies Record<string, { alias: string; url?: string; source?: string }>;

import { expect,it } from 'vitest';
import * as math from './math-library.js';
import { parseCsv } from './csv';
import { parseDiagram,serializeDiagram } from './model';
import { compileProject,nodeKey } from './project/graph';
import { ProjectEngine } from './project/engine';
import example from '../examples/nanogpt-characters.json?raw';
await math.ready;
it('executes the collapsed NanoGPT parents, shares embedding weights, and preserves causal prefixes',async()=>{
  const diagram=parseDiagram(example);expect(parseDiagram(serializeDiagram(diagram))).toEqual(diagram);
  expect(diagram.nodes.filter(n=>n.data.kind==='subsystem')).toHaveLength(4);
  const plan=compileProject(diagram),engine=new ProjectEngine({math,tensorMath:math,tf:math.tf},diagram.modules!);
  for(const node of plan.nodes)if(node.data.operation?.type==='code')engine.setCode(node.id,await import(/* @vite-ignore */ `data:text/javascript;base64,${Buffer.from(node.data.module!).toString('base64')}`));
  const csv=JSON.parse(diagram.nodes.find(n=>n.id==='token-table')!.data.value),table=parseCsv(csv.text,csv);
  const external=(text:string)=>({[nodeKey([],'text')]:{values:{'out-0':text}},[nodeKey([],'token-table')]:{values:{'out-0':table}}});
  try {
    const first=await engine.execute(plan,external('hello'));
    for(const result of Object.values(first.nodes))expect(result.error).toBeUndefined();
    const vocabulary=first.nodes[nodeKey([],'tokenization')].outputs['tokenization-output-1'] as string[];
    expect(first.nodes[nodeKey([],'tokenization')].outputs['tokenization-output-0']).toEqual([...'hello'].map(char=>vocabulary.indexOf(char)));
    const probabilities=first.nodes[nodeKey([],'lm-head')].outputs['lm-head-output-1'] as number[][];
    expect(probabilities[0]).toHaveLength(vocabulary.length);expect(probabilities[0].reduce((a,b)=>a+b,0)).toBeCloseTo(1);
    expect(probabilities.flat().every(Number.isFinite)).toBe(true);
    expect(vocabulary).toContain(first.nodes[nodeKey([],'prediction')].inputs['in-0']);
    const h=first.nodes[nodeKey([],'gpt-block')].outputs['gpt-block-output-0'] as number[][];
    const second=await engine.execute(plan,external('hellow'));
    const longer=second.nodes[nodeKey([],'gpt-block')].outputs['gpt-block-output-0'] as number[][];
    for(let i=0;i<h.length;i++)for(let j=0;j<4;j++)expect(longer[i][j]).toBeCloseTo(h[i][j],5);
    const tied=plan.nodes.find(n=>n.id===nodeKey(['lm-head'],'tied-weights'))!;
    expect(tied.inputs['in-0'].node).toBe(nodeKey([],'token-table'));
    const invalid=await engine.execute(plan,external('unknown🙂'));
    expect(invalid.nodes[nodeKey(['tokenization'],'encode')].error).toContain('outside the corpus');
  }finally{await engine.dispose();}
});

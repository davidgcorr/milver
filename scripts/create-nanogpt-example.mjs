import { createServer } from 'vite';
import { writeFile } from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
  const {makeNode,interfacePorts,serializeDiagram,parseDiagram}=await server.ssrLoadModule('/src/model.ts');
  const {makeJsNode}=await server.ssrLoadModule('/src/js-recipes.ts');
  const {mathLibrary}=await server.ssrLoadModule('/src/default-libraries.ts');
  const corpus='hello world\n',vocabulary=[...new Set([...corpus])].sort((a,b)=>a.codePointAt(0)-b.codePointAt(0));
  const weights=(rows,cols,scale=.2,seed=0)=>Array.from({length:rows},(_,i)=>Array.from({length:cols},(_,j)=>Number((Math.sin((i+1)*7+(j+1)*3+seed)*scale).toFixed(4))));
  class Graph {
    nodes=[];edges=[];
    add(node){this.nodes.push(node);return node;}
    source(id,recipe,x,y,label,value){const n=makeJsNode(recipe,{x,y},id);n.data.label=label;if(value!==undefined)n.data.value=value;n.width=260;n.height=190;return this.add(n);}
    code(id,x,y,label,inputs,body,parameters={},recipe='DOM'){
      const n=makeNode('compute',{x,y},id);n.width=260;n.height=180;n.data.label=label;n.data.recipe=recipe;
      n.data.value=JSON.stringify(parameters);
      n.data.module=`// Pure project computation: runs even when its parent canvas is closed.\nasync function run({ inputs, modules, parameters }) {\n  const math = modules.tensorMath;\n  await math.ready;\n${body.split('\n').map(line=>'  '+line).join('\n')}\n}`;
      n.data.ports=[...inputs.map((name,i)=>({id:`in-${i}`,name,type:'input',side:'left',variable:name})),{id:'out-0',name:'result',type:'output',side:'right',variable:'result'}];
      return this.add(n);
    }
    wire(a,b,input=0,output=0){const out=a.data.ports.filter(p=>p.type==='output')[output],into=b.data.ports.filter(p=>p.type==='input')[input];if(!out||!into)throw new Error(`Missing port ${a.id} → ${b.id}`);this.edges.push({id:`${a.id}-${b.id}-${input}`,source:a.id,sourceHandle:out.id,target:b.id,targetHandle:into.id,type:'smoothstep'});}
    parent(id,x,y,label,names,build){
      const parent=makeNode('subsystem',{x,y},id),inside=new Graph();
      const inputs=names.map((name,i)=>{const n=makeNode('inport',{x:0,y:120+i*240},`${id}-input-${i}`);n.data.label=name;inside.add(n);return n;});
      const outputs=build(inside,inputs);
      const outputX=Math.max(...inside.nodes.map(n=>n.position.x))+340;
      for(const [i,{node,name}] of outputs.entries()){
        const out=makeNode('outport',{x:outputX,y:120+i*240},`${id}-output-${i}`);out.data.label=name;inside.add(out);inside.wire(node,out);
      }
      parent.width=240;parent.height=160;parent.data.label=label;parent.data.description='Double-click to inspect the grouped computations. All internal code runs in the project runtime.';
      parent.data.canvas={nodes:inside.nodes,edges:inside.edges,viewport:{x:80,y:100,zoom:.55}};parent.data.ports=interfacePorts(parent.data.canvas);return this.add(parent);
    }
    canvas(){return {nodes:this.nodes,edges:this.edges,viewport:{x:300,y:180,zoom:.55}};}
  }
  const root=new Graph();
  const text=root.source('text','Text',0,100,'Prompt · hello','hello');
  const table=weights(vocabulary.length,4,.4);
  const csv=root.source('token-table','CSV',340,520,'Token embeddings · shared with LM head',JSON.stringify({text:table.map(row=>row.join(',')).join('\n'),delimiter:',',header:false,numeric:true}));
  const tokenizer=root.parent('tokenization',340,100,'1 · Character tokenization',['Text'],(g,[text])=>{
    const dict=g.code('vocabulary',300,400,'Sorted vocabulary · stoi / itos',[],"return [...new Set([...parameters.corpus])].sort((a,b) => a.codePointAt(0)-b.codePointAt(0));",{corpus});
    const encode=g.code('encode',640,100,'Encode characters · context ≤ 16',['text','vocabulary'],`if (typeof inputs.text !== 'string') throw new Error('Connect a text prompt.');
const chars = [...inputs.text].slice(-parameters.blockSize);
if (!chars.length) throw new Error('Enter a nonempty prompt.');
const ids = chars.map(char => inputs.vocabulary.indexOf(char));
if (ids.some(id => id < 0)) throw new Error('Prompt contains a character outside the corpus vocabulary. Edit the vocabulary corpus.');
return ids;`,{blockSize:16});g.wire(text,encode);g.wire(dict,encode,1);
    return [{node:encode,name:'Token IDs'},{node:dict,name:'Vocabulary'}];
  });root.wire(text,tokenizer);
  const idsView=root.add(makeNode('renderer',{x:680,y:-160},'token-ids'));idsView.data.label='Character IDs';root.wire(tokenizer,idsView);
  const embedding=root.parent('embeddings',680,100,'2 · Token + position embeddings',['Token IDs','Token table'],(g,[ids,table])=>{
    const token=g.code('lookup',340,100,'Token embedding lookup',['ids','table'],'return inputs.ids.map(id => inputs.table[id]);',{},'Embedding');g.wire(ids,token);g.wire(table,token,1);
    const position=g.code('positions',340,400,'Position embedding lookup',['ids'],'return parameters.table.slice(0,inputs.ids.length);',{table:weights(16,4,.03)},'Embedding');g.wire(ids,position);
    const add=g.code('embedding-add',680,100,'X = token + position',['a','b'],'return math.add(inputs.a,inputs.b);',{},'Add');g.wire(token,add);g.wire(position,add,1);return [{node:add,name:'Hidden states'}];
  });root.wire(tokenizer,embedding);root.wire(csv,embedding,1);
  const transformer=root.parent('gpt-block',1020,100,'3 · Pre-norm GPT block',['Hidden states'],(g,[input])=>{
    const ln=g.code('ln-attention',340,100,'Pre-norm · attention',['x'],'return math.layerNorm(inputs.x);',{},'LayerNorm');g.wire(input,ln);
    const attention=g.parent('causal-attention',680,100,'Causal self-attention',['Normalized states'],(a,[x])=>{
      const projection=(id,y)=>{const n=a.code(id,300,y,`${id.toUpperCase()} projection`,['x'],'return math.matmul(inputs.x,parameters.weight);',{weight:weights(4,4,.2,{query:1,key:2,value:3}[id])},'MatMul');a.wire(x,n);return n;};
      const q=projection('query',0),k=projection('key',260),v=projection('value',520);
      const transpose=a.code('key-transpose',640,260,'Kᵀ',['x'],'return math.transpose(inputs.x);',{},'Transpose');a.wire(k,transpose);
      const score=a.code('scores',980,0,'Q Kᵀ / √dₖ',['q','kt'],'return math.multiply(math.matmul(inputs.q,inputs.kt),0.5);',{},'MatMul');a.wire(q,score);a.wire(transpose,score,1);
      const mask=a.code('causal-mask',1320,0,'Causal mask · future = −∞',['scores'],'return inputs.scores.map((row,i) => row.map((value,j) => j > i ? -Infinity : value));');a.wire(score,mask);
      const softmax=a.code('attention-probabilities',1660,0,'Row-wise softmax',['x'],'return math.softmax(inputs.x);',{},'Softmax');a.wire(mask,softmax);
      const mix=a.code('mix-values',2000,0,'Attention probabilities × V',['a','v'],'return math.matmul(inputs.a,inputs.v);',{},'MatMul');a.wire(softmax,mix);a.wire(v,mix,1);
      const out=a.code('w0',2340,0,'W₀ · output projection',['x'],'return math.matmul(inputs.x,parameters.weight);',{weight:weights(4,4)},'MatMul');a.wire(mix,out);return [{node:out,name:'Attention output'}];
    });g.wire(ln,attention);
    const residual=g.code('attention-residual',1020,100,'X + attention(LN(X))',['x','attention'],'return math.add(inputs.x,inputs.attention);',{},'Add');g.wire(input,residual);g.wire(attention,residual,1);
    const norm=g.code('ln-mlp',1360,100,'Pre-norm · MLP',['x'],'return math.layerNorm(inputs.x);',{},'LayerNorm');g.wire(residual,norm);
    const mlp=g.parent('mlp',1700,100,'Feed-forward · 4 → 16 → 4',['Normalized states'],(m,[x])=>{
      const up=m.code('mlp-up',340,100,'Expand · 4C',['x'],'return math.add(math.matmul(inputs.x,parameters.weight),parameters.bias);',{weight:weights(4,16),bias:Array(16).fill(0)},'Linear');m.wire(x,up);
      const gelu=m.code('mlp-gelu',680,100,'GELU',['x'],'return math.gelu(inputs.x);',{},'GELU');m.wire(up,gelu);
      const down=m.code('mlp-down',1020,100,'Contract · C',['x'],'return math.add(math.matmul(inputs.x,parameters.weight),parameters.bias);',{weight:weights(16,4),bias:Array(4).fill(0)},'Linear');m.wire(gelu,down);return [{node:down,name:'MLP output'}];
    });g.wire(norm,mlp);
    const out=g.code('mlp-residual',2040,100,'H + MLP(LN(H))',['h','mlp'],'return math.add(inputs.h,inputs.mlp);',{},'Add');g.wire(residual,out);g.wire(mlp,out,1);return [{node:out,name:'Hidden states'}];
  });root.wire(embedding,transformer);
  const head=root.parent('lm-head',1360,100,'4 · LM head + decode',['Hidden states','Token table','Vocabulary'],(g,[hidden,table,vocab])=>{
    const norm=g.code('final-norm',340,100,'Final layer normalization',['x'],'return math.layerNorm(inputs.x);',{},'LayerNorm');g.wire(hidden,norm);
    const last=g.code('last-token',680,100,'Last context position',['x'],'return [inputs.x.at(-1)];');g.wire(norm,last);
    const transpose=g.code('tied-weights',680,400,'Tied token tableᵀ',['x'],'return math.transpose(inputs.x);',{},'Transpose');g.wire(table,transpose);
    const logits=g.code('logits',1020,100,'Language model logits',['x','w'],'return math.matmul(inputs.x,inputs.w);',{},'MatMul');g.wire(last,logits);g.wire(transpose,logits,1);
    const softmax=g.code('next-probabilities',1360,100,'Next-character probabilities',['x'],'return math.softmax(inputs.x);',{},'Softmax');g.wire(logits,softmax);
    const decode=g.code('decode',1700,100,'Greedy decode · untrained demo',['probabilities','vocabulary'],`const row = inputs.probabilities[0];
const id = row.indexOf(Math.max(...row));
return inputs.vocabulary[id];`);g.wire(softmax,decode);g.wire(vocab,decode,1);
    return [{node:decode,name:'Next character'},{node:softmax,name:'Probabilities'}];
  });root.wire(transformer,head);root.wire(csv,head,1);root.wire(tokenizer,head,2,1);
  const predicted=root.add(makeNode('renderer',{x:1700,y:100},'prediction'));predicted.data.label='Next character (quoted) · toy weights';predicted.data.render="function render({ state }) {\n  // Quote spaces and newlines so the next character remains visible.\n  return <code style={{fontSize:24}}>{state.result == null ? 'Waiting for prompt' : JSON.stringify(state.result)}</code>;\n}";root.wire(head,predicted);
  const probabilities=root.add(makeNode('renderer',{x:1700,y:400},'probabilities'));probabilities.data.label='Vocabulary probabilities';root.wire(head,probabilities,0,1);
  const diagram={version:1,metadata:{author:'milver',updatedAt:'2026-11-12'},name:'NanoGPT-style · characters to next-token probabilities',modules:[mathLibrary],...root.canvas()};
  const json=serializeDiagram(diagram);parseDiagram(json);
  await writeFile(new URL('../examples/nanogpt-characters.json',import.meta.url),json+'\n');
} finally {await server.close();}

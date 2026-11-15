import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try {
  const {makeJsNode}=await server.ssrLoadModule('/src/js-recipes.ts');
  const {demoLibrary}=await server.ssrLoadModule('/src/interactive-recipes.ts');
  const {parseDiagram,serializeDiagram}=await server.ssrLoadModule('/src/model.ts');
  const nodes=[],edges=[];
  const add=(id,recipe,x,y,value)=>{const node=makeJsNode(recipe,{x,y},id);node.width=260;node.height=200;if(value!==undefined)node.data.value=value;nodes.push(node);return node;};
  const wire=(source,target,input=0)=>edges.push({id:`${source}-${target}-${input}`,source,target,sourceHandle:'out-0',targetHandle:`in-${input}`,type:'smoothstep'});
  add('metric','Slider',0,0,JSON.stringify({min:0,max:100,step:1,initial:65}));
  add('color','Selector',0,280,JSON.stringify({options:['#0ea5e9','#ec4899','#10b981'],selected:0}));
  add('title','Text',0,560,'Live input');
  add('enabled','Toggle',0,840);
  add('period','Slider',0,1120,JSON.stringify({min:80,max:1000,step:20,initial:400}));
  add('width','Slider',0,1400,JSON.stringify({min:180,max:420,step:10,initial:280}));
  add('card','MetricCard',380,0);wire('metric','card');wire('color','card',1);
  add('ring','ProgressRing',380,280);wire('metric','ring');
  add('appearance','InputAppearance',380,560);wire('title','appearance');wire('color','appearance',1);wire('width','appearance',2);
  add('action','ActionButton',760,0);wire('enabled','action');wire('metric','action',1);
  add('pulse','Pulse',760,280);wire('enabled','pulse');wire('period','pulse',1);
  add('badge','LibraryBadge',760,560);wire('metric','badge');
  add('events','GeneralView',1140,0);wire('action','events');
  add('ticks','GeneralView',1140,280);wire('pulse','ticks');
  const activation=add('activation','MatrixActivation',760,840);activation.width=340;activation.height=300;
  add('activation-view','GeneralView',1140,840);wire('activation','activation-view');
  const diagram={version:1,name:'Interactive blocks · React + inputs',metadata:{author:'milver',updatedAt:'2026-11-14'},modules:[{id:'demo-visual-library',...demoLibrary}],nodes,edges,viewport:{x:300,y:100,zoom:.42}};
  const json=serializeDiagram(diagram);parseDiagram(json);await writeFile(new URL('../examples/interactive-blocks.json',import.meta.url),json+'\n');
}finally{await server.close();}

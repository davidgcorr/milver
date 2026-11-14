import {createServer} from 'vite';
import {writeFile} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{
  const {makeJsNode}=await server.ssrLoadModule('/src/js-recipes.ts');
  const {parseDiagram,serializeDiagram}=await server.ssrLoadModule('/src/model.ts');
  const nodes=[],edges=[];
  const add=(id,recipe,x,y,value)=>{const node=makeJsNode(recipe,{x,y},id);node.width=300;node.height=230;if(value!==undefined)node.data.value=value;nodes.push(node);};
  const wire=(source,target,input=0)=>edges.push({id:`${source}-${target}-${input}`,source,target,sourceHandle:'out-0',targetHandle:`in-${input}`,type:'smoothstep'});
  add('number','Slider',0,0,JSON.stringify({min:0,max:100,step:1,initial:42}));
  add('color','Selector',0,300,JSON.stringify({options:['#0ea5e9','#ec4899','#10b981'],selected:0}));
  add('csv','CSV',0,600,JSON.stringify({text:'2,5,3,8',delimiter:',',header:false,numeric:true}));
  add('metric','IframeMetric',420,0);wire('number','metric');wire('color','metric',1);
  add('chart','IframeChart',420,600);wire('csv','chart');wire('color','chart',1);
  add('metric-reply','GeneralView',840,0);wire('metric','metric-reply');
  add('chart-reply','GeneralView',840,600);wire('chart','chart-reply');
  const project={version:1,name:'Iframe inputs · live embedded pages',metadata:{author:'milver',updatedAt:'2026-11-14'},modules:[],nodes,edges,viewport:{x:300,y:100,zoom:.6}};
  const json=serializeDiagram(project);parseDiagram(json);await writeFile(new URL('../examples/iframe-inputs.json',import.meta.url),json+'\n');
}finally{await server.close();}

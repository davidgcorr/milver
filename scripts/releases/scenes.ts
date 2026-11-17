import { makeNode, defaultTheme, serializeDiagram, parseDiagram, type Diagram, type BlockNode } from '../../src/model';
import { blockShapePath, defaultBezierPoints } from '../../src/block-shapes';
import { buildScene, collectPages, defaultExportOptions, sceneSvg, escapeXml } from '../../src/export/scene';
import { pathSpans } from '../../src/arrow-masks';
function block(kind:string,label:string,x:number,y:number,id:string):BlockNode {
 const node=makeNode(kind,{x,y},id);node.data.label=label;node.width=180;node.height=120;node.data.visuals={showHeader:false,background:'#ffffff',strokeColor:'#b8c0d4',strokeWidth:1.5};return node;
}
function project(nodes:BlockNode[],edges:Diagram['edges']=[]):Diagram{return {version:1,name:'Milver demonstration',nodes,edges,viewport:{x:0,y:0,zoom:1},theme:{...defaultTheme},modules:[]};}
const wire=(source:BlockNode,target:BlockNode,id:string,data:any={})=>({id,source:source.id,target:target.id,sourceHandle:source.data.ports.find(p=>p.type==='output')!.id,targetHandle:target.data.ports.find(p=>p.type==='input')!.id,type:'smoothstep',data:{color:'#4f46e5',width:2.5,...data}});
export function demonstration(feature:string,phase=0):Diagram {
 if(feature==='shapes'){
  const types=['circle','ellipse','diamond','parallelogram','polygon','bezier'] as const;
  return project(types.map((type,i)=>{const n=block('custom',['Circle','Ellipse','Rhombus','Rhomboid','Polygon','Custom Bézier'][i],(i%3)*260,Math.floor(i/3)*230,'shape-'+type);n.height=150;n.data.value='';n.data.visuals!.shape={type,...(type==='polygon'?{sides:6,rotation:15}:{}),...(type==='bezier'?{points:defaultBezierPoints().map((p,j)=>j===0?{...p,out:{x:78+12*Math.sin(phase*Math.PI*2),y:8}}:p)}:{})};n.data.ports=n.data.ports.filter(p=>p.type==='input'||p.type==='output');return n;}));
 }
 if(feature==='arrows'){
  const nodes:BlockNode[]=[],edges:Diagram['edges']=[];
  ['plain','pipe','rough','spiral','dashed'].forEach((mask,i)=>{const a=block('constant',mask==='plain'?'Bézier points':mask.charAt(0).toUpperCase()+mask.slice(1),0,i*150,'arrow-in-'+i),b=block('custom','',650,i*150,'arrow-out-'+i);a.width=b.width=130;a.height=b.height=90;a.data.value='';b.data.value='';nodes.push(a,b);edges.push(wire(a,b,'arrow-'+i,{mask,route:i%2?'smoothstep':'bezier',...(i===0?{points:[{x:350,y:20+Math.sin(phase*Math.PI*2)*35}]}:{})}));});return project(nodes,edges);
 }
 const a=block('constant','Input vector',0,80,'input');a.data.value='3';a.data.label='Input signal';
 const b=block('gain','Scale × 2',300,80,'scale');b.data.value='2';b.data.visuals!.shape={type:'diamond'};
 const c=block('renderer','Inspect the result',620,80,'viewer');c.data.visuals!.shape={type:'ellipse'};
 const nodes=[a,b,c],edges=[wire(a,b,'input-scale',{route:'bezier',points:[{x:230,y:70}]}),wire(b,c,'scale-view',{mask:'pipe'})];
 if(feature==='modules'){
  a.data.label='Shared JavaScript library';a.data.value='';a.data.kind='module';a.data.projectModuleId='helpers';
  b.data.kind='compute';b.data.operation={type:'function',effect:'pure',moduleId:'helpers',exportName:'double'};b.data.label='Call double()';b.data.visuals!.shape={type:'rectangle'};
  const d=project(nodes,edges);d.modules=[{id:'helpers',alias:'helpers',filename:'helpers.js',source:'export const double = x => x * 2;\n'}];return d;
 }
 if(feature==='backups'){
  const parent=makeNode('subsystem',{x:300,y:60},'parent');parent.data.label='Nested canvas';parent.width=200;parent.height=160;parent.data.visuals={showHeader:false,strokeColor:'#4f46e5'};
  return project([a,parent,c],[wire(a,parent,'input-parent'),wire(parent,c,'parent-view')]);
 }
 const d=block('constant','Offset',250,320,'offset');d.data.value='0.5';
 const sum=block('sum','Add offset',500,80,'sum');sum.data.value='++';b.position.x=250;c.position.x=750;
 return project([a,b,sum,c,d],[wire(a,b,'input-scale',{route:'bezier',points:[{x:210,y:80}]}),wire(b,sum,'scale-sum',{mask:'pipe'}),wire(sum,c,'sum-view',{mask:'spiral'}),{...wire(d,sum,'offset-sum'),targetHandle:'in-1'}]);
}
const copy:Record<string,{kicker:string;title:string;subtitle:string;chips:string[]}>= {
 excalidraw:{kicker:'EXCALIDRAW MODE',title:'Less chrome. More idea.',subtitle:'Rough outlines. Clear blocks. Labels below.',chips:['One toggle','Reversible styling','Live JavaScript']},
 editing:{kicker:'INLINE VALUE EDITING',title:'Change it. Explore it.',subtitle:'Double-click a value. Edit it on the canvas. See the result.',chips:['Six datatypes','Enter to save','Escape to cancel']},
 overview:{kicker:'VISUAL JAVASCRIPT',title:'Connected ideas.',subtitle:'Build diagrams. Explore math. Keep the code.',chips:['JavaScript blocks','Nested canvases','Portable JSON']},
 arrows:{kicker:'CONNECTION EDITING',title:'Follow your own path.',subtitle:'Bézier points, movable segments and expressive arrow styles.',chips:['Bézier waypoints','Orthogonal routing','Arrow masks']},
 shapes:{kicker:'BLOCK SHAPES',title:'Make the shape fit.',subtitle:'From circles and polygons to your own Bézier outline.',chips:['Anchors + tangents','Outline-aware ports','Resize + export']},
 modules:{kicker:'PROJECT LIBRARIES',title:'Code, in context.',subtitle:'Shared JavaScript libraries. Connected computations.',chips:['Import ES modules','Editable functions','Inspect data']},
 backups:{kicker:'COMPLETE PROJECT JSON',title:'Take the whole idea.',subtitle:'Code, libraries, nested canvases and settings travel together.',chips:['Source + dependencies','Saved state + drafts','Import and restore']},
};
function particle(path:string,progress:number){
 const points=pathSpans(path).flatMap((span,i)=>i?span.slice(1):span);const distances=[0];
 for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y));
 const target=(distances.at(-1)??0)*progress;let i=1;while(i<distances.length-1&&distances[i]<target)i++;
 const a=points[i-1],b=points[i];if(!a||!b)return {x:0,y:0};const t=(target-distances[i-1])/(distances[i]-distances[i-1]||1);return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
}
export function renderMedia(feature:string,meta:{tag:string;shortCommit:string;summary?:string;maintenance?:boolean},width=1600,height=900,phase:number|null=null):string {
 const content=copy[feature]??copy.overview,square=width===height,scale=width/1600,H=height/scale;
 const diagram=demonstration(feature,phase??0);if(feature==='excalidraw')diagram.theme={...defaultTheme,rough:true};parseDiagram(serializeDiagram(diagram));
 const scene=buildScene(diagram,collectPages(diagram,[],'current'),{...defaultExportOptions,title:false});
 let svg=sceneSvg(scene,{transparent:true,grid:true});
 if(phase!==null){const dots=scene.wires.map((wire,i)=>{const p=particle(wire.d,(phase+i*.23)%1);return `<circle cx="${p.x+wire.x}" cy="${p.y+wire.y}" r="6" fill="#4f46e5" stroke="#ffffff" stroke-width="2"/>`;}).join('');svg=svg.replace('</svg>',dots+'</svg>');}
 const cardY=square?370:310,cardH=H-cardY-110,cardX=64,cardW=1472;
 svg=svg.replace(/<svg [^>]*viewBox=/,`<svg x="${cardX+30}" y="${cardY+26}" width="${cardW-60}" height="${cardH-52}" viewBox=`);
 const text=(x:number,y:number,value:string,size:number,fill='#f8fafc',extra='')=>`<text x="${x}" y="${y}" font-family="DejaVu Sans,Arial,sans-serif" font-size="${size}" fill="${fill}" ${extra}>${escapeXml(value)}</text>`;
 const chips=content.chips.map((chip,i)=>{const x=64+i*350;return `<rect x="${x}" y="${square?283:251}" width="320" height="36" rx="18" fill="#242b42"/>${text(x+18,square?307:275,chip,17,'#cbd5e1')}`;}).join('');
 const panel=feature==='modules'?`<rect x="1020" y="${cardY+cardH-100}" width="420" height="60" rx="10" fill="#eef2ff"/>${text(1040,cardY+cardH-64,'export const double = x => x * 2;',14,'#4338ca')}`:'';
 return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 1600 ${H}"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#111827"/><stop offset="1" stop-color="#1e2440"/></linearGradient></defs><rect width="1600" height="${H}" fill="url(#bg)"/>${text(64,68,'milver.',40,'#ffffff','font-weight="700"')}${text(1536,62,meta.tag+' · '+meta.shortCommit,18,'#a5b4fc','text-anchor="end"')}${text(64,122,content.kicker,16,'#a5b4fc','letter-spacing="3"')}${text(60,square?218:204,content.title,72,'#ffffff','font-weight="700"')}${text(64,square?263:237,content.subtitle,24,'#cbd5e1')}${chips}<rect x="${cardX}" y="${cardY}" width="${cardW}" height="${cardH}" rx="20" fill="#fafbff" stroke="#dfe4f0" stroke-width="2"/>${svg}${panel}${meta.summary?text(64,H-76,(meta.maintenance?'Maintenance: ':'This release: ')+meta.summary.replace(/^(?:feat|fix|docs|chore)(?:\([^)]*\))?:\s*/,'').slice(0,110),16,'#cbd5e1'):''}${text(64,H-44,'milver.davidgc.com',21,'#e0e7ff')}${text(1536,H-44,'Renderer-generated product demo',14,'#94a3b8','text-anchor="end"')}</svg>`;
}

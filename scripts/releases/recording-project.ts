import { makeJsNode } from '../../src/js-recipes';
import { makeNode, defaultTheme, parseDiagram, serializeDiagram, type Diagram } from '../../src/model';
export function recordingProject(feature:string):Diagram {
 const signal=makeNode('javascript',{x:65,y:190},'signal');signal.width=260;signal.height=210;signal.data.label='Input signal';signal.data.value='2';signal.data.ports=signal.data.ports.filter(p=>p.type==='output');
 signal.data.module=`async function run({value,state,emit}) { state.value=Number(value); emit(state.value); }`;
 signal.data.render=`function render({value,setValue}) { return <div style={{padding:24,width:'100%',textAlign:'center'}}><div style={{fontSize:12,opacity:.6}}>CHANGE THE INPUT</div><strong style={{display:'block',fontSize:42,margin:'12px 0'}}>{value}</strong><input aria-label="Input signal" type="range" min="1" max="9" step="1" value={Number(value)} onChange={e=>setValue(e.target.value)} style={{width:'100%',accentColor:'black'}}/></div>; }`;
 const logic=makeNode('javascript',{x:460,y:190},'logic');logic.width=280;logic.height=210;logic.data.label='Shared JavaScript module';
 logic.data.module=`async function run({inputs,modules,state,emit}) { state.result=modules.helpers.double(Number(inputs.input1??0)); emit(state.result); }`;
 logic.data.render=`function render({state}) { return <div style={{padding:22,textAlign:'center',width:'100%'}}><div style={{fontSize:12,opacity:.6}}>helpers.js</div><code style={{display:'block',margin:'14px 0',fontSize:16}}>double(input)</code><strong aria-label="Module result" style={{fontSize:42}}>{state.result??0}</strong></div>; }`;
 const output=makeNode('javascript',{x:875,y:190},'output');output.width=260;output.height=210;output.data.label='Live output';output.data.ports=output.data.ports.filter(p=>p.type==='input');
 output.data.module=`async function run({inputs,state}) { state.result=inputs.input1??0; }`;
 output.data.render=`function render({state}) { return <div style={{padding:24,textAlign:'center',width:'100%'}}><div style={{fontSize:12,opacity:.6}}>ACTUAL JS OUTPUT</div><strong aria-label="Live result" style={{display:'block',fontSize:48,margin:'12px 0'}}>{state.result??0}</strong><div style={{height:7,background:'#e5e5e5',borderRadius:5}}><div style={{height:7,width:Math.min(100,Number(state.result)/18*100)+'%',background:'#171717',borderRadius:5}}/></div></div>; }`;
 for(const node of [signal,logic,output])node.data.visuals={showHeader:false,background:'#ffffff',strokeColor:'#737373',strokeWidth:1.5};
 const edges=[{id:'signal-logic',source:'signal',target:'logic',sourceHandle:'out-0',targetHandle:'in-0',type:'smoothstep',data:{route:'bezier',animation:'pulse',speed:2,color:'#171717',width:2}},{id:'logic-output',source:'logic',target:'output',sourceHandle:'out-0',targetHandle:'in-0',type:'smoothstep',data:{route:'smoothstep',animation:'dash',speed:2,color:'#171717',width:2}}];
 const project={version:1,name:feature==='modules'?'JavaScript modules — live demo':'Milver — '+feature,nodes:[signal,logic,output],edges,modules:[{id:'helpers',alias:'helpers',filename:'helpers.js',source:'// Shared module\nexport function double(\n  value\n) {\n  return value * 2;\n}\n'}],theme:{...defaultTheme,showGrid:true},viewport:{x:25,y:0,zoom:1}} as Diagram;
 if(feature==='excalidraw')for(const node of project.nodes)node.data.visuals={...node.data.visuals,showHeader:true};
 if(feature==='editing') {const text=makeJsNode('String',{x:460,y:465},'editable-text');text.width=280;text.height=130;text.data.value='Double-click to edit';project.nodes.push(text);}
 return parseDiagram(serializeDiagram(project));
}

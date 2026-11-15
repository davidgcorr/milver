import {completeFunction,defaultLogic,defaultRender} from './block-code';
import {standardRecipes} from './standard-recipes';
import {legacyRecipeHashes} from './legacy-recipe-hashes';
import type {BlockData} from './model';
const hash=(s:string)=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16);};
export const structuralKinds=['subsystem','inport','outport','module','python'];
export const renderAvailable=(data:Pick<BlockData,'kind'|'operation'>)=>!structuralKinds.includes(data.kind)&&!data.operation;
export const usesBlockFunctions=(data:Pick<BlockData,'kind'|'operation'|'module'|'render'>)=>renderAvailable(data)&&!!data.module&&data.render!==undefined;
const nativeLogic:Record<string,string>={
 constant:`let result;\ntry { result = JSON.parse(value); } catch { result = value; }\nstate.result = result;\nemit(result);`,
 gain:`state.result = typeof inputs.input1 === 'number' ? inputs.input1 * Number(value) : null;\nemit(state.result);`,
 sum:`const values = ports.filter(port => port.type === 'input').map(port => inputs[port.id]);\nstate.result = values.every(x => typeof x === 'number') ? values.reduce((sum,x,i) => sum + x * (value[i] === '-' ? -1 : 1),0) : null;\nemit(state.result);`,
 integrator:`// A discrete step: value is the step size, state.total is the saved accumulator.\nstate.total ??= 0;\nstate.total += Number(inputs.input1 ?? 0) * (Number(value) || 1);\nstate.result = state.total;\nemit(state.result);`,
 custom:`state.result = inputs.input1 ?? value;\nemit(state.result);`,
 scope:`state.result = inputs.input1 ?? null;`,
};
const nativeRender=`function render({state}) {
  // state.result is computed in run(); tune the visual here.
  return <MathValue value={state.result} fontSize={24}/>;
}`;
// Custom legacy modules retain their behavior. All their imperative DOM work is
// moved into Render; run() owns the output bridge. Known recipes become plain JSX.
function convertLegacy(source:string){
 let body=source.replace(/import\s+([\s\S]*?)\s+from\s+(['"])([^'"\n]+)\2\s*;?/g,(_,binding:string,_quote:string,url:string)=>{
  const spec=binding.trim();let destructure=spec;
  if(spec.startsWith('* as '))return `const ${spec.slice(5)} = await import(${JSON.stringify(url)});`;
  if(spec.startsWith('{'))destructure=spec.replace(/\bas\b/g,':');
  else if(!spec.includes(','))destructure=`{default:${spec}}`;
  else {const comma=spec.indexOf(',');destructure=`{default:${spec.slice(0,comma)},${spec.slice(comma+1).trim().replace(/^\{|\}$/g,'').replace(/\bas\b/g,':')}}`;}
  return `const ${destructure} = await import(${JSON.stringify(url)});`;
 }).replace(/import\s+(['"])([^'"\n]+)\1\s*;?/g,(_,q,url)=>`await import(${JSON.stringify(url)});`)
 .replace(/export\s+default\s+/, 'const legacyMount = ').replace(/\bexport\s+(?=(?:async\s+)?function|const|let|class)/g,'');
 return {module:`async function run({actions,emit,emitEvent}) {
  // Render's saved controls publish through Code's output actions.
  actions.publish = emit;
  actions.publishEvent = emitEvent;
}`,render:`async function render({ element, actions, ...scope }) {
  // Preserved custom renderer. Replace this visual with JSX when convenient.
  element.replaceChildren();
${body.split('\n').map(line=>'  '+line).join('\n')}
  const mounted = await legacyMount({ ...scope, element, actions, emit: actions.publish, emitEvent: actions.publishEvent });
  return () => typeof mounted === 'function' ? mounted() : mounted?.destroy?.();
}`};
}
export function normalizeFunctions(data:BlockData):BlockData{
 const next={...data};
 if(data.kind==='python')return {...next,module:data.module??'',render:completeFunction('return null;','render'),renderEnabled:false};
 if(data.kind==='javascript'&&/\bexport\s+default\s/.test(data.module??'')){
  const standard=data.recipe&&standardRecipes[data.recipe];
  if(standard&&legacyRecipeHashes[data.recipe!]===hash(data.module!)){next.module=standard.logic;next.render=standard.render;}
  else if(data.module?.includes('Negative slope')&&data.module.includes('Positive slope')&&data.module.includes('matrix.map')){next.module=standardRecipes.MatrixActivation.logic;next.render=standardRecipes.MatrixActivation.render;}
  else Object.assign(next,convertLegacy(data.module!));
 }
 next.module=completeFunction(next.module??nativeLogic[data.kind]??(data.kind==='javascript'?defaultLogic:'// Logic is handled by the project runtime.'),'run');
 next.render=completeFunction(next.render??(nativeLogic[data.kind]?nativeRender:renderAvailable(data)?defaultRender:'return null;'),'render');
 if(next.module.length>100000||next.render.length>100000)throw new Error('Block functions exceed 100 KB after migration.');
 next.state??={};
 if(!renderAvailable(data))next.renderEnabled=false;
 return next;
}

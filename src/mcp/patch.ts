export type JsonPatch = { op: 'add'|'remove'|'replace'|'copy'|'move'|'test'; path: string; value?: unknown; from?: string };
function parts(path:string){if(path==='')return [];if(!path.startsWith('/'))throw new Error('Patch paths must be JSON pointers.');return path.slice(1).split('/').map(part=>{const key=part.replace(/~1/g,'/').replace(/~0/g,'~');if(['__proto__','prototype','constructor'].includes(key))throw new Error('Unsafe patch path.');return key;});}
function equal(a:any,b:any):boolean{if(Object.is(a,b))return true;if(!a||!b||typeof a!=='object'||typeof b!=='object'||Array.isArray(a)!==Array.isArray(b))return false;const keys=Object.keys(a).sort(),other=Object.keys(b).sort();return keys.length===other.length&&keys.every((key,i)=>key===other[i]&&equal(a[key],b[key]));}
export function applyJsonPatch(document:unknown,operations:JsonPatch[]):unknown {
  let result=structuredClone(document);
  const read=(path:string)=>parts(path).reduce<any>((value,key)=>{if(value==null||!Object.hasOwn(value,key))throw new Error(`Missing patch path ${path}`);return value[key];},result);
  const write=(path:string,value:unknown,remove=false,replace=false)=>{
    const keys=parts(path);if(!keys.length){if(remove)throw new Error('Cannot remove the project root.');result=structuredClone(value);return;}
    const key=keys.pop()!,parent=keys.reduce<any>((value,key)=>{if(value==null||!Object.hasOwn(value,key))throw new Error(`Missing patch parent ${path}`);return value[key];},result);
    if(!parent||typeof parent!=='object')throw new Error('Patch parent must be an object or array.');
    if(Array.isArray(parent)){if(key!=='-'&&!/^(0|[1-9]\d*)$/.test(key))throw new Error('Invalid array index.');const index=key==='-'?parent.length:Number(key);if(index>parent.length||((remove||replace)&&index>=parent.length))throw new Error('Array index out of range.');if(remove)parent.splice(index,1);else if(replace)parent[index]=structuredClone(value);else parent.splice(index,0,structuredClone(value));}
    else{if((remove||replace)&&!Object.hasOwn(parent,key))throw new Error(`Missing patch property ${path}`);if(remove)delete parent[key];else parent[key]=structuredClone(value);}
  };
  for(const operation of operations){if(['add','replace','test'].includes(operation.op)&&!Object.hasOwn(operation,'value'))throw new Error('Patch value is required.');if(['copy','move'].includes(operation.op)&&typeof operation.from!=='string')throw new Error('Patch from is required.');switch(operation.op){case 'test':if(!equal(read(operation.path),operation.value))throw new Error(`Patch test failed: ${operation.path}`);break;case 'remove':write(operation.path,undefined,true);break;case 'replace':write(operation.path,operation.value,false,true);break;case 'add':write(operation.path,operation.value);break;case 'copy':write(operation.path,read(operation.from??''));break;case 'move':{if(operation.from===undefined||operation.path.startsWith(operation.from+'/'))throw new Error('Invalid move.');const value=structuredClone(read(operation.from));write(operation.from,undefined,true);write(operation.path,value);break;}default:throw new Error('Unknown patch operation.');}}
  return result;
}

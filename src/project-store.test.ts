import { expect,it } from 'vitest';
import { exampleDiagram,parseDiagram } from './model';
import { projectsKey,readProjects,renameProject,storeProject,writeProjects } from './project-store';
it('stores independent projects with complete JSON, and renames without losing content',()=>{
  const data=new Map<string,string>();
  const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
  const diagram=exampleDiagram();diagram.nodes[0].data.state={result:Infinity};
  const a=storeProject(diagram,'a'),b=storeProject({...diagram,name:'Another project'},'b');
  writeProjects(storage,[a,b]);
  expect(readProjects(storage)).toEqual([a,b]);
  const renamed=renameProject(a,'Renamed');
  expect(renamed.id).toBe('a');expect(parseDiagram(renamed.json)).toEqual({...diagram,name:'Renamed'});
  writeProjects(storage,[renamed]);expect(readProjects(storage)).toEqual([renamed]);
  expect(()=>renameProject(a,'  ')).toThrow('name');
});
it('rejects malformed storage and imported diagrams without silently replacing projects',()=>{
  const storage={getItem:()=>JSON.stringify([{id:'bad',name:'Bad',updatedAt:new Date().toISOString(),json:'{}'}])};
  expect(()=>readProjects(storage)).toThrow();
  expect(()=>writeProjects({setItem:()=>{throw new Error('Quota exceeded');}},[])).toThrow('Quota');
  expect(readProjects({getItem:key=>key===projectsKey?null:'unused'})).toEqual([]);
});

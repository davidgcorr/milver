import { sandbox } from '../test-utils/module-sandbox';
import { expect, it, vi } from 'vitest';
import { captureModuleSources, parseModuleSources } from './module-sources';
import { ModuleLoader } from './loader';
import { exportProjectJson } from '../export/json';
import { exampleDiagram, parseDiagram } from '../model';
import { moduleDocument } from '../components/module-document';
const urls={entry:'https://cdn.example.com/entry.js',child:'https://cdn.example.com/child.js',leaf:'https://cdn.example.com/leaf.js'};
const code={
  [urls.entry]:"import {value} from './child.js'; export async function answer(){const {extra}=await import('./leaf.js');return value+extra;} export const origin=import.meta.url;",
  [urls.child]:"export {value} from './leaf.js';",
  [urls.leaf]:'export const value=40; export const extra=2;'
};
it('captures transitive imports, re-exports, dynamic literal imports and import.meta.url without executing code',async()=>{
  const fetcher=vi.fn(async(url:any)=>({ok:true,url,status:200,text:async()=>code[url]} as Response));
  const archive=await captureModuleSources([{url:urls.entry}],{},fetcher);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(archive[urls.entry].source).toBe(code[urls.entry]);
  expect(archive[urls.entry].resolvedSource).toContain(urls.child);
  expect(archive[urls.entry].resolvedSource).toContain(urls.leaf);
  const network=vi.fn(()=>{throw new Error('Offline');});vi.stubGlobal('fetch',network);
  const loader=new ModuleLoader([{id:'remote',alias:'remote',url:urls.entry}],{createURL:source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`},archive);
  try{
    const modules=await loader.load();expect(await (modules.remote.answer as Function)()).toBe(42);
    expect(modules.remote.origin).toBe(urls.entry);expect(network).not.toHaveBeenCalled();
    const document=moduleDocument('export default ()=>{}',{moduleSources:archive,dependencies:[{specifier:'remote',url:urls.entry}]});
    expect(document).toContain('config.moduleSources');expect(document).toContain('imports[d.url]??d.url');
  }finally{loader.dispose();vi.unstubAllGlobals();}
});
it('downloads a complete backup and can re-export it offline',async()=>{
  const project=exampleDiagram();project.modules=[{id:'remote',alias:'remote',url:urls.entry}];
  const fetcher=vi.fn(async(url:any)=>({ok:true,url,text:async()=>code[url]} as Response));
  const imported=parseDiagram(await exportProjectJson(project,fetcher));
  expect(imported.modules).toEqual(project.modules);expect(imported.moduleSources![urls.entry].source).toBe(code[urls.entry]);
  const offline=vi.fn(()=>{throw new Error('Offline');});
  expect(parseDiagram(await exportProjectJson(imported,offline))).toEqual(imported);
  expect(offline).not.toHaveBeenCalled();
});
it('keeps redirected import bases in the archive',async()=>{
  const fetcher=vi.fn(async(url:any)=>({ok:true,url:url===urls.entry?'https://cdn.example.com/v1/entry.js':url,text:async()=>url===urls.entry?"export {value} from './leaf.js';":'export const value=42;'} as Response));
  const archive=await captureModuleSources([{url:urls.entry}],{},fetcher);
  expect(archive[urls.entry].baseUrl).toBe('https://cdn.example.com/v1/entry.js');
  const loader=new ModuleLoader([{id:'m',alias:'m',url:urls.entry}],{createURL:source=>`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`},archive);
  try{expect((await loader.load()).m.value).toBe(42);}finally{loader.dispose();}
});
it('fails clearly on unavailable dependencies and unsupported computed imports',async()=>{
  const failed=vi.fn(async()=>({ok:false,status:404} as Response));
  await expect(captureModuleSources([{url:urls.entry}],{},failed)).rejects.toThrow('HTTP 404');
  await expect(captureModuleSources([{source:"const path='x'; import(path);"}])).rejects.toThrow('computed dynamic import');
  expect(()=>parseModuleSources({'javascript:alert(1)':{source:'',resolvedSource:''}})).toThrow('Invalid');
});

it('restores archived URL libraries in the generated block renderer without network access',async()=>{
  const url='https://example.com/renderer-library.js',source='export const value=42;';
  const network=vi.fn(()=>{throw new Error('Offline');});vi.stubGlobal('fetch',network);
  const run=await sandbox('export default ({element,modules})=>{element.textContent=String(modules.remote.value);}',[{specifier:'remote',url}],{}, {moduleSources:{[url]:{source,resolvedSource:source,baseUrl:url}}});
  try{await run.send('');expect(run.element.textContent).toBe('42');expect(network).not.toHaveBeenCalled();expect(run.messages.some(message=>message.type==='mask-error')).toBe(false);}
  finally{run.dispose();vi.unstubAllGlobals();}
});

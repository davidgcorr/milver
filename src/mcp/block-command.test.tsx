// @vitest-environment jsdom
import {act} from 'react';
import {expect,it} from 'vitest';
import * as ui from '../sandbox-ui';
import {sandbox} from '../test-utils/module-sandbox';
import {buildBlockModule} from '../block-code';
import {makeJsNode} from '../js-recipes';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('discovers and operates live sandbox DOM, invokes async code actions, and inspects scope',async()=>{
 const node=makeJsNode('DOM',{x:0,y:0}),element=document.createElement('div');document.body.append(element);let run!:Awaited<ReturnType<typeof sandbox>>;
 const code=`async function run({state,actions,emit}){state.n??=0;actions.increment=async(n=1)=>{state.n+=n;emit(state.n);return state.n;};}`;
 const render=`function render({state,actions}){return <Button onClick={()=>actions.increment()}>Count {state.n}</Button>;}`;
 try{
 await act(async()=>{run=await sandbox(buildBlockModule(code,render),[],{},{element,ui,ports:node.data.ports});await run.send('',{}, {id:'test',label:'Control'});});
 const inspected=await run.command({action:'inspect'});expect(inspected.result).toMatchObject({state:{n:0},actions:['increment']});
 let result:any;await act(async()=>{result=await run.command({action:'action',name:'increment',args:[3]});});expect(result.result).toBe(3);expect(element.textContent).toContain('Count 3');
 const controls=await run.command({action:'ui',command:{action:'list'}});const button=controls.result.find((c:any)=>c.tag==='button');expect(button.label).toBe('Count 3');
 await act(async()=>{await run.command({action:'ui',command:{action:'click',selector:button.selector}});});expect(element.textContent).toContain('Count 4');
 expect((await run.command({action:'action',name:'missing'})).error).toContain('Unknown');
 }finally{await act(async()=>run?.dispose());element.remove();}
});

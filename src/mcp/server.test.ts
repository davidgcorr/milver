import {expect,it} from 'vitest';
import {createMcpServer} from './server';
import {applyJsonPatch} from './patch';
const schema={type:'object',properties:{n:{type:'number',minimum:0,maximum:9}},required:['n'],additionalProperties:false};
const tool={name:'double',description:'Double',inputSchema:schema,annotations:{readOnlyHint:true,destructiveHint:false},execute:async(args:Record<string,any>)=>({n:args.n*2})};
it('negotiates MCP lifecycle, lists tools/resources, calls tools and rejects malformed requests',async()=>{
 const server=createMcpServer([tool],uri=>({uri})),session=server.session();let id=0;
 const request=(method:string,params?:any)=>session.request({jsonrpc:'2.0',id:++id,method,params});
 expect((await request('tools/list')).error.code).toBe(-32002);
 expect((await session.request('{')).error.code).toBe(-32700);
 expect((await request('initialize',{})).error.code).toBe(-32602);
 expect((await request('initialize',{protocolVersion:'2025-11-25',clientInfo:{name:'test',version:'1'},capabilities:{}})).result.protocolVersion).toBe('2025-11-25');
 expect((await request('tools/list')).error.code).toBe(-32002);
 expect(await session.request({jsonrpc:'2.0',method:'notifications/initialized'})).toBeNull();
 expect((await request('tools/list')).result.tools[0]).toMatchObject({name:'double',inputSchema:schema});
 expect((await request('tools/call',{name:'double',arguments:{n:4}})).result.structuredContent).toEqual({n:8});
 for(const args of [{},{n:10},{n:NaN},{n:4,unknown:true}])expect((await request('tools/call',{name:'double',arguments:args})).result.isError).toBe(true);
 expect((await request('tools/call',{name:'missing'})).error.code).toBe(-32602);
 expect((await request('resources/list')).result.resources).toHaveLength(3);
 expect(JSON.parse((await request('resources/read',{uri:'milver://editor/state'})).result.contents[0].text)).toEqual({uri:'milver://editor/state'});
 expect((await request('resources/read',{uri:'unknown'})).error.code).toBe(-32602);
 expect((await request('unknown')).error.code).toBe(-32601);
 session.close();expect((await request('ping')).error.code).toBe(-32000);
});
it('serializes mutations and cancels queued/running tools using protocol notifications',async()=>{
 let release!:()=>void;const wait=new Promise<void>(resolve=>release=resolve),calls:string[]=[];
 const server=createMcpServer([{...tool,name:'wait',inputSchema:{type:'object'},execute:async(_,signal)=>{calls.push('wait');await wait;signal?.throwIfAborted();return true;}}],()=>null),session=server.session();
 await session.request({jsonrpc:'2.0',id:0,method:'initialize',params:{protocolVersion:'2025-11-25',clientInfo:{name:'test'},capabilities:{}}});await session.request({jsonrpc:'2.0',method:'notifications/initialized'});
 const first=session.request({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'wait'}});await Promise.resolve();
 expect((await session.request({jsonrpc:'2.0',id:1,method:'tools/list'})).error.code).toBe(-32600);
 await session.request({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:1}});release();expect((await first).result.isError).toBe(true);expect(calls).toEqual(['wait']);
});
it('patches escaped pointers, arrays, copy, move and test atomically without prototype traversal',()=>{
 const source={a:[1,2],nested:{'x/y':1,'~a':2}};
 expect(applyJsonPatch(source,[{op:'add',path:'/a/-',value:3},{op:'move',from:'/a/0',path:'/a/2'},{op:'copy',from:'/nested/x~1y',path:'/nested/copy'},{op:'replace',path:'/nested/~0a',value:4},{op:'test',path:'/a',value:[2,3,1]}])).toEqual({a:[2,3,1],nested:{'x/y':1,'~a':4,copy:1}});
 expect(source.a).toEqual([1,2]);
 for(const operations of [[{op:'remove',path:'/missing'}],[{op:'test',path:'/a',value:[0]}],[{op:'add',path:'/__proto__/oops',value:1}],[{op:'replace',path:'/a/4',value:1}],[{op:'add',path:'/missing'}]] as any[])expect(()=>applyJsonPatch(source,operations)).toThrow();
 expect(({} as any).oops).toBeUndefined();
});

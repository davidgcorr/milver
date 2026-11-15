import {readFile} from 'node:fs/promises';
import {expect,it} from 'vitest';
import {JSDOM} from 'jsdom';
import {browserDocs,renderGuide} from '../scripts/browser-docs';

it.each(['/','/reactflow-recipes/'])('publishes readable static docs and machine discovery with correct links for %s',async base=>{
 const guide=await readFile(new URL('../docs/browser-mcp.md',import.meta.url),'utf8'),files=browserDocs(base,guide);
 const descriptor=JSON.parse(files['mcp/connection.json'].body);
 expect(descriptor).toMatchObject({httpMcpEndpoint:null,requiresOpenEditor:true,editor:base,guide:base+'docs/browser-mcp/',protocolVersion:'2025-11-25'});
 expect(files['docs/browser-mcp.md'].body).toBe(guide);
 expect(files['llms-full.txt'].body).toContain(guide);
 expect(files['llms.txt'].body).toContain('NOT an HTTP MCP endpoint');
 for(const filename of ['mcp/index.html','docs/browser-mcp/index.html']){
   const dom=new JSDOM(files[filename].body),doc=dom.window.document;
   expect(doc.querySelector('script')).toBeNull();
   expect(doc.querySelectorAll('h1')).toHaveLength(1);
   expect(doc.querySelector('pre')!.textContent).toContain('window.milverMcp');
   for(const link of doc.querySelectorAll<HTMLAnchorElement>('a[href],link[href]')){
     const href=link.getAttribute('href')!;
     if(href.startsWith('http'))continue;
     if(href.startsWith('#')){expect(doc.getElementById(href.slice(1)),href).not.toBeNull();continue;}
     expect(href.startsWith(base),href).toBe(true);
     let path=href.split('#')[0].slice(base.length);
     if(!path||path==='favicon.svg')continue;
     if(path.endsWith('/'))path+='index.html';
     expect(Object.hasOwn(files,path),href).toBe(true);
     if(href.includes('#')){const target=new JSDOM(files[path].body).window.document;expect(target.getElementById(href.split('#')[1]),href).not.toBeNull();}
   }
   if(filename.startsWith('docs/')){expect(doc.querySelectorAll('tbody tr').length).toBeGreaterThan(10);expect(doc.getElementById('messageport-connector')).not.toBeNull();}
   dom.window.close();
 }
});
it('escapes HTML and executable strings while retaining guide code examples verbatim',()=>{
 const html=renderGuide('# Title\n\n<script>bad()</script>\n\n```js\nconst value = "<div>";\n```\n\n- **Bold** and `code`\n');
 const doc=new JSDOM(html).window.document;
 expect(doc.querySelector('script')).toBeNull();expect(doc.querySelector('pre')!.textContent).toBe('const value = "<div>";');expect(doc.querySelector('strong')!.textContent).toBe('Bold');
});
it.each(['/','/reactflow-recipes/'])('serves guide/discovery requests in development for %s',async base=>{
 const {browserDocsPlugin}=await import('../scripts/browser-docs');const plugin=browserDocsPlugin();let middleware:any;
 (plugin.configResolved as any)({base});
 (plugin.configureServer as any)({watcher:{add(){}},middlewares:{use(handler:any){middleware=handler;}}});
 for(const path of ['mcp','mcp/','mcp/index.html','mcp/connection.json','docs/browser-mcp/','docs/browser-mcp.md','llms.txt','llms-full.txt']){
   const headers:Record<string,string>={};let body='';let next=false;
   await middleware({url:base+path,method:'GET'},{setHeader(key:string,value:string){headers[key]=value;},end(value:string){body=value;}},()=>next=true);
   expect(next,path).toBe(false);expect(body,path).toContain('milver');
   if(path.endsWith('.json')){expect(headers['Content-Type']).toContain('application/json');expect(JSON.parse(body).editor).toBe(base);}
 }
 let next=false;await middleware({url:base+'unknown',method:'GET'},{},()=>next=true);expect(next).toBe(true);
 const response:any={setHeader(){},end(body:string){this.body=body;}};await middleware({url:base+'mcp/',method:'POST'},response,()=>{});expect(response.statusCode).toBe(405);expect(response.body).toContain('Static discovery only');
});

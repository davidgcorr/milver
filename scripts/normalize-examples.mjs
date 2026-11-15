import {createServer} from 'vite';
import {readFile,writeFile,readdir} from 'node:fs/promises';
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
try{const {parseDiagram,serializeDiagram}=await server.ssrLoadModule('/src/model.ts');for(const name of await readdir('examples'))if(name.endsWith('.json')){const path='examples/'+name;await writeFile(path,serializeDiagram(parseDiagram(await readFile(path,'utf8')))+'\n');}}finally{await server.close();}

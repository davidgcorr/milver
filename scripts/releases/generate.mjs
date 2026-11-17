import { createServer } from 'vite';
import { Resvg } from '@resvg/resvg-js';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { releaseVersion } from './version.mjs';
import { changesFor, socialPosts, featureCatalog } from './notes.mjs';
import { startRecorder } from './record.mjs';
const args=process.argv.slice(2),general=args.includes('--current'),quick=args.includes('--stills-only');
const meta=releaseVersion(process.env.RELEASE_SHA||'HEAD'),changes=changesFor(meta.commit);
const features=general?Object.keys(featureCatalog):[...new Set(['overview',...changes.features])];
const mediaMeta={...meta,...(!general?{summary:changes.subject,maintenance:changes.maintenance}:{})};
const output=resolve(general?'outputs/current-state':`outputs/releases/${meta.tag}`);
await mkdir(output,{recursive:true});await mkdir(join(output,'posts'),{recursive:true});await mkdir(join(output,'media'),{recursive:true});await mkdir(join(output,'examples'),{recursive:true});
if(!quick)execFileSync(process.env.FFMPEG_PATH||'ffmpeg',['-version'],{stdio:'ignore'});
const server=await createServer({server:{...(quick?{middlewareMode:true}:{host:'127.0.0.1',port:0}),ws:false,hmr:false},appType:quick?'custom':'spa',logLevel:'error'});
let recorder;
if(!quick){await server.listen();recorder=await startRecorder(`http://127.0.0.1:${server.httpServer.address().port}/`);}
const manifest={...meta,kind:general?'current-state':'release',language:'en',generatedAt:new Date().toISOString(),changes,features,mediaType:'MP4 and GIF: real Chromium recordings of the running app with verified live JavaScript outputs. Static SVG/PNG illustrations are supplied separately.',recordings:{},posting:'Drafts only. Nothing has been posted to a social network.',files:[]};
try{
 const {renderMedia}=await server.ssrLoadModule('/scripts/releases/scenes.ts');
 const {renderGallery}=await server.ssrLoadModule('/scripts/releases/gallery.tsx');
 const {recordingProject}=await server.ssrLoadModule('/scripts/releases/recording-project.ts');
 const {serializeDiagram}=await server.ssrLoadModule('/src/model.ts');
 const posts=socialPosts(meta,{...changes,features}, {general});
 for(const [network,content] of Object.entries(posts))await writeFile(join(output,'posts',network+'.md'),content);
 const heading=general?'Milver — current product media':`Milver ${meta.tag}`;
 const release=`# ${heading}\n\nSource commit: [${meta.shortCommit}](${meta.sourceUrl})\n\n${general?'General media for the capabilities in this version.':changes.subject}\n\n${features.map(key=>'- '+featureCatalog[key].title+': '+featureCatalog[key].detail).join('\n')}\n\n[Open Milver](${meta.site})\n\nSocial copy is in posts/. Images, looping GIFs and MP4 videos are in media/. Editable demonstration projects are in examples/. See manifest.json for source provenance, file sizes and SHA-256 checksums. Media illustrates current capabilities; the commit summary describes what changed.\n`;
 await writeFile(join(output,'release.md'),release);
 for(const feature of features){
  console.log(`Rendering ${feature} (${meta.tag})`);
  await writeFile(join(output,'examples',feature+'.json'),serializeDiagram(recordingProject(feature)));
  for(const [suffix,width,height] of [['landscape',1600,900],['square',1080,1080],['linkedin',1200,627]]){
   const svg=renderMedia(feature,mediaMeta,width,height);
   const result=new Resvg(svg,{font:{defaultFontFamily:'DejaVu Sans'}}).render();
   await writeFile(join(output,'media',`${feature}-${suffix}.png`),result.asPng());
   if(suffix==='landscape')await writeFile(join(output,'media',feature+'.svg'),svg);
  }
  if(!quick){
   console.log(`Recording live ${feature} interaction in Chromium`);
   manifest.recordings[feature]=await recorder.record(feature,recordingProject(feature),output);
  }
 }
 await writeFile(join(output,'alt-text.md'),'# Media descriptions\n\n'+features.map(key=>`## ${key}\n\n${featureCatalog[key].title}. ${featureCatalog[key].detail} The screen recording shows real JavaScript execution: an input changes from 2 to 3 to 5, and an imported double() function updates the connected output from 4 to 6 to 10. Additional interactions demonstrate the named feature. Editorial illustrations are separate static assets.\n`).join('\n'));
 await writeFile(join(output,'index.html'),renderGallery({heading,meta,features,catalog:featureCatalog,posts,quick}));
 if(!quick)manifest.gallery=await recorder.verifyGallery(output);
 const walk=async directory=>{for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await walk(path);else if(entry.name!=='manifest.json'){const bytes=await readFile(path);manifest.files.push({path:relative(output,path).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}};
 await walk(output);manifest.files.sort((a,b)=>a.path.localeCompare(b.path));
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile('outputs/latest.json',JSON.stringify({version:meta.version,commit:meta.commit,path:relative(resolve('outputs'),output)},null,2)+'\n');
 console.log(`Created ${relative(process.cwd(),output)} (${manifest.files.length} files)`);
}finally{await recorder?.close();await server.close();}

import { createServer } from 'vite';
import { Resvg } from '@resvg/resvg-js';
import gifenc from 'gifenc';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile, readdir, rm, mkdtemp } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { releaseVersion } from './version.mjs';
import { changesFor, socialPosts, featureCatalog } from './notes.mjs';
const { GIFEncoder, quantize, applyPalette }=gifenc;
const args=process.argv.slice(2),general=args.includes('--current'),quick=args.includes('--stills-only');
const meta=releaseVersion(process.env.RELEASE_SHA||'HEAD'),changes=changesFor(meta.commit);
const features=general?Object.keys(featureCatalog):[...new Set(['overview',...changes.features])];
const mediaMeta={...meta,...(!general?{summary:changes.subject,maintenance:changes.maintenance}:{})};
const output=resolve(general?'outputs/current-state':`outputs/releases/${meta.tag}`);
await mkdir(output,{recursive:true});await mkdir(join(output,'posts'),{recursive:true});await mkdir(join(output,'media'),{recursive:true});await mkdir(join(output,'examples'),{recursive:true});
if(!quick)execFileSync(process.env.FFMPEG_PATH||'ffmpeg',['-version'],{stdio:'ignore'});
const server=await createServer({server:{middlewareMode:true,ws:false,hmr:false},appType:'custom',logLevel:'error'});
const manifest={...meta,kind:general?'current-state':'release',language:'en',generatedAt:new Date().toISOString(),changes,features,mediaType:'Product illustrations generated with the actual Milver SVG renderer; animated particles illustrate connections, not simulated computation results.',posting:'Drafts only. Nothing has been posted to a social network.',files:[]};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
try{
 const {renderMedia,demonstration}=await server.ssrLoadModule('/scripts/releases/scenes.ts');
 const {serializeDiagram}=await server.ssrLoadModule('/src/model.ts');
 const posts=socialPosts(meta,{...changes,features}, {general});
 for(const [network,content] of Object.entries(posts))await writeFile(join(output,'posts',network+'.md'),content);
 const heading=general?'Milver — current product media':`Milver ${meta.tag}`;
 const release=`# ${heading}\n\nSource commit: [${meta.shortCommit}](https://github.com/davidgcorr/reactflow-recipes/commit/${meta.commit})\n\n${general?'General media for the capabilities in this version.':changes.subject}\n\n${features.map(key=>'- '+featureCatalog[key].title+': '+featureCatalog[key].detail).join('\n')}\n\n[Open Milver](${meta.site})\n\nSocial copy is in posts/. Images, looping GIFs and MP4 videos are in media/. Editable demonstration projects are in examples/. See manifest.json for source provenance, file sizes and SHA-256 checksums. Media illustrates current capabilities; the commit summary describes what changed.\n`;
 await writeFile(join(output,'release.md'),release);
 for(const feature of features){
  console.log(`Rendering ${feature} (${meta.tag})`);
  await writeFile(join(output,'examples',feature+'.json'),serializeDiagram(demonstration(feature)));
  for(const [suffix,width,height] of [['landscape',1600,900],['square',1080,1080],['linkedin',1200,627]]){
   const svg=renderMedia(feature,mediaMeta,width,height);
   const result=new Resvg(svg,{font:{defaultFontFamily:'DejaVu Sans'}}).render();
   await writeFile(join(output,'media',`${feature}-${suffix}.png`),result.asPng());
   if(suffix==='landscape')await writeFile(join(output,'media',feature+'.svg'),svg);
  }
  if(!quick){
   const frames=await mkdtemp(join(tmpdir(),'milver-release-'));
   try{
    const gif=GIFEncoder(),count=24,fps=6;
    for(let frame=0;frame<count;frame++){
     const phase=frame/count;
     const image=new Resvg(renderMedia(feature,mediaMeta,1280,720,phase),{font:{defaultFontFamily:'DejaVu Sans'}}).render();
     await writeFile(join(frames,`frame-${String(frame).padStart(3,'0')}.png`),image.asPng());
     const small=new Resvg(renderMedia(feature,mediaMeta,640,360,phase),{font:{defaultFontFamily:'DejaVu Sans'}}).render();
     const palette=quantize(small.pixels,256,{format:'rgb565'}),indexed=applyPalette(small.pixels,palette);
     gif.writeFrame(indexed,640,360,{palette,delay:Math.round(1000/fps),repeat:0});
    }
    gif.finish();await writeFile(join(output,'media',feature+'.gif'),gif.bytes());
    execFileSync(process.env.FFMPEG_PATH||'ffmpeg',['-y','-hide_banner','-loglevel','error','-framerate',String(fps),'-i',join(frames,'frame-%03d.png'),'-c:v','libx264','-preset','medium','-crf','20','-pix_fmt','yuv420p','-movflags','+faststart',join(output,'media',feature+'.mp4')],{stdio:'inherit'});
   }finally{await rm(frames,{recursive:true,force:true});}
  }
 }
 await writeFile(join(output,'alt-text.md'),'# Media descriptions\n\n'+features.map(key=>`## ${key}\n\n${featureCatalog[key].title}. ${featureCatalog[key].detail} A Milver diagram appears in a light canvas on a dark blue background. Animated markers illustrate connection flow; they are not numerical simulation results.\n`).join('\n'));
 const cards=features.map(key=>`<article><h2>${escape(featureCatalog[key].title)}</h2><p>${escape(featureCatalog[key].detail)}</p><a href="media/${key}-landscape.png"><img src="media/${key}-landscape.png" alt="${escape(featureCatalog[key].detail)}"></a><p><a href="media/${key}-square.png">Square PNG</a> · <a href="media/${key}-linkedin.png">LinkedIn PNG</a> · <a href="media/${key}.svg">SVG</a> · <a href="examples/${key}.json">Editable project</a></p>${quick?'':`<video controls muted loop playsinline poster="media/${key}-landscape.png" src="media/${key}.mp4"></video><p><a href="media/${key}.gif">Looping GIF</a> · <a href="media/${key}.mp4">MP4 video</a></p>`}</article>`).join('');
 await writeFile(join(output,'index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(heading)}</title><style>body{margin:0;background:#111827;color:#f8fafc;font:16px/1.6 system-ui}main{max-width:1100px;margin:auto;padding:40px 24px}a{color:#a5b4fc}nav{display:flex;gap:20px;flex-wrap:wrap}article{margin:36px 0;padding:24px;border:1px solid #334155;border-radius:16px}img,video{display:block;width:100%;height:auto;border-radius:12px;margin:18px 0}small{color:#cbd5e1}</style><main><h1>${escape(heading)}</h1><small>${escape(meta.tag+' · '+meta.shortCommit)} · Renderer-generated demonstrations</small><p>${escape(general?'General product media.':changes.subject)}</p><nav><a href="posts/x.md">X draft</a><a href="posts/reddit.md">Reddit draft</a><a href="posts/linkedin.md">LinkedIn draft</a><a href="release.md">Release notes</a><a href="manifest.json">Manifest</a><a href="alt-text.md">Alt text</a></nav>${cards}</main></html>`);
 const walk=async directory=>{for(const entry of await readdir(directory,{withFileTypes:true})){const path=join(directory,entry.name);if(entry.isDirectory())await walk(path);else if(entry.name!=='manifest.json'){const bytes=await readFile(path);manifest.files.push({path:relative(output,path).replaceAll('\\','/'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});}}};
 await walk(output);manifest.files.sort((a,b)=>a.path.localeCompare(b.path));
 await writeFile(join(output,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 await writeFile('outputs/latest.json',JSON.stringify({version:meta.version,commit:meta.commit,path:relative(resolve('outputs'),output)},null,2)+'\n');
 console.log(`Created ${relative(process.cwd(),output)} (${manifest.files.length} files)`);
}finally{await server.close();}

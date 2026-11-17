import { execFileSync } from 'node:child_process';
import { readFile, rm } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { releaseVersion } from './version.mjs';
const meta=releaseVersion(),includeCurrent=process.env.RELEASE_IS_LATEST==='true',repository=process.env.GITHUB_REPOSITORY||meta.repository;
const folder=resolve('outputs/releases',meta.tag),manifest=JSON.parse(await readFile(join(folder,'manifest.json'),'utf8'));
if(meta.sourceDirty || manifest.sourceDirty!==false)throw new Error('Refusing to publish outputs from a dirty working tree. Regenerate from the clean tagged commit.');
if(manifest.commit!==meta.commit||manifest.version!==meta.version)throw new Error('Output manifest does not match the release commit.');
// A slower older workflow must never replace a newer release as Latest.
const mainHead=execFileSync('gh',['api',`repos/${repository}/git/ref/heads/main`,'--jq','.object.sha'],{encoding:'utf8'}).trim();
const latest=includeCurrent&&mainHead===meta.commit;
const gh=args=>execFileSync('gh',[...args,'--repo',repository],{encoding:'utf8'});
// Refuse to overwrite any release tag which belongs to a different source commit.
let tag;
try { tag=JSON.parse(execFileSync('gh',['api',`repos/${repository}/git/ref/tags/${meta.tag}`],{encoding:'utf8',stdio:['ignore','pipe','pipe']})); }
catch(error){if(!String(error.stderr).includes('404'))throw error;}
if(tag){
 let object=tag.object;
 while(object.type==='tag')object=JSON.parse(execFileSync('gh',['api',`repos/${repository}/git/tags/${object.sha}`],{encoding:'utf8'})).object;
 if(object.type!=='commit'||object.sha!==meta.commit)throw new Error(`${meta.tag} already identifies another commit; refusing to move it.`);
}
execFileSync(process.execPath,['scripts/releases/verify.mjs',folder],{stdio:'inherit'});
const releaseZip=resolve('outputs',`milver-${meta.tag}-outputs.zip`);
await rm(releaseZip,{force:true});
execFileSync('zip',['-qr',releaseZip,'.'],{cwd:folder});
const files=[releaseZip];
if(includeCurrent){
 const current=resolve('outputs/current-state'),currentManifest=JSON.parse(await readFile(join(current,'manifest.json'),'utf8'));
 if(currentManifest.sourceDirty!==false || currentManifest.commit!==meta.commit)throw new Error('Current-state media belongs to another commit.');
 execFileSync(process.execPath,['scripts/releases/verify.mjs',current],{stdio:'inherit'});
 const currentZip=resolve('outputs',`milver-${meta.tag}-current-state.zip`);await rm(currentZip,{force:true});execFileSync('zip',['-qr',currentZip,'.'],{cwd:current});files.push(currentZip);
}
let exists=false;
try{gh(['release','view',meta.tag,'--json','tagName']);exists=true;}catch(error){if(!/not found|404/i.test(String(error.stderr)))throw error;}
if(exists)gh(['release','edit',meta.tag,'--title',`Milver ${meta.tag}`,'--notes-file',join(folder,'release.md'),`--latest=${latest}`]);
else gh(['release','create',meta.tag,'--target',meta.commit,'--title',`Milver ${meta.tag}`,'--notes-file',join(folder,'release.md'),`--latest=${latest}`]);
gh(['release','upload',meta.tag,...files,'--clobber']);
console.log(`${meta.releaseUrl}\n${files.join('\n')}`);

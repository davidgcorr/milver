import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { releaseVersion } from './version.mjs';
import { socialPosts, changesFor } from './notes.mjs';
test('versions increase for every main commit, remain stable on rerun and identify the exact SHA',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'milver-version-test-'));
 const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git('init','-b','main');git('config','user.name','Release Test');git('config','user.email','release@example.com');
  writeFileSync(join(cwd,'package.json'),'{"version":"1.0.0"}');git('add','package.json');git('commit','-m','First');
  const first=releaseVersion('HEAD',cwd);assert.equal(first.version,'1.0.1');assert.deepEqual(releaseVersion('HEAD',cwd),first);
  git('commit','--allow-empty','-m','Second');const second=releaseVersion('HEAD',cwd);assert.equal(second.version,'1.0.2');assert.notEqual(second.commit,first.commit);
  assert.equal(releaseVersion(first.commit,cwd).version,'1.0.1');
 }finally{rmSync(cwd,{recursive:true,force:true});}
});
test('social drafts use platform-specific product hooks, stay within X limits, and keep release metadata out',()=>{
 const meta={tag:'v9.8.765',shortCommit:'abc1234',site:'https://milver.davidgc.com/',releaseUrl:'https://example.com/release'};
 for(const feature of ['overview','arrows','shapes','modules','backups']){
  const posts=socialPosts(meta,{subject:'chore: internal plumbing',features:['overview',feature],maintenance:true});
  assert.ok(posts.x.replace(/https?:\/\/\S+/g,'x'.repeat(23)).length<=280);
  assert.ok(posts.reddit.startsWith('Title: '));assert.match(posts.reddit,/I am the developer/);
  assert.ok(posts.linkedin.length>posts.x.length);
  for(const text of Object.values(posts)){assert.doesNotMatch(text,/v9\.8\.765|abc1234|internal plumbing|maintenance update/i);assert.ok(text.includes(meta.site));}
 }
 const modules=socialPosts(meta,{features:['overview','modules']});assert.match(modules.x,/JavaScript module/);assert.match(modules.reddit,/double\(\)/);
 const general=socialPosts(meta,{features:['modules']},{general:true});assert.match(general.x,/diagram actually ran/);
});
test('feature selection and release metadata can be generated from the current commit',()=>{
 const meta=releaseVersion();assert.match(meta.version,/^\d+\.\d+\.\d+$/);assert.match(meta.commit,/^[a-f0-9]{40}$/);
 const changes=changesFor(meta.commit);assert.ok(changes.features.length>0);assert.ok(changes.subject.length>0);assert.ok(changes.files.length>0);
});
test('multi-commit pushes receive separate release entries and only the final one is latest',()=>{
 const cwd=mkdtempSync(join(tmpdir(),'milver-plan-test-'));
 const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 try{
  git('init','-b','main');git('config','user.name','Release Test');git('config','user.email','release@example.com');
  execFileSync(process.execPath,['-e',"require('fs').mkdirSync('scripts/releases',{recursive:true});require('fs').writeFileSync('scripts/releases/generate.mjs','// generator');"],{cwd});
  git('add','.');git('commit','-m','Bootstrap');const before=git('rev-parse','HEAD');
  git('commit','--allow-empty','-m','Feature one');const first=git('rev-parse','HEAD');
  git('commit','--allow-empty','-m','Feature two');const second=git('rev-parse','HEAD');
  const plan=JSON.parse(execFileSync(process.execPath,[new URL('./plan.mjs',import.meta.url).pathname],{cwd,encoding:'utf8',env:{...process.env,BEFORE_SHA:before,AFTER_SHA:second}}));
  assert.deepEqual(plan.include,[{sha:first,latest:false},{sha:second,latest:true}]);
 }finally{rmSync(cwd,{recursive:true,force:true});}
});

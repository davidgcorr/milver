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
test('social copy stays grounded in commit notes, distinguishes maintenance, and fits X',()=>{
 const meta={tag:'v1.0.30',shortCommit:'abc1234',site:'https://milver.davidgc.com/',releaseUrl:'https://github.com/davidgcorr/reactflow-recipes/releases/tag/v1.0.30'};
 const changes={subject:'docs: improve hosting guide',features:['overview','arrows','shapes','modules','backups'],maintenance:true};
 const posts=socialPosts(meta,changes);
 assert.ok(posts.x.replace(/https?:\/\/\S+/g,'x'.repeat(23)).length<=280);
 assert.match(posts.x,/Maintenance/);assert.match(posts.reddit,/docs: improve hosting guide/);assert.match(posts.linkedin,/abc1234/);
 assert.doesNotMatch(posts.x,/new feature/i);
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

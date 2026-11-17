import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export function git(args, cwd=process.cwd()) { return execFileSync('git', args, {cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim(); }
export function releaseVersion(ref='HEAD',cwd=process.cwd()) {
  if(git(['rev-parse','--is-shallow-repository'],cwd)==='true')throw new Error('Release versioning requires full Git history (checkout fetch-depth: 0).');
  const sha=git(['rev-parse','--verify',`${ref}^{commit}`],cwd);
  const count=Number(git(['rev-list','--first-parent','--count',sha],cwd));
  const pkg=JSON.parse(readFileSync(resolve(cwd,'package.json'),'utf8'));
  const [major,minor,patch]=pkg.version.split('.').map(Number);
  const version=`${major}.${minor}.${patch+count}`;
  return {schema:1,sourceDirty:git(['status','--porcelain'],cwd).length>0,version,tag:`v${version}`,commit:sha,shortCommit:sha.slice(0,7),mainCommitNumber:count,date:git(['show','-s','--format=%cI',sha],cwd),site:'https://milver.davidgc.com/',releaseUrl:`https://github.com/davidgcorr/reactflow-recipes/releases/tag/v${version}`};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const metadata=releaseVersion(process.env.RELEASE_SHA||'HEAD');
  mkdirSync('public',{recursive:true});writeFileSync('public/version.json',JSON.stringify(metadata,null,2)+'\n');
  console.log(`${metadata.tag} · ${metadata.shortCommit}`);
}

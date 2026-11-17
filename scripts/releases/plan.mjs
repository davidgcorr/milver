import { git } from './version.mjs';
const head=process.env.AFTER_SHA||git(['rev-parse','HEAD']),before=process.env.BEFORE_SHA;
const commits=before&&!/^0+$/.test(before)?git(['rev-list','--first-parent','--reverse',`${before}..${head}`]).split('\n').filter(Boolean):[head];
// Bootstrap only once the generator exists; later multi-commit pushes get one bundle per main commit.
const include=commits.filter(sha=>{try{git(['cat-file','-e',`${sha}:scripts/releases/generate.mjs`]);return true;}catch{return false;}}).map(sha=>({sha,latest:sha===head}));
if(!include.length)include.push({sha:head,latest:true});
console.log(JSON.stringify({include}));

import { readFile } from 'node:fs/promises';
import { resolve,join,sep } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const directory=resolve(process.argv[2]||'outputs/current-state');
const manifest=JSON.parse(await readFile(join(directory,'manifest.json'),'utf8'));
if(manifest.schema!==1||!manifest.version||!manifest.commit||!manifest.files?.length)throw new Error('Invalid output manifest.');
for(const file of manifest.files){
 const path=resolve(directory,file.path);if(!path.startsWith(directory+sep))throw new Error('Invalid output path.');
 const bytes=await readFile(path),hash=createHash('sha256').update(bytes).digest('hex');
 if(bytes.length!==file.bytes||hash!==file.sha256)throw new Error(`Checksum mismatch: ${file.path}`);
 if(path.endsWith('.png')){
  if(bytes.subarray(1,4).toString()!=='PNG')throw new Error('Invalid PNG');
  const expected=file.path.includes('-screen')?[1280,720]:file.path.includes('-square')?[1080,1080]:file.path.includes('-linkedin')?[1200,627]:[1600,900];
  if(bytes.readUInt32BE(16)!==expected[0]||bytes.readUInt32BE(20)!==expected[1])throw new Error('Incorrect image dimensions');
 }
 if(path.endsWith('.gif')&&(!bytes.subarray(0,3).equals(Buffer.from('GIF'))||bytes.readUInt16LE(6)!==640||bytes.readUInt16LE(8)!==360))throw new Error('Invalid GIF');
 if(path.endsWith('.mp4')){
  const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',path],{encoding:'utf8'})),video=probe.streams.find(s=>s.codec_type==='video');
  if(video?.codec_name!=='h264'||video.width!==1280||video.height!==720||Number(probe.format.duration)<3||Number(probe.format.duration)>45||Math.abs(Number(video.avg_frame_rate.split('/')[0])/Number(video.avg_frame_rate.split('/')[1])-30)>0.1)throw new Error('Invalid MP4');
 }
}
for(const feature of manifest.features){
 const recording=manifest.recordings?.[feature];
 if(!recording||recording.capture!=='chromium-screen-recording'||JSON.stringify(recording.runtimeChecks)!==JSON.stringify([{input:2,output:4},{input:3,output:6},{input:5,output:10}]))throw new Error('Missing verified live browser recording: '+feature);
 for(const path of [recording.raw,recording.screenshot,`media/${feature}.mp4`,`media/${feature}.gif`])if(!manifest.files.some(file=>file.path===path))throw new Error('Missing recorded media: '+path);
}
if(!manifest.gallery?.copyDraft||!manifest.gallery.mobileLayout)throw new Error('Gallery checks did not pass.');
console.log(`Verified ${manifest.files.length} files for ${manifest.version} (${manifest.commit.slice(0,7)})`);

import assert from 'node:assert/strict';
import {createServer} from 'vite';
import {chromium} from 'playwright';
import {mkdir,mkdtemp,readFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
const output=process.env.MILVER_CAPTURE_QA_DIR?resolve(process.env.MILVER_CAPTURE_QA_DIR):await mkdtemp(join(tmpdir(),'milver-capture-'));
await mkdir(output,{recursive:true});
const server=await createServer({server:{host:'127.0.0.1',port:0,ws:false,hmr:false},appType:'spa',logLevel:'error'});
let browser;
try{
 await server.listen();
 const {recordingProject}=await server.ssrLoadModule('/scripts/releases/recording-project.ts');
 browser=await chromium.launch({channel:'chromium',headless:true,args:['--auto-select-tab-capture-source-by-title=Milver export QA','--enable-usermedia-screen-capturing','--allow-http-screen-capture']});
 const context=await browser.newContext({viewport:{width:1280,height:800},acceptDownloads:true});
 await context.addInitScript(project=>{
  if(window.top!==window)return;
  localStorage.setItem('milver.diagram.v1',JSON.stringify(project));localStorage.setItem('milver.workspace.v1',JSON.stringify({library:true,inspector:false,minimap:false,snap:false}));
  window.captureTracks=[];const original=navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getDisplayMedia=async options=>{const stream=await original(options);window.captureTracks.push(...stream.getTracks());return stream;};
 },recordingProject('modules'));
 const page=await context.newPage();page.setDefaultTimeout(20000);
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/`,{waitUntil:'networkidle'});await page.evaluate(()=>document.title='Milver export QA');
 const result=page.frameLocator('iframe[data-milver-block-id="output"]').getByLabel('Live result');
 const resultIs=async value=>{await page.waitForFunction(value=>document.querySelector('iframe[data-milver-block-id="output"]')!==null,value);await result.filter({hasText:new RegExp(`^${value}$`)}).waitFor();};
 await resultIs(4);
 const groups=await page.locator('#library-panel-blocks .library-category').evaluateAll(sections=>Object.fromEntries(sections.map(section=>[section.querySelector('.category-toggle span').textContent,[...section.querySelectorAll('.palette-tile>span:last-child')].map(label=>label.textContent)])));
 assert.deepEqual(groups['Data types'],['Number','Boolean','String','Vector','Matrix','Tensor']);assert.deepEqual(groups.Controls,['Slider','Selector','Button']);assert.deepEqual(groups['Data sources'],['Text','CSV']);
 assert.equal(await page.getByRole('button',{name:'Root canvas',exact:true}).count(),0);
 await page.getByRole('button',{name:'Pan (H)',exact:true}).click();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();await page.waitForTimeout(250);
 assert.equal(await page.getByRole('button',{name:'Pan (H)',exact:true}).getAttribute('aria-pressed'),'true','Programmatic zoom consumed the pan tool');
 const before=await page.locator('.react-flow__viewport').getAttribute('style');
 await page.mouse.move(800,600);await page.mouse.down();await page.mouse.move(870,640,{steps:8});await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('[aria-label="Select (V)"]').getAttribute('aria-pressed')==='true');
 assert.notEqual(await page.locator('.react-flow__viewport').getAttribute('style'),before,'The pan did not move the canvas');
 await page.evaluate(()=>window.milverMcp.call('milver_workspace',{patch:{viewport:{x:25,y:0,zoom:1}}}));

 await page.getByRole('button',{name:'Export diagram',exact:true}).click();
 const tracksStopped=async()=>assert.equal(await page.evaluate(()=>window.captureTracks.every(track=>track.readyState==='ended')),true,'Capture leaked a live sharing track');
 const save=async(name,action,during)=>{
  const pending=page.waitForEvent('download',{timeout:30000});await action();
  if(during)await during();
  const download=await pending;const path=join(output,name+download.suggestedFilename().slice(download.suggestedFilename().lastIndexOf('.')));await download.saveAs(path);
  await page.waitForFunction(()=>!document.documentElement.classList.contains('live-capture'));
  await tracksStopped();return path;
 };
 const png=await save('screenshot',()=>page.getByRole('button',{name:'Capture screenshot',exact:true}).click());
 const bytes=await readFile(png);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.ok(bytes.length>10000);
 await page.getByRole('button',{name:'Video',exact:true}).click();await page.getByRole('combobox',{name:'Recording duration'}).click();await page.getByRole('option',{name:'3 seconds',exact:true}).click();
 const slider=page.frameLocator('iframe[data-milver-block-id="signal"]').getByRole('slider',{name:'Input signal'});
 const change=async expected=>{await page.waitForFunction(()=>document.documentElement.classList.contains('live-capture'));await page.waitForTimeout(1100);await page.locator('.react-flow__node[data-id="signal"]').dblclick({position:{x:50,y:50}});await slider.press('ArrowRight');await resultIs(expected);};
 const video=await save('recording',()=>page.getByRole('button',{name:'Start recording',exact:true}).click(),()=>change(6));
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-show_packets','-of','json',video],{encoding:'utf8'}));assert.ok(probe.streams.some(stream=>stream.codec_type==='video'));const duration=Number(probe.format.duration)||Math.max(...probe.packets.map(packet=>Number(packet.pts_time)+Number(packet.duration_time||0)));assert.ok(duration>=2.5);
 await page.getByRole('button',{name:'GIF',exact:true}).click();
 const gif=await save('animation',()=>page.getByRole('button',{name:'Start recording',exact:true}).click(),()=>change(8));
 const gifBytes=await readFile(gif);assert.equal(gifBytes.subarray(0,3).toString(),'GIF');assert.equal(gifBytes.readUInt16LE(6),800);
 const frames=JSON.parse(execFileSync('ffprobe',['-v','error','-count_frames','-show_streams','-of','json',gif],{encoding:'utf8'}));assert.ok(Number(frames.streams[0].nb_read_frames)>1);
 await page.getByRole('button',{name:'Start recording',exact:true}).click();await page.waitForFunction(()=>document.documentElement.classList.contains('live-capture'));await page.waitForTimeout(700);await page.keyboard.press('Escape');
 await page.getByRole('alert').filter({hasText:'Capture cancelled'}).waitFor();await tracksStopped();assert.equal(await page.locator('html.live-capture').count(),0);
 assert.ok(await page.evaluate(()=>window.captureTracks.length)>=4);
 assert.deepEqual(errors,[]);
 if(process.env.MILVER_CAPTURE_QA_DIR){await page.getByRole('button',{name:'Screenshot',exact:true}).click();await page.waitForTimeout(250);await page.screenshot({path:join(output,'export-dialog.png')});}
 await page.setViewportSize({width:375,height:812});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'Export dialog overflows on mobile');
 await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).first().click();
 await page.setViewportSize({width:1280,height:800});
 await page.locator('#library-panel-blocks .palette-tile').filter({hasText:'Parent block'}).click();
 await page.getByRole('button',{name:'Root canvas',exact:true}).waitFor();
 const controls=page.getByRole('group',{name:'Simulation controls',exact:true});await controls.waitFor();
 assert.equal(await controls.locator('..').getAttribute('aria-label'),'Canvas tools');
 for(const [width,height] of [[1280,800],[768,900],[375,812]]){
  await page.setViewportSize({width,height});await page.waitForTimeout(200);
  const box=await controls.boundingBox();assert.ok(box&&box.x>=0&&box.x+box.width<=width+1&&box.y>height/2&&box.y+box.height<=height,'Simulation controls must stay visible in the lower toolbar');
  const zoom=await page.locator('.zoom-island').boundingBox();
  assert.ok(box.y+box.height<=zoom.y||box.x+box.width<=zoom.x||box.x>=zoom.x+zoom.width,'Simulation controls overlap zoom controls');
  if(process.env.MILVER_CAPTURE_QA_DIR){console.log('toolbar',width,box,await page.evaluate(()=>({innerHeight,scrollHeight:document.documentElement.scrollHeight,mains:document.querySelectorAll('main.milver-workspace').length})));await page.screenshot({path:join(output,`toolbar-${width}.png`)});}
 }
 await page.setViewportSize({width:1280,height:800});
 await page.locator('.parent-block .enter-block').click();
 await page.getByRole('button',{name:'Root canvas',exact:true}).click();
 await page.keyboard.press('Delete');
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Root canvas"]'));

 assert.deepEqual(errors,[]);
 console.log('Verified native PNG, video and GIF capture; live JS updates; cancellation cleanup; library sections; one-shot pan; conditional hierarchy; and responsive bottom simulation controls.');
 console.log(output);
}finally{await browser?.close();await server.close();if(!process.env.MILVER_CAPTURE_QA_DIR)await rm(output,{recursive:true,force:true});}

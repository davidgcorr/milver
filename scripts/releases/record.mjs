import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdir,rm,mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function resultIs(locator,value){
 const limit=Date.now()+30000;
 while(Date.now()<limit){if((await locator.textContent({timeout:1500}).catch(()=>''))?.trim()===String(value))return;await pause(150);}
 throw new Error(`Live JS result did not become ${value}. Refusing to record a non-working demo.`);
}
async function tool(page,name,args){
 const response=await page.evaluate(async({name,args})=>window.milverMcp.call('milver_'+name,args),{name,args});
 if(response?.isError)throw new Error(`Demo setup failed (${name}): ${JSON.stringify(response)}`);
 return response;
}
async function pointOnPath(locator){return locator.evaluate(path=>{const p=path.getPointAtLength(path.getTotalLength()/2),m=path.getScreenCTM();return {x:m.a*p.x+m.c*p.y+m.e,y:m.b*p.x+m.d*p.y+m.f};});}
export async function startRecorder(baseUrl){
 const browser=await chromium.launch({headless:true});
 return {close:()=>browser.close(),async verifyGallery(output){
  const context=await browser.newContext({viewport:{width:1600,height:900},colorScheme:'light'}),page=await context.newPage();
  try{
   await page.goto(pathToFileURL(join(output,'index.html')).href);
   await page.getByRole('heading',{name:'Written for the platform'}).waitFor();
   if(await page.locator('[data-slot="card"]').count()<4)throw new Error('Gallery is missing shadcn cards');
   const neutral=await page.evaluate(()=>{const c=getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);return c[0]===c[1]&&c[1]===c[2];});
   if(!neutral)throw new Error('Gallery background must be neutral grayscale');
   await page.getByRole('button',{name:'Copy draft',exact:true}).first().click();
   await page.getByRole('button',{name:/Copied|Selected — copy text/}).waitFor();
   await page.evaluate(()=>{getSelection()?.removeAllRanges();document.querySelector('[data-copy]').textContent='Copy draft';if(document.activeElement instanceof HTMLElement)document.activeElement.blur();});
   await page.screenshot({path:join(output,'gallery-preview.png')});
   await page.setViewportSize({width:375,height:900});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   if(overflow)throw new Error('Gallery overflows its mobile viewport');
   return {components:'shadcn Card, Button, Badge',palette:'neutral grayscale',copyDraft:true,mobileLayout:true};
  }finally{await context.close();}
 },async record(feature,project,output){
  const temp=await mkdtemp(join(tmpdir(),'milver-screen-')),media=join(output,'media');await mkdir(media,{recursive:true});
  const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,colorScheme:'light',recordVideo:{dir:temp,size:{width:1280,height:720}},acceptDownloads:true});
  await context.addInitScript(({project})=>{if(window.top!==window)return;localStorage.setItem('milver.diagram.v1',JSON.stringify(project));localStorage.setItem('milver.workspace.v1',JSON.stringify({library:false,inspector:false,snap:false,minimap:false}));},{project});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  let start;
  try{
   await page.goto(baseUrl,{waitUntil:'networkidle',timeout:60000});
   await page.waitForFunction(()=>!!window.milverMcp);
   const result=page.frameLocator('iframe[data-milver-block-id="output"]').locator('[aria-label="Live result"]');
   await resultIs(result,4);
   // Enter the real block interaction mode before recording the input sequence.
   await page.locator('.react-flow__node[data-id="signal"]').dblclick({position:{x:50,y:50}});
   await tool(page,'workspace',{patch:{library:false,inspector:false}});
   const input=page.frameLocator('iframe[data-milver-block-id="signal"]').getByRole('slider',{name:'Input signal'});
   await input.focus();await resultIs(result,4);
   start=Date.now();await pause(800);
   const checks=[{input:2,output:4}];
   await input.press('ArrowRight');await resultIs(result,6);checks.push({input:3,output:6});await pause(900);
   await input.press('ArrowRight');await input.press('ArrowRight');await resultIs(result,10);checks.push({input:5,output:10});await pause(1000);
   await page.screenshot({path:join(media,`${feature}-screen.png`),animations:'allow'});
   let interaction='Changed the real slider and observed helpers.double() updating the connected output.';
   if(feature==='excalidraw'){
    await page.getByRole('button',{name:'Excalidraw mode',exact:true}).click();
    if(await page.locator('.block-type-trail,.block-type-expand').count())throw new Error('Sketch mode still shows type headers');
    if(!(await page.locator('.rough-block-outline').count()))throw new Error('Sketch mode has no rough outlines');
    if(await page.locator('.react-flow__handle .rough-port-outline').count()!==await page.locator('.react-flow__handle').count())throw new Error('Sketch ports are missing rough circles');
    await tool(page,'workspace',{patch:{library:true,libraryTab:'blocks',inspector:false}});
    const glyphs=page.locator('#library-panel-blocks .palette-glyph');
    await glyphs.first().waitFor({state:'visible'});
    if(await glyphs.count()!==await glyphs.locator('.rough-block-outline').count())throw new Error('Library miniatures are missing rough outlines');
    interaction+=' Switched the live diagram and library miniatures into Excalidraw mode with rough circular ports.';await pause(1700);
   }else if(feature==='editing'){
    await page.locator('.react-flow__node[data-id="editable-text"] .block-body').dblclick();
    await page.getByRole('textbox',{name:'Edit String value',exact:true}).fill('Edited on the canvas');
    await page.getByRole('textbox',{name:'Edit String value',exact:true}).press('Enter');
    await page.frameLocator('iframe[data-milver-block-id="editable-text"]').getByText('Edited on the canvas',{exact:true}).waitFor();
    interaction+=' Edited a String directly on the canvas and verified its real renderer updated.';await pause(1700);
   }else if(feature==='arrows'){
    const edge=page.locator('.react-flow__edge[data-id="signal-logic"] .react-flow__edge-path');const p=await pointOnPath(edge);await page.mouse.click(p.x,p.y);
    await page.getByRole('button',{name:'Add curve point 1',exact:true}).click();
    const handle=page.locator('.route-point').first();const box=await handle.boundingBox();if(!box)throw new Error('Curve point is not visible');
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2,box.y-55,{steps:18});await page.mouse.up();
    interaction+=' Added and dragged a Bézier waypoint through the actual canvas controls.';await pause(1300);
   }else if(feature==='shapes'){
    await page.locator('.react-flow__node[data-id="logic"] .block-footer').click();
    await page.getByRole('tab',{name:'Render',exact:true}).click();
    await page.getByRole('tabpanel',{name:'Render',exact:true}).getByRole('button',{name:'Appearance',exact:true}).click();
    await page.getByLabel('Block shape',{exact:true}).selectOption('bezier');
    const anchor=page.getByRole('button',{name:'Shape anchor 1',exact:true});await anchor.focus();await anchor.press('ArrowDown');await anchor.press('ArrowDown');
    interaction+=' Changed the block to a Bézier outline and moved an anchor in the real shape editor.';await pause(1700);
   }else if(feature==='modules'){
    await tool(page,'workspace',{patch:{library:true,libraryTab:'libraries',inspector:false}});
    await page.locator('.library-entry summary').filter({hasText:'helpers'}).click();
    await page.getByLabel('Source for helpers',{exact:true}).first().waitFor({state:'visible'});
    await page.getByLabel('Source for helpers',{exact:true}).first().scrollIntoViewIfNeeded();
    interaction+=' Opened the actual imported helpers.js source in Project Libraries.';await pause(2000);
   }else if(feature==='backups'){
    await page.getByRole('button',{name:'JSON editor',exact:true}).click();
    const json=page.getByRole('textbox',{name:'Diagram JSON',exact:true});await json.waitFor({state:'visible'});
    if(!(await json.inputValue()).includes('export function double'))throw new Error('JSON backup is missing the shared module source');
    interaction+=' Opened the complete project JSON and verified the embedded ES module source.';await pause(2000);
   }else{
    await pause(1500);
   }
   await page.screenshot({path:join(media,`${feature}-screen.png`),animations:'allow'});
   const captureSeconds=(Date.now()-start)/1000;const video=page.video();await context.close();
   const raw=join(media,`${feature}-browser.webm`);await video.saveAs(raw);
   const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_format','-of','json',raw],{encoding:'utf8'}));
   const rawSeconds=Number(probe.format.duration),skip=Math.max(0,rawSeconds-captureSeconds);
   const mp4=join(media,`${feature}.mp4`),gif=join(media,`${feature}.gif`),ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
   execFileSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-ss',String(skip),'-i',raw,'-t',String(captureSeconds),'-vf','fps=30,scale=1280:720:flags=lanczos','-c:v','libx264','-preset','medium','-crf','19','-pix_fmt','yuv420p','-an','-movflags','+faststart',mp4],{stdio:'inherit'});
   execFileSync(ffmpeg,['-y','-hide_banner','-loglevel','error','-i',mp4,'-filter_complex','fps=10,scale=640:360:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer','-loop','0',gif],{stdio:'inherit'});
   if(errors.length)throw new Error(`Browser errors in recording: ${errors.join('; ')}`);
   return {capture:'chromium-screen-recording',viewport:{width:1280,height:720},fps:30,durationSeconds:captureSeconds,raw:`media/${feature}-browser.webm`,screenshot:`media/${feature}-screen.png`,runtimeChecks:checks,interaction};
  }catch(error){await page.screenshot({path:join(tmpdir(),`milver-record-${feature}-failure.png`)}).catch(()=>{});await context.close().catch(()=>{});throw error;}
  finally{await rm(temp,{recursive:true,force:true});}
 }};
}

export type CaptureFormat='png'|'video'|'gif';
export type CaptureResult={blob:Blob;extension:'png'|'gif'|'mp4'|'webm'};
export const videoMimeType=(supported:(type:string)=>boolean)=>['video/mp4;codecs=avc1.42E01E','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm'].find(supported);
const cancelled=()=>new DOMException('Capture cancelled.','AbortError');
function wait(ms:number,signal:AbortSignal){
  return new Promise<void>((resolve,reject)=>{
    if(signal.aborted){reject(cancelled());return;}
    const abort=()=>{clearTimeout(timer);reject(cancelled());};
    const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);
    signal.addEventListener('abort',abort,{once:true});
  });
}
async function firstFrame(video:HTMLVideoElement,signal:AbortSignal){
  const deadline=performance.now()+10000;
  while(video.readyState<2||!video.videoWidth){if(performance.now()>deadline)throw new Error('No video frames received. Choose this tab and try again.');await wait(50,signal);}
  if(video.requestVideoFrameCallback){
    await new Promise<void>((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);};
      const frame=video.requestVideoFrameCallback(()=>{cleanup();resolve();});
      const abort=()=>{cleanup();video.cancelVideoFrameCallback(frame);reject(cancelled());};
      const timer=setTimeout(()=>{cleanup();video.cancelVideoFrameCallback(frame);resolve();},500);
      signal.addEventListener('abort',abort,{once:true});
    });
  }
}
async function recordVideo(stream:MediaStream,seconds:number,signal:AbortSignal):Promise<CaptureResult>{
  if(typeof MediaRecorder==='undefined')throw new Error('Video recording is unavailable in this browser. Try PNG or GIF.');
  const mimeType=videoMimeType(type=>MediaRecorder.isTypeSupported(type));
  const recorder=new MediaRecorder(stream,mimeType?{mimeType}:{}),chunks:Blob[]=[];
  await new Promise<void>((resolve,reject)=>{
    const stop=()=>{if(recorder.state!=='inactive')recorder.stop();};
    const cleanup=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);stream.getVideoTracks()[0].removeEventListener('ended',stop);};
    const abort=()=>{cleanup();stop();reject(cancelled());};
    const timer=setTimeout(stop,seconds*1000);
    recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
    recorder.onstop=()=>{cleanup();resolve();};
    recorder.onerror=()=>{cleanup();reject(new Error('The browser could not record this tab.'));};
    signal.addEventListener('abort',abort,{once:true});stream.getVideoTracks()[0].addEventListener('ended',stop,{once:true});
    if(signal.aborted){abort();return;}
    try{recorder.start(250);}catch(error){cleanup();reject(error);}
  });
  if(signal.aborted)throw cancelled();
  const type=recorder.mimeType||chunks[0]?.type||'video/webm',blob=new Blob(chunks,{type});
  if(!blob.size)throw new Error('No recording was captured.');
  return {blob,extension:type.includes('mp4')?'mp4':'webm'};
}
export async function captureTab(format:CaptureFormat,options:{width:number;seconds:number;signal:AbortSignal;ready:()=>void|Promise<void>;progress?:(percent:number)=>void}):Promise<CaptureResult>{
  if(!navigator.mediaDevices?.getDisplayMedia)throw new Error('Tab capture is unavailable here. Use a desktop browser with screen sharing, or export HTML.');
  // This call must stay in the user's click handler, before any await.
  const stream=await navigator.mediaDevices.getDisplayMedia({video:{displaySurface:'browser',frameRate:30,width:{ideal:options.width}},audio:false,preferCurrentTab:true,selfBrowserSurface:'include',monitorTypeSurfaces:'exclude'} as DisplayMediaStreamOptions);
  const video=document.createElement('video');video.muted=true;video.playsInline=true;video.srcObject=stream;
  const track=stream.getVideoTracks()[0],ended=()=>track.readyState==='ended';
  try{
    if(options.signal.aborted)throw cancelled();
    if(track.getSettings().displaySurface&&track.getSettings().displaySurface!=='browser')throw new Error('Choose this browser tab, rather than a window or entire screen.');
    await options.ready();
    await video.play();await wait(450,options.signal);await firstFrame(video,options.signal);
    if(ended())throw new DOMException('Sharing stopped before capture started.','AbortError');
    if(format==='video')return await recordVideo(stream,Math.max(1,Math.min(30,options.seconds)),options.signal);
    const canvas=document.createElement('canvas'),width=Math.min(format==='gif'?800:4096,options.width,video.videoWidth);
    canvas.width=Math.max(1,width);canvas.height=Math.max(1,Math.round(width*video.videoHeight/video.videoWidth));
    const context=canvas.getContext('2d',{willReadFrequently:format==='gif'});if(!context)throw new Error('Could not create the capture image.');
    if(format==='png'){
      context.drawImage(video,0,0,canvas.width,canvas.height);
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not encode PNG.')),'image/png'));
      return {blob,extension:'png'};
    }
    const {GIFEncoder,quantize,applyPalette}=await import('gifenc'),encoder=GIFEncoder();
    const start=performance.now(),duration=Math.max(1,Math.min(10,options.seconds))*1000;let previous=start,frames=0;
    do{
      if(options.signal.aborted)throw cancelled();
      if(ended())break;
      const now=performance.now();context.drawImage(video,0,0,canvas.width,canvas.height);
      const rgba=context.getImageData(0,0,canvas.width,canvas.height).data,palette=quantize(rgba,256);
      encoder.writeFrame(applyPalette(rgba,palette),canvas.width,canvas.height,{palette,delay:Math.max(125,Math.round(now-previous)),repeat:0,dispose:1});previous=now;frames++;
      options.progress?.(Math.min(100,Math.round((performance.now()-start)/duration*100)));
      if(ended())break;
      await wait(125,options.signal);
    }while(performance.now()-start<duration);
    if(!frames)throw new Error('Sharing stopped before any GIF frames were captured.');
    encoder.finish();return {blob:new Blob([new Uint8Array(encoder.bytes())],{type:'image/gif'}),extension:'gif'};
  }finally{stream.getTracks().forEach(track=>track.stop());video.pause();video.srcObject=null;}
}

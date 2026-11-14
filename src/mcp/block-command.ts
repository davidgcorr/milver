export async function blockCommand(id:string,command:Record<string,unknown>,signal?:AbortSignal):Promise<unknown>{
  signal?.throwIfAborted();
  const deadline=Date.now()+10000;
  let frame:HTMLIFrameElement|undefined;
  while(!frame){signal?.throwIfAborted();frame=[...document.querySelectorAll<HTMLIFrameElement>('iframe[data-milver-block-id]')].find(frame=>frame.dataset.milverBlockId===id&&frame.dataset.milverReady==='true');if(Date.now()>deadline)throw new Error('Block is not ready. Open its canvas and wait for its renderer.');if(!frame)await new Promise(resolve=>setTimeout(resolve,25));}
  const target=frame.contentWindow;if(!target)throw new Error('Block frame is unavailable.');
  return new Promise((resolve,reject)=>{
    const requestId=crypto.randomUUID();let timer:ReturnType<typeof setTimeout>;
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('message',receive);signal?.removeEventListener('abort',abort);};
    const abort=()=>{cleanup();reject(new Error('Block command cancelled.'));};
    const receive=(event:MessageEvent)=>{if(event.source!==target||event.data?.type!=='mask-command-result'||event.data.requestId!==requestId)return;cleanup();if(event.data.error)reject(new Error(event.data.error));else resolve(event.data.result);};
    window.addEventListener('message',receive);signal?.addEventListener('abort',abort,{once:true});timer=setTimeout(()=>{cleanup();reject(new Error('Block command timed out.'));},10000);
    if(signal?.aborted){abort();return;}
    try{target.postMessage({type:'mask-command',requestId,...command},'*');}catch(error){cleanup();reject(error);}
  });
}

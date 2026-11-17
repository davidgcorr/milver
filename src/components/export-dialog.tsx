import { useEffect, useMemo, useRef, useState } from 'react';
import { Braces, Check, Code2, Copy, Download, FileImage, Film, Image, LoaderCircle, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Field } from './editor-ui';
import { buildScene, collectPages, defaultExportOptions, exportFilename, sceneSvg, type ExportFormat } from '@/export/scene';
import { createExport, downloadBlob } from '@/export/download';
import { captureTab, type CaptureFormat } from '@/export/capture';
import type { Diagram } from '@/model';

type Format=ExportFormat|'video';
const formats=[
  {id:'png',name:'Screenshot',icon:Image,description:'PNG of the running canvas, including live JavaScript blocks.'},
  {id:'video',name:'Video',icon:Video,description:'Record the running canvas and your interactions. MP4 or WebM, depending on your browser.'},
  {id:'gif',name:'GIF',icon:Film,description:'A looping recording of the actual running canvas.'},
  {id:'svg',name:'SVG diagram',icon:FileImage,description:'Editable vector structure. Live block content is represented by labels.'},
  {id:'html',name:'HTML',icon:Code2,description:'Interactive page with JavaScript renderers and nested canvases.'},
  {id:'json',name:'JSON',icon:Braces,description:'Complete editable project backup, including code and libraries.'},
] as const;
export function ExportDialog({open,onOpenChange,diagram,path,notify}:{open:boolean;onOpenChange:(open:boolean)=>void;diagram:Diagram;path:string[];notify:(message:string)=>void}){
  const [format,setFormat]=useState<Format>('png'),[options,setOptions]=useState(defaultExportOptions),[seconds,setSeconds]=useState(5);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[preview,setPreview]=useState('');
  const [download,setDownload]=useState<{blob:Blob;filename:string;type:Format}|null>(null);
  const abort=useRef<AbortController|null>(null),mounted=useRef(true);
  const live=format==='png'||format==='gif'||format==='video';
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;abort.current?.abort();};},[]);
  const prepared=useMemo(()=>{
    if(!open||live||format==='json')return {scene:null,error:''};
    try{return {scene:buildScene(diagram,collectPages(diagram,path,options.scope),options),error:''};}
    catch(error){return {scene:null,error:error instanceof Error?error.message:'Could not prepare export.'};}
  },[open,live,format,diagram,path,options]);
  const htmlDiagram=format==='html'?diagram:null,htmlPath=format==='html'?path:null;
  useEffect(()=>{
    let active=true,url:string|undefined;setPreview('');
    const publish=(blob:Blob)=>{if(active){url=URL.createObjectURL(blob);setPreview(url);}};
    if(download&&download.type===format)publish(download.blob);
    else if(format==='html'&&open)void createExport(diagram,path,'html',options).then(result=>publish(result.blob)).catch(error=>{if(active)setError(String(error));});
    else if(prepared.scene)publish(new Blob([sceneSvg(prepared.scene,options)],{type:'image/svg+xml'}));
    return()=>{active=false;if(url)URL.revokeObjectURL(url);};
  },[download,format,prepared.scene,open,htmlDiagram,htmlPath,options]);
  const save=async()=>{
    setBusy(true);setError('');setDownload(null);
    try{
      let result:{blob:Blob;filename:string};
      if(format==='png'||format==='gif'||format==='video'){
        const controller=new AbortController();abort.current=controller;
        const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();controller.abort();}};
        window.addEventListener('keydown',escape,true);
        try{
          const captured=await captureTab(format as CaptureFormat,{width:options.width,seconds,signal:controller.signal,ready:()=>{onOpenChange(false);document.documentElement.classList.add('live-capture');}});
          result={blob:captured.blob,filename:exportFilename(diagram.name,'png').replace(/\.png$/,'.'+captured.extension)};
        }finally{window.removeEventListener('keydown',escape,true);document.documentElement.classList.remove('live-capture');abort.current=null;}
      }else result=await createExport(diagram,path,format,options);
      downloadBlob(result.blob,result.filename);setDownload({...result,type:format});notify(`Downloaded ${result.filename}`);
    }catch(error){if(mounted.current)setError(error instanceof DOMException&&['NotAllowedError','AbortError'].includes(error.name)?'Capture cancelled. Choose this tab when you try again.':error instanceof Error?error.message:'Export failed.');}
    finally{if(mounted.current){setBusy(false);onOpenChange(true);}}
  };
  const embed=download?format==='html'?`<iframe src="${download.filename}" title="Diagram" width="100%" height="600" style="border:0" loading="lazy"></iframe>`:format==='video'?`<video src="${download.filename}" controls playsinline style="max-width:100%"></video>`:`<img src="${download.filename}" alt="Diagram" style="max-width:100%;height:auto">`:'';
  return <Dialog open={open} onOpenChange={value=>{if(!busy)onOpenChange(value);}}><DialogContent className="export-dialog" onEscapeKeyDown={event=>{if(busy)event.preventDefault();}} onInteractOutside={event=>{if(busy)event.preventDefault();}}>
    <DialogHeader><DialogTitle className="dialog-title"><Download/>Export</DialogTitle><DialogDescription>Capture the running canvas, share an interactive page, or save the project.</DialogDescription></DialogHeader>
    <div className="export-formats" role="group" aria-label="Export format">{formats.map(item=><Button key={item.id} variant={format===item.id?'secondary':'ghost'} aria-pressed={format===item.id} disabled={busy} onClick={()=>{setFormat(item.id);if(item.id==='html')setOptions(current=>({...current,scope:'system'}));setDownload(null);setError('');}}><item.icon/>{item.name}</Button>)}</div>
    <div className="export-layout"><div className="export-preview"><div className="export-image">{preview?(format==='html'?<iframe src={preview} title="Live HTML export preview" sandbox="allow-scripts" style={{width:'100%',height:'100%',minHeight:260,border:0}}/>:format==='video'?<video src={preview} controls playsInline aria-label="Captured video preview" style={{width:'100%'}}/>:<img src={preview} alt="Export preview"/>):<div className="capture-intro"><div className="capture-intro-icon">{format==='video'?<Video/>:format==='gif'?<Film/>:format==='json'?<Braces/>:<Image/>}</div><strong>{live?'Capture what is running':format==='json'?'Keep the whole project':'Diagram preview'}</strong><p>{formats.find(item=>item.id===format)?.description}</p></div>}</div><div className="export-preview-caption">{formats.find(item=>item.id===format)?.description}</div></div>
    <div className="export-options">
      {live?<>
        <Field label="Capture"><p className="export-note">Choose <strong>this tab</strong> in the browser’s sharing dialog. The export dialog, panels, and toolbars hide automatically. Only the current view is captured; zoom and pan before starting.</p></Field>
        <Field label="Maximum width"><Select value={String(format==='gif'?Math.min(800,options.width):options.width)} onValueChange={width=>setOptions(current=>({...current,width:Number(width)}))} disabled={busy}><SelectTrigger aria-label="Capture width"><SelectValue/></SelectTrigger><SelectContent>{(format==='gif'?[400,600,800]:[400,600,800,1200,1600,2400]).map(width=><SelectItem key={width} value={String(width)}>{width} px</SelectItem>)}</SelectContent></Select></Field>
        {format!=='png'&&<><Field label="Duration"><Select value={String(Math.min(seconds,format==='gif'?10:30))} onValueChange={seconds=>setSeconds(Number(seconds))} disabled={busy}><SelectTrigger aria-label="Recording duration"><SelectValue/></SelectTrigger><SelectContent>{(format==='gif'?[3,5,10]:[3,5,10,20,30]).map(seconds=><SelectItem key={seconds} value={String(seconds)}>{seconds} seconds</SelectItem>)}</SelectContent></Select></Field><p className="export-note">Interact with blocks while recording. Recording ends automatically. Escape cancels; stop sharing to finish early.{format==='gif'?' GIFs use up to 800 px width and 256 colors.':''}</p></>}
      </>:<>
        {format!=='json'&&<Field label="Content"><Select value={options.scope} onValueChange={scope=>{setOptions(current=>({...current,scope:scope as 'current'|'system'}));setDownload(null);}} disabled={busy}><SelectTrigger aria-label="Export content"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="current">Current canvas</SelectItem><SelectItem value="system">Entire system</SelectItem></SelectContent></Select></Field>}
        <p className="export-note">{format==='json'?'JSON includes every canvas, JavaScript module, embedded URL library source, code and render functions, drafts, saved blocks, data, state, connections, and theme.':format==='svg'?'SVG preserves the diagram structure and shapes. Use Screenshot or Video to include the actual rendered block content.':'HTML includes live renderers. Choose Entire system to navigate nested canvases offline.'}</p>
        {format!=='json'&&<><div className="export-toggle"><Label htmlFor="export-grid">Dot grid</Label><Switch id="export-grid" checked={options.grid} disabled={busy} onCheckedChange={grid=>{setOptions(current=>({...current,grid}));setDownload(null);}}/></div>{format==='svg'&&<><div className="export-toggle"><Label htmlFor="export-title">Diagram title</Label><Switch id="export-title" checked={options.title} disabled={busy} onCheckedChange={title=>{setOptions(current=>({...current,title}));setDownload(null);}}/></div><div className="export-toggle"><Label htmlFor="export-transparent">Transparent background</Label><Switch id="export-transparent" checked={options.transparent} disabled={busy} onCheckedChange={transparent=>{setOptions(current=>({...current,transparent}));setDownload(null);}}/></div></>}</>}
      </>}
    </div></div>
    {download&&<div className="export-embed"><div><Check/><span>Downloaded {download.filename}</span><Button size="sm" variant="outline" onClick={()=>downloadBlob(download.blob,download.filename)}>Download again</Button></div>{format!=='json'&&<div className="export-embed-code"><Input aria-label="Embed code" readOnly value={embed}/><Button variant="outline" size="sm" onClick={()=>void navigator.clipboard.writeText(embed).then(()=>notify('Embed code copied'),()=>notify('Select and copy the embed code.'))}><Copy/>Copy embed</Button></div>}</div>}
    {(error||prepared.error)&&<p role="alert" className="json-error">{error||prepared.error}</p>}
    <DialogFooter><Button variant="outline" disabled={busy} onClick={()=>onOpenChange(false)}>Close</Button><Button disabled={busy||(!live&&format!=='json'&&!prepared.scene)} onClick={()=>void save()}>{busy?<LoaderCircle className="animate-spin"/>:<Download/>}{busy?'Preparing…':live?format==='png'?'Capture screenshot':'Start recording':`Download ${format.toUpperCase()}`}</Button></DialogFooter>
  </DialogContent></Dialog>;
}

import { useEffect, useRef, useState } from 'react';

export function InlineValueEditor({value,label,commit,cancel}:{value:string;label:string;commit:(value:string)=>void;cancel:()=>void}) {
  const [draft,setDraft]=useState(value);
  const field=useRef<HTMLTextAreaElement>(null);
  const finished=useRef(false);
  const save=()=>{if(finished.current)return;finished.current=true;commit(draft);};
  useEffect(()=>{field.current?.focus();field.current?.select();},[]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!field.current?.contains(event.target))save();};
    document.addEventListener('pointerdown',outside,true);
    return ()=>document.removeEventListener('pointerdown',outside,true);
  },[draft]);
  return <textarea ref={field} className="inline-value-editor nodrag nopan nowheel" aria-label={`Edit ${label} value`} title="Enter to save · Shift+Enter for a new line · Escape to cancel" value={draft}
    onChange={event=>setDraft(event.target.value)} onBlur={save} onDoubleClick={event=>event.stopPropagation()} onPointerDown={event=>event.stopPropagation()}
    onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();finished.current=true;cancel();}else if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();save();}}}/>;
}

import { useEffect, useState } from 'react';
import { Input } from './ui/input';
import { Slider } from './ui/slider';
export function NumberSlider({ label, value, min, max, step = 1, disabled = false, change }: { label: string; value: number; min: number; max: number; step?: number; disabled?: boolean; change: (value: number) => void }) {
  const [draft,setDraft]=useState(String(value));
  useEffect(()=>setDraft(String(value)),[value]);
  const commit=()=>{const number=Number(draft);if(!draft.trim()||!Number.isFinite(number)){setDraft(String(value));return;}const next=Math.max(min,Math.min(max,number));setDraft(String(next));if(next!==value)change(next);};
  return <div className="number-slider-control"><Slider aria-label={`${label} slider`} min={min} max={max} step={step} disabled={disabled} value={[value]} onValueChange={([next])=>change(next)}/><Input disabled={disabled} aria-label={label} type="number" min={min} max={max} step={step} value={draft} onChange={event=>{setDraft(event.target.value);const next=Number(event.target.value);if(event.target.value.trim()&&Number.isFinite(next)&&next>=min&&next<=max)change(next);}} onBlur={commit} onKeyDown={event=>{if(event.key==='Enter')event.currentTarget.blur();}}/></div>;
}

import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import type { BlockData } from '@/model';
import { isControlled } from '@/block-code';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Field } from './editor-ui';
export function SourceProperties({ data, update }: { data: BlockData; update: (patch: Partial<BlockData>) => void }) {
  const file = useRef<HTMLInputElement>(null), [error,setError] = useState('');
  const csv = data.recipe === 'CSV', locked = isControlled(data,'value');
  let config = {text:'',delimiter:',',header:false,numeric:true}, invalid = false;
  try { if (csv) config = {...config,...JSON.parse(data.value)}; } catch { invalid = true; }
  const change = (text: string) => { update({value:csv ? JSON.stringify({...config,text}) : text});setError(''); };
  return <><Field label={csv?'CSV content':'Text content'}><Textarea aria-label={csv?'CSV content':'Text content'} rows={6} disabled={locked} value={csv?config.text:data.value} onChange={event=>change(event.target.value)}/></Field>
    {csv && <><Field label="Delimiter"><Input aria-label="CSV delimiter" disabled={locked} value={config.delimiter} maxLength={1} onChange={event=>update({value:JSON.stringify({...config,delimiter:event.target.value})})}/></Field><div className="export-toggle"><span>First row contains headers</span><Switch aria-label="CSV header row" disabled={locked} checked={config.header} onCheckedChange={header=>update({value:JSON.stringify({...config,header})})}/></div><div className="export-toggle"><span>Convert numeric cells</span><Switch aria-label="CSV numeric cells" disabled={locked} checked={config.numeric} onCheckedChange={numeric=>update({value:JSON.stringify({...config,numeric})})}/></div><p className="field-help">Without headers, numeric CSV rows connect directly to matrix operators. With headers, output is an array of records.</p></>}
    <Button size="sm" variant="outline" disabled={locked} onClick={()=>file.current?.click()}><Upload/>Import {csv?'.csv':'.txt'}</Button>
    {(error || invalid) && <p role="alert" className="code-error">{error || 'Invalid CSV settings. Fix the block JSON or replace its content.'}</p>}
    <input ref={file} type="file" className="sr-only" aria-label={csv?'Import CSV source':'Import text source'} accept={csv?'.csv,text/csv':'.txt,.md,text/plain'} onChange={async event=>{const picked=event.target.files?.[0];event.target.value='';if(!picked)return;try{const text=await picked.text();if(text.length>(csv?100000:10000))throw new Error('File is too large for this source.');change(text);}catch(error){setError(error instanceof Error?error.message:String(error));}}}/>
  </>;
}

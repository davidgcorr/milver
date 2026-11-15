import { RenderBoundary } from './render-boundary';
import { useState } from 'react';
import CodeMirrorField from './codemirror-field';
import { Maximize2 } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';

export function CodeEditor({ value, onChange, label, language = 'javascript', expandable = true, disabled = false }: { value: string; onChange: (value: string) => void; label: string; language?: 'javascript' | 'json' | 'text'; expandable?: boolean; disabled?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return <div className={`source-editor ${disabled ? 'function-disabled' : ''}`}><div className="source-editor-bar"><span>{language === 'javascript' ? 'JavaScript / JSX' : language.toUpperCase()}</span>{expandable && <Button size="icon-xs" variant="ghost" aria-label={`Expand ${label}`} disabled={disabled} onClick={() => setExpanded(true)}><Maximize2/></Button>}</div><RenderBoundary resetKey={`${label}:${language}`}><CodeMirrorField value={value} onChange={onChange} label={label} language={language} disabled={disabled}/></RenderBoundary>{expandable && <Dialog open={expanded} onOpenChange={setExpanded}><DialogContent className="expanded-code-dialog"><DialogHeader><DialogTitle>{label}</DialogTitle></DialogHeader><CodeEditor value={value} onChange={onChange} label={`Expanded ${label}`} language={language} expandable={false}/></DialogContent></Dialog>}</div>;
}

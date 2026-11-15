import { useEffect, useRef, useState } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { EditorState } from '@codemirror/state';
import { keymap } from '@codemirror/view';
import { indentWithTab } from '@codemirror/commands';

const tokenStyle = HighlightStyle.define([
  { tag: tags.keyword, class: 'cm-syntax-keyword' },
  { tag: [tags.string, tags.special(tags.string)], class: 'cm-syntax-string' },
  { tag: [tags.number, tags.bool, tags.null], class: 'cm-syntax-number' },
  { tag: tags.comment, class: 'cm-syntax-comment' },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], class: 'cm-syntax-function' },
  { tag: [tags.propertyName, tags.attributeName], class: 'cm-syntax-property' },
  { tag: [tags.tagName, tags.typeName, tags.className], class: 'cm-syntax-type' },
  { tag: tags.operator, class: 'cm-syntax-operator' },
]);
export default function CodeMirrorField({ value, onChange, label, language, disabled=false }: { value: string; onChange: (value: string) => void; label: string; language: 'javascript' | 'json' | 'text'; disabled?: boolean }) {
  const host = useRef<HTMLDivElement>(null), view = useRef<EditorView | null>(null);
  const change = useRef(onChange); change.current = onChange;
  const external = useRef(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({ parent: host.current, doc: value, extensions: [
      EditorState.readOnly.of(disabled),EditorView.editable.of(!disabled),
      basicSetup, keymap.of([indentWithTab]),
      language === 'javascript' ? javascript({ jsx: true }) : language === 'json' ? json() : [],
      syntaxHighlighting(tokenStyle),
      EditorView.contentAttributes.of({ 'aria-label': label, spellcheck: 'false' }),
      EditorView.updateListener.of(update => { if (update.docChanged && !external.current) change.current(update.state.doc.toString()); }),
      EditorView.theme({ '&': { fontSize: '12px', backgroundColor: 'var(--background)', color: 'var(--foreground)' }, '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, monospace', overflow: 'auto', minHeight: '260px', maxHeight: '65vh' }, '.cm-content': { padding: '12px 0' }, '.cm-gutters': { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)', border: 'none' }, '.cm-activeLine': { backgroundColor: 'var(--muted)' }, '.cm-activeLineGutter': { backgroundColor: 'var(--secondary)' }, '.cm-cursor': { borderLeftColor: 'var(--foreground)' } }),
    ] });
    view.current = editor; setMounted(true);
    return () => { editor.destroy(); view.current = null; };
  }, [language, label, disabled]);
  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== value) {
      external.current = true;
      try { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value } }); }
      finally { external.current = false; }
    }
  }, [value]);
  return <div><div ref={host}/><textarea disabled={disabled} aria-label={label} hidden={mounted} value={value} onChange={e => onChange(e.target.value)}/></div>;
}

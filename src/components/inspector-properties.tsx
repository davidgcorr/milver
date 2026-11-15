import type { BlockData } from '@/model';
import { validPropertyValue, type PropertyValue } from '@/inspector-properties';
import { Field } from './editor-ui';
import { Input } from './ui/input';
import { ColorSelector } from './color-selector';

export function InspectorProperties({ data, update }: { data: BlockData; update: (patch: Partial<BlockData>) => void }) {
  const fields = Object.entries(data.propertyFields ?? {});
  if (!fields.length) return null;
  return <section className="property-section"><h3>Custom properties</h3>{fields.map(([name, field]) => {
    const label = field.label ?? name, value = data.parameters?.[name] ?? field.default;
    const change = (next: PropertyValue) => { if (validPropertyValue(field, next)) update({ parameters: { ...data.parameters, [name]: next } }); };
    return <Field key={name} label={label}>{field.type === 'boolean' ? <input type="checkbox" aria-label={label} checked={value === true} onChange={e => change(e.target.checked)}/> : field.type === 'select' ? <select aria-label={label} value={String(value)} onChange={e => change(e.target.value)}>{field.options?.map(option => <option key={option} value={option}>{option}</option>)}</select> : field.type === 'color' ? <ColorSelector label={label} value={String(value)} onChange={change}/> : <Input aria-label={label} type={field.type === 'number' ? 'number' : 'text'} min={field.min} max={field.max} step={field.step ?? 'any'} value={String(value)} onChange={e => { if (field.type !== 'number' || e.target.value !== '') change(field.type === 'number' ? Number(e.target.value) : e.target.value); }}/>}</Field>;
  })}</section>;
}

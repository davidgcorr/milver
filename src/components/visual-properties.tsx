import { Paintbrush } from 'lucide-react';
import { InspectorSection } from './inspector-section';
import { ColorSelector } from './color-selector';
import { NumberSlider } from './number-slider';
import { isControlled } from '@/block-code';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field } from './editor-ui';
import { type BlockData, type BlockNode, type BlockVisuals, type FlowSettings } from '@/model';
export function VisualProperties({ node, update, resize }: { node: BlockNode; update: (patch: Partial<BlockData>) => void; resize: (dimension: 'width' | 'height', value: number) => void }) {
  const v = node.data.visuals ?? {};
  const change = (patch: Partial<BlockVisuals>) => update({ visuals: { ...v, ...patch } });
  return <InspectorSection title="Appearance" icon={Paintbrush}><section className="property-section">
    {!!node.data.controlledProperties?.length && <div className="controlled-properties"><p className="field-help">Locked by code. Remove its <code>setProperty()</code> call before releasing a field.</p>{node.data.controlledProperties.map(path => <div key={path}><code>{path}</code><Button size="sm" variant="ghost" onClick={() => update({ controlledProperties: node.data.controlledProperties!.filter(p => p !== path) })}>Release</Button></div>)}</div>}
    <div className="dimension-fields">{([['background', 'Fill', 'Block fill', '#ffffff'], ['foreground', 'Ink', 'Block ink', '#171717']] as const).map(([key, label, aria, fallback]) => <Field key={key} label={label}><ColorSelector label={aria} fill={key === 'background'} disabled={isControlled(node.data, `visuals.${key}`)} value={v[key] ?? fallback} onChange={color => change({ [key]: color })}/></Field>)}</div>
    <Button variant="outline" size="sm" disabled={isControlled(node.data, 'visuals.background') || isControlled(node.data, 'visuals.foreground') || isControlled(node.data, 'visuals.strokeColor') || isControlled(node.data, 'visuals.shadowColor')} onClick={() => update({ visuals: { ...v, background: undefined, foreground: undefined, strokeColor: undefined, shadowColor: undefined } })}>Use theme colors</Button>
    {(['width', 'height'] as const).map(d => <Field key={d} label={d === 'width' ? 'Width (px)' : 'Height (px)'}><NumberSlider label={`Block ${d}`} disabled={['inport','outport'].includes(node.data.kind) || isControlled(node.data,d)} min={['inport','outport'].includes(node.data.kind)?24:d==='width'?120:90} max={2000} value={node[d] ?? (d==='width'?164:116)} change={value=>resize(d,value)}/></Field>)}
    <Field label="Corner radius (px)"><NumberSlider label="Block corner radius" disabled={isControlled(node.data,'visuals.radius')} min={0} max={60} value={v.radius ?? 9} change={radius=>change({radius})}/></Field>
    <Field label="Stroke width (px)"><NumberSlider label="Block stroke width" disabled={isControlled(node.data,'visuals.strokeWidth')} min={0} max={12} step={0.5} value={v.strokeWidth ?? 1} change={strokeWidth=>change({strokeWidth})}/></Field>
    <div className="dimension-fields">{([['strokeColor', 'Stroke color', '#e5e5e5'], ['shadowColor', 'Shadow color', '#000000']] as const).map(([key, label, fallback]) => <Field key={key} label={label}><ColorSelector label={`Block ${label.toLowerCase()}`} disabled={isControlled(node.data, `visuals.${key}`)} value={v[key] ?? fallback} onChange={color => change({ [key]: color })}/></Field>)}</div>
    <Field label="Shadow (px)"><NumberSlider label="Block shadow" disabled={isControlled(node.data,'visuals.shadow')} min={0} max={40} value={v.shadow ?? 2} change={shadow=>change({shadow})}/></Field>
    <Field label="Opacity (%)"><NumberSlider label="Block opacity" disabled={isControlled(node.data,'visuals.opacity')} min={0} max={100} value={Math.round((v.opacity ?? 1)*100)} change={opacity=>change({opacity:opacity/100})}/></Field>
    {([['showHeader', 'Type breadcrumb'], ['showLabel', 'Block label'], ['showValue', 'Mask content'], ['showPortLabels', 'Port names on hover']] as const).map(([key, label]) => <label className="visibility-option" key={key}><span>{label}</span><input disabled={isControlled(node.data, `visuals.${key}`)} type="checkbox" checked={v[key] !== false} onChange={e => change({ [key]: e.target.checked })}/></label>)}
  </section></InspectorSection>;
}
export function ConnectionProperties({ settings, update }: { settings: FlowSettings; update: (patch: FlowSettings) => void }) {
  return <><Field label="Path"><select aria-label="Connection path" value={settings.route ?? 'smoothstep'} onChange={e => update({ route: e.target.value as FlowSettings['route'] })}><option value="smoothstep">Orthogonal</option><option value="bezier">Bézier curve</option></select></Field>
    <p className="field-help">Select an orthogonal wire and drag its middle segments: horizontal up/down, vertical left/right. Double-click a wire to add a waypoint. Select the wire, then drag its points to shape it. Double-click a point to remove it.</p>
    <Button variant="outline" size="sm" disabled={!settings.points?.length && !settings.routePoints?.length} onClick={() => update({ points: [], routePoints: [] })}>Reset route</Button>
    <Field label="Flow animation"><select aria-label="Flow animation" value={settings.animation ?? 'none'} onChange={e => update({ animation: e.target.value as FlowSettings['animation'] })}><option value="none">None</option><option value="dash">Moving dashes</option><option value="pulse">Travelling pulse</option><option value="glow">Travelling glow</option></select></Field>
    <Field label="Animated element size (px)"><Input aria-label="Animated element size" type="number" min={1} max={32} step={0.5} value={settings.animationSize ?? (settings.animation === 'dash' ? 2.5 : 7)} onChange={e => update({ animationSize: Math.max(1, Math.min(32, Number(e.target.value))) })}/></Field>
    <Field label="Travel time (seconds)"><Input aria-label="Animation travel time" type="number" min={0.1} max={20} step={0.1} value={settings.speed ?? 2} onChange={e => update({ speed: Math.max(0.1, Math.min(20, Number(e.target.value))) })}/></Field>
    <label className="visibility-option"><span>Reverse flow</span><input type="checkbox" checked={settings.reverse ?? false} onChange={e => update({ reverse: e.target.checked })}/></label>
    <Field label="Wire color"><ColorSelector label="Wire color" value={settings.color ?? '#737373'} onChange={color => update({ color })}/></Field><Field label="Stroke width"><Input aria-label="Wire width" type="number" min={1} max={8} value={settings.width ?? 1.5} step={0.5} onChange={e => update({ width: Math.max(1, Math.min(8, Number(e.target.value))) })}/></Field>
  </>;
}

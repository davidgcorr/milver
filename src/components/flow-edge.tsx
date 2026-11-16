import { RoughContext, RoughPath } from './rough-shapes';
import { createContext, useContext, useId, useMemo } from 'react';
import { BaseEdge, useReactFlow, type EdgeProps } from '@xyflow/react';
import { connectionPath, orthogonalRoute, moveRouteSegment } from '@/connections';
import type { FlowSettings } from '@/model';
import { nearestSpan, pathSpans, wireLayers } from '@/arrow-masks';
export const FlowContext = createContext({ update: (_id: string, _patch: FlowSettings, _remember?: boolean) => {}, snapshot: () => {} });
export function FlowEdge(props: EdgeProps) {
  const { id, selected, data } = props;
  const { enabled: rough, roughness } = useContext(RoughContext);
  const settings = (data ?? {}) as FlowSettings;
  const { update, snapshot } = useContext(FlowContext);
  const flow = useReactFlow();
  const path = connectionPath(props, settings);
  const route = settings.route !== 'bezier' ? orthogonalRoute(props,settings) : [];
  const dragSegment = (index: number, coordinate: number) => {
    const points=moveRouteSegment(route,index,coordinate);
    update(id,{routePoints:points.slice(1,-1),points:undefined},false);
  };
  const color = settings.color ?? 'var(--muted-foreground)';
  const speed = settings.speed ?? 2;
  const glowId = useId().replace(/:/g, '');
  const size = settings.animationSize ?? (settings.animation === 'dash' ? 2.5 : 7);
  const mask = settings.mask ?? (rough ? 'rough' : 'plain');
  const layers = useMemo(() => wireLayers(path,mask,color,settings.width ?? 1.5,id,roughness), [path,mask,color,settings.width,id,roughness]);
  const insertPoint = (point: { x: number; y: number }, index = nearestSpan(path, point)) => {
    if (settings.route !== 'bezier' || (settings.points?.length ?? 0) >= 100) return;
    const points = [...(settings.points ?? [])];
    points.splice(index, 0, point);
    update(id, { points, routePoints: undefined });
  };
  return <g onDoubleClick={event => {
    event.stopPropagation();
    insertPoint(flow.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }}>
    <defs><filter id={glowId} x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation={size / 3}/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><marker id={`recipe-arrow-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">{mask === 'rough' ? <RoughPath id={`arrow-${id}`} d="M1 1L9 5L1 9" color={color} width={1.3}/> : <path d="M1 1 9 5 1 9z" fill={color}/>}</marker></defs>
    <BaseEdge id={id} path={path} interactionWidth={24} style={{ stroke: 'transparent', strokeWidth: settings.width ?? 1.5 }}/>
    <g pointerEvents="none" aria-hidden="true">{layers.map((layer,index) => <path key={index} {...layer} fill="none" strokeLinecap="round" strokeLinejoin="round"/>)}</g>
    <path d={path} fill="none" stroke="none" pointerEvents="none" markerEnd={`url(#recipe-arrow-${id})`}/>
    {settings.animation === 'dash' && <path d={path} className="flow-dashes" fill="none" stroke={color} strokeWidth={size} strokeDasharray="6 9" style={{ animationDuration: `${speed}s`, animationDirection: settings.reverse ? 'reverse' : 'normal' }} pointerEvents="none"/>}
    {(settings.animation === 'pulse' || settings.animation === 'glow') && <circle className="flow-pulse" r={size / 2} filter={settings.animation === 'glow' ? `url(#${glowId})` : undefined} fill={color} pointerEvents="none"><animateMotion dur={`${speed}s`} repeatCount="indefinite" path={path} keyPoints={settings.reverse ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear"/></circle>}
    {selected && route.slice(0,-1).map((a,index)=>{
      const b=route[index+1],horizontal=a.y===b.y;
      if(Math.hypot(b.x-a.x,b.y-a.y)<0.1)return null;
      return <g key={index} className="route-segment nodrag nopan" style={{cursor:horizontal?'ns-resize':'ew-resize'}}>
        <path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} className="route-segment-hit" vectorEffect="non-scaling-stroke" fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke" tabIndex={0} role="slider" aria-label={`Move ${horizontal?'horizontal':'vertical'} segment ${index}`} aria-orientation={horizontal?'vertical':'horizontal'} aria-valuenow={horizontal?a.y:a.x}
          onDoubleClick={event=>event.stopPropagation()}
          onKeyDown={event=>{const delta=horizontal?({ArrowUp:-10,ArrowDown:10}[event.key]):({ArrowLeft:-10,ArrowRight:10}[event.key]);if(delta===undefined)return;event.preventDefault();event.stopPropagation();snapshot();dragSegment(index,(horizontal?a.y:a.x)+delta*(event.shiftKey?0.1:1));}}
          onPointerDown={event=>{
            if(event.button!==0)return;
            event.preventDefault();event.stopPropagation();snapshot();
            const element=event.currentTarget,pointer=event.pointerId;
            const origin=flow.screenToFlowPosition({x:event.clientX,y:event.clientY});
            element.setPointerCapture(pointer);
            const move=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;const position=flow.screenToFlowPosition({x:e.clientX,y:e.clientY});dragSegment(index,(horizontal?a.y:a.x)+(horizontal?position.y-origin.y:position.x-origin.x));};
            const end=(e:PointerEvent)=>{if(e.pointerId!==pointer)return;element.removeEventListener('pointermove',move);element.removeEventListener('pointerup',end);element.removeEventListener('pointercancel',end);element.removeEventListener('lostpointercapture',end);if(element.hasPointerCapture(pointer))element.releasePointerCapture(pointer);};
            element.addEventListener('pointermove',move);element.addEventListener('pointerup',end);element.addEventListener('pointercancel',end);element.addEventListener('lostpointercapture',end);
          }}><title>{horizontal?'Drag up or down':'Drag left or right'}</title></path>
        <path d={horizontal?`M${(a.x+b.x)/2-6} ${a.y}h12`:`M${a.x} ${(a.y+b.y)/2-6}v12`} className="route-segment-grip" vectorEffect="non-scaling-stroke" pointerEvents="none"/>
      </g>;
    })}
    {selected && settings.route === 'bezier' && pathSpans(path).map((span,index) => {
      const point = span[Math.floor(span.length / 2)];
      return <g key={`add-${index}`} className="route-add nodrag nopan" role="button" tabIndex={0} aria-label={`Add curve point ${index+1}`} transform={`translate(${point.x} ${point.y})`}
        onDoubleClick={e => e.stopPropagation()} onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); insertPoint(point,index); }}
        onKeyDown={e => { if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); insertPoint(point,index); } }}>
        <title>Add curve point</title><circle r={8}/><path d="M-3 0H3M0-3V3" pointerEvents="none"/>
      </g>;
    })}
    {selected && settings.route === 'bezier' && settings.points?.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={6} className="route-point nodrag nopan" tabIndex={0} role="button" aria-label={`Waypoint ${index + 1}`} onKeyDown={e => {
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); update(id,{points:settings.points!.filter((_,i)=>i!==index)}); return; }
      const delta = {ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
      if(!delta)return;
      e.preventDefault();e.stopPropagation();
      const step=e.shiftKey?1:10;
      update(id,{points:settings.points!.map((p,i)=>i===index?{x:p.x+delta[0]*step,y:p.y+delta[1]*step}:p)});
    }} onDoubleClick={e => { e.stopPropagation(); update(id, { points: settings.points!.filter((_, i) => i !== index) }); }} onPointerDown={event => {
      if(event.button!==0)return;
      event.stopPropagation(); event.preventDefault(); snapshot();
      const target = event.currentTarget; target.setPointerCapture(event.pointerId);
      const move = (e: PointerEvent) => { if(e.pointerId!==event.pointerId)return; update(id, { points: settings.points!.map((p, i) => i === index ? flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }) : p) }, false); };
      const end = (e: PointerEvent) => { if(e.pointerId!==event.pointerId)return; target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', end); target.removeEventListener('pointercancel', end); target.removeEventListener('lostpointercapture',end); if(target.hasPointerCapture(event.pointerId))target.releasePointerCapture(event.pointerId); };
      target.addEventListener('pointermove', move); target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end); target.addEventListener('lostpointercapture',end);
    }}><title>Drag to shape · double-click to remove</title></circle>)}
  </g>;
}

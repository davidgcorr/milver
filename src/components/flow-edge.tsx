import { RoughContext, RoughPath } from './rough-shapes';
import { createContext, useContext, useId } from 'react';
import { BaseEdge, useReactFlow, type EdgeProps } from '@xyflow/react';
import { connectionPath, orthogonalRoute, moveRouteSegment } from '@/connections';
import type { FlowSettings } from '@/model';
export const FlowContext = createContext({ update: (_id: string, _patch: FlowSettings, _remember?: boolean) => {}, snapshot: () => {} });
export function FlowEdge(props: EdgeProps) {
  const { id, selected, data } = props;
  const { enabled: rough } = useContext(RoughContext);
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
  return <g onDoubleClick={event => {
    event.stopPropagation();
    const p = flow.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const points = [...(settings.points ?? [])];
    // Insert beside the nearest segment, preserving route order.
    const all = [{ x: props.sourceX, y: props.sourceY }, ...points, { x: props.targetX, y: props.targetY }];
    let best = Infinity, index = 0;
    for (let i = 0; i < all.length - 1; i++) {
      const a = all[i], b = all[i + 1], dx = b.x - a.x, dy = b.y - a.y;
      const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
      const distance = (p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2;
      if (distance < best) { best = distance; index = i; }
    }
    points.splice(index, 0, p); update(id, { points, routePoints: undefined });
  }}>
    <defs><filter id={glowId} x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation={size / 3}/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter><marker id={`recipe-arrow-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">{rough ? <RoughPath id={`arrow-${id}`} d="M1 1L9 5L1 9" color={color} width={1.3}/> : <path d="M1 1 9 5 1 9z" fill={color}/>}</marker></defs>
    <BaseEdge id={id} path={path} markerEnd={`url(#recipe-arrow-${id})`} style={{ stroke: rough ? 'transparent' : color, strokeOpacity: rough ? 0 : 1, strokeWidth: settings.width ?? 1.5 }}/>
    {rough && <><RoughPath d={path} id={id} color={color} width={settings.width ?? 1.5}/><path d={path} fill="none" stroke="none" markerEnd={`url(#recipe-arrow-${id})`}/></>}
    {settings.animation === 'dash' && <path d={path} className="flow-dashes" fill="none" stroke={color} strokeWidth={size} strokeDasharray="6 9" style={{ animationDuration: `${speed}s`, animationDirection: settings.reverse ? 'reverse' : 'normal' }} pointerEvents="none"/>}
    {(settings.animation === 'pulse' || settings.animation === 'glow') && <circle className="flow-pulse" r={size / 2} filter={settings.animation === 'glow' ? `url(#${glowId})` : undefined} fill={color} pointerEvents="none"><animateMotion dur={`${speed}s`} repeatCount="indefinite" path={path} keyPoints={settings.reverse ? '1;0' : '0;1'} keyTimes="0;1" calcMode="linear"/></circle>}
    {selected && route.slice(1,-2).map((a,offset)=>{
      const index=offset+1,b=route[index+1],horizontal=a.y===b.y;
      if(Math.hypot(b.x-a.x,b.y-a.y)<8)return null;
      return <g key={index} className="route-segment nodrag nopan" style={{cursor:horizontal?'ns-resize':'ew-resize'}}>
        <path d={`M${a.x} ${a.y}L${b.x} ${b.y}`} className="route-segment-hit" vectorEffect="non-scaling-stroke" fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke" tabIndex={0} role="slider" aria-label={`Move ${horizontal?'horizontal':'vertical'} segment ${index}`} aria-orientation={horizontal?'vertical':'horizontal'} aria-valuenow={horizontal?a.y:a.x}
          onDoubleClick={event=>event.stopPropagation()}
          onKeyDown={event=>{const delta=horizontal?({ArrowUp:-10,ArrowDown:10}[event.key]):({ArrowLeft:-10,ArrowRight:10}[event.key]);if(delta===undefined)return;event.preventDefault();event.stopPropagation();snapshot();dragSegment(index,(horizontal?a.y:a.x)+delta);}}
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
    {selected && settings.points?.map((point, index) => <circle key={index} cx={point.x} cy={point.y} r={6} className="route-point nodrag nopan" aria-label={`Waypoint ${index + 1}`} onDoubleClick={e => { e.stopPropagation(); update(id, { points: settings.points!.filter((_, i) => i !== index) }); }} onPointerDown={event => {
      event.stopPropagation(); event.preventDefault(); snapshot();
      const target = event.currentTarget; target.setPointerCapture(event.pointerId);
      const move = (e: PointerEvent) => update(id, { points: settings.points!.map((p, i) => i === index ? flow.screenToFlowPosition({ x: e.clientX, y: e.clientY }) : p) }, false);
      const end = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', end); target.removeEventListener('pointercancel', end); };
      target.addEventListener('pointermove', move); target.addEventListener('pointerup', end); target.addEventListener('pointercancel', end);
    }}><title>Drag to shape · double-click to remove</title></circle>)}
  </g>;
}

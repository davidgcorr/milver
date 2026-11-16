import { useEffect, useRef, useState } from 'react';
import { blockShapePath, defaultBezierPoints, shapeKnots, splitShapeSegment, type BezierKnot, type BlockShape, type ShapePoint } from '@/block-shapes';
import { NumberSlider } from './number-slider';
import { Button } from './ui/button';
import { Field } from './editor-ui';
const labels={rectangle:'Rectangle',circle:'Circle',ellipse:'Ellipse',diamond:'Rhombus / diamond',parallelogram:'Rhomboid',polygon:'Polygon',bezier:'Custom Bézier'};
export function BlockShapeEditor({shape={type:'rectangle'},change,disabled=false}:{shape?:BlockShape;change:(shape:BlockShape)=>void;disabled?:boolean}) {
  const points=shapeKnots(shape);
  const [preview,setPreview]=useState<BezierKnot[]|null>(null),[active,setActive]=useState(0);
  const drag=useRef<{index:number;part:'anchor'|'in'|'out';points:BezierKnot[];rect:DOMRect;pointer:number}|null>(null);
  useEffect(()=>{setActive(current=>Math.min(current,points.length-1));setPreview(null);},[shape]);
  const shown=preview??points;
  const movePoint=(all:BezierKnot[],index:number,part:'anchor'|'in'|'out',point:ShapePoint)=>all.map((p,i)=>{
    if(i!==index)return p;
    if(part!=='anchor')return {...p,[part]:point};
    const dx=point.x-p.x,dy=point.y-p.y,clamp=(p:ShapePoint)=>({x:Math.max(0,Math.min(100,p.x+dx)),y:Math.max(0,Math.min(100,p.y+dy))});
    return {...point,in:clamp(p.in),out:clamp(p.out)};
  });
  return <div className="block-shape-editor"><Field label="Block shape"><select aria-label="Block shape" disabled={disabled} value={shape.type} onChange={event=>change({...shape,type:event.target.value as BlockShape['type']})}>{Object.entries(labels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
    {shape.type==='polygon'&&<><Field label="Polygon sides"><NumberSlider label="Polygon sides" min={3} max={16} value={shape.sides??6} disabled={disabled} change={sides=>change({...shape,sides})}/></Field><Field label="Rotation (degrees)"><NumberSlider label="Polygon rotation" min={-180} max={180} value={shape.rotation??0} disabled={disabled} change={rotation=>change({...shape,rotation})}/></Field></>}
    {shape.type==='bezier'&&<><p className="field-help">Drag anchors or their tangent handles. Select an anchor, then add a point after it or remove it. Arrow keys move the focused point; Shift makes smaller adjustments. Coordinates scale with the block.</p>
      <svg className="bezier-shape-editor nodrag nopan" viewBox="-12 -12 124 124" aria-label="Bézier block shape editor" onPointerMove={event=>{
        const current=drag.current;if(!current||current.pointer!==event.pointerId)return;
        const {rect}=current;const size=Math.min(rect.width,rect.height),left=rect.left+(rect.width-size)/2,top=rect.top+(rect.height-size)/2;
        const p={x:Math.max(0,Math.min(100,(event.clientX-left)/size*124-12)),y:Math.max(0,Math.min(100,(event.clientY-top)/size*124-12))};
        const next=movePoint(current.points,current.index,current.part,p);setPreview(next);
      }} onPointerUp={event=>{if(!drag.current||drag.current.pointer!==event.pointerId)return;const next=preview;drag.current=null;if(next)change({...shape,points:next});setPreview(null);if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
      onPointerCancel={()=>{drag.current=null;setPreview(null);}} onLostPointerCapture={()=>{drag.current=null;setPreview(null);}}>
        <rect x="0" y="0" width="100" height="100" className="shape-editor-grid"/>
        <path d={blockShapePath({...shape,points:shown},100,100)} className="shape-editor-outline"/>
        {shown.map((p,index)=><g key={index}>
          {index===active&&<><path d={`M${p.in.x} ${p.in.y}L${p.x} ${p.y}L${p.out.x} ${p.out.y}`} className="shape-editor-tangents"/></>}
          {(['anchor',...(index===active?['in','out'] as const:[])] as const).map(part=>{
            const point=part==='anchor'?p:p[part];
            return <circle key={part} cx={point.x} cy={point.y} r={part==='anchor'?3:2.3} tabIndex={disabled?-1:0} role="button" aria-label={`Shape ${part==='anchor'?'anchor':part+' handle'} ${index+1}`} className={`shape-editor-point ${part==='anchor'?'anchor':'tangent'} ${index===active?'active':''}`}
              onFocus={()=>setActive(index)} onClick={()=>setActive(index)}
              onPointerDown={event=>{if(disabled||event.button!==0)return;event.preventDefault();event.stopPropagation();setActive(index);const svg=event.currentTarget.ownerSVGElement!;drag.current={index,part,points:structuredClone(points),rect:svg.getBoundingClientRect(),pointer:event.pointerId};svg.setPointerCapture(event.pointerId);}}
              onKeyDown={event=>{if(disabled)return;const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!delta)return;event.preventDefault();event.stopPropagation();const step=event.shiftKey?0.25:2;change({...shape,points:movePoint(points,index,part,{x:Math.max(0,Math.min(100,point.x+delta[0]*step)),y:Math.max(0,Math.min(100,point.y+delta[1]*step))})});}}/>;
          })}
        </g>)}
      </svg>
      <div className="shape-editor-actions"><Button size="sm" variant="outline" disabled={disabled||points.length>=32} onClick={()=>change({...shape,points:splitShapeSegment(points,Math.min(active,points.length-1))})}>Add point</Button><Button size="sm" variant="outline" disabled={disabled||points.length<=3} onClick={()=>change({...shape,points:points.filter((_,i)=>i!==active)})}>Remove point</Button><Button size="sm" variant="ghost" disabled={disabled} onClick={()=>change({...shape,points:defaultBezierPoints()})}>Reset curve</Button></div>
    </>}
    {shape.type==='circle'&&<p className="field-help">A circle fits inside the block bounds. Use equal width and height to fill them.</p>}
  </div>;
}

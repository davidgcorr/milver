export const blockShapeTypes = ['rectangle','circle','ellipse','diamond','parallelogram','polygon','bezier'] as const;
export type ShapePoint = { x:number; y:number };
export type BezierKnot = ShapePoint & { in:ShapePoint; out:ShapePoint };
export type BlockShape = { type:typeof blockShapeTypes[number]; sides?:number; rotation?:number; points?:BezierKnot[] };
export function defaultBezierPoints(): BezierKnot[] {
  return [
    {x:50,y:0,in:{x:22.386,y:0},out:{x:77.614,y:0}},
    {x:100,y:50,in:{x:100,y:22.386},out:{x:100,y:77.614}},
    {x:50,y:100,in:{x:77.614,y:100},out:{x:22.386,y:100}},
    {x:0,y:50,in:{x:0,y:77.614},out:{x:0,y:22.386}},
  ];
}
export function parseBlockShape(value:unknown):BlockShape {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid block shape.');
  const v=value as BlockShape;
  if(!blockShapeTypes.includes(v.type))throw new Error('Invalid block shape type.');
  if(v.sides!==undefined&&(!Number.isInteger(v.sides)||v.sides<3||v.sides>16))throw new Error('Polygon needs 3–16 sides.');
  if(v.rotation!==undefined&&(!Number.isFinite(v.rotation)||v.rotation < -180 ||v.rotation>180))throw new Error('Invalid polygon rotation.');
  const validPoint=(p:ShapePoint)=>p&&typeof p==='object'&&typeof p.x==='number'&&Number.isFinite(p.x)&&p.x>=0&&p.x<=100&&typeof p.y==='number'&&Number.isFinite(p.y)&&p.y>=0&&p.y<=100;
  if(v.points!==undefined&&(!Array.isArray(v.points)||v.points.length<3||v.points.length>32||v.points.some(p=>!validPoint(p)||!validPoint(p.in)||!validPoint(p.out))))throw new Error('Bézier shapes need 3–32 anchors and control handles between 0 and 100.');
  return {type:v.type,...(v.sides!==undefined?{sides:v.sides}:{}),...(v.rotation!==undefined?{rotation:v.rotation}:{}),...(v.points?{points:v.points.map(p=>({x:p.x,y:p.y,in:{x:p.in.x,y:p.in.y},out:{x:p.out.x,y:p.out.y}}))}:{} )};
}
export const shaped = (shape?:BlockShape) => !!shape && shape.type!=='rectangle';
export function shapeKnots(shape:BlockShape):BezierKnot[] {
  if(shape.type==='bezier')return shape.points??defaultBezierPoints();
  return defaultBezierPoints();
}
export function shapeVertices(shape:BlockShape):ShapePoint[] {
  if(shape.type==='diamond')return [{x:50,y:0},{x:100,y:50},{x:50,y:100},{x:0,y:50}];
  if(shape.type==='parallelogram')return [{x:20,y:0},{x:100,y:0},{x:80,y:100},{x:0,y:100}];
  if(shape.type==='polygon')return Array.from({length:shape.sides??6},(_,i)=>{const a=(i/(shape.sides??6)*360-90+(shape.rotation??0))*Math.PI/180;return {x:50+50*Math.cos(a),y:50+50*Math.sin(a)};});
  return [{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}];
}
export function blockShapePath(shape:BlockShape,width:number,height:number):string {
  const x=(p:ShapePoint)=>`${p.x/100*width} ${p.y/100*height}`;
  if(['bezier','ellipse','circle'].includes(shape.type)) {
    const points=shape.type==='circle'?defaultBezierPoints().map(p=>{const size=Math.min(width,height);const map=(q:ShapePoint)=>({x:50+(q.x-50)*size/width,y:50+(q.y-50)*size/height});return {...map(p),in:map(p.in),out:map(p.out)};}):shapeKnots(shape);
    return `M${x(points[0])}`+points.map((p,i)=>{const next=points[(i+1)%points.length];return `C${x(p.out)} ${x(next.in)} ${x(next)}`;}).join('')+'Z';
  }
  return shapeVertices(shape).map((p,i)=>`${i?'L':'M'}${x(p)}`).join('')+'Z';
}
function cubic(a:ShapePoint,b:ShapePoint,c:ShapePoint,d:ShapePoint,t:number):ShapePoint {
  const u=1-t;return {x:u**3*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t**3*d.x,y:u**3*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t**3*d.y};
}
// Ports follow the actual outline along a ray from the block centre.
export function shapePortPoint(shape:BlockShape|undefined,width:number,height:number,side:'left'|'right'|'top'|'bottom',offset:number):ShapePoint {
  const end={x:side==='left'?0:side==='right'?width:width*offset,y:side==='top'?0:side==='bottom'?height:height*offset};
  if(!shaped(shape))return end;
  const centre={x:width/2,y:height/2},dx=end.x-centre.x,dy=end.y-centre.y;
  if(shape!.type==='ellipse'||shape!.type==='circle'){
    const rx=shape!.type==='circle'?Math.min(width,height)/2:width/2,ry=shape!.type==='circle'?rx:height/2;
    const t=1/Math.sqrt(dx*dx/(rx*rx)+dy*dy/(ry*ry));return {x:centre.x+dx*t,y:centre.y+dy*t};
  }
  const knots=shape!.type==='bezier'?shapeKnots(shape!):undefined;
  const points=knots?knots.flatMap((p,i)=>Array.from({length:64},(_,j)=>cubic(p,p.out,knots[(i+1)%knots.length].in,knots[(i+1)%knots.length],j/64))):shapeVertices(shape!);
  const scaled=points.map(p=>({x:p.x/100*width,y:p.y/100*height}));
  let best=Infinity;
  for(let i=0;i<scaled.length;i++){
    const a=scaled[i],b=scaled[(i+1)%scaled.length],ex=b.x-a.x,ey=b.y-a.y,den=dx*ey-dy*ex;
    if(Math.abs(den)<1e-9)continue;
    const ax=a.x-centre.x,ay=a.y-centre.y,t=(ax*ey-ay*ex)/den,u=(ax*dy-ay*dx)/den;
    if(t>=0&&u>=0&&u<=1)best=Math.min(best,t);
  }
  return Number.isFinite(best)?{x:centre.x+dx*best,y:centre.y+dy*best}:end;
}
// Split a cubic at its midpoint without changing the existing outline.
export function splitShapeSegment(points:BezierKnot[],index:number):BezierKnot[] {
  const result=structuredClone(points),a=result[index],b=result[(index+1)%result.length];
  const mid=(a:ShapePoint,b:ShapePoint)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  const p=mid(a,a.out),q=mid(a.out,b.in),r=mid(b.in,b),s=mid(p,q),t=mid(q,r),anchor=mid(s,t);
  a.out=p;b.in=r;result.splice(index+1,0,{...anchor,in:s,out:t});return result;
}

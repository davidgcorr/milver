import { getBezierPath, getSmoothStepPath, Position } from '@xyflow/react';
import type { FlowSettings } from './model';
export type PathEnds = { sourceX: number; sourceY: number; targetX: number; targetY: number; sourcePosition: Position; targetPosition: Position };
function basePath(ends: PathEnds, settings: FlowSettings = {}, radius=8): string {
  const points = settings.points ?? [];
  if (!points.length) return (settings.route === 'bezier' ? getBezierPath(ends) : getSmoothStepPath({ ...ends, borderRadius: radius }))[0];
  const all = [{ x: ends.sourceX, y: ends.sourceY }, ...points, { x: ends.targetX, y: ends.targetY }];
  if (settings.route !== 'bezier') return all.slice(0, -1).map((p, i) => {
    const q = all[i + 1];
    const horizontal = Math.abs(q.x - p.x) >= Math.abs(q.y - p.y);
    const direction = horizontal ? q.x >= p.x ? Position.Right : Position.Left : q.y >= p.y ? Position.Bottom : Position.Top;
    const opposite = { left: Position.Right, right: Position.Left, top: Position.Bottom, bottom: Position.Top };
    const [path] = getSmoothStepPath({ sourceX: p.x, sourceY: p.y, targetX: q.x, targetY: q.y, sourcePosition: i === 0 ? ends.sourcePosition : direction, targetPosition: i === all.length - 2 ? ends.targetPosition : opposite[direction], borderRadius: radius });
    return i ? path.replace(/^M/, 'L') : path;
  }).join(' ');
  // Catmull–Rom to cubic Bézier: the curve passes through every editable waypoint.
  let path = `M ${all[0].x} ${all[0].y}`;
  for (let i = 0; i < all.length - 1; i++) {
    const a = all[Math.max(0, i - 1)], b = all[i], c = all[i + 1], d = all[Math.min(all.length - 1, i + 2)];
    path += ` C ${b.x + (c.x - a.x) / 6} ${b.y + (c.y - a.y) / 6}, ${c.x - (d.x - b.x) / 6} ${c.y - (d.y - b.y) / 6}, ${c.x} ${c.y}`;
  }
  return path;
}

export type RoutePoint = { x: number; y: number };
function distinct(points: RoutePoint[]): RoutePoint[] {
  return points.filter((point,i)=>!i||point.x!==points[i-1].x||point.y!==points[i-1].y);
}
export function orthogonalRoute(ends: PathEnds, settings: FlowSettings = {}): RoutePoint[] {
  if(settings.routePoints?.length) {
    const source={x:ends.sourceX,y:ends.sourceY},target={x:ends.targetX,y:ends.targetY};
    const points=[source,...settings.routePoints.map(point=>({...point})),target],result=[source];
    for(let i=1;i<points.length;i++) {
      const a=result.at(-1)!,b=points[i];
      if(a.x!==b.x&&a.y!==b.y) {
        const horizontal=i===1 ? [Position.Left,Position.Right].includes(ends.sourcePosition)
          : i===points.length-1 ? ![Position.Left,Position.Right].includes(ends.targetPosition) : true;
        result.push(horizontal?{x:b.x,y:a.y}:{x:a.x,y:b.y});
      }
      result.push(b);
    }
    return distinct(result);
  }
  // Ask React Flow for its square-corner route. M/L/Q coordinates with radius 0
  // describe the exact vertices; duplicate Q control/end points are discarded.
  const coordinates=basePath(ends,{...settings,route:'smoothstep'},0).match(/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi)?.map(Number)??[];
  const points:RoutePoint[]=[];
  for(let i=0;i<coordinates.length;i+=2)points.push({x:coordinates[i],y:coordinates[i+1]});
  const route=distinct(points);
  if(route.length===2) {
    const [a,b]=route,horizontal=a.y===b.y,distance=horizontal?b.x-a.x:b.y-a.y;
    if(distance){const gap=Math.sign(distance)*Math.min(20,Math.abs(distance)/3);return [a,horizontal?{x:a.x+gap,y:a.y}:{x:a.x,y:a.y+gap},horizontal?{x:b.x-gap,y:b.y}:{x:b.x,y:b.y-gap},b];}
  }
  return route;
}
function roundedRoute(points: RoutePoint[],radius=8):string {
  if(!points.length)return '';
  let path=`M${points[0].x} ${points[0].y}`;
  for(let i=1;i<points.length-1;i++) {
    const a=points[i-1],b=points[i],c=points[i+1],ab=Math.hypot(b.x-a.x,b.y-a.y),bc=Math.hypot(c.x-b.x,c.y-b.y);
    if(!ab||!bc||(a.x===b.x&&b.x===c.x)||(a.y===b.y&&b.y===c.y)){path+=` L${b.x} ${b.y}`;continue;}
    const r=Math.min(radius,ab/2,bc/2);
    path+=` L${b.x-(b.x-a.x)/ab*r} ${b.y-(b.y-a.y)/ab*r} Q${b.x} ${b.y} ${b.x+(c.x-b.x)/bc*r} ${b.y+(c.y-b.y)/bc*r}`;
  }
  return path+` L${points.at(-1)!.x} ${points.at(-1)!.y}`;
}
export function moveRouteSegment(points: RoutePoint[],index:number,coordinate:number):RoutePoint[] {
  if(index<1||index>=points.length-2||!Number.isFinite(coordinate))return points;
  const a=points[index],b=points[index+1],horizontal=a.y===b.y;
  const movedA=horizontal?{x:a.x,y:coordinate}:{x:coordinate,y:a.y};
  const movedB=horizontal?{x:b.x,y:coordinate}:{x:coordinate,y:b.y};
  const before=points[index-1],after=points[index+2],result=points.slice(0,index);
  if(before.x!==movedA.x&&before.y!==movedA.y)result.push(horizontal?{x:movedA.x,y:before.y}:{x:before.x,y:movedA.y});
  result.push(movedA,movedB);
  if(after.x!==movedB.x&&after.y!==movedB.y)result.push(horizontal?{x:movedB.x,y:after.y}:{x:after.x,y:movedB.y});
  return distinct([...result,...points.slice(index+2)]);
}
export function connectionPath(ends:PathEnds,settings:FlowSettings={}):string {
  return settings.route!=='bezier'&&settings.routePoints?.length ? roundedRoute(orthogonalRoute(ends,settings)) : basePath(ends,settings);
}

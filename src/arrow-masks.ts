import { roughPaths } from './rough';
import type { RoutePoint } from './connections';
export const arrowMasks = ['plain', 'pipe', 'rough', 'spiral', 'dashed'] as const;
export type ArrowMask = typeof arrowMasks[number];
export type WireLayer = { d: string; stroke: string; strokeWidth: number; strokeOpacity?: number; strokeDasharray?: string };

// Sample the absolute M/L/Q/C commands emitted by our connection router.
export function pathSpans(path: string): RoutePoint[][] {
  const commands = path.match(/[MLQC][^MLQC]*/gi) ?? [];
  let start = { x: 0, y: 0 };
  const spans: RoutePoint[][] = [];
  for (const command of commands) {
    const n = command.slice(1).match(/[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi)?.map(Number) ?? [];
    const kind = command[0].toUpperCase();
    if (kind === 'M') { start = { x: n[0], y: n[1] }; continue; }
    const end = { x: n[n.length - 2], y: n[n.length - 1] };
    const steps = kind === 'L' ? 1 : 64;
    const points = [start];
    for (let i = 1; i <= steps; i++) {
      const t = i / steps, u = 1 - t;
      points.push(kind === 'C' ? { x: u**3*start.x+3*u*u*t*n[0]+3*u*t*t*n[2]+t**3*end.x, y: u**3*start.y+3*u*u*t*n[1]+3*u*t*t*n[3]+t**3*end.y }
        : kind === 'Q' ? { x: u*u*start.x+2*u*t*n[0]+t*t*end.x, y: u*u*start.y+2*u*t*n[1]+t*t*end.y }
        : end);
    }
    spans.push(points); start = end;
  }
  return spans;
}
export function nearestSpan(path: string, point: RoutePoint): number {
  let best = Infinity, index = 0;
  pathSpans(path).forEach((span, spanIndex) => {
    for (let i = 1; i < span.length; i++) {
      const a = span[i-1], b = span[i], dx = b.x-a.x, dy = b.y-a.y;
      const t = Math.max(0, Math.min(1, ((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy || 1)));
      const distance = (point.x-a.x-t*dx)**2+(point.y-a.y-t*dy)**2;
      if (distance < best) { best = distance; index = spanIndex; }
    }
  });
  return index;
}
function spiralPath(path: string, width: number): string {
  const points = pathSpans(path).flatMap((span, i) => i ? span.slice(1) : span);
  const total = points.reduce((sum,p,i) => i ? sum+Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y) : 0,0);
  let distance = 0, result = '';
  for (let i = 1; i < points.length; i++) {
    const a = points[i-1], b = points[i], length = Math.hypot(b.x-a.x,b.y-a.y);
    if (!length) continue;
    const count = Math.min(4096, Math.max(1, Math.ceil(length / 2)));
    for (let j = 0; j < count; j++) {
      const t = j / count, phase = (distance + t*length) / 18 * Math.PI * 2;
      const taper = Math.min(1, (distance+t*length)/12, (total-distance-t*length)/12);
      const normal = Math.sin(phase)*(4+width)*taper, along = (Math.cos(phase)-1)*3*taper;
      const x = a.x+(b.x-a.x)*t+((b.x-a.x)*along-(b.y-a.y)*normal)/length;
      const y = a.y+(b.y-a.y)*t+((b.y-a.y)*along+(b.x-a.x)*normal)/length;
      result += `${result ? 'L' : 'M'}${x} ${y}`;
    }
    distance += length;
  }
  const end = points.at(-1);
  return end ? result+`L${end.x} ${end.y}` : path;
}
export function wireLayers(path: string, mask: ArrowMask, color: string, width: number, id: string, roughness = 1): WireLayer[] {
  if (mask === 'rough') return roughPaths(path,id,color,width,roughness).map(p => ({ d:p.d, stroke:p.stroke, strokeWidth:p.strokeWidth }));
  if (mask === 'pipe') return [{ d:path,stroke:color,strokeWidth:width+6,strokeOpacity:0.4 }, { d:path,stroke:color,strokeWidth:width+2 }, { d:path,stroke:'#ffffff',strokeWidth:Math.max(1,width*0.65),strokeOpacity:0.7 }];
  return [{ d:mask === 'spiral' ? spiralPath(path,width) : path, stroke:color, strokeWidth:width, ...(mask === 'dashed' ? { strokeDasharray:'8 6' } : {}) }];
}

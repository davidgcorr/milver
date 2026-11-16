import { expect, it } from 'vitest';
import { Position } from '@xyflow/react';
import { arrowMasks, nearestSpan, pathSpans, wireLayers } from './arrow-masks';
import { connectionPath, moveRouteSegment, orthogonalRoute } from './connections';
import { exampleDiagram, parseDiagram, serializeDiagram, parseFlowSettings } from './model';
import { buildScene, collectPages, defaultExportOptions } from './export/scene';
const ends={sourceX:0,sourceY:0,targetX:200,targetY:100,sourcePosition:Position.Right,targetPosition:Position.Left};
it('moves every orthogonal segment including both attached ends and a single segment',()=>{
  for(const route of [orthogonalRoute(ends),[{x:0,y:0},{x:200,y:0}],[{x:0,y:0},{x:0,y:200}]]) {
    for(let i=0;i<route.length-1;i++) {
      const moved=moveRouteSegment(route,i,70);
      expect(moved[0]).toEqual(route[0]);expect(moved.at(-1)).toEqual(route.at(-1));
      expect(moved.some(p=>route[i].y===route[i+1].y?p.y===70:p.x===70)).toBe(true);
      for(let j=1;j<moved.length;j++)expect(moved[j].x===moved[j-1].x||moved[j].y===moved[j-1].y).toBe(true);
    }
  }
});
it('locates new waypoints on the actual curve in route order',()=>{
  const path=connectionPath(ends,{route:'bezier',points:[{x:80,y:-100},{x:150,y:180}]});
  const spans=pathSpans(path);expect(spans).toHaveLength(3);
  spans.forEach((span,index)=>expect(nearestSpan(path,span[32])).toBe(index));
});
it.each(arrowMasks)('persists and exports the %s mask',mask=>{
  const diagram=exampleDiagram();diagram.edges[0].data={mask};
  expect(parseDiagram(serializeDiagram(diagram)).edges[0].data?.mask).toBe(mask);
  const layers=wireLayers('M0 0 C50 0 50 100 100 100',mask,'#123456',2,'wire');
  expect(layers.length).toBeGreaterThan(0);
  for(const layer of layers) { expect(layer.d).not.toMatch(/NaN|Infinity/); expect(layer.strokeWidth).toBeGreaterThan(0); }
  const scene=buildScene(diagram,collectPages(diagram,[],'current'),defaultExportOptions);
  if(mask==='pipe')expect(scene.body).toContain('stroke-opacity="0.4"');
  if(mask==='dashed')expect(scene.body).toContain('stroke-dasharray="8 6"');
  if(mask==='rough')expect(layers[0].d).not.toBe('M0 0 C50 0 50 100 100 100');
  if(mask==='spiral')expect(layers[0].d.match(/L/g)!.length).toBeGreaterThan(50);
});
it('rejects unknown arrow masks',()=>expect(()=>parseFlowSettings({mask:'unknown'})).toThrow());

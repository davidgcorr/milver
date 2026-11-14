import { expect,it } from 'vitest';
import { Position } from '@xyflow/react';
import { connectionPath,orthogonalRoute,moveRouteSegment } from './connections';
import { makeNode,exampleDiagram,parseDiagram,serializeDiagram } from './model';
import { snapConnectedBlocks } from './block-snapping';
const ends={sourceX:0,sourceY:0,targetX:200,targetY:100,sourcePosition:Position.Right,targetPosition:Position.Left};
const wire=(source:string,target:string)=>({id:'wire',source,target,sourceHandle:'out-0',targetHandle:'in-0',type:'smoothstep'});
function orthogonal(points:{x:number;y:number}[]){for(let i=1;i<points.length;i++)expect(points[i].x===points[i-1].x||points[i].y===points[i-1].y).toBe(true);}
it('moves both horizontal and vertical middle segments while keeping endpoints attached',()=>{
  const route=orthogonalRoute(ends);orthogonal(route);
  for(let i=1;i<route.length-2;i++) {
    const moved=moveRouteSegment(route,i,75);orthogonal(moved);
    expect(moved[0]).toEqual(route[0]);expect(moved.at(-1)).toEqual(route.at(-1));
    const settings={routePoints:moved.slice(1,-1)};
    expect(connectionPath(ends,settings)).toContain('Q');
    const reattached=orthogonalRoute({...ends,sourceY:20,targetX:240,targetY:160},settings);orthogonal(reattached);
    expect(reattached[0]).toEqual({x:0,y:20});expect(reattached.at(-1)).toEqual({x:240,y:160});
  }
});
it('creates doglegs when dragging the middle of a straight orthogonal connection',()=>{
  const flat={...ends,targetY:0},route=orthogonalRoute(flat);
  expect(route.length).toBeGreaterThan(3);
  const moved=moveRouteSegment(route,1,60);orthogonal(moved);expect(moved.some(point=>point.y===60)).toBe(true);
  const diagram=exampleDiagram();diagram.edges[0].data={routePoints:moved.slice(1,-1)};
  expect(parseDiagram(serializeDiagram(diagram)).edges[0].data).toEqual(diagram.edges[0].data);
});
it('snaps connected ports, respects differing block dimensions and preserves a moving selection',()=>{
  const a=makeNode('constant',{x:0,y:0},'a'),b=makeNode('gain',{x:300,y:45},'b'),c=makeNode('constant',{x:500,y:200},'c');
  a.height=200;b.height=100;
  const next=snapConnectedBlocks([a,b,c],[wire('a','b')],new Set(['b','c']));
  expect(next[1].position.y).toBe(50);expect(next[2].position.y).toBe(205);expect(next[0]).toBe(a);
  expect(snapConnectedBlocks([a,{...b,position:{x:300,y:80}}],[wire('a','b')],new Set(['b']))[1].position.y).toBe(80);
  a.data.ports[0].side='bottom';b.data.ports[0].side='top';b.position={x:5,y:300};a.width=b.width=200;
  expect(snapConnectedBlocks([a,b],[wire('a','b')],new Set(['b']))[1].position.x).toBe(0);
});

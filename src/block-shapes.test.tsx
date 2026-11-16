// @vitest-environment jsdom
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { ReactFlowProvider } from '@xyflow/react';
import { expect, it, vi } from 'vitest';
import { blockShapePath, blockShapeTypes, defaultBezierPoints, parseBlockShape, shapePortPoint, splitShapeSegment, type BlockShape } from './block-shapes';
import { exampleDiagram, makeNode, parseDiagram, serializeDiagram } from './model';
import { pathSpans } from './arrow-masks';
import { Block } from './components/block-node';
import { BlockShapeEditor } from './components/block-shape-editor';
import { TooltipProvider } from './components/ui/tooltip';
import { buildScene, collectPages, defaultExportOptions, handlePoint } from './export/scene';
import { exportProjectJson } from './export/json';
import { exportHtml } from './export/html';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
(globalThis as any).ResizeObserver=class {observe(){}unobserve(){}disconnect(){}};
it.each(blockShapeTypes)('round trips and renders the %s shape, including nested and saved blocks',async type=>{
  const shape:BlockShape={type,sides:7,rotation:25,points:defaultBezierPoints()};
  shape.points![0].out={x:90,y:12};
  const diagram=exampleDiagram(),parent=makeNode('subsystem',{x:0,y:500},'parent');
  const node=makeNode('javascript',{x:30,y:30},'shape');node.data.visuals={shape,background:'#123456',strokeWidth:2,opacity:0.8};
  parent.data.canvas!.nodes.push(node);diagram.nodes.push(parent);diagram.myBlocks=[{id:'saved',name:'Saved shape',width:node.width!,height:node.height!,data:structuredClone(node.data)}];
  const json=await exportProjectJson(diagram),restored=parseDiagram(json);
  expect(restored).toEqual(diagram);
  const markup=renderToStaticMarkup(createElement(ReactFlowProvider,null,createElement(Block,{...node,selected:true,width:node.width,height:node.height,positionAbsoluteX:30,positionAbsoluteY:30} as any)));
  if(type!=='rectangle'){
    const d=blockShapePath(shape,node.width!,node.height!);
    expect(markup).toContain('shaped-block');expect(markup).toContain(`d="${d}"`);expect(markup).toContain('clip-path:path(');
    const scene=buildScene(restored,collectPages(restored,['parent'],'current'),defaultExportOptions,false,true);
    expect(scene.body).toContain(`d="${d}"`);expect(scene.masks?.find(mask=>mask.label===node.data.label)?.clipPath).toBe(d);
  }
  expect(parseDiagram(serializeDiagram(restored))).toEqual(restored);
});
it('places ports on ellipse, circle, diamond and custom outlines consistently with export',()=>{
  const diamond=shapePortPoint({type:'diamond'},200,100,'left',0.25);expect(diamond.x).toBeCloseTo(100/3);expect(diamond.y).toBeCloseTo(100/3);
  const ellipse=shapePortPoint({type:'ellipse'},200,100,'left',0.25);
  expect(((ellipse.x-100)/100)**2+((ellipse.y-50)/50)**2).toBeCloseTo(1);
  const circle=shapePortPoint({type:'circle'},200,100,'left',0.5);expect(circle).toEqual({x:50,y:50});
  const bezier=shapePortPoint({type:'bezier'},200,100,'left',0.25);expect(bezier.x).toBeCloseTo(ellipse.x,0);
  const node=makeNode('constant',{x:30,y:40});node.width=200;node.height=100;node.data.visuals={shape:{type:'ellipse'}};
  node.data.ports[0].side='left';node.data.ports[0].offset=0.25;
  expect(handlePoint(node,node.data.ports[0])).toEqual({x:30+ellipse.x,y:40+ellipse.y});
});
it('splits a Bézier segment without changing the curve',()=>{
  const points=defaultBezierPoints(),split=splitShapeSegment(points,0);
  expect(split).toHaveLength(5);expect(points).toEqual(defaultBezierPoints());
  const before=pathSpans(blockShapePath({type:'bezier',points},100,100)),after=pathSpans(blockShapePath({type:'bezier',points:split},100,100));
  expect(after[0].at(-1)!.x).toBeCloseTo(before[0][32].x);expect(after[0].at(-1)!.y).toBeCloseTo(before[0][32].y);
  expect(after[0][32].x).toBeCloseTo(before[0][16].x);expect(after[0][32].y).toBeCloseTo(before[0][16].y);
  expect(after[1][32].x).toBeCloseTo(before[0][48].x);expect(after[1][32].y).toBeCloseTo(before[0][48].y);
});
it('validates shape settings and rejects malformed controls before replacing a project',()=>{
  for(const shape of [{type:'unknown'},{type:'polygon',sides:2},{type:'polygon',rotation:Infinity},{type:'bezier',points:[]},{type:'bezier',points:defaultBezierPoints().map(p=>({...p,in:{x:NaN,y:0}}))}])expect(()=>parseBlockShape(shape)).toThrow();
  const project=exampleDiagram();project.nodes[0].data.visuals={shape:{type:'bezier',points:defaultBezierPoints()}};
  const raw=JSON.parse(serializeDiagram(project));raw.nodes[0].data.visuals.shape.points[0].out.x=101;
  expect(()=>parseDiagram(JSON.stringify(raw))).toThrow('Bézier');
});
it('edits Bézier anchors and handles, adds and removes points, and commits each drag once',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  let shape:BlockShape={type:'bezier',points:defaultBezierPoints()};const changed=vi.fn();
  function View(){const[current,setCurrent]=useState(shape);return createElement(TooltipProvider,null,createElement(BlockShapeEditor,{shape:current,change:next=>{shape=next;changed(next);setCurrent(next);}}));}
  const pointer=(type:string,x:number,y:number)=>{const event=new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:1});return event;};
  try{
    await act(async()=>root.render(createElement(View)));
    await act(async()=>host.querySelector('[aria-label="Shape out handle 1"]')!.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'ArrowRight',shiftKey:true})));
    expect(shape.points![0].out.x).toBeCloseTo(77.864);
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Add point')!.click());expect(shape.points).toHaveLength(5);
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==='Remove point')!.click());expect(shape.points).toHaveLength(4);
    const svg=host.querySelector('svg.bezier-shape-editor')! as SVGSVGElement;
    svg.setPointerCapture=vi.fn();svg.hasPointerCapture=()=>true;svg.releasePointerCapture=vi.fn();svg.getBoundingClientRect=()=>({left:0,top:0,width:248,height:248} as DOMRect);
    const count=changed.mock.calls.length;
    await act(async()=>host.querySelector('[aria-label="Shape anchor 1"]')!.dispatchEvent(pointer('pointerdown',224,124)));
    await act(async()=>svg.dispatchEvent(pointer('pointermove',204,124)));
    expect(changed).toHaveBeenCalledTimes(count);
    await act(async()=>svg.dispatchEvent(pointer('pointerup',204,124)));
    expect(changed).toHaveBeenCalledTimes(count+1);expect(shape.points![0].x).toBeCloseTo(90);expect(shape.points![0].y).toBeCloseTo(50);
    expect(svg.releasePointerCapture).toHaveBeenCalledWith(1);
  }finally{await act(async()=>root.unmount());host.remove();}
});
it('clips live HTML block masks to the configured outline',async()=>{
  const project=exampleDiagram();project.nodes=[makeNode('javascript',{x:0,y:0},'ellipse')];project.edges=[];
  project.nodes[0].data.visuals={shape:{type:'ellipse'}};
  const html=await exportHtml(project,[],defaultExportOptions);
  expect(html).toContain("clip-path:path('M");expect(html).toContain('data-shape-frame');
});

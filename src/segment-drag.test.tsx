// @vitest-environment jsdom
import { act,createElement,useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Position,ReactFlowProvider } from '@xyflow/react';
import { expect,it,vi } from 'vitest';
import { FlowContext,FlowEdge } from './components/flow-edge';
import { orthogonalRoute } from './connections';
import type { FlowSettings } from './model';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('drags an intermediate wire segment, records one undo snapshot and releases capture',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const snapshot=vi.fn(),updates=vi.fn();let settings:FlowSettings={};
  const ends={sourceX:0,sourceY:0,targetX:200,targetY:100,sourcePosition:Position.Right,targetPosition:Position.Left};
  function View(){const[data,setData]=useState<FlowSettings>({});return createElement(ReactFlowProvider,null,createElement(FlowContext.Provider,{value:{snapshot,update:(id,patch,remember)=>{updates(id,patch,remember);settings={...settings,...patch};setData(settings);}}},createElement('svg',null,createElement(FlowEdge,{id:'wire',source:'a',target:'b',selected:true,...ends,data} as any))));}
  const event=(type:string,x:number,y:number)=>{const event=new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y});Object.defineProperty(event,'pointerId',{value:7});return event;};
  try{
    await act(async()=>root.render(createElement(View)));
    const handle=host.querySelector<SVGPathElement>('[aria-label^="Move vertical segment"]')!;expect(handle).not.toBeNull();
    handle.setPointerCapture=vi.fn();handle.hasPointerCapture=()=>true;handle.releasePointerCapture=vi.fn();
    const original=Number(handle.getAttribute('aria-valuenow'));
    await act(async()=>handle.dispatchEvent(event('pointerdown',original,50)));
    await act(async()=>handle.dispatchEvent(event('pointermove',original+40,50)));
    expect(snapshot).toHaveBeenCalledTimes(1);expect(updates).toHaveBeenCalledWith('wire',expect.objectContaining({routePoints:expect.any(Array)}),false);
    expect(orthogonalRoute(ends,settings).some((point,i,route)=>i>0&&point.x===original+40&&route[i-1].x===original+40)).toBe(true);
    await act(async()=>handle.dispatchEvent(event('pointerup',original+40,50)));
    expect(handle.releasePointerCapture).toHaveBeenCalledWith(7);
    const count=updates.mock.calls.length;await act(async()=>handle.dispatchEvent(event('pointermove',original+80,50)));expect(updates).toHaveBeenCalledTimes(count);
  }finally{await act(async()=>root.unmount());host.remove();}
});

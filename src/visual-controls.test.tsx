// @vitest-environment jsdom
import {act,createElement,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
import {VisualProperties} from './components/visual-properties';
import {TooltipProvider} from './components/ui/tooltip';
import {makeJsNode} from './js-recipes';
import {parseDiagram,serializeDiagram} from './model';
import {buildScene,collectPages,defaultExportOptions} from './export/scene';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('keeps sliders and editable numbers in sync, supports opacity, and respects code ownership',async()=>{
  vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
  let node=makeJsNode('DOM',{x:0,y:0});const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  function View(){const[current,setNode]=useState(node);node=current;return createElement(TooltipProvider,null,createElement(VisualProperties,{node:current,update:patch=>setNode(previous=>({...previous,data:{...previous.data,...patch}})),resize:(dimension,value)=>setNode(previous=>({...previous,[dimension]:value}))}));}
  const key=async(label:string,key:string)=>act(async()=>host.querySelector(`[role="slider"][aria-label="${label} slider"]`)!.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true})));
  const number=async(label:string,value:string)=>act(async()=>{const input=host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
  try{
    await act(async()=>root.render(createElement(View)));
    await key('Block width','ArrowRight');expect(node.width).toBe(241);expect(host.querySelector<HTMLInputElement>('input[aria-label="Block width"]')!.value).toBe('241');
    await number('Block height','350');expect(node.height).toBe(350);expect(host.querySelector('[role="slider"][aria-label="Block height slider"]')!.getAttribute('aria-valuenow')).toBe('350');
    await key('Block corner radius','End');expect(node.data.visuals?.radius).toBe(60);
    await number('Block shadow','14');expect(node.data.visuals?.shadow).toBe(14);
    await number('Block stroke width','3.5');expect(node.data.visuals?.strokeWidth).toBe(3.5);
    await number('Block stroke color','#123456');expect(node.data.visuals?.strokeColor).toBe('#123456');
    await number('Block opacity','45');expect(node.data.visuals?.opacity).toBe(.45);
    await number('Block width','1');expect(node.width).toBe(241);
    await act(async()=>host.querySelector('input[aria-label="Block width"]')!.dispatchEvent(new FocusEvent('focusout',{bubbles:true})));expect(node.width).toBe(120);
    const diagram={version:1 as const,name:'Visuals',nodes:[node],edges:[],viewport:{x:0,y:0,zoom:1}};
    const restored=parseDiagram(serializeDiagram(diagram));expect(restored.nodes[0].data.visuals).toMatchObject({opacity:.45,shadow:14,strokeWidth:3.5,strokeColor:'#123456'});
    const exported=buildScene(restored,collectPages(restored,[],'current'),defaultExportOptions).body;expect(exported).toContain('feDropShadow');expect(exported).toContain('stroke="#123456" stroke-width="3.5"');
    expect(buildScene(restored,collectPages(restored,[],'current'),defaultExportOptions).body).toContain('opacity="0.45"');
    node={...node,data:{...node.data,controlledProperties:['width','visuals.opacity','visuals.shadow','visuals.strokeWidth','visuals.strokeColor']}};
    await act(async()=>root.render(createElement(TooltipProvider,null,createElement(VisualProperties,{node,update(){},resize(){}}))));
    for(const label of ['Block opacity','Block shadow','Block stroke width','Block stroke color'])expect(host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!.disabled).toBe(true);
    expect(host.querySelector('[data-slot="slider"][aria-label="Block width slider"]')!.hasAttribute('data-disabled')).toBe(true);
    (diagram.nodes[0].data as any).visuals.opacity=1.1;expect(()=>parseDiagram(serializeDiagram(diagram))).toThrow('opacity');
  }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});

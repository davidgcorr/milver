import { expect,it } from 'vitest';
import { roughPaths } from './rough';
import { defaultTheme,exampleDiagram,parseDiagram,serializeDiagram } from './model';
import { buildScene,collectPages,defaultExportOptions,sceneSvg } from './export/scene';
it('keeps hand-drawn paths stable between rerenders',()=>{
  const a=roughPaths('M0 0L100 0L100 100','edge-a','#333');
  expect(a).toEqual(roughPaths('M0 0L100 0L100 100','edge-a','#333'));
  expect(a).not.toEqual(roughPaths('M0 0L100 0L100 100','edge-b','#333'));
});
it('round trips rough mode and preserves it in publication output',()=>{
  const d=exampleDiagram();d.theme={...defaultTheme,rough:true};
  expect(parseDiagram(serializeDiagram(d)).theme?.rough).toBe(true);
  const scene=buildScene(d,collectPages(d,[],'current'),defaultExportOptions);
  expect(scene.rough).toBe(true);
  const svg=sceneSvg(scene,defaultExportOptions);
  expect(svg).toContain('C');expect(svg).toBe(sceneSvg(scene,defaultExportOptions));
  (d.theme as any).rough='yes';expect(()=>parseDiagram(serializeDiagram(d))).toThrow('rough');
});
it('round trips roughness and applies it to blocks, wires and exported arrows',()=>{
  const d=exampleDiagram();d.theme={...defaultTheme,rough:true,roughness:2.4};
  expect(parseDiagram(serializeDiagram(d)).theme?.roughness).toBe(2.4);
  const options=defaultExportOptions;
  const a=sceneSvg(buildScene(d,collectPages(d,[],'current'),options),options);
  d.theme.roughness=0;
  const b=sceneSvg(buildScene(d,collectPages(d,[],'current'),options),options);
  expect(a).not.toBe(b);
  expect(roughPaths('M0 0L100 100','test','#000',1,0)).not.toEqual(roughPaths('M0 0L100 100','test','#000',1,3));
  d.theme.roughness=3.1;expect(()=>parseDiagram(serializeDiagram(d))).toThrow('roughness');
});

it('migrates either legacy sketch flag to one canonical rough setting',()=>{
  for(const flags of [{rough:true,excalidraw:false},{rough:false,excalidraw:true},{excalidraw:true},{rough:true}]){
    const d=exampleDiagram();d.theme={...defaultTheme,...flags};
    const restored=parseDiagram(JSON.stringify(d));
    expect(restored.theme?.rough).toBe(true);
    expect(restored.theme).not.toHaveProperty('excalidraw');
    restored.theme!.rough=false;
    expect(parseDiagram(serializeDiagram(restored)).theme?.rough).toBe(false);
  }
});

it('exports rough outlines with the configured per-block corner radius',()=>{
  const d=exampleDiagram();d.theme={...defaultTheme,rough:true,radius:0};d.nodes=[d.nodes[0]];d.edges=[];
  const outlines=()=>buildScene(d,collectPages(d,[],'current'),defaultExportOptions).body.match(/<path d="[^"]+" fill="none" stroke="[^"]+" stroke-width="1.2"\/>/g);
  const square=outlines();expect(square?.length).toBeGreaterThan(0);
  d.nodes[0].data.visuals={radius:28};expect(outlines()).not.toEqual(square);
  d.nodes[0].data.visuals={radius:0};d.theme.radius=20;expect(outlines()).toEqual(square);
});

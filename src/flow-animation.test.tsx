import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Position,ReactFlowProvider } from '@xyflow/react';
import { expect,it } from 'vitest';
import { FlowEdge } from './components/flow-edge';
import { exampleDiagram,parseDiagram,serializeDiagram,parseFlowSettings } from './model';
import { buildScene,collectPages,defaultExportOptions } from './export/scene';
it('round trips glow and element size and uses them for the live pulse and GIF scene',()=>{
  const diagram=exampleDiagram();diagram.edges[0].data={animation:'glow',animationSize:12,speed:3,reverse:true};
  const restored=parseDiagram(serializeDiagram(diagram));expect(restored.edges[0].data).toEqual(diagram.edges[0].data);
  const markup=renderToStaticMarkup(createElement(ReactFlowProvider,null,createElement(FlowEdge,{id:'glow',source:'a',target:'b',sourceX:0,sourceY:0,targetX:100,targetY:100,sourcePosition:Position.Right,targetPosition:Position.Left,data:restored.edges[0].data} as any)));
  expect(markup).toContain('r="6"');expect(markup).toContain('filter="url(#');expect(markup).toContain('dur="3s"');expect(markup).toContain('keyPoints="1;0"');
  expect(buildScene(restored,collectPages(restored,[],'current'),defaultExportOptions).wires[0]).toMatchObject({animationSize:12,glow:true,reverse:true});
  expect(()=>parseFlowSettings({animationSize:0})).toThrow('connection');expect(()=>parseFlowSettings({animationSize:33})).toThrow('connection');
});

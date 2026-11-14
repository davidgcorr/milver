import type { BlockNode, Canvas, Port } from './model';
import { portOffset } from './ports';
function portPoint(node: BlockNode, port: Port) {
  const w=node.width ?? node.measured?.width ?? 164,h=node.height ?? node.measured?.height ?? 116,fraction=portOffset(node.data.ports,port);
  return {x:node.position.x+(port.side==='left'?0:port.side==='right'?w:w*fraction),y:node.position.y+(port.side==='top'?0:port.side==='bottom'?h:h*fraction)};
}
// Move a dragged selection as a unit, aligning the actual connected ports.
export function snapConnectedBlocks(nodes: BlockNode[], edges: Canvas['edges'], moving: Set<string>, threshold=12): BlockNode[] {
  const byId=new Map(nodes.map(node=>[node.id,node]));let dx: number|undefined,dy: number|undefined;
  for(const edge of edges) {
    if(moving.has(edge.source)===moving.has(edge.target))continue;
    const source=byId.get(edge.source),target=byId.get(edge.target);
    const a=source?.data.ports.find(port=>port.id===edge.sourceHandle),b=target?.data.ports.find(port=>port.id===edge.targetHandle);
    if(!source||!target||!a||!b)continue;
    const p=portPoint(source,a),q=portPoint(target,b),sign=moving.has(edge.source)?1:-1;
    if((a.side==='left'&&b.side==='right')||(a.side==='right'&&b.side==='left')) {
      const delta=(q.y-p.y)*sign;if(Math.abs(delta)<=threshold&&(dy===undefined||Math.abs(delta)<Math.abs(dy)))dy=delta;
    }
    if((a.side==='top'&&b.side==='bottom')||(a.side==='bottom'&&b.side==='top')) {
      const delta=(q.x-p.x)*sign;if(Math.abs(delta)<=threshold&&(dx===undefined||Math.abs(delta)<Math.abs(dx)))dx=delta;
    }
  }
  if(!dx&&!dy)return nodes;
  return nodes.map(node=>moving.has(node.id)?{...node,position:{x:node.position.x+(dx??0),y:node.position.y+(dy??0)}}:node);
}

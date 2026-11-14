import {parseDiagram,serializeDiagram,type Diagram,type Canvas} from '../model';
export function validateProjectEdit(candidate:Diagram):Diagram{
  const parsed=parseDiagram(serializeDiagram(candidate));
  const selection=(clean:Canvas,source:Canvas):Canvas=>({...clean,nodes:clean.nodes.map(node=>{const original=source.nodes.find(item=>item.id===node.id);return {...node,...(original?.selected?{selected:true}:{}),data:{...node.data,...(node.data.canvas&&original?.data.canvas?{canvas:selection(node.data.canvas,original.data.canvas)}:{})}};}),edges:clean.edges.map(edge=>({...edge,...(source.edges.find(item=>item.id===edge.id)?.selected?{selected:true}:{})}))});
  return {...parsed,...selection(parsed,candidate)};
}

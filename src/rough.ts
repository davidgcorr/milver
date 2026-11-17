import rough from 'roughjs';
export const roughGenerator = rough.generator();
export function roundedBlockPath(width:number,height:number,radius:number,inset=2) {
  const x=inset,y=inset,right=Math.max(x,width-inset),bottom=Math.max(y,height-inset);
  const r=Math.max(0,Math.min(radius-inset,(right-x)/2,(bottom-y)/2));
  if(!r)return `M${x} ${y}H${right}V${bottom}H${x}Z`;
  return `M${x+r} ${y}H${right-r}A${r} ${r} 0 0 1 ${right} ${y+r}V${bottom-r}A${r} ${r} 0 0 1 ${right-r} ${bottom}H${x+r}A${r} ${r} 0 0 1 ${x} ${bottom-r}V${y+r}A${r} ${r} 0 0 1 ${x+r} ${y}Z`;
}
export function roughSeed(id: string): number {
  let value=2166136261;for(const char of id)value=Math.imul(value^char.charCodeAt(0),16777619);
  return (value>>>0)%2147483646+1;
}
export function roughPaths(path: string,id: string,color: string,width=1.5,roughness=1) {
  return roughGenerator.toPaths(roughGenerator.path(path,{seed:roughSeed(id),stroke:color,strokeWidth:width,roughness,bowing:0.8,preserveVertices:true}));
}

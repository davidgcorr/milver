import { createContext, useContext, useMemo } from 'react';
import { roughGenerator, roughPaths, roughSeed, roundedBlockPath } from '@/rough';
export const RoughContext=createContext<{enabled:boolean;roughness:number;radius?:number}>({ enabled: false, roughness: 1 });
export function RoughPort({id,color='currentColor'}:{id:string;color?:string}) {
  const {roughness}=useContext(RoughContext);
  const paths=useMemo(()=>roughGenerator.toPaths(roughGenerator.ellipse(8,8,12,12,{seed:roughSeed(id),stroke:color,strokeWidth:1,roughness,fill:'#ffffff',fillStyle:'solid'})),[id,color,roughness]);
  return <svg className="rough-port-outline" viewBox="0 0 16 16" aria-hidden="true">{paths.map((path,i)=><path key={i} d={path.d} stroke={path.stroke} strokeWidth={path.strokeWidth} fill={path.fill}/>)}</svg>;
}
export function RoughPath({ d,id,color,width=1.5 }: { d:string;id:string;color:string;width?:number }) {
  const { roughness }=useContext(RoughContext);
  const paths=useMemo(()=>roughPaths(d,id,color,width,roughness),[d,id,color,width,roughness]);
  return <g className="rough-path" pointerEvents="none">{paths.map((path,i)=><path key={i} d={path.d} stroke={path.stroke} strokeWidth={path.strokeWidth} fill={path.fill}/>)}</g>;
}
export function RoughBlockOutline({id,width,height,circle=false,strokeWidth=1.2,color='var(--primary)',radius}:{id:string;width:number;height:number;circle?:boolean;strokeWidth?:number;color?:string;radius?:number}) {
  const { enabled,roughness,radius:themeRadius=9 }=useContext(RoughContext);
  const cornerRadius=radius??themeRadius;
  const paths=useMemo(()=>{if(!enabled||strokeWidth===0)return [];const inset=Math.max(2,strokeWidth/2+1);const options={seed:roughSeed(id),stroke:'currentColor',strokeWidth,roughness,bowing:0.8};return roughGenerator.toPaths(circle?roughGenerator.ellipse(width/2,height/2,width-2*inset,height-2*inset,options):roughGenerator.path(roundedBlockPath(width,height,cornerRadius,inset),{...options,preserveVertices:true}));},[enabled,roughness,id,width,height,circle,strokeWidth,cornerRadius]);
  if(!enabled)return null;
  return <svg className="rough-block-outline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true" style={{color}}>{paths.map((path,i)=><path key={i} d={path.d} stroke={path.stroke} strokeWidth={path.strokeWidth} fill={path.fill}/>)}</svg>;
}

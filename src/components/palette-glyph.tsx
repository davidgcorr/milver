import {useContext, type ComponentProps} from 'react';
import {BlockIcon} from './block-identity';
import {RoughBlockOutline,RoughContext,RoughPort} from './rough-shapes';

export function PaletteGlyph({data,input=false,output=false,id}:{data:ComponentProps<typeof BlockIcon>['data'];input?:boolean;output?:boolean;id:string}) {
  const {excalidraw}=useContext(RoughContext);
  return <span className={`palette-glyph ${excalidraw?'sketch-palette-glyph':''}`}>
    {excalidraw&&<RoughBlockOutline id={`palette-${id}`} width={40} height={34} strokeWidth={1} color="var(--foreground)"/>}
    <BlockIcon data={data}/>
    {input&&<i className={`palette-input ${excalidraw?'sketch-port':''}`} aria-label="Accepts input">{excalidraw&&<RoughPort id={`palette-${id}-in`} color="#0284c7"/>}</i>}
    {output&&<i className={`palette-output ${excalidraw?'sketch-port':''}`} aria-label="Produces output">{excalidraw&&<RoughPort id={`palette-${id}-out`} output/>}</i>}
  </span>;
}

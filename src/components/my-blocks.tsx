import { ProjectPaletteCard } from './project-palette-card';
import { exampleProjects } from '@/example-projects';
import { parseDiagram } from '@/model';
import { projectsChangedEvent, projectsKey, readProjects } from '@/project-store';
import { PaletteGlyph } from './palette-glyph';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { ProjectContext } from '@/project/context';
import { jsRecipes } from '@/js-recipes';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { IconButton } from './editor-ui';
import { ChevronDown, Trash2 } from 'lucide-react';
function Section({title,children}:{title:string;children:ReactNode}) {
  return <Collapsible defaultOpen className="library-category"><CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="category-toggle"><ChevronDown/><span>{title}</span></Button></CollapsibleTrigger><CollapsibleContent>{children}</CollapsibleContent></Collapsible>;
}
export function MyBlocks({ addExample }: { addExample: (recipe: string) => void }) {
  const { loadExample, openProject, myBlocks, insertSavedBlock, removeSavedBlock } = useContext(ProjectContext);
  const readStored = () => { try { return { projects: readProjects(localStorage), error: '' }; } catch { return { projects: [], error: 'Stored projects could not be read. Open Projects to manage them.' }; } };
  const [stored,setStored] = useState(readStored);
  useEffect(()=>{const refresh=()=>setStored(readStored());const storage=(event: StorageEvent)=>{if(!event.key||event.key===projectsKey)refresh();};window.addEventListener(projectsChangedEvent,refresh);window.addEventListener('storage',storage);return()=>{window.removeEventListener(projectsChangedEvent,refresh);window.removeEventListener('storage',storage);};},[]);
  return <div className="my-blocks">
    <Section title="Block Examples"><div className="palette-grid">{['Three.js', 'LaTeX', 'Counter', 'Trigger', 'WordTokenizer', 'SubwordTokenizer', 'Embedding', 'MetricCard', 'ProgressRing', 'ActionButton', 'InputAppearance', 'Pulse', 'Toggle', 'LibraryBadge', 'IframeMetric', 'IframeChart'].map(name => <Button key={name} variant="ghost" className="palette-tile" draggable onDragStart={event => { event.dataTransfer.setData('application/milver', 'javascript'); event.dataTransfer.setData('application/milver-recipe', name); event.dataTransfer.effectAllowed = 'copy'; }} onClick={() => addExample(name)}><PaletteGlyph id={name} data={{kind:'javascript',recipe:name}} input={jsRecipes[name].inputs>0} output={jsRecipes[name].outputs>0}/><span>{jsRecipes[name].label.replace(/ example$/, '')}</span></Button>)}</div></Section>
    <Section title="Saved Blocks">{!myBlocks.length && <p className="category-empty">No saved blocks yet.</p>}<div className="palette-grid">{myBlocks.map(block=><div className="saved-palette-item" key={block.id}><Button variant="ghost" className="palette-tile" draggable title={`${block.name} · ${block.data.ports.filter(port=>port.type==='input').length} inputs · ${block.data.ports.filter(port=>port.type==='output').length} outputs`} onClick={()=>insertSavedBlock(block)} onDragStart={event=>{event.dataTransfer.setData('application/milver-saved-block',block.id);event.dataTransfer.effectAllowed='copy';}}><PaletteGlyph id={block.id} data={block.data} input={block.data.ports.some(port=>port.type==='input')} output={block.data.ports.some(port=>port.type==='output')}/><span>{block.name}</span></Button><IconButton className="saved-palette-delete" label={`Delete saved block ${block.name}`} size="icon-xs" onClick={()=>removeSavedBlock(block.id)}><Trash2/></IconButton></div>)}</div></Section>
    <Section title="My Projects"><div className="project-palette-list">{stored.error&&<p role="alert" className="field-help">{stored.error}</p>}{stored.projects.map(record=><ProjectPaletteCard key={record.id} project={parseDiagram(record.json)} savedAt={record.updatedAt} open={()=>openProject(parseDiagram(record.json))}/>)}{exampleProjects.map(example=><ProjectPaletteCard key={example.id} project={example.project} description={example.description} example open={()=>loadExample(example.id)}/>)}</div></Section>
  </div>;
}

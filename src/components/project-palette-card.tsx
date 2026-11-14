import { CalendarDays, FileJson2, UserRound, Layers } from 'lucide-react';
import type { Canvas, Diagram } from '@/model';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
export function ProjectPaletteCard({ project, description, savedAt, example = false, open }: { project: Diagram; description?: string; savedAt?: string; example?: boolean; open: () => void }) {
  const count = (canvas: Canvas): number => canvas.nodes.reduce((total,node)=>total+1+(node.data.canvas?count(node.data.canvas):0),0);
  const date=savedAt??project.metadata?.updatedAt??project.metadata?.createdAt;
  return <Button variant="outline" className="project-palette-card" aria-label={`Open project ${project.name}`} onClick={open}>
    <span className="project-card-heading"><FileJson2/><Badge variant="secondary">{example?'Example project':'Saved project'}</Badge></span>
    <strong>{project.name}</strong>{description && <span className="project-card-description">{description}</span>}
    <span className="project-card-meta"><span><UserRound/>{project.metadata?.author || 'Author not set'}</span><span><CalendarDays/>{date?<time dateTime={date}>{new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeZone:'Europe/Berlin'}).format(new Date(date))}</time>:'Date not set'}</span><span><Layers/>{count(project)} blocks</span></span>
  </Button>;
}

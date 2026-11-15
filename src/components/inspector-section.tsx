import type { ReactNode } from 'react';
import { ChevronDown, type LucideIcon } from 'lucide-react';
import { Button } from './ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

export function InspectorSection({ title, icon: Icon, children, defaultOpen = false, className = '' }: {
  title: string; icon: LucideIcon; children: ReactNode; defaultOpen?: boolean; className?: string;
}) {
  return <Collapsible defaultOpen={defaultOpen} className={`inspector-section ${className}`}>
    <CollapsibleTrigger asChild><Button variant="ghost" className="inspector-section-trigger"><Icon/><span>{title}</span><ChevronDown className="section-chevron"/></Button></CollapsibleTrigger>
    <CollapsibleContent forceMount className="inspector-section-content">{children}</CollapsibleContent>
  </Collapsible>;
}

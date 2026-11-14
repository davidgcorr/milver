// @vitest-environment jsdom
import { act,createElement,useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it,vi } from 'vitest';
import { MyBlocks } from './components/my-blocks';
import { TooltipProvider } from './components/ui/tooltip';
import { ProjectContext } from './project/context';
import { makeJsNode } from './js-recipes';
import { parseDiagram,serializeDiagram } from './model';
import { storeProject,writeProjects } from './project-store';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('shows saved definitions as draggable block tiles and live local projects as metadata cards',async()=>{
  localStorage.clear();const block=makeJsNode('DOM',{x:0,y:0});
  const saved={id:'saved',name:'My module',data:block.data,width:240,height:190};
  const project={version:1 as const,name:'Local graph',metadata:{author:'Ada',updatedAt:'2026-11-12'},nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}};
  expect(parseDiagram(serializeDiagram(project))).toEqual(project);
  writeProjects(localStorage,[storeProject(project,'local')]);
  const insert=vi.fn(),remove=vi.fn(),open=vi.fn(),loadExample=vi.fn();
  function View(){const defaults=useContext(ProjectContext);return createElement(TooltipProvider,null,createElement(ProjectContext.Provider,{value:{...defaults,myBlocks:[saved],insertSavedBlock:insert,removeSavedBlock:remove,openProject:open,loadExample}},createElement(MyBlocks,{addExample(){}})));}
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
    await act(async()=>root.render(createElement(View)));
    expect([...host.querySelectorAll('.category-toggle')].map(button=>button.textContent)).toEqual(['Block Examples','Saved Blocks','My Projects']);
    expect(host.querySelector('.category-body')).toBeNull();expect(host.querySelector('.saved-block')).toBeNull();
    const tile=host.querySelector<HTMLButtonElement>('.saved-palette-item .palette-tile')!;
    expect(tile.draggable).toBe(true);expect(tile.querySelector('.palette-glyph')).not.toBeNull();
    await act(async()=>tile.click());expect(insert).toHaveBeenCalledWith(saved);
    const values=new Map();const transfer={effectAllowed:'',setData:(key:string,value:string)=>values.set(key,value)};
    const drag=new Event('dragstart',{bubbles:true});Object.defineProperty(drag,'dataTransfer',{value:transfer});
    await act(async()=>tile.dispatchEvent(drag));expect(values.get('application/milver-saved-block')).toBe('saved');
    await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Delete saved block My module"]')!.click());expect(remove).toHaveBeenCalledWith('saved');
    const card=host.querySelector<HTMLButtonElement>('[aria-label="Open project Local graph"]')!;
    expect(card.querySelector('.project-card-heading svg')).not.toBeNull();expect(card.textContent).toContain('Saved project');expect(card.textContent).toContain('Ada');expect(card.querySelector('time')).not.toBeNull();
    await act(async()=>card.click());expect(open).toHaveBeenCalledWith(project);
    await act(async()=>writeProjects(localStorage,[storeProject({...project,name:'Second graph'},'second')]));
    expect(host.querySelector('[aria-label="Open project Local graph"]')).toBeNull();expect(host.querySelector('[aria-label="Open project Second graph"]')).not.toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();}
});
it('rejects malformed project authors and dates in imported JSON',()=>{
  const project={version:1,name:'Metadata',nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}};
  expect(()=>parseDiagram(JSON.stringify({...project,metadata:{author:42}}))).toThrow('author');
  expect(()=>parseDiagram(JSON.stringify({...project,metadata:{updatedAt:'yesterday'}}))).toThrow('date');
});

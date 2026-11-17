// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import App from './App';
import { defaultTheme,makeNode,serializeDiagram } from './model';
import { readProjects } from './project-store';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
beforeEach(()=>{
  vi.stubGlobal('DOMMatrixReadOnly',class{m22=1;});
  vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
  localStorage.clear();localStorage.setItem('milver.diagram.v1',serializeDiagram({version:1,name:'Workspace',theme:{...defaultTheme,canvasBackground:'aurora',showGrid:true},nodes:[makeNode('constant',{x:0,y:0},'original')],edges:[],viewport:{x:0,y:0,zoom:1}}));
});
afterEach(()=>{localStorage.clear();vi.unstubAllGlobals();vi.restoreAllMocks();});
async function workspace(action:(host:HTMLElement)=>Promise<void>){
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{await act(async()=>root.render(createElement(App)));await action(host);await act(async()=>{await new Promise(resolve=>requestAnimationFrame(resolve));});}
  finally{await act(async()=>root.unmount());host.remove();}
}
it('clears the active canvas with Undo and overlays the grid on its gradient',async()=>workspace(async host=>{
  expect((host.querySelector('.react-flow') as HTMLElement).style.background).toContain('radial-gradient');
  expect((host.querySelector('.react-flow__background') as HTMLElement).style.getPropertyValue('--xy-background-color-props')).toBe('transparent');
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Clear canvas"]')!.click());
  expect(host.querySelectorAll('.react-flow__node')).toHaveLength(0);
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Undo"]')!.click());
  expect(host.querySelectorAll('.react-flow__node')).toHaveLength(1);
}));
it('manages local project snapshots, JSON imports, downloads, renaming and opening',async()=>workspace(async host=>{
  const blob=vi.fn(()=> 'blob:download');URL.createObjectURL=blob;URL.revokeObjectURL=vi.fn();
  let filename='';vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(function(this:HTMLAnchorElement){filename=this.download;});
  const show=async()=>act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="Projects"]')!.click());
  await show();
  await act(async()=>document.querySelector<HTMLButtonElement>('.project-store-actions button')!.click());
  expect(readProjects(localStorage)).toHaveLength(1);
  const name=document.querySelector<HTMLInputElement>('[aria-label="Name of Workspace"]')!;
  await act(async()=>{name.value='Renamed';name.dispatchEvent(new FocusEvent('focusout',{bubbles:true}));});
  expect(readProjects(localStorage)[0].name).toBe('Renamed');
  const file=document.querySelector<HTMLInputElement>('[aria-label="Import stored projects"]')!;
  Object.defineProperty(file,'files',{value:[{text:async()=>serializeDiagram({version:1,name:'Imported',nodes:[],edges:[],viewport:{x:0,y:0,zoom:1}})}]});
  await act(async()=>file.dispatchEvent(new Event('change',{bubbles:true})));
  expect(readProjects(localStorage)).toHaveLength(2);
  await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Download Imported"]')!.click());
  expect(filename).toBe('imported.json');expect(blob).toHaveBeenCalled();
  const row=[...document.querySelectorAll('.project-store-row')].find(row=>row.querySelector('[aria-label="Name of Renamed"]'))!;
  await act(async()=>row.querySelector<HTMLButtonElement>('button')!.click());
  expect(document.querySelector('.projects-dialog')).toBeNull();
  expect(host.querySelector<HTMLInputElement>('[aria-label="Project title"]')!.value).toBe('Renamed');
  await show();
  await act(async()=>document.querySelector<HTMLButtonElement>('[aria-label="Delete stored Imported"]')!.click());
  expect(readProjects(localStorage)).toHaveLength(1);
}));
it('groups examples and saved blocks into collapsible sections without the old introduction',async()=>workspace(async host=>{
  await act(async()=>host.querySelector<HTMLButtonElement>('#library-tab-my-blocks')!.click());
  const panel=host.querySelector('#library-panel-my-blocks')!;
  expect(panel.querySelector('.library-intro')).toBeNull();
  expect(panel.textContent).toContain('Counter');expect(panel.textContent).toContain('Trigger');
  const sources=host.querySelector('#library-panel-blocks')!;
  expect(sources.textContent).not.toContain('Counter');expect(sources.textContent).not.toContain('Trigger');
  expect(sources.textContent).toContain('General viewer');expect(sources.textContent).toContain('Math viewer');
  const sections=[...panel.querySelectorAll<HTMLButtonElement>('.category-toggle')];
  expect(sections.map(button=>button.textContent)).toEqual(['Block Examples','Saved Blocks','My Projects']);
  expect(panel.querySelectorAll('.project-palette-card')).toHaveLength(6);
  await act(async()=>sections[2].click());
  expect(sections[2].getAttribute('aria-expanded')).toBe('false');
}));
it('imports text and CSV sources through the inspector and reflects their settings in JSON',async()=>workspace(async host=>{
  const add=async(name:string)=>act(async()=>[...host.querySelectorAll<HTMLButtonElement>('#library-panel-blocks .palette-tile')].find(button=>button.title===`${name} · JavaScript`)!.click());
  await add('Text');
  const textFile=host.querySelector<HTMLInputElement>('[aria-label="Import text source"]')!;
  Object.defineProperty(textFile,'files',{value:[{text:async()=> 'hello\nworld'}]});
  await act(async()=>textFile.dispatchEvent(new Event('change',{bubbles:true})));
  expect(host.querySelector<HTMLTextAreaElement>('[aria-label="Text content"]')!.value).toBe('hello\nworld');
  await add('CSV');
  const csvFile=host.querySelector<HTMLInputElement>('[aria-label="Import CSV source"]')!;
  Object.defineProperty(csvFile,'files',{value:[{text:async()=> 'name,value\nAda,2'}]});
  await act(async()=>csvFile.dispatchEvent(new Event('change',{bubbles:true})));
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="CSV header row"]')!.click());
  await act(async()=>host.querySelector<HTMLButtonElement>('#tab-json')!.click());
  const data=JSON.parse(host.querySelector('#panel-json .cm-content')!.textContent!);
  expect(JSON.parse(data.value)).toMatchObject({text:'name,value\nAda,2',header:true,numeric:true});
}));

it('uses the same mode in the top toolbar, Appearance and saved JSON',async()=>workspace(async host=>{
  const toggle=host.querySelector<HTMLButtonElement>('button[aria-label="Excalidraw mode"]')!;
  await act(async()=>toggle.click());
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="Appearance"]')!.click());
  const appearance=host.querySelector<HTMLButtonElement>('[role="switch"][aria-label="Excalidraw mode"]')!;
  expect(appearance.getAttribute('aria-checked')).toBe('true');
  expect(host.querySelector('[aria-label="Roughness level"]')).not.toBeNull();
  await act(async()=>appearance.click());
  expect(toggle.getAttribute('aria-pressed')).toBe('false');
  expect(host.querySelector('.block-type-trail')).not.toBeNull();
  expect(host.querySelector('.rough-port-outline')).toBeNull();
  await act(async()=>appearance.click());
  expect(toggle.getAttribute('aria-pressed')).toBe('true');
  for(const port of host.querySelectorAll('.rough-port-outline')){expect(port.querySelector('[fill="#ffffff"]')).not.toBeNull();for(const path of port.querySelectorAll('path'))expect(['none','#ffffff']).toContain(path.getAttribute('fill'));}
  await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="JSON editor"]')!.click());
  const json=JSON.parse(document.querySelector<HTMLTextAreaElement>('[aria-label="Diagram JSON"]')!.value);
  expect(json.theme.rough).toBe(true);expect(json.theme).not.toHaveProperty('excalidraw');
}));

it('separates datatypes, interactive controls and imported data into simple library sections',async()=>workspace(async host=>{
  const sections=[...host.querySelectorAll('#library-panel-blocks .library-category')];
  const groups=Object.fromEntries(sections.map(section=>[section.querySelector('.category-toggle span')!.textContent,[...section.querySelectorAll('.palette-tile>span:last-child')].map(label=>label.textContent)]));
  expect(groups['Data types']).toEqual(['Number','Boolean','String','Vector','Matrix','Tensor']);
  expect(groups.Controls).toEqual(['Slider','Selector','Button']);
  expect(groups['Data sources']).toEqual(['Text','CSV']);
  expect(groups).not.toHaveProperty('Sources');
}));

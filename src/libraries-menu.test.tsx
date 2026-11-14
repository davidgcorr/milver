// @vitest-environment jsdom
import { act,createElement,useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it,vi } from 'vitest';
import { ProjectModules } from './components/project-modules';
import { ProjectContext } from './project/context';
import { TooltipProvider } from './components/ui/tooltip';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('collapses library sections and describes the module URL next to its field',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),createModule=vi.fn();
  function View(){const defaults=useContext(ProjectContext);return createElement(TooltipProvider,null,createElement(ProjectContext.Provider,{value:{...defaults,createModule}},createElement(ProjectModules)));}
  try{
    await act(async()=>root.render(createElement(View)));
    const sections=[...host.querySelectorAll<HTMLButtonElement>('.category-toggle')];
    expect(sections.map(button=>button.querySelector('span')?.textContent)).toEqual(['Import JS library','Included libraries','Project Libraries']);
    expect(host.querySelector('.library-intro')).toBeNull();
    const url=host.querySelector<HTMLInputElement>('[aria-label="Library URL"]')!;
    expect(host.querySelector('#'+url.getAttribute('aria-describedby'))?.textContent).toContain('browser-ready ES module URL');
    expect(host.querySelector('#library-url-description')?.textContent).toContain('modules.helper');
    await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(url,'https://esm.sh/lodash-es@4.17.21');url.dispatchEvent(new Event('input',{bubbles:true}));});
    await act(async()=>sections[0].click());expect(sections[0].getAttribute('aria-expanded')).toBe('false');
    await act(async()=>sections[0].click());expect(host.querySelector<HTMLInputElement>('[aria-label="Library URL"]')!.value).toBe('https://esm.sh/lodash-es@4.17.21');
    await act(async()=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(button=>button.textContent==='Add URL')!.click());
    expect(createModule).toHaveBeenCalledWith('','helper','https://esm.sh/lodash-es@4.17.21');
    await act(async()=>sections[1].click());expect(host.querySelectorAll('.builtin-library-card')).toHaveLength(5);
    await act(async()=>sections[2].click());expect(sections[2].getAttribute('aria-expanded')).toBe('false');
  }finally{await act(async()=>root.unmount());host.remove();}
});

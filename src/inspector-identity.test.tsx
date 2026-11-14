// @vitest-environment jsdom
import { act,createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect,it,vi } from 'vitest';
import App from './App';
import { makeJsNode,jsRecipes } from './js-recipes';
import { serializeDiagram } from './model';
import { EditorView } from '@codemirror/view';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
it('matches palette icons and category trails, and highlights code after switching inspector tabs',async()=>{
  vi.stubGlobal('DOMMatrixReadOnly',class{m22=1;});
  vi.stubGlobal('ResizeObserver',class{observe(){}unobserve(){}disconnect(){}});
  const node=makeJsNode('String',{x:0,y:0},'source');
  localStorage.setItem('milver.diagram.v1',serializeDiagram({version:1,name:'Identity',nodes:[node],edges:[],viewport:{x:0,y:0,zoom:1}}));
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try {
    await act(async()=>root.render(createElement(App)));
    await act(async()=>host.querySelector<HTMLElement>('.react-flow__node')!.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    expect(host.querySelector('.selection-icon')?.textContent).toBe(jsRecipes.String.symbol);
    expect(host.querySelector('.selection-heading>div>span')?.textContent).toBe('Sources > String');
    expect(host.querySelector('.block-type-trail')?.getAttribute('title')).toBe('Sources > String');
    await act(async()=>host.querySelector<HTMLButtonElement>('#tab-code')!.click());
    await act(async()=>{await import('./components/codemirror-field');});
    const code=host.querySelector('#panel-code .cm-content')!;
    expect(code).not.toBeNull();expect(code.querySelector('.cm-syntax-keyword')).not.toBeNull();
    const editor=EditorView.findFromDOM(code.closest('.cm-editor') as HTMLElement)!;
    await act(async()=>editor.dispatch({changes:{from:editor.state.doc.length,insert:'\n// Draft kept across tabs'}}));
    await act(async()=>host.querySelector<HTMLButtonElement>('#tab-render')!.click());
    expect(host.querySelector('#panel-render .cm-syntax-string')).not.toBeNull();
    await act(async()=>host.querySelector<HTMLButtonElement>('#tab-json')!.click());
    expect(host.querySelector('#panel-json .cm-syntax-property')).not.toBeNull();
    await act(async()=>host.querySelector<HTMLButtonElement>('#tab-code')!.click());
    expect(host.querySelector('#panel-code .cm-content')?.textContent).toContain('Draft kept across tabs');
    await act(async()=>host.querySelector<HTMLButtonElement>('#panel-code [aria-label="Expand JavaScript source"]')!.click());
    expect(document.querySelector('.expanded-code-dialog .cm-syntax-keyword')).not.toBeNull();
    await act(async()=>document.querySelector<HTMLButtonElement>('.expanded-code-dialog [data-slot=dialog-close]')!.click());
    await act(async()=>host.querySelector<HTMLButtonElement>('#library-tab-my-blocks')!.click());
    const tokenizer=[...host.querySelectorAll<HTMLButtonElement>('#library-panel-my-blocks .palette-tile')].find(button=>button.textContent?.includes('Word tokenizer'))!;
    const symbol=tokenizer.querySelector('.palette-glyph')!.textContent;
    await act(async()=>tokenizer.click());
    expect(host.querySelector('.selection-icon')!.textContent).toBe(symbol);
    expect(host.querySelector('.selection-heading>div>span')?.textContent).toBe('JavaScript > Module > Word tokenizer');
    expect([...host.querySelectorAll('.block-type-trail')].at(-1)?.getAttribute('title')).toBe('JavaScript > Module > Word tokenizer');
    await act(async()=>{await new Promise(resolve=>requestAnimationFrame(resolve));});
  }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();vi.unstubAllGlobals();}
});

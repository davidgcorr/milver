// Self-contained: the same controls run in the editor and sandboxed block frames.
export function browserUi(command: Record<string, any>, root: Document = document): any {
  const view=root.defaultView!;
  const visible=(element:Element)=>{for(let node:Element|null=element;node;node=node.parentElement){if(node.hasAttribute('hidden')||view.getComputedStyle(node).display==='none')return false;if(node instanceof view.HTMLDetailsElement&&!node.open&&!node.querySelector('summary')?.contains(element))return false;}return true;};
  const label=(element:Element)=>element.getAttribute('aria-label')||element.getAttribute('title')||element.textContent?.trim().slice(0,200)||element.getAttribute('placeholder')||'';
  if(command.action==='list') {
    const elements=[...root.querySelectorAll('button,input,textarea,select,summary,a[href],[role="slider"],[role="switch"],[role="option"],[role="tab"],[role="menuitem"],[contenteditable="true"],[tabindex="0"]')].filter(element=>command.includeHidden||visible(element));
    return elements.slice(0,Math.min(1000,command.limit??250)).map((element,index)=>{
      let id=element.getAttribute('data-milver-control');if(!id){id=globalThis.crypto.randomUUID();element.setAttribute('data-milver-control',id);}
      return {selector:`[data-milver-control="${id}"]`,tag:element.tagName.toLowerCase(),label:label(element),role:element.getAttribute('role'),value:('value'in element?String((element as HTMLInputElement).value):element.getAttribute('aria-valuenow'))?.slice(0,1500),checked:('checked'in element?(element as HTMLInputElement).checked:element.getAttribute('aria-checked')),disabled:('disabled'in element&&(element as HTMLInputElement).disabled)||element.getAttribute('aria-disabled')==='true',expanded:element.getAttribute('aria-expanded'),index};
    });
  }
  if(typeof command.selector!=='string')throw new Error('A selector from the UI list is required.');
  const element=root.querySelector(command.selector) as HTMLElement|null;
  if(!element)throw new Error('Control no longer exists. List controls again.');
  if((element as HTMLInputElement).disabled||element.getAttribute('aria-disabled')==='true')throw new Error('Control is disabled.');
  if(command.action==='read')return {text:element.textContent,value:'value'in element?(element as HTMLInputElement).value:undefined,html:element.outerHTML};
  if(command.action==='click'){if(typeof element.click==='function')element.click();else element.dispatchEvent(new view.MouseEvent('click',{bubbles:true}));}
  else if(command.action==='focus')element.focus();
  else if(command.action==='scroll')element.scrollIntoView({block:'center'});
  else if(command.action==='key'){element.focus();element.dispatchEvent(new view.KeyboardEvent('keydown',{key:command.key,bubbles:true,ctrlKey:!!command.ctrlKey,metaKey:!!command.metaKey,shiftKey:!!command.shiftKey,altKey:!!command.altKey}));element.dispatchEvent(new view.KeyboardEvent('keyup',{key:command.key,bubbles:true}));}
  else if(command.action==='check'){const checked='checked'in element?(element as HTMLInputElement).checked:element.getAttribute('aria-checked')==='true';if(checked!==command.checked)element.click();}
  else if(command.action==='fill') {
    if(element.matches('input[type=file]'))throw new Error('Use the files action for file inputs.');
    const prototype=element instanceof view.HTMLTextAreaElement?view.HTMLTextAreaElement.prototype:element instanceof view.HTMLSelectElement?view.HTMLSelectElement.prototype:view.HTMLInputElement.prototype;
    const setter=Object.getOwnPropertyDescriptor(prototype,'value')?.set;
    if('value'in element&&setter)setter.call(element,String(command.value??''));else if(element.isContentEditable||element.getAttribute('contenteditable')==='true')element.textContent=String(command.value??'');else throw new Error('This control is not editable.');
    element.dispatchEvent(new view.Event('input',{bubbles:true}));element.dispatchEvent(new view.Event('change',{bubbles:true}));
  } else if(command.action==='files') {
    if(!element.matches('input[type=file]')||!Array.isArray(command.files))throw new Error('File input and files array required.');
    const transfer=new view.DataTransfer();
    for(const file of command.files){const bytes=file.encoding==='base64'?Uint8Array.from(view.atob(file.content),char=>char.charCodeAt(0)):String(file.content);transfer.items.add(new view.File([bytes],file.name,{type:file.type??'application/octet-stream'}));}
    (element as HTMLInputElement).files=transfer.files;element.dispatchEvent(new view.Event('change',{bubbles:true}));
  } else throw new Error('Unknown UI action.');
  return {ok:true,label:label(element)};
}

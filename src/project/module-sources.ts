import { init, parse } from 'es-module-lexer';
import { validModuleUrl } from '../code-config';
export type ModuleSources = Record<string, { source: string; resolvedSource: string; baseUrl?: string }>;
export function parseModuleSources(value: unknown): ModuleSources {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > 256) throw new Error('Invalid embedded module sources.');
  const result: ModuleSources = Object.create(null); let size = 0;
  for (const [url, entry] of Object.entries(value)) {
    if (!validModuleUrl(url) || !entry || typeof entry !== 'object' || typeof entry.source !== 'string' || typeof entry.resolvedSource !== 'string' || entry.source.length > 2000000 || entry.resolvedSource.length > 2200000 || entry.baseUrl !== undefined && (typeof entry.baseUrl !== 'string' || !validModuleUrl(entry.baseUrl))) throw new Error('Invalid embedded module source.');
    size += entry.source.length + entry.resolvedSource.length;
    if (size > 40000000) throw new Error('Embedded module sources exceed 40 MB.');
    result[url] = { source:entry.source, resolvedSource:entry.resolvedSource, ...(entry.baseUrl ? {baseUrl:entry.baseUrl} : {}) };
  }
  return result;
}
// Only relative and absolute HTTP imports need snapshots; bare aliases are
// supplied by the project's libraries or the renderer's bundled React bridge.
export function importUrl(name: string, base?: string): string | undefined {
  if (/^https?:\/\//.test(name)) return new URL(name).href;
  if (base && /^(?:\.{1,2}\/|\/)/.test(name)) return new URL(name,base).href;
}
export async function captureModuleSources(sources: {source?:string;url?:string}[], existing: ModuleSources = {}, fetcher: typeof fetch = fetch): Promise<ModuleSources> {
  await init;
  const archive: ModuleSources = Object.create(null), visiting = new Set<string>();
  let total = 0;
  async function scan(source: string, base?: string): Promise<string> {
    const [imports] = parse(source), edits: {start:number;end:number;value:string}[] = [];
    for (const entry of imports) {
      if (entry.d === -2) { if(base) edits.push({start:entry.s,end:entry.e,value:`({url:${JSON.stringify(base)}})`}); continue; }
      if (entry.n === undefined) throw new Error('Cannot back up a computed dynamic import. Use a literal module URL.');
      if(entry.n.startsWith('blob:'))throw new Error('Cannot back up a temporary blob module URL. Embed its source in a project library.');
      const url = importUrl(entry.n,base);
      if (!url) continue;
      await visit(url);
      edits.push({start:entry.s,end:entry.e,value:entry.d>=0?JSON.stringify(url):url});
    }
    for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+edit.value+source.slice(edit.end);
    return source;
  }
  async function visit(url: string): Promise<void> {
    if(archive[url] || visiting.has(url))return;
    if(Object.keys(archive).length>=256)throw new Error('A backup supports up to 256 remote module files.');
    visiting.add(url);
    let source=existing[url]?.source, base=existing[url]?.baseUrl??url;
    if(source===undefined) {
      const response=await fetcher(url,{credentials:'omit',signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error(`Could not back up ${url}: HTTP ${response.status}`);
      source=await response.text();base=response.url||url;
    }
    if(source.length>2000000)throw new Error(`Remote module exceeds 2 MB: ${url}`);
    total+=source.length;if(total>18000000)throw new Error('Remote module backup exceeds 18 MB.');
    archive[url]={source,resolvedSource:'',baseUrl:base};
    archive[url].resolvedSource=await scan(source,base);
    visiting.delete(url);
  }
  for(const definition of sources) {
    if(definition.url)await visit(definition.url);
    else if(definition.source!==undefined)await scan(definition.source);
  }
  return parseModuleSources(archive);
}

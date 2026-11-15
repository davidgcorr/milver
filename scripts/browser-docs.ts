import { readFile } from 'node:fs/promises';
import type { Plugin } from 'vite';

const escape = (value: string) => value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
// Trusted repository Markdown; raw HTML is escaped. Supports the guide's headings,
// paragraphs, lists, fenced examples and tables without shipping a browser parser.
export function renderGuide(markdown: string): string {
  const inline = (text: string): string => text.split(/(`[^`]+`)/g).map(part => part.startsWith('`') ? `<code>${escape(part.slice(1,-1))}</code>` : escape(part)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')).join('');
  const lines = markdown.split('\n'), output: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const language = line.slice(3).trim(), code: string[] = []; i++;
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++]);
      i++; output.push(`<pre><code class="language-${escape(language)}">${escape(code.join('\n'))}</code></pre>`); continue;
    }
    const heading = /^(#{1,6}) (.+)$/.exec(line);
    if (heading) { const level=heading[1].length, id=heading[2].toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''); output.push(`<h${level} id="${id}">${inline(heading[2])}<a class="anchor" href="#${id}" aria-label="Link to ${escape(heading[2])}">#</a></h${level}>`); i++; continue; }
    if (line.startsWith('|')) {
      const rows: string[][]=[];
      while (i < lines.length && lines[i].startsWith('|')) { const cells=lines[i++].split('|').slice(1,-1).map(cell=>cell.trim()); if(!cells.every(cell=>/^:?-+:?$/.test(cell)))rows.push(cells); }
      output.push(`<div class="table-wrap"><table><thead><tr>${rows.shift()!.map(cell=>`<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${row.map(cell=>`<td>${inline(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`); continue;
    }
    if (line.startsWith('- ')) { const items:string[]=[]; while(i<lines.length&&lines[i].startsWith('- '))items.push(`<li>${inline(lines[i++].slice(2))}</li>`); output.push(`<ul>${items.join('')}</ul>`); continue; }
    const paragraph:string[]=[line]; i++;
    while(i<lines.length&&lines[i].trim()&&!/^(#|```|\||- )/.test(lines[i]))paragraph.push(lines[i++]);
    output.push(`<p>${inline(paragraph.join(' '))}</p>`);
  }
  return output.join('\n');
}

export function browserDocs(base: string, guide: string): Record<string,{type:string;body:string}> {
  const url=(path:string)=>base+path;
  const descriptor={
    schemaVersion:1,kind:'browser-mcp-discovery',name:'milver',protocolVersion:'2025-11-25',
    description:'Static connection discovery. This URL is documentation, not an HTTP MCP transport.',
    httpMcpEndpoint:null,requiresOpenEditor:true,
    editor:url(''),guide:url('docs/browser-mcp/'),markdown:url('docs/browser-mcp.md'),discovery:url('mcp/'),
    instructions:[
      'Open or attach to the editor URL in a browser tab. Keep that tab open.',
      'Evaluate in the editor main window, not in the documentation tab or a block iframe.',
      'Wait for window.milverMcp; inspect window.milverMcp.tools for current tool descriptions and input schemas.',
      'Call milver_get_state and milver_get_catalog before editing. Check result.isError.',
      'For protocol clients, relay JSON-RPC over the same-window MessagePort transport and complete initialize plus notifications/initialized.',
      'An HTTP-only client cannot connect to this static route. Use a browser connector or native WebMCP-capable browser agent.'
    ],
    transports:[
      {type:'javascript',api:'window.milverMcp',call:"await window.milverMcp.call('milver_get_state', {})",schemas:'window.milverMcp.tools'},
      {type:'messageport',connectMessage:{type:'milver-mcp-connect'},target:'editor main window, same origin',guideSection:url('docs/browser-mcp/#messageport-connector')},
      {type:'webmcp',api:'document.modelContext',availability:'Feature-detected in the editor; see Browser MCP dialog for registration status.'}
    ],
    resources:['milver://project/current','milver://editor/state','milver://editor/tools'],
    capabilities:['tools/list','tools/call','resources/list','resources/read'],
    projectHtml:{tool:'milver_export',arguments:{format:'html',download:false,options:{scope:'system'}},responseField:'structuredContent.text',jsonRpcResponseField:'result.structuredContent.text',description:'Complete standalone HTML viewer returned inline with filename and mimeType. Runs saved JSX render functions and connected block logic in sandboxed frames; URL libraries require network access.',guideSection:url('docs/browser-mcp/#retrieve-generated-project-html')},
    firstCalls:[{name:'milver_get_state',arguments:{}},{name:'milver_get_catalog',arguments:{}}]
  };
  const nav=`<nav aria-label="Documentation"><a class="brand" href="${url('')}">▢ milver</a><a href="${url('docs/browser-mcp/')}">Connection guide</a><a href="${url('mcp/')}">MCP discovery</a><a href="${url('mcp/connection.json')}">Connection JSON</a><a href="${url('llms.txt')}">llms.txt</a></nav>`;
  const style=`:root{font-family:system-ui,sans-serif;color:#202024;background:#fafafa;color-scheme:light dark}*{box-sizing:border-box}body{margin:0}nav{display:flex;flex-wrap:wrap;gap:20px;align-items:center;padding:20px max(24px,calc((100vw - 1000px)/2));border-bottom:1px solid #ddd;background:#fff}a{color:#2459b5;text-underline-offset:3px}.brand{color:inherit;font-weight:700;text-decoration:none;margin-right:auto}main{max-width:960px;margin:auto;padding:44px 24px 80px;line-height:1.7}h1{font-size:clamp(28px,5vw,42px);letter-spacing:-.04em;line-height:1.2}h2{margin-top:2em;letter-spacing:-.025em;scroll-margin-top:24px}.anchor{margin-left:10px;font-size:.65em;opacity:.45;text-decoration:none}p,li{max-width:85ch}li{margin:8px 0}code{font-family:ui-monospace,monospace;font-size:.88em;background:#eeeef1;padding:2px 5px;border-radius:4px;overflow-wrap:anywhere}pre{padding:20px;border:1px solid #ddd;border-radius:12px;background:#f0f0f3;overflow:auto;line-height:1.6}pre code{padding:0;background:none;overflow-wrap:normal}.notice{padding:18px 22px;border:1px solid #d3dce9;border-radius:12px;background:#edf3fc}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:.9em}th,td{border-bottom:1px solid #ddd;text-align:left;vertical-align:top;padding:12px}footer{margin-top:44px;font-size:.85em;color:#666}@media(prefers-color-scheme:dark){:root{background:#151517;color:#eee}nav{background:#1b1b1f}nav,pre,th,td{border-color:#39393f}a{color:#a1c6ff}code,pre{background:#24242a}.notice{background:#1b273a;border-color:#3b5275}footer{color:#aaa}}`;
  const page=(title:string,body:string)=>`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="milver browser MCP connection instructions, tool discovery and MessagePort protocol examples."><title>${escape(title)} · milver</title><link rel="icon" href="${url('favicon.svg')}" type="image/svg+xml"><link rel="alternate" type="application/json" href="${url('mcp/connection.json')}" title="Browser MCP connection descriptor"><link rel="alternate" type="text/markdown" href="${url('docs/browser-mcp.md')}" title="Connection guide as Markdown"><style>${style}</style></head><body>${nav}<main>${body}<footer>Generated from the repository connection guide. The editor is the live source of tool schemas; these documentation pages do not mount an editor or access your projects.</footer></main></body></html>`;
  const discovery=`<h1>MCP connection discovery</h1><div class="notice"><strong>This is a static discovery page, not an HTTP MCP endpoint.</strong> Do not send initialize or tools/call requests to this URL. Connect through the open editor's browser API, MessagePort bridge or native WebMCP.</div><h2>Instructions for AI clients</h2><ol>${descriptor.instructions.map(text=>`<li>${escape(text)}</li>`).join('')}</ol><p><a href="${url('')}">Open the editor</a> · <a href="${url('docs/browser-mcp/')}">Read the full connection guide</a> · <a href="${url('mcp/connection.json')}">Read machine-readable connection JSON</a></p><h2>Start in the editor tab</h2><pre><code>const mcp = window.milverMcp;
if (!mcp) throw new Error('Open the editor tab and wait for it to load.');
const tools = mcp.tools; // descriptions + complete input schemas
const state = await mcp.call('milver_get_state', {});
const catalog = await mcp.call('milver_get_catalog', {});
if (state.isError || catalog.isError) throw new Error('Inspect tool error content.');</code></pre><h2>HTTP-only clients</h2><p>This route is informational and does not implement Streamable HTTP, SSE or stdio. If your client accepts only a remote MCP server URL, it needs a browser connector to use milver. A URL fetch alone cannot access an open tab's editor or browser-local projects.</p><h2>Discover tools and resources</h2><p>The editor exposes <code>window.milverMcp.tools</code> and the MCP <code>tools/list</code> method. Resources are <code>milver://project/current</code>, <code>milver://editor/state</code> and <code>milver://editor/tools</code>. See the <a href="${url('docs/browser-mcp/#coverage')}">coverage table</a> for every editor area and the <a href="${url('docs/browser-mcp/#messageport-connector')}">complete protocol handshake</a>.</p>`;
  const llms=`# milver\n\n> A browser-based block diagram editor with browser-local MCP control.\n\n## AI client connection\n\n- [MCP discovery](${url('mcp/')}): Informational route; NOT an HTTP MCP endpoint.\n- [Connection descriptor](${url('mcp/connection.json')}): Machine-readable browser connection instructions.\n- [Connection guide](${url('docs/browser-mcp/')}): Complete human-readable guide, code examples and tool coverage.\n- [Raw Markdown guide](${url('docs/browser-mcp.md')}): Plain-text instructions.\n- [Full documentation](${url('llms-full.txt')}): This index and complete guide.\n- [Open editor](${url('')}): Tools exist only in this tab's main window while the editor is mounted.\n\nUse a browser connector to evaluate window.milverMcp.call in the editor tab, or relay JSON-RPC over its MessagePort bridge. Native WebMCP is feature-detected. Read window.milverMcp.tools for live schemas; start with milver_get_state and milver_get_catalog. Do not POST MCP requests to /mcp. HTTP-only clients need a browser connector.\n`;
  return {
    'docs/browser-mcp/index.html':{type:'text/html; charset=utf-8',body:page('Browser MCP connection guide',renderGuide(guide))},
    'docs/browser-mcp.md':{type:'text/markdown; charset=utf-8',body:guide},
    'mcp/index.html':{type:'text/html; charset=utf-8',body:page('MCP connection discovery',discovery)},
    'mcp/connection.json':{type:'application/json; charset=utf-8',body:JSON.stringify(descriptor,null,2)+'\n'},
    'llms.txt':{type:'text/plain; charset=utf-8',body:llms},
    'llms-full.txt':{type:'text/plain; charset=utf-8',body:llms+'\n'+guide},
  };
}

export function browserDocsPlugin(): Plugin {
  let base='/';
  const guideFile=new URL('../docs/browser-mcp.md',import.meta.url);
  return {
    name:'milver-browser-docs',
    configResolved(config){base=config.base;},
    configureServer(server){
      server.watcher.add(guideFile.pathname);
      server.middlewares.use(async(req,res,next)=>{
        try {
          const pathname=new URL(req.url??'/', 'http://localhost').pathname;
          if(!pathname.startsWith(base))return next();
          let key=pathname.slice(base.length);
          if(key==='mcp'||key==='mcp/'||key==='docs/browser-mcp'||key==='docs/browser-mcp/')key=key.replace(/\/$/,'')+'/index.html';
          if(!['docs/browser-mcp/index.html','docs/browser-mcp.md','mcp/index.html','mcp/connection.json','llms.txt','llms-full.txt'].includes(key))return next();
          const files=browserDocs(base,await readFile(guideFile,'utf8')),file=files[key];
          if(!file)return next();
          res.setHeader('Content-Type',file.type);
          if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.setHeader('Allow','GET, HEAD');res.end('Static discovery only. Read '+base+'mcp/connection.json and use a browser connector.');return;}
          res.end(req.method==='HEAD'?undefined:file.body);
        }catch(error){next(error as Error);}
      });
    },
    async generateBundle(){
      const files=browserDocs(base,await readFile(guideFile,'utf8'));
      for(const[fileName,file]of Object.entries(files))this.emitFile({type:'asset',fileName,source:file.body});
    }
  };
}

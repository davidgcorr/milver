# Browser MCP control

Open **Browser MCP** (the robot icon in the toolbar) to inspect the tool schemas, try calls, and see connection status. Control is installed while the editor page is open and removed when it unmounts. No server, token, account or deployment configuration is required.

There are three ways to call the same tools:

- **Native WebMCP:** tools register with `document.modelContext.registerTool` when available (with an older `navigator.modelContext` fallback). The dialog reports how many registrations succeeded. See the [browser WebMCP guide](https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/guides/webmcp/agentic-javascript-tools/guide.md).
- **JavaScript API:** a browser agent, browser console or same-page connector can call `window.milverMcp.call(name, arguments)`. This convenience API does not require a protocol handshake.
- **MCP JSON-RPC:** a same-window connector transfers a `MessagePort`, then uses the MCP lifecycle and tools/resources methods. It implements protocol revision **2025-11-25**, using MCP's permitted [custom transport mechanism](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

This static site does **not** expose an HTTP MCP transport or an stdio process. The `/mcp/` route is an informational discovery page, not a protocol endpoint. An external desktop MCP client needs a browser connector that evaluates code in this tab and forwards its protocol messages to the MessagePort. The native WebMCP integration is feature-detected; the JavaScript and MessagePort APIs also work without native WebMCP.

## Public routes and AI discovery

All paths below are relative to the deployed application root. On GitHub Pages, retain the repository prefix (for example `/reactflow-recipes/mcp/`). On a root deployment, use `/mcp/`. Directory routes also accept `index.html` explicitly.

| Route | Purpose |
| --- | --- |
| `/docs/browser-mcp/` | This full guide, rendered as static HTML; no JavaScript required |
| `/docs/browser-mcp.md` | The original Markdown guide |
| `/mcp/` | Artificial MCP discovery route with connection instructions for AI clients |
| `/mcp/connection.json` | Machine-readable connection descriptor, transport choices, editor URL, resources and first calls |
| `/llms.txt` | Compact AI documentation index |
| `/llms-full.txt` | Index plus the complete connection guide |

The editor HTML advertises the guide, descriptor and AI index with link metadata. The Browser MCP dialog also links to them. These files are generated from this guide during the Vite build and are available in development, on GitHub Pages and on Cloudflare Pages. The descriptor is a **milver-specific discovery format**, not a standard MCP endpoint manifest.

### Instructions for AI clients

Fetch the discovery page or JSON descriptor, then open or attach to its `editor` URL in a browser. Keep that tab open and evaluate in its **main window**. Documentation pages do not mount an editor and cannot access your projects. Wait until `window.milverMcp` exists, inspect `window.milverMcp.tools` for the current schemas, and start with `milver_get_state` and `milver_get_catalog`.

If you have JSON-RPC MCP support plus a browser connector, relay requests through the MessagePort example below. If you can only supply a remote HTTP MCP URL, these documentation routes cannot provide a connection: use a browser connector or a native WebMCP-capable browser agent. Do not send MCP `initialize` or `tools/call` POSTs to `/mcp/`; it serves discovery documentation only. Unsupported HTTP methods are handled by the static hosting platform, not by an MCP server.

## Quick start

Run inside the editor's main window:

```js
const mcp = window.milverMcp;
console.table(mcp.tools.map(({ name, description }) => ({ name, description })));
await mcp.call('milver_create_block', {
  recipe: 'Matrix', id: 'matrix-a', position: { x: 50, y: 100 }
});
await mcp.call('milver_update_block', {
  id: 'matrix-a',
  data: {
    value: '[[1,2],[3,4]]',
    visuals: { shadow: 12, strokeWidth: 2, strokeColor: '#2563eb' }
  }
});
await mcp.call('milver_get_project', {});
```

Results contain MCP `content` text and `structuredContent`. Arrays/scalars are wrapped as `{result: ...}` in structured content. Check `isError` before using a result. Infinity uses the project's portable `{ "$number": "Infinity" }` representation. Input schemas are available in `mcp.tools`.

## Retrieve generated project HTML

Use `milver_export` with `format: "html"` and omit `download` (or set it to `false`). The complete HTML is returned directly in `structuredContent.text`; no download, browser filesystem access or follow-up fetch is needed. HTML defaults to the entire project, including nested parent canvases.

```js
const reply = await window.milverMcp.call('milver_export', {
  format: 'html',
  download: false,
  options: { scope: 'system' }
});
if (reply.isError) throw new Error(reply.content[0].text);
const { text: html, filename, mimeType } = reply.structuredContent;
// html is the complete <!doctype html> document, ready to save or return to the user.
// filename is the suggested .html filename; mimeType is text/html;charset=utf-8.
```

Over MCP JSON-RPC, send `tools/call` with `params: { name: "milver_export", arguments: { format: "html", download: false } }` and read `response.result.structuredContent.text`. Clients using only MCP text content can parse `response.result.content[0].text` as JSON and read its `text` field. The AI client should return or save that HTML as the requested project artifact. Set `options.scope: "current"` and optionally `path: ["parent-id"]` to retrieve only one canvas. `download: true` starts a local browser download instead of returning the HTML source.

The HTML artifact is a standalone viewer with pan, zoom and navigation into nested canvases. It runs saved JavaScript Code and JSX Render functions in opaque sandboxed frames, preserving connected inputs, state, source controls and imported libraries. React, UI components, the computation runtime and built-in math are packaged into the HTML. URL-imported libraries and remote iframe pages still require network access and permission to embed. When embedding the exported HTML with a sandbox attribute, allow scripts (for example `<iframe src="project.html" sandbox="allow-scripts"></iframe>`). SVG, PNG and GIF remain static publications. Retrieve `format: "json"` as well when the user needs the full editable project definition.

## MessagePort connector

```js
const channel = new MessageChannel();
let sequence = 0;
const pending = new Map();
channel.port1.onmessage = ({ data }) => {
  const response = typeof data === 'string' ? JSON.parse(data) : data;
  const resolve = pending.get(response.id);
  if (resolve) { pending.delete(response.id); resolve(response); }
};
channel.port1.start();
window.postMessage({ type: 'milver-mcp-connect' }, location.origin, [channel.port2]);

function request(method, params = {}) {
  const id = ++sequence;
  return new Promise(resolve => {
    pending.set(id, resolve);
    channel.port1.postMessage({ jsonrpc: '2.0', id, method, params });
  });
}
await request('initialize', {
  protocolVersion: '2025-11-25', capabilities: {},
  clientInfo: { name: 'my-browser-connector', version: '1.0.0' }
});
channel.port1.postMessage({ jsonrpc: '2.0', method: 'notifications/initialized' });
await request('tools/list');
await request('tools/call', { name: 'milver_get_state', arguments: {} });
await request('resources/read', { uri: 'milver://project/current' });
// Cancel an in-flight request by its ID:
// channel.port1.postMessage({ jsonrpc:'2.0', method:'notifications/cancelled', params:{requestId:4} });
channel.port1.close();
```

Each port has its own initialized session. The bridge accepts connection messages only from the same window and origin. Tool calls are serialized, arguments are checked, and project transactions are validated before committing. Mutating project tools use normal undo history. Malformed edits leave the project unchanged.

## Coverage

All persisted state is reachable through complete project/canvas reads and replacement, JSON Patch and targeted tools. Every rendered control is also reachable through `milver_ui`, including controls not given their own dedicated tool.

| Area | Tools (prefix every name with `milver_`) |
| --- | --- |
| Discovery and project JSON | `get_state`, `get_project`, `get_catalog`, `replace_project`, `patch_project` |
| Canvases, parents, external ports | `get_canvas`, `replace_canvas`, `navigate`, `clear_canvas`; edit parent `data.canvas` and its interface nodes with `update_block`/JSON Patch |
| Blocks, code, JSX, sources, state, geometry, appearance, ports, Wasm | `create_block`, `update_block`, `delete_blocks`; code is `data.module`, JSX is `data.render` |
| Connections and routing/animations | `connect`, `update_connection`, `delete_connections` |
| Selection, clipboard, history | `select`, `clipboard`, `history` |
| Panels, dialogs, inspector tabs/width, navigation/zoom | `workspace` |
| Theme, grid, gradients, roughness | `set_theme` |
| Imported libraries, saved blocks, local projects | `libraries`, `saved_blocks`, `projects` |
| Bundled project examples | `load_example` |
| Execution, live preview, errors | `runtime`, `get_state` |
| Live block scope and Code actions | `block_action` |
| Every rendered page/block control, file imports, editors | `ui` |
| Download or retrieve JSON/SVG/HTML/PNG/GIF | `export` |

Paths are arrays of parent block IDs, defaulting to the active canvas. `get_catalog` lists recipes and example IDs. Saved project management affects only this browser's local storage. `get_project` and JSON export preserve the complete document, including executable functions, libraries, nested parents and styles; HTML exports execute the saved render functions, while SVG/PNG/GIF retain static mask representations.

For UI actions, list controls first and use the returned selector. Selectors remain valid while the control is mounted. CodeMirror `fill` edits its draft through the editor API; **Apply code/render** commits it, just as in the UI. Use `ui` with `frame: '<block-id>'` to inspect/click/type in a mounted block renderer. `block_action` can invoke asynchronous functions exposed through `actions` in Code or inspect live inputs, state and available actions. Navigate to a block's canvas before controlling it. Embedded third-party iframe interiors retain normal browser isolation; use the block's inputs and message protocol to control those pages.

Resources are `milver://project/current`, `milver://editor/state` and `milver://editor/tools`. Tools have the same editing authority as the page, including editing executable JavaScript. Opaque block sandboxes cannot connect to the main-window bridge; their existing authenticated parent messaging is used for scoped commands.

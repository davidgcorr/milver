# Browser MCP control

Open **Browser MCP** (the robot icon in the toolbar) to inspect the tool schemas, try calls, and see connection status. Control is installed while the editor page is open and removed when it unmounts. No server, token, account or deployment configuration is required.

There are three ways to call the same tools:

- **Native WebMCP:** tools register with `document.modelContext.registerTool` when available (with an older `navigator.modelContext` fallback). The dialog reports how many registrations succeeded. See the [browser WebMCP guide](https://github.com/GoogleChrome/modern-web-guidance-src/blob/main/guides/webmcp/agentic-javascript-tools/guide.md).
- **JavaScript API:** a browser agent, browser console or same-page connector can call `window.milverMcp.call(name, arguments)`. This convenience API does not require a protocol handshake.
- **MCP JSON-RPC:** a same-window connector transfers a `MessagePort`, then uses the MCP lifecycle and tools/resources methods. It implements protocol revision **2025-11-25**, using MCP's permitted [custom transport mechanism](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports).

This static site does **not** expose an HTTP `/mcp` endpoint or an stdio process. An external desktop MCP client needs a browser connector that evaluates code in this tab and forwards its protocol messages to the MessagePort. The native WebMCP integration is feature-detected; the JavaScript and MessagePort APIs also work without native WebMCP.

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

Paths are arrays of parent block IDs, defaulting to the active canvas. `get_catalog` lists recipes and example IDs. Saved project management affects only this browser's local storage. `get_project` and JSON export preserve the complete document, including executable functions, libraries, nested parents and styles; publication exports retain their existing static mask representation.

For UI actions, list controls first and use the returned selector. Selectors remain valid while the control is mounted. CodeMirror `fill` edits its draft through the editor API; **Apply code/render** commits it, just as in the UI. Use `ui` with `frame: '<block-id>'` to inspect/click/type in a mounted block renderer. `block_action` can invoke asynchronous functions exposed through `actions` in Code or inspect live inputs, state and available actions. Navigate to a block's canvas before controlling it. Embedded third-party iframe interiors retain normal browser isolation; use the block's inputs and message protocol to control those pages.

Resources are `milver://project/current`, `milver://editor/state` and `milver://editor/tools`. Tools have the same editing authority as the page, including editing executable JavaScript. Opaque block sandboxes cannot connect to the main-window bridge; their existing authenticated parent messaging is used for scoped commands.

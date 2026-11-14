# milver

A collection of reusable block, mask, connection, and nested-canvas recipes for future projects. The focus is on exploring and extending functionality.

A React + TypeScript block-diagram editor built with React Flow and actual [shadcn/ui](https://ui.shadcn.com/) components. The canvas fills the browser; controls and independently collapsible panels float above it.

## Run

Requires Node.js 22.12+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open the URL Vite prints. `npm run build` creates `dist/`, `npm run preview` serves the production build, and `npm test` runs the model tests.

## Continuous deployment

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) validates pull requests and deploys pushes to `main` to GitHub Pages and, when configured, Cloudflare Pages. Tests run before separate builds for the two hosting paths. Each deployment has its own job, so one platform's deployment failure does not stop the other. Pull requests and manual runs from other branches never deploy.

### GitHub Pages

[`.github/workflows/pages.yml`](.github/workflows/pages.yml) runs tests and builds the app on pull requests and pushes to `main`. After a successful build on `main`, it deploys `dist/` to GitHub Pages. You can also run it manually from the Actions tab with `main` selected. Pull requests only run validation.

In the repository's **Settings → Pages → Build and deployment**, select **GitHub Actions** as the source ([Vite deployment guide](https://vite.dev/guide/static-deploy#github-pages)). Once this workflow is pushed to `main` and succeeds, the app will be available at <https://davidgcorr.github.io/reactflow-recipes/>. The workflow uses the built-in GitHub token; no personal access token or deployment secret is needed.

The deployment build sets Vite's base URL to the repository path (override the `PAGES_BASE_PATH` repository variable with `/` for a custom domain), so scripts, styles, and public links work under `/reactflow-recipes/`. Local development keeps its default root path. To check the Pages build locally:

```sh
npm run build -- --base /reactflow-recipes/
node scripts/check-deploy-build.mjs /reactflow-recipes/
npm run preview
```

Open `http://localhost:4173/reactflow-recipes/`.

### Cloudflare Pages

Create a **Direct Upload** Pages project in Cloudflare with production branch `main` (for example, `reactflow-recipes`). Follow [Cloudflare's CI deployment guide](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/) to create an API token with **Account → Cloudflare Pages → Edit**, scoped to the deployment account.

In the GitHub repository's **Settings → Secrets and variables → Actions**, add:

| Type | Name | Value |
| --- | --- | --- |
| Secret | `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| Secret | `CLOUDFLARE_API_TOKEN` | Pages API token |
| Variable | `CLOUDFLARE_PAGES_PROJECT_NAME` | Existing Pages project name, e.g. `reactflow-recipes` |

The Cloudflare deployment job stays disabled until the project-name variable is set. Once configured, a successful push to `main` or a manual workflow run on `main` uploads the root-path build to Cloudflare Pages. The deployment URL appears in the GitHub `cloudflare-pages` environment. Credentials are only supplied to the production deployment job. GitHub Pages continues to work without Cloudflare credentials.

This workflow uploads prebuilt static assets; it does not create the Cloudflare project or configure a custom domain. Use Direct Upload so Cloudflare does not perform a second Git-triggered build. To check its build locally:

```sh
npm run build -- --base /
node scripts/check-deploy-build.mjs /
```

The workflow checks HTML asset paths plus the public runtime, favicon and license file for both hosting paths before publishing. Local projects are stored per browser origin, so GitHub Pages and Cloudflare have separate local storage; export/import project JSON to move projects between them.

## Workspace

- The project title can be edited beside the milver wordmark at the top left.
- The top-left button opens/closes the floating block library. The **Blocks** tab starts with Sources, followed by Operators & functions, JavaScript, Sinks and Structure. Tiles preview input and output ports. **My Blocks** has collapsible Block Examples, Saved Blocks and My Projects sections. The **Libraries** tab manages project-wide JavaScript packages without creating canvas blocks. Selecting a block or wire opens the inspector; deselecting minimizes it. The top-right panel button also opens/closes it. **Clear canvas** removes blocks and wires from the active canvas and supports Undo. The **Projects** folder button stores named snapshots in this browser, with Open, Update, Rename, Delete and JSON download. Import JSON into the project manager to add projects without replacing the current canvas. Drag the left edge of the right panel to resize it; the width is saved locally. Keyboard users can focus its separator and use the arrow keys.
- Canvas tools float at the bottom; the canvas hierarchy shows a home icon at the top and parent block names inside nested canvases. Import, export, and JSON editor use icon buttons with accessible labels and tooltips.
- Drag a block from the library to place it. Clicking a library item adds a block near the viewport center. Double-click a JavaScript block to use its controls; click outside it to return to dragging.
- Drag blocks to move them; moving a block hides the inspector. Select a block to reveal four corner resize handles. The inspector has **Properties** (names, values, descriptions, ports), **Render** (appearance and the render function), **Code** (logic, port mappings and runtime feedback), and **JSON** (editable block data) tabs.
- Block labels sit outside the bottom border. A subtle, divided type breadcrumb (for example, `Sources › String`) can be collapsed with its chevron and restored using the chevron on hover or **Render → Type breadcrumb**.
- Inputs and outputs can sit on the left, right, top, or bottom. Multiple ports on a side are evenly spaced. Hover over a port for one second, then drag the small grip beside it to move it along any border; drag the circular port itself to connect wires. Focus a grip and use arrow keys for fine adjustment. Ports magnetize to the center and evenly spaced positions on their destination border. Port names appear only while hovering over that port. Custom positions, including parent interfaces, are saved in JSON and used in exports. Move a port and its connections follow it.
- Ports use concentric circles: outputs have a filled core, inputs have hollow blue rings. Drag an output to an input to connect them. Outputs can fan out; each input accepts one connection. Connections between different blocks can form feedback loops.
- Scroll or pinch to zoom. Hold Space and drag, use the middle/right mouse button, or choose the hand tool to pan. Drag the background in selection mode to select multiple blocks.
- Edits are saved locally in your browser. Export a JSON file for a portable copy. The importer reads the previous recipe's version-1 diagrams; previous local data is migrated without deleting the old storage entry.

## Parent blocks and nested canvases

1. Add a **Parent block** from the library. It starts with an internal Input → Gain → Output example.
2. **Double-click** it to enter its own canvas. The inspector's Enter canvas button and the block's arrow also enter it.
3. Add **Input** and **Output** interface blocks from the library inside the parent. These entries appear only inside nested canvases.
4. Rename an interface block to name the parent's external port. Choose **Side on parent** to position that port on the left, right, top, or bottom.
5. Connect an Input block's output to the internal system; connect the internal system to an Output block's input.
6. Return using the breadcrumb, back arrow, or Escape. The parent exposes exactly the interfaces defined inside it.

Input and Output markers inside a parent are compact 28 × 28 ports, with a small handle and an external name. Larger legacy interface blocks migrate to the compact size without changing port IDs or wiring. Inputs and outputs remain synchronized in both directions: editing a parent's port name/side updates its internal interface block. Adding a parent's port creates the corresponding interface block inside. Deleting either removes its internal and external incident connections. Parents can contain further parents, up to 16 levels. Each canvas keeps an independent viewport. Undo/redo includes nested edits and restores the relevant canvas.

`examples/parent-block.json` contains a complete connected nested controller you can import. `examples/two-blocks.json` is a minimal flat example.

## shadcn theme

The first workspace uses a black-and-white Neutral palette. Open the palette icon to change Light/Dark mode, choose a preset, tune **OKLCH hue and chroma**, or change corner radius. Chroma 0 is monochrome. Canvas customization also includes a saved **Rough mode** switch and **Roughness** slider (0–3) for hand-drawn block outlines and arrows (including publication exports), a grid switch and Plain, Aurora, Ocean and Sunset backgrounds. `theme.rough`, `theme.roughness`, `theme.showGrid` and `theme.canvasBackground` are saved in diagram JSON alongside the theme. Blocks, ports, floating panels, dialogs, and controls share the same semantic CSS variables. Legacy per-block `data.color` remains in JSON for compatibility. `data.visuals` optionally overrides theme fill and ink and controls header, label, mask content, port labels, dimensions and radius. Use **Use theme colors** to clear fill and ink overrides.

The official shadcn CLI generated the components in `src/components/ui/`. Radix provides keyboard interactions, focus management, dialogs, collapsibles, selects, tooltips, and sliders. `components.json` configures future shadcn additions. `src/theme.ts` maps theme settings to semantic tokens.

## JSON ↔ UI

`src/model.ts` defines the versioned schema, templates, validation, serialization, and immutable canvas updates. A diagram contains `version: 1`, `name`, `nodes`, `edges`, `viewport`, and optional `theme` and `modules`.

Each block has `id`, `type: "block"`, `position`, `width`, `height`, and `data` with its label, kind, description, display value, legacy color, and ports. A port has `id`, `name`, `type: "input" | "output"`, and `side: "left" | "right" | "top" | "bottom"`. Edges refer to node IDs and port IDs through `source`, `sourceHandle`, `target`, and `targetHandle`.

Parent blocks use `data.kind: "subsystem"` and `data.canvas: { nodes, edges, viewport }`. Their external ports correspond to `inport` and `outport` nodes in the child canvas:

- The parent's port ID equals its interface block's node ID.
- Its port name equals the interface block's `data.label`.
- Its side comes from the interface block's `data.exposedSide`.
- An `inport` exposes a parent input but has one output inside the canvas.
- An `outport` exposes a parent output but has one input inside the canvas.

Import validates all nested canvases, interface consistency, connections, dimensions, IDs, viewport values, and theme settings before replacing anything. Limits are 2,000 total blocks, 10,000 total connections, and 16 nested levels. Invalid imports leave the existing diagram untouched. Selection and measured DOM sizes are excluded from JSON at every nesting level.

Theme example:

```json
{ "mode": "light", "hue": 0, "chroma": 0, "radius": 10 }
```

`canvasAt`, `updateCanvas`, `makeNode`, `serializeDiagram`, and `parseDiagram` are reusable independently from the editor.

## Publishing exports

Use the download icon at the top right to open the export dialog. JSON remains available there, and Cmd/Ctrl+S still exports the editable JSON source.

| Format | Publishing use |
| --- | --- |
| HTML | A self-contained, read-only interactive viewer. Pan, zoom, and navigate parent blocks. Works offline or in an iframe. |
| SVG | Real vector paths, shapes, and text; no HTML foreignObject, screenshots, external stylesheets, or network dependencies. |
| PNG | A high-resolution raster image, with optional transparent background. |
| GIF | A 24-frame, 1.92-second looping connection illustration, or a still GIF when animation is off. |
| JSON | The complete editable system and theme, for reopening in milver. |

**Current canvas** exports every block at the current level, including blocks outside the visible viewport. **Entire system** includes every nested canvas: HTML makes them navigable, while images arrange them vertically as labeled sheets. HTML defaults to Entire system. Static SVG and PNG exports show each canvas's blocks and connections; parent internals appear on their own sheet when Entire system is selected.

Image exports support an optional title and dot grid. PNG and SVG can have a transparent page background; blocks keep their theme fill. PNG width options range from 800 to 4096 pixels. GIF width is capped at 1600 pixels, uses a solid background and a palette of up to 256 colors, and animates moving dots on connections for illustration, not numerical simulation. GIFs without connections export as a still image. Raster exports preserve aspect ratio; very large systems are scaled to stay within 8192 pixels in height and a 16-megapixel PNG / 2-megapixel GIF budget. The dialog shows the actual resulting dimensions.

All formats use the diagram's shadcn theme. Selection borders, resize handles, editor panels, toolbars, and minimap are excluded. Image framing is independent of editor pan and zoom. Text uses standard system fonts, with no external font downloads.

After a download, **Copy embed** provides either an `<img>` tag for an image or an `<iframe>` tag for HTML. Upload the file to your own website and replace `src` with its published path. For example:

```html
<img src="/diagrams/system.svg" alt="System diagram" style="max-width:100%;height:auto" loading="lazy">
<iframe src="/diagrams/system.html" title="System diagram" width="100%" height="600" style="border:0" loading="lazy"></iframe>
```

The HTML viewer opens parent blocks by double-clicking or by focusing them and pressing Enter/Space. Breadcrumbs and Escape return to the parent. Each level retains its pan and zoom during viewing. It embeds all graphics, styles, scripts, and license notices into a single file; no React, CDN, account, or server application is needed. Websites that strip scripts can use SVG, PNG, or GIF instead.

Exporting downloads files locally; it does not publish or upload anything. Export rendering lives in `src/export/scene.ts`, HTML viewing in `src/export/html.ts`, browser encoding in `src/export/download.ts`, and the shadcn dialog in `src/components/export-dialog.tsx`.

## Shortcuts

| Action | Shortcut |
| --- | --- |
| Select / pan tool | V / H |
| Temporarily pan | Space + drag |
| Fit canvas | 1 |
| Undo / redo | Cmd/Ctrl+Z / Cmd/Ctrl+Shift+Z |
| Duplicate selection | Cmd/Ctrl+D |
| Delete selection | Delete / Backspace |
| Export JSON | Cmd/Ctrl+S |
| Leave parent canvas | Escape |

Shortcuts do not run while typing in fields or using a dialog, select, or slider.

## Attribution

React Flow is MIT licensed. The application hides its on-canvas badge using `proOptions.hideAttribution` and retains the copyright and permission notice in `THIRD_PARTY_NOTICES.txt` and the production asset `THIRD_PARTY_NOTICES.txt`, linked from Help. The maintainers request supporting the project through React Flow Pro when removing the badge; see their [attribution guidance](https://reactflow.dev/remove-attribution).

The editor uses the official `@xyflow/react` package from [xyflow/xyflow](https://github.com/xyflow/xyflow). A reference checkout was fetched to `/tmp/reactflow-recipes-xyflow-reference` during initial development.

This is a diagram editor, not a numerical simulation engine. Constants, gains, sums, and JavaScript recipes provide live value previews. Integrators and other simulation placeholders do not simulate a numerical system.

## Project libraries

Open **Libraries** in the left panel to add an ES module URL, upload `.js`/`.mjs` files, or create an embedded module. Expand an imported library to edit its alias, URL or source; use its trash button to remove it. These edits support undo/redo. Importing a library never creates a block or any connections.

Libraries are exposed to every mounted JavaScript block, including its render function, as `modules.alias`. For example, a library saved as `helper` with `export const double = x => x * 2` is available as `modules.helper.double(x)`. Embedded libraries can import each other by project alias. The block’s code can also use dynamic imports for project aliases. Remote libraries must be browser-compatible ESM with CORS support. Embedded React libraries can import `react`, `react-dom`, `react-dom/client` and `react/jsx-runtime`; those specifiers resolve to the bundled UI instance so hooks remain compatible. Remote React component libraries should externalize those React imports. Uploaded source is embedded in JSON; remote URLs require network access.

## JavaScript logic and rendering

**JavaScript → Module** provides two complete, editable functions. Code computes and emits data; Render is a synchronous React function component returning JSX. The editor supplies their lifecycle and shared scope.

```jsx
async function run({ inputs, state, emit }) {
  state.result = Number(inputs.input1 ?? 0) * 2;
  emit(state.result);
}

function render({ inputs, state, block, modules }) {
  const color = inputs.input2 ?? '#0ea5e9';
  return <div style={{ padding: 16, color }}>
    <small>{block.label}</small>
    <strong style={{ display: 'block', fontSize: 32 }}>{state.result}</strong>
  </div>;
}
```

Code runs before the component renders. Input, parameter and block-property updates rerun Code and refresh Render. Saved state mutations also repaint the component without rerunning Code or restarting its timers. Calling `await render()` explicitly remains supported. Render must return JSX synchronously; use effects for asynchronous visual work.

The same scope is available as function arguments or directly inside both functions:

| Name | Purpose |
| --- | --- |
| `inputs`, `variables` | Port IDs and configured input aliases |
| `state`, `setState(patchOrUpdater)` | Shared saved JSON state; direct nested mutations also repaint |
| `block` | Live id, label, description, kind, parameter value, dimensions, position, ports, visual settings and other block metadata; `block.state` refers to saved state |
| `modules.alias` | All imported project/block libraries; bundled React and controls are also available as `modules.React` and `modules.shadcn` |
| `value`, `renderer`, `ports`, `wasm` | Parameter string, viewer settings, port definitions and Wasm configuration |
| `actions` | Event behavior defined in Code and called from JSX; functions are kept outside saved JSON |
| `emit(value, port)`, `emitEvent(value, port)` | Publish outputs or distinct events; defaults to the first output |
| `setValue(string)`, `setProperty(path, value)` | Save the parameter or control a block property |
| `onCleanup(fn)` | Dispose resources owned by Code before its next run or unmount |

`React`, `useState`, `useEffect`, `useLayoutEffect`, `useRef`, `useMemo` and `useCallback` are in scope. `useState` keeps transient component UI state across input updates. Use saved `state` or `setState()` for values that must travel in JSON. React effects run normally and clean up on dependency changes/unmount. Components keep their identity while inputs or block properties change. Visual errors stay inside the block and a later valid input can recover the component.

The bundled components are `Button`, `Slider`, `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem`, `<MathValue value={state.result} fontSize={24}/>` and `<Latex tex="x^2" fontSize={24}/>`. Math components retain the fitted KaTeX/MathML presentation and clean up their observers. Numeric render functions expose font size and precision as simple constants. Three.js uses a ref and an effect whose cleanup releases its graphics resources.

For behavior controlled by inputs, keep output logic in Code and connect it to JSX through actions:

```jsx
async function run({ inputs, state, actions, emit }) {
  state.enabled = Boolean(inputs.input1 ?? true);
  state.count ??= 0;
  actions.increment = () => { state.count++; emit(state.count); };
}

function render({ state, actions }) {
  return <Button disabled={!state.enabled} onClick={actions.increment}>
    Increment · {state.count}
  </Button>;
}
```

Use `setProperty('label', 'Result')`, `setProperty('width', 280)` or `setProperty('visuals.background', '#ffffff')` in Code, or in a React effect, to control the block itself. Supported inspector fields are validated and recorded in `data.controlledProperties`; corresponding controls and resize handles lock automatically. Remove the code assignment and release ownership in Render to resume UI editing.

CodeMirror highlights JavaScript/JSX and JSON. **Use React template** stages the current block’s JSX template without overwriting its saved renderer until Apply. **Block help & snippets** offers complete component examples in Render and insertable code snippets in Code. `data.module`, `data.render`, `data.state`, libraries, geometry, controls and wiring all travel in project JSON. State and output values must be bounded JSON data; infinity is supported, while functions, cycles and NaN are rejected.

**Sources** includes Number, Boolean, String, Text, CSV, Vector, Matrix, Tensor, Slider, Selector and Button. Counter and Trigger are in Block Examples. Their logic and render bodies use the same API. `setValue(string)` saves a source parameter; source controls use it for slider positions, selector choices and button counts. Counter periods are milliseconds (minimum 16 ms). Trigger counts rising input edges.

**My Blocks → Block examples** contains Three.js and LaTeX examples with graphics in Render. Three.js registers its required package in Libraries; LaTeX uses the bundled renderer. The Three.js example needs WebGL. **WebAssembly** starts with a working two-input integer add binary. Import another `.wasm` file in Code and choose the exported function. The binary, wrapper logic and rendering all round-trip through JSON.

JavaScript blocks run in opaque-origin iframes with `sandbox="allow-scripts"`. They cannot access the editor DOM or its local storage. Library namespaces are shared within a block’s logic and rendering, while each iframe has its own library instances. Pure visible JavaScript graphs run in their block frames; the shared project worker is used for nested routing and explicit shared computations. Custom JavaScript runs while its canvas is mounted; hiding mask content leaves the runtime mounted. Publication exports show static labels; JSON preserves executable code and configuration.

**Math viewer** handles numeric presentation, and **General viewer** shows formatted JSON and JavaScript values. It now uses the same editable `run()` and `render()` functions as other math blocks. Tune the LaTeX, font size, precision, slice selection, colors or JSX layout in Render; the source and saved state travel in JSON. Older viewer nodes receive the default functions when loaded. It accepts scalars, vectors, nested matrices/tensors, older shaped tensors, and runtime preview metadata. It uses LaTeX for numeric data and text for other values. Choose precision, formula font size and tensor slice in Properties. Scope and Python are no longer offered in the palette; older saved projects remain readable.

## Reusable blocks, operators and sinks

Use **Save to My Blocks** in a JavaScript block’s inspector to capture its name, dimensions, parameter, ports, saved state, logic, rendering and project libraries. Insert a saved block to create an independent instance with a fresh ID. Deleting a saved definition leaves placed instances intact. Definitions live in `diagram.myBlocks` and travel with JSON and project undo/redo. Aliases with conflicting library definitions are reported before insertion.

**Operators & functions** includes Gain (scalar or tensor scaling), matrix multiplication, addition/residuals, elementwise multiplication/scaling, dot/cross products, transpose, reshape, tensor contraction, softmax, GELU, layer normalization, linear projection and scaled dot-product attention. Adding a numeric source or operator registers the bundled TensorFlow.js runtime if needed. Its code calls `modules.tensorMath`, a stable facade around TensorFlow.js tensor operations; `modules.tf` exposes the low-level API. Custom project libraries keep their aliases. Unconnected ports use the example defaults in Parameter. The CPU backend is bundled for offline execution in sandboxed frames and workers. It uses float32 computation and disposes temporary tensors after each operation. The facade supports broadcasting, batched/vector matrix products, stable softmax, normalization and optional causal attention.

Open **My Blocks → My Projects** for **Attention · text to output** ([JSON](examples/attention-step-by-step.json)) or **Transformer forward pass** ([JSON](examples/transformer-forward.json)). Both start with text → word tokenization → dictionary IDs → embedding lookup, then expose Q Kᵀ → scale by 1/√dₖ → row-wise softmax → multiply by V → multiply by W₀. The full example also includes token embeddings, explicit Q/K/V weight matrices, residuals, layer normalization and a two-layer feed-forward network with GELU. Weights are editable Matrix sources; biases are in the Linear block parameters. These are small, untrained, single-head examples. A third **Tokenizing “dictionary”** example ([JSON](examples/tokenization-dictionary.json)) demonstrates greedy longest-match pieces `dict · ion · ary`, integer IDs and embedding lookup. Vocabularies and embedding tables are editable in Parameter. These tokenizers are small educational examples, not pretrained tokenizers or a BPE training implementation. `node scripts/create-transformer-example.mjs` regenerates all three from the stock blocks.

**Sinks** includes a Math viewer and a separate General viewer for JavaScript objects, arrays and scalar values, plus a line graph and a scatter plot. The line graph accepts a numeric vector or retains the last 128 scalar values. The scatter plot accepts `[[x,y], ...]` pairs and displays up to 256 points. Graph state and editable SVG/JSX rendering round-trip through JSON.

Numeric sources use Python-style list notation: `[1,2,3]`, `[[1,2],[4,5]]`, or `[[[1,2]],[[3,4]]]`. A small parser accepts these lists (including trailing commas and `inf`, `-inf`, `Infinity` or `∞` tokens), checks rectangular shape and numeric values, and converts them to temporary TensorFlow.js tensors. Ports and saved state carry plain nested arrays, so every source, operator and viewer uses the same transferable format. Earlier `{shape, data}` inputs are still understood. In a numeric block’s Render function, change `const fontSize = 24` to tune formula size.

Canvas Ctrl/Cmd+C copies all selected blocks and their internal connections; Ctrl/Cmd+V pastes independent copies with new IDs, preserving nested parent interfaces and library definitions. Browser clipboard access has an in-app fallback. Text/code editors keep their usual clipboard behavior.

The Libraries panel includes reference cards for React, shadcn/ui, KaTeX and TensorFlow.js. Project JSON records the numeric runtime as `{ "builtin": "tensorflow", "referenceUrl": "https://www.tensorflow.org/js" }`; it does not embed the large compiled dependency. Importing JSON restores the same bundled CPU implementation.

TensorFlow.js was chosen for editable model construction and tensor operations ([tensor/operation guide](https://www.tensorflow.org/js/guide/tensors_operations)). ONNX Runtime Web is a strong alternative for executing existing ONNX models ([documentation](https://onnxruntime.ai/docs/get-started/with-javascript/web.html)); Transformers.js targets pretrained model pipelines. This editor needs individual operations that users can wire into a forward model.

## Existing project compatibility

Saved version-1 diagrams continue to load. Existing JavaScript blocks without `data.render` retain their `export default function mount(...)` lifecycle and embedded dependencies. Their Code tab identifies this API. New blocks save `async function run(...) { ... }` and synchronous React `function render(...) { return <.../>; }` declarations. Saved asynchronous/imperative renderers keep their earlier lifecycle; they are not silently overwritten. Earlier body-only source is adapted when shown in the editor and remains executable.

Older Import module, function, constructor, method, property and JS computation nodes remain supported when loaded from JSON; they are no longer generated from library imports. [`examples/shared-modules.json`](examples/shared-modules.json) demonstrates this earlier shared worker API, including live class instances, nested interface routing, and Run/Step execution. Its computation code exports `run({ inputs, modules, state, parameters, tick })`. That worker state and live instances are transient; the new JavaScript block state is saved explicitly in `data.state`.

`npm run dev` and `npm run build` generate the isolated worker bundle from `src/project/worker.ts`. Restart the dev command after editing worker source.

## Connection recipes

Select a connection to choose **Orthogonal** or **Bézier curve**, stroke color and width, and **None**, **Moving dashes**, or **Travelling pulse** animation. Travel time and reverse flow are configurable per connection. Double-click a wire to insert a waypoint near that segment; select the wire to drag its points. Double-click a point to remove it, or use **Reset waypoints**. Orthogonal routing retains square-axis segments with rounded corners; Bézier routing passes smoothly through the waypoints.

`src/connections.ts` shares route geometry between the editor and publication exports. Exported SVG/PNG/HTML/GIF use the chosen routing and basic block appearance. Programmable masks are represented by a static “JS module” label in publication exports; JSON retains the executable source. The publication GIF's existing global flow animation remains independent of editor animation settings.

Infinity example: `[[2,-inf,0],[0,2,0],[0,0,1]]`. Infinity remains numeric through TensorFlow operations, sandbox messages, saved state, clipboard and JSON import/export, and renders as ∞. Because JSON has no infinity literal, saved values use the reserved tagged form `{ "$number": "-Infinity" }` or `{ "$number": "Infinity" }`. Undefined arithmetic that produces NaN is reported as an error rather than being saved as null.

Connection animation supports moving dashes, travelling pulses and travelling glow. **Animated element size** sets the pulse/glow diameter or dash thickness in pixels. These settings, travel time and direction persist in connection JSON; GIF export retains element size and glow. The grid is transparent over every canvas background.

Block icons and category trails share one definition across the library, inspector and canvas header. JavaScript examples append their example name, such as `JavaScript > Module > Word tokenizer`. Trails are derived from the saved block kind and recipe. Code, Render and JSON editors use explicit syntax colors in light and dark themes.

**Sources → Text** preserves multiline text and whitespace, with `.txt` import in Properties (up to 10,000 characters). **Sources → CSV** imports or edits CSV, supports quoted/multiline cells and escaped quotes, selectable delimiters, headers, and optional conversion of finite numeric cells. Without headers it emits rows that connect to matrix operators; with headers it emits records. CSV previews accept up to 500 rows, 32 columns and 10,000 cells. Both sources retain their content, editable run/render functions and settings in project JSON.

**My Blocks → My Projects → NanoGPT · character forward pass** ([JSON](examples/nanogpt-characters.json)) groups the logic into Tokenization, Embeddings, GPT Block and LM Head parents. The GPT Block contains nested Causal Attention and MLP parents. Double-click to inspect their code and wiring. Internal computations execute in the project runtime while their parents are closed. The example follows NanoGPT's [character vocabulary preparation](https://github.com/karpathy/nanoGPT/blob/master/data/shakespeare_char/prepare.py) and [forward model structure](https://github.com/karpathy/nanoGPT/blob/master/model.py): sorted character IDs → token plus learned position embeddings → pre-norm causal attention and MLP residuals → final normalization → tied embedding weights → next-character probabilities and greedy decoding. It is a deterministic, untrained teaching model with one head, one layer, four embedding channels and a 16-character context; it does not load trained NanoGPT weights. The vocabulary comes from `hello world\n`; edit the vocabulary computation's corpus and match the CSV embedding rows to its sorted vocabulary to support more characters. The CSV token table is shared by the embeddings and language-model head. Run `node scripts/create-nanogpt-example.mjs` to regenerate it.

With **Snap to grid and connected ports** enabled, dragging a block or selection also aligns opposite connected ports within 12 screen pixels. This accounts for port offsets and block dimensions. Select an orthogonal wire to drag its intermediate segments: horizontal segments move up/down and vertical segments move left/right. Endpoint attachments stay fixed. Segment controls also accept arrow keys; each drag is one undo step. Manual routes persist as `edges[].data.routePoints` and use the same path in exports; **Reset route** restores automatic routing.

**Block Examples** now includes **Counter** (formerly Clock) and **Trigger**. Old Clock recipes remain loadable. **Sinks → General viewer** shows formatted JSON and a value type, with editable rendering; **Math viewer** keeps its existing mathematical rendering.

**My Blocks** uses the same section spacing and block tiles as the Blocks tab. Saved tiles can be clicked or dragged onto the canvas; their delete button appears on hover or focus. **My Projects** contains local saved projects and included examples, each identified by a JSON file icon, project type, author, date and block count. Author and document dates are optional `metadata.author`, `metadata.createdAt` and `metadata.updatedAt` fields in project JSON. Missing authors are shown as “Author not set”; saved-project cards use the local snapshot date. Local cards refresh when projects are saved, renamed, imported or deleted in the project manager.

**My Blocks → Block Examples** includes Metric card (input-controlled number and color), Progress ring (value and maximum), Input-gated button (enabled state and payload), Input-driven block (code-controlled title, background and width), Input-driven pulse (enable/period), Toggle, and Library-powered badge (shared imported formatting/color functions). Open **My Blocks → My Projects → Interactive blocks · React + inputs** for a wired playground ([JSON](examples/interactive-blocks.json)); double-click source controls and buttons to interact. Change the slider, color selector, enable toggle and period to see visuals, outputs and locked properties update. `node scripts/create-interactive-example.mjs` regenerates the project.

## Iframe blocks and appearance controls

**JavaScript → Iframe** embeds editable page HTML or an HTTP(S) URL. In Properties, select HTML/URL and edit the page. Its React render function uses `<Iframe data={state.payload} onMessage={actions.receive}/>`; the helper detaches observed state, sends the newest inputs after load/ready and on updates, and does not reload the page when inputs change.

An embedded page can receive and reply to values with this protocol:

```js
addEventListener('message', event => {
  if (event.source !== parent || event.data?.type !== 'milver-input') return;
  const { input1, input2 } = event.data.inputs;
  // Update the page, then return JSON-compatible data to the block's output.
  parent.postMessage({ type: 'milver-output', value: { received: input1 } }, '*');
});
parent.postMessage({ type: 'milver-ready' }, '*'); // optional: request current inputs
```

Messages also include `block: { id, label }`. Only replies from the actual child frame are accepted, and output must be bounded JSON-compatible data. The embedded page runs with `sandbox="allow-scripts"`; the `*` message target is required for its opaque sandbox origin. URL pages must allow embedding and implement the receive protocol; arbitrary existing websites do not automatically understand block inputs.

**Block Examples** adds **Iframe · live metric** (number and color inputs; replies with the received/doubled value) and **Iframe · bar chart** (numeric vectors or CSV rows and color; replies with summary statistics). **My Projects → Iframe inputs · live embedded pages** ([JSON](examples/iframe-inputs.json)) wires both examples to sources and General viewers. The included pages work without external services. Run `node scripts/create-iframe-example.mjs` to regenerate the project. HTML, URL configuration, functions, ports and wiring travel in JSON.

In **Render → Appearance**, width, height and corner radius pair a slider with an editable number. Invalid partial numeric edits are allowed while typing and clamped on blur. **Opacity** is a percentage control saved as `data.visuals.opacity` from 0 to 1; it affects the whole block and is retained in publication exports. Code can control it using `setProperty('visuals.opacity', 0.5)`, which locks both inspector controls until ownership is released.

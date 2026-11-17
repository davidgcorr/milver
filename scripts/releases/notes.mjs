import { git } from './version.mjs';
export const featureCatalog={
  capture:{title:'Export the running canvas',detail:'Capture real JavaScript visuals as PNG screenshots, videos and GIFs directly from the browser tab.',paths:['src/export/capture','src/components/export-dialog']},
  library:{title:'Find the right block faster',detail:'Separate datatypes, interactive controls and external data into three clear sections.',paths:['src/source-groups','src/block-presentation']},
  excalidraw:{title:'Sketch without the chrome',detail:'Switch the whole diagram to rough outlines with clean blocks and labels below.',paths:['src/components/rough-shapes','src/components/appearance','src/components/palette-glyph']},
  editing:{title:'Edit the value, right on the canvas',detail:'Double-click strings, booleans, numbers, vectors, matrices and tensors; save to run and render again.',paths:['src/components/inline-value-editor','src/components/block-node']},
  overview:{title:'Build ideas as diagrams',detail:'Compose JavaScript blocks, connect data and explore nested canvases.',paths:['src/App.tsx','src/components/block-node','src/components/inspector','src/styles.css']},
  arrows:{title:'Shape the connections',detail:'Edit Bézier waypoints, move orthogonal segments and choose pipe, rough, spiral or dashed arrow styles.',paths:['src/arrow','src/connections','src/components/flow-edge']},
  shapes:{title:'Give every block a shape',detail:'Use circles, ellipses, diamonds, polygons and custom Bézier outlines with ports that follow the border.',paths:['src/block-shapes','src/components/block-shape','src/components/visual-properties']},
  modules:{title:'JavaScript, connected',detail:'Bring project libraries, editable code and render functions into a visual graph.',paths:['src/project/','src/components/project-modules','src/components/code-','src/components/render-','src/module']},
  backups:{title:'Take the whole project with you',detail:'Export and import JSON with nested canvases, code, libraries, drafts, saved blocks, state and settings.',paths:['src/export/','src/model.ts','src/code-config','src/project-store','src/clipboard']},
};
export function changesFor(sha,cwd=process.cwd()){
  const parent=git(['rev-list','--parents','-n','1',sha],cwd).split(' ')[1];
  const files=git(parent?['diff','--name-only',parent,sha]:['ls-tree','--name-only','-r',sha],cwd).split('\n').filter(Boolean);
  const subject=git(['show','-s','--format=%s',sha],cwd).replace(/[\r\n]/g,' ').slice(0,200);
  const selected=Object.entries(featureCatalog).filter(([,feature])=>files.some(file=>feature.paths.some(prefix=>file.startsWith(prefix)))).map(([key])=>key);
  const maintenance=files.every(file=>/^(docs\/|README|\.github\/|scripts\/|outputs\/|package|\.gitignore)/.test(file));
  return {subject,files,parent:parent??null,features:selected.length?selected:['overview'],maintenance};
}
const angles={
 capture:{hook:'The diagram runs. The export should show it.',x:'Capture live JavaScript blocks as a screenshot, video or GIF—right from the browser tab.\n\nMove a slider. Watch the result. Share what actually happened.',reddit:'I added real tab capture to my visual JavaScript editor because exporting placeholder blocks was missing the point',problem:'A screenshot of a function label cannot show an interactive explanation doing its work.',demo:'Open Export, choose Screenshot, Video or GIF, then share this tab. The editor controls disappear while the actual running blocks and their interactions are captured.',lesson:'Sharing an interactive idea starts with preserving what the person actually saw.',question:'When sharing a technical demo, do you reach for a screenshot, a short video, or a GIF?'},
 library:{hook:'A block library should not feel like a scavenger hunt.',x:'Data types in one section. Sliders and buttons in another. Text and CSV sources in a third.\n\nLess searching. More experimenting with the diagram.',reddit:'I split the sources in my visual editor into datatypes, controls and imported data — is this clearer?',problem:'Grouping numbers, sliders and CSV imports together makes a simple input choice harder than it needs to be.',demo:'The left panel now separates Number/Boolean/String/Vector/Matrix/Tensor, interactive controls, and Text/CSV sources.',lesson:'A useful category tells you why you would pick a block.',question:'Which block would you expect to find first when starting a new diagram?'},
 excalidraw:{hook:'Sometimes the best diagram needs less UI.',x:'One toggle: rough outlines, clean blocks, labels underneath.\n\nSwitch back when you want the details. The JavaScript keeps running either way.',reddit:'I added a sketch mode to my runnable diagram editor — does less visual chrome make an explanation clearer?',problem:'Type headers help when building a graph, but can distract when explaining the idea.',demo:'Toggle Excalidraw mode in the top bar. Every block gets rough outlines and loses its type header, while its label and live content remain.',lesson:'The same working diagram can serve as both a workspace and an explanation.',question:'When presenting a technical diagram, which details do you hide first?'},
 editing:{hook:'Double-click the value. Change it. See what happens.',x:'Strings, numbers, booleans, vectors, matrices and tensors—editable right on the canvas.\n\nSave the edit and the normal JavaScript execution and rendering take over.',reddit:'I removed the inspector round-trip for editing values in my visual JavaScript tool — looking for UX feedback',problem:'Changing one input should not require hunting for a field in a side panel.',demo:'Double-click a datatype block, edit its value, and press Enter or click outside. The block runs and renders again. Escape cancels.',lesson:'Shortening the distance between an input and its result makes experimenting easier.',question:'Would you expect Enter to save a matrix value, or prefer an explicit save button?'},
 overview:{
  hook:'What if the diagram actually ran the code?',
  x:'Wire JavaScript blocks together. Change an input. Watch the result.\n\nI built Milver to make math and code something you can explore, not just read.',
  reddit:'I built a browser tool where JavaScript diagrams actually execute — what would you use it to explain?',
  problem:'A static diagram can explain the structure of a program, but it cannot show what happens when an input changes.',
  demo:'Connect an input to a JavaScript function, change the input, and inspect the live output without leaving the canvas.',
  lesson:'A diagram gets more useful when the reader can ask it a question by changing an input.',
  question:'Which concept would you turn into an interactive diagram first?'
 },
 arrows:{
  hook:'The hardest part of a diagram should not be moving an arrow.',
  x:'Add Bézier points. Drag any orthogonal segment. Choose a pipe, spiral or rough connection.\n\nSmall editing details make a big difference when you are explaining an idea.',
  reddit:'I made the connections in my diagram editor directly editable — looking for feedback on routing UX',
  problem:'When a connection crosses the wrong part of a diagram, rearranging the whole graph just to fix the wire interrupts the explanation.',
  demo:'Add and drag Bézier waypoints, move an orthogonal segment while its endpoints stay attached, and try different arrow styles.',
  lesson:'Editing the connection should be as direct as editing the thing it connects.',
  question:'What is the most frustrating connection-editing behavior in the tools you use?'
 },
 shapes:{
  hook:'Why should every block in a diagram look the same?',
  x:'Circles, diamonds, polygons—or draw your own Bézier outline.\n\nThe ports follow the border, so the shape stays part of the graph. Built this into Milver.',
  reddit:'Custom Bézier block outlines with ports that follow the shape — here is the interaction in my editor',
  problem:'A rectangle is a useful default, but different parts of an explanation sometimes need different visual roles.',
  demo:'Choose a polygon or edit a Bézier outline with anchors and tangent handles. Resize it and check how the connected ports follow its border.',
  lesson:'Visual customization matters most when the connections and editing behavior still work.',
  question:'Would you use custom outlines for meaning, grouping, or just readability?'
 },
 modules:{
  hook:'Your JavaScript module, with a canvas around it.',
  x:'Import a library. Connect inputs to a function. Move a slider and watch the output change.\n\nThis is live code running in Milver—not a diagram of what the code might do.',
  reddit:'I put real JavaScript modules on a visual canvas — the clip shows an input changing the function output',
  problem:'It is easy to draw a function in a diagram and much harder to let someone explore how that function behaves.',
  demo:'A shared ES module exports double(). A slider feeds an input block, a connected block calls the module, and the output updates in the browser.',
  lesson:'The useful part is the feedback loop: change the input, inspect the output, and keep the code in view.',
  question:'What kind of module would you want to inspect this way—numerical code, data transforms, or something else?'
 },
 backups:{
  hook:'A diagram backup should include the code that makes it work.',
  x:'Milver JSON keeps the blocks, JavaScript, libraries, drafts, nested canvases and saved state together.\n\nAn editable project you can take with you.',
  reddit:'What should a portable visual-programming project include? Here is the JSON backup format I am building',
  problem:'Saving the visible blocks is not enough if reopening the project loses the code, library sources, drafts, or nested canvases.',
  demo:'Inspect the project JSON: it includes the JavaScript module source alongside the graph and its settings. Then reopen it as an editable project.',
  lesson:'Portability is part of the product experience, not just an export button.',
  question:'What have you lost when moving a project between visual tools, and what should a backup always preserve?'
 }
};
export function primaryFeature(changes,{general=false}={}) {
 return general?'overview':changes.features.find(key=>key!=='overview'&&angles[key])??'overview';
}
export function socialPosts(meta,changes,options={}){
 const key=primaryFeature(changes,options),angle=angles[key];
 const x=`${angle.hook}\n\n${angle.x}\n\n${meta.site}`;
 if(x.replace(/https?:\/\/\S+/g,'x'.repeat(23)).length>280)throw new Error('X draft exceeds 280 weighted characters.');
 return {
  x:x+'\n',
  reddit:`Title: ${angle.reddit}\n\n${angle.problem}\n\nI am the developer of Milver, a visual JavaScript tool that runs in the browser. I have been working on making this interaction something you can try, rather than a static illustration.\n\nWhat the recording shows:\n\n${angle.demo}\n\nThe graph and its JavaScript stay editable. I am interested in where this interaction is useful and where it gets in the way.\n\n${angle.question}\n\nIf you want to try it: ${meta.site}\n`,
  linkedin:`${angle.hook}\n\n${angle.problem}\n\nThat is the interaction I have been building in Milver.\n\n${angle.demo}\n\n${angle.lesson}\n\nI see this as useful for developers and educators who want someone to explore an idea for themselves. The attached recording shows the actual interaction in the browser.\n\n${angle.question}\n\nTry it: ${meta.site}\n\n#JavaScript #DataVisualization\n`,
 };
}

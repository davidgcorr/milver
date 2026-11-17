import { git } from './version.mjs';
export const featureCatalog={
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
export function socialPosts(meta,changes,{general=false}={}){
  const title=general?'Milver: visual JavaScript in the browser':`Milver ${meta.tag}`;
  const details=changes.features.map(key=>featureCatalog[key].detail);
  const label=changes.maintenance?'A maintenance release':'A new release';
  const summary=general?'Connect JavaScript blocks, explore mathematical ideas and keep the complete project in JSON.':`${label}: ${changes.subject}`;
  const x=`${title}\n\n${general?'Turn JavaScript and math into diagrams you can explore.':changes.maintenance?'Maintenance update, with a fresh set of product visuals.':`Updated: ${changes.features.map(key=>({overview:'the editor',arrows:'arrow editing',shapes:'block shapes',modules:'JavaScript modules',backups:'project exports'})[key]).join(', ')}.`}\n\n${meta.site}`;
  if(x.replace(/https?:\/\/\S+/g,'x'.repeat(23)).length>280)throw new Error('X draft exceeds 280 weighted characters.');
  return {
    x:x+'\n',
    reddit:`Title: ${title} — ${general?'a browser-based visual JavaScript tool':changes.maintenance?'maintenance update':changes.features.map(key=>({overview:'editor',arrows:'connections',shapes:'shapes',modules:'modules',backups:'JSON backups'})[key]).join(', ')}\n\n${summary}\n\n${general?'I’m building Milver to make JavaScript and mathematical ideas easier to inspect as connected diagrams.':'What changed in this commit:\n\n- '+changes.subject}\n\n${general?'A few things you can do:':'The attached media illustrates these current capabilities:'}\n\n${details.map(detail=>'- '+detail).join('\n')}\n\nTry it: ${meta.site}\nSource / release: ${meta.releaseUrl}\n\nI’d be interested in feedback on the editing experience and which examples would be most useful.\n\nDisclosure: I’m the developer.\n`,
    linkedin:`${title}\n\n${summary}\n\n${general?'I’m building Milver for developers and educators who want to explain and explore ideas through connected JavaScript blocks.':'The release is tied to commit '+meta.shortCommit+'.'}\n\n${details.map(detail=>'• '+detail).join('\n')}\n\n${general?'From a graph to a portable project, the goal is to make the idea easier to inspect and share.':'The attached visuals show the related product capabilities; the commit summary above describes this release’s change.'}\n\nExplore Milver: ${meta.site}\n\n#JavaScript #DataVisualization #DeveloperTools\n`,
  };
}

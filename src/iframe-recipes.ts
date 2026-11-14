import type { JsRecipe } from './js-recipes';
const page = (body: string, script: string) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}html,body{margin:0;width:100%;height:100%;font:14px system-ui;color:#171717}body{display:grid;place-items:center;padding:16px}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head><body>${body}<script>
addEventListener('message', event => {
  if(event.source !== parent || event.data?.type !== 'milver-input') return;
  const { input1, input2 } = event.data.inputs;
  ${script}
});
parent.postMessage({type:'milver-ready'},'*');
</script></body></html>`;
export const iframeEchoHtml = page('<section style="width:100%"><small>INPUTS FROM THE BLOCK</small><pre id="value"></pre></section>',`document.getElementById('value').textContent = JSON.stringify({input1,input2},(_key,value)=>typeof value==='number'&&!Number.isFinite(value)?String(value):value,2);
parent.postMessage({type:'milver-output',value:{input1,input2}},'*');`);
export const iframeMetricHtml = page('<section id="card" style="width:100%;padding:20px;border-radius:16px;background:#e0f2fe"><small>LIVE EMBEDDED METRIC</small><div id="metric" style="font-size:44px;font-weight:650;margin-top:8px"></div></section>',`const value = Number(input1 ?? 0), color = typeof input2 === 'string' ? input2 : '#0ea5e9';
document.getElementById('metric').textContent = String(value);
document.getElementById('card').style.background = color+'22';
document.getElementById('card').style.color = color;
parent.postMessage({type:'milver-output',value:{received:value,doubled:value*2}},'*');`);
export const iframeChartHtml = page('<section style="width:100%"><small>INPUT-DRIVEN CHART</small><div id="bars" style="display:flex;align-items:end;gap:8px;height:120px;margin-top:12px"></div></section>',`const values = (Array.isArray(input1) ? input1.flat() : [input1 ?? 0]).map(Number);
if (!values.length || !values.every(Number.isFinite)) return;
const maximum = Math.max(1,...values.map(Math.abs)), color = typeof input2 === 'string' ? input2 : '#8b5cf6';
const bars = values.map(value => { const bar=document.createElement('div');bar.style.cssText='flex:1;min-width:12px;border-radius:5px 5px 0 0;text-align:center;color:white;font-size:11px;transition:height .2s';bar.style.height=Math.max(12,Math.abs(value)/maximum*100)+'%';bar.style.background=color;bar.textContent=String(value);return bar; });
document.getElementById('bars').replaceChildren(...bars);
parent.postMessage({type:'milver-output',value:{count:values.length,total:values.reduce((a,b)=>a+b,0),maximum:Math.max(...values)}},'*');`);
const source = `// The page receives these named values via postMessage, without reloading.
const config = JSON.parse(value);
if (config.mode === 'url' && !['http:','https:'].includes(new URL(config.url).protocol)) throw new Error('Use an HTTP or HTTPS iframe URL.');
state.payload = { input1: inputs.input1 ?? config.initial ?? null, input2: inputs.input2 ?? null };
// Replies from the embedded page become this block's output.
actions.receive = reply => emit(reply);`;
const render = `function render({ state, value, actions, block }) {
  // Iframe handles load/ready and input updates. Tune the page in Properties.
  const config = JSON.parse(value);
  return <Iframe title={block.label} src={config.mode === 'url' ? config.url : undefined}
    html={config.mode === 'url' ? undefined : config.html}
    data={state.payload} block={block} onMessage={actions.receive}/>;
}`;
export const iframeRecipes: Record<string, JsRecipe> = {
  Iframe: {label:'Iframe',symbol:'▣',category:'JavaScript code blocks',inputs:2,outputs:1,description:'Embed HTML or an HTTP(S) page. Inputs are sent as milver-input messages; milver-output replies become outputs.',value:JSON.stringify({mode:'html',html:iframeEchoHtml,initial:'Hello iframe'}),source,render},
  IframeMetric: {label:'Iframe · live metric',symbol:'▣42',category:'Examples',inputs:2,outputs:1,description:'Input 1 sets the embedded metric; input 2 sets its color. The iframe replies with the value and its double.',value:JSON.stringify({mode:'html',html:iframeMetricHtml,initial:25}),source,render},
  IframeChart: {label:'Iframe · bar chart',symbol:'▣▥',category:'Examples',inputs:2,outputs:1,description:'Input 1 supplies numbers or CSV rows; input 2 sets the chart color. The iframe returns summary statistics.',value:JSON.stringify({mode:'html',html:iframeChartHtml,initial:[2,5,3,8]}),source,render},
};

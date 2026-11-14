import type { JsRecipe } from './js-recipes';
export const demoLibrary = { alias:'demo', source:`export const format = number => new Intl.NumberFormat('en', {maximumFractionDigits:1}).format(number);
export const colorFor = number => number >= 50 ? '#10b981' : '#f59e0b';` };
export const interactiveRecipes: Record<string, JsRecipe> = {
  MetricCard: {label:'Metric card',symbol:'42',category:'Examples',inputs:2,outputs:1,value:'25',description:'Input 1 controls the metric; input 2 controls the color. Double-click to toggle details.',source:`state.result = Number(inputs.input1 ?? value);
emit(state.result);`,render:`function render({ state, inputs, block }) {
  // Hooks keep local UI state; state.result is the saved value computed in run().
  const [details, showDetails] = useState(false);
  const color = inputs.input2 ?? '#0ea5e9';
  return <div onClick={() => showDetails(!details)} style={{padding:18,width:'100%',borderRadius:14,background:color+'18',border:'1px solid '+color+'55'}}>
    <small style={{color}}>{block.label}</small>
    <div style={{fontSize:36,fontWeight:600,color}}>{state.result}</div>
    {details && <small>{block.width} × {block.height} · {block.ports.length} ports</small>}
  </div>;
}`},
  ProgressRing: {label:'Progress ring',symbol:'◉',category:'Examples',inputs:2,outputs:1,value:'100',description:'Input 1 is the current value; input 2 is the maximum. Tune colors and stroke in render().',source:`const maximum = Math.max(1,Number(inputs.input2 ?? value));
state.percent = Math.max(0,Math.min(100,Number(inputs.input1 ?? 25) / maximum * 100));
emit(state.percent);`,render:`function render({ state, block }) {
  // state.percent: 0–100. All geometry and styling are ordinary JSX.
  const color = block.visuals?.foreground ?? '#8b5cf6';
  return <svg viewBox="0 0 120 120" height="100%" role="img" aria-label={Math.round(state.percent)+'%'}>
    <circle cx="60" cy="60" r="46" fill="none" stroke={color+'22'} strokeWidth="10"/>
    <circle cx="60" cy="60" r="46" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" pathLength="100" strokeDasharray={state.percent+' 100'} transform="rotate(-90 60 60)" style={{transition:'stroke-dasharray .3s'}}/>
    <text x="60" y="66" textAnchor="middle" fill={color} fontSize="22">{Math.round(state.percent)}%</text>
  </svg>;
}`},
  ActionButton: {label:'Input-gated button',symbol:'↗',category:'Examples',inputs:2,outputs:1,value:'',description:'Input 1 enables the button; input 2 is its emitted payload. Behavior stays in run(), JSX calls an action.',source:`state.enabled = Boolean(inputs.input1 ?? true);
state.payload = inputs.input2 ?? 'hello';
state.clicks ??= 0;
emit({ clicks:state.clicks, payload:state.payload });
actions.click = () => {
  if (!state.enabled) return;
  state.clicks++;
  emit({ clicks:state.clicks, payload:state.payload });
};`,render:`function render({ state, actions }) {
  // run() defines actions.click; its state updates repaint this component automatically.
  return <Button disabled={!state.enabled} onClick={actions.click} variant="outline">
    {state.enabled ? 'Send value' : 'Disabled by input'} · {state.clicks}
  </Button>;
}`},
  InputAppearance: {label:'Input-driven block',symbol:'Aa',category:'Examples',inputs:3,outputs:1,value:'',description:'Inputs control the block title, background and width. Code-controlled fields lock in Properties.',source:`const title = String(inputs.input1 ?? 'Input-driven block');
const color = String(inputs.input2 ?? '#e0f2fe');
const width = Math.max(160,Math.min(500,Number(inputs.input3 ?? 240)));
setProperty('label',title);
setProperty('visuals.background',color);
setProperty('width',width);
state.result = title;
emit(title);`,render:`function render({ block }) {
  // block is the live inspector model. Code controls its title, background and width.
  return <div style={{padding:16,textAlign:'center'}}>
    <strong style={{fontSize:20}}>{block.label}</strong>
    <p style={{fontSize:11,opacity:.6}}>{block.width}px wide · controlled by inputs</p>
  </div>;
}`},
  Pulse: {label:'Input-driven pulse',symbol:'●',category:'Examples',inputs:2,outputs:1,value:'500',description:'Input 1 enables a timer; input 2 sets its period in milliseconds. Timer state drives the visuals.',source:`state.enabled = Boolean(inputs.input1 ?? true);
state.phase ??= 0;
emit(state.phase);
if (state.enabled) {
  const period = Math.max(80,Number(inputs.input2 ?? value));
  const timer = setInterval(() => { state.phase++; emit(state.phase); },period);
  onCleanup(() => clearInterval(timer));
}`,render:`function render({ state }) {
  // Timer state updates repaint automatically; no manual render() calls are needed.
  const bright = state.enabled && state.phase % 2 === 0;
  return <div style={{width:52,height:52,borderRadius:'50%',background:bright?'#10b981':'#d1d5db',boxShadow:bright?'0 0 28px #10b98188':'none',transform:bright?'scale(1.15)':'scale(.9)',transition:'all .2s'}}/>;
}`},
  Toggle: {label:'Toggle',symbol:'◐',category:'Examples',inputs:0,outputs:1,value:'',description:'Double-click to enable its control. The saved state and output change together.',source:`state.enabled ??= true;
actions.toggle = () => { state.enabled = !state.enabled; emit(state.enabled); };
emit(state.enabled);`,render:`function render({ state, actions }) {
  return <Button variant={state.enabled?'default':'outline'} onClick={actions.toggle}>
    {state.enabled ? 'Enabled' : 'Disabled'}
  </Button>;
}`},
  LibraryBadge: {label:'Library-powered badge',symbol:'JS+',category:'Examples',inputs:1,outputs:1,value:'25',description:'A project library supplies formatting and colors to run() and render().',source:`state.result = Number(inputs.input1 ?? value);
state.formatted = modules.demo.format(state.result);
emit(state.result);`,render:`function render({ state, modules }) {
  // The same imported project library is available in code and in this component.
  const color = modules.demo.colorFor(state.result);
  return <span style={{padding:'12px 18px',borderRadius:999,background:color+'22',color,fontSize:26,fontWeight:600}}>{state.formatted}</span>;
}`},
};

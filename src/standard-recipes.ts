import {numericRender} from './operator-recipes';
import {defaultLogic,defaultRender,completeFunction} from './block-code';
export const standardRecipes: Record<string, { logic: string; render: string }> = {
  ...Object.fromEntries(['number','boolean','string','vector','matrix','tensor'].map(type=>[type[0].toUpperCase()+type.slice(1),{
    logic:['number','vector','matrix','tensor'].includes(type)
      ? `await modules.tensorMath.ready;
const result = modules.tensorMath.parse(value);
const rank = modules.tensorMath.shape(result).length;
${type==='number'?"if (rank !== 0) throw new Error('Enter a number.');":type==='vector'?"if (rank !== 1) throw new Error('Enter a numeric vector.');":type==='matrix'?"if (rank !== 2) throw new Error('Enter a rectangular numeric matrix.');":"if (rank < 1) throw new Error('Enter a nested numeric tensor list.');"}
state.result = result;
emit(result);`
      : `const result = ${type==='string'?'value':'JSON.parse(value)'};
${type==='boolean'?"if (typeof result !== 'boolean') throw new Error('Enter true or false.');":''}
state.result = result;
emit(result);`,
    render:['number','vector','matrix','tensor'].includes(type)?numericRender:`function render({state}) {
  // state.result: the source value validated by run().
  return <span style={{fontSize:18}}>{String(state.result)}</span>;
}`,
  }])),
  DOM: {logic:defaultLogic,render:defaultRender},
  Slider: {
    logic: `state.config = JSON.parse(value);
const config = state.config;
if (!Number.isFinite(config.min) || !Number.isFinite(config.max) || config.max <= config.min || !Number.isFinite(config.step) || config.step <= 0) throw new Error('Slider needs min < max and a positive step.');
state.result = Math.max(config.min, Math.min(config.max, Number(config.initial)));
emit(state.result);
await render();`,
    render: `// state.config: { min, max, step, initial }; state.result: current numeric value.
// Slider is the same shadcn/Radix component used by the editor.
return <div style={{ width: '100%', padding: 12, display: 'grid', gap: 14 }}>
  <Slider aria-label="Source slider" min={state.config.min} max={state.config.max}
    step={state.config.step} value={[state.result]}
    onValueChange={([initial]) => setValue(JSON.stringify({ ...state.config, initial }))}/>
  <output style={{ fontSize: 20, fontVariantNumeric: 'tabular-nums' }}>{state.result}</output>
</div>;`,
  },
  Selector: {
    logic: `state.config = JSON.parse(value);
const config = state.config;
if (!Array.isArray(config.options) || !config.options.length || config.options.some(v => !['string', 'number', 'boolean'].includes(typeof v))) throw new Error('Provide nonempty scalar options.');
state.selected = Math.max(0, Math.min(config.options.length - 1, config.selected ?? 0));
emit(config.options[state.selected]);
await render();`,
    render: `// state.config.options: scalar choices; state.selected: selected zero-based index.
// Customize the shadcn SelectTrigger, SelectItem or surrounding layout.
return <Select value={String(state.selected)} onValueChange={selected => setValue(JSON.stringify({ ...state.config, selected: Number(selected) }))}>
  <SelectTrigger aria-label="Source selector"><SelectValue/></SelectTrigger>
  <SelectContent position="popper">{state.config.options.map((option, index) =>
    <SelectItem key={index} value={String(index)}>{String(option)}</SelectItem>
  )}</SelectContent>
</Select>;`,
  },
  Button: {
    logic: `state.config = JSON.parse(value);
emit(state.config.count ?? 0);
await render();`,
    render: `// state.config: { label, count }. Clicks update the saved Parameter and run Code.
// Try variant="outline" or size="sm" on this shadcn Button.
return <Button onClick={() => setValue(JSON.stringify({ ...state.config, count: (state.config.count ?? 0) + 1 }))}>
  {state.config.label ?? 'Click'} · {state.config.count ?? 0}
</Button>;`,
  },
  Trigger: {
    logic: `const active = Boolean(inputs.input1);
state.count ??= 0;
if (active && !state.previous) state.count++;
state.previous = active;
emit(state.count);
await render();`,
    render: `// state.count: rising edges counted in Code; state.previous: prior input truthiness.
return <strong style={{fontSize:24}}>↑ {state.count}</strong>;`,
  },
  Clock: {
    logic: `const period = Number(value);
if (!Number.isFinite(period) || period < 16 || period > 3600000) throw new Error('Counter period must be 16–3600000 ms.');
state.count ??= 0;
emit(state.count);
await render();
const timer = setInterval(() => {
  state.count++;
  emit(state.count);
  render();
}, period);
onCleanup(() => clearInterval(timer));`,
    render: `// state.count: saved tick count. Number(value) sets the period in milliseconds.
return <strong style={{fontSize:24,fontVariantNumeric:'tabular-nums'}}>{state.count}</strong>;`,
  },
  'Three.js': {
    logic: `state.speed = Number(inputs.input1 ?? value) || 0;
emit(state.speed);
await render();`,
    render: `// state.speed: input-controlled rotation speed. Tune camera, material or geometry.
const host = useRef(null);
useEffect(() => {
  const THREE = modules.THREE;
  if (!THREE) throw new Error('Import THREE in Libraries.');
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.z = 4;
  const view = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshNormalMaterial();
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  host.current.append(view.domElement);
  const resize = new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = host.current;
    view.setSize(w, h); camera.aspect = w / (h || 1); camera.updateProjectionMatrix();
  });
  resize.observe(host.current);
  const clock = new THREE.Clock();
  view.setAnimationLoop(() => {
    cube.rotation.y += clock.getDelta() * state.speed;
    cube.rotation.x = 0.4; view.render(scene, camera);
  });
  return () => { resize.disconnect(); view.setAnimationLoop(null); geometry.dispose(); material.dispose(); view.dispose(); view.domElement.remove(); };
}, [modules.THREE]);
return <div ref={host} style={{width:'100%',height:'100%'}}/>;`,
  },
  LaTeX: {
    logic: `state.result = Number(inputs.input1 ?? value) ** 2;
emit(state.result);
await render();`,
    render: `// state.result: input squared in Code. latex() uses bundled KaTeX / MathML.
// Change the expression here; computations and emitted outputs stay in Code.
return <Latex tex={'f(x) = x^2 = ' + state.result} fontSize={24}/>;`,
  },
  WebAssembly: {
    logic: `if (!wasm) throw new Error('Import a .wasm binary in Code.');
const bytes = Uint8Array.from(atob(wasm.base64), c => c.charCodeAt(0));
const { instance } = await WebAssembly.instantiate(bytes, {});
const args = ports.filter(p => p.type === 'input').map(p => inputs[p.id]);
state.result = args.every(x => typeof x === 'number' && Number.isFinite(x))
  ? instance.exports[wasm.exportName](...args) : null;
if (typeof state.result === 'bigint') state.result = Number(state.result);
emit(state.result);
await render();`,
    render: `// state.result: finite numeric Wasm output, or null while inputs are missing.
return <span style={{fontSize:24}}>{state.result === null ? 'Connect numeric inputs' : String(state.result)}</span>;`,
  },
};

standardRecipes.MatrixActivation={logic:`async function run({inputs,value,state,actions,emit}) {
  // state.matrix: source matrix; alpha/beta: tunable negative/positive slopes.
  state.matrix = inputs.input1 ?? JSON.parse(value);
  state.alpha ??= 0.2;
  state.beta ??= 1;
  function publish() {
    state.result = state.matrix.map(row => row.map(x => x === 0 ? 0 : x * (x < 0 ? state.alpha : state.beta)));
    emit(state.result);
  }
  actions.setSlope = (name, slope) => { state[name] = Number(slope); publish(); };
  publish();
}`,render:`function render({state,actions}) {
  // state.matrix: original matrix; state.result: transformed output.
  // state.alpha and state.beta persist in JSON and update without rebuilding controls.
  return <div style={{width:'100%',padding:14,fontSize:12}}>
    <strong>Input matrix · {state.matrix.length} × {state.matrix[0]?.length}</strong>
    <pre style={{padding:8,borderRadius:8,background:'#eef2ff',color:'#312e81'}}>{state.matrix.map(row=>row.join(' ')).join('\\n')}</pre>
    {[['alpha','Negative slope α',1],['beta','Positive slope β',2]].map(([name,label,max])=>
      <label key={name} style={{display:'block',marginTop:10}}>
        {label} <output style={{float:'right'}}>{state[name].toFixed(2)}</output>
        <input aria-label={label} type="range" min={0} max={max} step={0.01} value={state[name]}
          style={{display:'block',width:'100%',accentColor:'#4f46e5'}}
          onChange={event=>actions.setSlope(name,event.target.valueAsNumber)}/>
      </label>)}
    <small>Standard ReLU at α = 0 and β = 1</small>
  </div>;
}`};
standardRecipes.Counter=standardRecipes.Clock;
for(const recipe of Object.values(standardRecipes)){
  recipe.logic=completeFunction(recipe.logic,'run');
  recipe.render=completeFunction(recipe.render,'render');
}

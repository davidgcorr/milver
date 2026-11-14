export const viewerLogic = `async function run() {
  // state.result: the complete input value; it is shared with render().
  state.result = inputs.input1 ?? inputs['in-0'] ?? null;
  await render();
}`;
export const viewerRender = `function render({ state, renderer }) {
  // state.result is the input value; tune these defaults or use Properties.
  const fontSize = renderer?.fontSize ?? 26;
  const precision = renderer?.precision ?? 4;
  const slice = renderer?.slice ?? 0;
  return <MathValue value={state.result} fontSize={fontSize} precision={precision} slice={slice}/>;
}`;

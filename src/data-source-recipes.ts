import { parseCsv } from './csv';
import type { JsRecipe } from './js-recipes';
export const dataSourceRecipes: Record<string, JsRecipe> = {
  Text: {label:'Text',symbol:'¶',category:'JavaScript sources',inputs:0,outputs:1,value:'hello',source:`// value: multiline text, preserved exactly, including whitespace.
if (value.length > 10000) throw new Error('Text sources support up to 10,000 characters.');
state.text = value;
emit(value);
await render();`,render:`// state.text: source text. Change typography or replace this preview with JSX.
return <pre style={{margin:0,padding:14,font:'14px system-ui',whiteSpace:'pre-wrap',overflowWrap:'anywhere',maxHeight:'100%',overflow:'auto'}}>{state.text}</pre>;`},
  CSV: {label:'CSV',symbol:'CSV',category:'JavaScript sources',inputs:0,outputs:1,value:JSON.stringify({text:'1,2\n3,4',delimiter:',',header:false,numeric:true}),source:`// config.text: raw CSV; header selects records versus rows.
// numeric converts finite numeric cells so row output connects directly to math blocks.
const config = JSON.parse(value);
const parseCsv = ${parseCsv.toString()};
state.result = parseCsv(config.text, config);
state.columns = config.header && state.result.length ? Object.keys(state.result[0]) : [];
emit(state.result);
await render();`,render:`// state.result: an array of rows, or records when header is enabled.
// Tune row count, spacing, and typography below. All values are rendered as text.
const rows = (state.result ?? []).slice(0,8);
return <div style={{padding:10,width:'100%',boxSizing:'border-box',overflow:'auto',maxHeight:'100%'}}><table style={{width:'100%',borderCollapse:'collapse',font:'12px system-ui'}}>
{state.columns.length > 0 && <thead><tr>{state.columns.map(column => <th key={column} style={{padding:5,textAlign:'left'}}>{column}</th>)}</tr></thead>}
<tbody>{rows.map((row,i) => <tr key={i}>{(Array.isArray(row) ? row : Object.values(row)).map((cell,j) => <td key={j} style={{padding:5,borderBottom:'1px solid #a3a3a333'}}>{String(cell)}</td>)}</tr>)}</tbody></table></div>;`},
};

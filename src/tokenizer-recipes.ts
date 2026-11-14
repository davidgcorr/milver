import { numericRender } from './operator-recipes';
import type { JsRecipe } from './js-recipes';
const tokenRender = `// state.tokens: text pieces; state.ids: integer vocabulary IDs.
// state.vocabulary: index = token ID. Tune colors, spacing or font size here.
return <div style={{padding:14, width:'100%', boxSizing:'border-box', fontFamily:'system-ui'}}>
  <div style={{display:'flex',flexWrap:'wrap',gap:6}}>{(state.tokens ?? []).slice(0,40).map((token,i) =>
    <div key={i} style={{border:'1px solid #a3a3a3',borderRadius:6,padding:'6px 9px',textAlign:'center'}}>
      <div style={{fontSize:14}}>{token}</div><small style={{color:'#737373'}}>ID {state.ids[i]}</small>
    </div>)}</div>
  <div style={{fontSize:10,color:'#737373',marginTop:10}}>Vocabulary: {(state.vocabulary ?? []).map((token,id) => id + ': ' + token).join(' · ')}</div>
</div>;`;
const setup = `// An educational tokenizer with an editable vocabulary, not a pretrained model.
const config = JSON.parse(value);
if (!Array.isArray(config.vocabulary) || config.vocabulary[0] !== '<unk>' || !config.vocabulary.every(token => typeof token === 'string' && token.length > 0) || new Set(config.vocabulary).size !== config.vocabulary.length) throw new Error('Vocabulary must contain unique strings, starting with <unk>.');
const raw = inputs.input1 ?? config.text ?? '';
if (typeof raw !== 'string') throw new Error('Connect a text input.');
const text = config.lowercase === false ? raw : raw.toLowerCase();
state.vocabulary = config.vocabulary;
`;
export const tokenizerRecipes: Record<string, JsRecipe> = {
  WordTokenizer: {label:'Word tokenizer',symbol:'a→ID',category:'Examples',inputs:1,outputs:1,value:JSON.stringify({text:'the cat',vocabulary:['<unk>','the','cat'],lowercase:true}),source:setup+`// Split words and punctuation, then look up IDs in the dictionary.
state.tokens = text.match(/[\\p{L}\\p{N}]+|[^\\s\\p{L}\\p{N}]/gu) ?? [];
state.ids = state.tokens.map(token => Math.max(0, config.vocabulary.indexOf(token)));
emit(state.ids);
await render();`,render:tokenRender},
  SubwordTokenizer: {label:'Subword tokenizer',symbol:'a·b',category:'Examples',inputs:1,outputs:1,value:JSON.stringify({text:'dictionary',vocabulary:['<unk>','dict','ion','ary'],lowercase:true}),source:setup+`// Greedy longest-match pieces. This small demo does not train or implement BPE.
const pieces = config.vocabulary.slice(1).filter(piece => piece.trim()).sort((a,b) => b.length - a.length);
const tokens = [], ids = [];
for (let offset = 0; offset < text.length;) {
  if (/\\s/u.test(text[offset])) { offset++; continue; }
  const piece = pieces.find(piece => text.startsWith(piece, offset));
  tokens.push(piece ?? '<unk>');
  ids.push(piece ? config.vocabulary.indexOf(piece) : 0);
  offset += piece?.length ?? 1;
}
state.tokens = tokens;
state.ids = ids;
emit(ids);
await render();`,render:tokenRender},
  Embedding: {label:'Embedding lookup',symbol:'ID→X',category:'Examples',inputs:1,outputs:1,value:JSON.stringify({ids:[1,2],table:[[0,0],[1,0],[0,1]]}),source:`// Each token ID selects one row from the editable embedding table.
const config = JSON.parse(value);
const ids = inputs.input1 ?? config.ids;
const table = config.table;
if (!Array.isArray(table) || !table.length || !table.every(row => Array.isArray(row) && row.length > 0 && row.length === table[0].length && row.every(Number.isFinite))) throw new Error('Enter a rectangular, finite embedding table.');
if (!Array.isArray(ids) || !ids.every(id => Number.isInteger(id) && id >= 0 && id < table.length)) throw new Error('Token IDs must index rows in the embedding table.');
state.result = ids.map(id => [...table[id]]);
emit(state.result);
await render();`,render:numericRender},
};

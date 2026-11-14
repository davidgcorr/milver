// Self-contained so the same parser can run inside an editable source block.
export function parseCsv(text: string, options: { delimiter?: string; header?: boolean; numeric?: boolean } = {}): unknown[] {
  if (typeof text !== 'string' || text.length > 100000) throw new Error('CSV must be text with at most 100,000 characters.');
  const delimiter = options.delimiter ?? ',';
  if (delimiter.length !== 1 || /["\r\n]/.test(delimiter)) throw new Error('Choose a single CSV delimiter.');
  text = text.replace(/^\uFEFF/, '');
  if (!text) return [];
  const rows: string[][] = [];let row: string[] = [], field = '', quoted = false, closed = false;
  const cell = () => { row.push(field); field = ''; closed = false; };
  const line = () => { cell(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else { quoted = false; closed = true; } }
      else field += char;
    } else if (char === delimiter) cell();
    else if (char === '\n' || char === '\r') { line(); if (char === '\r' && text[i + 1] === '\n') i++; }
    else if (char === '"') { if (field || closed) throw new Error('Unexpected quote in CSV.'); quoted = true; }
    else { if (closed) throw new Error('Unexpected text after a quoted CSV field.'); field += char; }
  }
  if (quoted) throw new Error('Unclosed quoted CSV field.');
  if (field || row.length || closed || !/[\r\n]$/.test(text)) line();
  const width = rows[0]?.length ?? 0;
  if (rows.length > 500 || width > 32 || rows.length * width > 10000) throw new Error('CSV preview supports up to 500 rows, 32 columns and 10,000 cells.');
  if (rows.some(row => row.length !== width)) throw new Error('CSV rows must have the same number of columns.');
  const convert = (cell: string): string | number => options.numeric !== false && cell.trim() && /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(cell.trim()) && Number.isFinite(Number(cell)) ? Number(cell) : cell;
  if (!options.header) return rows.map(row => row.map(convert));
  const headers = rows.shift()!.map(header => header.trim());
  if (new Set(headers).size !== width || headers.some(header => !header || header.length > 128 || ['__proto__', 'constructor', 'prototype'].includes(header))) throw new Error('CSV headers must be unique, nonempty, safe names.');
  return rows.map(row => Object.fromEntries(headers.map((header, i) => [header, convert(row[i])])));
}

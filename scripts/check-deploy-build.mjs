import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

const base = process.argv[2] ?? '/';
assert.match(base, /^\/(?:[^?#]*\/)?$/, 'Expected a base path beginning and ending with /');
const output = resolve('dist');
const html = await readFile(resolve(output, 'index.html'), 'utf8');
const resources = [...html.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(match => match[1]);
assert.ok(resources.length >= 3, 'Expected the application script, stylesheet and favicon');
for (const resource of resources) {
  assert.ok(resource.startsWith(base), `Asset ${resource} does not use base ${base}`);
  const file = resolve(output, decodeURIComponent(resource.slice(base.length)));
  assert.ok(file.startsWith(output + sep), `Asset escapes build directory: ${resource}`);
  assert.ok((await stat(file)).isFile(), `Missing asset: ${resource}`);
}
for (const resource of ['project-runtime.js', 'favicon.svg', 'THIRD_PARTY_NOTICES.txt']) {
  assert.ok((await stat(resolve(output, resource))).size > 0, `Missing public runtime asset: ${resource}`);
}
console.log(`Deployment assets verified for ${base}`);

// Build in memory and guard the lazy graphics boundary without new analyzer dependencies.
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { build } from 'vite';

const result = await build({ logLevel: 'warn', build: { write: false } });
const output = (Array.isArray(result) ? result : [result]).flatMap(result => result.output);
const chunks = output.filter(item => item.type === 'chunk');
const byName = new Map(chunks.map(chunk => [chunk.fileName, chunk]));
const initial = new Set();
function visit(name, seen = initial) {
  if (seen.has(name)) return;
  const chunk = byName.get(name);
  assert(chunk, `Missing static chunk: ${name}`);
  seen.add(name);
  chunk.imports.forEach(dependency => visit(dependency, seen));
}
const entries = chunks.filter(chunk => chunk.isEntry);
assert.equal(entries.length, 1, 'Expected one browser entry');
entries.forEach(chunk => visit(chunk.fileName));
assert(chunks.some(chunk => chunk.isDynamicEntry && /CubeScene-/.test(chunk.fileName)), 'Scene must remain a dynamic entry');

const rows = chunks.map(chunk => ({
  file: chunk.fileName,
  bytes: Buffer.byteLength(chunk.code),
  gzip: gzipSync(chunk.code, { level: 9 }).length,
  initial: initial.has(chunk.fileName),
}));
const sum = (items, field) => items.reduce((total, item) => total + item[field], 0);
const first = rows.filter(row => row.initial);
assert(sum(first, 'bytes') <= 350_000, 'Initial JS exceeds 350 kB');
assert(sum(first, 'gzip') <= 110_000, 'Initial JS exceeds 110 kB gzip');
assert(sum(rows, 'gzip') <= 360_000, 'Total browser JS exceeds 360 kB gzip (worker excluded)');
for (const row of rows) assert(row.bytes <= 500_000, `${row.file} exceeds the unchanged 500 kB warning threshold`);

for (const chunk of chunks) {
  if (/\/(react|three-core|three-renderer)-/.test(chunk.fileName)) {
    const dependencies = new Set(); visit(chunk.fileName, dependencies);
    assert(!entries.some(entry => dependencies.has(entry.fileName)), 'Vendor chunk depends on app entry and cannot be cached independently');
  }
  const modules = Object.keys(chunk.modules).map(id => id.replaceAll('\\', '/'));
  if (initial.has(chunk.fileName)) {
    assert(!modules.some(id => /node_modules\/(three|@react-three|react-reconciler)\//.test(id)), 'Graphics leaked into the initial dependency graph');
  }
  assert(!modules.some(id => /\/src\/solver\/(tables|search|workerHandler|solver\.worker)\.ts$/.test(id)), 'Worker search/table code leaked into browser chunks');
}
const workers = output.filter(item => item.type === 'asset' && /solver\.worker-[^/]+\.js$/.test(item.fileName));
assert.equal(workers.length, 1, 'Expected a separately emitted solver worker');
const worker = workers[0];
const workerBytes = typeof worker.source === 'string' ? Buffer.byteLength(worker.source) : worker.source.byteLength;
assert(workerBytes <= 12_000, 'Solver worker exceeds 12 kB');
console.table(rows);
console.log(`Initial JS: ${sum(first, 'bytes')} bytes / ${sum(first, 'gzip')} gzip. Total browser JS: ${sum(rows, 'bytes')} bytes / ${sum(rows, 'gzip')} gzip. Worker: ${workerBytes} bytes.`);
console.log('Lazy graphics boundary, separate worker, and size budgets passed. Gzip figures use level 9; they are not measured network transfer sizes.');

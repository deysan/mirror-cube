#!/usr/bin/env node
// Private offline report, not application photo input. No candidates are automatically accepted as body edges.
import { readFile, writeFile, mkdir, realpath, access } from 'node:fs/promises';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { decodeImage, imageMime } from './decodeImage.mjs';
import { EDGE_SETTINGS, probeEdgeSelection } from './refineEdge.ts';
import { fitSharedCamera, probeCameraSensitivity } from './sharedCamera.ts';

const axes = ['a', 'b', 'c'];
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

/** Camera comparison uses fixed original check edges. Rejected/unstable FIT marks remain explicitly manual. */
export function compareRefinement(view, image) {
  const baseline = fitSharedCamera(view);
  if (image.width !== view.width || image.height !== view.height) throw new Error('Decoded raster dimensions do not match annotations.');
  const results = axes.flatMap(axis => view.groups[axis].map(mark => ({ axis, id: mark.id, role: mark.role, original: mark.segment,
    ...probeEdgeSelection(image, mark.segment) })));
  const groups = Object.fromEntries(axes.map(axis => [axis, view.groups[axis].map(mark => {
    const result = results.find(r => r.axis === axis && r.id === mark.id);
    const replace = mark.role === 'fit' && result.stable && result.nominal.status === 'candidate';
    return { id: mark.id, role: mark.role, segment: replace ? result.nominal.segment : mark.segment,
      source: replace ? 'unreviewed-pixel-candidate' : mark.role === 'check' ? 'fixed-original-check' : 'retained-manual-fit' };
  })]));
  const mixed = { width: view.width, height: view.height, groups };
  const coverage = Object.fromEntries(axes.map(axis => [axis, Object.fromEntries(['fit', 'check'].map(role => [role,
    results.filter(r => r.axis === axis && r.role === role && r.stable).length]))]));
  return { observation: { width: view.width, height: view.height, groups: view.groups }, results, coverage, baseline,
    comparisonObservation: mixed, comparison: fitSharedCamera(mixed),
    comparisonPolicy: 'Diagnostic only: replace stable fit candidates, explicitly retain other manual fit marks, never change original check marks.',
    sensitivity: [0, 2, 5].map(radiusPx => ({ radiusPx,
      baseline: probeCameraSensitivity(view, radiusPx, 256, 42), comparison: probeCameraSensitivity(mixed, radiusPx, 256, 42) })),
    decision: 'inconclusive-requires-boundary-review-no-state-assigned' };
}

export async function runRefinement(inputPath, outputPath, decode = decodeImage) {
  const repository = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
  const output = join(await realpath(dirname(resolve(outputPath))), basename(resolve(outputPath)));
  if (output === repository || output.startsWith(repository + sep)) throw new Error('Private reports must be written outside the repository.');
  try { await access(output); throw new Error('Output directory already exists.'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const inputBytes = await readFile(inputPath), data = JSON.parse(inputBytes.toString('utf8'));
  if (data.mode !== 'shared-camera' || !Array.isArray(data.views) || !data.views.length || data.views.length > 10
    || data.views.some(v => !v || typeof v.id !== 'string' || !v.id.trim() || typeof v.image !== 'string' || !v.image.trim()
      || (v.note !== undefined && typeof v.note !== 'string'))
    || new Set(data.views.map(v => v.id)).size !== data.views.length) throw new Error('Expected 1–10 uniquely named shared-camera views with local images.');
  // Validate all annotations before decoding any image or creating output.
  for (const view of data.views) fitSharedCamera(view);
  const reports = [], definitions = [], panels = [];
  for (const [index, view] of data.views.entries()) {
    const bytes = await readFile(resolve(dirname(resolve(inputPath)), view.image)), mime = imageMime(bytes);
    const image = await decode(bytes, view.width, view.height);
    const report = { id: view.id, note: view.note ?? '', sourceSha256: sha256(bytes), graySha256: sha256(image.data),
      decoder: image.decoder ?? 'injected-test-decoder', ...compareRefinement(view, image) };
    reports.push(report);
    definitions.push(`<image id="source-${index}" href="data:${mime};base64,${bytes.toString('base64')}" width="${view.width}" height="${view.height}"/>`);
    const line = (segment, color, dashed = false) => `<line x1="${segment[0][0]}" y1="${segment[0][1]}" x2="${segment[1][0]}" y2="${segment[1][1]}" stroke="${color}" stroke-width="2"${dashed ? ' stroke-dasharray="5 4"' : ''}/>`;
    const crops = report.results.map(r => {
      const [a, b] = r.original, pad = EDGE_SETTINGS.radiusPx + 10;
      const x = Math.max(0, Math.min(a[0], b[0]) - pad), y = Math.max(0, Math.min(a[1], b[1]) - pad);
      const right = Math.min(view.width, Math.max(a[0], b[0]) + pad), bottom = Math.min(view.height, Math.max(a[1], b[1]) + pad);
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / length, ny = (b[0] - a[0]) / length;
      const border = length > 0 ? [-1, 1].map(sign => line(r.original.map(([px, py]) => [px + sign * nx * EDGE_SETTINGS.radiusPx, py + sign * ny * EDGE_SETTINGS.radiusPx]), '#ffda6a', true)).join('') : '';
      const candidate = r.nominal.status === 'candidate' ? line(r.nominal.segment, r.stable ? '#5dff8a' : '#ff8a55') : '';
      const label = r.nominal.status === 'rejected' ? r.nominal.reason : r.stable ? 'stable numerical candidate — review required' : 'candidate changes with initial region';
      return `<article><h3>${escape(r.axis)} / ${escape(r.id)} / ${escape(r.role)}</h3><p>${escape(label)}</p><svg role="img" aria-label="Private local edge comparison" viewBox="${x} ${y} ${right - x} ${bottom - y}"><use href="#source-${index}"/>${border}${line(r.original, '#ff60ed')}${candidate}</svg></article>`;
    }).join('');
    panels.push(`<section><h2>${escape(view.id)}</h2><p>${escape(view.note ?? '')}</p><p>Stable candidates by axis and original role: ${escape(JSON.stringify(report.coverage))}</p><div class="grid">${crops}</div></section>`);
  }
  const implementationSha256 = Object.fromEntries(await Promise.all(['refine.mjs', 'refineEdge.ts', 'sharedCamera.ts', 'geometry.ts', 'decodeImage.mjs']
    .map(async name => [name, sha256(await readFile(new URL(name, import.meta.url)))])));
  const report = { inputSha256: sha256(inputBytes), implementationSha256, settings: EDGE_SETTINGS,
    assumptions: ['Manual regions and direction groups; no automatic full-image recognition.',
      'Image coordinates start at the upper-left boundary; decoded pixel centers are at (column + 0.5, row + 0.5).',
      'Bilinear sampling of decoded 8-bit luma; no radiometric calibration or lens correction.',
      'Contrast peaks cannot identify body versus sticker, bevel, reflection, shadow, or background.',
      'All candidates require visual/physical review. Numerical stability is not confidence or identity.',
      'Fit/check roles and original held-out check segments are fixed for camera comparison.',
      'Endpoint camera jitter is not end-to-end pixel uncertainty and does not rerun detection.',
      'No shape ranking, exact-state import, or solution is produced.'], reports };
  await mkdir(output);
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await writeFile(join(output, 'overlays.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>Private edge refinement diagnostics</title><style>body{font-family:system-ui;background:#222;color:white;margin:24px}h3{overflow-wrap:anywhere;font-size:15px}p{line-height:1.5}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px}svg{width:100%;max-height:480px}article{border:1px solid #777;padding:12px}</style><h1>Local contrast candidates — not recognized body edges</h1><p>PRIVATE: original image bytes may contain metadata. Magenta: original mark. Yellow dashes: search-strip borders. Green: candidate passing numerical and region-perturbation checks; orange: unstable candidate. Every candidate still requires semantic review. No scripts or external resources.</p><svg width="0" height="0" aria-hidden="true"><defs>${definitions.join('')}</defs></svg>${panels.join('')}</html>`, { flag: 'wx' });
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, ...extra] = process.argv.slice(2);
  if (!input || !output || extra.length) {
    console.error('Usage: node tools/photo-geometry/refine.mjs observations.json NEW_OUTPUT_DIRECTORY'); process.exitCode = 1;
  } else {
    try {
      const report = await runRefinement(input, output);
      for (const view of report.reports) console.log(JSON.stringify({ id: view.id, coverage: view.coverage, decision: view.decision }));
      console.log(`Private refinement report written to ${resolve(output)}`);
    } catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }
  }
}

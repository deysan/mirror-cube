#!/usr/bin/env node
// Offline development tool. Output HTML embeds private images: never publish it without permission.
import { readFile, writeFile, mkdir, realpath } from 'node:fs/promises';
import { dirname, resolve, join, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSolvedCube } from '../../src/puzzle/model.ts';
import { EDGES, reconstructBox, rankShapes, probeSensitivity } from './geometry.ts';
import { fitSharedCamera, probeCameraSensitivity } from './sharedCamera.ts';

const [inputPath, outputPath, ...extra] = process.argv.slice(2);
if (!inputPath || !outputPath || extra.length) {
  console.error('Usage: node tools/photo-geometry/check.mjs observations.json NEW_OUTPUT_DIRECTORY');
  process.exit(1);
}
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
try {
  const repository = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
  const output = join(await realpath(dirname(resolve(outputPath))), basename(resolve(outputPath)));
  if (output === repository || output.startsWith(repository + sep)) throw new Error('Private reports must be written outside the repository.');
  const data = JSON.parse(await readFile(inputPath, 'utf8'));
  if (!Array.isArray(data.views) || !data.views.length || data.views.length > 50
    || data.views.some(view => !view || typeof view.id !== 'string' || !view.id.trim()
      || (view.image !== undefined && typeof view.image !== 'string')
      || (view.note !== undefined && typeof view.note !== 'string'))
    || new Set(data.views.map(view => view.id)).size !== data.views.length) throw new Error('Expected 1–50 uniquely named views.');
  if (data.mode !== undefined && !['single-box', 'shared-camera'].includes(data.mode)) throw new Error('Unknown check mode.');
  const shared = data.mode === 'shared-camera';
  const shapes = createSolvedCube().pieces.map(piece => ({ id: piece.id, dimensions: [piece.dimensions.x, piece.dimensions.y, piece.dimensions.z] }));
  const reports = [], panels = [];
  for (const view of data.views) {
    const nominal = shared ? fitSharedCamera(view) : reconstructBox(view);
    const ranking = !shared && nominal.status === 'estimated' ? rankShapes(nominal.relativeLengths, shapes) : [];
    const sensitivity = [0, 2, 5, 10].map(radius => shared ? probeCameraSensitivity(view, radius, 256, 42) : probeSensitivity(view, shapes, radius, 256, 42));
    const annotations = shared ? ['a', 'b', 'c'].flatMap(axis => view.groups[axis].map(mark => ({ ...mark, axis })))
      : Object.keys(EDGES).map(id => ({ id, segment: view.edges[id], role: 'fit', axis: ['oa', 'bab', 'cac'].includes(id) ? 'a' : ['ob', 'aab', 'cbc'].includes(id) ? 'b' : 'c' }));
    reports.push({ id: view.id, note: view.note ?? '', observation: { width: view.width, height: view.height,
      ...(shared ? { groups: view.groups } : { edges: Object.fromEntries(annotations.map(m => [m.id, m.segment])) }) },
      nominal, ranking, sensitivity, decision: 'inconclusive-no-identity-assigned' });
    let image = '';
    if (view.image !== undefined) {
      const bytes = await readFile(resolve(dirname(resolve(inputPath)), view.image));
      const mime = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? 'image/jpeg'
        : bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'image/png' : null;
      if (!mime) throw new Error('Overlay images must be JPEG or PNG.');
      image = `<image href="data:${mime};base64,${bytes.toString('base64')}" width="${view.width}" height="${view.height}"/>`;
    }
    const points = annotations.flatMap(mark => mark.segment);
    const minX = Math.max(0, Math.min(...points.map(p => p[0])) - 100);
    const minY = Math.max(0, Math.min(...points.map(p => p[1])) - 100);
    const maxX = Math.min(view.width, Math.max(...points.map(p => p[0])) + 100);
    const maxY = Math.min(view.height, Math.max(...points.map(p => p[1])) + 100);
    const marks = annotations.map(({ id, segment: [a, b], axis, role }) => {
      const color = { a: '#00ffff', b: '#ffb52e', c: '#ff65fb' }[axis];
      let prediction = '';
      if (shared && role === 'check' && nominal.status === 'directions-estimated') {
        const v = nominal.directions[axis].vanishing, scale = Math.max(view.width, view.height) / 2;
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        const dx = scale * v[0] + (view.width / 2 - mx) * v[2], dy = scale * v[1] + (view.height / 2 - my) * v[2];
        const length = Math.hypot(dx, dy);
        if (length > 1e-12) {
          const factor = Math.hypot(b[0] - a[0], b[1] - a[1]) / (2 * length);
          prediction = `<line x1="${mx - dx * factor}" y1="${my - dy * factor}" x2="${mx + dx * factor}" y2="${my + dy * factor}" stroke="white" stroke-width="2"/>`;
        }
      }
      return prediction + `<g stroke="${color}" fill="${color}" stroke-width="2"><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"${role === 'check' ? ' stroke-dasharray="10 6"' : ''}/>`
        + [a, b].map(p => `<circle cx="${p[0]}" cy="${p[1]}" r="4"/>`).join('')
        + `<text x="${(a[0] + b[0]) / 2 + 8}" y="${(a[1] + b[1]) / 2 - 8}" stroke="#000" paint-order="stroke" font-size="18">${escape(id)}${role === 'check' ? ' (check)' : ''}</text></g>`;
    }).join('');
    const corners = !shared && nominal.status === 'estimated' ? Object.entries(nominal.corners).map(([key, [x, y]]) =>
      `<circle cx="${x}" cy="${y}" r="5" fill="white" stroke="black"/><text x="${x + 10}" y="${y}" fill="white" stroke="black" stroke-width="2" paint-order="stroke" font-size="20">${key}</text>`).join('') : '';
    panels.push(`<section><h2>${escape(view.id)}</h2><p>${escape(view.note ?? '')}</p><svg role="img" aria-label="Manually annotated body edges" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}">${image}${marks}${corners}</svg></section>`);
  }
  const report = { mode: shared ? 'shared-camera' : 'single-box', assumptions: ['Manual approximate body-edge annotations, not automatic detections or ground truth.',
    'Pinhole camera; square pixels; zero skew; no lens distortion; ideal orthogonal cuboid.',
    'Principal point and focal length are estimated independently per observation; no intrinsics are shared across photographs.',
    ...(shared ? ['Only fit edges determine the vanishing directions and camera. Check edges are held out.',
      'Pixel residuals measure endpoint displacement when rotating a line about its midpoint toward the fitted vanishing point, not 3D accuracy.',
      'Finite calibration is not physical verification. No acceptance threshold, outlier filtering, or piece ranking is applied in shared-camera mode.'] : []),
    'Shapes are ranked by scale-free ratios; no absolute size, slot, world-frame orientation, or puzzle state is inferred.',
    'Endpoint jitter histograms are sensitivity diagnostics, not probabilities or exhaustive uncertainty bounds.',
    'Rankings may all be poor fits. No top-ranked result is automatically accepted.'], ...(shared ? {} : { shapes }), reports };
  // Refuse to overwrite an existing directory, including a repository directory.
  await mkdir(output);
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  await writeFile(join(output, 'overlays.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><title>Private photo geometry annotations</title><style>body{font-family:system-ui;background:#222;color:white;max-width:1050px;margin:24px auto}svg{display:block;width:100%;background:#555}section{margin-bottom:40px}p{line-height:1.5}</style><h1>Manual edge annotations — not recognition results</h1><p>PRIVATE: this file may embed source photographs. Cyan: a direction; amber: b direction; magenta: c direction. White points: intersections extrapolated from marked lines (single-box mode). In shared-camera mode, dashed colored lines are held-out checks; white lines show their predicted directions through their marked midpoints. No external resources or scripts.</p>${panels.join('')}</html>`, { flag: 'wx' });
  for (const r of reports) console.log(JSON.stringify({ id: r.id, nominal: r.nominal, ranking: r.ranking, sensitivity: r.sensitivity }));
  console.log(`Private report and overlays written to ${output}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

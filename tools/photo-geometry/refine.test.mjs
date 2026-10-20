import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compareRefinement, runRefinement } from './refine.mjs';
import { decodeImage, imageMime } from './decodeImage.mjs';

const temporary = [];
const directory = () => { const path = mkdtempSync(join(tmpdir(), 'mirror-refinement-test-')); temporary.push(path); return path; };
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
function fixture() {
  const view = { id: 'synthetic</h2><script>bad</script>', width: 256, height: 256, image: 'source.png', groups:
    Object.fromEntries(['a', 'b', 'c'].map(axis => [axis, [128, 82, 180, 130].map((y, i) => ({
      id: axis + i + '</h3><script>bad</script>', role: i === 3 ? 'check' : 'fit', segment: [[40, y], [216, y]],
    }))])) };
  const image = { width: 256, height: 256, decoder: 'unit-test-stub-not-image-decode', data: Uint8Array.from({ length: 256 * 256 }, (_, i) => Math.round(30 + 180 / (1 + Math.exp(-(Math.floor(i / 256) + 0.5 - 131))))) };
  return { view, image };
}

describe('offline pixel refinement report', () => {
  it('replaces only stable fit candidates; preserves all original checks, manual fallback provenance, and inputs', () => {
    const { view, image } = fixture(), before = structuredClone(view), pixels = image.data.slice();
    const report = compareRefinement(view, image);
    for (const axis of ['a', 'b', 'c']) {
      expect(report.coverage[axis]).toEqual({ fit: 1, check: 1 });
      const marks = report.comparisonObservation.groups[axis];
      expect(marks[0].source).toBe('unreviewed-pixel-candidate');
      expect(marks[0].segment[0][1]).toBeCloseTo(131, 2);
      expect(marks[1]).toMatchObject({ source: 'retained-manual-fit', segment: view.groups[axis][1].segment });
      expect(marks[2]).toMatchObject({ source: 'retained-manual-fit', segment: view.groups[axis][2].segment });
      expect(marks[3]).toMatchObject({ source: 'fixed-original-check', segment: view.groups[axis][3].segment });
    }
    expect(report.decision).toContain('no-state-assigned');
    expect(report.sensitivity).toHaveLength(3);
    expect(view).toEqual(before); expect(image.data).toEqual(pixels);
  });

  it('check-region changes cannot change fitted directions or calibration', () => {
    const { view, image } = fixture(), changed = structuredClone(view);
    changed.groups.a[3].segment = [[40, 180], [216, 180]];
    const a = compareRefinement(view, image), b = compareRefinement(changed, image);
    expect(a.comparison.calibration).toEqual(b.comparison.calibration);
    for (const axis of ['a', 'b', 'c']) expect(a.comparison.directions[axis].vanishing).toEqual(b.comparison.directions[axis].vanishing);
    expect(a.results.find(r => r.role === 'check').nominal.status).toBe('candidate');
    expect(b.results.find(r => r.role === 'check').nominal.status).toBe('rejected');
  });

  it('writes reproducible, escaped private diagnostics using an explicitly stubbed decoder; never overwrites output', async () => {
    const dir = directory(), input = join(dir, 'input.json'), output = join(dir, 'report');
    const { view, image } = fixture();
    writeFileSync(join(dir, 'source.png'), png);
    writeFileSync(input, JSON.stringify({ mode: 'shared-camera', views: [view] }));
    const decode = vi.fn(async () => image); // Report logic only; actual Chrome/JPEG decoding is checked separately.
    const report = await runRefinement(input, output, decode);
    expect(report.reports[0].decoder).toBe('unit-test-stub-not-image-decode');
    expect(report.reports[0].graySha256).toMatch(/^[0-9a-f]{64}$/);
    expect(Object.keys(report.implementationSha256)).toHaveLength(5);
    expect(Object.values(report.implementationSha256).every(hash => /^[0-9a-f]{64}$/.test(hash))).toBe(true);
    const html = readFileSync(join(output, 'overlays.html'), 'utf8');
    expect(html).toContain('data:image/png;base64,'); expect(html).toContain("default-src 'none'");
    expect(html).toContain('&lt;script&gt;'); expect(html).not.toContain('<script>'); expect(html).not.toContain('NaN');
    const contents = readFileSync(join(output, 'report.json'), 'utf8');
    await runRefinement(input, join(dir, 'repeat'), decode);
    expect(readFileSync(join(dir, 'repeat', 'report.json'), 'utf8')).toBe(contents);
    const calls = decode.mock.calls.length;
    await expect(runRefinement(input, output, decode)).rejects.toThrow('already exists');
    expect(decode).toHaveBeenCalledTimes(calls);
    expect(readFileSync(join(output, 'report.json'), 'utf8')).toBe(contents);
  });

  it('rejects malformed input, unsafe output locations, unsupported images and mismatched rasters before publishing output', async () => {
    const dir = directory(), input = join(dir, 'input.json'), output = join(dir, 'report');
    const { view, image } = fixture(), decode = vi.fn(async () => ({ ...image, width: 128 }));
    writeFileSync(input, JSON.stringify({ mode: 'shared-camera', views: [view] }));
    await expect(runRefinement(input, resolve(`refinement-test-${process.pid}`), decode)).rejects.toThrow('outside the repository');
    expect(decode).not.toHaveBeenCalled();
    writeFileSync(join(dir, 'source.png'), 'not an image');
    await expect(runRefinement(input, output, decode)).rejects.toThrow('JPEG or PNG');
    expect(decode).not.toHaveBeenCalled();
    writeFileSync(join(dir, 'source.png'), png);
    await expect(runRefinement(input, output, decode)).rejects.toThrow('dimensions');
    expect(existsSync(output)).toBe(false);
    writeFileSync(input, JSON.stringify({ mode: 'single-box', views: [] }));
    await expect(runRefinement(input, output, decode)).rejects.toThrow('shared-camera');
    expect(existsSync(output)).toBe(false);
  });

  it('validates image type and decoder limits before launching a browser', async () => {
    expect(imageMime(png)).toBe('image/png');
    expect(imageMime(Buffer.from([255, 216, 255]))).toBe('image/jpeg');
    await expect(decodeImage(Buffer.from('bad'), 256, 256)).rejects.toThrow('JPEG or PNG');
    await expect(decodeImage(png, 25_000_001, 2)).rejects.toThrow('limits');
  });

  it('reports a missing local Chromium and cleans up its owned temporary profile', async () => {
    const before = readdirSync(tmpdir()).filter(name => name.startsWith('mirror-photo-decode-')).sort();
    const previous = process.env.CHROME_PATH;
    process.env.CHROME_PATH = join(directory(), 'missing-chromium');
    try { await expect(decodeImage(png, 2, 2)).rejects.toThrow(); }
    finally { if (previous === undefined) delete process.env.CHROME_PATH; else process.env.CHROME_PATH = previous; }
    expect(readdirSync(tmpdir()).filter(name => name.startsWith('mirror-photo-decode-')).sort()).toEqual(before);
  });
});

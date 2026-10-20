import { describe, expect, it } from "vitest";
import { EDGE_SETTINGS, probeEdgeSelection, refineEdge, type GrayImage } from "./refineEdge";
import type { Segment } from "./geometry";

function raster(fn: (x: number, y: number) => number): GrayImage {
  return { width: 256, height: 256, data: Uint8Array.from({ length: 256 * 256 }, (_, i) => Math.max(0, Math.min(255, Math.round(fn(i % 256 + 0.5, Math.floor(i / 256) + 0.5))))) };
}
const step = (distance: number, blur = 1) => 1 / (1 + Math.exp(-distance / blur));
const segment: Segment = [[40, 128], [216, 128]];

describe("local pixel-based edge candidates", () => {
  it.each([0, 25, 45, 90, 135, 180])("recovers a blurred straight transition at %i degrees without camera or piece templates", degrees => {
    const angle = degrees * Math.PI / 180, tx = Math.cos(angle), ty = Math.sin(angle), nx = -ty, ny = tx;
    const input: Segment = [[128 - 80 * tx, 128 - 80 * ty], [128 + 80 * tx, 128 + 80 * ty]];
    const image = raster((x, y) => 30 + 180 * step((x - 128) * nx + (y - 128) * ny - 3, 1.2));
    const result = refineEdge(image, input);
    expect(result.status).toBe("candidate");
    if (result.status !== "candidate") return;
    expect(result.midpointOffsetPx).toBeCloseTo(3, 1);
    expect(result.angleChangeDeg).toBeLessThan(0.1);
    expect(result.rmsPx).toBeLessThan(0.1);
    expect(result.support).toBe(1);
  });

  it("corrects a small angle error and is invariant under contrast and endpoint reversal", () => {
    const image = raster((x, y) => 30 + 180 * step(y - 131 - 0.035 * (x - 128)));
    const forward = refineEdge(image, segment), reversed = refineEdge(image, [segment[1], segment[0]]);
    const inverted = refineEdge({ ...image, data: image.data.map(v => 255 - v) }, segment);
    if (forward.status !== "candidate" || reversed.status !== "candidate" || inverted.status !== "candidate") throw new Error("Expected candidates");
    expect(forward.angleChangeDeg).toBeCloseTo(Math.atan(0.035) * 180 / Math.PI, 1);
    forward.segment.forEach((p, i) => p.forEach((v, j) => {
      expect(v).toBeCloseTo(reversed.segment[1 - i]![j]!, 6);
      expect(v).toBeCloseTo(inverted.segment[i]![j]!, 6);
    }));
  });

  it("rejects flat, weak, and incomplete boundaries instead of inventing observations", () => {
    for (const image of [raster(() => 100), raster((_, y) => 100 + 5 * step(y - 130)),
      raster((x, y) => x < 140 ? 100 : 30 + 180 * step(y - 130))]) {
      expect(refineEdge(image, segment)).toMatchObject({ status: "rejected", reason: "insufficient-support" });
    }
  });

  it("rejects competing parallel transitions even when both are straight", () => {
    const image = raster((_, y) => 30 + 180 * (step(y - 122) - step(y - 134)));
    const result = refineEdge(image, segment);
    expect(result).toMatchObject({ status: "rejected", reason: "multiple-boundaries" });
    expect(result.samples.every(s => s.status === "ambiguous")).toBe(true);
  });

  it("rejects search-window clipping instead of growing the window or clamping a peak", () => {
    expect(refineEdge(raster((_, y) => 30 + 180 * step(y - 144)), segment)).toMatchObject({ status: "rejected", reason: "search-boundary" });
    expect(refineEdge(raster(() => 100), [[10, 10], [180, 10]])).toMatchObject({ status: "rejected", reason: "out-of-image" });
  });

  it("rejects curved and polarity-changing transitions without residual outlier trimming", () => {
    const curved = raster((x, y) => 30 + 180 * step(y - 126 - 9 * Math.sin((x - 40) * Math.PI / 176)));
    expect(refineEdge(curved, segment)).toMatchObject({ status: "rejected", reason: "not-straight" });
    const reversed = raster((x, y) => x < 128 ? 30 + 180 * step(y - 130) : 210 - 180 * step(y - 130));
    expect(refineEdge(reversed, segment)).toMatchObject({ status: "rejected", reason: "polarity-change" });
  });

  it("rejects a straight boundary outside the permitted orientation correction", () => {
    const image = raster((x, y) => 30 + 180 * step(y - 131 - 0.11 * (x - 128)));
    expect(refineEdge(image, segment)).toMatchObject({ status: "rejected", reason: "excessive-angle" });
  });

  it("reports repeatability under deterministic noise and initial-region perturbations without mutating inputs", () => {
    const image = raster((x, y) => 30 + 180 * step(y - 131) + ((x * 17 + y * 13) % 5) - 2);
    const before = image.data.slice(), marks = structuredClone(segment);
    const result = probeEdgeSelection(image, segment);
    expect(result.nominal.status).toBe("candidate");
    expect(result.stable).toBe(true);
    expect(result.variants).toHaveLength(4);
    expect(probeEdgeSelection(image, segment)).toEqual(result);
    expect(image.data).toEqual(before);
    expect(segment).toEqual(marks);
  });

  it("does not equate a repeatable intensity boundary with the intended physical body edge", () => {
    // Weak body-like transition at 0, stronger inset/reflection-like transition at +8.
    const image = raster((_, y) => 20 + 15 * step(y - 128) + 180 * step(y - 136));
    const result = probeEdgeSelection(image, segment);
    expect(result.nominal.status).toBe("candidate");
    if (result.nominal.status !== "candidate") return;
    expect(result.nominal.midpointOffsetPx).toBeGreaterThan(7);
    expect(result.stable).toBe(true); // Therefore a semantic review is required even after all numerical checks.
  });

  it("flags region sensitivity when a candidate is lost in a perturbed strip", () => {
    const result = probeEdgeSelection(raster((_, y) => 30 + 180 * step(y - 141)), segment);
    expect(result.nominal.status).toBe("candidate");
    expect(result.stable).toBe(false);
    expect(result.variants.some(v => v.result.status === "rejected")).toBe(true);
  });

  it("validates typed rasters and coordinates, rejects short segments, and keeps heuristic settings fixed", () => {
    const image = raster(() => 100);
    for (const bad of [{ ...image, width: 0 }, { ...image, height: 2.5 }, { ...image, data: new Uint8Array(10) },
      { ...image, data: [1, 2] }, { ...image, width: 25_000_001, height: 2 }]) {
      expect(() => refineEdge(bad as GrayImage, segment)).toThrow(RangeError);
    }
    expect(() => refineEdge(image, [[NaN, 1], [20, 30]])).toThrow(RangeError);
    expect(refineEdge(image, [[10, 10], [10, 10]])).toMatchObject({ status: "rejected", reason: "short-segment" });
    expect(Object.isFrozen(EDGE_SETTINGS)).toBe(true);
  });
});

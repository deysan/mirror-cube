import { describe, expect, it } from "vitest";
import { findBoundaryCandidates } from "./boundaryCandidates";
import { refineEdge, type GrayImage } from "./refineEdge";
import type { Segment } from "./geometry";
const segment: Segment = [[40, 128], [216, 128]];
const step = (x: number) => 1 / (1 + Math.exp(-x));
const image = (f: (x: number, y: number) => number): GrayImage => ({ width: 256, height: 256,
  data: Uint8Array.from({ length: 65536 }, (_, i) => Math.round(f(i % 256 + 0.5, Math.floor(i / 256) + 0.5))) });

describe("explicit local boundary alternatives", () => {
  it("retains both edges of a strip previously rejected as ambiguous, without choosing one", () => {
    const raster = image((_, y) => 30 + 180 * (step(y - 122) - step(y - 134)));
    expect(refineEdge(raster, segment)).toMatchObject({ status: "rejected", reason: "multiple-boundaries" });
    const result = findBoundaryCandidates(raster, segment);
    expect(result.status).toBe("candidates"); expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every(c => c.stable)).toBe(true);
    expect(result.candidates[0]!.midpointOffsetPx).toBeCloseTo(-6, 1);
    expect(result.candidates[1]!.midpointOffsetPx).toBeCloseTo(6, 1);
    expect(result.candidates[0]!.polarity).toBe(-result.candidates[1]!.polarity);
  });
  it("retains a weaker nearby parallel transition instead of assigning the strongest as the body edge", () => {
    const result = findBoundaryCandidates(image((_, y) => 20 + 55 * step(y - 122) + 160 * step(y - 134)), segment);
    expect(result.candidates).toHaveLength(2);
    expect(result.candidates.every(c => c.stable)).toBe(true);
    expect(result.candidates.map(c => c.id)).toEqual(["candidate-1", "candidate-2"]);
  });
  it("rejects blank, curved, clipped and incomplete regions without invented manual fallback", () => {
    for (const raster of [image(() => 100), image((x, y) => 30 + 180 * step(y - 126 - 9 * Math.sin((x - 40) * Math.PI / 176))),
      image((_, y) => 30 + 180 * step(y - 144)), image((x, y) => x < 160 ? 100 : 30 + 180 * step(y - 130))]) {
      expect(findBoundaryCandidates(raster, segment).candidates).toHaveLength(0);
    }
    expect(findBoundaryCandidates(image(() => 100), [[10, 10], [200, 10]]).regionFailure).toBe("out-of-image");
  });
  it("reports excessive alternatives rather than truncating to a preferred subset", () => {
    const raster = image((_, y) => 128 + 100 * Math.sin((y - 128) * Math.PI / 3));
    expect(findBoundaryCandidates(raster, segment)).toMatchObject({ status: "too-many-candidates", candidates: [] });
  });
  it("preserves inputs and deterministic IDs, and exposes region instability", () => {
    const raster = image((_, y) => 30 + 180 * step(y - 141)), before = raster.data.slice();
    const a = findBoundaryCandidates(raster, segment);
    expect(a.candidates).toHaveLength(1); expect(a.candidates[0]!.stable).toBe(false);
    expect(findBoundaryCandidates(raster, segment)).toEqual(a); expect(raster.data).toEqual(before);
  });
  it("is independent of endpoint and contrast conventions apart from ordering/polarity", () => {
    const raster = image((_, y) => 30 + 180 * (step(y - 122) - step(y - 134)));
    const a = findBoundaryCandidates(raster, segment), b = findBoundaryCandidates(raster, [segment[1], segment[0]]);
    expect(b.candidates).toHaveLength(2);
    a.candidates.forEach((c, i) => c.segment.forEach((p, j) => p.forEach((v, k) => expect(v).toBeCloseTo(b.candidates[1 - i]!.segment[1 - j]![k]!, 5))));
    const inverted = findBoundaryCandidates({ ...raster, data: raster.data.map(v => 255 - v) }, segment);
    a.candidates.forEach((c, i) => expect(inverted.candidates[i]!.polarity).toBe(-c.polarity));
  });
});

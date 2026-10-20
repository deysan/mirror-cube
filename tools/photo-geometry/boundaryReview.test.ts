import { describe, expect, it } from "vitest";
import { createReviewTemplate, evaluateReview, type BoundaryCatalog, type ReviewManifest } from "./boundaryReview";
import { fitSharedCamera } from "./sharedCamera";
import type { Segment } from "./geometry";
const catalog: BoundaryCatalog = { version: 1, catalogId: "a".repeat(64), views: [{ id: "view", width: 256, height: 256,
  edges: (["a", "b", "c"] as const).flatMap(axis => [0, 1, 2, 3, 4].map(i => ({ id: axis + i, axis, role: i < 4 ? "fit" as const : "check" as const,
    original: [[40, 50 + 30 * i], [210, 50 + 30 * i]] as const,
    candidates: [{ id: "candidate-1", segment: [[40, 52 + 30 * i], [210, 52 + 30 * i]] as const, stable: true, polarity: 1, support: 1, rmsPx: 0.2, midpointOffsetPx: 2 },
      { id: "candidate-2", segment: [[40, 54 + 30 * i], [210, 54 + 30 * i]] as const, stable: false, polarity: -1, support: 0.9, rmsPx: 0.3, midpointOffsetPx: 4 }],
  }))) }] };
function completed(): ReviewManifest {
  return { ...createReviewTemplate(catalog), reviewer: { name: "Synthetic analyst", role: "analyst" }, decisions: createReviewTemplate(catalog).decisions.map(d =>
    ({ ...d, action: "use", choice: "candidate-1", kind: "body-edge", purpose: "body-position", note: "Synthetic reference only." })) };
}
function change(patch: Record<string, unknown>) { const m = completed(); return { ...m, decisions: m.decisions.map((d, i) => i === 0 ? { ...d, ...patch } : d) }; }

describe("boundary review contract", () => {
  it("starts with every observation pending, never chooses a default candidate, and exports no partial geometry", () => {
    const template = createReviewTemplate(catalog);
    expect(template.decisions.every(d => d.action === "pending" && d.choice === "" && d.kind === "unknown")).toBe(true);
    const result = evaluateReview(catalog, template);
    expect(result.status).toBe("needs-review"); expect(result.pending).toHaveLength(15); expect(result.views).toEqual([]);
    expect(result.readyForPuzzleState).toBe(false);
  });
  it("copies reviewed observations and immutable roles; body positions are not dimensions or puzzle state", () => {
    const manifest = completed(), before = structuredClone(catalog), copy = structuredClone(manifest);
    const result = evaluateReview(catalog, manifest);
    expect(result.status).toBe("reviewed-observations"); expect(result.readyForPuzzleState).toBe(false);
    expect(result.views[0]!.bodyPositionEdges).toHaveLength(15);
    expect(result.views[0]!.observation!.groups.a.map(e => e.role)).toEqual(["fit", "fit", "fit", "fit", "check"]);
    expect(result.views[0]!.selected[0]!.segment).not.toBe(catalog.views[0]!.edges[0]!.candidates[0]!.segment);
    expect(catalog).toEqual(before); expect(manifest).toEqual(copy);
  });
  it("keeps inset/bevel directions out of body-position observations and requires the parallelism assumption", () => {
    for (const kind of ["inset-border", "bevel"]) {
      expect(() => evaluateReview(catalog, change({ kind, purpose: "body-position", parallelAssumption: true }))).toThrow(/body positions/);
      expect(() => evaluateReview(catalog, change({ kind, purpose: "direction" }))).toThrow(/parallelism/);
      const result = evaluateReview(catalog, change({ kind, purpose: "direction", parallelAssumption: true }));
      expect(result.views[0]!.bodyPositionEdges).not.toContain("a0");
      expect(result.views[0]!.selected[0]!.kind).toBe(kind);
    }
  });
  it("requires explicit manual retention; refuses unavailable or unstable candidates", () => {
    expect(evaluateReview(catalog, change({ choice: "manual" })).views[0]!.selected[0]!.source).toBe("explicit-manual");
    for (const choice of ["", "missing", "candidate-2"]) expect(() => evaluateReview(catalog, change({ choice }))).toThrow(/stable candidate/);
  });
  it("retains exclusion reasons and reports missing coverage rather than silently dropping held-out checks", () => {
    const oneFit = evaluateReview(catalog, change({ action: "exclude", note: "Occluded." }));
    expect(oneFit.status).toBe("reviewed-observations"); expect(oneFit.views[0]!.excluded[0]!.note).toBe("Occluded.");
    const m = completed();
    for (const indices of [[0, 1], [4]]) {
      const result = evaluateReview(catalog, { ...m, decisions: m.decisions.map((d, i) => indices.includes(i) ? { ...d, action: "exclude", note: "Unobservable." } : d) });
      expect(result.status).toBe("needs-observations"); expect(result.views[0]!.observation).toBeNull(); expect(result.views[0]!.missing).toHaveLength(1);
    }
  });
  it("rejects stale, duplicated, missing and unknown decisions", () => {
    const m = completed();
    for (const bad of [{ ...m, catalogId: "b".repeat(64) }, { ...m, version: 2 }, { ...m, decisions: m.decisions.slice(1) },
      { ...m, decisions: [m.decisions[1], ...m.decisions.slice(1)] }, change({ edgeId: "foreign" })]) expect(() => evaluateReview(catalog, bad)).toThrow(RangeError);
    expect(evaluateReview(catalog, { ...m, decisions: [...m.decisions].reverse() })).toEqual(evaluateReview(catalog, m));
  });
  it("never lets a changed check selection improve the direction or camera fit", () => {
    const vps = { a: [-100, -200], b: [400, -150], c: [120, 500] } as const;
    const projected: BoundaryCatalog = { ...catalog, views: catalog.views.map(v => ({ ...v, edges: v.edges.map((e, index) => {
      const i = index % 5, mid = [90 + i * 15, 100 + i * 4], vp = vps[e.axis];
      const dx = vp[0] - mid[0]!, dy = vp[1] - mid[1]!, s = 30 / Math.hypot(dx, dy);
      const original: Segment = [[mid[0]! - dx * s, mid[1]! - dy * s], [mid[0]! + dx * s, mid[1]! + dy * s]];
      const shifted = original.map(p => [p[0], p[1] + 2]) as unknown as Segment;
      return { ...e, original, candidates: [{ ...e.candidates[0]!, segment: shifted }] };
    }) })) };
    const manifest = completed();
    const changed = { ...manifest, decisions: manifest.decisions.map(d => d.edgeId.endsWith("4") ? { ...d, choice: "manual" } : d) };
    const a = fitSharedCamera(evaluateReview(projected, manifest).views[0]!.observation!);
    const b = fitSharedCamera(evaluateReview(projected, changed).views[0]!.observation!);
    if (a.status !== "directions-estimated" || b.status !== "directions-estimated") throw new Error("Expected synthetic directions.");
    expect(a.calibration.status).toBe("estimated"); expect(a.calibration).toEqual(b.calibration);
    for (const axis of ["a", "b", "c"] as const) {
      expect(a.directions[axis].vanishing).toEqual(b.directions[axis].vanishing);
      expect(a.directions[axis].fitRmsPx).toBe(b.directions[axis].fitRmsPx);
    }
    expect(a.directions.a.checkRmsPx).not.toBe(b.directions.a.checkRmsPx);
  });
  it("requires meaningful reviewer/decision declarations and rejects malformed coordinates", () => {
    for (const patch of [{ note: " " }, { kind: "unknown" }, { action: "exclude", note: "" }, { purpose: "millimeters" }, { parallelAssumption: "true" }])
      expect(() => evaluateReview(catalog, change(patch))).toThrow(RangeError);
    expect(() => evaluateReview(catalog, { ...completed(), reviewer: { name: "", role: "owner" } })).toThrow(/named reviewer/);
    expect(() => createReviewTemplate({ ...catalog, catalogId: [catalog.catalogId] as unknown as string })).toThrow(RangeError);
    const bad = structuredClone(catalog);
    (bad.views[0]!.edges[0]!.original[0] as unknown as number[])[0] = NaN;
    expect(() => createReviewTemplate(bad)).toThrow(RangeError);
  });
});

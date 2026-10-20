/** Explicit observation review boundary. No puzzle state, piece identity, or millimeter inference. */
import type { Segment } from "./geometry.ts";
import type { Axis, CameraObservation } from "./sharedCamera.ts";
import type { BoundaryCandidate } from "./boundaryCandidates.ts";
export interface CatalogEdge { readonly id: string; readonly axis: Axis; readonly role: "fit" | "check"; readonly original: Segment; readonly candidates: readonly BoundaryCandidate[] }
export interface CatalogView { readonly id: string; readonly width: number; readonly height: number; readonly edges: readonly CatalogEdge[] }
export interface BoundaryCatalog { readonly version: 1; readonly catalogId: string; readonly views: readonly CatalogView[] }
export type BoundaryKind = "body-edge" | "inset-border" | "bevel" | "unknown";
export interface Decision {
  readonly viewId: string; readonly edgeId: string;
  readonly action: "pending" | "exclude" | "use";
  readonly choice: string; readonly kind: BoundaryKind; readonly purpose: "direction" | "body-position";
  readonly parallelAssumption: boolean; readonly note: string;
}
export interface ReviewManifest {
  readonly version: 1; readonly catalogId: string;
  readonly reviewer: { readonly name: string; readonly role: "owner" | "analyst" };
  readonly decisions: readonly Decision[];
}
const axes: readonly Axis[] = ["a", "b", "c"];
const key = (viewId: string, edgeId: string) => JSON.stringify([viewId, edgeId]);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const name = (v: unknown): v is string => typeof v === "string" && !!v.trim() && v.length <= 200;
function validSegment(s: unknown, width: number, height: number): s is Segment {
  return Array.isArray(s) && s.length === 2 && s.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)
    && p[0] >= 0 && p[0] <= width && p[1] >= 0 && p[1] <= height) && Math.hypot(s[1][0] - s[0][0], s[1][1] - s[0][1]) >= 1e-8;
}
export function validateCatalog(catalog: BoundaryCatalog) {
  if (!object(catalog) || catalog.version !== 1 || typeof catalog.catalogId !== "string" || !/^[a-f0-9]{64}$/.test(catalog.catalogId) || !Array.isArray(catalog.views)
    || catalog.views.length < 1 || catalog.views.length > 10) throw new RangeError("Invalid boundary catalog.");
  const ids = new Set<string>();
  for (const v of catalog.views) {
    if (!object(v) || !name(v.id) || ids.has(v.id) || typeof v.width !== "number" || typeof v.height !== "number" || !Number.isSafeInteger(v.width) || !Number.isSafeInteger(v.height)
      || v.width < 2 || v.height < 2 || v.width * v.height > 25_000_000 || !Array.isArray(v.edges) || !v.edges.length || v.edges.length > 300) throw new RangeError("Invalid catalog view.");
    ids.add(v.id);
    const edgeIds = new Set<string>();
    for (const e of v.edges) {
      if (!object(e) || !name(e.id) || edgeIds.has(e.id) || typeof e.axis !== "string" || !axes.includes(e.axis as Axis) || typeof e.role !== "string" || !["fit", "check"].includes(e.role)
        || !validSegment(e.original, v.width, v.height) || !Array.isArray(e.candidates) || e.candidates.length > 8) throw new RangeError("Invalid catalog edge.");
      edgeIds.add(e.id);
      const candidates = new Set<string>();
      for (const c of e.candidates) {
        if (!object(c) || !name(c.id) || c.id === "manual" || candidates.has(c.id) || typeof c.stable !== "boolean"
          || !validSegment(c.segment, v.width, v.height)) throw new RangeError("Invalid catalog candidate.");
        candidates.add(c.id);
      }
    }
  }
}
export function createReviewTemplate(catalog: BoundaryCatalog): ReviewManifest {
  validateCatalog(catalog);
  return { version: 1, catalogId: catalog.catalogId, reviewer: { name: "", role: "owner" },
    decisions: catalog.views.flatMap(v => v.edges.map(e => ({ viewId: v.id, edgeId: e.id, action: "pending", choice: "", kind: "unknown", purpose: "direction", parallelAssumption: false, note: "" }))) };
}

export function evaluateReview(catalog: BoundaryCatalog, input: unknown) {
  validateCatalog(catalog);
  if (!object(input) || input.version !== 1 || input.catalogId !== catalog.catalogId || !object(input.reviewer)
    || typeof input.reviewer.name !== "string" || input.reviewer.name.length > 200 || !["owner", "analyst"].includes(input.reviewer.role as string)
    || !Array.isArray(input.decisions)) throw new RangeError("Invalid or stale review manifest.");
  const expected = new Map(catalog.views.flatMap(v => v.edges.map(e => [key(v.id, e.id), e] as const)));
  if (input.decisions.length !== expected.size) throw new RangeError("Review must account for every original edge.");
  const decisions = new Map<string, Decision>();
  for (const d of input.decisions) {
    if (!object(d) || !name(d.viewId) || !name(d.edgeId) || !["pending", "exclude", "use"].includes(d.action as string)
      || typeof d.choice !== "string" || !["body-edge", "inset-border", "bevel", "unknown"].includes(d.kind as string)
      || !["direction", "body-position"].includes(d.purpose as string) || typeof d.parallelAssumption !== "boolean"
      || typeof d.note !== "string" || d.note.length > 1000) throw new RangeError("Malformed review decision.");
    const id = key(d.viewId, d.edgeId), edge = expected.get(id);
    if (!edge || decisions.has(id)) throw new RangeError("Unknown or duplicate reviewed edge.");
    if (d.action !== "pending" && !d.note.trim()) throw new RangeError("Every use or exclusion requires a review note.");
    if (d.action === "use") {
      if (d.kind === "unknown") throw new RangeError("An unknown boundary cannot be used.");
      if (d.purpose === "body-position" && d.kind !== "body-edge") throw new RangeError("Inset borders and bevels cannot supply body positions.");
      if (d.kind !== "body-edge" && !d.parallelAssumption) throw new RangeError("Direction-only inset/bevel use requires an explicit parallelism assumption.");
      if (d.choice !== "manual" && !edge.candidates.some(c => c.id === d.choice && c.stable)) throw new RangeError("Choose an existing stable candidate or explicitly retain the manual observation.");
    }
    decisions.set(id, d as unknown as Decision);
  }
  const pending = [...decisions.values()].filter(d => d.action === "pending").map(d => ({ viewId: d.viewId, edgeId: d.edgeId }));
  if (pending.length) return { status: "needs-review" as const, pending, views: [], readyForPuzzleState: false as const };
  if (!input.reviewer.name.trim()) throw new RangeError("Completed review requires a named reviewer.");
  const views = catalog.views.map(v => {
    const selected = v.edges.flatMap(e => {
      const d = decisions.get(key(v.id, e.id))!;
      if (d.action !== "use") return [];
      const segment = d.choice === "manual" ? e.original : e.candidates.find(c => c.id === d.choice)!.segment;
      return [{ id: e.id, axis: e.axis, role: e.role, segment: segment.map(p => [...p]) as unknown as Segment,
        kind: d.kind, purpose: d.purpose, source: d.choice === "manual" ? "explicit-manual" : "reviewed-pixel-candidate",
        parallelAssumption: d.parallelAssumption, note: d.note }];
    });
    const missing = axes.flatMap(axis => {
      const fit = selected.filter(e => e.axis === axis && e.role === "fit").length;
      const checks = selected.filter(e => e.axis === axis && e.role === "check").length;
      const originalChecks = v.edges.filter(e => e.axis === axis && e.role === "check").length;
      return fit < 3 || checks < 1 || checks !== originalChecks ? [{ axis, fit, checks, originalChecks }] : [];
    });
    const excluded = v.edges.filter(e => decisions.get(key(v.id, e.id))!.action === "exclude").map(e => ({ id: e.id, axis: e.axis, role: e.role, note: decisions.get(key(v.id, e.id))!.note }));
    const observation: CameraObservation | null = missing.length ? null : { width: v.width, height: v.height,
      groups: Object.fromEntries(axes.map(axis => [axis, selected.filter(e => e.axis === axis)])) as unknown as CameraObservation["groups"] };
    return { id: v.id, selected, excluded, missing, observation,
      bodyPositionEdges: selected.filter(e => e.kind === "body-edge" && e.purpose === "body-position").map(e => e.id) };
  });
  return { status: views.some(v => v.missing.length) ? "needs-observations" as const : "reviewed-observations" as const,
    pending, views, reviewer: { name: input.reviewer.name, role: input.reviewer.role }, readyForPuzzleState: false as const };
}

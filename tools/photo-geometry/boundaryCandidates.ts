/** Multiple local contrast lines for explicit review, never automatic semantic assignment. */
import { EDGE_SETTINGS, refineEdge, type GrayImage, type Peak } from "./refineEdge.ts";
import type { Point, Segment } from "./geometry.ts";
export interface BoundaryCandidate {
  readonly id: string;
  readonly segment: Segment;
  readonly polarity: number;
  readonly support: number;
  readonly rmsPx: number;
  readonly midpointOffsetPx: number;
  readonly stable: boolean;
}
export interface BoundaryAlternatives {
  readonly status: "candidates" | "no-candidates" | "too-many-candidates";
  readonly candidates: readonly BoundaryCandidate[];
  readonly regionFailure: string | null;
}
const tolerance = 1.5;

function distance(a: Segment, b: Segment) {
  const dx = a[1][0] - a[0][0], dy = a[1][1] - a[0][1], length = Math.hypot(dx, dy);
  return Math.max(...b.map(([x, y]) => Math.abs(dx * (y - a[0][1]) - dy * (x - a[0][0])) / length));
}
function angle(a: Segment, b: Segment) {
  const x = a[1][0] - a[0][0], y = a[1][1] - a[0][1], u = b[1][0] - b[0][0], v = b[1][1] - b[0][1];
  return Math.atan2(Math.abs(x * v - y * u), Math.abs(x * u + y * v)) * 180 / Math.PI;
}
function findLines(image: GrayImage, segment: Segment): BoundaryAlternatives {
  const scan = refineEdge(image, segment); // Reuses validated sampling; does not use its strongest-peak decision.
  if (!scan.samples.length) return { status: "no-candidates", candidates: [], regionFailure: scan.status === "rejected" ? scan.reason : null };
  const [a, b] = segment, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const tx = (b[0] - a[0]) / length, ty = (b[1] - a[1]) / length;
  const at = (s: number, n: number): Point => [a[0] + tx * s - ty * n, a[1] + ty * s + tx * n];
  const stations = scan.samples.map(s => {
    const peaks: Peak[] = [];
    for (const p of [...s.peaks].sort((x, y) => Math.abs(y.gradient) - Math.abs(x.gradient))) {
      if (!p.clipped && !peaks.some(q => Math.abs(q.offset - p.offset) < 2 && Math.sign(q.gradient) === Math.sign(p.gradient))) peaks.push(p);
    }
    return { along: s.along, peaks };
  });
  const anchors = [4, 12, 20, 28, 36, 44, 52, 60].map(i => stations[i]!);
  const found: BoundaryCandidate[] = [];
  for (const first of anchors) for (const last of anchors) {
    if (last.along - first.along < length * 0.4) continue;
    for (const p of first.peaks) for (const q of last.peaks) {
      const polarity = Math.sign(p.gradient);
      if (Math.sign(q.gradient) !== polarity) continue;
      let slope = (q.offset - p.offset) / (last.along - first.along), intercept = p.offset - slope * first.along;
      if (Math.abs(Math.atan(slope)) * 180 / Math.PI > EDGE_SETTINGS.maximumAngleDeg) continue;
      let points: { x: number; y: number }[] = [];
      for (let pass = 0; pass < 3; pass++) {
        points = stations.flatMap(s => {
          const eligible = s.peaks.filter(peak => Math.sign(peak.gradient) === polarity && Math.abs(peak.offset - intercept - slope * s.along) <= tolerance);
          // Do not resolve competing peaks at one station by strength or camera score.
          return eligible.length === 1 ? [{ x: s.along, y: eligible[0]!.offset }] : [];
        });
        if (points.length / stations.length < EDGE_SETTINGS.minimumSupport) break;
        const mx = points.reduce((sum, v) => sum + v.x, 0) / points.length, my = points.reduce((sum, v) => sum + v.y, 0) / points.length;
        slope = points.reduce((sum, v) => sum + (v.x - mx) * (v.y - my), 0) / points.reduce((sum, v) => sum + (v.x - mx) ** 2, 0);
        intercept = my - slope * mx;
      }
      if (points.length / stations.length < EDGE_SETTINGS.minimumSupport || Math.abs(Math.atan(slope)) * 180 / Math.PI > EDGE_SETTINGS.maximumAngleDeg
        || Math.max(Math.abs(intercept), Math.abs(intercept + slope * length)) > EDGE_SETTINGS.radiusPx - 2) continue;
      const errors = points.map(v => Math.abs(v.y - intercept - slope * v.x) / Math.hypot(1, slope));
      const rmsPx = Math.sqrt(errors.reduce((sum, e) => sum + e * e, 0) / errors.length);
      if (rmsPx > EDGE_SETTINGS.maximumRmsPx || Math.max(...errors) > EDGE_SETTINGS.maximumResidualPx) continue;
      const line: Segment = [at(0, intercept), at(length, intercept + length * slope)];
      const candidate: BoundaryCandidate = { id: "", segment: line, polarity, support: points.length / stations.length, rmsPx,
        midpointOffsetPx: intercept + length * slope / 2, stable: false };
      const duplicate = found.findIndex(c => c.polarity === polarity && Math.max(distance(c.segment, line), distance(line, c.segment)) < 2);
      if (duplicate === -1) found.push(candidate);
      else if (candidate.support > found[duplicate]!.support || (candidate.support === found[duplicate]!.support && rmsPx < found[duplicate]!.rmsPx)) found[duplicate] = candidate;
    }
  }
  if (found.length > 8) return { status: "too-many-candidates", candidates: [], regionFailure: "Too many local alternatives; narrow or correct the region." };
  found.sort((p, q) => p.midpointOffsetPx - q.midpointOffsetPx || p.polarity - q.polarity);
  return { status: found.length ? "candidates" : "no-candidates", candidates: found.map((c, i) => ({ ...c, id: `candidate-${i + 1}` })), regionFailure: null };
}

export function findBoundaryCandidates(image: GrayImage, segment: Segment): BoundaryAlternatives {
  const nominal = findLines(image, segment);
  if (!nominal.candidates.length) return nominal;
  const [a, b] = segment, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / length, ny = (b[0] - a[0]) / length;
  const variants = [[-2, 0], [2, 0], [0, -0.5], [0, 0.5]].map(([offset, degrees]) => {
    const theta = degrees! * Math.PI / 180, c = Math.cos(theta), s = Math.sin(theta);
    const changed = segment.map(([x, y]) => [mx + (x - mx) * c - (y - my) * s + nx * offset!,
      my + (x - mx) * s + (y - my) * c + ny * offset!]) as unknown as Segment;
    return findLines(image, changed);
  });
  return { ...nominal, candidates: nominal.candidates.map(candidate => ({ ...candidate, stable: variants.every(v =>
    v.candidates.filter(c => c.polarity === candidate.polarity && Math.max(distance(candidate.segment, c.segment), distance(c.segment, candidate.segment)) <= 1.5
      && angle(candidate.segment, c.segment) <= 0.5).length === 1) })) };
}

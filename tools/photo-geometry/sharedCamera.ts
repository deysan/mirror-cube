/** Offline per-image vanishing-direction check. No automatic detection or identity assignment. */
import { leastSquares, type Point, type Segment } from "./geometry.ts";
export type Axis = "a" | "b" | "c";
export interface Mark {
  readonly id: string;
  readonly segment: Segment;
  readonly role: "fit" | "check";
}
export interface CameraObservation {
  readonly width: number;
  readonly height: number;
  readonly groups: Readonly<Record<Axis, readonly Mark[]>>;
}
type Vector = readonly [number, number, number];
const axes: readonly Axis[] = ["a", "b", "c"];
const dot = (a: readonly number[], b: readonly number[]) => a.reduce((s, v, i) => s + v * b[i]!, 0);
const cross = (a: Vector, b: Vector): Vector => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Jacobi eigensolver for a symmetric 3x3 scatter matrix; finite and infinite vanishing points share one representation. */
function smallestDirection(rows: readonly Vector[]): { vector: Vector; separation: number } | null {
  const m = [0, 1, 2].map(i => [0, 1, 2].map(j => rows.reduce((s, r) => s + r[i]! * r[j]!, 0)));
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const scale = m[0]![0]! + m[1]![1]! + m[2]![2]!;
  if (scale < 1e-20) return null;
  for (let iteration = 0; iteration < 64; iteration++) {
    let p = 0, q = 1;
    for (const [i, j] of [[0, 2], [1, 2]] as const) if (Math.abs(m[i]![j]!) > Math.abs(m[p]![q]!)) { p = i; q = j; }
    if (Math.abs(m[p]![q]!) <= 1e-15 * scale) break;
    const angle = 0.5 * Math.atan2(2 * m[p]![q]!, m[q]![q]! - m[p]![p]!);
    const c = Math.cos(angle), s = Math.sin(angle);
    const pp = m[p]![p]!, qq = m[q]![q]!, pq = m[p]![q]!;
    m[p]![p] = c * c * pp - 2 * c * s * pq + s * s * qq;
    m[q]![q] = s * s * pp + 2 * c * s * pq + c * c * qq;
    m[p]![q] = m[q]![p] = 0;
    for (let k = 0; k < 3; k++) {
      if (k !== p && k !== q) {
        const kp = m[k]![p]!, kq = m[k]![q]!;
        m[k]![p] = m[p]![k] = c * kp - s * kq;
        m[k]![q] = m[q]![k] = s * kp + c * kq;
      }
      const vp = v[k]![p]!, vq = v[k]![q]!;
      v[k]![p] = c * vp - s * vq;
      v[k]![q] = s * vp + c * vq;
    }
  }
  const order = [0, 1, 2].sort((i, j) => m[i]![i]! - m[j]![j]!);
  const separation = (m[order[1]!]![order[1]!]! - m[order[0]!]![order[0]!]!) / scale;
  if (!Number.isFinite(separation) || separation < 1e-10) return null;
  const vector = v.map(row => row[order[0]!]!) as [number, number, number];
  const largest = [0, 1, 2].sort((i, j) => Math.abs(vector[j]!) - Math.abs(vector[i]!))[0]!;
  if (vector[largest]! < 0) for (let i = 0; i < 3; i++) vector[i] = -vector[i]!;
  return { vector, separation };
}

function validate(input: CameraObservation) {
  if (!input || !Number.isSafeInteger(input.width) || input.width <= 0 || !Number.isSafeInteger(input.height)
    || input.height <= 0 || !input.groups) throw new RangeError("Invalid camera observation.");
  const ids = new Set<string>();
  for (const axis of axes) {
    const marks = input.groups[axis];
    if (!Array.isArray(marks) || marks.length > 100 || marks.filter(m => m?.role === "fit").length < 3
      || !marks.some(m => m?.role === "check")) throw new RangeError("Each direction needs at least three fit edges and one held-out edge.");
    for (const mark of marks) {
      if (!mark || typeof mark.id !== "string" || !mark.id.trim() || ids.has(mark.id)
        || !["fit", "check"].includes(mark.role) || !Array.isArray(mark.segment) || mark.segment.length !== 2
        || mark.segment.some((p: unknown) => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite)
          || p[0] < 0 || p[0] > input.width || p[1] < 0 || p[1] > input.height)) throw new RangeError("Invalid or duplicate camera edge.");
      ids.add(mark.id);
    }
  }
}
export interface Residual {
  readonly id: string;
  readonly role: Mark["role"];
  /** Rotate an edge about its midpoint toward the fitted vanishing point; report endpoint displacement. */
  readonly endpointRmsPx: number | null;
  readonly angleDeg: number | null;
}
export interface DirectionEstimate {
  /** Homogeneous coordinates in centered, image-size-normalized coordinates. */
  readonly vanishing: Vector;
  readonly eigenSeparation: number;
  readonly residuals: readonly Residual[];
  readonly fitRmsPx: number | null;
  readonly checkRmsPx: number | null;
}
export type CameraFit = { readonly status: "rejected"; readonly reason: "degenerate-directions" } | {
  readonly status: "directions-estimated";
  readonly directions: Readonly<Record<Axis, DirectionEstimate>>;
  readonly calibration: { readonly status: "estimated"; readonly focalPx: number; readonly principalPoint: Point }
    | { readonly status: "rejected"; readonly reason: "uncalibratable" | "nonphysical-camera" };
};

export function fitSharedCamera(input: CameraObservation): CameraFit {
  validate(input);
  const scale = Math.max(input.width, input.height) / 2;
  const normalize = ([x, y]: Point): Vector => [(x - input.width / 2) / scale, (y - input.height / 2) / scale, 1];
  const directions = {} as Record<Axis, DirectionEstimate>;
  for (const axis of axes) {
    const marks = input.groups[axis];
    // Unnormalized cross products weight longer segments more. No outlier removal or held-out fitting.
    const rows = marks.filter(m => m.role === "fit").map(m => cross(normalize(m.segment[0]), normalize(m.segment[1])));
    if (marks.some(m => Math.hypot(m.segment[1][0] - m.segment[0][0], m.segment[1][1] - m.segment[0][1]) < 1e-8)) {
      return { status: "rejected", reason: "degenerate-directions" };
    }
    const estimate = smallestDirection(rows);
    if (!estimate) return { status: "rejected", reason: "degenerate-directions" };
    const residuals = marks.map(mark => {
      const [a, b] = mark.segment.map(normalize) as [Vector, Vector];
      const mid: Vector = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 1];
      const line = cross(mid, estimate.vector), norm = Math.hypot(line[0], line[1]);
      if (norm < 1e-12) return { id: mark.id, role: mark.role, endpointRmsPx: null, angleDeg: null };
      const error = Math.abs(dot(line, a)) / norm;
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      return { id: mark.id, role: mark.role, endpointRmsPx: error * scale,
        angleDeg: Math.asin(Math.min(1, 2 * error / length)) * 180 / Math.PI };
    });
    const rms = (role: Mark["role"]) => {
      const values = residuals.filter(r => r.role === role).map(r => r.endpointRmsPx);
      return values.some(v => v === null) ? null : Math.sqrt(values.reduce<number>((s, v) => s + v! ** 2, 0) / values.length);
    };
    directions[axis] = { vanishing: estimate.vector, eigenSeparation: estimate.separation, residuals, fitRmsPx: rms("fit"), checkRmsPx: rms("check") };
  }
  const metricRows: number[][] = [], rhs: number[] = [];
  for (const [i, j] of [["a", "b"], ["a", "c"], ["b", "c"]] as const) {
    const a = directions[i].vanishing, b = directions[j].vanishing;
    metricRows.push([a[0] * b[2] + b[0] * a[2], a[1] * b[2] + b[1] * a[2], -a[2] * b[2]]);
    rhs.push(a[0] * b[0] + a[1] * b[1]);
  }
  const metric = leastSquares(metricRows, rhs);
  if (!metric) return { status: "directions-estimated", directions, calibration: { status: "rejected", reason: "uncalibratable" } };
  const [cx, cy, w] = metric as [number, number, number], f2 = w - cx * cx - cy * cy;
  return { status: "directions-estimated", directions, calibration: !Number.isFinite(f2) || f2 <= 1e-10
    ? { status: "rejected", reason: "nonphysical-camera" }
    : { status: "estimated", focalPx: Math.sqrt(f2) * scale, principalPoint: [cx * scale + input.width / 2, cy * scale + input.height / 2] } };
}

/** Independent endpoint jitter, not a statistical uncertainty model or confidence interval. */
export function probeCameraSensitivity(input: CameraObservation, radiusPx: number, samples = 256, seed = 42) {
  validate(input);
  if (!Number.isFinite(radiusPx) || radiusPx < 0 || !Number.isInteger(samples) || samples < 1 || samples > 10_000
    || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("Invalid sensitivity options.");
  const rejected: Record<string, number> = {};
  const range = () => [Infinity, -Infinity];
  const focal = range(), cx = range(), cy = range(), checkRms = range();
  let estimated = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
  const extend = (r: number[], value: number) => { r[0] = Math.min(r[0]!, value); r[1] = Math.max(r[1]!, value); };
  const reject = (reason: string) => { rejected[reason] = (rejected[reason] ?? 0) + 1; };
  for (let i = 0; i < samples; i++) {
    const groups = Object.fromEntries(axes.map(axis => [axis, input.groups[axis].map(m => ({ ...m,
      segment: m.segment.map(p => p.map(v => v + (random() * 2 - 1) * radiusPx)),
    }))])) as unknown as CameraObservation["groups"];
    if (Object.values(groups).flat().some(m => m.segment.some(([x, y]) => x < 0 || x > input.width || y < 0 || y > input.height))) {
      reject("out-of-image"); continue;
    }
    const result = fitSharedCamera({ ...input, groups });
    if (result.status === "rejected") { reject(result.reason); continue; }
    if (result.calibration.status === "rejected") { reject(result.calibration.reason); continue; }
    const checks = axes.map(axis => result.directions[axis].checkRmsPx);
    if (checks.some(v => v === null)) { reject("undefined-check-residual"); continue; }
    estimated++;
    extend(focal, result.calibration.focalPx); extend(cx, result.calibration.principalPoint[0]); extend(cy, result.calibration.principalPoint[1]);
    extend(checkRms, Math.sqrt(checks.reduce<number>((s, v) => s + v! ** 2, 0) / 3));
  }
  return { radiusPx, samples, estimated, rejected, observedRanges: estimated ? { focalPx: focal, principalX: cx, principalY: cy, axisBalancedCheckRmsPx: checkRms } : null };
}

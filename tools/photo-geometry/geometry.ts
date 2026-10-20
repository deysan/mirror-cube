/** Offline feasibility math only. No image detection, puzzle-state inference, or UI imports. */
export type Point = readonly [number, number];
export type Segment = readonly [Point, Point];
export const VERTICES = {
  o: [0, 0, 0], a: [1, 0, 0], b: [0, 1, 0], c: [0, 0, 1],
  ab: [1, 1, 0], ac: [1, 0, 1], bc: [0, 1, 1],
} as const;
export type Vertex = keyof typeof VERTICES;
export const EDGES = {
  oa: ["o", "a"], ob: ["o", "b"], oc: ["o", "c"],
  aab: ["a", "ab"], bab: ["b", "ab"], aac: ["a", "ac"],
  bbc: ["b", "bc"], cac: ["c", "ac"], cbc: ["c", "bc"],
} as const satisfies Record<string, readonly [Vertex, Vertex]>;
export type Edge = keyof typeof EDGES;
export interface Observation {
  readonly width: number;
  readonly height: number;
  /** Two points on each visible straight BODY edge, avoiding rounded ends and stickers. */
  readonly edges: Readonly<Record<Edge, Segment>>;
}
export interface Shape {
  readonly id: string;
  readonly dimensions: readonly [number, number, number];
}
export interface Ranking {
  readonly id: string;
  /** Dimension indices corresponding to observed a, b, c. Not a world-frame orientation. */
  readonly permutation: readonly number[];
  readonly relativeError: number;
}
export type FailureReason = "degenerate-edges" | "degenerate-projection" | "uncalibratable" | "nonphysical-camera";
export type Reconstruction = { readonly status: "rejected"; readonly reason: FailureReason } | {
  readonly status: "estimated";
  readonly corners: Readonly<Record<Vertex, Point>>;
  readonly edgeIntersectionRmsPx: number;
  readonly reprojectionRmsPx: number;
  readonly camera: { readonly focalPx: number; readonly principalPoint: Point };
  /** Arbitrary common scale; these are NOT millimeters. */
  readonly relativeLengths: readonly [number, number, number];
};
const keys = Object.keys(VERTICES) as Vertex[];
const edgeKeys = Object.keys(EDGES) as Edge[];
const EPS = 1e-10;

/** Householder QR, avoiding the squared conditioning of normal equations. */
export function leastSquares(rows: readonly (readonly number[])[], rhs: readonly number[]): number[] | null {
  const n = rows[0]?.length ?? 0, m = rows.length;
  if (!n || m < n) return null;
  const matrix = rows.map((row, i) => [...row, rhs[i]!]);
  const scale = Math.max(...rows.flatMap(row => row.map(Math.abs)));
  for (let k = 0; k < n; k++) {
    const vector = matrix.slice(k).map(row => row[k]!);
    const norm = Math.hypot(...vector);
    if (!Number.isFinite(norm) || norm <= EPS * Math.max(1, scale)) return null;
    vector[0] = vector[0]! + (vector[0]! >= 0 ? norm : -norm);
    const vnorm = Math.hypot(...vector);
    for (let i = 0; i < vector.length; i++) vector[i] = vector[i]! / vnorm;
    for (let j = k; j <= n; j++) {
      let dot = 0;
      for (let i = k; i < m; i++) dot += vector[i - k]! * matrix[i]![j]!;
      for (let i = k; i < m; i++) matrix[i]![j] = matrix[i]![j]! - 2 * vector[i - k]! * dot;
    }
  }
  const result = Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let value = matrix[i]![n]!;
    for (let j = i + 1; j < n; j++) value -= matrix[i]![j]! * result[j]!;
    result[i] = value / matrix[i]![i]!;
  }
  return result.every(Number.isFinite) ? result : null;
}

function validate(input: Observation) {
  if (!input || !Number.isSafeInteger(input.width) || input.width <= 0
    || !Number.isSafeInteger(input.height) || input.height <= 0 || !input.edges) {
    throw new RangeError("Invalid observation dimensions or edges.");
  }
  for (const key of edgeKeys) {
    const edge = input.edges[key];
    if (!Array.isArray(edge) || edge.length !== 2 || edge.some(point => !Array.isArray(point)
      || point.length !== 2 || !point.every(Number.isFinite)
      || point[0] < 0 || point[0] > input.width || point[1] < 0 || point[1] > input.height)) {
      throw new RangeError(`Invalid image coordinates for edge ${key}.`);
    }
  }
}

export function reconstructBox(input: Observation): Reconstruction {
  validate(input);
  const scale = Math.max(input.width, input.height) / 2;
  const normalize = ([x, y]: Point): Point => [(x - input.width / 2) / scale, (y - input.height / 2) / scale];
  const pixel = ([x, y]: Point): Point => [x * scale + input.width / 2, y * scale + input.height / 2];
  const lines = {} as Record<Edge, readonly [number, number, number]>;
  for (const key of edgeKeys) {
    const [a, b] = input.edges[key].map(normalize) as [Point, Point];
    const dx = b[0] - a[0], dy = b[1] - a[1], norm = Math.hypot(dx, dy);
    if (norm < EPS) return { status: "rejected", reason: "degenerate-edges" };
    lines[key] = [-dy / norm, dx / norm, (dy * a[0] - dx * a[1]) / norm];
  }
  const normalized = {} as Record<Vertex, Point>;
  let intersectionSquares = 0, incidenceCount = 0;
  for (const key of keys) {
    const incident = edgeKeys.filter(edge => (EDGES[edge] as readonly Vertex[]).includes(key)).map(edge => lines[edge]);
    const point = leastSquares(incident.map(([a, b]) => [a, b]), incident.map(line => -line[2]));
    if (!point) return { status: "rejected", reason: "degenerate-edges" };
    normalized[key] = [point[0]!, point[1]!];
    for (const [a, b, c] of incident) { intersectionSquares += (a * point[0]! + b * point[1]! + c) ** 2; incidenceCount++; }
  }
  // Projective 3x4 camera for a UNIT cuboid. Its first three columns include the unknown edge lengths.
  const rows: number[][] = [], rhs: number[] = [];
  for (const key of keys) {
    const [x, y, z] = VERTICES[key], [u, v] = normalized[key];
    rows.push([x, y, z, 1, 0, 0, 0, 0, -u * x, -u * y, -u * z]); rhs.push(u);
    rows.push([0, 0, 0, 0, x, y, z, 1, -v * x, -v * y, -v * z]); rhs.push(v);
  }
  const p = leastSquares(rows, rhs);
  if (!p) return { status: "rejected", reason: "degenerate-projection" };
  // K assumes square pixels and zero skew. Principal point is fitted, NOT assumed at image center.
  // Orthogonality: vi.vj - cx*(vix*vjz+vjx*viz) - cy*(viy*vjz+vjy*viz) + w*viz*vjz = 0,
  // where w = cx^2 + cy^2 + f^2. This also handles vanishing directions near infinity without dividing by z.
  const columns = [0, 1, 2].map(i => [p[i]!, p[4 + i]!, p[8 + i]!] as const);
  const metricRows: number[][] = [], metricRhs: number[] = [];
  for (const [i, j] of [[0, 1], [0, 2], [1, 2]] as const) {
    const a = columns[i]!, b = columns[j]!;
    metricRows.push([a[0] * b[2] + b[0] * a[2], a[1] * b[2] + b[1] * a[2], -a[2] * b[2]]);
    metricRhs.push(a[0] * b[0] + a[1] * b[1]);
  }
  const metric = leastSquares(metricRows, metricRhs);
  if (!metric) return { status: "rejected", reason: "uncalibratable" };
  const [cx, cy, w] = metric as [number, number, number];
  const f2 = w - cx * cx - cy * cy;
  if (!Number.isFinite(f2) || f2 <= EPS) return { status: "rejected", reason: "nonphysical-camera" };
  const f = Math.sqrt(f2);
  const lengths = columns.map(([x, y, z]) => Math.hypot((x - cx * z) / f, (y - cy * z) / f, z));
  if (lengths.some(length => !Number.isFinite(length) || length <= EPS)) return { status: "rejected", reason: "nonphysical-camera" };
  // Every vertex, including the hidden eighth one, must lie in front of the camera.
  for (const [x, y, z] of [...Object.values(VERTICES), [1, 1, 1]]) {
    if (p[8]! * x! + p[9]! * y! + p[10]! * z! + 1 <= EPS) return { status: "rejected", reason: "nonphysical-camera" };
  }
  let projectionSquares = 0;
  for (const key of keys) {
    const [x, y, z] = VERTICES[key], observed = normalized[key];
    const depth = p[8]! * x + p[9]! * y + p[10]! * z + 1;
    projectionSquares += ((p[0]! * x + p[1]! * y + p[2]! * z + p[3]!) / depth - observed[0]) ** 2
      + ((p[4]! * x + p[5]! * y + p[6]! * z + p[7]!) / depth - observed[1]) ** 2;
  }
  const maximum = Math.max(...lengths);
  return {
    status: "estimated", corners: Object.fromEntries(keys.map(key => [key, pixel(normalized[key])])) as Record<Vertex, Point>,
    edgeIntersectionRmsPx: Math.sqrt(intersectionSquares / incidenceCount) * scale,
    reprojectionRmsPx: Math.sqrt(projectionSquares / keys.length) * scale,
    camera: { focalPx: f * scale, principalPoint: pixel([cx, cy]) },
    relativeLengths: lengths.map(length => length / maximum) as [number, number, number],
  };
}

const permutations = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]] as const;
/** Rank ALL shapes by scale-free edge ratios. Scores are not probabilities or identity assignments. */
export function rankShapes(lengths: readonly [number, number, number], shapes: readonly Shape[]): Ranking[] {
  if (lengths.some(v => !Number.isFinite(v) || v <= 0) || new Set(shapes.map(shape => shape.id)).size !== shapes.length
    || shapes.some(shape => shape.dimensions.length !== 3 || shape.dimensions.some(v => !Number.isFinite(v) || v <= 0))) {
    throw new RangeError("Invalid lengths or shape definitions.");
  }
  return shapes.map(shape => {
    const rankings = permutations.map(permutation => {
      const dimensions = permutation.map(i => shape.dimensions[i]);
      const scale = dimensions.reduce((sum, d, i) => sum + d * lengths[i]!, 0) / dimensions.reduce((sum, d) => sum + d * d, 0);
      const relativeError = Math.max(...dimensions.map((d, i) => Math.abs(d * scale - lengths[i]!) / lengths[i]!));
      return { id: shape.id, permutation, relativeError };
    });
    return rankings.sort((a, b) => a.relativeError - b.relativeError)[0]!;
  }).sort((a, b) => a.relativeError - b.relativeError || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Deterministic bounded endpoint jitter: a sensitivity probe, NOT confidence intervals or exhaustive error bounds. */
export function probeSensitivity(input: Observation, shapes: readonly Shape[], radiusPx: number, samples = 256, seed = 42) {
  validate(input);
  if (!Number.isFinite(radiusPx) || radiusPx < 0 || !Number.isInteger(samples) || samples < 1 || samples > 10_000
    || !Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError("Invalid sensitivity options.");
  // Validate templates even if every sampled camera is rejected.
  rankShapes([1, 1, 1], shapes);
  const rejected: Partial<Record<FailureReason | "out-of-image", number>> = {};
  const bestCounts: Record<string, number> = Object.fromEntries(shapes.map(shape => [shape.id, 0]));
  const ranges = [[Infinity, -Infinity], [Infinity, -Infinity], [Infinity, -Infinity]];
  let estimated = 0;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 0x100000000; };
  for (let sample = 0; sample < samples; sample++) {
    const edges = Object.fromEntries(edgeKeys.map(key => [key, input.edges[key].map(point =>
      point.map(value => value + (random() * 2 - 1) * radiusPx))])) as unknown as Record<Edge, Segment>;
    if (Object.values(edges).some(edge => edge.some(([x, y]) => x < 0 || x > input.width || y < 0 || y > input.height))) {
      rejected["out-of-image"] = (rejected["out-of-image"] ?? 0) + 1; continue;
    }
    const result = reconstructBox({ ...input, edges });
    if (result.status === "rejected") { rejected[result.reason] = (rejected[result.reason] ?? 0) + 1; continue; }
    estimated++;
    result.relativeLengths.forEach((length, i) => {
      ranges[i]![0] = Math.min(ranges[i]![0]!, length); ranges[i]![1] = Math.max(ranges[i]![1]!, length);
    });
    const best = rankShapes(result.relativeLengths, shapes)[0];
    if (best) bestCounts[best.id] = bestCounts[best.id]! + 1;
  }
  return { radiusPx, samples, estimated, rejected, bestCounts, observedLengthRanges: estimated ? ranges : null };
}

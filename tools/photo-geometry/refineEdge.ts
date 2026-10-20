/** Offline local contrast-boundary refinement. A candidate is NOT a recognized physical body edge. */
import type { Point, Segment } from "./geometry.ts";

export interface GrayImage { readonly width: number; readonly height: number; readonly data: Uint8Array }
/** Fixed development heuristics, not learned thresholds or calibrated confidence levels. */
export const EDGE_SETTINGS = Object.freeze({ radiusPx: 16, stations: 64, minimumGradient: 6,
  competingRatio: 0.6, minimumSeparationPx: 4, minimumSupport: 0.8, maximumAmbiguous: 0.1,
  maximumRmsPx: 1, maximumResidualPx: 3, maximumAngleDeg: 5 });
export interface Peak { readonly offset: number; readonly gradient: number; readonly clipped: boolean }
export interface Sample {
  /** All local peaks, including competitors. These carry no body/sticker interpretation. */
  readonly peaks: readonly Peak[];
  readonly along: number;
  readonly status: "usable" | "weak" | "ambiguous" | "search-boundary";
  readonly offset: number | null;
  readonly gradient: number;
}
export type EdgeRefinement = {
  readonly status: "rejected";
  readonly reason: "short-segment" | "out-of-image" | "multiple-boundaries" | "insufficient-support" | "search-boundary" | "polarity-change" | "not-straight" | "excessive-angle";
  readonly samples: readonly Sample[];
} | {
  readonly status: "candidate";
  readonly segment: Segment;
  readonly samples: readonly Sample[];
  readonly support: number;
  readonly rmsPx: number;
  readonly maximumResidualPx: number;
  readonly angleChangeDeg: number;
  readonly midpointOffsetPx: number;
};

function validate(image: GrayImage, segment: Segment) {
  if (!image || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height)
    || image.width < 2 || image.height < 2 || image.width * image.height > 25_000_000
    || !(image.data instanceof Uint8Array) || image.data.length !== image.width * image.height) throw new RangeError("Invalid grayscale raster.");
  if (!Array.isArray(segment) || segment.length !== 2 || segment.some(p => !Array.isArray(p) || p.length !== 2 || !p.every(Number.isFinite))) {
    throw new RangeError("Invalid edge segment.");
  }
}

/** Bilinear samples; caller verifies the ENTIRE strip, including smoothing support, is inside the image. */
function pixel(image: GrayImage, x: number, y: number) {
  // Image-space origin is the top-left boundary; decoded pixel centers are at (column + .5, row + .5).
  const px = x - 0.5, py = y - 0.5;
  const ix = Math.floor(px), iy = Math.floor(py), dx = px - ix, dy = py - iy;
  const jx = Math.min(ix + 1, image.width - 1), jy = Math.min(iy + 1, image.height - 1);
  return (image.data[iy * image.width + ix]! * (1 - dx) + image.data[iy * image.width + jx]! * dx) * (1 - dy)
    + (image.data[jy * image.width + ix]! * (1 - dx) + image.data[jy * image.width + jx]! * dx) * dy;
}

export function refineEdge(image: GrayImage, segment: Segment): EdgeRefinement {
  validate(image, segment);
  const [a, b] = segment, length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const samples: Sample[] = [];
  const reject = (reason: Extract<EdgeRefinement, { status: "rejected" }>["reason"]): EdgeRefinement => ({ status: "rejected", reason, samples });
  if (length < 32) return reject("short-segment");
  const tx = (b[0] - a[0]) / length, ty = (b[1] - a[1]) / length, nx = -ty, ny = tx;
  const { radiusPx: radius, stations } = EDGE_SETTINGS;
  const at = (along: number, offset: number): Point => [a[0] + tx * along + nx * offset, a[1] + ty * along + ny * offset];
  for (const along of [-2, length + 2]) for (const offset of [-radius - 3, radius + 3]) {
    const [x, y] = at(along, offset);
    if (x < 0.5 || x > image.width - 0.5 || y < 0.5 || y > image.height - 0.5) return reject("out-of-image");
  }
  for (let station = 0; station < stations; station++) {
    const along = (station + 0.5) * length / stations;
    // Tangential three-tap average followed by normal [1,4,6,4,1]/16 smoothing and central difference.
    const profile: number[] = [];
    for (let offset = -radius - 3; offset <= radius + 3; offset++) {
      profile.push([-2, 0, 2].reduce((sum, delta) => { const [x, y] = at(along + delta, offset); return sum + pixel(image, x, y); }, 0) / 3);
    }
    const smooth = (i: number) => (profile[i - 2]! + 4 * profile[i - 1]! + 6 * profile[i]! + 4 * profile[i + 1]! + profile[i + 2]!) / 16;
    const gradients = Array.from({ length: 2 * radius + 1 }, (_, i) => (smooth(i + 4) - smooth(i + 2)) / 2);
    const peaks = gradients.map((g, i) => ({ i, value: Math.abs(g), signed: g })).filter(({ i, value }) =>
      value >= EDGE_SETTINGS.minimumGradient && (i === 0 || value >= Math.abs(gradients[i - 1]!))
      && (i === gradients.length - 1 || value >= Math.abs(gradients[i + 1]!))).sort((p, q) => q.value - p.value || p.i - q.i);
    const alternatives: Peak[] = peaks.map(p => {
      const clipped = p.i <= 1 || p.i >= gradients.length - 2;
      if (clipped) return { offset: p.i - radius, gradient: p.signed, clipped };
      const left = Math.abs(gradients[p.i - 1]!), right = Math.abs(gradients[p.i + 1]!);
      const curvature = left - 2 * p.value + right;
      const delta = curvature < -1e-9 ? Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / curvature)) : 0;
      return { offset: p.i - radius + delta, gradient: p.signed, clipped };
    });
    const best = peaks[0];
    if (!best) { samples.push({ peaks: alternatives, along, status: "weak", offset: null, gradient: 0 }); continue; }
    if (best.i <= 1 || best.i >= gradients.length - 2) {
      samples.push({ peaks: alternatives, along, status: "search-boundary", offset: null, gradient: best.signed }); continue;
    }
    if (peaks.some(p => Math.abs(p.i - best.i) >= EDGE_SETTINGS.minimumSeparationPx && p.value >= best.value * EDGE_SETTINGS.competingRatio)) {
      samples.push({ peaks: alternatives, along, status: "ambiguous", offset: null, gradient: best.signed }); continue;
    }
    const left = Math.abs(gradients[best.i - 1]!), right = Math.abs(gradients[best.i + 1]!);
    const curvature = left - 2 * best.value + right;
    const delta = curvature < -1e-9 ? Math.max(-0.5, Math.min(0.5, 0.5 * (left - right) / curvature)) : 0;
    samples.push({ peaks: alternatives, along, status: "usable", offset: best.i - radius + delta, gradient: best.signed });
  }
  if (samples.filter(s => s.status === "ambiguous").length / stations > EDGE_SETTINGS.maximumAmbiguous) return reject("multiple-boundaries");
  if (samples.filter(s => s.status === "search-boundary").length / stations > EDGE_SETTINGS.maximumAmbiguous) return reject("search-boundary");
  const usable = samples.filter(s => s.status === "usable"), support = usable.length / stations;
  if (support < EDGE_SETTINGS.minimumSupport) return reject("insufficient-support");
  if (usable.some(s => Math.sign(s.gradient) !== Math.sign(usable[0]!.gradient))) return reject("polarity-change");
  // Ordinary line fit to ALL usable peaks, without RANSAC, residual trimming, or camera feedback.
  const meanX = usable.reduce((sum, s) => sum + s.along, 0) / usable.length;
  const meanY = usable.reduce((sum, s) => sum + s.offset!, 0) / usable.length;
  const slope = usable.reduce((sum, s) => sum + (s.along - meanX) * (s.offset! - meanY), 0)
    / usable.reduce((sum, s) => sum + (s.along - meanX) ** 2, 0);
  const intercept = meanY - slope * meanX, norm = Math.hypot(1, slope);
  const residuals = usable.map(s => Math.abs(s.offset! - intercept - slope * s.along) / norm);
  const rmsPx = Math.sqrt(residuals.reduce((sum, v) => sum + v * v, 0) / usable.length);
  const maximumResidualPx = Math.max(...residuals), angleChangeDeg = Math.abs(Math.atan(slope)) * 180 / Math.PI;
  if (rmsPx > EDGE_SETTINGS.maximumRmsPx || maximumResidualPx > EDGE_SETTINGS.maximumResidualPx) return reject("not-straight");
  if (angleChangeDeg > EDGE_SETTINGS.maximumAngleDeg) return reject("excessive-angle");
  if (Math.max(Math.abs(intercept), Math.abs(intercept + slope * length)) > radius - 2) return reject("search-boundary");
  return { status: "candidate", segment: [at(0, intercept), at(length, intercept + slope * length)], samples,
    support, rmsPx, maximumResidualPx, angleChangeDeg, midpointOffsetPx: intercept + slope * length / 2 };
}

/** Initial-region sensitivity. This is not a measurement-error bound, confidence score, or body/sticker classifier. */
export function probeEdgeSelection(image: GrayImage, segment: Segment) {
  const nominal = refineEdge(image, segment);
  if (nominal.status !== "candidate") return { nominal, stable: false, variants: [] };
  const [a, b] = segment, mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / length, ny = (b[0] - a[0]) / length;
  const variants = [[-2, 0], [2, 0], [0, -0.5], [0, 0.5]].map(([offset, degrees]) => {
    const angle = degrees! * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
    const changed = segment.map(([x, y]) => [mx + (x - mx) * c - (y - my) * s + nx * offset!,
      my + (x - mx) * s + (y - my) * c + ny * offset!]) as unknown as Segment;
    const result = refineEdge(image, changed);
    if (result.status !== "candidate") return { offsetPx: offset!, angleDeg: degrees!, result, maximumLineDistancePx: null, angleDifferenceDeg: null };
    const [p, q] = nominal.segment, dx = q[0] - p[0], dy = q[1] - p[1], d = Math.hypot(dx, dy);
    const maximumLineDistancePx = Math.max(...result.segment.map(([x, y]) => Math.abs(dx * (y - p[1]) - dy * (x - p[0])) / d));
    const ex = result.segment[1][0] - result.segment[0][0], ey = result.segment[1][1] - result.segment[0][1];
    const angleDifferenceDeg = Math.atan2(Math.abs(dx * ey - dy * ex), Math.abs(dx * ex + dy * ey)) * 180 / Math.PI;
    return { offsetPx: offset!, angleDeg: degrees!, result, maximumLineDistancePx, angleDifferenceDeg };
  });
  const stable = variants.every(v => v.result.status === "candidate" && v.maximumLineDistancePx! <= 1.5 && v.angleDifferenceDeg! <= 0.5);
  return { nominal, stable, variants };
}

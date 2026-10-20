import { describe, expect, it } from "vitest";
import { fitSharedCamera, probeCameraSensitivity, type Axis, type CameraObservation } from "./sharedCamera";
import type { Point } from "./geometry";

function fixture(affine = false): CameraObservation {
  function project(point: number[]): Point {
    let [x, y, z] = point as [number, number, number];
    [y, z] = [y * Math.cos(-0.43) - z * Math.sin(-0.43), y * Math.sin(-0.43) + z * Math.cos(-0.43)];
    [x, z] = [x * Math.cos(0.61) + z * Math.sin(0.61), -x * Math.sin(0.61) + z * Math.cos(0.61)];
    [x, y] = [x * Math.cos(0.22) - y * Math.sin(0.22), x * Math.sin(0.22) + y * Math.cos(0.22)];
    return [1190 + 2100 * x / (affine ? 180 : z + 180), 1430 + 2100 * y / (affine ? 180 : z + 180)];
  }
  return { width: 2560, height: 2560, groups: Object.fromEntries(["a", "b", "c"].map((axis, index) => [axis,
    Array.from({ length: 6 }, (_, i) => {
      const start = [-35 + 15 * (i % 3), -20 + 19 * Math.floor(i / 2), -10 + 6 * i];
      const end = [...start]; end[index] = end[index]! + 30;
      return { id: axis + i, role: i < 4 ? "fit" : "check", segment: [project(start), project(end)] };
    }),
  ])) as unknown as CameraObservation["groups"] };
}
function estimated(input: CameraObservation) {
  const result = fitSharedCamera(input);
  if (result.status !== "directions-estimated" || result.calibration.status !== "estimated") throw new Error(JSON.stringify(result));
  return { ...result, calibration: result.calibration };
}

describe("shared per-image camera feasibility math", () => {
  it("recovers an unknown camera from multiple parallel edge families and checks unseen edges", () => {
    const input = fixture(), before = structuredClone(input), result = estimated(input);
    expect(result.calibration.focalPx).toBeCloseTo(2100, 5);
    expect(result.calibration.principalPoint[0]).toBeCloseTo(1190, 5);
    expect(result.calibration.principalPoint[1]).toBeCloseTo(1430, 5);
    for (const direction of Object.values(result.directions)) {
      expect(direction.fitRmsPx).toBeLessThan(1e-7);
      expect(direction.checkRmsPx).toBeLessThan(1e-7);
      expect(direction.residuals).toHaveLength(6);
    }
    expect(input).toEqual(before);
  });

  it("never uses held-out directions to improve its calibration", () => {
    const input = fixture(), copy = structuredClone(input);
    const mark = copy.groups.a[4]!;
    (mark.segment[1] as unknown as number[])[1]! += 40;
    const a = estimated(input), b = estimated(copy);
    expect(b.calibration).toEqual(a.calibration);
    expect(b.directions.a.vanishing).toEqual(a.directions.a.vanishing);
    expect(b.directions.a.fitRmsPx).toEqual(a.directions.a.fitRmsPx);
    expect(b.directions.a.checkRmsPx).toBeGreaterThan(5);
  });

  it("preserves the estimate under endpoint reversal, edge ordering, and direction relabeling", () => {
    const input = fixture(), before = estimated(input);
    const reversed = { ...input, groups: Object.fromEntries(Object.entries(input.groups).map(([axis, marks]) => [axis,
      [...marks].reverse().map(m => ({ ...m, segment: [...m.segment].reverse() })),
    ])) as unknown as CameraObservation["groups"] };
    const result = estimated({ ...reversed, groups: { a: reversed.groups.c, b: reversed.groups.a, c: reversed.groups.b } });
    expect(result.calibration.focalPx).toBeCloseTo(before.calibration.focalPx, 5);
    result.calibration.principalPoint.forEach((v, i) => expect(v).toBeCloseTo(before.calibration.principalPoint[i]!, 5));
  });

  it("handles cropping and uniform resizing without assuming the image center is the principal point", () => {
    const input = fixture();
    const result = estimated({ width: 1150, height: 1150, groups: Object.fromEntries(Object.entries(input.groups).map(([axis, marks]) => [axis,
      marks.map(m => ({ ...m, segment: m.segment.map(([x, y]) => [(x - 100) / 2, (y - 150) / 2]) })),
    ])) as unknown as CameraObservation["groups"] });
    expect(result.calibration.focalPx).toBeCloseTo(1050, 5);
    expect(result.calibration.principalPoint[0]).toBeCloseTo(545, 5);
    expect(result.calibration.principalPoint[1]).toBeCloseTo(640, 5);
  });

  it("retains parallel directions at infinity but refuses affine camera self-calibration", () => {
    const result = fitSharedCamera(fixture(true));
    expect(result.status).toBe("directions-estimated");
    if (result.status !== "directions-estimated") return;
    expect(result.calibration).toEqual({ status: "rejected", reason: "uncalibratable" });
    for (const direction of Object.values(result.directions)) {
      expect(Math.abs(direction.vanishing[2])).toBeLessThan(1e-8);
      expect(direction.checkRmsPx).toBeLessThan(1e-7);
    }
  });

  it("rejects a nonphysical camera without concealing held-out diagnostics", () => {
    const input = fixture();
    const vertices = [[1, 0, 1], [0, 1, 1], [1, 1, 3]];
    const groups = Object.fromEntries(Object.entries(input.groups).map(([axis, marks], index) => [axis, marks.map((m, i) => {
      const v = vertices[index]!;
      const mid: Point = [900 + 80 * i, 800 + 100 * i];
      const dx = 1280 + 700 * v[0]! / v[2]! - mid[0], dy = 1280 + 700 * v[1]! / v[2]! - mid[1];
      const scale = 100 / Math.hypot(dx, dy);
      return { ...m, segment: [[mid[0] - dx * scale, mid[1] - dy * scale], [mid[0] + dx * scale, mid[1] + dy * scale]] };
    })])) as unknown as CameraObservation["groups"];
    const result = fitSharedCamera({ ...input, groups });
    expect(result.status).toBe("directions-estimated");
    if (result.status === "directions-estimated") expect(result.calibration).toEqual({ status: "rejected", reason: "nonphysical-camera" });
  });

  it("rejects repeated coincident lines and zero-length marks", () => {
    const input = fixture();
    const repeated = input.groups.a.map(m => ({ ...m, segment: input.groups.a[0]!.segment }));
    expect(fitSharedCamera({ ...input, groups: { ...input.groups, a: repeated } })).toEqual({ status: "rejected", reason: "degenerate-directions" });
    const collapsed = input.groups.a.map(m => ({ ...m, segment: [m.segment[0], m.segment[0]] as const }));
    expect(fitSharedCamera({ ...input, groups: { ...input.groups, a: collapsed } }).status).toBe("rejected");
  });

  it("validates dimensions, split membership, unique IDs, and finite in-image endpoints", () => {
    const input = fixture();
    for (const width of [0, Infinity, 1.5]) expect(() => fitSharedCamera({ ...input, width })).toThrow(RangeError);
    for (const a of [[], input.groups.a.filter(m => m.role === "fit"), input.groups.a.slice(2),
      [...input.groups.a, input.groups.a[0]!], input.groups.a.map(m => ({ ...m, segment: [[NaN, 1], [2, 3]] })),
      input.groups.a.map(m => ({ ...m, segment: [[-1, 1], [2, 3]] }))]) {
      expect(() => fitSharedCamera({ ...input, groups: { ...input.groups, a } } as CameraObservation)).toThrow(RangeError);
    }
  });

  it("reports deterministic camera sensitivity, all rejection counts, and no inferred identity", () => {
    const input = fixture(), before = structuredClone(input);
    const exact = probeCameraSensitivity(input, 0, 8);
    expect(exact.estimated).toBe(8);
    expect(exact.observedRanges!.focalPx[0]).toBeCloseTo(2100, 5);
    const noisy = probeCameraSensitivity(input, 5, 64);
    expect(noisy).toEqual(probeCameraSensitivity(input, 5, 64));
    expect(noisy.estimated + Object.values(noisy.rejected).reduce((s, n) => s + n, 0)).toBe(64);
    expect(noisy.observedRanges!.focalPx[1]! - noisy.observedRanges!.focalPx[0]!).toBeGreaterThan(1);
    expect(probeCameraSensitivity(input, 100_000, 4).rejected["out-of-image"]).toBe(4);
    expect(probeCameraSensitivity(fixture(true), 0, 4).rejected.uncalibratable).toBe(4);
    expect(input).toEqual(before);
    for (const radius of [-1, Infinity]) expect(() => probeCameraSensitivity(input, radius)).toThrow(RangeError);
    expect(() => probeCameraSensitivity(input, 1, 0)).toThrow(RangeError);
    expect(() => probeCameraSensitivity(input, 1, 1, -1)).toThrow(RangeError);
  });

  it("does not silently remove a misgrouped fit edge or report its residual as an independent check", () => {
    const input = fixture();
    const a = [...input.groups.a];
    a[0] = { ...a[0]!, segment: input.groups.b[0]!.segment };
    const result = fitSharedCamera({ ...input, groups: { ...input.groups, a } });
    expect(result.status).toBe("directions-estimated");
    if (result.status !== "directions-estimated") return;
    expect(result.directions.a.fitRmsPx).toBeGreaterThan(10);
    expect(result.directions.a.residuals.filter(m => m.role === "fit")).toHaveLength(4);
    for (const axis of ["a", "b", "c"] as Axis[]) expect(result.directions[axis].residuals.filter(m => m.role === "check")).toHaveLength(2);
  });
});

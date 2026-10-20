import { describe, expect, it } from "vitest";
import { createSolvedCube } from "../../src/puzzle/model";
import { EDGES, VERTICES, probeSensitivity, rankShapes, reconstructBox, type Observation, type Point, type Shape, type Vertex } from "./geometry";

const shapes: readonly Shape[] = createSolvedCube().pieces.map(piece => ({
  id: piece.id, dimensions: [piece.dimensions.x, piece.dimensions.y, piece.dimensions.z],
}));
// Independently project actual metric boxes through a known pinhole camera, then mark interior edge points.
function synthetic(dimensions: readonly number[], options: { distance?: number; focal?: number; cx?: number; cy?: number; affine?: boolean } = {}): Observation {
  const { distance = 180, focal = 1900, cx = 1200, cy = 1400, affine = false } = options;
  const yaw = 0.61, pitch = -0.43, roll = 0.22;
  function project([x, y, z]: readonly number[]): Point {
    let a = x! * dimensions[0]!, b = y! * dimensions[1]!, c = z! * dimensions[2]!;
    [b, c] = [b * Math.cos(pitch) - c * Math.sin(pitch), b * Math.sin(pitch) + c * Math.cos(pitch)];
    [a, c] = [a * Math.cos(yaw) + c * Math.sin(yaw), -a * Math.sin(yaw) + c * Math.cos(yaw)];
    [a, b] = [a * Math.cos(roll) - b * Math.sin(roll), a * Math.sin(roll) + b * Math.cos(roll)];
    a -= 12; b -= 8; c += distance;
    return [cx + focal * a / (affine ? distance : c), cy + focal * b / (affine ? distance : c)];
  }
  const points = Object.fromEntries(Object.entries(VERTICES).map(([key, p]) => [key, project(p)])) as Record<Vertex, Point>;
  return { width: 2560, height: 2560, edges: Object.fromEntries(Object.entries(EDGES).map(([key, [a, b]]) => [key,
    [0.2, 0.8].map(t => [points[a][0] * (1 - t) + points[b][0] * t, points[a][1] * (1 - t) + points[b][1] * t]),
  ])) as unknown as Observation["edges"] };
}

describe("offline projective box geometry", () => {
  it.each(shapes)("recovers all three ratios and the camera for shape $id, without knowing its identity", shape => {
    for (const dimensions of [shape.dimensions, [shape.dimensions[2], shape.dimensions[0], shape.dimensions[1]]]) {
      const input = synthetic(dimensions), copy = structuredClone(input);
      const result = reconstructBox(input);
      if (result.status !== "estimated") throw new Error(result.reason);
      expect(result.camera.focalPx).toBeCloseTo(1900, 6);
      expect(result.camera.principalPoint[0]).toBeCloseTo(1200, 6);
      expect(result.camera.principalPoint[1]).toBeCloseTo(1400, 6);
      result.relativeLengths.forEach((value, i) => expect(value).toBeCloseTo(dimensions[i]! / Math.max(...dimensions), 8));
      expect(result.reprojectionRmsPx).toBeLessThan(1e-8);
      expect(result.edgeIntersectionRmsPx).toBeLessThan(1e-8);
      const ranked = rankShapes(result.relativeLengths, shapes);
      expect(ranked).toHaveLength(8);
      expect(ranked[0]!.id).toBe(shape.id);
      expect(ranked[0]!.relativeError).toBeLessThan(1e-8);
      expect(input).toEqual(copy);
    }
  });

  it("handles strong perspective, off-center principal points, resizing, and cropping without using the image center as calibration", () => {
    const input = synthetic([22, 30, 17], { distance: 85, focal: 1250, cx: 1350, cy: 1050 });
    const resized: Observation = { width: 1100, height: 1150,
      edges: Object.fromEntries(Object.entries(input.edges).map(([key, edge]) => [key,
        edge.map(([x, y]) => [(x - 200) / 2, (y - 100) / 2])])) as unknown as Observation["edges"] };
    const result = reconstructBox(resized);
    if (result.status !== "estimated") throw new Error(result.reason);
    expect(result.camera.focalPx).toBeCloseTo(625, 6);
    expect(result.camera.principalPoint[0]).toBeCloseTo(575, 6);
    expect(result.camera.principalPoint[1]).toBeCloseTo(475, 6);
    expect(rankShapes(result.relativeLengths, shapes)[0]!.id).toBe("-+-");
  });

  it("does not identify metric scale or merge similarly sized pieces", () => {
    const a = reconstructBox(synthetic([22, 20, 17]));
    const b = reconstructBox(synthetic([44, 40, 34], { distance: 360 }));
    if (a.status !== "estimated" || b.status !== "estimated") throw new Error("Expected estimates");
    a.relativeLengths.forEach((value, i) => expect(value).toBeCloseTo(b.relativeLengths[i]!, 8));
    const templates: Shape[] = [{ id: "22", dimensions: [22, 20, 17] }, { id: "21", dimensions: [21, 20, 17] }];
    const ranked = rankShapes(a.relativeLengths, templates);
    expect(ranked[0]!.id).toBe("22");
    expect(ranked[1]!.id).toBe("21");
    expect(ranked[1]!.relativeError).toBeGreaterThan(0.01);
    expect(rankShapes([22, 20, 17], [...templates, { id: "scaled", dimensions: [44, 40, 34] }]).filter(r => r.relativeError < 1e-10)).toHaveLength(2);
  });

  it("refuses uncalibratable affine views instead of silently substituting an orthographic camera", () => {
    expect(reconstructBox(synthetic([22, 20, 17], { affine: true }))).toEqual({ status: "rejected", reason: "uncalibratable" });
  });

  it("rejects a projective box whose orthogonal-camera metric would require a negative squared focal length", () => {
    const points = Object.fromEntries(Object.entries(VERTICES).map(([key, [x, y, z]]) => [key,
      [1280 + 1000 * (x + z - 0.1) / (x + y + 3 * z + 5), 1280 + 1000 * (y + z - 0.1) / (x + y + 3 * z + 5)],
    ])) as unknown as Record<Vertex, Point>;
    const edges = Object.fromEntries(Object.entries(EDGES).map(([key, [a, b]]) => [key, [points[a], points[b]]])) as unknown as Observation["edges"];
    expect(reconstructBox({ width: 2560, height: 2560, edges })).toEqual({ status: "rejected", reason: "nonphysical-camera" });
  });

  it("rejects zero-length or parallel markings and malformed observations", () => {
    const input = synthetic([22, 20, 17]);
    expect(reconstructBox({ ...input, edges: { ...input.edges, oa: [[100, 100], [100, 100]] } }).status).toBe("rejected");
    const edges = Object.fromEntries(Object.keys(EDGES).map(key => [key, [[100, 100], [200, 100]]])) as unknown as Observation["edges"];
    expect(reconstructBox({ ...input, edges }).status).toBe("rejected");
    for (const bad of [{ ...input, width: 0 }, { ...input, height: Infinity }, { ...input, edges: {} },
      { ...input, edges: { ...input.edges, oa: [[NaN, 100], [200, 100]] } },
      { ...input, edges: { ...input.edges, oa: [[-1, 100], [200, 100]] } }]) {
      expect(() => reconstructBox(bad as Observation)).toThrow(RangeError);
    }
    expect(() => rankShapes([0, 1, 2], shapes)).toThrow(RangeError);
    expect(() => rankShapes([1, 1, 2], [...shapes, shapes[0]!])).toThrow(RangeError);
  });

  it("reports endpoint sensitivity reproducibly, counts rejected cases, and preserves inputs", () => {
    const input = synthetic([22, 20, 17]), copy = structuredClone(input);
    const exact = probeSensitivity(input, shapes, 0, 12);
    expect(exact.estimated).toBe(12);
    expect(exact.bestCounts["---"]).toBe(12);
    const noisy = probeSensitivity(input, shapes, 5, 128);
    expect(noisy).toEqual(probeSensitivity(input, shapes, 5, 128));
    expect(Object.values(noisy.bestCounts).reduce((a, b) => a + b, 0)).toBe(noisy.estimated);
    expect(noisy.estimated + Object.values(noisy.rejected).reduce((a, b) => a + b, 0)).toBe(128);
    expect(Object.values(noisy.bestCounts).filter(count => count > 0).length).toBeGreaterThan(1);
    const invalid = probeSensitivity(synthetic([22, 20, 17], { affine: true }), shapes, 0, 3);
    expect(invalid.rejected.uncalibratable).toBe(3);
    expect(invalid.observedLengthRanges).toBeNull();
    expect(input).toEqual(copy);
    expect(() => probeSensitivity(input, shapes, -1)).toThrow(RangeError);
    expect(() => probeSensitivity(input, shapes, 1, 0)).toThrow(RangeError);
  });

  it("does not clamp out-of-image perturbations into invented observations", () => {
    const input = synthetic([22, 20, 17]);
    const result = probeSensitivity(input, shapes, 100_000, 4);
    expect(result.estimated).toBe(0);
    expect(result.rejected["out-of-image"]).toBe(4);
  });
});

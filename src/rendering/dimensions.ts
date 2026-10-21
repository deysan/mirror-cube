import { Camera, OrthographicCamera, Vector3 } from "three";
import { homeSlot } from "../puzzle/corners";
import type { PieceId, Vector3 as Lengths } from "../puzzle/model";
import { DIMENSION_AXES, type DimensionAxis, type Point2, type LabelReservation, type DimensionRuler, type DimensionDrawing } from "./dimensionDrawing";
export { DIMENSION_AXES, AXIS_COLORS } from "./dimensionDrawing";
export type { DimensionAxis, Point2, LabelReservation, DimensionRuler, DimensionDrawing } from "./dimensionDrawing";
export const axisFace = (slot: PieceId, axis: DimensionAxis) =>
  axis === "x" ? (slot[0] === "+" ? "R" : "L") : axis === "y" ? (slot[1] === "+" ? "U" : "D") : (slot[2] === "+" ? "F" : "B");

/** The same exact world-space box used by the mesh; endpoint zero is the mechanism corner. */
export function dimensionBox(lengths: Lengths, slot: PieceId) {
  const signs = homeSlot(slot);
  const min = new Vector3(), max = new Vector3();
  for (const axis of DIMENSION_AXES) {
    min[axis] = Math.min(0, signs[axis] * lengths[axis]);
    max[axis] = Math.max(0, signs[axis] * lengths[axis]);
  }
  const vertices = Array.from({ length: 8 }, (_, bits) => new Vector3(...DIMENSION_AXES.map((axis, i) =>
    bits & (1 << i) ? max[axis] : min[axis]) as [number, number, number]));
  return { min, max, vertices, center: min.clone().add(max).multiplyScalar(0.5) };
}

/** Project exact lengths, not screen measurements. Collision handling moves labels, never geometry. */
export function projectDimensions(camera: Camera, width: number, height: number, lengths: Lengths, slot: PieceId,
  options: { readonly reserved?: readonly LabelReservation[]; readonly avoidPiece?: boolean } = {}): DimensionDrawing {
  camera.updateMatrixWorld();
  const box = dimensionBox(lengths, slot);
  const project = (point: Vector3): Point2 => {
    const p = point.clone().project(camera);
    return [(p.x + 1) * width / 2, (1 - p.y) * height / 2];
  };
  const direction = camera.getWorldDirection(new Vector3()).negate();
  const center = project(box.center);
  const projected = box.vertices.map(project);
  const occupied: LabelReservation[] = [...(options.reserved ?? [])];
  const bounds = { left: Math.min(...projected.map(p => p[0])), right: Math.max(...projected.map(p => p[0])),
    top: Math.min(...projected.map(p => p[1])), bottom: Math.max(...projected.map(p => p[1])) };
  const rulers: DimensionRuler[] = [];
  const clampLabel = ([x, y]: Point2): Point2 => [Math.max(46, Math.min(width - 46, x)), Math.max(15, Math.min(height - 15, y))];
  for (const [index, axis] of DIMENSION_AXES.entries()) {
    const candidates = box.vertices.flatMap((start, bits) => {
      if (bits & (1 << index)) return [];
      const visible = DIMENSION_AXES.some((other, j) => j !== index && direction[other] * (bits & (1 << j) ? 1 : -1) > 1e-8);
      if (!visible) return [];
      const a = project(start), b = projected[bits | (1 << index)]!;
      const dx = b[0] - a[0], dy = b[1] - a[1], length = Math.hypot(dx, dy);
      if (length < 8) return [];
      const mid: Point2 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      let normal: Point2 = [-dy / length, dx / length];
      const side = (mid[0] - center[0]) * normal[0] + (mid[1] - center[1]) * normal[1];
      if (side < 0) normal = [-normal[0], -normal[1]];
      return [{ a, b, mid, normal, distance: Math.abs(side) }];
    }).sort((a, b) => Math.abs(b.distance - a.distance) < 1e-6 ? 0 : b.distance - a.distance);
    const edge = candidates[0];
    if (!edge) continue;
    const shift = (p: Point2, distance: number): Point2 => [p[0] + edge.normal[0] * distance, p[1] + edge.normal[1] * distance];
    const desired = shift(edge.mid, 34);
    const labelOptions = [desired, ...[48, 62, 76].map(n => shift(edge.mid, n)),
      ...[15, height / 2, height - 15].flatMap(y => [[46, y], [width / 2, y], [width - 46, y]] as Point2[])].map(clampLabel);
    const score = (p: Point2) => occupied.filter(q => Math.abs(p[0] - q.position[0]) < 42 + q.halfWidth + 8 && Math.abs(p[1] - q.position[1]) < 11 + q.halfHeight + 7).length * 1e9
      + (options.avoidPiece && p[0] + 42 > bounds.left && p[0] - 42 < bounds.right && p[1] + 11 > bounds.top && p[1] - 11 < bounds.bottom ? 1e6 : 0)
      + (p[0] - desired[0]) ** 2 + (p[1] - desired[1]) ** 2;
    const label = labelOptions.sort((a, b) => score(a) - score(b))[0]!;
    occupied.push({ position: label, halfWidth: 42, halfHeight: 11 });
    rulers.push({ axis, face: axisFace(slot, axis), value: lengths[axis], edge: [edge.a, edge.b],
      line: [shift(edge.a, 13), shift(edge.b, 13)], label });
  }
  return { width, height, rulers };
}

/** Keep measurement text away from the six fixed-world sprites in the main view. */
export function faceLabelReservations(camera: OrthographicCamera, width: number, height: number, radius: number): LabelReservation[] {
  camera.updateMatrixWorld();
  const halfSize = Math.max(20, 8 * camera.zoom) / 2;
  return DIMENSION_AXES.flatMap(axis => [-1, 1].map(sign => {
    const point = new Vector3(); point[axis] = sign * radius * 1.3; point.project(camera);
    return { position: [(point.x + 1) * width / 2, (1 - point.y) * height / 2] as Point2, halfWidth: halfSize, halfHeight: halfSize };
  }));
}

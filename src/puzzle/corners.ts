import type { PieceId, Vector3 } from "./model";
import { equalVector, transformVector } from "./orientation";
import type { CornerState, Orientation } from "./state";

/** Canonical identity/slot order: x-major, then y, then z; the reference corner is first. */
export const PIECE_IDS = ["---", "--+", "-+-", "-++", "+--", "+-+", "++-", "+++"] as const satisfies readonly PieceId[];

export function homeSlot(pieceId: PieceId): Vector3 {
  return {
    x: pieceId[0] === "-" ? -1 : 1,
    y: pieceId[1] === "-" ? -1 : 1,
    z: pieceId[2] === "-" ? -1 : 1,
  };
}

/** Outward normals in a common cyclic order (determinant -1), starting with U/D. */
function cornerFrame(slot: Vector3): readonly Vector3[] {
  const x = { x: slot.x, y: 0, z: 0 };
  const y = { x: 0, y: slot.y, z: 0 };
  const z = { x: 0, y: 0, z: slot.z };
  return slot.x * slot.y * slot.z === 1 ? [y, x, z] : [y, z, x];
}

/** Requires a proper orientation with slot = orientation × homeSlot(pieceId). */
export function cornerTwist(corner: CornerState): number {
  const home = homeSlot(corner.pieceId);
  const upDown = transformVector({ x: 0, y: home.y, z: 0 }, corner.orientation);
  const twist = cornerFrame(corner.slot).findIndex((normal) => equalVector(normal, upDown));
  if (twist < 0) throw new RangeError("Corner orientation does not match its slot.");
  return twist;
}

/** Construct one of the three proper poses taking this piece to this signed slot. */
export function cornerOrientation(pieceId: PieceId, slot: Vector3, twist: number): Orientation {
  if (!Number.isInteger(twist) || twist < 0 || twist > 2) throw new RangeError("Twist must be 0, 1, or 2.");
  const source = cornerFrame(homeSlot(pieceId));
  const target = cornerFrame(slot);
  const columns = {
    x: { x: 0, y: 0, z: 0 }, y: { x: 0, y: 0, z: 0 }, z: { x: 0, y: 0, z: 0 },
  };
  source.forEach((normal, index) => {
    const axis = (["x", "y", "z"] as const).find((key) => normal[key] !== 0)!;
    const mapped = target[(index + twist) % 3]!;
    const sign = normal[axis];
    columns[axis] = {
      x: mapped.x === 0 ? 0 : sign * mapped.x,
      y: mapped.y === 0 ? 0 : sign * mapped.y,
      z: mapped.z === 0 ? 0 : sign * mapped.z,
    };
  });
  return columns;
}

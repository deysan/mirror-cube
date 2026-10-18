import type { Vector3 } from "./model";
import type { Orientation, PuzzleState } from "./state";

const axes = ["x", "y", "z"] as const;

function equalVector(a: Vector3, b: Vector3): boolean {
  return axes.every((axis) => a[axis] === b[axis]);
}

/** Exactly the 24 signed-axis rotations, excluding reflections and scaling. */
function isCubeRotation(orientation: Orientation): boolean {
  const { x, y, z } = orientation;
  const unitAxes = [x, y, z].every((vector) =>
    axes.every((axis) => vector[axis] === -1 || vector[axis] === 0 || vector[axis] === 1)
    && Math.abs(vector.x) + Math.abs(vector.y) + Math.abs(vector.z) === 1,
  );
  return unitAxes && equalVector(z, {
    x: x.y * y.z - x.z * y.y,
    y: x.z * y.x - x.x * y.z,
    z: x.x * y.y - x.y * y.x,
  });
}

/**
 * Exact solvedness up to a rigid rotation of the whole cube.
 * Takes a structurally typed state, not arbitrary JSON; false is not a validity diagnosis.
 * No dimensions, camera, move history, or approximate geometry are consulted.
 */
export function isSolved(state: PuzzleState): boolean {
  if (state.corners.length !== 8) return false;
  const rotation = state.corners[0]!.orientation;
  if (!isCubeRotation(rotation)) return false;

  const seen = new Set<string>();
  for (const corner of state.corners) {
    const { pieceId, orientation, slot } = corner;
    if (!/^[+-]{3}$/.test(pieceId) || seen.has(pieceId)) return false;
    seen.add(pieceId);
    if (!axes.every((axis) => equalVector(orientation[axis], rotation[axis]))) return false;

    const homeX = pieceId[0] === "-" ? -1 : 1;
    const homeY = pieceId[1] === "-" ? -1 : 1;
    const homeZ = pieceId[2] === "-" ? -1 : 1;
    if (!axes.every((axis) => slot[axis] === (
      rotation.x[axis] * homeX + rotation.y[axis] * homeY + rotation.z[axis] * homeZ
    ))) return false;
  }
  return true;
}

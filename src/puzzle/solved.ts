import { equalVector, isCubeRotation } from "./orientation";
import type { PuzzleState } from "./state";

const axes = ["x", "y", "z"] as const;

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

import type { PieceId, SolvedCube, Vector3 } from "./model";

/** Local X, Y, Z axes expressed in world coordinates (rotation matrix columns). */
export interface Orientation {
  readonly x: Vector3;
  readonly y: Vector3;
  readonly z: Vector3;
}

export interface CornerState {
  readonly pieceId: PieceId;
  /** Octant signs, each -1 or +1. Not a geometric center or a distance in mm. */
  readonly slot: Vector3;
  /** A proper signed-axis rotation; entries stay exactly -1, 0, or +1. */
  readonly orientation: Orientation;
}

export interface PuzzleState {
  /** Stable piece order: turns change poses, not identities or array order. */
  readonly corners: readonly CornerState[];
}

/** Create a discrete state for a validated solved model; dimensions stay in it. */
export function createSolvedState(cube: SolvedCube): PuzzleState {
  return {
    corners: cube.pieces.map(({ id }) => ({
      pieceId: id,
      slot: {
        x: id[0] === "-" ? -1 : 1,
        y: id[1] === "-" ? -1 : 1,
        z: id[2] === "-" ? -1 : 1,
      },
      orientation: {
        x: { x: 1, y: 0, z: 0 },
        y: { x: 0, y: 1, z: 0 },
        z: { x: 0, y: 0, z: 1 },
      },
    })),
  };
}

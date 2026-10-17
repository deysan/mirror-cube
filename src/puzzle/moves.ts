import type { Vector3 } from "./model";
import type { PuzzleState } from "./state";

export type Face = "U" | "D" | "L" | "R" | "F" | "B";
type Axis = keyof Vector3;

export interface Move {
  readonly face: Face;
  /** Looking directly at the face from outside: +1 clockwise, -1 counterclockwise. */
  readonly turns: 1 | -1 | 2;
}

/** Fixed world frame: +X right, +Y up, +Z front. */
export const FACE_LAYERS = {
  U: { axis: "y", side: 1 },
  D: { axis: "y", side: -1 },
  L: { axis: "x", side: -1 },
  R: { axis: "x", side: 1 },
  F: { axis: "z", side: 1 },
  B: { axis: "z", side: -1 },
} as const satisfies Record<Face, { readonly axis: Axis; readonly side: 1 | -1 }>;

/** Keep zero canonical: negating 0 must not introduce JavaScript's -0. */
function negate(value: number): number {
  return value === 0 ? 0 : -value;
}

/** Positive right-handed quarter-turns, using only swaps and sign changes. */
function rotate(vector: Vector3, axis: Axis, quarterTurns: number): Vector3 {
  let result = vector;

  for (let turn = 0; turn < quarterTurns; turn += 1) {
    const { x, y, z } = result;
    switch (axis) {
      case "x":
        result = { x, y: negate(z), z: y };
        break;
      case "y":
        result = { x: z, y, z: negate(x) };
        break;
      case "z":
        result = { x: negate(y), y: x, z };
        break;
    }
  }

  return result;
}

/** Apply a complete move without modifying its input or the piece dimensions. */
export function applyMove(state: PuzzleState, move: Move): PuzzleState {
  const { axis, side } = FACE_LAYERS[move.face];
  // Clockwise from outside is negative about the face's outward normal.
  const quarterTurns = ((-side * move.turns) % 4 + 4) % 4;

  return {
    corners: state.corners.map((corner) => {
      // Membership comes from the current slot, never from the piece's home ID.
      if (corner.slot[axis] !== side) {
        return corner;
      }

      return {
        pieceId: corner.pieceId,
        slot: rotate(corner.slot, axis, quarterTurns),
        orientation: {
          x: rotate(corner.orientation.x, axis, quarterTurns),
          y: rotate(corner.orientation.y, axis, quarterTurns),
          z: rotate(corner.orientation.z, axis, quarterTurns),
        },
      };
    }),
  };
}

export function inverseMove(move: Move): Move {
  return {
    face: move.face,
    turns: move.turns === 2 ? 2 : move.turns === 1 ? -1 : 1,
  };
}

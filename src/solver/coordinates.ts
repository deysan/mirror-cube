import { cornerOrientation, cornerTwist, homeSlot, PIECE_IDS } from "../puzzle/corners";
import { FACE_LAYERS, type Move } from "../puzzle/moves";
import { inverseRotation, isCubeRotation, rotateState, transformVector } from "../puzzle/orientation";
import type { CornerState, Orientation, PuzzleState } from "../puzzle/state";
import { validatePuzzleState, type StateValidationResult } from "../puzzle/validation";

export const PERMUTATION_COUNT = 5040; // 7!
export const TWIST_COUNT = 729; // 3^6

export interface SolverCoordinates {
  readonly permutation: number;
  readonly twist: number;
}

export type EncodingResult =
  | { readonly valid: true; readonly coordinates: SolverCoordinates; readonly frame: Orientation }
  | Extract<StateValidationResult, { valid: false }>;

/** Validate and normalize around piece ---. Frame maps normalized coordinates back to the input frame. */
export function encodeState(input: unknown): EncodingResult {
  const validation = validatePuzzleState(input);
  if (!validation.valid) return validation;
  const frame = validation.state.corners[0]!.orientation;
  const normalized = rotateState(validation.state, inverseRotation(frame));
  const atSlot = PIECE_IDS.map((id) => {
    const slot = homeSlot(id);
    return normalized.corners.find((corner) =>
      corner.slot.x === slot.x && corner.slot.y === slot.y && corner.slot.z === slot.z,
    )!;
  });

  // Lehmer rank of the seven non-reference identities in slot order.
  const remaining = PIECE_IDS.slice(1);
  let permutation = 0;
  for (const corner of atSlot.slice(1)) {
    const digit = remaining.indexOf(corner.pieceId);
    permutation = permutation * remaining.length + digit;
    remaining.splice(digit, 1);
  }
  // Slots 1..6 store independent twists; slot 7 follows from the sum constraint.
  let twist = 0;
  for (const corner of atSlot.slice(1, 7)) twist = twist * 3 + cornerTwist(corner);
  return { valid: true, coordinates: { permutation, twist }, frame };
}

/** Decode to the normalized frame, or restore the original frame returned by encodeState. */
export function decodeState(coordinates: SolverCoordinates, frame?: Orientation): PuzzleState {
  if (!Number.isInteger(coordinates.permutation) || coordinates.permutation < 0 || coordinates.permutation >= PERMUTATION_COUNT
    || !Number.isInteger(coordinates.twist) || coordinates.twist < 0 || coordinates.twist >= TWIST_COUNT) {
    throw new RangeError("Solver coordinates are outside their integer ranges.");
  }
  if (frame && !isCubeRotation(frame)) throw new RangeError("Frame must be a proper cube rotation.");

  let permutation = coordinates.permutation;
  const digits = Array<number>(7);
  for (let index = 6; index >= 0; index--) {
    const radix = 7 - index;
    digits[index] = permutation % radix;
    permutation = Math.floor(permutation / radix);
  }
  const remaining = PIECE_IDS.slice(1);
  const pieces = digits.map((digit) => remaining.splice(digit, 1)[0]!);
  let twist = coordinates.twist;
  const twists = Array<number>(7).fill(0);
  for (let index = 5; index >= 0; index--) {
    twists[index] = twist % 3;
    twist = Math.floor(twist / 3);
  }
  twists[6] = (3 - twists.reduce((sum, value) => sum + value, 0) % 3) % 3;

  const byPiece = new Map<string, CornerState>();
  for (const [index, pieceId] of [PIECE_IDS[0], ...pieces].entries()) {
    const slot = homeSlot(PIECE_IDS[index]!);
    byPiece.set(pieceId, {
      pieceId, slot,
      orientation: cornerOrientation(pieceId, slot, index === 0 ? 0 : twists[index - 1]!),
    });
  }
  const state = { corners: PIECE_IDS.map((id) => byPiece.get(id)!) };
  return frame ? rotateState(state, frame) : state;
}

/** Proper rotations preserve clockwise as viewed from outside; only the face changes. */
export function mapMoveFromFrame(move: Move, frame: Orientation): Move {
  if (!isCubeRotation(frame)) throw new RangeError("Frame must be a proper cube rotation.");
  const { axis, side } = FACE_LAYERS[move.face];
  const direction = transformVector({ x: axis === "x" ? side : 0, y: axis === "y" ? side : 0, z: axis === "z" ? side : 0 }, frame);
  const face = (["U", "D", "L", "R", "F", "B"] as const).find((candidate) => {
    const layer = FACE_LAYERS[candidate];
    return direction[layer.axis] === layer.side;
  })!;
  return { face, turns: move.turns };
}

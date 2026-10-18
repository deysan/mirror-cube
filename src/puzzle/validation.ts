import { cornerTwist, homeSlot, PIECE_IDS } from "./corners";
import type { PieceId, Vector3 } from "./model";
import { equalVector, isCubeRotation, transformVector } from "./orientation";
import type { CornerState, PuzzleState } from "./state";

export type StateErrorCode =
  | "structure" | "corner-count" | "piece-id" | "duplicate-piece"
  | "slot" | "duplicate-slot" | "orientation" | "pose" | "twist-sum";

export interface StateValidationError {
  readonly code: StateErrorCode;
  /** Index in the supplied array, before canonical ordering. */
  readonly cornerIndex?: number;
}

export type StateValidationResult =
  | { readonly valid: true; readonly state: PuzzleState }
  | { readonly valid: false; readonly error: StateValidationError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readVector(value: unknown): Vector3 | null {
  if (!isRecord(value)) return null;
  const { x, y, z } = value;
  if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number"
    || ![x, y, z].every(Number.isFinite)) return null;
  return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y, z: z === 0 ? 0 : z };
}

/** Validate plain data and return an independent, canonically ordered snapshot. No repairs or rounding. */
export function validatePuzzleState(input: unknown): StateValidationResult {
  if (!isRecord(input) || !Array.isArray(input.corners)) return { valid: false, error: { code: "structure" } };
  if (input.corners.length !== 8) return { valid: false, error: { code: "corner-count" } };
  const corners = new Map<PieceId, CornerState>();
  const slots = new Set<string>();
  let twistSum = 0;

  for (let index = 0; index < input.corners.length; index++) {
    const fail = (code: StateErrorCode): StateValidationResult => ({ valid: false, error: { code, cornerIndex: index } });
    const raw: unknown = input.corners[index];
    if (!isRecord(raw)) return fail("structure");
    if (typeof raw.pieceId !== "string" || !/^[+-]{3}$/.test(raw.pieceId)) return fail("piece-id");
    const pieceId = raw.pieceId as PieceId;
    if (corners.has(pieceId)) return fail("duplicate-piece");
    const slot = readVector(raw.slot);
    if (!slot || ![slot.x, slot.y, slot.z].every((side) => side === -1 || side === 1)) return fail("slot");
    const key = `${slot.x},${slot.y},${slot.z}`;
    if (slots.has(key)) return fail("duplicate-slot");
    if (!isRecord(raw.orientation)) return fail("orientation");
    const x = readVector(raw.orientation.x);
    const y = readVector(raw.orientation.y);
    const z = readVector(raw.orientation.z);
    if (!x || !y || !z) return fail("orientation");
    const orientation = { x, y, z };
    if (!isCubeRotation(orientation)) return fail("orientation");
    if (!equalVector(slot, transformVector(homeSlot(pieceId), orientation))) return fail("pose");
    const corner = { pieceId, slot, orientation };
    twistSum += cornerTwist(corner);
    corners.set(pieceId, corner);
    slots.add(key);
  }

  // A 2×2 has no edge/permutation-parity constraint. Only total corner twist is constrained.
  if (twistSum % 3 !== 0) return { valid: false, error: { code: "twist-sum" } };
  return { valid: true, state: { corners: PIECE_IDS.map((id) => corners.get(id)!) } };
}

import { PIECE_IDS, cornerOrientation, cornerTwist, homeSlot } from "./corners";
import type { Piece, PieceId, Vector3 } from "./model";
import { equalVector } from "./orientation";
import type { CornerState, PuzzleState } from "./state";
import { validatePuzzleState } from "./validation";

export interface Placement {
  readonly pieceId: PieceId;
  readonly twist: number;
}
/** Indexed by PIECE_IDS as slots, not by piece identity. Never itself a solver state. */
export type PuzzleDraft = readonly (Placement | null)[];
export type DraftEdit =
  | { readonly type: "assign"; readonly slot: PieceId; readonly pieceId: PieceId }
  | { readonly type: "twist" | "remove"; readonly slot: PieceId };

export function emptyDraft(): PuzzleDraft { return PIECE_IDS.map(() => null); }

export function draftFromState(state: PuzzleState): PuzzleDraft {
  const result = validatePuzzleState(state);
  if (!result.valid) throw new RangeError("Cannot copy an invalid puzzle state.");
  return PIECE_IDS.map(slot => {
    const corner = result.state.corners.find(c => equalVector(c.slot, homeSlot(slot)))!;
    return { pieceId: corner.pieceId, twist: cornerTwist(corner) };
  });
}

/** Duplicate identities are refused rather than silently swapping or moving another piece. */
export function editDraft(draft: PuzzleDraft, edit: DraftEdit): PuzzleDraft {
  const index = PIECE_IDS.indexOf(edit.slot);
  if (index < 0 || draft.length !== 8) return draft;
  const old = draft[index];
  let placement: Placement | null;
  if (edit.type === "assign") {
    if (!PIECE_IDS.includes(edit.pieceId) || old?.pieceId === edit.pieceId
      || draft.some((p, i) => i !== index && p?.pieceId === edit.pieceId)) return draft;
    placement = { pieceId: edit.pieceId, twist: 0 };
  } else {
    if (!old) return draft;
    placement = edit.type === "remove" ? null : { ...old, twist: (old.twist + 1) % 3 };
  }
  return draft.map((p, i) => i === index ? placement : p);
}

/** Display-only poses: this may contain fewer than eight corners or an invalid twist sum. */
export function draftCorners(draft: PuzzleDraft): readonly CornerState[] {
  return draft.flatMap((p, i) => p ? [{ pieceId: p.pieceId, slot: homeSlot(PIECE_IDS[i]!),
    orientation: cornerOrientation(p.pieceId, homeSlot(PIECE_IDS[i]!), p.twist) }] : []);
}

/** Drafts are internal typed data; the final exact-state validator is always the commit boundary. */
export function validateDraft(draft: PuzzleDraft) {
  if (draft.length !== 8 || draft.some(p => !p)) return { valid: false as const, error: { code: "corner-count" as const } };
  return validatePuzzleState({ corners: draftCorners(draft) });
}

/** Extents along the fixed world axes, not sorted size classes or camera coordinates. */
export function placementDimensions(piece: Piece, slot: PieceId, twist: number): Vector3 {
  const rotation = cornerOrientation(piece.id, homeSlot(slot), twist);
  const extent = (axis: keyof Vector3) => (["x", "y", "z"] as const)
    .reduce((sum, local) => sum + Math.abs(rotation[local][axis]) * piece.dimensions[local], 0);
  return { x: extent("x"), y: extent("y"), z: extent("z") };
}

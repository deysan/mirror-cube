import { describe, expect, it } from "vitest";
import { Box3, Vector3 as ThreeVector } from "three";
import { PIECE_IDS, cornerOrientation, homeSlot } from "./corners";
import { draftCorners, draftFromState, editDraft, emptyDraft, placementDimensions, validateDraft } from "./draft";
import { createSolvedCube, MIRRORED_CUBE_PARAMETERS, type PieceId } from "./model";
import { applyMove } from "./moves";
import { isCubeRotation, rotateState, transformVector } from "./orientation";
import { createSolvedState } from "./state";
import { createPieceMatrix } from "../rendering/pieceTransform";
import { decodeState } from "../solver/coordinates";
const cube = createSolvedCube(), solved = createSolvedState(cube);

describe("manual state drafts", () => {
  it("reproduces the owner's UFR lengths in a reachable mirrored-model state, not by reflecting a piece pose", () => {
    const mirrored = createSolvedCube(MIRRORED_CUBE_PARAMETERS);
    const state = applyMove(createSolvedState(mirrored), { face: "F", turns: 2 });
    const draft = draftFromState(state), placement = draft[PIECE_IDS.indexOf("+++")]!;
    expect(placement).toEqual({ pieceId: "--+", twist: 0 });
    expect(placementDimensions(mirrored.pieces.find(p => p.id === placement.pieceId)!, "+++", placement.twist))
      .toEqual({ x: 22, y: 20, z: 17 });
    expect(validateDraft(draft)).toEqual({ valid: true, state });
    expect(state.corners.every(c => isCubeRotation(c.orientation))).toBe(true);
    const oldSmallest = cube.pieces.find(p => p.id === "---")!;
    expect([0, 1, 2].map(t => placementDimensions(oldSmallest, "+++", t)))
      .not.toContainEqual({ x: 22, y: 20, z: 17 });
  });
  it("starts empty, refuses duplicates without moving other pieces, and preserves references on no-ops", () => {
    const empty = emptyDraft(); expect(empty).toEqual(Array(8).fill(null)); expect(draftCorners(empty)).toEqual([]);
    const draft = editDraft(empty, { type: "assign", slot: "+++", pieceId: "---" });
    expect(empty).toEqual(Array(8).fill(null)); expect(draft[7]).toEqual({ pieceId: "---", twist: 0 });
    for (const slot of PIECE_IDS) expect(editDraft(draft, { type: "assign", slot, pieceId: "---" })).toBe(draft);
    expect(editDraft(draft, { type: "assign", slot: "bad" as PieceId, pieceId: "+++" })).toBe(draft);
    expect(editDraft(draft, { type: "assign", slot: "+++", pieceId: "bad" as PieceId })).toBe(draft);
    expect(editDraft(draft, { type: "twist", slot: "---" })).toBe(draft);
    expect(validateDraft(draft)).toEqual({ valid: false, error: { code: "corner-count" } });
    expect(editDraft(draft, { type: "remove", slot: "+++" })).toEqual(empty);
  });
  it("provides exactly three proper poses for all 64 piece/position pairs with exact displayed extents", () => {
    for (const piece of cube.pieces) for (const slot of PIECE_IDS) {
      let draft = editDraft(emptyDraft(), { type: "assign", slot, pieceId: piece.id });
      const initial = draft, variants = new Set<string>();
      for (let i = 0; i < 3; i++) {
        const pose = draftCorners(draft)[0]!;
        variants.add(JSON.stringify(pose.orientation));
        expect(isCubeRotation(pose.orientation)).toBe(true);
        expect(transformVector(homeSlot(piece.id), pose.orientation)).toEqual(homeSlot(slot));
        const box = new Box3(new ThreeVector(-piece.dimensions.x/2,-piece.dimensions.y/2,-piece.dimensions.z/2),
          new ThreeVector(piece.dimensions.x/2,piece.dimensions.y/2,piece.dimensions.z/2)).applyMatrix4(createPieceMatrix(piece, pose.orientation));
        const size = box.getSize(new ThreeVector());
        expect(placementDimensions(piece, slot, i)).toEqual({ x: size.x, y: size.y, z: size.z });
        draft = editDraft(draft, { type: "twist", slot });
      }
      expect(variants.size).toBe(3); expect(draft).toEqual(initial);
    }
  });
  it("allows invalid twist drafts but does not repair or validate them until the user corrects them", () => {
    const source = draftFromState(solved), before = JSON.stringify(source);
    const bad = editDraft(source, { type: "twist", slot: "+++" });
    expect(validateDraft(bad)).toMatchObject({ valid: false, error: { code: "twist-sum" } });
    expect(JSON.stringify(source)).toBe(before);
    let balanced = editDraft(bad, { type: "twist", slot: "---" });
    balanced = editDraft(balanced, { type: "twist", slot: "---" });
    expect(validateDraft(balanced).valid).toBe(true);
  });
  it("copies and validates odd permutations and history-free states through all 24 whole-cube frames", () => {
    const state = applyMove(solved, { face: "R", turns: 1 });
    const frames = PIECE_IDS.flatMap(slot => [0,1,2].map(t => cornerOrientation("---", homeSlot(slot), t)));
    for (const frame of frames) {
      const expected = rotateState(state, frame), before = JSON.stringify(expected);
      const result = validateDraft(draftFromState(expected));
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.state).toEqual(expected); expect(result.state).not.toBe(expected);
        expect(result.state.corners[0]!.orientation).not.toBe(expected.corners[0]!.orientation);
      }
      expect(JSON.stringify(expected)).toBe(before);
    }
    for (let i = 0; i < 100; i++) {
      const expected = decodeState({ permutation: (i * 997) % 5040, twist: (i * 137) % 729 });
      expect(validateDraft(draftFromState(expected))).toEqual({ valid: true, state: expected });
    }
  });
  it("requires removing a used piece before reassignment; replacement frees the old identity", () => {
    let draft = editDraft(emptyDraft(), { type: "assign", slot: "+++", pieceId: "---" });
    draft = editDraft(draft, { type: "twist", slot: "+++" });
    draft = editDraft(draft, { type: "assign", slot: "+++", pieceId: "--+" });
    expect(draft[7]).toEqual({ pieceId: "--+", twist: 0 });
    draft = editDraft(draft, { type: "assign", slot: "---", pieceId: "---" });
    expect(draft.filter(Boolean)).toHaveLength(2);
  });
});

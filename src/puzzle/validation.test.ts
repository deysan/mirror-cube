import { describe, expect, it } from "vitest";
import { cornerOrientation, cornerTwist, homeSlot } from "./corners";
import { createSolvedCube } from "./model";
import { applyMove } from "./moves";
import { createSolvedState } from "./state";
import { validatePuzzleState, type StateErrorCode } from "./validation";

const initial = createSolvedState(createSolvedCube());
const moves = (["U", "D", "L", "R", "F", "B"] as const).flatMap((face) =>
  ([1, -1, 2] as const).map((turns) => ({ face, turns })),
);

function expectError(input: unknown, code: StateErrorCode, cornerIndex?: number) {
  expect(validatePuzzleState(input)).toEqual({
    valid: false, error: cornerIndex === undefined ? { code } : { code, cornerIndex },
  });
}

function withTwists(twists: readonly number[]) {
  return { corners: initial.corners.map((corner, index) => ({
    ...corner,
    orientation: cornerOrientation(corner.pieceId, corner.slot, twists[index] ?? 0),
  })) };
}

describe("plain-data puzzle validation", () => {
  it.each([null, undefined, true, 3, "{}", [], {}, { corners: null }])("rejects malformed root %#", (input) => {
    expectError(input, "structure");
  });

  it.each([0, 7, 9])("requires exactly eight corners, not %s", (count) => {
    expectError({ corners: Array(count).fill(initial.corners[0]) }, "corner-count");
  });

  it.each([null, undefined, [], 5])("rejects malformed corner %#", (corner) => {
    expectError({ corners: [corner, ...initial.corners.slice(1)] }, "structure", 0);
  });

  it.each([null, 0, "???", "---x", "--", "−--"])("rejects unknown identity %#", (pieceId) => {
    expectError({ corners: [{ ...initial.corners[0], pieceId }, ...initial.corners.slice(1)] }, "piece-id", 0);
  });

  it("rejects duplicate identities and duplicate occupied slots", () => {
    expectError({ corners: [initial.corners[0], initial.corners[0], ...initial.corners.slice(2)] }, "duplicate-piece", 1);
    expectError({ corners: [initial.corners[0], {
      ...initial.corners[1], slot: initial.corners[0]!.slot,
    }, ...initial.corners.slice(2)] }, "duplicate-slot", 1);
  });

  it.each([null, {}, [1, 1, 1], { x: 0, y: -1, z: -1 }, { x: "-1", y: -1, z: -1 },
    { x: -1 + Number.EPSILON, y: -1, z: -1 }, { x: NaN, y: -1, z: -1 }, { x: Infinity, y: -1, z: -1 },
  ])("rejects invalid slot %# without rounding", (slot) => {
    expectError({ corners: [{ ...initial.corners[0], slot }, ...initial.corners.slice(1)] }, "slot", 0);
  });

  it.each([null, {}, [], { x: null },
    { ...initial.corners[0]!.orientation, x: { x: -1, y: 0, z: 0 } }, // reflection
    { ...initial.corners[0]!.orientation, x: { x: 1 + Number.EPSILON, y: 0, z: 0 } },
    { ...initial.corners[0]!.orientation, y: { x: 1, y: 0, z: 0 } }, // repeated axis
    { ...initial.corners[0]!.orientation, z: { x: 0, y: 0, z: Infinity } },
  ])("rejects malformed or improper orientation %#", (orientation) => {
    expectError({ corners: [{ ...initial.corners[0], orientation }, ...initial.corners.slice(1)] }, "orientation", 0);
  });

  it("rejects a proper rotation inconsistent with the recorded slot", () => {
    const orientation = { x: { x: -1, y: 0, z: 0 }, y: { x: 0, y: -1, z: 0 }, z: { x: 0, y: 0, z: 1 } };
    expectError({ corners: [{ ...initial.corners[0], orientation }, ...initial.corners.slice(1)] }, "pose", 0);
  });

  it("rejects impossible twist sums but permits balanced twists", () => {
    expectError(withTwists([1]), "twist-sum");
    expectError(withTwists([2]), "twist-sum");
    expectError(withTwists([1, 1]), "twist-sum");
    expect(validatePuzzleState(withTwists([1, 2])).valid).toBe(true);
    expect(validatePuzzleState(withTwists([1, 1, 1])).valid).toBe(true);
  });

  it("accepts odd permutations instead of importing a 3×3 edge-parity constraint", () => {
    const swapped = { corners: initial.corners.map((corner, index) => {
      const slot = homeSlot(initial.corners[index < 2 ? 1 - index : index]!.pieceId);
      return { ...corner, slot, orientation: cornerOrientation(corner.pieceId, slot, 0) };
    }) };
    expect(validatePuzzleState(swapped).valid).toBe(true);
    expect(validatePuzzleState(applyMove(initial, { face: "R", turns: 1 })).valid).toBe(true);
  });

  it("matches explicit U/D-normal twist fixtures for quarter-turns", () => {
    expect(applyMove(initial, { face: "R", turns: 1 }).corners.map(cornerTwist)).toEqual([0, 0, 0, 0, 1, 2, 2, 1]);
    expect(applyMove(initial, { face: "F", turns: 1 }).corners.map(cornerTwist)).toEqual([0, 2, 0, 1, 0, 1, 0, 2]);
    expect(applyMove(initial, { face: "U", turns: 1 }).corners.map(cornerTwist)).toEqual(Array(8).fill(0));
  });

  it("accepts all faces/angles and a long mixed walk without history", () => {
    let state = initial;
    for (const move of moves) expect(validatePuzzleState(applyMove(initial, move)).valid).toBe(true);
    for (let index = 0; index < 1000; index++) {
      state = applyMove(state, moves[(index * 7 + Math.floor(index / 5)) % moves.length]!);
      const result = validatePuzzleState(JSON.parse(JSON.stringify(state)));
      expect(result.valid).toBe(true);
      if (result.valid) expect(result.state).toEqual(state);
    }
  });

  it("returns a clean independent canonical snapshot, strips extras, and normalizes negative zero", () => {
    const input = {
      corners: [...structuredClone(initial).corners].reverse().map((corner) => ({
        ...corner, orientation: { ...corner.orientation, x: { ...corner.orientation.x, y: -0 } },
      })),
      history: ["not used"],
    };
    const before = JSON.stringify(input);
    const result = validatePuzzleState(input);
    expect(result.valid).toBe(true);
    if (!result.valid) return;
    expect(result.state).toEqual(initial);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.is(input.corners[0]!.orientation.x.y, -0)).toBe(true);
    expect(Object.is(result.state.corners[7]!.orientation.x.y, -0)).toBe(false);
    expect(result.state.corners[7]).not.toBe(input.corners[0]);
    expect(result.state.corners[7]!.slot).not.toBe(input.corners[0]!.slot);
    expect(result.state.corners[7]!.orientation.x).not.toBe(input.corners[0]!.orientation.x);
  });
});

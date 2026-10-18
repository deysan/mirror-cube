import { describe, expect, it } from "vitest";
import { createSolvedCube, type PieceId, type Vector3 } from "./model";
import { applyMove, inverseMove, type Move } from "./moves";
import { isSolved } from "./solved";
import { createSolvedState, type Orientation, type PuzzleState } from "./state";

const initial = createSolvedState(createSolvedCube());
const moves = (["U", "D", "L", "R", "F", "B"] as const).flatMap((face) =>
  ([1, -1, 2] as const).map((turns) => ({ face, turns })),
);

// Independent fixture enumeration: permutation parity times column signs is the determinant.
const signedFrames = [
  [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
].flatMap((permutation) => {
  const inversions = permutation.reduce((sum, value, i) =>
    sum + permutation.slice(i + 1).filter((other) => value > other).length, 0);
  const frames: { orientation: Orientation; determinant: number }[] = [];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
    const columns = [sx, sy, sz].map((sign, index) => ({
      x: permutation[index] === 0 ? sign : 0,
      y: permutation[index] === 1 ? sign : 0,
      z: permutation[index] === 2 ? sign : 0,
    }));
    frames.push({
      orientation: { x: columns[0]!, y: columns[1]!, z: columns[2]! },
      determinant: (-1) ** inversions * sx * sy * sz,
    });
  }
  return frames;
});
const rotations = signedFrames.filter(({ determinant }) => determinant === 1).map(({ orientation }) => orientation);

function transform(vector: Vector3, rotation: Orientation): Vector3 {
  const coordinate = (axis: keyof Vector3) =>
    rotation.x[axis] * vector.x + rotation.y[axis] * vector.y + rotation.z[axis] * vector.z;
  return { x: coordinate("x"), y: coordinate("y"), z: coordinate("z") };
}

function rotateWhole(state: PuzzleState, rotation: Orientation): PuzzleState {
  return {
    corners: state.corners.map((corner) => ({
      pieceId: corner.pieceId,
      slot: transform(corner.slot, rotation),
      orientation: {
        x: transform(corner.orientation.x, rotation),
        y: transform(corner.orientation.y, rotation),
        z: transform(corner.orientation.z, rotation),
      },
    })),
  };
}

function replaceFirst(changes: Partial<PuzzleState["corners"][number]>): PuzzleState {
  return { corners: [{ ...initial.corners[0]!, ...changes }, ...initial.corners.slice(1)] };
}

describe("exact solvedness", () => {
  it("has exactly 24 distinct proper whole-cube rotations in the independent fixtures", () => {
    expect(rotations).toHaveLength(24);
    expect(new Set(rotations.map((rotation) => JSON.stringify(rotateWhole(initial, rotation)))).size).toBe(24);
  });

  it.each(signedFrames)("accepts only proper global frames (fixture %#, determinant $determinant)", ({ orientation, determinant }) => {
    const state = rotateWhole(initial, orientation);
    expect(isSolved(state)).toBe(determinant === 1);
    // No array-order, object-identity, or history dependency.
    expect(isSolved({ corners: [...state.corners].reverse() })).toBe(determinant === 1);
    expect(isSolved(JSON.parse(JSON.stringify(state)) as PuzzleState)).toBe(determinant === 1);
  });

  it.each(moves)("rejects $face ($turns) and accepts its inverse in every global frame", (move) => {
    for (const rotation of rotations) {
      const solved = rotateWhole(initial, rotation);
      const turned = applyMove(solved, move);
      expect(isSolved(turned)).toBe(false);
      expect(isSolved(applyMove(turned, inverseMove(move)))).toBe(true);
    }
  });

  it.each([
    [{ face: "R", turns: 1 }, { face: "L", turns: -1 }],
    [{ face: "U", turns: 1 }, { face: "D", turns: -1 }],
    [{ face: "F", turns: 1 }, { face: "B", turns: -1 }],
  ] satisfies Move[][])("accepts whole-cube rotations composed from opposite face turns (%#)", (...sequence) => {
    expect(isSolved(sequence.reduce(applyMove, initial))).toBe(true);
  });

  it("rejects rotated slots without orientations, and rotated orientations without slots", () => {
    for (const rotation of rotations) {
      const state = rotateWhole(initial, rotation);
      if (JSON.stringify(state) === JSON.stringify(initial)) continue;
      expect(isSolved({ corners: state.corners.map((corner, index) => ({
        ...corner, orientation: initial.corners[index]!.orientation,
      })) })).toBe(false);
      expect(isSolved({ corners: state.corners.map((corner, index) => ({
        ...corner, slot: initial.corners[index]!.slot,
      })) })).toBe(false);
    }
  });

  it("rejects a single corner twist with all identities still in their home slots", () => {
    // A 120-degree rotation about the --- / +++ diagonal keeps that corner's slot.
    const twist: Orientation = {
      x: { x: 0, y: 1, z: 0 }, y: { x: 0, y: 0, z: 1 }, z: { x: 1, y: 0, z: 0 },
    };
    expect(transform(initial.corners[0]!.slot, twist)).toEqual(initial.corners[0]!.slot);
    expect(isSolved(replaceFirst({ orientation: twist }))).toBe(false);
  });

  it("requires exactly eight distinct known identities at their rotated home slots", () => {
    expect(isSolved({ corners: [] })).toBe(false);
    expect(isSolved({ corners: initial.corners.slice(1) })).toBe(false);
    expect(isSolved({ corners: [...initial.corners, initial.corners[0]!] })).toBe(false);
    expect(isSolved(replaceFirst({ pieceId: initial.corners[1]!.pieceId }))).toBe(false);
    expect(isSolved(replaceFirst({ pieceId: "???" as PieceId }))).toBe(false);
    expect(isSolved(replaceFirst({ slot: initial.corners[1]!.slot }))).toBe(false);
    expect(isSolved({ corners: initial.corners.map((corner, index) => ({
      ...corner,
      pieceId: index === 0 ? initial.corners[1]!.pieceId : index === 1 ? initial.corners[0]!.pieceId : corner.pieceId,
    })) })).toBe(false);
  });

  it.each([0, 2, 1 + Number.EPSILON, NaN, Infinity])("rejects non-rotation common orientations (x.x = %s)", (value) => {
    const invalid = { ...initial.corners[0]!.orientation, x: { x: value, y: 0, z: 0 } };
    expect(isSolved(rotateWhole(initial, invalid))).toBe(false);
  });

  it("rejects repeated basis axes and non-exact slots", () => {
    const identity = initial.corners[0]!.orientation;
    expect(isSolved(rotateWhole(initial, { ...identity, y: identity.x }))).toBe(false);
    expect(isSolved(replaceFirst({ slot: { x: -1 + Number.EPSILON, y: -1, z: -1 } }))).toBe(false);
  });

  it("matches the explicit 24-goal oracle through a mixed legal walk", () => {
    const goals = new Set(rotations.map((rotation) => JSON.stringify(rotateWhole(initial, rotation))));
    let state = initial;
    for (let index = 0; index < 300; index++) {
      state = applyMove(state, moves[(index * 7 + Math.floor(index / 5)) % moves.length]!);
      expect(isSolved(state)).toBe(goals.has(JSON.stringify(state)));
    }
  });

  it("does not equate close piece sizes or require the default dimensions", () => {
    const cube = createSolvedCube({ edgeLength: 59, splits: { x: 29, y: 28, z: 27 } });
    const state = createSolvedState(cube);
    expect(cube.pieces.find(({ id }) => id === "---")!.dimensions.x).toBe(29);
    expect(cube.pieces.find(({ id }) => id === "+--")!.dimensions.x).toBe(30);
    for (const rotation of rotations) {
      const solved = rotateWhole(state, rotation);
      expect(isSolved(solved)).toBe(true);
      expect(isSolved(applyMove(solved, { face: "R", turns: 1 }))).toBe(false);
    }
  });

  it("does not mutate frozen input", () => {
    const state = createSolvedState(createSolvedCube());
    for (const corner of state.corners) {
      Object.values(corner.orientation).forEach(Object.freeze);
      Object.freeze(corner.orientation);
      Object.freeze(corner.slot);
      Object.freeze(corner);
    }
    Object.freeze(state.corners);
    Object.freeze(state);
    const before = JSON.stringify(state);
    expect(isSolved(state)).toBe(true);
    expect(JSON.stringify(state)).toBe(before);
  });
});

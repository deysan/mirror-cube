import { describe, expect, it } from "vitest";
import { createSolvedCube, type PieceId, type Vector3 } from "./model";
import { applyMove, inverseMove, type Face, type Move } from "./moves";
import { createSolvedState, type Orientation, type PuzzleState } from "./state";

const FACES = ["U", "D", "L", "R", "F", "B"] as const;
const AXES = ["x", "y", "z"] as const;
const MOVES = FACES.flatMap((face) =>
  ([1, -1, 2] as const).map((turns) => ({ face, turns })),
);
const SEQUENCE: readonly Move[] = [
  { face: "R", turns: 1 }, { face: "U", turns: -1 },
  { face: "F", turns: 2 }, { face: "L", turns: 1 },
  { face: "D", turns: 2 }, { face: "B", turns: -1 },
  { face: "R", turns: -1 }, { face: "F", turns: 1 },
];
const cube = createSolvedCube();
const solved = createSolvedState(cube);
const mixed = SEQUENCE.reduce(applyMove, solved);

function transform(orientation: Orientation, point: Vector3): Vector3 {
  return {
    x: orientation.x.x * point.x + orientation.y.x * point.y + orientation.z.x * point.z,
    y: orientation.x.y * point.x + orientation.y.y * point.y + orientation.z.y * point.z,
    z: orientation.x.z * point.x + orientation.y.z * point.y + orientation.z.z * point.z,
  };
}

function dot(a: Vector3, b: Vector3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function freezeState(state: PuzzleState): void {
  for (const corner of state.corners) {
    Object.freeze(corner.slot);
    for (const axis of AXES) Object.freeze(corner.orientation[axis]);
    Object.freeze(corner.orientation);
    Object.freeze(corner);
  }
  Object.freeze(state.corners);
  Object.freeze(state);
}

describe("solved discrete state", () => {
  it("keeps each piece's identity, assigns all eight slots, and starts with aligned axes", () => {
    expect(solved.corners.map(({ pieceId }) => pieceId)).toEqual(cube.pieces.map(({ id }) => id));
    expect(solved.corners.map(({ slot }) => slot)).toEqual([
      { x: -1, y: -1, z: -1 }, { x: -1, y: -1, z: 1 },
      { x: -1, y: 1, z: -1 }, { x: -1, y: 1, z: 1 },
      { x: 1, y: -1, z: -1 }, { x: 1, y: -1, z: 1 },
      { x: 1, y: 1, z: -1 }, { x: 1, y: 1, z: 1 },
    ]);
    for (const corner of solved.corners) {
      expect(corner.orientation).toEqual({
        x: { x: 1, y: 0, z: 0 },
        y: { x: 0, y: 1, z: 0 },
        z: { x: 0, y: 0, z: 1 },
      });
    }
  });
});

// Independent expected rotations establish the outside-looking-in convention.
const clockwiseCases = [
  { face: "R", id: "+++", slot: { x: 1, y: 1, z: -1 }, axes: [[1, 0, 0], [0, 0, -1], [0, 1, 0]] },
  { face: "L", id: "---", slot: { x: -1, y: 1, z: -1 }, axes: [[1, 0, 0], [0, 0, 1], [0, -1, 0]] },
  { face: "U", id: "+++", slot: { x: -1, y: 1, z: 1 }, axes: [[0, 0, 1], [0, 1, 0], [-1, 0, 0]] },
  { face: "D", id: "---", slot: { x: -1, y: -1, z: 1 }, axes: [[0, 0, -1], [0, 1, 0], [1, 0, 0]] },
  { face: "F", id: "+++", slot: { x: 1, y: -1, z: 1 }, axes: [[0, -1, 0], [1, 0, 0], [0, 0, 1]] },
  { face: "B", id: "---", slot: { x: 1, y: -1, z: -1 }, axes: [[0, 1, 0], [-1, 0, 0], [0, 0, 1]] },
] satisfies { face: Face; id: PieceId; slot: Vector3; axes: number[][] }[];

it.each(clockwiseCases)("$face clockwise has the expected position and orientation", ({ face, id, slot, axes }) => {
  const state = applyMove(solved, { face, turns: 1 });
  const corner = state.corners.find(({ pieceId }) => pieceId === id)!;

  expect(corner.slot).toEqual(slot);
  expect(AXES.map((axis) => Object.values(corner.orientation[axis]))).toEqual(axes);
});

describe.each([
  { name: "solved state", state: solved },
  { name: "mixed state", state: mixed },
])("moves from $name", ({ state }) => {
  it.each(MOVES)("$face ($turns) followed by its inverse restores the exact state", (move) => {
    expect(applyMove(applyMove(state, move), inverseMove(move))).toEqual(state);
    expect(inverseMove(inverseMove(move))).toEqual(move);
  });

  it.each(FACES)("four quarter-turns in either direction on %s restore state", (face) => {
    for (const turns of [1, -1] as const) {
      let result = state;
      for (let count = 0; count < 4; count += 1) result = applyMove(result, { face, turns });
      expect(result).toEqual(state);
    }
  });

  it.each(FACES)("a %s half-turn equals two quarter-turns and is its own inverse", (face) => {
    const half = applyMove(state, { face, turns: 2 });
    expect(half).toEqual(applyMove(applyMove(state, { face, turns: 1 }), { face, turns: 1 }));
    expect(half).toEqual(applyMove(applyMove(state, { face, turns: -1 }), { face, turns: -1 }));
    expect(applyMove(half, { face, turns: 2 })).toEqual(state);
  });

  it.each(MOVES)("$face ($turns) moves exactly the four corners currently in its layer", (move) => {
    // Do not use the implementation's face lookup as the expected result.
    const layer: Record<Face, readonly [keyof Vector3, number]> = {
      R: ["x", 1], L: ["x", -1], U: ["y", 1], D: ["y", -1], F: ["z", 1], B: ["z", -1],
    };
    const [axis, side] = layer[move.face];
    const result = applyMove(state, move);
    let changed = 0;

    for (const [index, before] of state.corners.entries()) {
      const after = result.corners[index]!;
      expect(after.pieceId).toBe(before.pieceId);
      if (before.slot[axis] === side) {
        changed += 1;
        expect(after).not.toEqual(before);
        expect(after.slot[axis]).toBe(side);
      } else {
        expect(after).toBe(before);
      }
    }
    expect(changed).toBe(4);
  });
});

it("reversing a mixed sequence restores every corner, not just the silhouette", () => {
  const restored = [...SEQUENCE].reverse().map(inverseMove).reduce(applyMove, mixed);
  expect(mixed).not.toEqual(solved);
  expect(restored).toEqual(solved);
});

it("leaves frozen input states and piece definitions unchanged", () => {
  const definition = createSolvedCube();
  for (const piece of definition.pieces) {
    Object.freeze(piece.dimensions);
    Object.freeze(piece.solvedMin);
    Object.freeze(piece);
  }
  Object.freeze(definition.splits);
  Object.freeze(definition.pieces);
  Object.freeze(definition);
  const original = createSolvedState(definition);
  const originalSnapshot = JSON.stringify(original);
  const definitionSnapshot = JSON.stringify(definition);
  freezeState(original);
  let state = original;

  for (const move of SEQUENCE) {
    state = applyMove(state, move);
    freezeState(state);
  }

  expect(JSON.stringify(original)).toBe(originalSnapshot);
  expect(JSON.stringify(definition)).toBe(definitionSnapshot);
  expect([...SEQUENCE].reverse().map(inverseMove).reduce(applyMove, state)).toEqual(original);
});

it("keeps unique slots, proper orientations, and exact dimensions through 300 moves", () => {
  let state = solved;
  let seed = 12345;

  for (let step = 0; step < 300; step += 1) {
    // Deterministic coverage without adding a production scramble feature.
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    state = applyMove(state, MOVES[seed % MOVES.length]!);

    expect(new Set(state.corners.map(({ pieceId }) => pieceId)).size).toBe(8);
    expect(new Set(state.corners.map(({ slot }) => JSON.stringify(slot))).size).toBe(8);

    for (const corner of state.corners) {
      const { x, y, z } = corner.orientation;
      const home = solved.corners.find(({ pieceId }) => pieceId === corner.pieceId)!;
      const piece = cube.pieces.find(({ id }) => id === corner.pieceId)!;

      // A pose must map the home octant to the current slot, not merely permute IDs.
      expect(transform(corner.orientation, home.slot)).toEqual(corner.slot);
      for (const axis of AXES) {
        expect([-1, 1]).toContain(corner.slot[axis]);
        const basis = corner.orientation[axis];
        expect(dot(basis, basis)).toBe(1);
        for (const value of Object.values(basis)) {
          expect([-1, 0, 1]).toContain(value);
          expect(Object.is(value, -0)).toBe(false);
        }

        // A local edge is rotated, never rescaled, including each distinct axis length.
        const length = piece.dimensions[axis];
        const edge = transform(corner.orientation, {
          x: axis === "x" ? length : 0,
          y: axis === "y" ? length : 0,
          z: axis === "z" ? length : 0,
        });
        expect(dot(edge, edge)).toBe(length ** 2);
      }
      expect(dot(x, y)).toBe(0);
      expect(dot(y, z)).toBe(0);
      expect(dot(z, x)).toBe(0);
      // For orthonormal axes, (x cross y) dot z = +1 rules out reflections.
      const cross = {
        x: x.y * y.z - x.z * y.y,
        y: x.z * y.x - x.x * y.z,
        z: x.x * y.y - x.y * y.x,
      };
      expect(dot(cross, z)).toBe(1);
    }
  }
});

it("rotates actual piece geometry around the split intersection, not a uniform slot center", () => {
  const after = applyMove(solved, { face: "F", turns: 1 });
  const corner = after.corners.find(({ pieceId }) => pieceId === "+++")!;
  const piece = cube.pieces.find(({ id }) => id === "+++")!;

  // This piece starts in [0,28] x [0,30] x [0,33]. F maps (x,y,z) to (y,-x,z).
  expect(piece.dimensions).toEqual({ x: 28, y: 30, z: 33 });
  expect(transform(corner.orientation, { x: 28, y: 30, z: 33 }))
    .toEqual({ x: 30, y: -28, z: 33 });
  expect(transform(corner.orientation, { x: 14, y: 15, z: 16.5 }))
    .toEqual({ x: 15, y: -14, z: 16.5 });
  expect(corner.slot).toEqual({ x: 1, y: -1, z: 1 });
});

it("keeps one-millimeter differences distinct after changing orientation", () => {
  const definition = createSolvedCube({ edgeLength: 59, splits: { x: 20, y: 24, z: 29 } });
  const state = applyMove(createSolvedState(definition), { face: "L", turns: 1 });
  const small = state.corners.find(({ pieceId }) => pieceId === "---")!;
  const large = state.corners.find(({ pieceId }) => pieceId === "--+")!;

  const smallDepth = definition.pieces.find(({ id }) => id === small.pieceId)!.dimensions.z;
  const largeDepth = definition.pieces.find(({ id }) => id === large.pieceId)!.dimensions.z;
  expect(transform(small.orientation, { x: 0, y: 0, z: smallDepth }))
    .toEqual({ x: 0, y: -29, z: 0 });
  expect(transform(large.orientation, { x: 0, y: 0, z: largeDepth }))
    .toEqual({ x: 0, y: -30, z: 0 });
});

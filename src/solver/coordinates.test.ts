import { describe, expect, it } from "vitest";
import { cornerOrientation, cornerTwist, homeSlot, PIECE_IDS } from "../puzzle/corners";
import { createSolvedCube } from "../puzzle/model";
import { applyMove, type Move } from "../puzzle/moves";
import { equalVector, inverseRotation, isCubeRotation, rotateState, transformVector } from "../puzzle/orientation";
import { isSolved } from "../puzzle/solved";
import { createSolvedState, type Orientation, type PuzzleState } from "../puzzle/state";
import { validatePuzzleState } from "../puzzle/validation";
import { decodeState, encodeState, mapMoveFromFrame, PERMUTATION_COUNT, TWIST_COUNT } from "./coordinates";

const initial = createSolvedState(createSolvedCube());
const moves = (["U", "D", "L", "R", "F", "B"] as const).flatMap((face) =>
  ([1, -1, 2] as const).map((turns) => ({ face, turns })),
);
const mixed = ([{ face: "R", turns: 1 }, { face: "U", turns: -1 }, { face: "B", turns: 2 },
  { face: "L", turns: 1 }, { face: "D", turns: -1 }, { face: "F", turns: 1 }] satisfies Move[]).reduce(applyMove, initial);

// Generate global frames through the already tested face-turn engine, not the new rotation helpers.
const wholeStates = [initial];
const seenFrames = new Set([JSON.stringify(initial.corners[0]!.orientation)]);
for (const state of wholeStates) {
  for (const [a, b] of [["R", "L"], ["U", "D"]] as const) {
    const next = applyMove(applyMove(state, { face: a, turns: 1 }), { face: b, turns: -1 });
    const key = JSON.stringify(next.corners[0]!.orientation);
    if (!seenFrames.has(key)) { seenFrames.add(key); wholeStates.push(next); }
  }
}
const frames = wholeStates.map((state) => state.corners[0]!.orientation);

function encoded(input: unknown) {
  const result = encodeState(input);
  if (!result.valid) throw new Error(JSON.stringify(result.error));
  return result;
}

function canonical(state: PuzzleState) {
  return { corners: PIECE_IDS.map((id) => state.corners.find((corner) => corner.pieceId === id)!) };
}

describe("corner coordinates and global frames", () => {
  it("normalizes all 24 solved frames to zero coordinates and restores each exact pose", () => {
    expect(frames).toHaveLength(24);
    for (const state of wholeStates) {
      const result = encoded(state);
      expect(result.coordinates).toEqual({ permutation: 0, twist: 0 });
      expect(result.frame).toEqual(state.corners[0]!.orientation);
      expect(decodeState(result.coordinates)).toEqual(initial);
      expect(decodeState(result.coordinates, result.frame)).toEqual(state);
    }
  });

  it("enumerates exactly three proper corner poses for every piece/slot pair", () => {
    for (const pieceId of PIECE_IDS) for (const slotId of PIECE_IDS) {
      const slot = homeSlot(slotId);
      const candidates = frames.filter((rotation) => equalVector(transformVector(homeSlot(pieceId), rotation), slot));
      expect(candidates).toHaveLength(3);
      const twists = new Set<number>();
      for (const orientation of candidates) {
        const twist = cornerTwist({ pieceId, slot, orientation });
        twists.add(twist);
        const rebuilt = cornerOrientation(pieceId, slot, twist);
        expect(rebuilt).toEqual(orientation);
        expect(isCubeRotation(rebuilt)).toBe(true);
      }
      expect([...twists].sort()).toEqual([0, 1, 2]);
    }
  });

  it("assigns the same coordinates to every global rotation of a mixed state", () => {
    const expected = encoded(mixed).coordinates;
    for (const frame of frames) {
      const rotated = rotateState(mixed, frame);
      const result = encoded({ corners: [...rotated.corners].reverse() });
      expect(result.coordinates).toEqual(expected);
      const normalized = decodeState(result.coordinates);
      expect(normalized.corners[0]).toEqual(initial.corners[0]);
      expect(decodeState(result.coordinates, result.frame)).toEqual(rotated);
      expect(rotateState(rotated, inverseRotation(frame))).toEqual(mixed);
    }
  });

  it("uses lexicographic permutation ranks and big-endian base-3 twist digits", () => {
    const atSlots = (state: PuzzleState) => PIECE_IDS.map((slotId) =>
      state.corners.find(({ slot }) => equalVector(slot, homeSlot(slotId)))!.pieceId,
    );
    expect(atSlots(decodeState({ permutation: 1, twist: 0 }))).toEqual([
      "---", "--+", "-+-", "-++", "+--", "+-+", "+++", "++-",
    ]);
    expect(atSlots(decodeState({ permutation: 5039, twist: 0 }))).toEqual([
      "---", "+++", "++-", "+-+", "+--", "-++", "-+-", "--+",
    ]);
    expect(decodeState({ permutation: 0, twist: 1 }).corners.map(cornerTwist)).toEqual([0, 0, 0, 0, 0, 0, 1, 2]);
    expect(decodeState({ permutation: 0, twist: 728 }).corners.map(cornerTwist)).toEqual([0, 2, 2, 2, 2, 2, 2, 0]);
  });

  it("round-trips all 5,040 permutations with varying twists and no collisions", () => {
    const permutations = new Set<string>();
    for (let permutation = 0; permutation < PERMUTATION_COUNT; permutation++) {
      const coordinates = { permutation, twist: permutation * 73 % TWIST_COUNT };
      const state = decodeState(coordinates);
      expect(validatePuzzleState(state).valid).toBe(true);
      expect(encoded(state).coordinates).toEqual(coordinates);
      expect(isSolved(state)).toBe(permutation === 0);
      permutations.add(JSON.stringify(state.corners.map(({ slot }) => slot)));
    }
    expect(permutations.size).toBe(PERMUTATION_COUNT);
  });

  it("round-trips all 729 twists at identity, odd, and last permutation ranks", () => {
    for (const permutation of [0, 1, PERMUTATION_COUNT - 1]) {
      const orientations = new Set<string>();
      for (let twist = 0; twist < TWIST_COUNT; twist++) {
        const coordinates = { permutation, twist };
        const state = decodeState(coordinates);
        expect(validatePuzzleState(state).valid).toBe(true);
        expect(encoded(state).coordinates).toEqual(coordinates);
        expect(isSolved(state)).toBe(permutation === 0 && twist === 0);
        expect(state.corners.reduce((sum, corner) => sum + cornerTwist(corner), 0) % 3).toBe(0);
        orientations.add(JSON.stringify(state.corners.map(({ orientation }) => orientation)));
      }
      expect(orientations.size).toBe(TWIST_COUNT);
    }
  });

  it("round-trips a long history-free legal walk and its exact orientations", () => {
    let state = initial;
    for (let index = 0; index < 1000; index++) {
      state = applyMove(state, moves[(index * 11 + Math.floor(index / 7)) % moves.length]!);
      const result = encoded(JSON.parse(JSON.stringify(state)));
      expect(decodeState(result.coordinates, result.frame)).toEqual(state);
    }
  });

  it.each(moves)("maps $face ($turns) back to every input frame consistently with applyMove", (move) => {
    for (const frame of frames) {
      const world = rotateState(mixed, frame);
      const mapped = mapMoveFromFrame(move, frame);
      expect(mapped.turns).toBe(move.turns);
      expect(applyMove(world, mapped)).toEqual(rotateState(applyMove(mixed, move), frame));
      expect(mapMoveFromFrame(mapped, inverseRotation(frame))).toEqual(move);
    }
  });

  it("keeps the reference frame fixed through normalized R/U/F moves", () => {
    for (const frame of frames) {
      const world = rotateState(mixed, frame);
      const result = encoded(world);
      const normalized = decodeState(result.coordinates);
      for (const move of moves.filter(({ face }) => ["R", "U", "F"].includes(face))) {
        const nextWorld = applyMove(world, mapMoveFromFrame(move, result.frame));
        const next = encoded(nextWorld);
        expect(next.frame).toEqual(result.frame);
        expect(decodeState(next.coordinates)).toEqual(applyMove(normalized, move));
      }
    }
  });

  it("maps named faces into negative world axes without reversing the outside-view angle", () => {
    const frame: Orientation = { x: { x: 0, y: 1, z: 0 }, y: { x: -1, y: 0, z: 0 }, z: { x: 0, y: 0, z: 1 } };
    expect(mapMoveFromFrame({ face: "R", turns: 1 }, frame)).toEqual({ face: "U", turns: 1 });
    expect(mapMoveFromFrame({ face: "U", turns: -1 }, frame)).toEqual({ face: "L", turns: -1 });
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])("rejects invalid coordinate value %s", (value) => {
    expect(() => decodeState({ permutation: value, twist: 0 })).toThrow(RangeError);
    expect(() => decodeState({ permutation: 0, twist: value })).toThrow(RangeError);
  });

  it("rejects exclusive range endpoints and reflected frames", () => {
    expect(() => decodeState({ permutation: PERMUTATION_COUNT, twist: 0 })).toThrow(RangeError);
    expect(() => decodeState({ permutation: 0, twist: TWIST_COUNT })).toThrow(RangeError);
    const frame = { ...initial.corners[0]!.orientation, x: { x: -1, y: 0, z: 0 } };
    expect(() => decodeState({ permutation: 0, twist: 0 }, frame)).toThrow(RangeError);
    expect(() => mapMoveFromFrame({ face: "R", turns: 1 }, frame)).toThrow(RangeError);
  });

  it("returns validation errors instead of encoding malformed or impossible states", () => {
    expect(encodeState(null)).toEqual({ valid: false, error: { code: "structure" } });
    const impossible = { corners: initial.corners.map((corner, index) => ({
      ...corner, orientation: cornerOrientation(corner.pieceId, corner.slot, index === 0 ? 1 : 0),
    })) };
    for (const frame of frames) {
      expect(encodeState(rotateState(impossible, frame))).toEqual({ valid: false, error: { code: "twist-sum" } });
    }
  });

  it("does not mutate frozen input or reuse its nested data, and keeps close dimensions separate", () => {
    const cube = createSolvedCube({ edgeLength: 59, splits: { x: 29, y: 28, z: 27 } });
    const state = applyMove(createSolvedState(cube), { face: "D", turns: -1 });
    for (const corner of state.corners) {
      Object.values(corner.orientation).forEach(Object.freeze);
      Object.freeze(corner.orientation); Object.freeze(corner.slot); Object.freeze(corner);
    }
    Object.freeze(state.corners); Object.freeze(state);
    const before = JSON.stringify(state);
    const result = encoded(state);
    Object.freeze(result.coordinates);
    const restored = decodeState(result.coordinates, result.frame);
    expect(restored).toEqual(canonical(state));
    expect(JSON.stringify(state)).toBe(before);
    expect(result.frame).not.toBe(state.corners[0]!.orientation);
    expect(restored.corners[0]!.orientation).not.toBe(result.frame);
    expect(cube.pieces[0]!.dimensions.x).toBe(29);
    expect(cube.pieces[4]!.dimensions.x).toBe(30);
  });
});

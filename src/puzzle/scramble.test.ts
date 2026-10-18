import { describe, expect, it, vi } from "vitest";
import { createSolvedCube } from "./model";
import { applyMove, FACE_LAYERS, inverseMove } from "./moves";
import { createSolvedState } from "./state";
import { createScramble, SCRAMBLE_LENGTH } from "./scramble";

function seededRandom(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe("scramble generator", () => {
  it("generates fixed-length, reproducible sequences with independent move objects", () => {
    const first = createScramble(seededRandom(42));
    const second = createScramble(seededRandom(42));
    expect(first).toHaveLength(SCRAMBLE_LENGTH);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    expect(second[0]).not.toBe(first[0]);
  });

  it.each([0, 1 - Number.EPSILON])("terminates for a constant RNG at %s without retry loops", (sample) => {
    const random = vi.fn(() => sample);
    const moves = createScramble(random);
    expect(random).toHaveBeenCalledTimes(SCRAMBLE_LENGTH * 2);
    expect(moves).toHaveLength(SCRAMBLE_LENGTH);
    for (const [index, move] of moves.entries()) {
      expect(FACE_LAYERS[move.face]).toBeDefined();
      expect([1, -1, 2]).toContain(move.turns);
      if (index) expect(FACE_LAYERS[move.face].axis).not.toBe(FACE_LAYERS[moves[index - 1]!.face].axis);
    }
  });

  it.each([-1, 1, NaN, Infinity, -Infinity])("rejects invalid RNG sample %s", (sample) => {
    expect(() => createScramble(() => sample)).toThrow(RangeError);
  });

  it("covers every face/angle, changes axes, and produces exactly reversible legal walks", () => {
    const initial = createSolvedState(createSolvedCube());
    const seen = new Set<string>();
    for (let seed = 0; seed < 100; seed++) {
      const moves = createScramble(seededRandom(seed));
      for (const [index, move] of moves.entries()) {
        seen.add(`${move.face}:${move.turns}`);
        if (index) expect(FACE_LAYERS[move.face].axis).not.toBe(FACE_LAYERS[moves[index - 1]!.face].axis);
      }
      const scrambled = moves.reduce(applyMove, initial);
      const restored = [...moves].reverse().map(inverseMove).reduce(applyMove, scrambled);
      expect(restored).toEqual(initial);
    }
    expect(seen.size).toBe(18);
  });
});

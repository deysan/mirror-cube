import { beforeAll, describe, expect, it } from "vitest";
import { createSolvedCube } from "../puzzle/model";
import { applyMove, inverseMove } from "../puzzle/moves";
import { isSolved } from "../puzzle/solved";
import { createSolvedState, type PuzzleState } from "../puzzle/state";
import { decodeState, encodeState, PERMUTATION_COUNT, TWIST_COUNT } from "./coordinates";
import { applyTableMove, createSolverTables, estimateRemainingMoves, SOLVER_MOVES, type SolverTables } from "./tables";

let tables: SolverTables;
beforeAll(() => { tables = createSolverTables(); }, 20_000);
const initial = createSolvedState(createSolvedCube());

function coordinates(state: PuzzleState) {
  const result = encodeState(state);
  if (!result.valid) throw new Error(JSON.stringify(result.error));
  return result.coordinates;
}

const factors = [
  { name: "permutation", count: PERMUTATION_COUNT, transitions: "permutationTransitions", distances: "permutationDistances" },
  { name: "twist", count: TWIST_COUNT, transitions: "twistTransitions", distances: "twistDistances" },
] as const;

describe("solver transition and distance tables", () => {
  it("uses a fixed move order, compact buffers, and one-move cost for all angles", () => {
    expect(SOLVER_MOVES).toEqual((["R", "U", "F"] as const).flatMap((face) =>
      ([1, -1, 2] as const).map((turns) => ({ face, turns })),
    ));
    for (const factor of factors) {
      expect(tables[factor.transitions]).toBeInstanceOf(Uint16Array);
      expect(tables[factor.transitions]).toHaveLength(factor.count * 9);
      expect(tables[factor.distances]).toBeInstanceOf(Uint8Array);
      expect(tables[factor.distances]).toHaveLength(factor.count);
    }
    expect(Object.values(tables).reduce((sum, array) => sum + array.byteLength, 0)).toBe(109611);
    for (let index = 0; index < SOLVER_MOVES.length; index++) {
      const next = applyTableMove(tables, { permutation: 0, twist: 0 }, index);
      expect(estimateRemainingMoves(tables, next)).toBe(1);
    }
  });

  it.each(factors)("has valid, reversible $name transitions and correct quarter/half-turn identities", (factor) => {
    const transitions = tables[factor.transitions];
    const next = (rank: number, move: number) => transitions[rank * 9 + move]!;
    for (let rank = 0; rank < factor.count; rank++) {
      for (const [index, move] of SOLVER_MOVES.entries()) {
        const inverse = inverseMove(move);
        const inverseIndex = SOLVER_MOVES.findIndex((candidate) => candidate.face === inverse.face && candidate.turns === inverse.turns);
        const after = next(rank, index);
        expect(after).toBeGreaterThanOrEqual(0);
        expect(after).toBeLessThan(factor.count);
        expect(next(after, inverseIndex)).toBe(rank);
      }
      for (const clockwise of [0, 3, 6]) {
        const twice = next(next(rank, clockwise), clockwise);
        expect(twice).toBe(next(rank, clockwise + 2));
        expect(next(next(twice, clockwise), clockwise)).toBe(rank);
      }
    }
  });

  it.each(factors)("certifies exact shortest $name distances without rerunning the builder's BFS", (factor) => {
    const distances = tables[factor.distances];
    const transitions = tables[factor.transitions];
    expect(distances[0]).toBe(0);
    expect(Math.max(...distances)).toBe(factor.name === "permutation" ? 7 : 6);
    for (let rank = 0; rank < factor.count; rank++) {
      const distance = distances[rank]!;
      expect(distance).toBeLessThan(255);
      if (rank !== 0) expect(distance).toBeGreaterThan(0);
      let hasDescent = rank === 0;
      for (let move = 0; move < SOLVER_MOVES.length; move++) {
        const neighbor = distances[transitions[rank * 9 + move]!]!;
        // Edge bounds prevent overestimation; a descending path realizes the label.
        expect(Math.abs(distance - neighbor)).toBeLessThanOrEqual(1);
        if (neighbor === distance - 1) hasDescent = true;
      }
      expect(hasDescent).toBe(true);
    }
  });

  it("matches exact moves for every permutation rank with a varying nonzero twist", () => {
    for (let permutation = 0; permutation < PERMUTATION_COUNT; permutation++) {
      const current = { permutation, twist: permutation * 43 % (TWIST_COUNT - 1) + 1 };
      const state = decodeState(current);
      for (const [index, move] of SOLVER_MOVES.entries()) {
        expect(applyTableMove(tables, current, index)).toEqual(coordinates(applyMove(state, move)));
      }
    }
  }, 20_000);

  it("matches exact moves for every twist rank at several nonzero permutations", () => {
    for (const permutation of [1, 1739, PERMUTATION_COUNT - 1]) {
      for (let twist = 0; twist < TWIST_COUNT; twist++) {
        const current = { permutation, twist };
        const state = decodeState(current);
        for (const [index, move] of SOLVER_MOVES.entries()) {
          expect(applyTableMove(tables, current, index)).toEqual(coordinates(applyMove(state, move)));
        }
      }
    }
  }, 20_000);

  it("uses max, not sum: a single R turn needs one move although both factors have distance one", () => {
    const current = coordinates(applyMove(initial, { face: "R", turns: 1 }));
    expect(tables.permutationDistances[current.permutation]).toBe(1);
    expect(tables.twistDistances[current.twist]).toBe(1);
    expect(estimateRemainingMoves(tables, current)).toBe(1);
    expect(estimateRemainingMoves(tables, { permutation: 0, twist: 0 })).toBe(0);
  });

  it("does not overestimate full-state shortest distances through depth four", () => {
    // Independent full-pose BFS: no table transitions are used to construct this oracle.
    const queue = [{ state: initial, depth: 0 }];
    const visited = new Set([JSON.stringify(initial)]);
    const counts = [0, 0, 0, 0, 0];
    for (let head = 0; head < queue.length; head++) {
      const { state, depth } = queue[head]!;
      counts[depth]! += 1;
      const estimate = estimateRemainingMoves(tables, coordinates(state));
      expect(estimate).toBeLessThanOrEqual(depth);
      expect(estimate === 0).toBe(isSolved(state));
      if (depth === 4) continue;
      for (const move of SOLVER_MOVES) {
        const next = applyMove(state, move);
        const key = JSON.stringify(next);
        if (!visited.has(key)) {
          visited.add(key);
          queue.push({ state: next, depth: depth + 1 });
        }
      }
    }
    expect(counts).toEqual([1, 9, 54, 321, 1847]);
  }, 20_000);

  it("agrees with the full pose model over a long walk without mutating inputs", () => {
    let state = initial;
    let current = coordinates(state);
    for (let index = 0; index < 1000; index++) {
      const moveIndex = (index * 7 + Math.floor(index / 5)) % SOLVER_MOVES.length;
      Object.freeze(current);
      const before = JSON.stringify(current);
      const next = applyTableMove(tables, current, moveIndex);
      expect(JSON.stringify(current)).toBe(before);
      expect(Math.abs(estimateRemainingMoves(tables, current) - estimateRemainingMoves(tables, next))).toBeLessThanOrEqual(1);
      state = applyMove(state, SOLVER_MOVES[moveIndex]!);
      expect(decodeState(next)).toEqual(state);
      current = next;
    }
  });

  it("builds deterministic independently owned buffers rather than a mutable shared singleton", () => {
    const second = createSolverTables();
    for (const key of Object.keys(tables) as (keyof SolverTables)[]) {
      expect(second[key]).toEqual(tables[key]);
      expect(second[key].buffer).not.toBe(tables[key].buffer);
    }
    const original = tables.permutationTransitions[0]!;
    second.permutationTransitions[0] = (original + 1) % PERMUTATION_COUNT;
    expect(tables.permutationTransitions[0]).toBe(original);
  }, 20_000);

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER])("rejects invalid coordinates or move index %s", (value) => {
    for (const current of [{ permutation: value, twist: 0 }, { permutation: 0, twist: value }]) {
      expect(() => applyTableMove(tables, current, 0)).toThrow(RangeError);
      expect(() => estimateRemainingMoves(tables, current)).toThrow(RangeError);
    }
    expect(() => applyTableMove(tables, { permutation: 0, twist: 0 }, value)).toThrow(RangeError);
  });

  it("rejects the exclusive range endpoints", () => {
    for (const current of [{ permutation: PERMUTATION_COUNT, twist: 0 }, { permutation: 0, twist: TWIST_COUNT }]) {
      expect(() => applyTableMove(tables, current, 0)).toThrow(RangeError);
      expect(() => estimateRemainingMoves(tables, current)).toThrow(RangeError);
    }
    expect(() => applyTableMove(tables, { permutation: 0, twist: 0 }, SOLVER_MOVES.length)).toThrow(RangeError);
  });
});

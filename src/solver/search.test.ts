import { beforeAll, describe, expect, it, vi } from "vitest";
import { cornerOrientation } from "../puzzle/corners";
import { createSolvedCube } from "../puzzle/model";
import { applyMove, type Move } from "../puzzle/moves";
import { rotateState } from "../puzzle/orientation";
import { isSolved } from "../puzzle/solved";
import { createSolvedState, type PuzzleState } from "../puzzle/state";
import { decodeState, encodeState, PERMUTATION_COUNT, TWIST_COUNT } from "./coordinates";
import { solvePuzzle, type SearchOptions } from "./search";
import { createSolverTables, SOLVER_MOVES, type SolverTables } from "./tables";

let tables: SolverTables;
beforeAll(() => { tables = createSolverTables(); }, 20_000);
const initial = createSolvedState(createSolvedCube());
const allMoves = (["U", "D", "L", "R", "F", "B"] as const).flatMap((face) =>
  ([1, -1, 2] as const).map((turns) => ({ face, turns })),
);
const oneTurn = applyMove(initial, { face: "R", turns: -1 });
const hard = decodeState({ permutation: 7, twist: 22 });
const mixed = ([{ face: "L", turns: -1 }, { face: "B", turns: 1 }, { face: "D", turns: 2 },
  { face: "R", turns: 1 }, { face: "U", turns: -1 }] satisfies Move[]).reduce(applyMove, initial);

const wholeStates = [initial];
const frames = new Set([JSON.stringify(initial.corners[0]!.orientation)]);
for (const state of wholeStates) for (const [a, b] of [["R", "L"], ["U", "D"]] as const) {
  const next = applyMove(applyMove(state, { face: a, turns: 1 }), { face: b, turns: -1 });
  const key = JSON.stringify(next.corners[0]!.orientation);
  if (!frames.has(key)) { frames.add(key); wholeStates.push(next); }
}

function solvedResult(state: PuzzleState, options: SearchOptions = {}) {
  const result = solvePuzzle(state, tables, { now: () => 0, ...options });
  expect(result.status).toBe("solution");
  if (result.status !== "solution") throw new Error(JSON.stringify(result));
  expect(isSolved(result.moves.reduce(applyMove, state))).toBe(true);
  for (let index = 1; index < result.moves.length; index++) {
    expect(result.moves[index]!.face).not.toBe(result.moves[index - 1]!.face);
  }
  return result;
}

// Independent full-pose BFS, without coordinate transitions or heuristics.
function checkShallowOptimality(roots: readonly PuzzleState[], moves: readonly Move[], maxDepth: number) {
  const queue = roots.map((state) => ({ state, depth: 0 }));
  const visited = new Set(roots.map((state) => JSON.stringify(state)));
  const counts = Array<number>(maxDepth + 1).fill(0);
  for (let head = 0; head < queue.length; head++) {
    const { state, depth } = queue[head]!;
    counts[depth]!++;
    expect(solvedResult(state).moves).toHaveLength(depth);
    if (depth === maxDepth) continue;
    for (const move of moves) {
      const next = applyMove(state, move);
      const key = JSON.stringify(next);
      if (!visited.has(key)) { visited.add(key); queue.push({ state: next, depth: depth + 1 }); }
    }
  }
  return counts;
}

describe("history-independent IDA*", () => {
  it("returns empty verified solutions in all 24 solved frames, even with zero search budgets", () => {
    expect(wholeStates).toHaveLength(24);
    for (const state of wholeStates) {
      expect(solvedResult(state, { maxNodes: 0, maxTimeMs: 0, maxDepth: 0 })).toEqual({
        status: "solution", moves: [], visitedNodes: 0,
      });
    }
  });

  it.each(allMoves)("solves a single $face ($turns) turn in one face-turn", (move) => {
    expect(solvedResult(applyMove(initial, move)).moves).toHaveLength(1);
  });

  it("maps mixed and depth-eleven solutions correctly through every global frame", () => {
    for (const state of [mixed, hard]) {
      const expectedLength = solvedResult(state).moves.length;
      for (const whole of wholeStates) {
        const rotated = rotateState(state, whole.corners[0]!.orientation);
        expect(solvedResult(rotated).moves).toHaveLength(expectedLength);
      }
    }
    expect(solvedResult(hard).moves).toHaveLength(11);
  }, 20_000);

  it("is shortest on all independent normalized full-pose states through depth four", () => {
    expect(checkShallowOptimality([initial], SOLVER_MOVES, 4)).toEqual([1, 9, 54, 321, 1847]);
  }, 20_000);

  it("is shortest through depth two with all six faces and all 24 goals", () => {
    expect(checkShallowOptimality(wholeStates, allMoves, 2)).toEqual([24, 216, 1296]);
  }, 20_000);

  it("matches a full coordinate-graph BFS oracle on seeded states and deep cases", () => {
    const count = PERMUTATION_COUNT * TWIST_COUNT;
    const distances = new Uint8Array(count).fill(255);
    const queue = new Uint32Array(count);
    distances[0] = 0;
    let head = 0;
    let tail = 1;
    const histogram: number[] = [];
    while (head < tail) {
      const key = queue[head++]!;
      const p = Math.floor(key / TWIST_COUNT), t = key % TWIST_COUNT;
      const distance = distances[key]!;
      histogram[distance] = (histogram[distance] ?? 0) + 1;
      for (let index = 0; index < SOLVER_MOVES.length; index++) {
        const next = tables.permutationTransitions[p * 9 + index]! * TWIST_COUNT + tables.twistTransitions[t * 9 + index]!;
        if (distances[next] === 255) {
          distances[next] = distance + 1;
          queue[tail++] = next;
        }
      }
    }
    expect(tail).toBe(count);
    expect(histogram).toEqual([1, 9, 54, 321, 1847, 9992, 50136, 227536, 870072, 1887748, 623800, 2644]);
    const cases = [7 * TWIST_COUNT + 22];
    let seed = 42;
    for (let index = 0; index < 100; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      cases.push(seed % count);
    }
    for (let index = count - 2644; index < count; index += 300) cases.push(queue[index]!);
    for (const key of cases) {
      const state = decodeState({ permutation: Math.floor(key / TWIST_COUNT), twist: key % TWIST_COUNT });
      expect(solvedResult(state).moves).toHaveLength(distances[key]!);
    }
  }, 20_000);

  it("ignores unrelated history and input order, and does not mutate frozen input or tables", () => {
    const cube = createSolvedCube({ edgeLength: 59, splits: { x: 29, y: 28, z: 27 } });
    const state = applyMove(createSolvedState(cube), { face: "B", turns: 1 });
    const input = { corners: [...state.corners].reverse(), history: ["not a solution"] };
    for (const corner of input.corners) {
      Object.values(corner.orientation).forEach(Object.freeze);
      Object.freeze(corner.orientation); Object.freeze(corner.slot); Object.freeze(corner);
    }
    Object.freeze(input.corners); Object.freeze(input);
    const before = JSON.stringify(input);
    const buffers = Object.values(tables).map((buffer) => buffer.slice());
    const first = solvedResult(input);
    expect(solvedResult(JSON.parse(JSON.stringify(state))).moves).toEqual(first.moves);
    expect(JSON.stringify(input)).toBe(before);
    expect(Object.values(tables)).toEqual(buffers);
    expect(cube.pieces[0]!.dimensions.x).toBe(29);
    expect(cube.pieces[4]!.dimensions.x).toBe(30);
  });

  it("verifies against its private full-pose snapshot even if a caller callback changes the source", () => {
    const input = { corners: [...oneTurn.corners] };
    let first = true;
    const result = solvePuzzle(input, tables, { shouldCancel: () => {
      if (first) { first = false; input.corners = []; }
      return false;
    } });
    expect(result.status).toBe("solution");
    if (result.status === "solution") expect(isSolved(result.moves.reduce(applyMove, oneTurn))).toBe(true);
  });

  it("rejects an incorrect table-derived solution rather than publishing unverified moves", () => {
    const state = applyMove(initial, { face: "R", turns: 1 });
    const encoded = encodeState(state);
    if (!encoded.valid) throw new Error("Invalid fixture");
    const corrupted = { ...tables, permutationTransitions: tables.permutationTransitions.slice(), twistTransitions: tables.twistTransitions.slice() };
    // Pretend another clockwise R solves R, instead of using its inverse.
    corrupted.permutationTransitions[encoded.coordinates.permutation * 9] = 0;
    corrupted.twistTransitions[encoded.coordinates.twist * 9] = 0;
    expect(() => solvePuzzle(state, corrupted)).toThrow("exact-state verification");
  });
});

describe("validation, budgets, and interruption", () => {
  it("returns validation diagnostics before consulting cancellation", () => {
    const shouldCancel = vi.fn(() => true);
    expect(solvePuzzle(null, tables, { shouldCancel })).toEqual({ status: "invalid", error: { code: "structure" } });
    expect(shouldCancel).not.toHaveBeenCalled();
    const duplicate = { corners: initial.corners.map((corner, index) => index === 5
      ? { ...corner, pieceId: initial.corners[0]!.pieceId } : corner) };
    expect(solvePuzzle(duplicate, tables)).toEqual({
      status: "invalid", error: { code: "duplicate-piece", cornerIndex: 5 },
    });
    const impossible = { corners: initial.corners.map((corner, index) => ({
      ...corner, orientation: cornerOrientation(corner.pieceId, corner.slot, index === 0 ? 1 : 0),
    })) };
    expect(solvePuzzle(impossible, tables)).toEqual({ status: "invalid", error: { code: "twist-sum" } });
  });

  it("honors pre-cancellation even for a solved state", () => {
    expect(solvePuzzle(initial, tables, { shouldCancel: () => true })).toEqual({ status: "cancelled", visitedNodes: 0 });
  });

  it("interrupts an active search without returning a partial path and can be retried", () => {
    let polls = 0;
    const result = solvePuzzle(hard, tables, { shouldCancel: () => ++polls > 50 });
    expect(result.status).toBe("cancelled");
    if (result.status !== "cancelled") throw new Error("Expected cancellation");
    expect(result.visitedNodes).toBeGreaterThan(0);
    expect(result.visitedNodes).toBeLessThan(50);
    expect("moves" in result).toBe(false);
    expect(solvedResult(hard).moves).toHaveLength(11);
  });

  it("honors an exact node cap, including success on the final permitted node", () => {
    expect(solvePuzzle(oneTurn, tables, { maxNodes: 0 })).toEqual({ status: "limit", reason: "nodes", visitedNodes: 0 });
    expect(solvePuzzle(oneTurn, tables, { maxNodes: 1 })).toEqual({ status: "limit", reason: "nodes", visitedNodes: 1 });
    const result = solvedResult(oneTurn, { maxNodes: 2 });
    expect(result.visitedNodes).toBe(2);
    expect(result.moves).toEqual([{ face: "R", turns: 1 }]);
    expect(solvePuzzle(hard, tables, { maxNodes: 123 })).toEqual({ status: "limit", reason: "nodes", visitedNodes: 123 });
  });

  it("reports depth limits both before traversal and after bounded iterations", () => {
    expect(solvePuzzle(oneTurn, tables, { maxDepth: 0 })).toEqual({ status: "limit", reason: "depth", visitedNodes: 0 });
    const result = solvePuzzle(hard, tables, { maxDepth: 7, now: () => 0 });
    expect(result.status).toBe("limit");
    if (result.status !== "limit") throw new Error("Expected limit");
    expect(result.reason).toBe("depth");
    expect(result.visitedNodes).toBeGreaterThan(0);
    expect("moves" in result).toBe(false);
  });

  it("checks time before traversal, during traversal, and at a found goal", () => {
    expect(solvePuzzle(oneTurn, tables, { maxTimeMs: 0, now: () => 0 })).toEqual({ status: "limit", reason: "time", visitedNodes: 0 });
    for (const [state, visitedNodes] of [[hard, 256], [oneTurn, 2]] as const) {
      let calls = 0;
      expect(solvePuzzle(state, tables, { maxTimeMs: 50, now: () => calls++ < 3 ? 0 : 50 })).toEqual({
        status: "limit", reason: "time", visitedNodes,
      });
    }
  });

  it.each([-1, NaN, Infinity, 12, 0.5])("rejects invalid depth %s", (maxDepth) => {
    expect(() => solvePuzzle(initial, tables, { maxDepth })).toThrow(RangeError);
  });

  it.each([-1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid node cap %s", (maxNodes) => {
    expect(() => solvePuzzle(initial, tables, { maxNodes })).toThrow(RangeError);
  });

  it.each([-1, NaN, Infinity])("rejects invalid time budget %s", (maxTimeMs) => {
    expect(() => solvePuzzle(initial, tables, { maxTimeMs })).toThrow(RangeError);
  });

  it("rejects nonfinite and backward clocks", () => {
    for (const value of [NaN, Infinity]) expect(() => solvePuzzle(oneTurn, tables, { now: () => value })).toThrow(RangeError);
    let time = 2;
    expect(() => solvePuzzle(oneTurn, tables, { now: () => time-- })).toThrow(RangeError);
  });
});

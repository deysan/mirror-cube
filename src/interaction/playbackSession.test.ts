import { beforeAll, describe, expect, it } from "vitest";
import { createSolvedCube } from "../puzzle/model";
import { applyMove, inverseMove, type Move } from "../puzzle/moves";
import { rotateState } from "../puzzle/orientation";
import { isSolved } from "../puzzle/solved";
import { createSolvedState, type PuzzleState } from "../puzzle/state";
import { decodeState } from "../solver/coordinates";
import { solvePuzzle } from "../solver/search";
import { createSolverTables, type SolverTables } from "../solver/tables";
import { createTurnSession, turnSessionReducer as reduce, type TurnSession } from "./turnSession";

const initial = createSolvedState(createSolvedCube());
const allMoves = (["U", "D", "L", "R", "F", "B"] as const).flatMap((face) =>
  ([1, -1, 2] as const).map((turns) => ({ face, turns })),
);
const scramble: readonly Move[] = [{ face: "R", turns: 1 }, { face: "U", turns: -1 }, { face: "F", turns: 2 }];
const mixed = scramble.reduce(applyMove, initial);
const solution = [...scramble].reverse().map(inverseMove);
function withSolution(state: PuzzleState, moves: readonly Move[], history: readonly Move[] = []) {
  const ready = reduce({ ...createTurnSession(state), history }, { type: "scene-ready" });
  const searching = reduce(ready, { type: "find-solution" });
  return reduce(searching, { type: "search-result", response: {
    id: 1, result: { status: "solution", moves, visitedNodes: 0 },
  } });
}
function finish(session: TurnSession) { return reduce(session, { type: "complete", id: session.activeTurn!.id }); }
const next = { type: "solution-next" } as const;
let tables: SolverTables;
beforeAll(() => { tables = createSolverTables(); });

describe("step-by-step solution transaction", () => {
  it.each(allMoves)("animates and commits $face ($turns) exactly once", (move) => {
    const state = applyMove(initial, inverseMove(move));
    const ready = withSolution(state, [move]);
    expect(ready.playback?.moves).toEqual([move]);
    expect(ready.playback?.moves[0]).not.toBe(move);
    const active = reduce(ready, next);
    expect(active.activeTurn).toMatchObject({ move, kind: "solution" });
    expect(active.puzzle).toBe(state);
    expect(active.playback).toBe(ready.playback);
    expect(active.history).toHaveLength(0);
    expect(reduce(active, next)).toBe(active);
    expect(reduce(active, { type: "complete", id: active.activeTurn!.id + 1 })).toBe(active);
    const done = finish(active);
    expect(done.puzzle).toEqual(initial);
    expect(done.playback).toMatchObject({ status: "complete", completed: 1, expectedState: done.puzzle });
    expect(done.history).toEqual([move]);
    expect(done.activeTurn).toBeNull();
    expect(reduce(done, { type: "complete", id: active.activeTurn!.id })).toBe(done);
    expect(reduce(done, next)).toBe(done);
  });

  it("advances only on completion, pauses between steps, and retains a chronological history", () => {
    let session = withSolution(mixed, solution, scramble);
    let expected = mixed;
    const ids = new Set<number>();
    for (const [index, move] of solution.entries()) {
      expect(session.playback?.completed).toBe(index);
      expect(session.playback?.expectedState).toBe(session.puzzle);
      session = reduce(session, next);
      const pending = session.activeTurn!;
      expect(ids.has(pending.id)).toBe(false); ids.add(pending.id);
      expect(pending.move).toEqual(move);
      expect(session.history).toEqual([...scramble, ...solution.slice(0, index)]);
      for (const action of [next, { type: "start", move }, { type: "undo" },
        { type: "find-solution" }, { type: "scramble", moves: scramble }] as const) {
        expect(reduce(session, action)).toBe(session);
      }
      const late = { type: "search-result", response: { id: 1, result: { status: "solution", moves: [], visitedNodes: 0 } } } as const;
      expect(reduce(session, late)).toBe(session);
      session = finish(session);
      expected = applyMove(expected, move);
      expect(session.puzzle).toEqual(expected);
      expect(session.playback?.completed).toBe(index + 1);
      expect(session.history).toEqual([...scramble, ...solution.slice(0, index + 1)]);
      expect(session.activeTurn).toBeNull(); // Never auto-schedule another step.
      expect(reduce(session, { type: "complete", id: pending.id })).toBe(session);
    }
    expect(session.playback?.status).toBe("complete");
    expect(isSolved(session.puzzle)).toBe(true);
    expect(session.history.reduce(applyMove, initial)).toEqual(session.puzzle);
  });

  it("plays actual history-free depth-eleven solver results through all 24 global frames", () => {
    const wholeStates = [initial];
    const seen = new Set([JSON.stringify(initial.corners[0]!.orientation)]);
    for (const state of wholeStates) for (const [a, b] of [["R", "L"], ["U", "D"]] as const) {
      const rotated = applyMove(applyMove(state, { face: a, turns: 1 }), { face: b, turns: -1 });
      const key = JSON.stringify(rotated.corners[0]!.orientation);
      if (!seen.has(key)) { seen.add(key); wholeStates.push(rotated); }
    }
    expect(wholeStates).toHaveLength(24);
    for (const whole of wholeStates) {
      const state = rotateState(decodeState({ permutation: 7, twist: 22 }), whole.corners[0]!.orientation);
      const result = solvePuzzle(state, tables, { now: () => 0 });
      if (result.status !== "solution") throw new Error("Expected solution");
      expect(result.moves).toHaveLength(11);
      let session = withSolution(state, result.moves);
      for (let index = 0; index < result.moves.length; index++) session = finish(reduce(session, next));
      expect(session.playback?.status).toBe("complete");
      expect(session.history).toEqual(result.moves);
      expect(isSolved(session.puzzle)).toBe(true);
    }
  }, 20_000);

  it("rejects missing/empty plans, unavailable scenes, and other active operations", () => {
    const ready = reduce(createTurnSession(initial), { type: "scene-ready" });
    for (const session of [createTurnSession(initial), ready, withSolution(initial, []),
      reduce(ready, { type: "find-solution" }), reduce(ready, { type: "start", move: scramble[0]! }),
      reduce(ready, { type: "scramble", moves: scramble }),
      reduce(withSolution(mixed, solution), { type: "scene-failed" })]) {
      expect(reduce(session, next)).toBe(session);
    }
  });

  it("invalidates the plan on manual turns, undo, scramble, or a new search between steps", () => {
    const partial = finish(reduce(withSolution(mixed, solution, scramble), next));
    for (const action of [{ type: "start", move: scramble[0]! }, { type: "undo" },
      { type: "scramble", moves: scramble }, { type: "find-solution" }] as const) {
      const changed = reduce(partial, action);
      expect(changed.playback).toBeNull();
      expect(changed.puzzle).toBe(partial.puzzle);
      expect(reduce(changed, next)).toBe(changed);
    }
    const undone = finish(reduce(partial, { type: "undo" }));
    expect(undone.puzzle).toEqual(mixed);
    expect(undone.history).toEqual(scramble);
    expect(undone.playback).toBeNull();
    // A rejected empty scramble does not discard a valid plan.
    expect(reduce(partial, { type: "scramble", moves: [] })).toBe(partial);
  });

  it.each([0, 1, 2])("scene failure after %s steps keeps only the completed prefix", (count) => {
    let session = withSolution(mixed, solution, scramble);
    for (let index = 0; index < count; index++) session = finish(reduce(session, next));
    const active = reduce(session, next);
    const failed = reduce(active, { type: "scene-failed" });
    expect(failed.puzzle).toBe(session.puzzle);
    expect(failed.history).toEqual([...scramble, ...solution.slice(0, count)]);
    expect(failed.playback).toBeNull();
    expect(failed.activeTurn).toBeNull();
    expect(reduce(failed, { type: "complete", id: active.activeTurn!.id })).toBe(failed);
    expect(reduce(failed, next)).toBe(failed);
  });

  it("rejects a snapshot mismatch both before starting and before committing a step", () => {
    const plan = withSolution(mixed, solution);
    const changed = { ...plan, puzzle: applyMove(mixed, scramble[0]!) };
    const rejected = reduce(changed, next);
    expect(rejected.playback?.status).toBe("failed");
    expect(rejected.activeTurn).toBeNull();
    expect(rejected.puzzle).toBe(changed.puzzle);
    const active = { ...reduce(plan, next), puzzle: changed.puzzle };
    const failed = finish(active);
    expect(failed.puzzle).toBe(changed.puzzle);
    expect(failed.history).toBe(plan.history);
    expect(failed.playback?.completed).toBe(0);
    expect(failed.playback?.status).toBe("failed");
    expect(failed.activeTurn).toBeNull();
  });

  it("never announces success just because a sequence ended", () => {
    const bad = withSolution(mixed, [{ face: "R", turns: 1 }]);
    const done = finish(reduce(bad, next));
    expect(done.playback?.completed).toBe(1);
    expect(isSolved(done.puzzle)).toBe(false);
    expect(done.playback?.status).toBe("failed");
    expect(reduce(done, next)).toBe(done);
    expect(reduce(done, { type: "find-solution" }).playback).toBeNull();
  });
});

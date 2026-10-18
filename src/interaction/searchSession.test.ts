import { describe, expect, it } from "vitest";
import { createSolvedCube } from "../puzzle/model";
import { applyMove } from "../puzzle/moves";
import { createSolvedState } from "../puzzle/state";
import type { SolverOutcome } from "../solver/workerProtocol";
import { createTurnSession, turnSessionReducer as reduce } from "./turnSession";

const initial = createSolvedState(createSolvedCube());
const loading = createTurnSession(initial);
const ready = reduce(loading, { type: "scene-ready" });
const move = { face: "R", turns: 1 } as const;
const start = { type: "start", move } as const;
const manual = reduce(ready, start);
const turned = reduce(manual, { type: "complete", id: manual.activeTurn!.id });
const running = reduce(turned, { type: "find-solution" });
const result = { type: "search-result", response: {
  id: 1, result: { status: "solution", moves: [{ face: "R", turns: -1 }], visitedNodes: 3 },
} } as const;

describe("solution request transaction", () => {
  it("searches only a ready committed state, not an active turn, undo, or scramble", () => {
    for (const blocked of [loading, manual, reduce(ready, { type: "scene-failed" }),
      reduce(turned, { type: "undo" }), reduce(ready, { type: "scramble", moves: [move, move] })]) {
      expect(reduce(blocked, { type: "find-solution" })).toBe(blocked);
    }
    expect(running.search).toEqual({ status: "running", request: { id: 1, state: turned.puzzle } });
    if (running.search.status === "running") expect(running.search.request.state).toBe(turned.puzzle);
    expect(running.puzzle).toBe(turned.puzzle);
    expect(running.history).toBe(turned.history);
    expect(running.nextSearchId).toBe(2);
  });

  it("locks turns, undo, scramble, and repeated solve requests in the reducer, not only buttons", () => {
    for (const action of [start, { type: "undo" }, { type: "scramble", moves: [move] },
      { type: "find-solution" }, { type: "complete", id: 1 }] as const) {
      expect(reduce(running, action)).toBe(running);
    }
  });

  it("accepts a matching result exactly once without applying moves or changing history", () => {
    const done = reduce(running, result);
    expect(done.search).toEqual({ status: "done", result: result.response.result });
    expect(done.puzzle).toBe(running.puzzle);
    expect(done.history).toBe(running.history);
    expect(done.activeTurn).toBeNull();
    expect(reduce(done, result)).toBe(done);
    expect(reduce(ready, result)).toBe(ready);
    expect(reduce(running, { ...result, response: { ...result.response, id: 42 } })).toBe(running);
    const changed = { ...running, puzzle: applyMove(running.puzzle, move) };
    expect(reduce(changed, result)).toBe(changed);
  });

  it("cancels without changing the puzzle, and rejects late results after cancel/retry or scene failure", () => {
    const cancelled = reduce(running, { type: "cancel-search" });
    expect(cancelled.search.status).toBe("cancelled");
    expect(cancelled.puzzle).toBe(running.puzzle);
    expect(cancelled.history).toBe(running.history);
    expect(reduce(cancelled, result)).toBe(cancelled);
    expect(reduce(cancelled, { type: "cancel-search" })).toBe(cancelled);
    const retry = reduce(cancelled, { type: "find-solution" });
    expect(retry.search).toEqual({ status: "running", request: { id: 2, state: turned.puzzle } });
    expect(reduce(retry, result)).toBe(retry);
    const failed = reduce(running, { type: "scene-failed" });
    expect(failed.search.status).toBe("idle");
    expect(reduce(failed, result)).toBe(failed);
    expect(reduce(failed, { type: "find-solution" })).toBe(failed);
  });

  it("clears a result as soon as a turn, undo, or scramble starts, before animation completion", () => {
    const done = reduce(running, result);
    for (const action of [start, { type: "undo" }, { type: "scramble", moves: [move] }] as const) {
      const next = reduce(done, action);
      expect(next.search.status).toBe("idle");
      expect(next.puzzle).toBe(done.puzzle);
      expect(next.activeTurn).not.toBeNull();
      expect(reduce(next, result)).toBe(next);
    }
  });

  it.each([
    { status: "invalid", error: { code: "twist-sum" } },
    { status: "limit", reason: "nodes", visitedNodes: 5_000_000 },
    { status: "cancelled", visitedNodes: 10 },
    { status: "error", reason: "worker" },
    { status: "error", reason: "timeout" },
  ] satisfies SolverOutcome[])("unlocks the session after $status", (outcome) => {
    const done = reduce(running, { type: "search-result", response: { id: 1, result: outcome } });
    expect(done.search).toEqual({ status: "done", result: outcome });
    expect(reduce(done, start).activeTurn).not.toBeNull();
    expect(reduce(done, { type: "find-solution" }).search.status).toBe("running");
  });
});

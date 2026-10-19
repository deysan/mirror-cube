import { describe, expect, it } from "vitest";
import { createSolvedCube } from "../puzzle/model";
import { applyMove, inverseMove, type Move } from "../puzzle/moves";
import { createSolvedState } from "../puzzle/state";
import { createTurnSession, turnSessionReducer as reduce, type TurnSession } from "./turnSession";

const initial = createSolvedState(createSolvedCube());
const base: readonly Move[] = [{ face: "R", turns: 1 }, { face: "U", turns: -1 }, { face: "F", turns: 2 }];
const moves = [...base].reverse().map(inverseMove);
const mixed = base.reduce(applyMove, initial);
function prepare(history: readonly Move[] = base) {
  const ready = reduce({ ...createTurnSession(mixed), history }, { type: "scene-ready" });
  const searching = reduce(ready, { type: "find-solution" });
  return reduce(searching, { type: "search-result", response: {
    id: searching.search.status === "running" ? searching.search.request.id : 0,
    result: { status: "solution", moves, visitedNodes: 0 },
  } });
}
const finish = (session: TurnSession) => reduce(session, { type: "complete", id: session.activeTurn!.id });
function go(session: TurnSession, completed: number) {
  session = reduce(session, { type: "solution-go", completed });
  let count = 0;
  while (session.activeTurn) {
    if (++count > moves.length) throw new Error("Navigation did not stop at its target");
    session = finish(session);
  }
  return session;
}
const allMoves = (["U", "D", "L", "R", "F", "B"] as const).flatMap(face =>
  ([1, -1, 2] as const).map(turns => ({ face, turns })),
);

describe("solution timeline navigation", () => {
  it("visits every pair of positions through exact intermediate states, with atomic locks and history", () => {
    for (let from = 0; from <= moves.length; from++) for (let target = 0; target <= moves.length; target++) {
      const origin = go(prepare(), from);
      let session = reduce(origin, { type: "solution-go", completed: target });
      if (from === target) { expect(session).toBe(origin); continue; }
      let cursor = from;
      const direction = target > from ? 1 : -1;
      while (session.activeTurn) {
        const pending = session.activeTurn;
        expect(session.playback).toMatchObject({ completed: cursor, target, expectedState: session.puzzle });
        expect(session.history).toEqual([...base, ...moves.slice(0, cursor)]);
        expect(session.puzzle).toEqual(moves.slice(0, cursor).reduce(applyMove, mixed));
        const move = direction === 1 ? moves[cursor]! : inverseMove(moves[cursor - 1]!);
        expect(pending.move).toEqual(move);
        expect(pending.kind).toBe(direction === 1 ? "solution" : "solution-back");
        for (const action of [{ type: "solution-go", completed: 1 }, { type: "solution-next" },
          { type: "solution-replay" }, { type: "reset", state: initial }, { type: "find-solution" },
          { type: "undo" }, { type: "start", move }, { type: "scramble", moves }] as const) {
          expect(reduce(session, action)).toBe(session);
        }
        const committed = finish(session);
        cursor += direction;
        expect(committed.playback?.completed).toBe(cursor);
        expect(committed.puzzle).toEqual(applyMove(session.puzzle, move));
        expect(reduce(committed, { type: "complete", id: pending.id })).toBe(committed);
        if (cursor !== target) expect(committed.activeTurn!.id).toBeGreaterThan(pending.id);
        session = committed;
      }
      expect(cursor).toBe(target);
      expect(session.playback).toMatchObject({ completed: target, target: null, status: target === 3 ? "complete" : "ready" });
      expect(session.history).toEqual([...base, ...moves.slice(0, target)]);
      expect(session.history.reduce(applyMove, initial)).toEqual(session.puzzle);
      expect(origin.playback?.completed).toBe(from);
    }
  });

  it("navigates a history-free input and retains the plan after returning to its start", () => {
    const start = prepare([]);
    const back = go(go(start, 3), 0);
    expect(back.puzzle).toEqual(mixed);
    expect(back.history).toEqual([]);
    expect(back.playback?.moves).toBe(start.playback?.moves);
    expect(go(back, 3).puzzle).toEqual(initial);
    expect(go(back, 3).history).toEqual(moves);
  });

  it.each([-1, 4, 1.5, NaN, Infinity])("rejects invalid target %s", target => {
    const start = prepare();
    expect(reduce(start, { type: "solution-go", completed: target })).toBe(start);
  });

  it.each([0, 1, 2])("keeps exactly the committed prefix on failure during navigation at %s", completed => {
    let session = reduce(prepare(), { type: "solution-go", completed: 3 });
    for (let i = 0; i < completed; i++) session = finish(session);
    const failed = reduce(session, { type: "scene-failed" });
    expect(failed.puzzle).toBe(session.puzzle);
    expect(failed.history).toBe(session.history);
    expect(failed.playback).toBeNull();
    expect(failed.activeTurn).toBeNull();
    expect(reduce(failed, { type: "complete", id: session.activeTurn!.id })).toBe(failed);
  });

  it("preserves the current rewound prefix on failure, and rejects changed snapshots", () => {
    const backwards = finish(reduce(go(prepare(), 3), { type: "solution-go", completed: 0 }));
    const failed = reduce(backwards, { type: "scene-failed" });
    expect(failed.history).toEqual([...base, ...moves.slice(0, 2)]);
    expect(failed.puzzle).toEqual(moves.slice(0, 2).reduce(applyMove, mixed));
    const changed = { ...go(prepare(), 3), puzzle: mixed };
    expect(reduce(changed, { type: "solution-go", completed: 0 }).playback?.status).toBe("failed");
    const interrupted = finish({ ...backwards, puzzle: mixed });
    expect(interrupted.puzzle).toBe(mixed);
    expect(interrupted.history).toBe(backwards.history);
    expect(interrupted.playback?.status).toBe("failed");
    expect(interrupted.activeTurn).toBeNull();
  });
});

describe("non-committing step demonstrations", () => {
  it.each(allMoves)("replays $face ($turns) from its starting pose without double application", move => {
    const state = applyMove(initial, inverseMove(move));
    let session = reduce(createTurnSession(state), { type: "scene-ready" });
    session = reduce(session, { type: "find-solution" });
    session = reduce(session, { type: "search-result", response: { id: 1,
      result: { status: "solution", moves: [move], visitedNodes: 0 } } });
    let complete = finish(reduce(session, { type: "solution-next" }));
    const rewound = go(complete, 0);
    expect(rewound.puzzle).toEqual(state);
    expect(rewound.history).toEqual([]);
    expect(go(rewound, 1).puzzle).toEqual(complete.puzzle);
    for (let repeat = 0; repeat < 3; repeat++) {
      const active = reduce(complete, { type: "solution-replay" });
      if (active.activeTurn?.kind !== "replay") throw new Error("Expected a demonstration");
      expect(active.activeTurn.previewState).toEqual(state);
      expect(applyMove(active.activeTurn.previewState, active.activeTurn.move)).toEqual(complete.puzzle);
      expect(active.puzzle).toBe(complete.puzzle);
      expect(active.history).toBe(complete.history);
      expect(active.playback).toBe(complete.playback);
      expect(reduce(active, { type: "solution-replay" })).toBe(active);
      const done = finish(active);
      expect(done.puzzle).toBe(complete.puzzle);
      expect(done.history).toBe(complete.history);
      expect(done.playback).toBe(complete.playback);
      expect(done.activeTurn).toBeNull();
      expect(reduce(done, { type: "complete", id: active.activeTurn.id })).toBe(done);
      complete = done;
    }
  });

  it("rejects replay without a completed step, preserves progress on failure, and detects stale snapshots", () => {
    const start = prepare();
    expect(reduce(start, { type: "solution-replay" })).toBe(start);
    const partial = go(start, 2);
    const active = reduce(partial, { type: "solution-replay" });
    const failed = reduce(active, { type: "scene-failed" });
    expect(failed.puzzle).toBe(partial.puzzle);
    expect(failed.history).toBe(partial.history);
    expect(failed.playback).toBeNull();
    expect(reduce(failed, { type: "complete", id: active.activeTurn!.id })).toBe(failed);
    expect(reduce({ ...partial, puzzle: initial }, { type: "solution-replay" }).playback?.status).toBe("failed");
    const interrupted = finish({ ...active, puzzle: initial });
    expect(interrupted.puzzle).toBe(initial);
    expect(interrupted.history).toBe(partial.history);
    expect(interrupted.playback?.status).toBe("failed");
  });
});

describe("confirmed reset transaction", () => {
  it("clears history and solution without reusing turn/search IDs or accepting obsolete callbacks", () => {
    const partial = go(prepare(), 2);
    const reset = reduce(partial, { type: "reset", state: initial });
    expect(reset.puzzle).toBe(initial);
    expect(reset.history).toEqual([]);
    expect(reset.playback).toBeNull();
    expect(reset.search).toEqual({ status: "idle" });
    expect(reset.nextTurnId).toBe(partial.nextTurnId);
    expect(reset.nextSearchId).toBe(partial.nextSearchId);
    const next = reduce(reset, { type: "start", move: base[0]! });
    expect(reduce(next, { type: "complete", id: partial.nextTurnId - 1 })).toBe(next);
    const searching = reduce(reset, { type: "find-solution" });
    expect(reduce(searching, { type: "search-result", response: { id: 1,
      result: { status: "solution", moves, visitedNodes: 0 } } })).toBe(searching);
    expect(reduce(reset, { type: "undo" })).toBe(reset);
  });

  it("rejects reset and navigation while unavailable or searching", () => {
    const loading = createTurnSession(initial);
    const ready = reduce(loading, { type: "scene-ready" });
    for (const session of [loading, reduce(ready, { type: "scene-failed" }), reduce(ready, { type: "find-solution" })]) {
      for (const action of [{ type: "reset", state: initial }, { type: "solution-go", completed: 2 },
        { type: "solution-replay" }] as const) expect(reduce(session, action)).toBe(session);
    }
  });
});

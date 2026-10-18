import { describe, expect, it } from "vitest";
import { createSolvedCube } from "../puzzle/model";
import { applyMove, inverseMove, type Move } from "../puzzle/moves";
import { createScramble } from "../puzzle/scramble";
import { createSolvedState } from "../puzzle/state";
import { createTurnSession, turnSessionReducer, type TurnSession } from "./turnSession";

const initial = createSolvedState(createSolvedCube());
const loading = createTurnSession(initial);
const ready = turnSessionReducer(loading, { type: "scene-ready" });
const move: Move = { face: "R", turns: 1 };
const start = { type: "start", move } as const;

function finish(session: TurnSession) {
  return turnSessionReducer(session, { type: "complete", id: session.activeTurn!.id });
}

const allMoves = (["U", "D", "L", "R", "F", "B"] as const).flatMap((face) =>
  ([1, -1, 2] as const).map((turns) => ({ face, turns })),
);

describe("scramble transaction", () => {
  const sequence = createScramble(() => 0.4);
  const scramble = { type: "scramble", moves: sequence } as const;

  it("rejects empty sequences, unavailable scenes, and starts during manual/undo animations", () => {
    expect(turnSessionReducer(ready, { type: "scramble", moves: [] })).toBe(ready);
    expect(turnSessionReducer(loading, scramble)).toBe(loading);
    const failed = turnSessionReducer(ready, { type: "scene-failed" });
    expect(turnSessionReducer(failed, scramble)).toBe(failed);
    const manual = turnSessionReducer(ready, start);
    expect(turnSessionReducer(manual, scramble)).toBe(manual);
    const undo = turnSessionReducer(finish(manual), { type: "undo" });
    expect(turnSessionReducer(undo, scramble)).toBe(undo);
  });

  it("runs one move at a time, records each completion once, and never unlocks between moves", () => {
    const prior = finish(turnSessionReducer(ready, start));
    let session = turnSessionReducer(prior, scramble);
    expect(session.puzzle).toBe(prior.puzzle);
    expect(session.history).toBe(prior.history);
    expect(session.scramble?.moves).toEqual(sequence);
    expect(session.scramble?.moves).not.toBe(sequence);
    const ids = new Set<number>();
    for (const [index, next] of sequence.entries()) {
      expect(session.activeTurn?.move).toEqual(next);
      expect(session.activeTurn?.kind).toBe("scramble");
      expect(session.scramble?.completed).toBe(index);
      expect(session.history).toEqual([...prior.history, ...sequence.slice(0, index)]);
      expect(turnSessionReducer(session, start)).toBe(session);
      expect(turnSessionReducer(session, { type: "undo" })).toBe(session);
      expect(turnSessionReducer(session, scramble)).toBe(session);
      const id = session.activeTurn!.id;
      expect(ids.has(id)).toBe(false);
      ids.add(id);
      expect(turnSessionReducer(session, { type: "complete", id: id - 1 })).toBe(session);
      session = finish(session);
      expect(turnSessionReducer(session, { type: "complete", id })).toBe(session);
      expect(session.puzzle).toEqual(sequence.slice(0, index + 1).reduce(applyMove, prior.puzzle));
      expect(session.history.reduce(applyMove, initial)).toEqual(session.puzzle);
    }
    expect(session.activeTurn).toBeNull();
    expect(session.scramble).toBeNull();
    for (let index = 0; index < sequence.length; index++) {
      session = finish(turnSessionReducer(session, { type: "undo" }));
    }
    expect(session.puzzle).toEqual(prior.puzzle);
    expect(session.history).toEqual(prior.history);
  });

  it.each([0, 1, 11])("failure after %s completions discards only unfinished and queued turns", (count) => {
    let session = turnSessionReducer(ready, scramble);
    for (let index = 0; index < count; index++) session = finish(session);
    const id = session.activeTurn!.id;
    const failed = turnSessionReducer(session, { type: "scene-failed" });
    expect(failed.puzzle).toBe(session.puzzle);
    expect(failed.history).toBe(session.history);
    expect(failed.history).toEqual(sequence.slice(0, count));
    expect(failed.scramble).toBeNull();
    expect(failed.activeTurn).toBeNull();
    expect(turnSessionReducer(failed, { type: "complete", id })).toBe(failed);
    expect(turnSessionReducer(failed, scramble)).toBe(failed);
    expect(turnSessionReducer(failed, { type: "scene-ready" })).toBe(failed);
  });

  it("continues from the current state on repeated scrambling, including single-move sequences", () => {
    let session = ready;
    for (let repeat = 0; repeat < 2; repeat++) {
      session = turnSessionReducer(session, scramble);
      while (session.activeTurn) session = finish(session);
    }
    expect(session.history).toEqual([...sequence, ...sequence]);
    expect(session.puzzle).toEqual(session.history.reduce(applyMove, initial));
    const single = finish(turnSessionReducer(session, { type: "scramble", moves: [move] }));
    expect(single.scramble).toBeNull();
    expect(single.activeTurn).toBeNull();
    expect(single.puzzle).toEqual(applyMove(session.puzzle, move));
    expect(single.history).toEqual([...session.history, move]);
  });
});

describe("history and animated undo", () => {
  it("records only completed moves, without combining or canceling adjacent entries", () => {
    const active = turnSessionReducer(ready, start);
    expect(active.history).toBe(ready.history);
    expect(active.history).toEqual([]);
    const first = finish(active);
    expect(first.history).toEqual([move]);
    const second = finish(turnSessionReducer(first, { type: "start", move: inverseMove(move) }));
    expect(second.history).toEqual([move, inverseMove(move)]);
    expect(second.puzzle).toEqual(initial);
    expect(first.history).toEqual([move]);
    expect(ready.history).toEqual([]);
    expect(turnSessionReducer(second, { type: "complete", id: active.activeTurn!.id })).toBe(second);
  });

  it.each(allMoves)("undoes $face ($turns) using a pending inverse, then restores the exact previous pose", (lastMove) => {
    const prior = finish(turnSessionReducer(ready, start));
    const completed = finish(turnSessionReducer(prior, { type: "start", move: lastMove }));
    const undoing = turnSessionReducer(completed, { type: "undo" });
    expect(undoing.activeTurn?.kind).toBe("undo");
    expect(undoing.activeTurn?.move).toEqual(inverseMove(lastMove));
    expect(undoing.puzzle).toBe(completed.puzzle);
    expect(undoing.history).toBe(completed.history);
    expect(turnSessionReducer(undoing, start)).toBe(undoing);
    expect(turnSessionReducer(undoing, { type: "undo" })).toBe(undoing);
    expect(turnSessionReducer(undoing, { type: "complete", id: undoing.activeTurn!.id - 1 })).toBe(undoing);
    const restored = finish(undoing);
    expect(restored.puzzle).toEqual(prior.puzzle);
    expect(restored.history).toEqual(prior.history);
    expect(completed.history).toEqual([move, lastMove]);
    expect(turnSessionReducer(restored, { type: "complete", id: undoing.activeTurn!.id })).toBe(restored);
  });

  it("rejects undo on empty history, before readiness, during a manual turn, and after failure", () => {
    expect(turnSessionReducer(loading, { type: "undo" })).toBe(loading);
    expect(turnSessionReducer(ready, { type: "undo" })).toBe(ready);
    const completed = finish(turnSessionReducer(ready, start));
    const active = turnSessionReducer(completed, start);
    expect(turnSessionReducer(active, { type: "undo" })).toBe(active);
    const failed = turnSessionReducer(completed, { type: "scene-failed" });
    expect(turnSessionReducer(failed, { type: "undo" })).toBe(failed);
  });

  it.each(["manual", "undo"] as const)("preserves the committed history and pose on failure during %s", (kind) => {
    const completed = finish(turnSessionReducer(ready, start));
    const active = turnSessionReducer(completed, kind === "undo" ? { type: "undo" } : start);
    const failed = turnSessionReducer(active, { type: "scene-failed" });
    expect(failed.history).toBe(completed.history);
    expect(failed.puzzle).toBe(completed.puzzle);
    expect(failed.activeTurn).toBeNull();
    expect(turnSessionReducer(failed, { type: "complete", id: active.activeTurn!.id })).toBe(failed);
  });

  it("restores every snapshot of a long mixed sequence and starts a new branch after undo", () => {
    let session = ready;
    const snapshots = [ready];
    for (let index = 0; index < 100; index++) {
      const next = allMoves[(index * 7) % allMoves.length]!;
      session = finish(turnSessionReducer(session, { type: "start", move: next }));
      snapshots.push(session);
      expect(session.history.reduce(applyMove, initial)).toEqual(session.puzzle);
    }
    for (let index = 99; index >= 0; index--) {
      session = finish(turnSessionReducer(session, { type: "undo" }));
      expect(session.puzzle).toEqual(snapshots[index]!.puzzle);
      expect(session.history).toEqual(snapshots[index]!.history);
    }
    expect(session.history).toEqual([]);
    expect(turnSessionReducer(session, { type: "undo" })).toBe(session);

    const first = finish(turnSessionReducer(session, start));
    const second = finish(turnSessionReducer(first, start));
    const undone = finish(turnSessionReducer(second, { type: "undo" }));
    const branchMove = { face: "B", turns: 2 } as const;
    const branch = finish(turnSessionReducer(undone, { type: "start", move: branchMove }));
    expect(branch.history).toEqual([move, branchMove]);
    expect(branch.puzzle).toEqual(applyMove(first.puzzle, branchMove));
    expect(finish(turnSessionReducer(branch, { type: "undo" })).puzzle).toEqual(first.puzzle);
  });
});

describe("turn transaction", () => {
  it("rejects starts before readiness and after scene failure", () => {
    expect(turnSessionReducer(loading, start)).toBe(loading);
    const failed = turnSessionReducer(ready, { type: "scene-failed" });
    expect(turnSessionReducer(failed, start)).toBe(failed);
    expect(turnSessionReducer(failed, { type: "scene-ready" })).toBe(failed);
  });

  it("accepts one start but does not modify committed state until completion", () => {
    const active = turnSessionReducer(ready, start);
    expect(active.puzzle).toBe(initial);
    expect(active.activeTurn?.move).toEqual(move);
    expect(turnSessionReducer(active, start)).toBe(active);
    expect(turnSessionReducer(active, { type: "start", move: { face: "U", turns: -1 } })).toBe(active);
    const completed = turnSessionReducer(active, { type: "complete", id: active.activeTurn!.id });
    expect(completed.puzzle).toEqual(applyMove(initial, move));
    expect(completed.activeTurn).toBeNull();
    expect(initial).toEqual(createSolvedState(createSolvedCube()));
  });

  it("ignores stale and duplicate callbacks, including during an identical next move", () => {
    const first = turnSessionReducer(ready, start);
    const id = first.activeTurn!.id;
    expect(turnSessionReducer(first, { type: "complete", id: id + 1 })).toBe(first);
    const completed = turnSessionReducer(first, { type: "complete", id });
    expect(turnSessionReducer(completed, { type: "complete", id })).toBe(completed);
    const second = turnSessionReducer(completed, start);
    expect(second.activeTurn!.id).toBeGreaterThan(id);
    expect(turnSessionReducer(second, { type: "complete", id })).toBe(second);
  });

  it("cancels unfinished animation on failure and preserves the last committed puzzle", () => {
    const active = turnSessionReducer(ready, start);
    const failed = turnSessionReducer(active, { type: "scene-failed" });
    expect(failed.puzzle).toBe(initial);
    expect(failed.activeTurn).toBeNull();
    expect(failed.sceneStatus).toBe("failed");
    expect(turnSessionReducer(failed, { type: "complete", id: active.activeTurn!.id })).toBe(failed);
  });
});

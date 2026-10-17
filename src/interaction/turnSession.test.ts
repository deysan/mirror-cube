import { describe, expect, it } from "vitest";
import { createSolvedCube } from "../puzzle/model";
import { applyMove, type Move } from "../puzzle/moves";
import { createSolvedState } from "../puzzle/state";
import { createTurnSession, turnSessionReducer } from "./turnSession";

const initial = createSolvedState(createSolvedCube());
const loading = createTurnSession(initial);
const ready = turnSessionReducer(loading, { type: "scene-ready" });
const move: Move = { face: "R", turns: 1 };
const start = { type: "start", move } as const;

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

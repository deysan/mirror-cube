import { describe, expect, it } from "vitest";
import { createTurnSession, turnSessionReducer as reduce, type TurnAction } from "./turnSession";
import { createSolvedCube } from "../puzzle/model";
import { createSolvedState } from "../puzzle/state";
import { applyMove } from "../puzzle/moves";
import { draftFromState } from "../puzzle/draft";
import { PIECE_IDS } from "../puzzle/corners";
import { isSolved } from "../puzzle/solved";
import { solvePuzzle } from "../solver/search";
import { createSolverTables } from "../solver/tables";
const initial = createSolvedState(createSolvedCube());
const loading = createTurnSession(initial), ready = reduce(loading, { type: "scene-ready" });
const open = { type: "editor-open" } as const;
const edit = { type: "editor-edit", edit: { type: "assign", slot: "+++", pieceId: "---" } } as const;

describe("state-builder transaction", () => {
  it("opens only when ready and idle, never during a turn, replay, scramble, or search", () => {
    const turns = reduce(ready, { type: "start", move: { face: "R", turns: 1 } });
    const searching = reduce(ready, { type: "find-solution" });
    const scrambling = reduce(ready, { type: "scramble", moves: [{ face: "U", turns: 1 }] });
    for (const session of [loading, turns, searching, scrambling, reduce(ready, { type: "scene-failed" }),
      { ...turns, activeTurn: { ...turns.activeTurn!, kind: "replay" as const, previewState: initial } }]) expect(reduce(session, open)).toBe(session);
    const editing = reduce(ready, open); expect(editing.editor).toHaveLength(8); expect(reduce(editing, open)).toBe(editing);
  });
  it("blocks all old commands and stale replies while editing; cancelling preserves the old plan/history", () => {
    const turned = reduce(reduce(ready, { type: "start", move: { face: "R", turns: 1 } }), { type: "complete", id: 1 });
    const searched = reduce(reduce(turned, { type: "find-solution" }), { type: "search-result", response: {
      id: 1, result: { status: "solution", moves: [{ face: "R", turns: -1 }], visitedNodes: 1 } } });
    const editor = reduce(reduce(searched, open), edit);
    const blocked: TurnAction[] = [{ type: "start", move: { face: "U", turns: 1 } }, { type: "undo" },
      { type: "scramble", moves: [{ face: "F", turns: 2 }] }, { type: "complete", id: 1 }, { type: "find-solution" },
      { type: "reset", state: initial }, { type: "solution-next" }, { type: "solution-go", completed: 1 },
      { type: "solution-replay" }, { type: "cancel-search" }, { type: "search-result", response: { id: 1, result: { status: "cancelled", visitedNodes: 0 } } }];
    for (const action of blocked) expect(reduce(editor, action)).toBe(editor);
    const cancelled = reduce(editor, { type: "editor-cancel" });
    expect(cancelled).toEqual(searched); expect(cancelled.puzzle).toBe(searched.puzzle);
    expect(cancelled.history).toBe(searched.history); expect(cancelled.playback).toBe(searched.playback);
  });
  it("validates on apply, preserves invalid drafts, commits a fresh snapshot without resetting IDs", () => {
    const source = { ...ready, history: [{ face: "R", turns: 1 }] as const, nextTurnId: 50, nextSearchId: 60 };
    let session = reduce(source, open);
    expect(reduce(session, { type: "editor-apply" })).toBe(session);
    session = reduce(session, { type: "editor-copy" });
    session = reduce(session, { type: "editor-edit", edit: { type: "twist", slot: "+++" } });
    expect(reduce(session, { type: "editor-apply" })).toBe(session);
    session = reduce(session, { type: "editor-edit", edit: { type: "twist", slot: "---" } });
    session = reduce(session, { type: "editor-edit", edit: { type: "twist", slot: "---" } });
    const applied = reduce(session, { type: "editor-apply" });
    expect(applied.editor).toBeNull(); expect(applied.history).toEqual([]); expect(applied.search.status).toBe("idle");
    expect(applied.playback).toBeNull(); expect(applied.nextTurnId).toBe(50); expect(applied.nextSearchId).toBe(60);
    expect(applied.puzzle).not.toBe(source.puzzle); expect(reduce(applied, { type: "editor-apply" })).toBe(applied);
    expect(reduce(applied, { type: "complete", id: 49 })).toBe(applied);
  });
  it("keeps a failed-scene draft available for cancellation, but refuses edits or commits", () => {
    const editing = reduce(reduce(ready, open), { type: "editor-copy" });
    const failed = reduce(editing, { type: "scene-failed" });
    expect(failed.editor).toBe(editing.editor); expect(failed.puzzle).toBe(ready.puzzle);
    for (const action of [edit, { type: "editor-copy" }, { type: "editor-clear" }, { type: "editor-apply" }] as const) expect(reduce(failed, action)).toBe(failed);
    expect(reduce(failed, { type: "editor-cancel" }).puzzle).toBe(ready.puzzle);
  });
  it("constructs an independent history-free input and completes real solver playback", () => {
    const target = [{ face: "R", turns: 1 }, { face: "U", turns: -1 }, { face: "F", turns: 2 }] as const;
    const expected = target.reduce(applyMove, initial), placements = draftFromState(expected);
    let session = reduce(ready, open);
    placements.forEach((p, index) => {
      session = reduce(session, { type: "editor-edit", edit: { type: "assign", slot: PIECE_IDS[index]!, pieceId: p!.pieceId } });
      for (let i = 0; i < p!.twist; i++) session = reduce(session, { type: "editor-edit", edit: { type: "twist", slot: PIECE_IDS[index]! } });
    });
    session = reduce(session, { type: "editor-apply" });
    expect(session.puzzle).toEqual(expected); expect(session.history).toEqual([]);
    session = reduce(session, { type: "find-solution" });
    const result = solvePuzzle(session.puzzle, createSolverTables());
    if (result.status !== "solution") throw Error("Expected solution.");
    session = reduce(session, { type: "search-result", response: { id: 1, result } });
    session = reduce(session, { type: "solution-go", completed: result.moves.length });
    while (session.activeTurn) session = reduce(session, { type: "complete", id: session.activeTurn.id });
    expect(isSolved(session.puzzle)).toBe(true); expect(session.history).toEqual(result.moves);
    expect(session.playback?.status).toBe("complete");
  });
});

import { describe, expect, it, vi } from "vitest";
import { createSolvedCube } from "../puzzle/model";
import { applyMove } from "../puzzle/moves";
import { isSolved } from "../puzzle/solved";
import { createSolvedState } from "../puzzle/state";
import { solvePuzzle } from "./search";
import { createSolverTables } from "./tables";
import { createSolverHandler } from "./workerHandler";

const initial = createSolvedState(createSolvedCube());

describe("worker request handler", () => {
  it("constructs tables only on demand, reuses them, and returns verified history-free solutions", () => {
    const build = vi.fn(createSolverTables);
    const search = vi.fn(solvePuzzle);
    const handle = createSolverHandler(build, search);
    expect(build).not.toHaveBeenCalled();
    const first = handle({ id: 4, state: initial });
    expect(first).toEqual({ id: 4, result: { status: "solution", moves: [], visitedNodes: 0 } });
    const state = applyMove(initial, { face: "B", turns: 2 });
    const next = handle({ id: 5, state: JSON.parse(JSON.stringify(state)) });
    expect(next.id).toBe(5);
    expect(next.result.status).toBe("solution");
    if (next.result.status === "solution") expect(isSolved(next.result.moves.reduce(applyMove, state))).toBe(true);
    expect(build).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(2);
    expect(search.mock.calls[0]![1]).toBe(search.mock.calls[1]![1]);
    const invalid = handle({ id: 6, state: { corners: [] } });
    expect(invalid.result).toEqual({ status: "invalid", error: { code: "corner-count" } });
  });

  it.each(["initialization", "search"] as const)("contains %s exceptions without leaking internal messages", (phase) => {
    const build = vi.fn(createSolverTables);
    const search = vi.fn(solvePuzzle);
    const fail = () => { throw new Error("private implementation details"); };
    if (phase === "initialization") build.mockImplementationOnce(fail);
    else search.mockImplementationOnce(fail);
    const handle = createSolverHandler(build, search);
    expect(handle({ id: 1, state: initial })).toEqual({ id: 1, result: { status: "error", reason: "worker" } });
    expect(handle({ id: 2, state: initial }).result.status).toBe("solution");
    expect(build).toHaveBeenCalledTimes(2);
  });
});

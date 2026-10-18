// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { StrictMode, useEffect, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { CubeScene } from "./components/CubeScene";
import { messages } from "./i18n/messages";
import { SOLVER_WATCHDOG_MS, type SolverWorker } from "./interaction/solverClient";
import type { SolverOutcome, SolverRequest, SolverResponse } from "./solver/workerProtocol";

vi.mock("./components/CubeScene", () => ({ CubeScene: vi.fn() }));
function SceneStub({ onReady }: ComponentProps<typeof CubeScene>) {
  useEffect(onReady, [onReady]);
  return <canvas data-testid="scene-canvas" />;
}
function scene() { return vi.mocked(CubeScene).mock.calls.at(-1)![0]; }
const en = messages.en, uk = messages.uk;
const solution: SolverOutcome = { status: "solution", moves: [{ face: "R", turns: -1 }], visitedNodes: 3 };

class WorkerStub implements SolverWorker {
  static instances: WorkerStub[] = [];
  onmessage: SolverWorker["onmessage"] = null;
  onerror: SolverWorker["onerror"] = null;
  onmessageerror: SolverWorker["onmessageerror"] = null;
  postMessage = vi.fn<(request: SolverRequest) => void>();
  terminate = vi.fn();
  constructor(readonly url: URL, readonly options: WorkerOptions) { WorkerStub.instances.push(this); }
  reply(result: SolverOutcome, id = this.postMessage.mock.calls.at(-1)![0].id) {
    act(() => this.onmessage?.({ data: { id, result } } as MessageEvent<SolverResponse>));
  }
}
const worker = () => WorkerStub.instances.at(-1)!;
const find = () => fireEvent.click(screen.getByRole("button", { name: en.findSolution }));
function turn() {
  fireEvent.click(screen.getByRole("button", { name: "R Right" }));
  act(() => scene().onTurnComplete(scene().activeTurn!.id));
}

beforeEach(() => {
  WorkerStub.instances = [];
  vi.stubGlobal("Worker", WorkerStub);
  vi.mocked(CubeScene).mockImplementation(SceneStub);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("worker-backed solution UI", () => {
  it("creates no worker on mount, including Strict Mode, and gates search during loading and animation", () => {
    vi.mocked(CubeScene).mockImplementation(() => <canvas />);
    render(<StrictMode><App /></StrictMode>);
    expect(WorkerStub.instances).toHaveLength(0);
    const button = screen.getByRole("button", { name: en.findSolution });
    expect(button.matches(":disabled")).toBe(true);
    act(() => scene().onReady());
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    expect(button.matches(":disabled")).toBe(true);
    act(() => scene().onTurnComplete(scene().activeTurn!.id));
    find();
    expect(WorkerStub.instances).toHaveLength(1);
    worker().reply(solution);
    expect(button.matches(":disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: en.undoLastMove }));
    expect(button.matches(":disabled")).toBe(true);
    act(() => scene().onTurnComplete(scene().activeTurn!.id));
    fireEvent.click(screen.getByRole("button", { name: "Scramble (12)" }));
    expect(button.matches(":disabled")).toBe(true);
  });

  it("sends only the committed snapshot, locks competing controls, and preserves work/result across languages", () => {
    render(<App />);
    turn();
    const snapshot = scene().state, canvas = screen.getByTestId("scene-canvas");
    find();
    const activeWorker = worker();
    expect(activeWorker.options).toEqual({ type: "module" });
    expect(activeWorker.url.pathname).toContain("solver.worker.ts");
    expect(activeWorker.postMessage).toHaveBeenCalledExactlyOnceWith({ id: 1, state: snapshot });
    expect(screen.getByText(en.searchRunning).getAttribute("aria-live")).toBe("polite");
    expect(screen.getByText(en.searching)).toBeDefined();
    for (const name of [en.findSolution, en.undoLastMove, "Scramble (12)", "R Right"]) {
      const button = screen.getByRole("button", { name });
      expect(button.matches(":disabled")).toBe(true);
      fireEvent.click(button);
    }
    expect(screen.getByRole("radio", { name: en.turnOptions[1] }).matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText(uk.searchRunning)).toBeDefined();
    expect(screen.getByText(uk.searching)).toBeDefined();
    expect(WorkerStub.instances).toHaveLength(1);
    expect(activeWorker.postMessage).toHaveBeenCalledTimes(1);
    expect(scene().state).toBe(snapshot);
    expect(screen.getByTestId("scene-canvas")).toBe(canvas);
    activeWorker.reply(solution);
    const region = screen.getByRole("region", { name: uk.solutionTitle });
    expect(within(region).getByText(`${uk.solutionCount}: 1`)).toBeDefined();
    expect(within(region).getByRole("list", { name: uk.solutionMoves }).textContent).toContain("R′Права · 90° проти годинникової");
    expect(scene().state).toBe(snapshot);
    expect(scene().activeTurn).toBeNull();
    expect(screen.getByText("Записані ходи: 1")).toBeDefined();
    expect(activeWorker.terminate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(screen.getByRole("list", { name: en.solutionMoves }).textContent).toContain("Right");
    find();
    expect(WorkerStub.instances).toHaveLength(1);
    expect(activeWorker.postMessage).toHaveBeenLastCalledWith({ id: 2, state: snapshot });
  });

  it("shows an already-solved result without a move list or changing history", () => {
    render(<App />);
    const before = scene().state;
    find();
    worker().reply({ status: "solution", moves: [], visitedNodes: 0 });
    expect(screen.getByText(en.searchSolved)).toBeDefined();
    expect(screen.queryByRole("list", { name: en.solutionMoves })).toBeNull();
    expect(scene().state).toBe(before);
    expect(screen.getByText(en.historyEmpty)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText(uk.searchSolved)).toBeDefined();
  });

  it("terminates cancellation and rejects stale events after retry and after a puzzle change", () => {
    render(<App />);
    turn();
    const before = scene().state;
    find();
    const oldWorker = worker(), late = oldWorker.onmessage!;
    fireEvent.click(screen.getByRole("button", { name: en.cancelSearch }));
    expect(oldWorker.terminate).toHaveBeenCalledTimes(1);
    expect(screen.getByText(en.searchCancelled)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText(uk.searchCancelled)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    expect(scene().state).toBe(before);
    find();
    expect(WorkerStub.instances).toHaveLength(2);
    act(() => late({ data: { id: 1, result: solution } } as MessageEvent<SolverResponse>));
    expect(screen.getByText(en.searchRunning)).toBeDefined();
    worker().reply(solution);
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    expect(screen.queryByRole("list", { name: en.solutionMoves })).toBeNull();
    expect(screen.getByText(en.searchIdle)).toBeDefined();
    act(() => late({ data: { id: 1, result: solution } } as MessageEvent<SolverResponse>));
    expect(screen.queryByRole("list", { name: en.solutionMoves })).toBeNull();
    expect(scene().state).toBe(before); // Invalidated before the visual turn commits.
  });

  it("disposes pending work on scene failure and on unmount without accepting late responses", () => {
    const view = render(<StrictMode><App /></StrictMode>);
    find();
    const active = worker(), late = active.onmessage!;
    act(() => scene().onFailure());
    expect(active.terminate).toHaveBeenCalledTimes(1);
    act(() => late({ data: { id: 1, result: solution } } as MessageEvent<SolverResponse>));
    expect(screen.getByRole("button", { name: en.findSolution }).matches(":disabled")).toBe(true);
    expect(screen.queryByRole("list", { name: en.solutionMoves })).toBeNull();
    view.unmount();
    render(<App />);
    find();
    const next = worker();
    cleanup();
    expect(next.terminate).toHaveBeenCalledTimes(1);
  });

  it("reports unsupported workers, worker failures, and watchdog expiry without disabling manual turns", () => {
    vi.useFakeTimers();
    vi.stubGlobal("Worker", undefined);
    render(<App />);
    find();
    expect(screen.getByText(en.searchError)).toBeDefined();
    expect(screen.getByRole("button", { name: "R Right" }).matches(":disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText(uk.searchError)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "English" }));
    vi.stubGlobal("Worker", WorkerStub);
    find();
    act(() => worker().onerror!({ preventDefault() {} } as ErrorEvent));
    expect(screen.getByText(en.searchError)).toBeDefined();
    find();
    act(() => vi.advanceTimersByTime(SOLVER_WATCHDOG_MS));
    expect(screen.getByText(en.searchTimeout)).toBeDefined();
    expect(worker().terminate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText(uk.searchTimeout)).toBeDefined();
    expect(screen.getByRole("button", { name: uk.findSolution }).matches(":disabled")).toBe(false);
  });

  it.each(["depth", "nodes", "time"] as const)("localizes %s limits without claiming unsolvability", (reason) => {
    render(<App />);
    find();
    worker().reply({ status: "limit", reason, visitedNodes: 10 });
    expect(screen.getByText(`${en.searchLimit} ${en.searchLimits[reason]}`)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText(`${uk.searchLimit} ${uk.searchLimits[reason]}`)).toBeDefined();
  });

  it.each(Object.keys(en.stateErrors) as (keyof typeof en.stateErrors)[])("localizes invalid state diagnostic %s", (code) => {
    render(<App />);
    find();
    worker().reply({ status: "invalid", error: { code, cornerIndex: 3 } });
    expect(screen.getByText(`${en.searchInvalid} ${en.stateErrors[code]} ${en.invalidCorner}: 4.`)).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText(`${uk.searchInvalid} ${uk.stateErrors[code]} ${uk.invalidCorner}: 4.`)).toBeDefined();
  });
});

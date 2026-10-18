// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useEffect, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { CubeScene } from "./components/CubeScene";
import { messages } from "./i18n/messages";
import { applyMove, type Move } from "./puzzle/moves";
import { isSolved } from "./puzzle/solved";
import type { SolverWorker } from "./interaction/solverClient";
import type { SolverOutcome, SolverRequest, SolverResponse } from "./solver/workerProtocol";

vi.mock("./components/CubeScene", () => ({ CubeScene: vi.fn() }));
function SceneStub({ onReady }: ComponentProps<typeof CubeScene>) {
  useEffect(onReady, [onReady]);
  return <canvas data-testid="scene-canvas" />;
}
function scene() { return vi.mocked(CubeScene).mock.calls.at(-1)![0]; }
const en = messages.en, uk = messages.uk;
class WorkerStub implements SolverWorker {
  static instances: WorkerStub[] = [];
  onmessage: SolverWorker["onmessage"] = null;
  onerror: SolverWorker["onerror"] = null;
  onmessageerror: SolverWorker["onmessageerror"] = null;
  postMessage = vi.fn<(request: SolverRequest) => void>();
  terminate = vi.fn();
  constructor() { WorkerStub.instances.push(this); }
  reply(result: SolverOutcome, id = this.postMessage.mock.calls.at(-1)![0].id) {
    act(() => this.onmessage?.({ data: { id, result } } as MessageEvent<SolverResponse>));
  }
}
const worker = () => WorkerStub.instances.at(-1)!;
const find = () => fireEvent.click(screen.getByRole("button", { name: en.findSolution }));
const next = () => fireEvent.click(screen.getByRole("button", { name: en.nextSolutionStep }));
const moves: readonly Move[] = [{ face: "F", turns: 2 }, { face: "U", turns: -1 }, { face: "R", turns: -1 }];
function preparePlayback() {
  render(<StrictMode><App /></StrictMode>);
  for (const name of ["R Right", "U Top", "F Front"]) {
    if (name === "F Front") fireEvent.click(screen.getByRole("radio", { name: en.turnOptions[2] }));
    fireEvent.click(screen.getByRole("button", { name }));
    act(() => scene().onTurnComplete(scene().activeTurn!.id));
  }
  find();
  worker().reply({ status: "solution", moves, visitedNodes: 10 });
}
beforeEach(() => {
  WorkerStub.instances = [];
  vi.stubGlobal("Worker", WorkerStub);
  vi.mocked(CubeScene).mockImplementation(SceneStub);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("animated solution playback UI", () => {
  it("executes one explicit step at a time and preserves progress, canvas, and pending turn across languages", () => {
    preparePlayback();
    const canvas = screen.getByTestId("scene-canvas"), cube = scene().cube;
    let expected = scene().state;
    expect(screen.getByText(`${en.solutionProgress}: 0/3`)).toBeDefined();
    expect(scene().activeTurn).toBeNull();
    expect(screen.getByText(en.playbackOrientation)).toBeDefined();
    for (const [index, move] of moves.entries()) {
      const list = screen.getByRole("list", { name: en.solutionMoves });
      expect([...list.children].findIndex(row => row.getAttribute("aria-current") === "step")).toBe(index);
      next();
      const pending = scene().activeTurn!;
      expect(pending.move).toEqual(move); // Independent of the selected manual half-turn.
      expect(pending.kind).toBe("solution");
      expect(scene().state).toBe(expected);
      expect(screen.getByText(`${en.solutionProgress}: ${index}/3`)).toBeDefined();
      expect(screen.getByText(`Recorded moves: ${3 + index}`)).toBeDefined();
      for (const name of [en.nextSolutionStep, en.findSolution, en.undoLastMove, "R Right", "Scramble (12)"]) {
        const button = screen.getByRole("button", { name });
        expect(button.matches(":disabled")).toBe(true); fireEvent.click(button);
      }
      act(() => scene().onTurnComplete(pending.id - 1));
      expect(scene().state).toBe(expected);
      fireEvent.click(screen.getByRole("button", { name: "Українська" }));
      expect(scene().activeTurn).toBe(pending);
      expect(screen.getByText(uk.stepInProgress)).toBeDefined();
      expect(screen.getByText(uk.playbackOrientation)).toBeDefined();
      expect(screen.getByText(`${uk.solutionStep} ${index + 1}/3: ${move.face} · ${uk.faceNames[move.face]} · ${uk.turnOptions[move.turns]}`)).toBeDefined();
      act(() => scene().onTurnComplete(pending.id));
      expected = applyMove(expected, move);
      expect(scene().state).toEqual(expected); expected = scene().state;
      expect(scene().activeTurn).toBeNull();
      expect(screen.getByText(`${uk.solutionProgress}: ${index + 1}/3`)).toBeDefined();
      expect(screen.getByText(`Записані ходи: ${4 + index}`)).toBeDefined();
      act(() => scene().onTurnComplete(pending.id));
      expect(scene().state).toBe(expected);
      expect(screen.getByTestId("scene-canvas")).toBe(canvas);
      expect(scene().cube).toBe(cube);
      expect(worker().postMessage).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole("button", { name: "English" }));
    }
    expect(isSolved(scene().state)).toBe(true);
    expect(screen.getByText(en.solutionComplete)).toBeDefined();
    expect(screen.getByRole("button", { name: en.nextSolutionStep }).matches(":disabled")).toBe(true);
    expect(screen.getByRole("list", { name: en.solutionMoves }).querySelector("[aria-current]")).toBeNull();
    expect(screen.getAllByText(en.stepCompleted)).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText(uk.solutionComplete)).toBeDefined();
  });

  it("allows undo between steps, discards the plan, and searches the restored snapshot with the same worker", () => {
    preparePlayback();
    const start = scene().state;
    next();
    const oldId = scene().activeTurn!.id;
    act(() => scene().onTurnComplete(oldId));
    fireEvent.click(screen.getByRole("button", { name: en.undoLastMove }));
    expect(screen.queryByRole("button", { name: en.nextSolutionStep })).toBeNull();
    expect(screen.queryByRole("list", { name: en.solutionMoves })).toBeNull();
    act(() => scene().onTurnComplete(scene().activeTurn!.id));
    expect(scene().state).toEqual(start);
    expect(screen.getByText("Recorded moves: 3")).toBeDefined();
    find();
    expect(WorkerStub.instances).toHaveLength(1);
    expect(worker().postMessage).toHaveBeenLastCalledWith({ id: 2, state: scene().state });
    worker().reply({ status: "solution", moves, visitedNodes: 10 }, 1);
    expect(screen.getByText(en.searchRunning)).toBeDefined();
    worker().reply({ status: "solution", moves, visitedNodes: 10 });
    expect(screen.getByText(`${en.solutionProgress}: 0/3`)).toBeDefined();
    next();
    act(() => scene().onTurnComplete(oldId));
    expect(screen.getByText(`${en.solutionProgress}: 0/3`)).toBeDefined();
    expect(scene().activeTurn!.id).toBeGreaterThan(oldId);
  });

  it("preserves the completed prefix on scene failure and ignores unfinished step callbacks", () => {
    preparePlayback(); next();
    act(() => scene().onTurnComplete(scene().activeTurn!.id));
    next();
    const pending = scene();
    act(() => pending.onFailure());
    act(() => pending.onTurnComplete(pending.activeTurn!.id));
    expect(screen.getByText("Recorded moves: 4")).toBeDefined();
    expect(screen.queryByRole("button", { name: en.nextSolutionStep })).toBeNull();
    expect(screen.queryByText(en.solutionComplete)).toBeNull();
    expect(screen.getByRole("button", { name: en.findSolution }).matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText("Записані ходи: 4")).toBeDefined();
  });

  it("reports a localized failure instead of success for an injected incorrect sequence", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    act(() => scene().onTurnComplete(scene().activeTurn!.id));
    find();
    worker().reply({ status: "solution", moves: [{ face: "R", turns: 1 }], visitedNodes: 0 });
    next();
    act(() => scene().onTurnComplete(scene().activeTurn!.id));
    expect(screen.getByText(en.playbackFailed)).toBeDefined();
    expect(screen.queryByText(en.solutionComplete)).toBeNull();
    expect(screen.getByRole("button", { name: en.nextSolutionStep }).matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText(uk.playbackFailed)).toBeDefined();
    expect(screen.getByRole("button", { name: uk.findSolution }).matches(":disabled")).toBe(false);
  });

  it("does not offer playback before a solution or for an already-solved empty result", () => {
    render(<App />);
    expect(screen.queryByRole("button", { name: en.nextSolutionStep })).toBeNull();
    find();
    expect(screen.queryByRole("button", { name: en.nextSolutionStep })).toBeNull();
    worker().reply({ status: "solution", moves: [], visitedNodes: 0 });
    expect(screen.getByText(en.searchSolved)).toBeDefined();
    expect(screen.queryByRole("button", { name: en.nextSolutionStep })).toBeNull();
  });
});

// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { CubeScene } from "./components/CubeScene";
import { messages } from "./i18n/messages";
import { PIECE_IDS } from "./puzzle/corners";
import { draftFromState } from "./puzzle/draft";
import { applyMove } from "./puzzle/moves";
import { isSolved } from "./puzzle/solved";
import { validatePuzzleState } from "./puzzle/validation";
import { solvePuzzle } from "./solver/search";
import { createSolverTables } from "./solver/tables";
import type { SolverRequest, SolverResponse } from "./solver/workerProtocol";
vi.mock("./components/CubeScene", () => ({ CubeScene: vi.fn() }));
const en = messages.en, uk = messages.uk;
function Scene({ onReady }: ComponentProps<typeof CubeScene>) { useEffect(onReady, [onReady]); return <canvas />; }
const scene = () => vi.mocked(CubeScene).mock.calls.at(-1)![0];
const click = (name: string) => fireEvent.click(screen.getByRole("button", { name }));
const queryClick = (selector: string) => fireEvent.click(document.querySelector(selector)!);
const disabled = (name: string) => screen.getByRole("button", { name }).matches(":disabled");
class WorkerStub {
  static instances: WorkerStub[] = [];
  onmessage: ((event: MessageEvent<SolverResponse>) => void) | null = null;
  onerror = null; onmessageerror = null;
  postMessage = vi.fn<(request: SolverRequest) => void>(); terminate = vi.fn();
  constructor() { WorkerStub.instances.push(this); }
}
beforeEach(() => {
  vi.mocked(CubeScene).mockImplementation(Scene);
  vi.spyOn(window, "confirm").mockReturnValue(true);
  WorkerStub.instances = []; vi.stubGlobal("Worker", WorkerStub);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("mirrored default geometry", () => {
  it("offers U=20, R=22, F=17 in UFR using three proper poses, without length search or a separate detail view", () => {
    render(<App />);
    const cube = scene().cube;
    expect(cube.splits).toEqual({ x: 22, y: 20, z: 33 });
    click(en.editor.open); queryClick('[data-piece="--+"]');
    expect(cube.pieces.find(p => p.id === "--+")!.dimensions).toEqual({ x: 22, y: 20, z: 17 });
    const lengths = () => [...document.querySelectorAll(".builder-dimensions dd")].map(e => e.textContent);
    expect(lengths()).toEqual(["22 mm", "20 mm", "17 mm"]);
    const pose = scene().state;
    click(en.editor.rotate); expect(lengths()).toEqual(["20 mm", "17 mm", "22 mm"]);
    click(en.editor.rotate); expect(lengths()).toEqual(["17 mm", "22 mm", "20 mm"]);
    click(en.editor.rotate); expect(scene().state).toEqual(pose);
    click("Українська"); expect(lengths()).toEqual(["22 мм", "20 мм", "17 мм"]);
    expect(scene().cube).toBe(cube);
    expect(document.querySelector(".dimension-entry, .piece-inspector, [data-measure-axis]")).toBeNull();
    expect(WorkerStub.instances).toHaveLength(0);
    click(uk.editor.cancel); click(uk.resetCube); expect(scene().cube).toBe(cube);
    expect(scene().cube.splits.z).toBe(33);
  });
});

describe("physical-state builder UI", () => {
  it("keeps free inspection separate from the draft and language, with presets and editor exit restoring fixed views", () => {
    render(<App />); const canvas = document.querySelector("canvas"), committed = scene().state;
    click(en.editor.open); queryClick('[data-piece="--+"]'); const draft = scene().state;
    click(en.editor.freeOrbit);
    expect(scene().editor!.freeOrbit).toBe(true);
    expect(within(screen.getByRole("group", { name: en.editor.camera })).getAllByRole("button")
      .every(b => b.getAttribute("aria-pressed") === "false")).toBe(true);
    click("Українська"); expect(scene().editor!.freeOrbit).toBe(true); expect(scene().state).toBe(draft);
    expect(document.querySelector("canvas")).toBe(canvas); expect(WorkerStub.instances).toHaveLength(0);
    click(uk.editor.lookSelected); expect(scene().editor!.freeOrbit).toBe(false); expect(scene().editor!.viewCorner).toBe("+++");
    click(uk.editor.freeOrbit); click(uk.editor.solutionView); expect(scene().editor!.freeOrbit).toBe(false);
    click(uk.editor.freeOrbit); click(uk.editor.freeOrbit); expect(scene().editor!.freeOrbit).toBe(false);
    click(uk.editor.freeOrbit); click(uk.editor.cancel); expect(scene().editor).toBeUndefined(); expect(scene().state).toBe(committed);
    click(uk.editor.open); expect(scene().editor!.freeOrbit).toBe(false);
    click(uk.editor.copy); click(uk.editor.freeOrbit); click(uk.editor.confirm);
    expect(scene().editor).toBeUndefined(); expect(scene().state).toEqual(committed);
    click(uk.editor.open); expect(scene().editor!.freeOrbit).toBe(false);
    act(() => scene().onFailure()); expect(disabled(uk.editor.freeOrbit)).toBe(true);
  });
  it("starts empty, disables duplicates, preserves draft/selection/view across languages, and never sends previews to a worker", () => {
    render(<App />); const original = scene().state, canvas = document.querySelector("canvas");
    click(en.editor.open); expect(scene().state.corners).toHaveLength(0); expect(disabled(en.editor.confirm)).toBe(true);
    expect(screen.queryByRole("button", { name: en.findSolution })).toBeNull();
    queryClick('[data-piece="---"]'); expect(scene().state.corners[0]!.pieceId).toBe("---");
    click(en.editor.rotate); const preview = scene().state;
    expect([...document.querySelectorAll(".builder-dimensions dt")].map(e => e.textContent)).toEqual(["R · Right", "U · Top", "F · Front"]);
    expect([...document.querySelectorAll(".builder-dimensions dd")].map(e => e.textContent)).toEqual(["20 mm", "22 mm", "33 mm"]);
    const views = screen.getByRole("group", { name: en.editor.camera });
    fireEvent.click(within(views).getAllByRole("button")[6]!);
    const camera = scene().editor!.viewCorner;
    expect(scene().state).toBe(preview);
    queryClick('[data-slot="--+"]'); expect(document.querySelector('[data-piece="---"]')!.matches(":disabled")).toBe(true);
    click("Українська"); expect(scene().state).toBe(preview); expect(scene().editor!.viewCorner).toBe(camera);
    expect(scene().editor!.selectedSlot).toBe("--+"); expect(document.querySelector("canvas")).toBe(canvas);
    expect(screen.getByText(uk.editor.incomplete)).toBeDefined(); expect(WorkerStub.instances).toHaveLength(0);
    click(uk.editor.cancel); expect(scene().state).toBe(original); expect(document.documentElement.lang).toBe("uk");
    expect(document.activeElement?.textContent).toBe(uk.editor.open);
  });
  it("requires confirmation before discarding, replacing, clearing, or committing; invalid twist is not repaired", () => {
    render(<App />); const original = scene().state;
    click(en.editor.open); click(en.editor.copy); expect(scene().state).toEqual(original);
    click(en.editor.rotate); expect(disabled(en.editor.confirm)).toBe(true); expect(screen.getByText(en.editor.twistError)).toBeDefined();
    const invalid = scene().state; vi.mocked(window.confirm).mockReturnValue(false);
    for (const label of [en.editor.cancel, en.editor.clear, en.editor.copy]) { click(label); expect(scene().state).toBe(invalid); }
    vi.mocked(window.confirm).mockReturnValue(true); click(en.editor.copy);
    const copy = scene().state; expect(disabled(en.editor.confirm)).toBe(false);
    vi.mocked(window.confirm).mockReturnValue(false); click(en.editor.confirm); expect(scene().state).toBe(copy);
    vi.mocked(window.confirm).mockReturnValue(true); click(en.editor.clear);
    expect(scene().state.corners).toHaveLength(0); expect(disabled(en.editor.confirm)).toBe(true);
    click(en.editor.cancel); expect(scene().state).toBe(original);
  });
  it("constructs a mixed state from individual choices, commits no fake history, and feeds the existing solve/playback path", () => {
    render(<App />);
    const expected = [{ face: "R", turns: 1 }, { face: "U", turns: -1 }, { face: "F", turns: 2 }].reduce(
      (state, move) => applyMove(state, move as Parameters<typeof applyMove>[1]), scene().state);
    click(en.editor.open);
    draftFromState(expected).forEach((placement, i) => {
      queryClick(`[data-slot="${PIECE_IDS[i]}"]`); queryClick(`[data-piece="${placement!.pieceId}"]`);
      for (let t = 0; t < placement!.twist; t++) click(en.editor.rotate);
    });
    expect(validatePuzzleState(scene().state)).toEqual({ valid: true, state: expected });
    expect(disabled(en.editor.confirm)).toBe(false); click(en.editor.confirm);
    expect(scene().state).toEqual(expected); expect(scene().editor).toBeUndefined();
    expect(screen.getByText(en.historyEmpty)).toBeDefined(); expect(screen.queryByText(en.editor.title)).toBeNull();
    click(en.findSolution); const worker = WorkerStub.instances[0]!;
    const request = worker.postMessage.mock.calls[0]![0]; expect(request.state).toEqual(expected);
    expect(disabled(en.editor.open)).toBe(true);
    const result = solvePuzzle(request.state, createSolverTables()); if (result.status !== "solution") throw Error("Expected solution.");
    act(() => worker.onmessage?.({ data: { id: request.id, result } } as MessageEvent<SolverResponse>));
    for (const _ of result.moves) {
      click(en.nextSolutionStep); expect(disabled(en.editor.open)).toBe(true);
      act(() => scene().onTurnComplete(scene().activeTurn!.id));
    }
    expect(isSolved(scene().state)).toBe(true); expect(screen.getByText(en.solutionComplete)).toBeDefined();
    expect(screen.getByText(`${en.historyCount}: ${result.moves.length}`)).toBeDefined();
  });
  it("keeps prior history on cancel and discards it only on a confirmed new input", () => {
    render(<App />); click("R Right"); expect(disabled(en.editor.open)).toBe(true);
    act(() => scene().onTurnComplete(scene().activeTurn!.id)); const prior = scene().state;
    click(en.editor.open); click(en.editor.copy); click(en.editor.cancel);
    expect(scene().state).toBe(prior); expect(screen.getByText(`${en.historyCount}: 1`)).toBeDefined();
    click(en.editor.open); click(en.editor.copy); click(en.editor.confirm);
    expect(scene().state).toEqual(prior); expect(scene().state).not.toBe(prior); expect(screen.getByText(en.historyEmpty)).toBeDefined();
  });
  it("retains drafts on scene failure, refuses apply, and permits cancellation without replacing the committed state", () => {
    render(<App />); click(en.editor.open); click(en.editor.copy);
    act(() => scene().onFailure());
    expect(screen.getByText(`${en.editor.count}: 8/8`)).toBeDefined(); expect(disabled(en.editor.confirm)).toBe(true);
    expect(disabled(en.editor.rotate)).toBe(true); click(en.editor.cancel);
    expect(screen.getByText(en.historyEmpty)).toBeDefined(); expect(disabled(en.editor.open)).toBe(true);
  });
});

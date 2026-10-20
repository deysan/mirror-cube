// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { useEffect, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { CubeScene } from "./components/CubeScene";
import { messages, type Language } from "./i18n/messages";
import { createSolvedCube } from "./puzzle/model";
import { applyMove } from "./puzzle/moves";
import { createScramble, SCRAMBLE_LENGTH } from "./puzzle/scramble";

vi.mock("./puzzle/model", { spy: true });
vi.mock("./puzzle/scramble", { spy: true });
// jsdom has no WebGL. Test UI/state wiring here, transforms in Node, and pixels in a browser.
vi.mock("./components/CubeScene", () => ({ CubeScene: vi.fn() }));

function SceneStub({ onReady }: ComponentProps<typeof CubeScene>) {
  useEffect(onReady, [onReady]);
  return <canvas data-testid="scene-canvas" />;
}

function sceneProps() {
  return vi.mocked(CubeScene).mock.calls.at(-1)![0];
}

beforeEach(() => {
  document.documentElement.lang = "en";
  document.head.innerHTML = '<title>MirrorCube</title><meta name="description" content="">';
  vi.mocked(CubeScene).mockImplementation(SceneStub);
});

afterEach(() => {
  cleanup();
});

function expectLanguage(language: Language) {
  const text = messages[language];
  expect(document.documentElement.lang).toBe(language);
  expect(document.title).toBe(text.documentTitle);
  expect(document.querySelector('meta[name="description"]')?.getAttribute("content"))
    .toBe(text.documentDescription);

  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(text.heroTitle);
  expect(screen.getByRole("heading", { level: 2, name: text.geometryTitle })).toBeDefined();
  expect(screen.getByRole("heading", { level: 2, name: text.controlsTitle })).toBeDefined();
  expect(screen.getByRole("group", { name: text.languageLabel })).toBeDefined();
  expect(screen.getByRole("region", { name: text.overviewLabel })).toBeDefined();

  for (const value of [
    text.intro, text.readyToTurn, text.viewLabel, text.caption,
    text.angleLabel, text.faceLabel, text.directionHint, text.orientationHint,
    text.historyTitle, text.historyEmpty, text.undoLastMove, text.scrambleHint,
    ...Object.values(text.turnOptions),
    text.geometryEyebrow, text.geometryDescription, text.cubeEdge, text.stageNote,
    ...Object.values(text.axisLayers),
  ]) {
    expect(screen.getByText(value)).toBeDefined();
  }
  expect(screen.getByRole("button", { name: `${text.scramble} (${SCRAMBLE_LENGTH})` })).toBeDefined();
  for (const dimensions of ["50", "22 / 28", "20 / 30", "33 / 17"]) {
    expect(screen.getByText(`${dimensions} ${text.millimeters}`)).toBeDefined();
  }

  const view = screen.getByRole("img", { name: text.cubeTitle });
  const descriptionId = view.getAttribute("aria-describedby")!;
  expect(document.getElementById(descriptionId)?.textContent).toBe(text.cubeDescription);
  expect(screen.getByRole("button", { name: "English" }).getAttribute("aria-pressed"))
    .toBe(String(language === "en"));
  expect(screen.getByRole("button", { name: "Українська" }).getAttribute("aria-pressed"))
    .toBe(String(language === "uk"));
}

describe("interface language", () => {
  it("starts in English with native language names and accessible button states", () => {
    render(<App />);

    expectLanguage("en");
    expect(screen.getByRole("button", { name: "English" }).getAttribute("lang")).toBe("en");
    expect(screen.getByRole("button", { name: "Українська" }).getAttribute("lang")).toBe("uk");
  });

  it("switches all page text, document metadata, units, and scene descriptions to Ukrainian", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));

    expectLanguage("uk");
    expect(screen.getByRole("heading", { level: 1 }).textContent)
      .toBe("Головоломка, де головне — форма.");
    expect(screen.queryByText(messages.en.stageNote)).toBeNull();
  });

  it("switches back without recreating definitions/state or remounting the scene", () => {
    render(<App />);
    const factory = vi.mocked(createSolvedCube);
    const creationCount = factory.mock.calls.length;
    const initialProps = vi.mocked(CubeScene).mock.calls.at(-1)![0];
    const originalData = JSON.stringify(initialProps);
    const originalView = screen.getByRole("img");
    const originalCanvas = screen.getByTestId("scene-canvas");
    expect(initialProps.cube.pieces).toHaveLength(8);
    expect(initialProps.state.corners).toHaveLength(8);

    for (const name of ["Українська", "English"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      const props = vi.mocked(CubeScene).mock.calls.at(-1)![0];
      expect(screen.getByRole("img")).toBe(originalView);
      expect(screen.getByTestId("scene-canvas")).toBe(originalCanvas);
      expect(props.cube).toBe(initialProps.cube);
      expect(props.state).toBe(initialProps.state);
      expect(JSON.stringify(props)).toBe(originalData);
      expect(factory.mock.calls).toHaveLength(creationCount);
    }

    expectLanguage("en");
  });

  it("keeps the active language when its button is pressed again", () => {
    render(<App />);
    const ukrainian = screen.getByRole("button", { name: "Українська" });
    fireEvent.click(ukrainian);
    fireEvent.click(ukrainian);

    expectLanguage("uk");
  });

  it("keeps measurements and language switching available if the 3D scene fails", () => {
    vi.mocked(CubeScene).mockImplementation(() => { throw new Error("WebGL unavailable"); });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<App />);
      expect(screen.getByRole("status").textContent).toBe(messages.en.sceneUnavailable);
      expect(screen.queryByRole("img")).toBeNull();
      expect(screen.getByText("50 mm")).toBeDefined();
      expect(screen.getByRole("button", { name: "R Right" }).matches(":disabled")).toBe(true);

      fireEvent.click(screen.getByRole("button", { name: "Українська" }));
      expect(screen.getByRole("status").textContent).toBe(messages.uk.sceneUnavailable);
      expect(screen.getByText("50 мм")).toBeDefined();
    } finally {
      errorLog.mockRestore();
    }
  });
});

describe("animated scrambling interface", () => {
  it("samples once, preserves prior history, and executes the sequence across language changes", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    act(() => sceneProps().onTurnComplete(sceneProps().activeTurn!.id));
    const prior = sceneProps().state;
    const canvas = screen.getByTestId("scene-canvas");
    const sequence = createScramble(() => 0.4);
    vi.mocked(createScramble).mockReturnValueOnce(sequence);
    const samples = vi.mocked(createScramble).mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: "Scramble (12)" }));
    expect(createScramble).toHaveBeenCalledTimes(samples + 1);
    expect(sceneProps().state).toBe(prior);
    expect(screen.getByText("Recorded moves: 1")).toBeDefined();
    const pending = sceneProps().activeTurn;
    fireEvent.click(screen.getByRole("button", { name: "Scramble (12)" }));
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(sceneProps().activeTurn).toBe(pending);
    expect(sceneProps().state).toBe(prior);
    expect(screen.getByTestId("scene-canvas")).toBe(canvas);
    expect(createScramble).toHaveBeenCalledTimes(samples + 1);

    for (const [index, move] of sequence.entries()) {
      expect(sceneProps().activeTurn?.move).toEqual(move);
      expect(screen.getByText(`Перемішування ${index + 1}/12: ${move.face} · ${messages.uk.faceNames[move.face]} · ${messages.uk.turnOptions[move.turns]}`)).toBeDefined();
      for (const name of ["Перемішати (12)", "R Права", messages.uk.undoLastMove]) {
        expect(screen.getByRole("button", { name }).matches(":disabled")).toBe(true);
        fireEvent.click(screen.getByRole("button", { name }));
      }
      const id = sceneProps().activeTurn!.id;
      act(() => sceneProps().onTurnComplete(id));
      const after = sceneProps().state;
      act(() => sceneProps().onTurnComplete(id));
      expect(sceneProps().state).toBe(after);
      expect(screen.getByText(`Записані ходи: ${index + 2}`)).toBeDefined();
    }
    expect(sceneProps().state).toEqual(sequence.reduce(applyMove, prior));
    expect(sceneProps().activeTurn).toBeNull();
    expect(screen.getByText(messages.uk.readyToTurn)).toBeDefined();
    expect(screen.getByRole("button", { name: "Перемішати (12)" }).matches(":disabled")).toBe(false);
    expect(createScramble).toHaveBeenCalledTimes(samples + 1);
    for (let index = 0; index < sequence.length; index++) {
      fireEvent.click(screen.getByRole("button", { name: messages.uk.undoLastMove }));
      act(() => sceneProps().onTurnComplete(sceneProps().activeTurn!.id));
    }
    expect(sceneProps().state).toEqual(prior);
    expect(screen.getByText("Записані ходи: 1")).toBeDefined();
  });

  it("disables scrambling until readiness and during manual turns or undo", () => {
    vi.mocked(CubeScene).mockImplementation(() => <canvas />);
    render(<App />);
    const button = screen.getByRole("button", { name: "Scramble (12)" });
    expect(button.matches(":disabled")).toBe(true);
    act(() => sceneProps().onReady());
    expect(button.matches(":disabled")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    expect(button.matches(":disabled")).toBe(true);
    act(() => sceneProps().onTurnComplete(sceneProps().activeTurn!.id));
    fireEvent.click(screen.getByRole("button", { name: messages.en.undoLastMove }));
    expect(button.matches(":disabled")).toBe(true);
  });

  it("retains only completed scramble moves when the scene fails", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Scramble (12)" }));
    act(() => sceneProps().onTurnComplete(sceneProps().activeTurn!.id));
    const before = sceneProps();
    act(() => before.onFailure());
    act(() => before.onTurnComplete(before.activeTurn!.id));
    expect(screen.getByText("Recorded moves: 1")).toBeDefined();
    expect(screen.getByRole("button", { name: "Scramble (12)" }).matches(":disabled")).toBe(true);
    expect(screen.getByRole("status").textContent).toBe(messages.en.sceneUnavailable);
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText("Записані ходи: 1")).toBeDefined();
    expect(screen.getByRole("button", { name: "Перемішати (12)" }).matches(":disabled")).toBe(true);
  });
});

describe("history and undo interface", () => {
  function completeTurn() {
    const props = sceneProps();
    act(() => props.onTurnComplete(props.activeTurn!.id));
  }

  it("starts empty, records only completed moves, and lists newest first with notation", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: messages.en.undoLastMove }).matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    expect(screen.getByText(messages.en.historyEmpty)).toBeDefined();
    expect(screen.queryByRole("list")).toBeNull();
    completeTurn();
    expect(screen.getByText("Recorded moves: 1")).toBeDefined();
    expect(screen.getByRole("button", { name: messages.en.undoLastMove }).matches(":disabled")).toBe(false);
    fireEvent.click(screen.getByRole("radio", { name: messages.en.turnOptions[-1] }));
    fireEvent.click(screen.getByRole("button", { name: "U Top" }));
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("button", { name: messages.en.undoLastMove }).matches(":disabled")).toBe(true);
    completeTurn();
    fireEvent.click(screen.getByRole("radio", { name: messages.en.turnOptions[2] }));
    fireEvent.click(screen.getByRole("button", { name: "F Front" }));
    completeTurn();
    const items = within(screen.getByRole("list", { name: messages.en.historyTitle })).getAllByRole("listitem");
    expect(items.map((item) => item.querySelector("code")?.textContent)).toEqual(["F2", "U′", "R"]);
    expect(items[0]!.textContent).toContain("Front · 180° half-turn");
    expect(screen.getByRole("list").getAttribute("start")).toBe("3");
  });

  it("keeps history during undo, survives language switching, and restores the prior pose once", () => {
    render(<App />);
    const initial = sceneProps().state;
    const canvas = screen.getByTestId("scene-canvas");
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    completeTurn();
    const committed = sceneProps().state;
    // The angle currently selected for manual turns does not affect undo.
    fireEvent.click(screen.getByRole("radio", { name: messages.en.turnOptions[2] }));
    fireEvent.click(screen.getByRole("button", { name: messages.en.undoLastMove }));
    const undo = sceneProps().activeTurn!;
    expect(undo.move).toEqual({ face: "R", turns: -1 });
    expect(sceneProps().state).toBe(committed);
    expect(screen.getByText("Recorded moves: 1")).toBeDefined();
    expect(screen.getByRole("button", { name: messages.en.undoLastMove }).matches(":disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "F Front" }).matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: messages.en.undoLastMove }));
    fireEvent.click(screen.getByRole("button", { name: "F Front" }));
    expect(sceneProps().activeTurn).toBe(undo);
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(sceneProps().activeTurn).toBe(undo);
    expect(sceneProps().state).toBe(committed);
    expect(screen.getByText("Скасування: R · Права · 90° проти годинникової")).toBeDefined();
    expect(screen.getByText("Записані ходи: 1")).toBeDefined();
    expect(screen.getByRole("list", { name: messages.uk.historyTitle }).textContent).toContain("Права · 90° за годинниковою");
    completeTurn();
    expect(sceneProps().state).toEqual(initial);
    expect(screen.getByTestId("scene-canvas")).toBe(canvas);
    expect(screen.getByText(messages.uk.historyEmpty)).toBeDefined();
    expect(screen.getByRole("button", { name: messages.uk.undoLastMove }).matches(":disabled")).toBe(true);
    act(() => sceneProps().onTurnComplete(undo.id));
    expect(sceneProps().state).toEqual(initial);
    expect(screen.getByText("Записані ходи: 0")).toBeDefined();
  });

  it("retains the history and disables undo if the scene fails during undo", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    completeTurn();
    fireEvent.click(screen.getByRole("button", { name: messages.en.undoLastMove }));
    const before = sceneProps();
    act(() => before.onFailure());
    expect(screen.getByRole("status").textContent).toBe(messages.en.sceneUnavailable);
    expect(screen.getByText("Recorded moves: 1")).toBeDefined();
    expect(screen.getByRole("button", { name: messages.en.undoLastMove }).matches(":disabled")).toBe(true);
    act(() => before.onTurnComplete(before.activeTurn!.id));
    expect(screen.getByText("Recorded moves: 1")).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(screen.getByText("Записані ходи: 1")).toBeDefined();
    expect(screen.getByRole("button", { name: messages.uk.undoLastMove }).matches(":disabled")).toBe(true);
  });
});

describe("animated manual turns", () => {
  it("disables turns until the scene is ready", () => {
    vi.mocked(CubeScene).mockImplementation(() => <canvas />);
    render(<App />);
    const button = screen.getByRole("button", { name: "R Right" });
    expect(button.matches(":disabled")).toBe(true);
    expect(screen.getByText(messages.en.sceneLoading)).toBeDefined();
    fireEvent.click(button);
    expect(sceneProps().activeTurn).toBeNull();

    act(() => sceneProps().onReady());
    expect(button.matches(":disabled")).toBe(false);
  });

  it.each([1, -1, 2] as const)("commits a %s turn only on animation completion", (turns) => {
    render(<App />);
    const initial = sceneProps().state;
    const canvas = screen.getByTestId("scene-canvas");
    fireEvent.click(screen.getByRole("radio", { name: messages.en.turnOptions[turns] }));
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    const active = sceneProps().activeTurn!;
    expect(active.move).toEqual({ face: "R", turns });
    expect(sceneProps().state).toBe(initial);
    expect(screen.getByRole("button", { name: "F Front" }).matches(":disabled")).toBe(true);
    expect(screen.getByRole("radio", { name: messages.en.turnOptions[turns] }).matches(":disabled")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "F Front" }));
    expect(sceneProps().activeTurn).toBe(active);

    act(() => sceneProps().onTurnComplete(active.id));
    expect(sceneProps().state).toEqual(applyMove(initial, { face: "R", turns }));
    expect(sceneProps().activeTurn).toBeNull();
    expect(screen.getByRole("button", { name: "F Front" }).matches(":disabled")).toBe(false);
    expect(screen.getByTestId("scene-canvas")).toBe(canvas);
    const completed = sceneProps().state;
    act(() => sceneProps().onTurnComplete(active.id));
    expect(sceneProps().state).toBe(completed);
  });

  it("preserves the pending turn and committed pose when switching language mid-animation", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "F Front" }));
    const before = sceneProps();
    const canvas = screen.getByTestId("scene-canvas");
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));
    expect(sceneProps().activeTurn).toBe(before.activeTurn);
    expect(sceneProps().state).toBe(before.state);
    expect(screen.getByTestId("scene-canvas")).toBe(canvas);
    expect(screen.getByText("Поворот: F · Передня · 90° за годинниковою")).toBeDefined();
    expect(screen.getByRole("button", { name: "R Права" }).matches(":disabled")).toBe(true);

    act(() => sceneProps().onTurnComplete(before.activeTurn!.id));
    expect(sceneProps().state).toEqual(applyMove(before.state, { face: "F", turns: 1 }));
    expect(screen.getByText(messages.uk.readyToTurn)).toBeDefined();
  });

  it("ignores an old completion callback while the next move is running", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    const first = sceneProps().activeTurn!;
    act(() => sceneProps().onTurnComplete(first.id));
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    const second = sceneProps().activeTurn!;
    const state = sceneProps().state;
    expect(second.id).not.toBe(first.id);
    act(() => sceneProps().onTurnComplete(first.id));
    expect(sceneProps().activeTurn).toBe(second);
    expect(sceneProps().state).toBe(state);
  });

  it("locks controls and shows the fallback if the scene fails during a turn", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "R Right" }));
    const before = sceneProps();
    act(() => before.onFailure());
    expect(screen.getByRole("status").textContent).toBe(messages.en.sceneUnavailable);
    expect(screen.getByRole("button", { name: "R Right" }).matches(":disabled")).toBe(true);
    act(() => before.onTurnComplete(before.activeTurn!.id));
    expect(screen.getByRole("status").textContent).toBe(messages.en.sceneUnavailable);
  });
});

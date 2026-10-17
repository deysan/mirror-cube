// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useEffect, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { CubeScene } from "./components/CubeScene";
import { messages, type Language } from "./i18n/messages";
import { createSolvedCube } from "./puzzle/model";
import { applyMove } from "./puzzle/moves";

vi.mock("./puzzle/model", { spy: true });
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
    ...Object.values(text.turnOptions),
    text.geometryEyebrow, text.geometryDescription, text.cubeEdge, text.stageNote,
    ...Object.values(text.axisLayers),
  ]) {
    expect(screen.getByText(value)).toBeDefined();
  }
  for (const dimensions of ["50", "22 / 28", "20 / 30", "17 / 33"]) {
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

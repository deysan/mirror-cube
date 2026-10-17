// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { CubeScene } from "./components/CubeScene";
import { messages, type Language } from "./i18n/messages";
import { createSolvedCube } from "./puzzle/model";

vi.mock("./puzzle/model", { spy: true });
// jsdom has no WebGL. Test UI/state wiring here, transforms in Node, and pixels in a browser.
vi.mock("./components/CubeScene", () => ({ CubeScene: vi.fn() }));

beforeEach(() => {
  document.documentElement.lang = "en";
  document.head.innerHTML = '<title>MirrorCube</title><meta name="description" content="">';
  vi.mocked(CubeScene).mockImplementation(() => <canvas data-testid="scene-canvas" />);
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
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(text.geometryTitle);
  expect(screen.getByRole("group", { name: text.languageLabel })).toBeDefined();
  expect(screen.getByRole("region", { name: text.overviewLabel })).toBeDefined();

  for (const value of [
    text.intro, text.solvedState, text.viewLabel, text.caption,
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

      fireEvent.click(screen.getByRole("button", { name: "Українська" }));
      expect(screen.getByRole("status").textContent).toBe(messages.uk.sceneUnavailable);
      expect(screen.getByText("50 мм")).toBeDefined();
    } finally {
      errorLog.mockRestore();
    }
  });
});

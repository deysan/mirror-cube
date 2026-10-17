// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { messages, type Language } from "./i18n/messages";
import { createSolvedCube } from "./puzzle/model";

// Keep the real model implementation, but observe whether switching recreates it.
vi.mock("./puzzle/model", { spy: true });

beforeEach(() => {
  document.documentElement.lang = "en";
  document.head.innerHTML = '<title>MirrorCube</title><meta name="description" content="">';
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

  const svg = screen.getByRole("img", { name: text.cubeTitle });
  const descriptionId = svg.getAttribute("aria-describedby")!;
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

  it("switches all page text, document metadata, units, and SVG descriptions to Ukrainian", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Українська" }));

    expectLanguage("uk");
    expect(screen.getByRole("heading", { level: 1 }).textContent)
      .toBe("Головоломка, де головне — форма.");
    expect(screen.queryByText(messages.en.stageNote)).toBeNull();
  });

  it("switches back without recreating the model, remounting the SVG, or changing geometry", () => {
    render(<App />);
    const factory = vi.mocked(createSolvedCube);
    const creationCount = factory.mock.calls.length;
    const cube = factory.mock.results[0]?.value;
    expect(cube).toBeDefined();
    const originalState = JSON.stringify(cube);
    const originalSvg = screen.getByRole("img");
    const originalPolygons = [...originalSvg.querySelectorAll("polygon")];
    const originalPoints = originalPolygons.map((polygon) => polygon.getAttribute("points"));
    const originalViewBox = originalSvg.getAttribute("viewBox");

    for (const name of ["Українська", "English"]) {
      fireEvent.click(screen.getByRole("button", { name }));
      const svg = screen.getByRole("img");
      const polygons = [...svg.querySelectorAll("polygon")];

      expect(svg).toBe(originalSvg);
      expect(svg.getAttribute("viewBox")).toBe(originalViewBox);
      expect(polygons).toHaveLength(12);
      polygons.forEach((polygon, index) => expect(polygon).toBe(originalPolygons[index]));
      expect(polygons.map((polygon) => polygon.getAttribute("points"))).toEqual(originalPoints);
      expect(factory.mock.calls).toHaveLength(creationCount);
      expect(JSON.stringify(cube)).toBe(originalState);
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
});

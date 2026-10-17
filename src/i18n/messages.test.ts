import { describe, expect, it } from "vitest";
import { LANGUAGES, messages } from "./messages";

describe("translation dictionaries", () => {
  it("provides the same message and axis keys for both languages", () => {
    expect(Object.keys(messages.uk).sort()).toEqual(Object.keys(messages.en).sort());
    expect(Object.keys(messages.uk.axisLayers).sort()).toEqual(["x", "y", "z"]);
    expect(Object.keys(messages.en.axisLayers).sort()).toEqual(["x", "y", "z"]);
    expect(Object.keys(messages.uk.faceNames).sort()).toEqual(["B", "D", "F", "L", "R", "U"]);
    expect(Object.keys(messages.en.faceNames).sort()).toEqual(Object.keys(messages.uk.faceNames).sort());
    expect(Object.keys(messages.en.turnOptions).sort()).toEqual(["-1", "1", "2"]);
    expect(Object.keys(messages.uk.turnOptions).sort()).toEqual(["-1", "1", "2"]);
  });

  it.each(LANGUAGES)("has no empty translations for $label", ({ code }) => {
    const { axisLayers, faceNames, turnOptions, ...labels } = messages[code];
    const strings = [
      ...Object.values(labels), ...Object.values(axisLayers),
      ...Object.values(faceNames), ...Object.values(turnOptions),
    ];

    for (const value of strings) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

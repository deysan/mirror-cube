import { describe, expect, it } from "vitest";
import { LANGUAGES, messages } from "./messages";

describe("translation dictionaries", () => {
  it("provides the same message and axis keys for both languages", () => {
    expect(Object.keys(messages.uk).sort()).toEqual(Object.keys(messages.en).sort());
    expect(Object.keys(messages.uk.axisLayers).sort()).toEqual(["x", "y", "z"]);
    expect(Object.keys(messages.en.axisLayers).sort()).toEqual(["x", "y", "z"]);
  });

  it.each(LANGUAGES)("has no empty translations for $label", ({ code }) => {
    const { axisLayers, ...labels } = messages[code];
    const strings = [...Object.values(labels), ...Object.values(axisLayers)];

    for (const value of strings) {
      expect(value.trim().length).toBeGreaterThan(0);
    }
  });
});

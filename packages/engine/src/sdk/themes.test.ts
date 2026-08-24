import { describe, it, expect } from "vitest";
import { THEME_PRESETS, contrastRatio, parseHex, themePreset } from "./themes";

describe("theme presets", () => {
  it("have unique ids and names", () => {
    const ids = THEME_PRESETS.map((t) => t.id);
    const names = THEME_PRESETS.map((t) => t.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  it("only contain well-formed hex colors", () => {
    for (const t of THEME_PRESETS) {
      for (const [role, hex] of [
        ["background", t.background],
        ["text", t.text],
        ["accent", t.accent],
      ] as const) {
        expect(parseHex(hex), `${t.id}.${role} = ${hex}`).not.toBeNull();
      }
    }
  });

  // The whole point of a preset is that it stays readable on every template it
  // lands on, so body text must clear WCAG AA and the accent must stay visible.
  it("keep text >= 4.5:1 and accent >= 3:1 against their background", () => {
    for (const t of THEME_PRESETS) {
      const text = contrastRatio(t.text, t.background);
      const accent = contrastRatio(t.accent, t.background);
      expect(text, `${t.id}: text on background`).not.toBeNull();
      expect(accent, `${t.id}: accent on background`).not.toBeNull();
      expect(text!, `${t.id}: text on background = ${text!.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
      expect(accent!, `${t.id}: accent on background = ${accent!.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    }
  });

  it("declare a mode matching their background lightness", () => {
    for (const t of THEME_PRESETS) {
      const onWhite = contrastRatio(t.background, "#FFFFFF")!;
      // A light surface is close to white (low contrast against it).
      expect(t.mode === "light" ? onWhite < 2 : onWhite > 4, `${t.id} mode=${t.mode}`).toBe(true);
    }
  });

  it("looks up by id and tolerates unknown/undefined", () => {
    expect(themePreset("paper")?.name).toBe("Paper");
    expect(themePreset("nope")).toBeUndefined();
    expect(themePreset(undefined)).toBeUndefined();
  });
});

describe("contrastRatio", () => {
  it("computes known WCAG pairs", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 1);
    expect(contrastRatio("#FFFFFF", "#FFFFFF")).toBeCloseTo(1, 5);
  });

  it("is symmetric and handles shorthand + alpha hex", () => {
    expect(contrastRatio("#000", "#fff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 1);
    // Alpha is ignored (we compare against an opaque surface).
    expect(contrastRatio("#000000ff", "#ffffffff")).toBeCloseTo(21, 1);
  });

  it("returns null on malformed input rather than throwing", () => {
    expect(contrastRatio("red", "#fff")).toBeNull();
    expect(contrastRatio("#12345", "#fff")).toBeNull();
    expect(contrastRatio("", "#fff")).toBeNull();
  });
});

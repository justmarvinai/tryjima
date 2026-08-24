import { describe, it, expect } from "vitest";
import { sizeOf, safeZone, safeRect, safeCenter, ASPECTS } from "./aspect";
import { shrinkToFit, wrapText, fitBox, type MeasureWidth } from "./fit";

// Fake measure: width proportional to character count × size (deterministic).
const measure: MeasureWidth = (text, size) => text.length * size * 0.5;

describe("aspect", () => {
  it("has correct logical sizes", () => {
    expect(sizeOf("1:1")).toEqual({ width: 1080, height: 1080 });
    expect(sizeOf("4:5")).toEqual({ width: 1080, height: 1350 });
    expect(sizeOf("9:16")).toEqual({ width: 1080, height: 1920 });
    expect(sizeOf("16:9")).toEqual({ width: 1920, height: 1080 });
  });

  it("9:16 reserves the platform-UI safe zone", () => {
    const z = safeZone("9:16");
    expect(z.bottom).toBe(400);
    expect(z.top).toBe(220);
  });

  it("safeRect stays within the canvas for every aspect", () => {
    for (const a of ASPECTS) {
      const { width, height } = sizeOf(a);
      const r = safeRect(a);
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(width);
      expect(r.y + r.height).toBeLessThanOrEqual(height);
      expect(r.width).toBeGreaterThan(0);
      expect(r.height).toBeGreaterThan(0);
    }
  });

  it("safeCenter sits inside the safe rect", () => {
    const c = safeCenter("9:16");
    const r = safeRect("9:16");
    expect(c.x).toBeGreaterThan(r.x);
    expect(c.x).toBeLessThan(r.x + r.width);
    expect(c.y).toBeGreaterThan(r.y);
    expect(c.y).toBeLessThan(r.y + r.height);
  });
});

describe("text fit", () => {
  it("shrinkToFit returns baseSize when text already fits", () => {
    expect(shrinkToFit("hi", measure, { maxWidth: 1000, baseSize: 100, minSize: 20 })).toBe(100);
  });

  it("shrinkToFit reduces size until it fits", () => {
    // "hello" = 5 chars; width = 5 * size * 0.5 = 2.5*size. maxWidth 100 → size ≤ 40.
    const size = shrinkToFit("hello", measure, { maxWidth: 100, baseSize: 100, minSize: 10 });
    expect(size).toBeLessThanOrEqual(40);
    expect(measure("hello", size)).toBeLessThanOrEqual(100);
  });

  it("shrinkToFit clamps at minSize when nothing fits", () => {
    expect(shrinkToFit("verylongword", measure, { maxWidth: 1, baseSize: 100, minSize: 12 })).toBe(
      12,
    );
  });

  it("wrapText splits into fitting lines and never drops words", () => {
    const lines = wrapText("one two three four five", measure, 20, 60);
    const rejoined = lines.join(" ").split(/\s+/).filter(Boolean);
    expect(rejoined).toEqual(["one", "two", "three", "four", "five"]);
    for (const line of lines) {
      // each line fits, unless it is a single word wider than maxWidth
      const words = line.split(" ");
      if (words.length > 1) expect(measure(line, 20)).toBeLessThanOrEqual(60);
    }
  });

  it("wrapText keeps an over-long single word on its own line", () => {
    const lines = wrapText("supercalifragilistic short", measure, 20, 60);
    expect(lines[0]).toBe("supercalifragilistic");
  });

  it("fitBox respects maxLines by shrinking", () => {
    const { fontSize, lines } = fitBox("one two three four five six", measure, {
      maxWidth: 120,
      baseSize: 80,
      minSize: 8,
      maxLines: 2,
    });
    expect(lines.length).toBeLessThanOrEqual(2);
    expect(fontSize).toBeLessThanOrEqual(80);
  });
});

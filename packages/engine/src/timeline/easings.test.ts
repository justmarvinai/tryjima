import { describe, it, expect } from "vitest";
import {
  EASINGS,
  linear,
  outQuint,
  inOutCubic,
  outExpo,
  outBack,
  spring,
  steps,
  makeOutBack,
} from "./easings";

describe("easings", () => {
  it("all named easings hit exact endpoints", () => {
    for (const [name, fn] of Object.entries(EASINGS)) {
      expect(fn(0), `${name}(0)`).toBeCloseTo(0, 10);
      expect(fn(1), `${name}(1)`).toBeCloseTo(1, 10);
    }
  });

  it("clamps out-of-range input to endpoints", () => {
    expect(linear(-0.5)).toBe(0);
    expect(linear(1.5)).toBe(1);
    expect(outQuint(-2)).toBe(0);
    expect(outQuint(2)).toBe(1);
  });

  it("linear is the identity on [0,1]", () => {
    expect(linear(0.25)).toBeCloseTo(0.25, 10);
    expect(linear(0.5)).toBeCloseTo(0.5, 10);
  });

  it("inOutCubic is symmetric about its midpoint", () => {
    for (const u of [0.1, 0.2, 0.35]) {
      expect(inOutCubic(u) + inOutCubic(1 - u)).toBeCloseTo(1, 10);
    }
    expect(inOutCubic(0.5)).toBeCloseTo(0.5, 10);
  });

  it("outExpo front-loads progress (past halfway before u=0.5)", () => {
    expect(outExpo(0.5)).toBeGreaterThan(0.9);
  });

  it("outBack overshoots past 1 before settling", () => {
    const peak = Math.max(...Array.from({ length: 99 }, (_, i) => outBack((i + 1) / 100)));
    expect(peak).toBeGreaterThan(1);
    expect(outBack(1)).toBeCloseTo(1, 10);
  });

  it("makeOutBack overshoot scales with s", () => {
    const gentle = Math.max(...Array.from({ length: 99 }, (_, i) => makeOutBack(1)((i + 1) / 100)));
    const strong = Math.max(...Array.from({ length: 99 }, (_, i) => makeOutBack(3)((i + 1) / 100)));
    expect(strong).toBeGreaterThan(gentle);
  });

  it("spring lands exactly on 1 and overshoots for low damping", () => {
    const s = spring(0.3, 3);
    expect(s(0)).toBe(0);
    expect(s(1)).toBe(1);
    const peak = Math.max(...Array.from({ length: 99 }, (_, i) => s((i + 1) / 100)));
    expect(peak).toBeGreaterThan(1);
  });

  it("steps produces discrete stair values", () => {
    const s = steps(4, "end");
    expect(s(0)).toBe(0);
    expect(s(0.2)).toBeCloseTo(0, 10);
    expect(s(0.26)).toBeCloseTo(0.25, 10);
    expect(s(0.51)).toBeCloseTo(0.5, 10);
    expect(s(1)).toBe(1);
  });

  it("is deterministic — identical output across calls", () => {
    const a = Array.from({ length: 50 }, (_, i) => outBack(i / 49));
    const b = Array.from({ length: 50 }, (_, i) => outBack(i / 49));
    expect(a).toEqual(b);
  });
});

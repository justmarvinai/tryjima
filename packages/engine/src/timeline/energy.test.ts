import { describe, it, expect } from "vitest";
import { JimaTimeline } from "./timeline";
import { linear, outBack, outCubic } from "./easings";
import { energyGains } from "../runtime/runner";

/** Sample a property across the tween, at the resolution the eye cares about. */
function sample(tl: JimaTimeline, node: Record<string, number>, prop: string, n = 21): number[] {
  const out: number[] = [];
  for (let i = 0; i <= n; i++) {
    tl.evaluate(i / n);
    out.push(node[prop]!);
  }
  return out;
}

function slide(): { tl: JimaTimeline; node: Record<string, number> } {
  const node = { x: 0, alpha: 0 };
  const tl = new JimaTimeline();
  tl.to(node, { prop: "x", from: -500, to: 0, start: 0, duration: 1, ease: outBack });
  tl.to(node, { prop: "alpha", from: 0, to: 1, start: 0, duration: 1, ease: outCubic });
  return { tl, node };
}

describe("energy", () => {
  it("is the identity at 100%", () => {
    const a = slide();
    const before = sample(a.tl, a.node, "x");
    const b = slide();
    b.tl.applyEnergy(1, 1);
    expect(sample(b.tl, b.node, "x")).toEqual(before);
  });

  it("leaves the endpoints exactly where the template author put them", () => {
    for (const e of [0, 0.5, 1.5, 2]) {
      const { tl, node } = slide();
      const g = energyGains(e);
      tl.applyEnergy(g.ease, g.travel);
      tl.evaluate(1);
      expect(node.x, `energy ${e}`).toBeCloseTo(0, 9);
      tl.evaluate(5);
      expect(node.x, `energy ${e} after the end`).toBeCloseTo(0, 9);
    }
  });

  it("removes the overshoot at low energy and exaggerates it at high", () => {
    const overshoot = (e: number): number => {
      const { tl, node } = slide();
      const g = energyGains(e);
      tl.applyEnergy(g.ease, g.travel);
      // outBack overshoots past its destination (x > 0 here) before settling.
      let peak = -Infinity;
      for (let i = 0; i <= 60; i++) {
        tl.evaluate(i / 60);
        peak = Math.max(peak, node.x!);
      }
      return peak;
    };
    expect(overshoot(0)).toBeLessThanOrEqual(0 + 1e-9);
    expect(overshoot(2)).toBeGreaterThan(overshoot(1));
    expect(overshoot(1)).toBeGreaterThan(overshoot(0.4));
  });

  it("shortens travel at low energy and lengthens it at high", () => {
    const startX = (e: number): number => {
      const { tl, node } = slide();
      const g = energyGains(e);
      tl.applyEnergy(g.ease, g.travel);
      tl.evaluate(0);
      return node.x!;
    };
    expect(Math.abs(startX(0))).toBeLessThan(Math.abs(startX(1)));
    expect(Math.abs(startX(2))).toBeGreaterThan(Math.abs(startX(1)));
    // Never all the way to zero — arriving from nowhere is not "calm".
    expect(Math.abs(startX(0))).toBeGreaterThan(100);
  });

  it("never touches alpha — a fade must still start from nothing", () => {
    for (const e of [0, 2]) {
      const { tl, node } = slide();
      const g = energyGains(e);
      tl.applyEnergy(g.ease, g.travel);
      tl.evaluate(0);
      expect(node.alpha, `energy ${e}`).toBeCloseTo(0, 9);
      tl.evaluate(1);
      expect(node.alpha).toBeCloseTo(1, 9);
    }
  });

  it("does not change timing — that is what Speed is for", () => {
    const { tl } = slide();
    const before = tl.duration;
    tl.applyEnergy(2, 1.45);
    expect(tl.duration).toBe(before);
  });

  it("flattens a curved ease toward linear at zero energy", () => {
    const node = { x: 0 };
    const tl = new JimaTimeline();
    tl.to(node, { prop: "x", from: 0, to: 100, start: 0, duration: 1, ease: outCubic });
    tl.applyEnergy(0, 1);
    for (const u of [0.25, 0.5, 0.75]) {
      tl.evaluate(u);
      expect(node.x).toBeCloseTo(u * 100, 6);
    }
  });

  it("is deterministic and stable under repeated evaluation", () => {
    const { tl, node } = slide();
    tl.applyEnergy(1.7, 1.3);
    const first = sample(tl, node, "x");
    expect(sample(tl, node, "x")).toEqual(first);
  });

  it("leaves a linear tween's shape alone, since it has no character to scale", () => {
    const node = { x: 0 };
    const tl = new JimaTimeline();
    tl.to(node, { prop: "x", from: 0, to: 100, start: 0, duration: 1, ease: linear });
    tl.applyEnergy(2, 1);
    tl.evaluate(0.5);
    expect(node.x).toBeCloseTo(50, 6);
  });
});

describe("energyGains", () => {
  it("maps 1 to the identity", () => {
    expect(energyGains(1)).toEqual({ ease: 1, travel: 1 });
    expect(energyGains(undefined)).toEqual({ ease: 1, travel: 1 });
  });

  it("clamps out-of-range input", () => {
    expect(energyGains(-5).ease).toBe(0);
    expect(energyGains(99).ease).toBe(2);
  });

  it("moves travel more gently than ease", () => {
    const low = energyGains(0);
    expect(low.ease).toBe(0);
    expect(low.travel).toBeGreaterThan(0.5);
    expect(low.travel).toBeLessThan(1);
  });
});

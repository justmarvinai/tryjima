import { describe, it, expect } from "vitest";
import { JimaTimeline } from "./timeline";
import { linear, outQuint, outBack, spring } from "./easings";

function node() {
  return { x: 0, alpha: 1, rotation: 0, scale: { x: 1, y: 1 }, visible: false, text: "" };
}

describe("JimaTimeline", () => {
  it("interpolates a numeric prop linearly and holds before/after", () => {
    const n = node();
    const tl = new JimaTimeline().to(n, {
      prop: "x",
      from: 0,
      to: 100,
      start: 1,
      duration: 2,
      ease: linear,
    });

    tl.evaluate(0);
    expect(n.x).toBe(0); // before start → from
    tl.evaluate(1);
    expect(n.x).toBeCloseTo(0, 10);
    tl.evaluate(2);
    expect(n.x).toBeCloseTo(50, 10); // halfway
    tl.evaluate(3);
    expect(n.x).toBeCloseTo(100, 10);
    tl.evaluate(10);
    expect(n.x).toBeCloseTo(100, 10); // after end → holds `to`
  });

  it("writes nested props via dot path", () => {
    const n = node();
    new JimaTimeline()
      .to(n, { prop: "scale.x", from: 0.5, to: 1, start: 0, duration: 1, ease: linear })
      .evaluate(0.5);
    expect(n.scale.x).toBeCloseTo(0.75, 10);
  });

  it("is stateless — evaluation order does not affect results", () => {
    const n = node();
    const tl = new JimaTimeline().to(n, {
      prop: "x",
      from: 0,
      to: 100,
      start: 0,
      duration: 1,
      ease: outQuint,
    });
    tl.evaluate(0.9);
    const forward = n.x;
    tl.evaluate(0.3);
    tl.evaluate(0.9); // revisit — must match regardless of history
    expect(n.x).toBeCloseTo(forward, 12);
  });

  it("sequenced tweens on one prop: latest started wins", () => {
    const n = node();
    const tl = new JimaTimeline()
      .to(n, { prop: "x", from: 0, to: 100, start: 0, duration: 1, ease: linear })
      .to(n, { prop: "x", from: 100, to: 0, start: 1, duration: 1, ease: linear });

    tl.evaluate(0.5);
    expect(n.x).toBeCloseTo(50, 10); // first tween
    tl.evaluate(1.5);
    expect(n.x).toBeCloseTo(50, 10); // second tween, going back down
    tl.evaluate(2);
    expect(n.x).toBeCloseTo(0, 10);
  });

  it("set() applies discrete values at their time, latest wins", () => {
    const n = node();
    const tl = new JimaTimeline()
      .set(n, "visible", true, 0.5)
      .set(n, "text", "hello", 1.0)
      .set(n, "text", "world", 2.0);

    tl.evaluate(0);
    expect(n.visible).toBe(false);
    expect(n.text).toBe("");
    tl.evaluate(0.5);
    expect(n.visible).toBe(true);
    tl.evaluate(1.5);
    expect(n.text).toBe("hello");
    tl.evaluate(2.5);
    expect(n.text).toBe("world");
  });

  it("set() ordering is by time, not insertion order", () => {
    const n = node();
    const tl = new JimaTimeline()
      .set(n, "text", "late", 2.0)
      .set(n, "text", "early", 1.0);
    tl.evaluate(3);
    expect(n.text).toBe("late");
  });

  it("stagger offsets each target by `each`", () => {
    const items = [node(), node(), node()];
    const tl = new JimaTimeline().stagger(
      items,
      { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.5, ease: linear },
      { each: 0.5, start: 0 },
    );

    tl.evaluate(0.25);
    expect(items[0]!.alpha).toBeCloseTo(0.5, 10); // mid-fade
    expect(items[1]!.alpha).toBeCloseTo(0, 10); // not started
    expect(items[2]!.alpha).toBeCloseTo(0, 10);

    tl.evaluate(0.75);
    expect(items[0]!.alpha).toBeCloseTo(1, 10); // done
    expect(items[1]!.alpha).toBeCloseTo(0.5, 10); // mid-fade
  });

  it("duration reflects the latest tween end and set time", () => {
    const n = node();
    const tl = new JimaTimeline()
      .to(n, { prop: "x", from: 0, to: 1, start: 0, duration: 2, ease: linear })
      .set(n, "visible", true, 3.5);
    expect(tl.duration).toBeCloseTo(3.5, 10);
  });

  it("beats(): groups tweens by ~20ms start buckets, sorted by time", () => {
    const n = node();
    const tl = new JimaTimeline()
      .to(n, { prop: "x", from: 0, to: 100, start: 0.5, duration: 0.4, ease: linear })
      .to(n, { prop: "alpha", from: 0, to: 1, start: 0.508, duration: 0.4, ease: linear }) // same 20ms bucket as x
      .to(n, { prop: "scale.x", from: 0.2, to: 1, start: 1.2, duration: 0.5, ease: spring() });
    const beats = tl.beats();
    expect(beats.map((b) => b.time)).toEqual([0.5, 1.2]);
    expect(beats[0]!.count).toBe(2); // x + alpha merged
    expect(beats[1]!.count).toBe(1);
  });

  it("beats(): classifies motion — move, fade, spring entrance, overshoot", () => {
    const n = node();
    const tl = new JimaTimeline()
      .to(n, { prop: "x", from: 0, to: 300, start: 0, duration: 0.5, ease: linear })
      .to(n, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.5, ease: linear })
      .to(n, { prop: "scale.x", from: 0.1, to: 1, start: 1, duration: 0.5, ease: spring() })
      .to(n, { prop: "rotation", from: -1, to: 0, start: 2, duration: 0.5, ease: outBack });
    const beats = tl.beats();
    const at = (t: number) => beats.find((b) => Math.abs(b.time - t) < 1e-6)!;
    expect(at(0).moveDist).toBeCloseTo(300, 6);
    expect(at(0).fadeIn).toBe(true);
    expect(at(1).scaleFromSmall).toBe(true);
    expect(at(1).overshoot).toBe(true); // spring overshoots 1
    expect(at(2).rotate).toBe(true);
    expect(at(2).overshoot).toBe(true); // outBack overshoots 1
  });

  it("beats(): skips zero-duration tweens and is deterministic", () => {
    const n = node();
    const build = () =>
      new JimaTimeline()
        .to(n, { prop: "x", from: 0, to: 10, start: 0.3, duration: 0, ease: linear })
        .to(n, { prop: "y", from: 0, to: 90, start: 0.3, duration: 0.4, ease: linear });
    const a = build().beats();
    const b = build().beats();
    expect(a).toHaveLength(1); // instantaneous tween excluded
    expect(a).toEqual(b);
  });

  it("produces identical full sweeps across two runs (determinism)", () => {
    const build = () => {
      const n = node();
      const tl = new JimaTimeline()
        .to(n, { prop: "x", from: 0, to: 200, start: 0, duration: 1.5, ease: outQuint })
        .to(n, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.6, ease: linear });
      return { n, tl };
    };
    const sample = () => {
      const { n, tl } = build();
      const out: number[] = [];
      for (let i = 0; i <= 60; i++) {
        tl.evaluate((i / 60) * 1.5);
        out.push(n.x, n.alpha);
      }
      return out;
    };
    expect(sample()).toEqual(sample());
  });
});

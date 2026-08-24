import { describe, it, expect } from "vitest";
import { Container } from "pixi.js";
import { JimaTimeline } from "../timeline/timeline";
import { linear, outCubic } from "../timeline/easings";
import { squashStretch, composeUpdates } from "./squash";

/** A node that moves `dist` px along `axis` between t=0 and t=`dur`. */
function moving(axis: "x" | "y", dist: number, dur = 1): { node: Container; tl: JimaTimeline } {
  const node = new Container();
  const tl = new JimaTimeline();
  tl.to(node, { prop: axis, from: 0, to: dist, start: 0, duration: dur, ease: linear });
  return { node, tl };
}

/**
 * Pose the scene at t exactly the way the runner does — and deliberately do NOT
 * reset the scale first. Resetting would hide the failure mode that matters:
 * `evaluate(t)` only writes properties it owns, so a hook that *multiplies* a
 * scale nothing else resets compounds every frame and seeking stops being
 * pixel-exact.
 */
function poseAt(tl: JimaTimeline, node: Container, update: (t: number) => void, t: number) {
  tl.evaluate(t);
  update(t);
  return { x: node.scale.x, y: node.scale.y };
}

describe("squash and stretch", () => {
  it("stretches horizontally when travelling horizontally", () => {
    const { node, tl } = moving("x", 3000);
    const s = poseAt(tl, node, squashStretch(tl, node), 0.5);
    expect(s.x).toBeGreaterThan(1);
    expect(s.y).toBeLessThan(1);
  });

  it("stretches vertically when travelling vertically", () => {
    const { node, tl } = moving("y", 3000);
    const s = poseAt(tl, node, squashStretch(tl, node), 0.5);
    expect(s.y).toBeGreaterThan(1);
    expect(s.x).toBeLessThan(1);
  });

  it("preserves area — it changes shape, not size", () => {
    const { node, tl } = moving("x", 3000);
    const s = poseAt(tl, node, squashStretch(tl, node), 0.5);
    expect(s.x * s.y).toBeCloseTo(1, 6);
  });

  it("fades to nothing on the diagonal, where axes cannot express it", () => {
    const node = new Container();
    const tl = new JimaTimeline();
    tl.to(node, { prop: "x", from: 0, to: 2000, start: 0, duration: 1, ease: linear });
    tl.to(node, { prop: "y", from: 0, to: 2000, start: 0, duration: 1, ease: linear });
    const s = poseAt(tl, node, squashStretch(tl, node), 0.5);
    expect(s.x).toBeCloseTo(1, 6);
    expect(s.y).toBeCloseTo(1, 6);
  });

  it("scales with speed, and stops when the motion stops", () => {
    const { node, tl } = moving("x", 3000, 1);
    const update = squashStretch(tl, node);
    const fast = poseAt(tl, node, update, 0.5);
    const settled = poseAt(tl, node, update, 1.6); // past the tween's end
    expect(fast.x).toBeGreaterThan(1.01);
    expect(settled.x).toBeCloseTo(1, 6);

    const slow = moving("x", 200, 1);
    const slowScale = poseAt(slow.tl, slow.node, squashStretch(slow.tl, slow.node), 0.5);
    expect(slowScale.x).toBeLessThan(fast.x);
    expect(slowScale.x).toBeGreaterThanOrEqual(1);
  });

  it("caps at the configured amount however fast the motion", () => {
    const { node, tl } = moving("x", 100000, 1);
    const s = poseAt(tl, node, squashStretch(tl, node, { amount: 0.2 }), 0.5);
    expect(s.x).toBeLessThanOrEqual(1.2 + 1e-9);
  });

  it("multiplies the animated scale instead of replacing it", () => {
    const node = new Container();
    const tl = new JimaTimeline();
    tl.to(node, { prop: "x", from: 0, to: 3000, start: 0, duration: 1, ease: linear });
    tl.to(node, { prop: "scale.x", from: 0.5, to: 0.5, start: 0, duration: 1, ease: linear });
    tl.to(node, { prop: "scale.y", from: 0.5, to: 0.5, start: 0, duration: 1, ease: linear });
    const s = poseAt(tl, node, squashStretch(tl, node), 0.5);
    expect(s.x).toBeGreaterThan(0.5);
    expect(s.x).toBeLessThan(0.62);
    expect(s.x * s.y).toBeCloseTo(0.25, 6);
  });

  it("leaves a node with no position tweens completely alone", () => {
    const node = new Container();
    const tl = new JimaTimeline();
    tl.to(node, { prop: "alpha", from: 0, to: 1, start: 0, duration: 1, ease: linear });
    const s = poseAt(tl, node, squashStretch(tl, node), 0.5);
    expect(s.x).toBe(1);
    expect(s.y).toBe(1);
  });

  it("is a pure function of t — seeking backwards is identical", () => {
    const { node, tl } = moving("x", 3000, 1);
    const update = squashStretch(tl, node);
    const forward = poseAt(tl, node, update, 0.4);
    poseAt(tl, node, update, 0.9);
    const back = poseAt(tl, node, update, 0.4);
    expect(back).toEqual(forward);
  });

  it("does not compound when nothing else resets the scale", () => {
    // The node has no scale tween, so the hook is the only thing writing it.
    // Posing the same frame repeatedly must give the same answer every time.
    const { node, tl } = moving("x", 3000, 1);
    const update = squashStretch(tl, node);
    const first = poseAt(tl, node, update, 0.5);
    for (let i = 0; i < 20; i++) poseAt(tl, node, update, 0.5);
    expect(poseAt(tl, node, update, 0.5)).toEqual(first);
  });

  it("returns to rest once the motion is over, even after a fast frame", () => {
    const { node, tl } = moving("x", 3000, 1);
    const update = squashStretch(tl, node);
    poseAt(tl, node, update, 0.5);
    const settled = poseAt(tl, node, update, 2);
    expect(settled.x).toBeCloseTo(1, 9);
    expect(settled.y).toBeCloseTo(1, 9);
  });

  it("follows a non-linear ease — fastest where the ease is steepest", () => {
    // outCubic covers most of the distance in the first moments.
    const tl = new JimaTimeline();
    const node = new Container();
    tl.to(node, { prop: "x", from: 0, to: 3000, start: 0, duration: 1, ease: outCubic });
    const update = squashStretch(tl, node);
    const early = poseAt(tl, node, update, 0.08);
    const late = poseAt(tl, node, update, 0.85);
    expect(early.x).toBeGreaterThan(late.x);
  });

  it("reads the source node when the moving node is not the scaled one", () => {
    const mover = new Container();
    const art = new Container();
    const tl = new JimaTimeline();
    tl.to(mover, { prop: "x", from: 0, to: 3000, start: 0, duration: 1, ease: linear });
    const s = poseAt(tl, art, squashStretch(tl, art, { source: mover }), 0.5);
    expect(s.x).toBeGreaterThan(1);
  });
});

describe("composeUpdates", () => {
  it("runs hooks in order", () => {
    const seen: string[] = [];
    const fn = composeUpdates(
      () => seen.push("a"),
      undefined,
      () => seen.push("b"),
    );
    fn?.(0);
    expect(seen).toEqual(["a", "b"]);
  });

  it("returns undefined when there is nothing to run", () => {
    expect(composeUpdates(undefined, undefined)).toBeUndefined();
  });

  it("passes a single hook straight through", () => {
    const only = (): void => undefined;
    expect(composeUpdates(only, undefined)).toBe(only);
  });
});

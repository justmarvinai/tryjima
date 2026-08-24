import type { Container } from "pixi.js";
import type { JimaTimeline } from "../timeline/timeline";

/**
 * Velocity-driven squash and stretch.
 *
 * The oldest trick in character animation: something moving fast elongates along
 * its direction of travel and thins across it, then rounds out as it settles.
 * Done by hand it is per-element keyframing; here it falls out of the engine for
 * free, because the timeline is a pure `f(t)` and can be *read* at any time
 * without being advanced. Sampling a node's position a hair before and after the
 * current frame gives its velocity, and velocity drives the scale.
 *
 * It runs from the `update(t)` hook, which fires after `timeline.evaluate(t)`,
 * and **assigns** the scale rather than multiplying it. That distinction is the
 * whole ballgame: `evaluate` only writes properties it has tweens for, so a node
 * with no scale tween is never reset, and a multiply would compound frame after
 * frame until seeking backwards no longer gave the same pixels. Reading the base
 * scale out of the timeline and writing the product keeps this a pure `f(t)`.
 *
 * **What it does not do:** squash along an arbitrary axis. A 45° stretch cannot
 * be expressed with `scale.x`/`scale.y` alone, and rigging every node with
 * rotate-scale-unrotate wrappers to allow it would cost more than it is worth.
 * Instead the effect follows the *dominant* axis and fades to nothing on the
 * diagonal — which is right for the slides, drops and pops that make up almost
 * all template motion.
 */
export interface SquashOptions {
  /**
   * Peak stretch at full speed, as a fraction. 0.18 means "up to 18% longer
   * along the direction of travel". Above ~0.3 it reads as a rubber-band toy.
   */
  amount?: number;
  /**
   * Speed (logical px/second) at which `amount` is reached. The default is one
   * canvas width in ~0.5s — genuinely fast for a 1080-wide frame.
   */
  reference?: number;
  /**
   * Where the x/y tweens live, if that is not the node being scaled (e.g. a
   * wrapper moves while an inner container carries the artwork).
   */
  source?: object;
}

/** Finite-difference step, in seconds. Half a frame at 60fps. */
const H = 1 / 120;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/**
 * Build an `update(t)` hook that squashes and stretches `node` by its own
 * velocity. Compose it with any hook the template already has via
 * {@link composeUpdates}.
 */
export function squashStretch(
  timeline: JimaTimeline,
  node: Container,
  opts: SquashOptions = {},
): (t: number) => void {
  const amount = opts.amount ?? 0.18;
  const reference = opts.reference ?? 2200;
  const source = opts.source ?? node;
  // The node's resting scale, captured before anything has posed it. Used only
  // when the timeline has no scale tween of its own to read.
  const restX = node.scale.x;
  const restY = node.scale.y;

  return (t: number) => {
    // ASSIGN, never multiply. `evaluate(t)` only writes properties it has tweens
    // for, so a node with no scale tween would never be reset and a multiply
    // would compound frame after frame — which makes seeking backwards give
    // different pixels. Reading the base and writing the product keeps this a
    // pure function of t.
    const baseX = timeline.valueAt(node, "scale.x", t) ?? restX;
    const baseY = timeline.valueAt(node, "scale.y", t) ?? restY;

    const x0 = timeline.valueAt(source, "x", t - H);
    const y0 = timeline.valueAt(source, "y", t - H);
    let e = 0;
    if (x0 !== undefined || y0 !== undefined) {
      const x1 = timeline.valueAt(source, "x", t + H) ?? x0 ?? 0;
      const y1 = timeline.valueAt(source, "y", t + H) ?? y0 ?? 0;
      const vx = (x1 - (x0 ?? x1)) / (2 * H);
      const vy = (y1 - (y0 ?? y1)) / (2 * H);
      const speed = Math.hypot(vx, vy);
      if (speed >= 1) {
        const ux = vx / speed;
        const uy = vy / speed;
        const k = amount * clamp01(speed / reference);
        // +k when travel is purely horizontal, −k when purely vertical, 0 on
        // the diagonal where the axes cannot express it.
        e = k * (ux * ux - uy * uy);
      }
    }

    // Volume preserving: what one axis gains the other gives back, so the node
    // never looks like it changed size — only shape.
    node.scale.x = baseX * (1 + e);
    node.scale.y = baseY / (1 + e);
  };
}

/**
 * Run several `update(t)` hooks as one, in order. Templates return a single
 * hook, so this is how a template keeps its own per-frame work *and* adds
 * squash-and-stretch to a few nodes.
 */
export function composeUpdates(
  ...fns: (((t: number) => void) | undefined)[]
): ((t: number) => void) | undefined {
  const live = fns.filter((f): f is (t: number) => void => typeof f === "function");
  if (live.length === 0) return undefined;
  if (live.length === 1) return live[0];
  return (t: number) => {
    for (const f of live) f(t);
  };
}

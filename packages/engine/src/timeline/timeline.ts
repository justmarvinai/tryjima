import type { EaseFn } from "./easings";
import { linear } from "./easings";

// A single animated numeric property over a time window (seconds).
export interface Tween {
  target: object;
  /** Dot path on the target, e.g. "x", "alpha", "scale.x", "rotation". */
  prop: string;
  from: number;
  to: number;
  start: number;
  duration: number;
  ease: EaseFn;
}

// A discrete (possibly non-numeric) assignment applied once t passes `at`.
// Used for text swaps, visibility toggles, tint changes, etc.
export interface SetEvent {
  target: object;
  prop: string;
  value: unknown;
  at: number;
}

export interface TweenSpec {
  prop: string;
  from: number;
  to: number;
  start: number;
  duration: number;
  ease?: EaseFn;
}

/**
 * A summarized cluster of tweens sharing a start time (for the sound layer).
 *
 * These are the only facts the cue mapper gets, so they carry not just *what*
 * moved but *how hard and how fast* — a 0.1s snap and a 2s drift travelling the
 * same distance want completely different sounds, and an exit wants a different
 * sound from an entrance.
 */
export interface TimelineBeat {
  time: number;
  /** Longest tween duration on this beat, in seconds — a snap vs. a glide. */
  dur: number;
  /** An ease overshoots 1.0 (spring/back/elastic) → springy. */
  overshoot: boolean;
  /** A scale.* tween grows from < 0.75 → an entrance/pop. */
  scaleFromSmall: boolean;
  /** A scale.* tween collapses to < 0.75 → an exit/vanish. */
  scaleToSmall: boolean;
  /** Largest x/y travel in logical px. */
  moveDist: number;
  /** Axis of that largest travel — vertical drops read heavier than slides. */
  moveAxis: "x" | "y" | null;
  /** Direction of that largest travel: +1 right/down, -1 left/up, 0 if none. */
  moveSign: number;
  rotate: boolean;
  /** Largest |rotation| delta in radians. */
  rotateAmount: number;
  /** An alpha 0→1 fade-in. */
  fadeIn: boolean;
  /** An alpha fade-out to (near) zero. */
  fadeOut: boolean;
  /** How many tweens fired on this beat. */
  count: number;
}

export interface StaggerOptions {
  /** Seconds between successive items. */
  each: number;
  /** Start time of the first item (seconds). Default 0. */
  start?: number;
}

type MutableTarget = Record<string, unknown>;

/**
 * Properties whose start value the Energy control scales. Alpha is absent on
 * purpose (see {@link JimaTimeline.applyEnergy}).
 */
const ENERGY_TRAVEL_PROPS = new Set(["x", "y", "scale.x", "scale.y", "rotation"]);

function setPath(target: object, path: string, value: unknown): void {
  const dot = path.indexOf(".");
  if (dot === -1) {
    (target as MutableTarget)[path] = value;
    return;
  }
  const head = path.slice(0, dot);
  const next = (target as MutableTarget)[head];
  if (next && typeof next === "object") {
    setPath(next, path.slice(dot + 1), value);
  }
}

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/**
 * Deterministic timeline. `evaluate(t)` writes every animated property to a
 * defined value derived only from t — it never accumulates state across calls,
 * so seeking is exact and golden frames are stable (TECHNICAL_ARCHITECTURE.md §6).
 *
 * When several tweens drive the same (target, prop), the one whose `start` is the
 * latest at-or-before t wins; before any starts, the earliest tween's `from`
 * holds; after a tween ends, its `to` holds. This makes sequenced animations on
 * one property behave predictably.
 */
export class JimaTimeline {
  private tweens: Tween[] = [];
  private sets: SetEvent[] = [];
  private setsSorted = true;
  private groups: Map<object, Map<string, Tween[]>> | null = null;

  add(tween: Tween): this {
    this.tweens.push(tween);
    this.groups = null;
    return this;
  }

  /** Convenience: author a tween against a target. */
  to(target: object, spec: TweenSpec): this {
    return this.add({
      target,
      prop: spec.prop,
      from: spec.from,
      to: spec.to,
      start: spec.start,
      duration: spec.duration,
      ease: spec.ease ?? linear,
    });
  }

  /** Discrete assignment applied once t ≥ at (last one wins). */
  set(target: object, prop: string, value: unknown, at = 0): this {
    this.sets.push({ target, prop, value, at });
    this.setsSorted = false;
    return this;
  }

  /** Apply one tween spec across many targets, offset by `each` seconds. */
  stagger(targets: readonly object[], spec: TweenSpec, opts: StaggerOptions): this {
    const start0 = opts.start ?? spec.start ?? 0;
    targets.forEach((target, i) => {
      this.add({
        target,
        prop: spec.prop,
        from: spec.from,
        to: spec.to,
        start: start0 + i * opts.each,
        duration: spec.duration,
        ease: spec.ease ?? linear,
      });
    });
    return this;
  }

  /**
   * Motion "beats" — tweens grouped by (rounded) start time, each summarized so
   * a sound layer can pick a fitting SFX (pop on a springy entrance, swoosh on a
   * slide, etc.). Pure and deterministic; does not affect rendering.
   */
  beats(): TimelineBeat[] {
    const groups = new Map<number, TimelineBeat>();
    for (const tw of this.tweens) {
      if (tw.duration <= 0) continue; // skip instantaneous sets-as-tweens
      const key = Math.round(tw.start * 50); // 20ms buckets
      const time = key / 50;
      let b = groups.get(key);
      if (!b) {
        b = {
          time,
          dur: 0,
          overshoot: false,
          scaleFromSmall: false,
          scaleToSmall: false,
          moveDist: 0,
          moveAxis: null,
          moveSign: 0,
          rotate: false,
          rotateAmount: 0,
          fadeIn: false,
          fadeOut: false,
          count: 0,
        };
        groups.set(key, b);
      }
      b.count++;
      b.dur = Math.max(b.dur, tw.duration);
      // Overshoot (spring/back/elastic) → a springy "pop" feel. Detect by sampling.
      if (tw.ease(0.4) > 1.03 || tw.ease(0.6) > 1.03 || tw.ease(0.78) > 1.03) b.overshoot = true;
      if (tw.prop === "scale.x" || tw.prop === "scale.y") {
        if (tw.from < 0.75 && tw.to >= tw.from) b.scaleFromSmall = true;
        if (tw.to < 0.75 && tw.to < tw.from) b.scaleToSmall = true;
      } else if (tw.prop === "x" || tw.prop === "y") {
        const delta = tw.to - tw.from;
        const dist = Math.abs(delta);
        if (dist > b.moveDist) {
          b.moveDist = dist;
          b.moveAxis = tw.prop;
          b.moveSign = delta === 0 ? 0 : delta > 0 ? 1 : -1;
        }
      } else if (tw.prop === "rotation") {
        b.rotate = true;
        b.rotateAmount = Math.max(b.rotateAmount, Math.abs(tw.to - tw.from));
      } else if (tw.prop === "alpha") {
        if (tw.to > tw.from) b.fadeIn = true;
        else if (tw.to < tw.from && tw.to < 0.06) b.fadeOut = true;
      }
    }
    return [...groups.values()].sort((a, b) => a.time - b.time);
  }

  /** Total timeline length in seconds (latest tween end or set time). */
  get duration(): number {
    let end = 0;
    for (const tw of this.tweens) end = Math.max(end, tw.start + tw.duration);
    for (const s of this.sets) end = Math.max(end, s.at);
    return end;
  }

  private ensureGroups(): Map<object, Map<string, Tween[]>> {
    if (this.groups) return this.groups;
    const groups = new Map<object, Map<string, Tween[]>>();
    for (const tw of this.tweens) {
      let byProp = groups.get(tw.target);
      if (!byProp) {
        byProp = new Map<string, Tween[]>();
        groups.set(tw.target, byProp);
      }
      const arr = byProp.get(tw.prop);
      if (arr) arr.push(tw);
      else byProp.set(tw.prop, [tw]);
    }
    for (const byProp of groups.values()) {
      for (const arr of byProp.values()) arr.sort((a, b) => a.start - b.start);
    }
    this.groups = groups;
    return groups;
  }

  private static resolve(group: Tween[], t: number): number {
    let active: Tween | null = null;
    for (const tw of group) {
      if (tw.start <= t) active = tw;
      else break;
    }
    if (!active) {
      // Before anything starts, hold the earliest tween's `from`.
      return group[0]!.from;
    }
    const local =
      active.duration <= 0 ? (t >= active.start ? 1 : 0) : (t - active.start) / active.duration;
    const eased = active.ease(clamp01(local));
    return active.from + (active.to - active.from) * eased;
  }

  /** Write all animated + set properties for time `t` (seconds) onto the targets. */
  /**
   * Dial the *character* of every tween up or down in place — the engine side of
   * the Studio's Energy control.
   *
   * Two transforms, both chosen because they leave the endpoints exactly where
   * the template author put them:
   *
   * 1. **Ease character.** `ease'(u) = u + (ease(u) − u) · g`. The term
   *    `ease(u) − u` is the ease's whole personality — its deviation from a
   *    straight line, which is both the acceleration *and* the overshoot. Scaling
   *    it scales both together, and since the deviation is zero at u=0 and u=1,
   *    the tween still starts and ends where it did. g=1 is the identity, g=0
   *    flattens everything to linear, g>1 exaggerates.
   * 2. **Travel.** `from' = to + (from − to) · gTravel` on position, scale and
   *    rotation, so a slide starts closer in or further out while landing in
   *    exactly the same place. Alpha is deliberately left alone: fading in from
   *    0.4 instead of 0 does not read as "calmer", it reads as broken.
   *
   * Timing is untouched, so this stays orthogonal to the speed control — Energy
   * changes how the motion feels, never how long it takes.
   */
  applyEnergy(energy: number, travel: number): void {
    if (energy === 1 && travel === 1) return;
    for (const tw of this.tweens) {
      if (energy !== 1) {
        const base = tw.ease;
        tw.ease = (u: number): number => u + (base(u) - u) * energy;
      }
      if (travel !== 1 && ENERGY_TRAVEL_PROPS.has(tw.prop)) {
        tw.from = tw.to + (tw.from - tw.to) * travel;
      }
    }
    this.groups = null;
  }

  /**
   * The value a (target, prop) holds at time t, **without writing anything**.
   *
   * Lets a pure `update(t)` hook look at motion it does not own — reading a
   * node's position slightly before and after the current frame is how the
   * squash-and-stretch helper derives velocity. Returns undefined when no tween
   * drives that property.
   */
  valueAt(target: object, prop: string, t: number): number | undefined {
    const group = this.ensureGroups().get(target)?.get(prop);
    return group ? JimaTimeline.resolve(group, t) : undefined;
  }

  evaluate(t: number): void {
    // Discrete sets first (in `at` order so the latest applicable wins), so
    // tweens (e.g. an alpha fade) can layer on top.
    if (!this.setsSorted) {
      this.sets.sort((a, b) => a.at - b.at);
      this.setsSorted = true;
    }
    for (const s of this.sets) {
      if (s.at <= t) setPath(s.target, s.prop, s.value);
    }
    const groups = this.ensureGroups();
    for (const [target, byProp] of groups) {
      for (const [prop, group] of byProp) {
        setPath(target, prop, JimaTimeline.resolve(group, t));
      }
    }
  }
}

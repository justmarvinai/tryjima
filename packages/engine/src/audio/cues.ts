import type { JimaTimeline, TimelineBeat } from "../timeline/timeline";
import type { TemplateDefinition } from "../sdk/types";
import { profileForCategory, profileSpec, type SoundProfile } from "./profile";

// A sound cue = one synthesized voice fired at a moment in the timeline. Cues are
// derived from the timeline's motion "beats" so the audio fits what happens on
// screen, and from the template's sound profile so it fits what the template is.
// Pure and deterministic; sound never affects the visual render or golden frames.

export type SoundName =
  // Percussive / transient
  | "click" // driest: a keystroke, a character landing
  | "tick" // soft filtered blip for a plain fade-in
  | "tap" // small tonal knock — something arriving
  | "pop" // springy entrance with overshoot
  | "pluck" // short mallet/marimba note — steps, counts, list items
  | "impact" // the big one: transient + body + low end
  | "sub" // low thump under an impact, no top
  // Movement
  | "swish" // short air, for slides
  | "whoosh" // longer air, for big/fast travel
  | "fall" // downward-tuned air, for exits and collapses
  | "riser" // swell that resolves onto the next hit
  // Tonal resolves
  | "chime"
  | "bell"
  | "shimmer";

export interface SoundCue {
  time: number;
  sound: SoundName;
  /** 0–1 level before the profile trim. */
  gain: number;
  /** Semitones from the profile root. Runs walk the scale instead of repeating. */
  pitch: number;
  /**
   * 0–1 "size" of the gesture: how far/long the motion was. Stretches decay and
   * opens the filter, so a 2s glide is a long dark whoosh and a 0.1s snap is a
   * short bright one — same sound name, different gesture.
   */
  shape: number;
}

export interface CueSheet {
  cues: SoundCue[];
  profile: SoundProfile;
}

/** Logical-px travel that counts as a real slide (canvas is 1080–1920 px). */
const MOVE_MIN = 60;
/** Travel at/above which a move is a full whoosh rather than a swish. */
const MOVE_BIG = 340;
/** A tween this short is a snap; longer is a glide. */
const SNAP_DUR = 0.22;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** 0 at `a`, 1 at `b`, linear between — for mapping magnitudes onto 0–1 shapes. */
function ramp(v: number, a: number, b: number): number {
  return clamp01((v - a) / (b - a));
}

interface RawCue {
  time: number;
  sound: SoundName;
  gain: number;
  shape: number;
  /** Wants a pitch from the running scale walk (melodic), rather than a fixed one. */
  pitched: boolean;
}

/**
 * One beat → at most one voice (plus an optional low layer). The ordering is by
 * specificity: the most characteristic gesture wins, so a springy scale-up with a
 * long slide is a pop, not a whoosh.
 */
function classify(b: TimelineBeat, profile: SoundProfile): RawCue[] {
  const snap = b.dur <= SNAP_DUR;
  const move = ramp(b.moveDist, MOVE_MIN, MOVE_BIG);
  const long = ramp(b.dur, 0.2, 1.4);
  const dense = ramp(b.count, 1, 8);

  // --- Exits first: something leaving must not sound like something arriving. ---
  if (b.scaleToSmall || (b.fadeOut && !b.fadeIn)) {
    return [{ time: b.time, sound: "fall", gain: 0.3 + 0.14 * move, shape: clamp01(0.35 + 0.5 * long), pitched: false }];
  }

  // --- Springy entrances: the signature "lands with weight" moment. ---
  if (b.overshoot && b.scaleFromSmall) {
    const heft = clamp01(0.35 + 0.4 * dense + 0.25 * move);
    const out: RawCue[] = [];
    if (heft > 0.78 || (profile === "impact" && dense > 0.5) || profile === "cinematic") {
      out.push({ time: b.time, sound: "impact", gain: 0.5 + 0.22 * heft, shape: heft, pitched: true });
      out.push({ time: b.time, sound: "sub", gain: 0.32 + 0.2 * heft, shape: heft, pitched: false });
    } else {
      out.push({ time: b.time, sound: "pop", gain: 0.42 + 0.2 * heft, shape: heft, pitched: true });
    }
    return out;
  }

  // --- Travel. A vertical drop reads heavier than a horizontal slide. ---
  if (b.moveDist >= MOVE_MIN) {
    const drop = b.moveAxis === "y" && b.moveSign > 0;
    if (move > 0.6 || !snap) {
      return [
        { time: b.time, sound: "whoosh", gain: 0.3 + 0.22 * move, shape: clamp01(0.3 + 0.55 * Math.max(move, long)), pitched: false },
        ...(drop && move > 0.75 && snap
          ? [{ time: b.time + b.dur * 0.82, sound: "sub" as SoundName, gain: 0.3, shape: move, pitched: false }]
          : []),
      ];
    }
    return [{ time: b.time, sound: "swish", gain: 0.26 + 0.2 * move, shape: clamp01(0.25 + 0.4 * move), pitched: false }];
  }

  // --- Non-springy scale-ins: a knock or a mallet note depending on profile. ---
  if (b.scaleFromSmall) {
    const tonal = profile === "data" || profile === "warm" || profile === "airy";
    return [
      {
        time: b.time,
        sound: tonal ? "pluck" : snap ? "tap" : "pop",
        gain: 0.32 + 0.18 * dense,
        shape: clamp01(0.3 + 0.4 * long),
        pitched: true,
      },
    ];
  }

  // --- Rotation with real angle: air, scaled by how far it turns. ---
  if (b.rotate && b.rotateAmount > 0.25) {
    return [{ time: b.time, sound: "swish", gain: 0.22 + 0.14 * clamp01(b.rotateAmount / Math.PI), shape: clamp01(0.3 + 0.4 * long), pitched: false }];
  }

  // --- A plain fade-in. The quietest thing in the vocabulary on purpose. ---
  if (b.fadeIn) {
    if (profile === "type") return [{ time: b.time, sound: "click", gain: 0.2 + 0.1 * dense, shape: 0.3, pitched: false }];
    if (profile === "data") return [{ time: b.time, sound: "pluck", gain: 0.24, shape: 0.35, pitched: true }];
    return [{ time: b.time, sound: "tick", gain: 0.17 + 0.09 * dense, shape: clamp01(0.25 + 0.4 * long), pitched: false }];
  }

  return [];
}

/**
 * Walk the profile's scale across a run of pitched cues, resetting after a gap.
 *
 * This is what stops a 16-letter stagger sounding like a machine gun: the old
 * mapper played the identical 360 Hz tap 16 times. Here each step takes the next
 * scale degree and octaves up when it runs out, so the run reads as a phrase.
 */
function assignPitches(raws: RawCue[], scale: number[]): SoundCue[] {
  const out: SoundCue[] = [];
  let step = 0;
  let lastPitchedTime = -Infinity;
  for (const r of raws) {
    let pitch = 0;
    if (r.pitched) {
      if (r.time - lastPitchedTime > 0.55) step = 0; // new phrase
      const degree = scale[step % scale.length] ?? 0;
      pitch = degree + 12 * Math.floor(step / scale.length);
      // Two octaves is plenty; beyond that it turns into a whistle.
      if (pitch > 24) pitch -= 24 * Math.floor(pitch / 24);
      step++;
      lastPitchedTime = r.time;
    }
    out.push({ time: r.time, sound: r.sound, gain: r.gain, pitch, shape: r.shape });
  }
  return out;
}

/** Sounds that must survive thinning — they carry the shape of the piece. */
const STRUCTURAL = new Set<SoundName>(["impact", "chime", "bell", "shimmer", "riser", "sub"]);

/**
 * Thin near-simultaneous cues and duck fast runs.
 *
 * Accenting matters as much as thinning: the *first* hit of a run keeps its full
 * level and each following one is quieter, which is how a real designer would mix
 * a stagger. A flat multiplier (what this used to do) just makes the whole run
 * sound distant.
 */
function thin(cues: SoundCue[], minGap: number): SoundCue[] {
  const out: SoundCue[] = [];
  let lastTime = -Infinity;
  let runLength = 0;
  for (const c of cues) {
    const gap = c.time - lastTime;
    if (gap < minGap && !STRUCTURAL.has(c.sound)) continue;
    // Layers land on the same instant by design (impact + sub); don't count them
    // toward the run or they duck each other.
    if (gap < 0.008) {
      out.push(c);
      continue;
    }
    runLength = gap < 0.2 ? runLength + 1 : 0;
    const duck = runLength === 0 ? 1 : Math.max(0.42, 1 - 0.16 * runLength);
    out.push({ ...c, gain: c.gain * duck });
    lastTime = c.time;
  }
  return out;
}

/**
 * Hard-bound the sheet, preferring structural cues but never exempting them —
 * they used to be exempt, and a template whose every beat became an impact (a
 * marquee of 30 lighting bulbs, say) sailed past the limit with 67 cues.
 */
function cap(cues: SoundCue[], max: number): SoundCue[] {
  if (cues.length <= max) return cues;
  const structural = cues.filter((c) => STRUCTURAL.has(c.sound)).sort((a, b) => b.gain - a.gain);
  const rest = cues.filter((c) => !STRUCTURAL.has(c.sound)).sort((a, b) => b.gain - a.gain);
  const keep = structural.slice(0, max);
  return [...keep, ...rest.slice(0, Math.max(0, max - keep.length))].sort((a, b) => a.time - b.time);
}

/**
 * Impacts are punctuation, not texture. Classification promotes a heavy springy
 * landing to impact+sub, but a template full of them (or any cinematic one,
 * where the bar is lower) ends up hitting hard thirty times in a row. Keep the
 * first of any close cluster and demote the rest to a pop.
 */
const IMPACT_SPACING = 0.6;

function spaceImpacts(cues: SoundCue[]): SoundCue[] {
  let lastImpact = -Infinity;
  const demoted = new Set<number>();
  const out: SoundCue[] = [];
  cues.forEach((c, i) => {
    if (c.sound === "impact") {
      if (c.time - lastImpact < IMPACT_SPACING) {
        demoted.add(i);
        out.push({ ...c, sound: "pop", gain: c.gain * 0.8 });
        return;
      }
      lastImpact = c.time;
    }
    // A sub only makes sense under an impact that survived.
    if (c.sound === "sub" && demoted.has(i - 1)) return;
    out.push(c);
  });
  return out;
}

/**
 * Build a cue sheet from a timeline's beats.
 *
 * `profile` decides the instrument family and scale; motion decides the rhythm.
 */
export function cuesFromBeats(beats: TimelineBeat[], duration: number, profile: SoundProfile = "ui"): SoundCue[] {
  const spec = profileSpec(profile);

  const raw = beats
    .flatMap((b) => classify(b, profile))
    .filter((c) => c.time >= 0 && c.time < duration + 0.001)
    .sort((a, b) => a.time - b.time);

  const cues = thin(assignPitches(raw, spec.scale), spec.minGap);

  // A swell into the first real hit, if there is room for it and nothing else is
  // already sounding through that window. Cheap to add, and it is most of what
  // makes an opener feel deliberate rather than assembled.
  if (spec.riser) {
    const first = cues.find((c) => c.sound === "impact" || c.sound === "pop");
    if (first && first.time >= 0.5) {
      const from = first.time - 0.45;
      const clear = !cues.some((c) => c.time > from + 0.02 && c.time < first.time - 0.02);
      if (clear) cues.push({ time: from, sound: "riser", gain: 0.3, pitch: 0, shape: 0.6 });
    }
  }

  // Resolve. Only when the tail is genuinely quiet — the old layer appended a
  // fixed ding at duration-0.55 unconditionally, which is why so many templates
  // ended on a beep that had nothing to do with the picture.
  if (spec.resolve !== "none") {
    const tailFrom = Math.max(0, duration - 0.7);
    const tailBusy = cues.some((c) => c.time >= tailFrom && !["tick", "click"].includes(c.sound));
    if (!tailBusy && duration > 1) {
      const at = Math.max(0, duration - 0.5);
      cues.push({ time: at, sound: spec.resolve, gain: 0.34, pitch: 0, shape: 0.5 });
    }
  }

  cues.sort((a, b) => a.time - b.time);
  // Trim to the profile's level, then hard-clamp so one loud beat can't dominate.
  return cap(
    spaceImpacts(cues).map((c) => ({ ...c, gain: Math.min(0.95, c.gain * spec.level) })),
    40,
  );
}

/** Derive cues from a timeline (no template context — plain `ui` profile). */
export function cuesFromTimeline(timeline: JimaTimeline, duration: number, profile: SoundProfile = "ui"): SoundCue[] {
  return cuesFromBeats(timeline.beats(), duration, profile);
}

/** The profile a template sounds in: its own `sound` override, else its category. */
export function profileForTemplate(def: Pick<TemplateDefinition, "category" | "sound">): SoundProfile {
  return def.sound ?? profileForCategory(def.category);
}

/**
 * Re-base a cue sheet onto output time when the start has been trimmed.
 *
 * Cue times are timeline times; the output clock starts at `trim`. Anything that
 * sounded before the new in-point never happens, so it is dropped rather than
 * piled onto t=0.
 */
export function trimCues(cues: SoundCue[], trim: number): SoundCue[] {
  if (trim <= 0) return cues;
  return cues.filter((c) => c.time >= trim).map((c) => ({ ...c, time: c.time - trim }));
}

/** Cue sheet for a template — the entry point preview and export both use. */
export function cuesForTemplate(
  def: Pick<TemplateDefinition, "category" | "sound">,
  timeline: JimaTimeline,
  duration: number,
): CueSheet {
  const profile = profileForTemplate(def);
  return { cues: cuesFromBeats(timeline.beats(), duration, profile), profile };
}

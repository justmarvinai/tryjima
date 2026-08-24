import { mulberry32 } from "../timeline/rng";
import type { SoundCue } from "./cues";
import { profileSpec, type SoundProfile } from "./profile";

/**
 * A procedural music bed: a short loop generated from the template's own sound
 * profile and locked to its length.
 *
 * Still no sample files — the same rule ADR-012 set for the SFX. Everything here
 * is a note list that the synth turns into oscillators, so there is nothing to
 * bundle, fetch or license, and a given (profile, duration, seed) always
 * generates the same bed.
 *
 * The bed is deliberately *simple*: a root-movement bass, a sparse chord pad and
 * an optional arpeggio, all drawn from the profile's scale. It is scoring, not
 * songwriting — the job is to stop a 4-second animation feeling like it is
 * playing in a vacuum, and then get out of the way of the sound effects.
 */

export interface MusicNote {
  /** Seconds from the start of the bed. */
  time: number;
  /** Seconds the note sounds for. */
  duration: number;
  /** Semitones from the profile root. */
  pitch: number;
  /** 0–1 before the bed's own level trim. */
  gain: number;
  /** Which layer it belongs to — the synth voices these differently. */
  voice: MusicVoice;
}

export type MusicVoice = "bass" | "pad" | "arp";

export interface MusicBed {
  notes: MusicNote[];
  /** Beats per minute the bed was written at. */
  bpm: number;
  /** Seconds per beat. */
  beat: number;
  /** Total length in seconds — always exactly the animation's length. */
  duration: number;
}

/** Chord degrees (semitones from the root) per profile, in the profile's mood. */
const PROGRESSIONS: Record<SoundProfile, number[][]> = {
  // i – VI – III – VII, the workhorse minor loop: forward-moving, not sad.
  ui: [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]],
  type: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
  impact: [[0, 3, 7], [10, 14, 17], [8, 12, 15], [0, 3, 7]],
  data: [[0, 4, 7], [2, 5, 9], [7, 11, 14], [5, 9, 12]],
  airy: [[0, 4, 7, 11], [5, 9, 12, 16], [7, 11, 14, 18], [0, 4, 7, 11]],
  warm: [[0, 3, 7], [5, 8, 12], [10, 14, 17], [3, 7, 10]],
  // Open fifths — no third at all, so it reads as scale rather than mood.
  cinematic: [[0, 7, 12], [8, 15, 20], [5, 12, 17], [0, 7, 12]],
};

/** Tempo per profile. Data steps briskly; cinematic breathes. */
const BPM: Record<SoundProfile, number> = {
  ui: 112,
  type: 104,
  impact: 120,
  data: 108,
  airy: 92,
  warm: 88,
  cinematic: 76,
};

/** Which layers each profile uses. An arp on a warm quote would be a nightclub. */
const LAYERS: Record<SoundProfile, { pad: boolean; arp: boolean }> = {
  ui: { pad: true, arp: true },
  type: { pad: true, arp: false },
  impact: { pad: true, arp: true },
  data: { pad: true, arp: true },
  airy: { pad: true, arp: false },
  warm: { pad: true, arp: false },
  cinematic: { pad: true, arp: false },
};

/**
 * Generate a bed that lasts exactly `duration` seconds.
 *
 * Tempo is nudged so a whole number of bars fits the animation — a bed that gets
 * cut off mid-phrase is worse than no bed at all. Nothing is ever scheduled past
 * the end, so the last chord lands and rings out rather than being chopped.
 */
export function buildMusicBed(profile: SoundProfile, duration: number, seed = 0x5f3759df): MusicBed {
  const spec = profileSpec(profile);
  const layers = LAYERS[profile];
  const progression = PROGRESSIONS[profile];
  const rng = mulberry32(seed ^ 0x9e3779b9);

  // Fit a whole number of 4-beat bars into the animation, then derive the tempo
  // from that rather than the other way round.
  const nominalBeat = 60 / BPM[profile];
  const bars = Math.max(1, Math.round(duration / (nominalBeat * 4)));
  const beat = duration / (bars * 4);
  const bpm = 60 / beat;

  const notes: MusicNote[] = [];
  const push = (n: MusicNote): void => {
    if (n.time < duration - 0.02) notes.push(n);
  };

  for (let bar = 0; bar < bars; bar++) {
    const chord = progression[bar % progression.length] ?? [0];
    const root = chord[0] ?? 0;
    const barStart = bar * 4 * beat;

    // --- Bass: the root, an octave down, on beat 1 (and a lift on 3). ---
    push({ time: barStart, duration: beat * 2.4, pitch: root - 24, gain: 0.9, voice: "bass" });
    if (profile === "impact" || profile === "ui") {
      push({ time: barStart + beat * 2.5, duration: beat * 1.2, pitch: root - 24, gain: 0.55, voice: "bass" });
    }

    // --- Pad: the chord, held across the bar, notes fanned so it swells in. ---
    if (layers.pad) {
      chord.forEach((degree, i) => {
        push({
          time: barStart + i * beat * 0.06,
          duration: beat * 3.7,
          pitch: degree - 12,
          gain: 0.42 - i * 0.05,
          voice: "pad",
        });
      });
    }

    // --- Arp: eighth notes wandering the chord, an octave up. ---
    if (layers.arp) {
      for (let step = 0; step < 8; step++) {
        // Leave gaps — a continuous arp fights the SFX for the same register.
        if (rng() < 0.32) continue;
        const degree = chord[step % chord.length] ?? 0;
        push({
          time: barStart + step * beat * 0.5,
          duration: beat * 0.42,
          pitch: degree + (step >= 4 ? 12 : 0),
          gain: 0.2 + rng() * 0.06,
          voice: "arp",
        });
      }
    }
  }

  // Keep the bed under the effects: a music bed that competes with the cues is
  // the reason "add background music" usually makes a short video worse.
  const trim = 0.55 * spec.level;
  return {
    notes: notes.map((n) => ({ ...n, gain: n.gain * trim })).sort((a, b) => a.time - b.time),
    bpm,
    beat,
    duration,
  };
}

// ---------------------------------------------------------------------------
// Ducking
// ---------------------------------------------------------------------------

/** Cues loud enough to be worth making room for. */
const DUCK_TRIGGERS = new Set(["impact", "sub", "pop", "bell", "chime", "riser"]);

export interface DuckStep {
  /** Seconds. The gain must *reach* `gain` at this moment. */
  time: number;
  /** Linear gain the bed is at by then (1 = untouched). */
  gain: number;
}

/**
 * An automation curve that pulls the bed down under the loud cues and lets it
 * back up between them — the same sidechain move a person would ride by hand.
 *
 * The cue sheet already knows exactly when the hits are, so this needs no
 * envelope following and no analysis. Each step says "be at this level by this
 * time", which is exactly what `linearRampToValueAtTime` wants, and each dip is
 * anchored open just before it so the ramp is a dip rather than a long slide
 * down from wherever the curve happened to be.
 *
 * Overlapping dips take the deepest, and a cluster of hits stays down for the
 * whole cluster rather than pumping once per hit.
 */
export function duckAutomation(
  cues: SoundCue[],
  duration: number,
  opts: { depth?: number; attack?: number; hold?: number; release?: number } = {},
): DuckStep[] {
  const depth = opts.depth ?? 0.45;
  const attack = opts.attack ?? 0.035;
  const hold = opts.hold ?? 0.07;
  const release = opts.release ?? 0.3;

  const hits = cues
    .filter((c) => DUCK_TRIGGERS.has(c.sound) && c.gain > 0.25)
    // Typical impact gains land around 0.5–0.6 after the profile trim, so
    // normalise against that rather than against full scale — otherwise every
    // duck comes out at half the intended depth.
    .map((c) => ({ time: c.time, strength: Math.min(1, c.gain / 0.55) }))
    .sort((a, b) => a.time - b.time);
  if (hits.length === 0) return [];

  // Merge hits that land inside one dip — one duck for the cluster.
  const clusters: { time: number; strength: number }[] = [];
  for (const h of hits) {
    const last = clusters[clusters.length - 1];
    if (last && h.time - last.time < hold + release) {
      last.strength = Math.max(last.strength, h.strength);
    } else {
      clusters.push({ ...h });
    }
  }

  const steps: DuckStep[] = [{ time: 0, gain: 1 }];
  for (const c of clusters) {
    const floor = 1 - depth * c.strength;
    const open = Math.max(0, c.time - attack);
    // Anchor at full level right before the dip, or the ramp starts from
    // whenever the last step was and reads as a slow fade, not a duck.
    if (open > (steps[steps.length - 1]?.time ?? 0)) steps.push({ time: open, gain: 1 });
    steps.push({ time: c.time, gain: floor });
    steps.push({ time: c.time + hold, gain: floor });
    steps.push({ time: Math.min(duration, c.time + hold + release), gain: 1 });
  }
  return steps.filter((s) => s.time <= duration).sort((a, b) => a.time - b.time);
}

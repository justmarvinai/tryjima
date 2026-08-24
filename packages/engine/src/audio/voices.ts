import { mulberry32 } from "../timeline/rng";
import type { SoundCue } from "./cues";
import { profileSpec, type SoundProfile } from "./profile";

/**
 * The pure half of the SFX synth: a cue becomes a list of {@link VoiceSpec}s, and
 * a voice is a description of one oscillator or noise burst. Nothing here touches
 * the Web Audio API, so it is unit-testable in Node and — more importantly — the
 * live preview and the offline export bake provably identical graphs.
 *
 * Two ideas do most of the work in making these sound made rather than generated:
 *
 * 1. **Transient + body.** Every percussive sound is a very short filtered noise
 *    tick layered under a pitched body. A bare oscillator with an envelope is a
 *    beep; the tick is what makes it read as an object hitting something.
 * 2. **Everything is relative to a root.** Frequencies come from the profile's
 *    root and the cue's pitch, so a staggered run walks a scale instead of
 *    repeating one hardcoded frequency.
 */

export type SoundPack = "pop" | "soft" | "retro";

export const SOUND_PACKS: { id: SoundPack; label: string; hint: string }[] = [
  { id: "pop", label: "Crisp", hint: "Bright, punchy, modern app UI." },
  { id: "soft", label: "Soft", hint: "Rounded and calm, longer tails." },
  { id: "retro", label: "Retro", hint: "Chiptune squares, dry and close." },
];

export interface VoiceSpec {
  kind: "tone" | "noise";
  /** Seconds after the cue time. */
  delay: number;
  /** Oscillator shape (tone only). */
  wave: OscillatorType;
  /** Pitch glide, Hz (tone only; f1 === f0 for a steady note). */
  f0: number;
  f1: number;
  /** Detuned twin in cents — 0 for none. Thickens tonal bodies. */
  detune: number;
  /** Noise colour (noise only). Pink reads as air; white as a tick. */
  pink: boolean;
  /** Filter sweep applied to the voice, if any. */
  filter: { type: BiquadFilterType; f0: number; f1: number; q: number } | null;
  attack: number;
  hold: number;
  decay: number;
  peak: number;
  /** 0–1 send into the shared room. */
  room: number;
}

const V: Omit<VoiceSpec, "f0" | "f1" | "peak"> = {
  kind: "tone",
  delay: 0,
  wave: "triangle",
  detune: 0,
  pink: false,
  filter: null,
  attack: 0.003,
  hold: 0,
  decay: 0.1,
  room: 0,
};

const tone = (o: Partial<VoiceSpec> & { f0: number; peak: number }): VoiceSpec => ({
  ...V,
  kind: "tone",
  f1: o.f1 ?? o.f0,
  ...o,
});

const noise = (o: Partial<VoiceSpec> & { peak: number }): VoiceSpec => ({
  ...V,
  kind: "noise",
  f0: 0,
  f1: 0,
  ...o,
});

/** Semitones → Hz against a root. */
function hz(root: number, semitones: number): number {
  return root * Math.pow(2, semitones / 12);
}

const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

/**
 * The layers for one cue, before pack styling.
 *
 * `shape` (0–1) is how big the gesture was: it stretches decays and opens
 * filters, so one sound name covers a snap and a long glide without either
 * sounding wrong.
 */
function baseVoices(cue: SoundCue, profile: SoundProfile): VoiceSpec[] {
  const spec = profileSpec(profile);
  const f = hz(spec.root, cue.pitch);
  const s = cue.shape;
  const g = cue.gain;
  const room = spec.room;
  const ceil = spec.tone;

  switch (cue.sound) {
    case "click":
      return [
        noise({ filter: { type: "bandpass", f0: 2200, f1: 1500, q: 1.3 }, attack: 0.0008, decay: 0.022, peak: g, room: room * 0.4 }),
        tone({ f0: f * 2, f1: f * 1.8, wave: "triangle", attack: 0.001, decay: 0.02, peak: g * 0.22, room: 0 }),
      ];

    case "tick":
      return [
        noise({
          filter: { type: "highpass", f0: 3800, f1: Math.min(ceil, 7000), q: 0.7 },
          attack: 0.002,
          decay: lerp(0.03, 0.07, s),
          peak: g,
          room: room * 0.6,
        }),
      ];

    case "tap":
      return [
        noise({ filter: { type: "bandpass", f0: 3000, f1: 2200, q: 1.1 }, attack: 0.001, decay: 0.014, peak: g * 0.5, room: 0 }),
        tone({ f0: f, f1: f * 0.72, wave: "triangle", attack: 0.002, decay: lerp(0.07, 0.12, s), peak: g, room }),
      ];

    case "pop":
      return [
        noise({ filter: { type: "highpass", f0: 2400, f1: 3600, q: 0.7 }, attack: 0.001, decay: 0.016, peak: g * 0.45, room: 0 }),
        tone({ f0: f * 1.25, f1: f * 0.62, wave: "triangle", attack: 0.003, hold: 0.006, decay: lerp(0.1, 0.2, s), peak: g, room }),
      ];

    case "pluck":
      // Marimba-ish: a strong 4th partial over the fundamental is what makes a
      // mallet read as wood rather than as a sine.
      return [
        noise({ filter: { type: "bandpass", f0: 1800, f1: 1200, q: 1.6 }, attack: 0.0008, decay: 0.012, peak: g * 0.3, room: 0 }),
        tone({ f0: f, wave: "sine", attack: 0.002, decay: lerp(0.26, 0.5, s), peak: g, room: room * 1.1, detune: 4 }),
        tone({ f0: f * 4, wave: "sine", attack: 0.001, decay: lerp(0.07, 0.12, s), peak: g * 0.2, room: room * 0.8 }),
      ];

    case "impact":
      return [
        noise({ filter: { type: "highpass", f0: 2800, f1: 4200, q: 0.6 }, attack: 0.001, decay: 0.022, peak: g * 0.55, room: room * 0.5 }),
        noise({ pink: true, filter: { type: "bandpass", f0: 420, f1: 240, q: 0.8 }, attack: 0.002, decay: lerp(0.09, 0.16, s), peak: g * 0.5, room: room * 0.6 }),
        tone({ f0: f * 0.75, f1: f * 0.4, wave: "triangle", attack: 0.002, hold: 0.008, decay: lerp(0.16, 0.28, s), peak: g, room: room * 1.2 }),
      ];

    case "sub":
      // No room send: low frequencies in a reverb tail just turn to mud.
      return [
        tone({ f0: 94, f1: 46, wave: "sine", filter: { type: "lowpass", f0: 180, f1: 120, q: 0.7 }, attack: 0.004, decay: lerp(0.16, 0.3, s), peak: g, room: 0 }),
      ];

    case "swish":
      return [
        noise({
          pink: true,
          filter: { type: "bandpass", f0: 700, f1: Math.min(ceil, 2600), q: 0.9 },
          attack: 0.018,
          decay: lerp(0.1, 0.22, s),
          peak: g,
          room: room * 0.8,
        }),
      ];

    case "whoosh":
      return [
        noise({
          pink: true,
          filter: { type: "lowpass", f0: 360, f1: Math.min(ceil, 3400), q: 0.7 },
          attack: lerp(0.04, 0.11, s),
          decay: lerp(0.2, 0.5, s),
          peak: g,
          room: room * 1.3,
        }),
      ];

    case "fall":
      return [
        noise({
          pink: true,
          filter: { type: "bandpass", f0: Math.min(ceil, 2200), f1: 480, q: 1.0 },
          attack: 0.014,
          decay: lerp(0.14, 0.34, s),
          peak: g,
          room: room * 1.1,
        }),
        tone({ f0: f * 0.5, f1: f * 0.25, wave: "sine", attack: 0.01, decay: lerp(0.14, 0.3, s), peak: g * 0.35, room }),
      ];

    case "riser":
      // Amplitude *rises* into the hit: nearly all attack, almost no decay.
      return [
        noise({ pink: true, filter: { type: "lowpass", f0: 300, f1: Math.min(ceil, 5200), q: 0.8 }, attack: 0.4, hold: 0.02, decay: 0.06, peak: g, room: room * 1.2 }),
        tone({ f0: f * 0.5, f1: f, wave: "triangle", attack: 0.4, hold: 0.02, decay: 0.06, peak: g * 0.5, room: room * 1.2 }),
      ];

    case "chime":
      // Octave + octave-fifth, higher partials decaying faster (as they do).
      return [
        tone({ f0: f, wave: "sine", attack: 0.004, decay: 0.6, peak: g, room: room * 1.4, detune: 5 }),
        tone({ f0: f * 2, wave: "sine", attack: 0.003, decay: 0.34, peak: g * 0.4, room: room * 1.4 }),
        tone({ f0: f * 3, wave: "sine", attack: 0.002, decay: 0.2, peak: g * 0.16, room: room * 1.4 }),
      ];

    case "bell":
      // Inharmonic partials — the tubular-bell ratios. A bell is not a sine.
      return [
        tone({ f0: f, wave: "sine", attack: 0.003, decay: 1.15, peak: g, room: room * 1.6, detune: 6 }),
        tone({ f0: f * 2.76, wave: "sine", attack: 0.002, decay: 0.52, peak: g * 0.34, room: room * 1.6 }),
        tone({ f0: f * 5.4, wave: "sine", attack: 0.002, decay: 0.26, peak: g * 0.13, room: room * 1.6 }),
      ];

    case "shimmer": {
      const steps = profileSpec(profile).scale;
      return [0, 1, 2, 3].map((i) =>
        tone({
          f0: hz(spec.root, (steps[i % steps.length] ?? 0) + 12),
          wave: "sine",
          delay: i * 0.055,
          attack: 0.003,
          decay: 0.22,
          peak: g * (0.55 - i * 0.08),
          room: room * 1.6,
        }),
      );
    }
  }
}

/** Pack styling. This is where the three packs become real characters. */
function style(voices: VoiceSpec[], pack: SoundPack, seed: number): VoiceSpec[] {
  // A few cents of detune and a few percent of decay, derived from the cue index
  // so it stays deterministic. Identical repeated cues otherwise render
  // phase-identical, which is exactly what makes a run sound mechanical.
  const rng = mulberry32(0x51ed270b ^ (seed * 2654435761));
  const jitter = (spread: number): number => 1 + (rng() * 2 - 1) * spread;

  return voices.map((v) => {
    const out: VoiceSpec = { ...v, decay: v.decay * jitter(0.04) };

    if (pack === "soft") {
      if (out.kind === "tone") out.wave = "sine";
      out.attack = out.attack * 2.4 + 0.002;
      out.decay *= 1.45;
      out.room *= 1.5;
      out.detune = out.detune === 0 ? 0 : out.detune + 3;
      if (out.kind === "noise") {
        // Transients are the harsh part; soften rather than remove them.
        out.peak *= 0.4;
        out.filter = out.filter
          ? { ...out.filter, f0: Math.min(out.filter.f0, 3200), f1: Math.min(out.filter.f1, 3200) }
          : { type: "lowpass", f0: 3200, f1: 2600, q: 0.7 };
      }
      return out;
    }

    if (pack === "retro") {
      out.room *= 0.22;
      out.decay *= 0.72;
      out.detune = 0;
      if (out.kind === "noise") {
        // Chiptune has no noise floor to speak of: turn air into a pulse at the
        // band's centre, which is where the "8-bit" character actually lives.
        const centre = out.filter ? Math.max(160, Math.min(4000, (out.filter.f0 + out.filter.f1) / 2)) : 1200;
        out.kind = "tone";
        out.wave = "square";
        out.f0 = centre;
        out.f1 = out.filter ? Math.max(160, Math.min(4000, out.filter.f1)) : centre;
        out.filter = null;
        out.peak *= 0.62;
        out.decay = Math.min(out.decay, 0.08);
      } else {
        out.wave = "square";
        out.peak *= 0.82; // squares carry more energy than triangles at equal peak
      }
      return out;
    }

    // "pop" — the default. Triangle bodies, transients intact.
    out.detune = out.detune * jitter(0.25);
    return out;
  });
}

/**
 * Voices for one cue, fully styled. `index` is the cue's position in the sheet
 * and only feeds the deterministic jitter.
 */
export function voicesForCue(cue: SoundCue, pack: SoundPack, profile: SoundProfile, index = 0): VoiceSpec[] {
  return style(baseVoices(cue, profile), pack, index);
}

/** Longest tail a cue can produce — how much room an offline render must leave. */
export function cueTail(cue: SoundCue, pack: SoundPack, profile: SoundProfile): number {
  let tail = 0;
  for (const v of voicesForCue(cue, pack, profile)) {
    tail = Math.max(tail, v.delay + v.attack + v.hold + v.decay);
  }
  return tail;
}

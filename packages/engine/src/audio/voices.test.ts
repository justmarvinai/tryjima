import { describe, it, expect } from "vitest";
import { voicesForCue, cueTail, SOUND_PACKS, type SoundPack } from "./voices";
import { profileSpec, type SoundProfile } from "./profile";
import type { SoundCue, SoundName } from "./cues";

const NAMES: SoundName[] = [
  "click", "tick", "tap", "pop", "pluck", "impact", "sub",
  "swish", "whoosh", "fall", "riser", "chime", "bell", "shimmer",
];
const PACKS: SoundPack[] = ["pop", "soft", "retro"];
const PROFILES: SoundProfile[] = ["ui", "type", "impact", "data", "airy", "warm", "cinematic"];

const cue = (sound: SoundName, over: Partial<SoundCue> = {}): SoundCue => ({
  time: 0.5,
  sound,
  gain: 0.6,
  pitch: 0,
  shape: 0.5,
  ...over,
});

describe("voice specs", () => {
  it("voices every sound in every pack and profile", () => {
    for (const name of NAMES) {
      for (const pack of PACKS) {
        for (const profile of PROFILES) {
          const voices = voicesForCue(cue(name), pack, profile);
          expect(voices.length, `${name}/${pack}/${profile}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("produces only finite, positive, audible parameters", () => {
    for (const name of NAMES) {
      for (const pack of PACKS) {
        for (const profile of PROFILES) {
          for (const v of voicesForCue(cue(name), pack, profile)) {
            const where = `${name}/${pack}/${profile}`;
            for (const n of [v.f0, v.f1, v.attack, v.hold, v.decay, v.peak, v.room, v.delay]) {
              expect(Number.isFinite(n), where).toBe(true);
            }
            expect(v.attack, where).toBeGreaterThan(0);
            expect(v.decay, where).toBeGreaterThan(0);
            expect(v.peak, where).toBeGreaterThan(0);
            expect(v.room, where).toBeLessThanOrEqual(1);
            if (v.kind === "tone") {
              // Inside the range a phone speaker can actually reproduce.
              expect(v.f0, where).toBeGreaterThan(30);
              expect(v.f0, where).toBeLessThan(20000);
              expect(v.f1, where).toBeGreaterThan(30);
              expect(v.f1, where).toBeLessThan(20000);
            }
            if (v.filter) {
              expect(v.filter.f0, where).toBeGreaterThan(20);
              expect(v.filter.f1, where).toBeGreaterThan(20);
              expect(v.filter.q, where).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  it("keeps a single cue's layers within headroom", () => {
    // Layers that start together must not sum past unity, or the limiter is doing
    // damage control on every hit instead of catching the rare overlap.
    for (const name of NAMES) {
      for (const pack of PACKS) {
        for (const profile of PROFILES) {
          const voices = voicesForCue(cue(name, { gain: 0.95 }), pack, profile);
          const byOnset = new Map<number, number>();
          for (const v of voices) {
            const key = Math.round(v.delay * 1000);
            byOnset.set(key, (byOnset.get(key) ?? 0) + v.peak * (v.detune === 0 ? 1 : 1.5));
          }
          for (const sum of byOnset.values()) {
            expect(sum, `${name}/${pack}/${profile}`).toBeLessThanOrEqual(2.1);
          }
        }
      }
    }
  });

  it("layers a transient under every percussive body", () => {
    // The tick under the tone is what makes these read as objects rather than
    // beeps. Retro trades noise for a pulse, so it still gets two layers.
    for (const name of ["tap", "pop", "pluck", "impact"] as SoundName[]) {
      for (const pack of PACKS) {
        expect(voicesForCue(cue(name), pack, "ui").length, `${name}/${pack}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it("tunes tonal voices to the profile root and the cue's pitch", () => {
    const root = profileSpec("data").root;
    const [, body] = voicesForCue(cue("pluck", { pitch: 0 }), "pop", "data");
    expect(body!.f0).toBeCloseTo(root, 4);

    const [, up] = voicesForCue(cue("pluck", { pitch: 12 }), "pop", "data");
    expect(up!.f0).toBeCloseTo(root * 2, 4);
  });

  it("gives the bell inharmonic partials, not octaves", () => {
    const voices = voicesForCue(cue("bell"), "pop", "cinematic");
    const ratios = voices.map((v) => v.f0 / voices[0]!.f0);
    expect(ratios.some((r) => Math.abs(r - Math.round(r)) > 0.2)).toBe(true);
  });

  it("keeps low frequencies out of the room", () => {
    for (const profile of PROFILES) {
      for (const v of voicesForCue(cue("sub"), "pop", profile)) expect(v.room).toBe(0);
    }
  });

  it("makes the riser rise: nearly all attack, almost no decay", () => {
    for (const v of voicesForCue(cue("riser"), "pop", "cinematic")) {
      expect(v.attack).toBeGreaterThan(v.decay);
      expect(v.attack).toBeGreaterThan(0.2);
    }
  });

  describe("packs are genuinely different characters", () => {
    it("soft is rounder, longer and more distant than crisp", () => {
      const crisp = voicesForCue(cue("pop"), "pop", "ui");
      const soft = voicesForCue(cue("pop"), "soft", "ui");
      const tail = (vs: typeof crisp) => Math.max(...vs.map((v) => v.decay));
      expect(tail(soft)).toBeGreaterThan(tail(crisp));
      expect(Math.max(...soft.map((v) => v.room))).toBeGreaterThan(Math.max(...crisp.map((v) => v.room)));
      expect(soft.filter((v) => v.kind === "tone").every((v) => v.wave === "sine")).toBe(true);
      // Transients are softened, not deleted.
      const crispTick = crisp.find((v) => v.kind === "noise");
      const softTick = soft.find((v) => v.kind === "noise");
      expect(softTick).toBeDefined();
      expect(softTick!.peak).toBeLessThan(crispTick!.peak);
    });

    it("retro is all pulses, dry and short", () => {
      const retro = voicesForCue(cue("whoosh"), "retro", "ui");
      expect(retro.every((v) => v.kind === "tone")).toBe(true);
      expect(retro.every((v) => v.wave === "square")).toBe(true);
      const crisp = voicesForCue(cue("whoosh"), "pop", "ui");
      expect(Math.max(...retro.map((v) => v.room))).toBeLessThan(Math.max(...crisp.map((v) => v.room)));
      expect(retro.every((v) => v.detune === 0)).toBe(true);
    });

    it("ships exactly three labelled packs", () => {
      expect(SOUND_PACKS.map((p) => p.id).sort()).toEqual(["pop", "retro", "soft"]);
      for (const p of SOUND_PACKS) {
        expect(p.label.length).toBeGreaterThan(0);
        expect(p.hint.length).toBeGreaterThan(0);
      }
    });
  });

  it("stretches decay with the gesture's size", () => {
    const short = voicesForCue(cue("whoosh", { shape: 0 }), "pop", "ui");
    const long = voicesForCue(cue("whoosh", { shape: 1 }), "pop", "ui");
    expect(long[0]!.decay).toBeGreaterThan(short[0]!.decay);
  });

  it("is deterministic for a given cue index", () => {
    const a = voicesForCue(cue("pop"), "pop", "ui", 7);
    const b = voicesForCue(cue("pop"), "pop", "ui", 7);
    expect(a).toEqual(b);
  });

  it("varies repeated identical cues so a run does not phase-cancel", () => {
    const a = voicesForCue(cue("tap"), "pop", "ui", 0);
    const b = voicesForCue(cue("tap"), "pop", "ui", 1);
    expect(a).not.toEqual(b);
    // But only slightly — same sound, not a different one.
    expect(b[1]!.decay / a[1]!.decay).toBeGreaterThan(0.85);
    expect(b[1]!.decay / a[1]!.decay).toBeLessThan(1.18);
  });

  it("reports a tail long enough to contain the sound", () => {
    for (const name of NAMES) {
      const tail = cueTail(cue(name), "pop", "cinematic");
      expect(tail).toBeGreaterThan(0);
      expect(tail).toBeLessThan(3);
      for (const v of voicesForCue(cue(name), "pop", "cinematic")) {
        expect(tail).toBeGreaterThanOrEqual(v.delay + v.attack + v.hold + v.decay - 1e-9);
      }
    }
  });
});

import { describe, it, expect } from "vitest";
import { buildMusicBed, duckAutomation } from "./music";
import type { SoundCue, SoundName } from "./cues";
import type { SoundProfile } from "./profile";

const PROFILES: SoundProfile[] = ["ui", "type", "impact", "data", "airy", "warm", "cinematic"];

const cue = (time: number, sound: SoundName = "impact", gain = 0.6): SoundCue => ({
  time,
  sound,
  gain,
  pitch: 0,
  shape: 0.5,
});

describe("music bed", () => {
  it("generates a playable bed for every profile", () => {
    for (const p of PROFILES) {
      const bed = buildMusicBed(p, 4);
      expect(bed.notes.length, p).toBeGreaterThan(3);
      expect(bed.bpm, p).toBeGreaterThan(40);
      expect(bed.bpm, p).toBeLessThan(200);
    }
  });

  it("is exactly as long as the animation, at any length", () => {
    for (const d of [1.5, 2.8, 4, 5.4, 9]) {
      const bed = buildMusicBed("ui", d);
      expect(bed.duration).toBe(d);
      // Nothing may start past the end — a bed cut off mid-phrase is worse
      // than no bed at all.
      for (const n of bed.notes) expect(n.time, `d=${d}`).toBeLessThan(d);
    }
  });

  it("fits a whole number of bars, so the loop lands where the animation does", () => {
    for (const d of [2, 3.3, 4.7, 6]) {
      const bed = buildMusicBed("ui", d);
      const bars = d / (bed.beat * 4);
      expect(bars, `d=${d}`).toBeCloseTo(Math.round(bars), 6);
    }
  });

  it("always lays down a bass line, and never a bare one", () => {
    for (const p of PROFILES) {
      const bed = buildMusicBed(p, 4);
      const voices = new Set(bed.notes.map((n) => n.voice));
      expect(voices.has("bass"), p).toBe(true);
      expect(voices.size, p).toBeGreaterThan(1);
    }
  });

  it("keeps every note quiet enough to sit under the effects", () => {
    for (const p of PROFILES) {
      for (const n of buildMusicBed(p, 5).notes) {
        expect(n.gain, `${p}/${n.voice}`).toBeGreaterThan(0);
        expect(n.gain, `${p}/${n.voice}`).toBeLessThan(0.6);
      }
    }
  });

  it("draws its pitches from a sane register", () => {
    for (const p of PROFILES) {
      for (const n of buildMusicBed(p, 4).notes) {
        expect(n.pitch, `${p}/${n.voice}`).toBeGreaterThanOrEqual(-24);
        expect(n.pitch, `${p}/${n.voice}`).toBeLessThanOrEqual(32);
      }
    }
  });

  it("sounds different per profile — that is the point of the profile", () => {
    const a = buildMusicBed("cinematic", 4);
    const b = buildMusicBed("data", 4);
    expect(a.bpm).not.toBeCloseTo(b.bpm, 3);
  });

  it("is deterministic for a given profile, length and seed", () => {
    expect(buildMusicBed("impact", 4.2, 7)).toEqual(buildMusicBed("impact", 4.2, 7));
    expect(buildMusicBed("impact", 4.2, 7)).not.toEqual(buildMusicBed("impact", 4.2, 8));
  });
});

describe("ducking", () => {
  it("does nothing when there is nothing loud to make room for", () => {
    expect(duckAutomation([cue(1, "tick", 0.2)], 4)).toEqual([]);
    expect(duckAutomation([], 4)).toEqual([]);
  });

  it("reaches the floor exactly on the hit, holds, then recovers", () => {
    const steps = duckAutomation([cue(2)], 5);
    expect(steps[0]!.gain).toBe(1); // starts open
    const dip = steps.filter((s) => s.gain < 1);
    expect(dip).toHaveLength(2); // reach the floor, then hold it
    expect(dip[0]!.time).toBeCloseTo(2, 6);
    expect(dip[1]!.time).toBeGreaterThan(2);
    const recover = steps.filter((s) => s.gain === 1).at(-1);
    expect(recover!.time).toBeGreaterThan(dip[1]!.time);
  });

  it("anchors open just before the dip, so it is a dip and not a slow fade", () => {
    const steps = duckAutomation([cue(2)], 5);
    const beforeDip = steps.filter((s) => s.time < 2 && s.gain === 1).at(-1);
    expect(beforeDip!.time).toBeGreaterThan(1.9);
  });

  it("dips deeper for a louder hit", () => {
    const soft = duckAutomation([cue(2, "impact", 0.3)], 4).find((s) => s.gain < 1)!;
    const loud = duckAutomation([cue(2, "impact", 0.9)], 4).find((s) => s.gain < 1)!;
    expect(loud.gain).toBeLessThan(soft.gain);
  });

  it("holds through a cluster instead of pumping once per hit", () => {
    // Five hits inside one release window should be one dip, not five.
    const steps = duckAutomation([cue(1), cue(1.05), cue(1.1), cue(1.2), cue(1.25)], 4);
    // Two steps per dip (reach + hold), so one cluster is two, not ten.
    expect(steps.filter((s) => s.gain < 1)).toHaveLength(2);
  });

  it("separates hits that are far enough apart", () => {
    const steps = duckAutomation([cue(1), cue(3)], 5);
    expect(steps.filter((s) => s.gain < 1)).toHaveLength(4); // two dips
  });

  it("gets the full dip on a typical impact, not half of it", () => {
    // Impact gains land around 0.5-0.6 after the profile trim; normalising
    // against full scale would halve every duck.
    const floor = duckAutomation([cue(2, "impact", 0.55)], 5).find((s) => s.gain < 1)!;
    expect(floor.gain).toBeLessThanOrEqual(0.56);
  });

  it("never mutes the bed outright", () => {
    for (const s of duckAutomation([cue(1, "impact", 1)], 4)) {
      expect(s.gain).toBeGreaterThan(0.2);
      expect(s.gain).toBeLessThanOrEqual(1);
    }
  });

  it("stays inside the animation and in time order", () => {
    const steps = duckAutomation([cue(0.05), cue(3.9)], 4);
    for (const s of steps) {
      expect(s.time).toBeGreaterThanOrEqual(0);
      expect(s.time).toBeLessThanOrEqual(4);
    }
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i]!.time).toBeGreaterThanOrEqual(steps[i - 1]!.time);
    }
  });

  it("ignores the quiet vocabulary — ticks and clicks are not events", () => {
    expect(duckAutomation([cue(1, "tick", 0.6), cue(2, "click", 0.6)], 4)).toEqual([]);
  });
});

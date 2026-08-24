import { describe, it, expect } from "vitest";
import { outputDuration } from "./runner";
import { trimCues } from "../audio/cues";
import type { SoundCue } from "../audio/cues";

const cue = (time: number): SoundCue => ({ time, sound: "tap", gain: 0.5, pitch: 0, shape: 0.5 });

describe("output duration", () => {
  it("is the template's own length when nothing is trimmed or held", () => {
    expect(outputDuration(4, 0, 0)).toBe(4);
  });

  it("shortens by the trim and lengthens by the hold", () => {
    expect(outputDuration(4, 1, 0)).toBe(3);
    expect(outputDuration(4, 0, 2)).toBe(6);
    expect(outputDuration(4, 1, 2)).toBe(5);
  });

  it("never returns a zero-length output, however brutal the trim", () => {
    expect(outputDuration(4, 10, 0)).toBeGreaterThan(0);
    expect(outputDuration(4, 4, 0)).toBeGreaterThan(0);
  });
});

describe("trimming the cue sheet", () => {
  it("leaves the sheet alone when nothing is trimmed", () => {
    const cues = [cue(0.2), cue(1.4)];
    expect(trimCues(cues, 0)).toBe(cues);
  });

  it("re-bases surviving cues onto the output clock", () => {
    const out = trimCues([cue(1.0), cue(2.5)], 0.8);
    expect(out[0]!.time).toBeCloseTo(0.2, 9);
    expect(out[1]!.time).toBeCloseTo(1.7, 9);
  });

  it("drops cues from before the new in-point instead of piling them on zero", () => {
    // The old sound never happens — stacking it at t=0 would be a burst of
    // everything the trim was meant to skip.
    const out = trimCues([cue(0.1), cue(0.4), cue(2)], 1);
    expect(out).toHaveLength(1);
    expect(out[0]!.time).toBe(1);
  });

  it("does not mutate the input", () => {
    const cues = [cue(2)];
    trimCues(cues, 1);
    expect(cues[0]!.time).toBe(2);
  });
});

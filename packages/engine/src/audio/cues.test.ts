import { describe, it, expect } from "vitest";
import { JimaTimeline } from "../timeline/timeline";
import { linear, spring, outBack, outCubic } from "../timeline/easings";
import { cuesFromBeats, cuesFromTimeline, cuesForTemplate, profileForTemplate, type SoundName } from "./cues";
import { profileForCategory, profileSpec } from "./profile";
import type { TimelineBeat } from "../timeline/timeline";

function beat(partial: Partial<TimelineBeat> & { time: number }): TimelineBeat {
  return {
    dur: 0.3,
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
    count: 1,
    ...partial,
  };
}

const names = (cues: { sound: SoundName }[]): SoundName[] => cues.map((c) => c.sound);

describe("cue mapping", () => {
  it("maps each kind of motion to a fitting family", () => {
    const cues = cuesFromBeats(
      [
        beat({ time: 0.0, overshoot: true, scaleFromSmall: true, dur: 0.5 }), // springy entrance
        beat({ time: 0.6, moveDist: 500, moveAxis: "x", moveSign: 1, dur: 0.5 }), // big slide
        beat({ time: 1.2, moveDist: 120, moveAxis: "x", moveSign: -1, dur: 0.15 }), // short slide
        beat({ time: 1.8, fadeIn: true }), // gentle fade
        beat({ time: 2.4, fadeOut: true }), // something leaving
      ],
      4,
      "ui",
    );
    expect(names(cues)).toEqual(expect.arrayContaining(["pop", "whoosh", "swish", "tick", "fall"]));
  });

  it("gives an exit a different sound from an entrance", () => {
    const inCue = cuesFromBeats([beat({ time: 0.5, scaleFromSmall: true, overshoot: true })], 3, "ui");
    const outCue = cuesFromBeats([beat({ time: 0.5, scaleToSmall: true })], 3, "ui");
    expect(inCue[0]!.sound).not.toBe(outCue[0]!.sound);
    expect(outCue[0]!.sound).toBe("fall");
  });

  it("distinguishes a snap from a glide over the same distance", () => {
    const snap = cuesFromBeats([beat({ time: 0.5, moveDist: 150, moveAxis: "x", moveSign: 1, dur: 0.12 })], 3, "ui");
    const glide = cuesFromBeats([beat({ time: 0.5, moveDist: 150, moveAxis: "x", moveSign: 1, dur: 1.2 })], 3, "ui");
    expect(snap[0]!.sound).toBe("swish");
    expect(glide[0]!.sound).toBe("whoosh");
    // A longer gesture is a longer, more open sound.
    expect(glide[0]!.shape).toBeGreaterThan(snap[0]!.shape);
  });

  it("lays a low layer under a heavy landing", () => {
    const cues = cuesFromBeats(
      [beat({ time: 0.4, overshoot: true, scaleFromSmall: true, moveDist: 400, count: 6, dur: 0.6 })],
      3,
      "impact",
    );
    expect(names(cues)).toContain("impact");
    expect(names(cues)).toContain("sub");
  });

  it("walks the scale across a staggered run instead of repeating one pitch", () => {
    const beats = Array.from({ length: 6 }, (_, i) =>
      beat({ time: 0.1 + i * 0.12, scaleFromSmall: true, overshoot: true, dur: 0.4 }),
    );
    const cues = cuesFromBeats(beats, 3, "data");
    const pitches = cues.filter((c) => c.sound !== "sub").map((c) => c.pitch);
    expect(new Set(pitches).size).toBeGreaterThan(3);
  });

  it("restarts the phrase after a gap", () => {
    const cues = cuesFromBeats(
      [
        beat({ time: 0.1, scaleFromSmall: true }),
        beat({ time: 0.3, scaleFromSmall: true }),
        beat({ time: 2.0, scaleFromSmall: true }), // > 0.55s later → new phrase
      ],
      4,
      "data",
    );
    expect(cues[0]!.pitch).toBe(0);
    expect(cues[2]!.pitch).toBe(0);
  });

  it("accents the first hit of a run and ducks the rest", () => {
    const beats = Array.from({ length: 5 }, (_, i) => beat({ time: 0.5 + i * 0.09, scaleFromSmall: true, dur: 0.3 }));
    // Only the run itself — the tail resolve is appended separately.
    const run = cuesFromBeats(beats, 3, "ui").filter((c) => c.sound === "pop");
    expect(run.length).toBeGreaterThan(2);
    expect(run[0]!.gain).toBeGreaterThan(run[run.length - 1]!.gain);
    // Ducked, not silenced.
    expect(run[run.length - 1]!.gain / run[0]!.gain).toBeGreaterThan(0.35);
  });

  it("only resolves when the tail is actually quiet", () => {
    const quiet = cuesFromBeats([beat({ time: 0.2, scaleFromSmall: true, overshoot: true })], 4, "ui");
    expect(names(quiet)).toContain("chime");

    const busy = cuesFromBeats(
      [
        beat({ time: 0.2, scaleFromSmall: true, overshoot: true }),
        beat({ time: 3.7, overshoot: true, scaleFromSmall: true }),
      ],
      4,
      "ui",
    );
    expect(names(busy)).not.toContain("chime");
  });

  it("voices the resolve per profile", () => {
    const one = beat({ time: 0.2, scaleFromSmall: true });
    expect(names(cuesFromBeats([one], 4, "cinematic"))).toContain("bell");
    expect(names(cuesFromBeats([one], 4, "airy"))).toContain("shimmer");
    expect(names(cuesFromBeats([one], 4, "data"))).toContain("pluck");
  });

  it("swells into the first hit for cinematic templates only", () => {
    const beats = [beat({ time: 1.2, overshoot: true, scaleFromSmall: true, count: 5 })];
    expect(names(cuesFromBeats(beats, 4, "cinematic"))).toContain("riser");
    expect(names(cuesFromBeats(beats, 4, "ui"))).not.toContain("riser");
  });

  it("never places a cue outside the timeline", () => {
    const cues = cuesFromBeats(
      [beat({ time: -0.5, fadeIn: true }), beat({ time: 1, scaleFromSmall: true }), beat({ time: 9, fadeIn: true })],
      3,
      "ui",
    );
    for (const c of cues) {
      expect(c.time).toBeGreaterThanOrEqual(0);
      expect(c.time).toBeLessThanOrEqual(3.05);
    }
  });

  it("keeps impacts as punctuation, not texture", () => {
    // Every one of these would classify as a heavy landing; only well-spaced
    // ones should stay impacts, the rest demote to pops.
    const beats = Array.from({ length: 12 }, (_, i) =>
      beat({ time: i * 0.25, overshoot: true, scaleFromSmall: true, count: 8, moveDist: 500, dur: 0.4 }),
    );
    const cues = cuesFromBeats(beats, 4, "cinematic");
    const impacts = cues.filter((c) => c.sound === "impact");
    expect(impacts.length).toBeGreaterThan(0);
    expect(impacts.length).toBeLessThanOrEqual(8);
    for (let i = 1; i < impacts.length; i++) {
      expect(impacts[i]!.time - impacts[i - 1]!.time).toBeGreaterThanOrEqual(0.6 - 1e-9);
    }
    // A demoted impact must not leave its low layer behind.
    expect(cues.filter((c) => c.sound === "sub").length).toBeLessThanOrEqual(impacts.length);
  });

  it("caps density on a very busy timeline", () => {
    const beats = Array.from({ length: 200 }, (_, i) =>
      beat({ time: i * 0.03, scaleFromSmall: true, overshoot: true }),
    );
    const cues = cuesFromBeats(beats, 6, "ui");
    expect(cues.length).toBeLessThanOrEqual(40);
    // Nothing may exceed full scale, whatever the profile trim.
    for (const c of cues) expect(c.gain).toBeLessThanOrEqual(0.95);
  });

  it("respects the profile's minimum gap", () => {
    const beats = Array.from({ length: 12 }, (_, i) => beat({ time: i * 0.02, fadeIn: true }));
    const warmGap = profileSpec("warm").minGap;
    const cues = cuesFromBeats(beats, 3, "warm").filter((c) => c.sound !== "chime");
    for (let i = 1; i < cues.length; i++) {
      expect(cues[i]!.time - cues[i - 1]!.time).toBeGreaterThanOrEqual(warmGap - 1e-9);
    }
  });

  it("is deterministic", () => {
    const beats = [
      beat({ time: 0.1, overshoot: true, scaleFromSmall: true }),
      beat({ time: 0.7, moveDist: 300, moveAxis: "y", moveSign: 1, dur: 0.2 }),
      beat({ time: 1.4, fadeIn: true }),
    ];
    expect(cuesFromBeats(beats, 3, "impact")).toEqual(cuesFromBeats(beats, 3, "impact"));
  });

  it("sounds different for different profiles on the same motion", () => {
    const beats = [beat({ time: 0.4, scaleFromSmall: true, dur: 0.3 })];
    const ui = cuesFromBeats(beats, 3, "ui");
    const data = cuesFromBeats(beats, 3, "data");
    expect(ui[0]!.sound).not.toBe(data[0]!.sound);
  });
});

describe("cues from a real timeline", () => {
  it("reads beats off a built timeline", () => {
    const box = { x: 0, alpha: 0, scale: { x: 0, y: 0 } };
    const tl = new JimaTimeline();
    tl.to(box, { prop: "scale.x", from: 0.2, to: 1, start: 0, duration: 0.5, ease: outBack });
    tl.to(box, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: linear });
    tl.to(box, { prop: "x", from: 0, to: 600, start: 0.8, duration: 0.6, ease: outCubic });
    tl.to(box, { prop: "scale.y", from: 0.3, to: 1, start: 1.6, duration: 0.5, ease: spring(0.5) });

    const cues = cuesFromTimeline(tl, 2.6, "impact");
    expect(cues.length).toBeGreaterThanOrEqual(3);
    expect(names(cues)).toContain("whoosh");
    expect(cues.every((c) => c.time >= 0 && c.time <= 2.65)).toBe(true);
  });

  it("is deterministic straight off a timeline", () => {
    const build = () => {
      const n = { x: 0, alpha: 1, scale: { x: 1, y: 1 }, rotation: 0 };
      return new JimaTimeline()
        .to(n, { prop: "scale.x", from: 0.1, to: 1, start: 0, duration: 0.5, ease: spring() })
        .to(n, { prop: "x", from: 0, to: 300, start: 0.8, duration: 0.5, ease: linear })
        .to(n, { prop: "rotation", from: -0.5, to: 0, start: 1.6, duration: 0.4, ease: outBack });
    };
    const a = cuesFromTimeline(build(), build().duration, "ui");
    const b = cuesFromTimeline(build(), build().duration, "ui");
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it("picks the template's profile from its category, and honours an override", () => {
    expect(profileForTemplate({ category: "stat" })).toBe("data");
    expect(profileForTemplate({ category: "intro" })).toBe("cinematic");
    expect(profileForTemplate({ category: "stat", sound: "cinematic" })).toBe("cinematic");
  });

  it("maps every category to a profile", () => {
    const categories = [
      "announcement", "statement", "promo", "product", "tech", "photo", "stat", "testimonial",
      "brand", "event", "educational", "comparison", "social", "travel", "showcase", "overlay", "intro",
    ] as const;
    for (const c of categories) expect(profileSpec(profileForCategory(c))).toBeDefined();
  });

  it("returns the sheet's profile alongside its cues", () => {
    const tl = new JimaTimeline();
    tl.to({ alpha: 0 }, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.4, ease: linear });
    const sheet = cuesForTemplate({ category: "intro" }, tl, 2);
    expect(sheet.profile).toBe("cinematic");
    expect(sheet.cues.length).toBeGreaterThan(0);
  });
});

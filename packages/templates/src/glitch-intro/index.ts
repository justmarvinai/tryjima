import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

// Fixed "signal" channel hues for the RGB split — a deliberate constant,
// independent of palette. Chromatic-aberration glitches conventionally read as
// red/green/blue regardless of brand color; palettes still supply the clean
// title color plus the scanline tint (`accent`). Also keeps every palette dark
// by design, since the channels are additively blended (they sum toward white
// only against a near-black backdrop).
const CHANNEL_R = "#FF2E4D";
const CHANNEL_G = "#2BFF88";
const CHANNEL_B = "#2E8CFF";

const PALETTES: Palette[] = [
  { id: "terminal-dark", name: "Terminal dark", colors: { background: "#0A0B0F", textColor: "#F4F6FA", accent: "#39F5C4" } },
  { id: "crt-magenta", name: "CRT magenta", colors: { background: "#0C0810", textColor: "#FDF2FF", accent: "#FF3E9E" } },
  { id: "arcade-amber", name: "Arcade amber", colors: { background: "#100D06", textColor: "#FFF4DE", accent: "#FFB020" } },
  { id: "hacker-green", name: "Hacker green", colors: { background: "#060A07", textColor: "#E9FFEF", accent: "#39FF6A" } },
];

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.095 : aspect === "9:16" ? 0.125 : 0.115;
}

const GLITCH_DUR = 0.9;
const CLEAN_AT = GLITCH_DUR;
const DUR = 3.6;
const GLITCH_RATE = 16; // discrete jitter steps/sec — Math.floor(t * RATE) keeps it pure in t
const SCAN_RATE = 10;

interface JitterStep {
  rx: number;
  ry: number;
  gx: number;
  gy: number;
  bx: number;
  by: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#0A0B0F"));
  const textColor = str(values.textColor, pcol("textColor", "#F4F6FA"));
  const accent = str(values.accent, pcol("accent", "#39F5C4"));
  const title = str(values.title, "SYSTEM ONLINE");
  const showScanlines = on(values.showScanlines);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const cy = h * 0.5;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const fontSize0 = Math.round(w * fontFrac(ctx.aspect));
  const maxWidth = w * (ctx.aspect === "16:9" ? 0.66 : 0.84);
  const fontSize = fitSize(fonts, title, "display", 700, fontSize0, maxWidth);
  const baseX = cx;
  const baseY = cy;

  // --- Scanline slices: thin bands over the title band, each flickering on a
  // fixed, precomputed phase (deterministic; no rng calls inside update). ---
  const bandH = fontSize * 1.6;
  const bandTop = cy - bandH / 2;
  const slices: { g: Graphics; phase: number; mod: number; baseAlpha: number }[] = [];
  if (showScanlines) {
    const sliceHolder = new Container();
    sliceHolder.label = "scanlines";
    root.addChild(sliceHolder);
    const COUNT = 7;
    for (let i = 0; i < COUNT; i++) {
      const sh = rng.range(bandH * 0.03, bandH * 0.09);
      const sy = bandTop + rng.range(0, Math.max(0, bandH - sh));
      const sx = rng.range(-w * 0.02, w * 0.02);
      const g = new Graphics().rect(-w / 2, 0, w * 2, sh).fill(accent);
      g.position.set(cx + sx, sy);
      g.alpha = 0;
      sliceHolder.addChild(g);
      slices.push({ g, phase: rng.range(0, 5), mod: rng.int(2, 3), baseAlpha: rng.range(0.16, 0.3) });
    }
  }

  // --- RGB-split channel copies, additively blended so aligned pixels read
  // bright against the dark backdrop. ---
  const makeChannel = (color: string): Text => {
    const t = makeText(fonts, { text: title, role: "display", weight: 700, size: fontSize, color, anchor: 0.5, align: "center" });
    t.position.set(baseX, baseY);
    t.blendMode = "add";
    t.alpha = 0;
    return t;
  };
  const redText = makeChannel(CHANNEL_R);
  const greenText = makeChannel(CHANNEL_G);
  const blueText = makeChannel(CHANNEL_B);
  root.addChild(redText);
  root.addChild(greenText);
  root.addChild(blueText);

  timeline
    .to(redText, { prop: "alpha", from: 0, to: 0.85, start: 0, duration: 0.08, ease: outQuad })
    .to(greenText, { prop: "alpha", from: 0, to: 0.85, start: 0, duration: 0.08, ease: outQuad })
    .to(blueText, { prop: "alpha", from: 0, to: 0.85, start: 0, duration: 0.08, ease: outQuad })
    .to(redText, { prop: "alpha", from: 0.85, to: 0, start: CLEAN_AT, duration: 0.05, ease: outQuad })
    .to(greenText, { prop: "alpha", from: 0.85, to: 0, start: CLEAN_AT, duration: 0.05, ease: outQuad })
    .to(blueText, { prop: "alpha", from: 0.85, to: 0, start: CLEAN_AT, duration: 0.05, ease: outQuad });

  // --- Clean title, snaps in once the signal locks. ---
  const cleanText = makeText(fonts, { text: title, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5, align: "center" });
  cleanText.position.set(baseX, baseY);
  cleanText.alpha = 0;
  root.addChild(cleanText);
  timeline.to(cleanText, { prop: "alpha", from: 0, to: 1, start: CLEAN_AT, duration: 0.06, ease: outQuad });

  // --- Deterministic jitter table: fresh forks drawn once at build time,
  // indexed by quantized t at render time (no rng calls inside update). ---
  const stepCount = Math.ceil(GLITCH_DUR * GLITCH_RATE) + 2;
  const jitterSteps: JitterStep[] = [];
  for (let s = 0; s < stepCount; s++) {
    const rr = rng.fork(s * 4 + 11);
    const gg = rng.fork(s * 4 + 12);
    const bb = rng.fork(s * 4 + 13);
    jitterSteps.push({
      rx: rr.range(-1, 1),
      ry: rr.range(-1, 1),
      gx: gg.range(-1, 1),
      gy: gg.range(-1, 1),
      bx: bb.range(-1, 1),
      by: bb.range(-1, 1),
    });
  }

  const MAX_OFFSET = fontSize * 0.028;
  const update = (t: number): void => {
    if (t < CLEAN_AT) {
      const progress = clamp01(t / GLITCH_DUR);
      const amp = MAX_OFFSET * (1 - progress * 0.8);
      const stepIdx = Math.max(0, Math.min(jitterSteps.length - 1, Math.floor(t * GLITCH_RATE)));
      const j = jitterSteps[stepIdx];
      if (j) {
        redText.position.set(baseX + j.rx * amp, baseY + j.ry * amp * 0.35);
        greenText.position.set(baseX + j.gx * amp, baseY + j.gy * amp * 0.35);
        blueText.position.set(baseX + j.bx * amp, baseY + j.by * amp * 0.35);
      }
    } else {
      redText.position.set(baseX, baseY);
      greenText.position.set(baseX, baseY);
      blueText.position.set(baseX, baseY);
    }
    if (showScanlines) {
      const glitching = t < CLEAN_AT;
      for (const sl of slices) {
        const flick = Math.floor((t + sl.phase) * SCAN_RATE) % sl.mod === 0;
        sl.g.alpha = glitching && flick ? sl.baseAlpha : 0;
      }
    }
  };

  return { timeline, duration: DUR, update };
}

export const glitchIntro: TemplateDefinition = {
  id: "glitch-intro",
  name: "Glitch Intro",
  tagline: "A title assembles through RGB-split static, then snaps into focus.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "SYSTEM ONLINE", maxLength: 24, shrinkToFit: true },
    { key: "showScanlines", type: "toggle", label: "Scanline flicker", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

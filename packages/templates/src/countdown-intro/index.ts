import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  spring,
  makeOutBack,
  safeZone,
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
const num = (v: unknown, d: number): number => (typeof v === "number" ? v : d);

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#1E3A8A", accent: "#2E7DF6" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B6B3A", accent: "#17A34A" } },
];

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function numberFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.22 : aspect === "9:16" ? 0.3 : 0.27;
}

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.09 : aspect === "9:16" ? 0.115 : 0.105;
}

// Fixed pacing so the total length and the title's arrival stay constant no
// matter how many numbers are counted (3, 4 or 5) — no wall-clock involved,
// purely a function of the timeline.
const TITLE_START = 2.9;
const TITLE_SCALE_DUR = 0.5;
const TITLE_ALPHA_DUR = 0.3;
const TOTAL_DURATION = 4.5;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFFFFF"));
  const textColor = str(values.textColor, pcol("textColor", "#101014"));
  const accent = str(values.accent, pcol("accent", "#FF4D1C"));
  const title = str(values.title, "Let's go");
  const startFrom = Math.min(5, Math.max(3, Math.round(num(values.startFrom, 3))));

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const availW = w * 0.86;

  const zone = safeZone(ctx.aspect);
  const safeH = h - zone.top - zone.bottom;
  const centerY = zone.top + safeH * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Countdown numbers (one Text node, swapped with .set) ---
  const numberSize = Math.round(w * numberFrac(ctx.aspect));
  const numberText = makeText(fonts, {
    text: String(startFrom),
    role: "display",
    weight: 700,
    size: numberSize,
    color: accent,
    anchor: 0.5,
    align: "center",
  });
  numberText.position.set(cx, centerY);
  numberText.alpha = 0;
  numberText.scale.set(0.4);
  root.addChild(numberText);

  const segDur = TITLE_START / startFrom;
  const popDur = Math.min(0.28, segDur * 0.35);
  const fadeDur = Math.min(0.2, segDur * 0.3);
  for (let i = 0; i < startFrom; i++) {
    const value = startFrom - i;
    const segStart = i * segDur;
    const fadeStart = segStart + segDur - fadeDur;
    timeline.set(numberText, "text", String(value), segStart);
    timeline
      .to(numberText, { prop: "alpha", from: 0, to: 1, start: segStart, duration: Math.min(0.16, popDur), ease: outQuad })
      .to(numberText, { prop: "scale.x", from: 0.4, to: 1, start: segStart, duration: popDur, ease: makeOutBack(1.8) })
      .to(numberText, { prop: "scale.y", from: 0.4, to: 1, start: segStart, duration: popDur, ease: makeOutBack(1.8) })
      .to(numberText, { prop: "alpha", from: 1, to: 0, start: fadeStart, duration: fadeDur, ease: outQuad })
      .to(numberText, { prop: "scale.x", from: 1, to: 1.14, start: fadeStart, duration: fadeDur, ease: outQuad })
      .to(numberText, { prop: "scale.y", from: 1, to: 1.14, start: fadeStart, duration: fadeDur, ease: outQuad });
  }

  // --- Title (pops once the count finishes) ---
  const titleSizeRaw = Math.round(w * titleFrac(ctx.aspect));
  const titleSize = fitSize(fonts, title, "display", 700, titleSizeRaw, availW);
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
  });
  titleText.position.set(cx, centerY);
  titleText.alpha = 0;
  titleText.scale.set(0.5);
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: TITLE_START, duration: TITLE_ALPHA_DUR, ease: outQuad })
    .to(titleText, { prop: "scale.x", from: 0.5, to: 1, start: TITLE_START, duration: TITLE_SCALE_DUR, ease: spring(0.4) })
    .to(titleText, { prop: "scale.y", from: 0.5, to: 1, start: TITLE_START, duration: TITLE_SCALE_DUR, ease: spring(0.4) });

  return { timeline, duration: TOTAL_DURATION };
}

export const countdownIntro: TemplateDefinition = {
  id: "countdown-intro",
  name: "Countdown Intro",
  tagline: "A number countdown lands, then the title pops.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Let's go", maxLength: 24, shrinkToFit: true },
    { key: "startFrom", type: "slider", label: "Start from", default: 3, min: 3, max: 5, step: 1 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

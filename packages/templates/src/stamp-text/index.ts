import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  shrinkToFit,
  outQuad,
  outExpo,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night-ember", name: "Night ember", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "ink-lime", name: "Ink on lime", colors: { background: "#D8F34D", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "violet-cream", name: "Violet on cream", colors: { background: "#FAF5EA", textColor: "#3A1D6E", accent: "#7C5CFF" } },
];

function fontFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.15;
    case "9:16":
      return 0.185;
    case "4:5":
      return 0.19;
    case "1:1":
    default:
      return 0.2;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const word = str(values.word, "BOLD");
  const showRing = values.showRing !== false;

  // --- Full-frame background (first child, labeled so alpha export can blank it) ---
  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const cx = size.width / 2;
  const cy = size.height * (ctx.aspect === "16:9" ? 0.5 : 0.46);
  const minDim = Math.min(size.width, size.height);

  const family = fonts.family("display");
  const weight = 700;
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const baseSize = Math.round(size.width * fontFrac(ctx.aspect));
  const fontSize = shrinkToFit(word, measure, {
    maxWidth: size.width * 0.8,
    baseSize,
    minSize: Math.max(18, Math.round(baseSize * 0.3)),
  });

  const timeline = new JimaTimeline();

  const SCALE_FROM = 2.7;
  const START = 0.15;
  const SCALE_DUR = 0.4;
  const STAMP = START + SCALE_DUR;

  // --- The word: scales down hard from oversize (outExpo) and impacts at STAMP ---
  const wordText = makeText(fonts, { text: word, role: "display", weight, size: fontSize, color: textColor, anchor: 0.5 });
  wordText.position.set(cx, cy);
  wordText.alpha = 0;
  wordText.scale.set(SCALE_FROM);
  root.addChild(wordText);

  timeline
    .to(wordText, { prop: "alpha", from: 0, to: 1, start: START, duration: 0.14, ease: outQuad })
    .to(wordText, { prop: "scale.x", from: SCALE_FROM, to: 1, start: START, duration: SCALE_DUR, ease: outExpo })
    .to(wordText, { prop: "scale.y", from: SCALE_FROM, to: 1, start: START, duration: SCALE_DUR, ease: outExpo });

  // --- Quick decaying horizontal shake on impact ---
  const A = Math.max(5, fontSize * 0.05);
  timeline
    .to(wordText, { prop: "x", from: cx, to: cx + A, start: STAMP, duration: 0.055, ease: outQuad })
    .to(wordText, { prop: "x", from: cx + A, to: cx - A * 0.6, start: STAMP + 0.055, duration: 0.07, ease: outQuad })
    .to(wordText, { prop: "x", from: cx - A * 0.6, to: cx + A * 0.3, start: STAMP + 0.125, duration: 0.07, ease: outQuad })
    .to(wordText, { prop: "x", from: cx + A * 0.3, to: cx, start: STAMP + 0.195, duration: 0.09, ease: outQuad });

  // --- Impact ring + flash (toggleable) ---
  if (showRing) {
    const ringR = minDim * 0.24;
    const flash = new Graphics().circle(0, 0, ringR * 0.86).fill(accent);
    flash.position.set(cx, cy);
    flash.alpha = 0;
    root.addChild(flash);

    const ring = new Graphics().circle(0, 0, ringR).stroke({ color: accent, width: Math.max(3, minDim * 0.012) });
    ring.position.set(cx, cy);
    ring.scale.set(0.55);
    ring.alpha = 0;
    root.addChild(ring);

    // Hold alpha at 0 until impact via a tween (not `visible`, which is monotonic
    // and would break pixel-exact re-seek), then flash/ring fade out.
    timeline
      .to(flash, { prop: "alpha", from: 0, to: 0, start: 0, duration: STAMP, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0, to: 0, start: 0, duration: STAMP, ease: outQuad })
      .to(flash, { prop: "alpha", from: 0.55, to: 0, start: STAMP, duration: 0.3, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0.85, to: 0, start: STAMP, duration: 0.6, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.55, to: 1.85, start: STAMP, duration: 0.6, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.55, to: 1.85, start: STAMP, duration: 0.6, ease: outExpo });
  }

  return { timeline, duration: 3.6 };
}

export const stampText: TemplateDefinition = {
  id: "stamp-text",
  name: "Stamp Text",
  tagline: "A bold word slams down with a shake and an impact ring.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { word: "display" },
  palettes: PALETTES,
  fields: [
    { key: "word", type: "text", label: "Word", default: "BOLD", maxLength: 24, shrinkToFit: true },
    { key: "showRing", type: "toggle", label: "Impact ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

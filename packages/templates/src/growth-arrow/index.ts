import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(14, Math.floor((size * maxWidth) / w)) : size;
}

// Dark ink / cream text always sits on the plain background; `accent` is used
// only for the arrow, dots and ring — never as a text fill — so every palette
// clears the 4.5:1 end-frame bar regardless of hue saturation.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", numberColor: "#101014", accent: "#FF4D1C", labelColor: "#5B5B68" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", numberColor: "#0B1F4D", accent: "#2E7DF6", labelColor: "#4A5C8A" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", numberColor: "#FAF5EA", accent: "#D8F34D", labelColor: "#B8B4A8" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", numberColor: "#0B6B3A", accent: "#FF8A3D", labelColor: "#4A7A5E" } },
];

interface ArrowLayout {
  tailXF: number;
  tailYF: number;
  tipXF: number;
  tipYF: number;
  numXF: number;
  numYF: number;
}

const CFG: Record<Aspect, ArrowLayout> = {
  "1:1": { tailXF: 0.14, tailYF: 0.8, tipXF: 0.84, tipYF: 0.18, numXF: 0.68, numYF: 0.15 },
  "4:5": { tailXF: 0.14, tailYF: 0.82, tipXF: 0.84, tipYF: 0.15, numXF: 0.68, numYF: 0.13 },
  "9:16": { tailXF: 0.18, tailYF: 0.74, tipXF: 0.8, tipYF: 0.185, numXF: 0.66, numYF: 0.175 },
  "16:9": { tailXF: 0.08, tailYF: 0.82, tipXF: 0.8, tipYF: 0.16, numXF: 0.64, numYF: 0.155 },
};

const SHAFT_START = 0.3;
const SHAFT_DUR = 1.35;
const COUNT_START = SHAFT_START;
const COUNT_DUR = SHAFT_DUR;
const COUNT_END = COUNT_START + COUNT_DUR;
const HEAD_START = SHAFT_START + SHAFT_DUR * 0.92;
const HEAD_DUR = 0.32;
const DOT_FRACS = [0.28, 0.52, 0.76];
const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const numberColor = str(values.numberColor, pc("numberColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const labelColor = pc("labelColor", "#5B5B68");

  const percent = Math.max(1, Math.min(999, Math.round(num(values.percent, 248))));
  const prefix = str(values.prefix, "+");
  const suffix = str(values.suffix, "%");
  const label = str(values.label, "Year-over-year growth");
  const showDots = values.showDots !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const L = CFG[ctx.aspect];

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const tailX = w * L.tailXF;
  const tailY = h * L.tailYF;
  const tipX = w * L.tipXF;
  const tipY = h * L.tipYF;
  const dx = tipX - tailX;
  const dy = tipY - tailY;
  const shaftLen = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  const shaftThick = Math.max(10, minDim * 0.026);
  const headLen = shaftThick * 2.7;
  const headWidth = shaftThick * 2.3;
  const shaftLineLen = Math.max(shaftThick, shaftLen - headLen * 0.62);

  // --- Shaft: a rotated container so scaling local x draws the line along the
  // tail→tip direction regardless of angle (rotation + scale share one local
  // transform, so this stays a pure, cheap tween — no per-frame redraw needed).
  const shaftC = new Container();
  shaftC.position.set(tailX, tailY);
  shaftC.rotation = angle;
  shaftC.scale.set(0, 1);
  shaftC.addChild(new Graphics().roundRect(0, -shaftThick / 2, shaftLineLen, shaftThick, shaftThick / 2).fill(accent));
  root.addChild(shaftC);
  timeline.to(shaftC, { prop: "scale.x", from: 0, to: 1, start: SHAFT_START, duration: SHAFT_DUR, ease: outExpo });

  // --- Milestone dots along the shaft — pop as the line "reaches" them ---
  if (showDots) {
    const dotR = Math.max(5, minDim * 0.015);
    for (const frac of DOT_FRACS) {
      const dx2 = tailX + dx * frac;
      const dy2 = tailY + dy * frac;
      const dot = new Container();
      dot.position.set(dx2, dy2);
      dot.addChild(new Graphics().circle(0, 0, dotR * 1.7).fill(bg)); // halo cuts the shaft
      dot.addChild(new Graphics().circle(0, 0, dotR).fill(accent));
      dot.scale.set(0);
      root.addChild(dot);
      const start = SHAFT_START + SHAFT_DUR * frac;
      timeline
        .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.4, ease: spring(0.45) })
        .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.4, ease: spring(0.45) });
    }
  }

  // --- Arrowhead: fixed at the tip (not scaled with the shaft, so its shape
  // never distorts), pops in once the line arrives. ---
  const head = new Graphics().poly([-headLen, -headWidth / 2, 0, 0, -headLen, headWidth / 2]).fill(accent);
  head.position.set(tipX, tipY);
  head.rotation = angle;
  head.scale.set(0);
  root.addChild(head);
  timeline
    .to(head, { prop: "scale.x", from: 0, to: 1, start: HEAD_START, duration: HEAD_DUR, ease: makeOutBack(2) })
    .to(head, { prop: "scale.y", from: 0, to: 1, start: HEAD_START, duration: HEAD_DUR, ease: makeOutBack(2) });

  // --- Big percentage, counts up at the tip ---
  const numX = w * L.numXF;
  const numY = h * L.numYF;
  const finalStr = `${prefix}${groupThousands(percent)}${suffix}`;
  const baseNumSize = Math.round(minDim * 0.15);
  const numSize = fitSize(fonts, finalStr, "display", 700, baseNumSize, w * 0.56);
  const numberText = makeText(fonts, {
    text: `${prefix}0${suffix}`,
    role: "display",
    weight: 700,
    size: numSize,
    color: numberColor,
    anchor: 0.5,
    align: "center",
  });
  numberText.position.set(numX, numY);
  numberText.alpha = 0;
  root.addChild(numberText);
  timeline
    .to(numberText, { prop: "alpha", from: 0, to: 1, start: SHAFT_START, duration: 0.35, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 0.88, to: 1, start: SHAFT_START, duration: 0.5, ease: outQuint })
    .to(numberText, { prop: "scale.y", from: 0.88, to: 1, start: SHAFT_START, duration: 0.5, ease: outQuint });
  // Landing beat once the count lands.
  timeline
    .to(numberText, { prop: "scale.x", from: 1, to: 1.1, start: COUNT_END, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 1.1, to: 1, start: COUNT_END + 0.12, duration: 0.2, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1, to: 1.1, start: COUNT_END, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1.1, to: 1, start: COUNT_END + 0.12, duration: 0.2, ease: outQuad });

  // --- Label beneath the number ---
  const labelSize = fitSize(fonts, label, "body", 600, Math.round(numSize * 0.24), w * 0.5);
  const labelY = numY + numSize * 0.62;
  const labelText = makeText(fonts, { text: label, role: "body", weight: 600, size: labelSize, color: labelColor, anchor: 0.5, align: "center" });
  labelText.position.set(numX, labelY);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: COUNT_END + 0.15, duration: 0.4, ease: outQuad })
    .to(labelText, { prop: "y", from: labelY + 10, to: labelY, start: COUNT_END + 0.15, duration: 0.45, ease: outQuint });

  const update = (t: number): void => {
    const p = outExpo(clamp01((t - COUNT_START) / COUNT_DUR));
    numberText.text = `${prefix}${groupThousands(percent * p)}${suffix}`;
  };

  return { timeline, duration: DURATION, update };
}

export const growthArrow: TemplateDefinition = {
  id: "growth-arrow",
  name: "Growth Arrow",
  tagline: "A bold arrow climbs across the frame as the percent counts up.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { number: "display", label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "percent", type: "slider", label: "Growth %", default: 248, min: 1, max: 999, step: 1 },
    { key: "prefix", type: "text", label: "Prefix", default: "+", maxLength: 3, optional: true },
    { key: "suffix", type: "text", label: "Suffix", default: "%", maxLength: 3, optional: true },
    { key: "label", type: "text", label: "Label", default: "Year-over-year growth", maxLength: 48, shrinkToFit: true },
    { key: "showDots", type: "toggle", label: "Milestone dots", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "numberColor", type: "color", label: "Number", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

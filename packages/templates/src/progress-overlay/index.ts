import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, d: number): number => (typeof v === "number" ? v : d);

// A slim, persistent progress/chapter-bar overlay for the bottom of the frame
// — a "watch progress" or "step X of Y" HUD. Only the full-frame `bg` rect is
// tied to the background field (defaults to the transparent sentinel so it
// composites straight onto footage); the card uses its own palette-only
// `cardBg` so the readout stays legible once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "carbon", name: "Carbon", colors: { cardBg: "#17171C", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "paper", name: "Paper", colors: { cardBg: "#FFFFFF", textColor: "#101014", accent: "#2E7DF6" } },
  { id: "mint", name: "Mint", colors: { cardBg: "#FFFFFF", textColor: "#0B1F16", accent: "#17A34A" } },
  { id: "grape", name: "Grape", colors: { cardBg: "#1B1030", textColor: "#FFFFFF", accent: "#B08BFF" } },
];

interface FillSpan {
  g: Graphics;
  start: number;
  duration: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const label = str(values.label, "Now playing");
  const style = str(values.style, "bar");
  const showLabel = values.showLabel !== false;

  const percent = Math.max(0, Math.min(100, Math.round(num(values.percent, 72))));
  const stepsCount = Math.max(2, Math.min(8, Math.round(num(values.steps, 5))));
  const currentStep = Math.max(1, Math.min(stepsCount, Math.round(num(values.currentStep, 3))));
  const readout = style === "steps" ? `Step ${currentStep} of ${stepsCount}` : `${percent}%`;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Card geometry ---
  const cardW = w - zone.left - zone.right;
  const padX = Math.round(minDim * 0.03);
  const padTop = Math.round(minDim * 0.024);
  const padBottom = Math.round(minDim * 0.022);
  const trackH = Math.round(minDim * 0.014);
  const labelSize = Math.round(minDim * 0.024);
  const rowGap = Math.round(minDim * 0.016);

  const labelRowH = showLabel ? labelSize : 0;
  const cardH = padTop + (showLabel ? labelRowH + rowGap : 0) + trackH + padBottom;
  const cardRadius = Math.round(cardH * 0.2);

  const marginBottom = Math.round(minDim * 0.035);
  const cardCenterX = w / 2;
  const cardRestY = h - zone.bottom - marginBottom - cardH / 2;

  const card = new Container();
  card.position.set(cardCenterX, cardRestY);
  card.scale.set(0.92);
  card.alpha = 0;
  root.addChild(card);

  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(cardBg));

  const trackW = cardW - padX * 2;
  const trackX0 = -trackW / 2;
  const trackY = cardH / 2 - padBottom - trackH / 2;
  const labelY = showLabel ? -cardH / 2 + padTop + labelRowH / 2 : 0;

  if (showLabel) {
    const labelText = makeText(fonts, {
      text: label,
      role: "body",
      weight: 600,
      size: labelSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    labelText.alpha = 0.85;
    labelText.position.set(trackX0, labelY);
    card.addChild(labelText);

    const readoutText = makeText(fonts, {
      text: readout,
      role: "display",
      weight: 700,
      size: labelSize,
      color: textColor,
      anchor: { x: 1, y: 0.5 },
    });
    readoutText.position.set(trackX0 + trackW, labelY);
    card.addChild(readoutText);
  }

  const fillSpans: FillSpan[] = [];
  const fillStart = 0.55;

  if (style === "steps") {
    const gap = Math.max(2, Math.round(trackW * 0.014));
    const segW = (trackW - gap * (stepsCount - 1)) / stepsCount;
    for (let i = 0; i < stepsCount; i++) {
      const segX = trackX0 + i * (segW + gap);
      card.addChild(
        new Graphics().roundRect(segX, trackY - trackH / 2, segW, trackH, trackH / 2).fill({ color: textColor, alpha: 0.16 }),
      );
      if (i < currentStep) {
        const fillG = new Graphics().roundRect(0, -trackH / 2, segW, trackH, trackH / 2).fill(accent);
        fillG.position.set(segX, trackY);
        fillG.scale.set(0, 1);
        card.addChild(fillG);
        fillSpans.push({ g: fillG, start: fillStart + i * 0.14, duration: 0.28 });
      }
    }
  } else {
    card.addChild(new Graphics().roundRect(trackX0, trackY - trackH / 2, trackW, trackH, trackH / 2).fill({ color: textColor, alpha: 0.16 }));
    const fillG = new Graphics().roundRect(0, -trackH / 2, trackW, trackH, trackH / 2).fill(accent);
    fillG.position.set(trackX0, trackY);
    fillG.scale.set(0, 1);
    card.addChild(fillG);
    fillSpans.push({ g: fillG, start: fillStart, duration: 1.0 });
  }

  for (const span of fillSpans) {
    timeline.to(span.g, { prop: "scale.x", from: 0, to: 1, start: span.start, duration: span.duration, ease: outQuint });
  }

  // --- Card entrance: a soft spring pop, then the fill(s) catch up. ---
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.3, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.92, to: 1, start: 0.05, duration: 0.5, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.92, to: 1, start: 0.05, duration: 0.5, ease: spring(0.5) });

  return { timeline, duration: 4.2 };
}

export const progressOverlay: TemplateDefinition = {
  id: "progress-overlay",
  name: "Progress Overlay",
  tagline: "A persistent watch-progress or step counter HUD for the bottom edge.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Now playing", maxLength: 32, optional: true, shrinkToFit: true },
    {
      key: "style",
      type: "select",
      label: "Style",
      default: "bar",
      options: [
        { value: "bar", label: "Continuous bar" },
        { value: "steps", label: "Chapter steps" },
      ],
    },
    { key: "percent", type: "slider", label: "Percent (bar style)", default: 72, min: 0, max: 100, step: 1 },
    { key: "steps", type: "slider", label: "Total steps (chapter style)", default: 5, min: 2, max: 8, step: 1 },
    { key: "currentStep", type: "slider", label: "Current step", default: 3, min: 1, max: 8, step: 1 },
    { key: "showLabel", type: "toggle", label: "Label + readout", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

// Every palette keeps the card's "empty" zone (cardColor) and "filled" zone
// (accent) in the same light/dark tier as each other so a single textColor
// reads at >=4.5:1 against both, however high the fill rises (verified).
const PALETTES: Palette[] = [
  { id: "citrus", name: "Citrus", colors: { background: "#FFFFFF", textColor: "#2A2007", accent: "#FFC94D", cardColor: "#F5EEDD" } },
  { id: "meadow", name: "Meadow", colors: { background: "#FFFFFF", textColor: "#193A0B", accent: "#AEE36B", cardColor: "#EFF4E7" } },
  { id: "blossom", name: "Blossom", colors: { background: "#FFFFFF", textColor: "#4A0F32", accent: "#FFAAD4", cardColor: "#F8ECF3" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#3455E6", cardColor: "#1E1E27" } },
];

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#2A2007"));
  const accent = str(values.accent, pc("accent", "#FFC94D"));
  const cardColor = pc("cardColor", "#F5EEDD");
  const percent = Math.max(1, Math.min(100, Math.round(num(values.percent, 88))));
  const label = str(values.label, "Recycled");

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const cy = h * 0.42;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const panelW = minDim * 0.7;
  const panelH = minDim * 0.5;
  const cardR = panelW * 0.07;

  // --- Card: flat "empty" backing + a bottom-anchored fill masked to the
  // rounded panel shape (Graphics-shape masking — same proven pattern as the
  // circular avatar crop in review-stars). The container sits at the visual
  // center (cx,cy) so every child below uses local, center-relative coords —
  // that keeps the pop-in scale tween anchored on the card's own middle. ---
  const card = new Container();
  card.position.set(cx, cy);
  root.addChild(card);

  const cardBg = new Graphics().roundRect(-panelW / 2, -panelH / 2, panelW, panelH, cardR).fill(cardColor);
  card.addChild(cardBg);

  const fillMask = new Graphics().roundRect(-panelW / 2, -panelH / 2, panelW, panelH, cardR).fill("#FFFFFF");
  const fillLayer = new Graphics().rect(0, -panelH, panelW, panelH).fill(accent);
  fillLayer.position.set(-panelW / 2, panelH / 2);
  fillLayer.scale.set(1, 0);
  card.addChild(fillMask, fillLayer);
  fillLayer.mask = fillMask;

  const border = new Graphics()
    .roundRect(-panelW / 2, -panelH / 2, panelW, panelH, cardR)
    .stroke({ color: textColor, width: Math.max(2, minDim * 0.005), alpha: 0.16 });
  card.addChild(border);

  // Card pop-in.
  card.scale.set(0.9);
  card.alpha = 0;
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.35, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.9, to: 1, start: 0, duration: 0.6, ease: makeOutBack(1.4) })
    .to(card, { prop: "scale.y", from: 0.9, to: 1, start: 0, duration: 0.6, ease: makeOutBack(1.4) });

  const COUNT_START = 0.4;
  const COUNT_DUR = 1.8;

  // --- Big percent number, centered on the card ---
  const finalText = `${percent}%`;
  const baseNumSize = Math.round(Math.min(panelW, panelH) * 0.58);
  const numSize = fitSize(fonts, finalText, "display", 700, baseNumSize, panelW * 0.82);
  const numberText = makeText(fonts, { text: "0%", role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5, align: "center" });
  numberText.alpha = 0;
  card.addChild(numberText);
  timeline.to(numberText, { prop: "alpha", from: 0, to: 1, start: 0.25, duration: 0.4, ease: outQuad });

  // --- Label caption, below the card on the plain background ---
  const labelSize = fitSize(fonts, label, "body", 600, Math.round(minDim * 0.05), w * 0.8);
  const labelY = cy + panelH / 2 + minDim * 0.09;
  const labelText = makeText(fonts, { text: label, role: "body", weight: 600, size: labelSize, color: textColor, anchor: 0.5, align: "center" });
  labelText.position.set(cx, labelY);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: 1.0, duration: 0.45, ease: outQuad })
    .to(labelText, { prop: "y", from: labelY + 12, to: labelY, start: 1.0, duration: 0.5, ease: outQuint });

  const update = (t: number): void => {
    const p = clamp01((t - COUNT_START) / COUNT_DUR);
    const eased = outExpo(p);
    const now = percent * eased;
    numberText.text = `${Math.round(now)}%`;
    fillLayer.scale.y = now / 100;
  };

  return { timeline, duration: 4.0, update };
}

export const percentFill: TemplateDefinition = {
  id: "percent-fill",
  name: "Percent Fill",
  tagline: "A colored fill rises behind a big counting percentage.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "percent", type: "slider", label: "Percent", default: 88, min: 1, max: 100, step: 1 },
    { key: "label", type: "text", label: "Label", default: "Recycled", maxLength: 24, shrinkToFit: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

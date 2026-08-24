import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  spring,
  makeOutBack,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const pad2 = (v: number): string => (v < 10 ? "0" + String(v) : String(v));

// Card face = the vivid accent; digits/labels = onAccent — pairs picked so
// onAccent clears 4.5:1 against accent (verified: white/#4A32D8 7.7:1,
// dark/#FFD23F 13:1, white/#C81659 5.7:1, white/#0F7A55 5.3:1).
const PALETTES: Palette[] = [
  { id: "grape-night", name: "Grape night", colors: { background: "#14101F", accent: "#4A32D8", onAccent: "#FFFFFF" } },
  { id: "sun-drop", name: "Sun drop", colors: { background: "#FFF7E8", accent: "#FFD23F", onAccent: "#151016" } },
  { id: "berry-blast", name: "Berry blast", colors: { background: "#FFF0F6", accent: "#C81659", onAccent: "#FFFFFF" } },
  { id: "teal-fresh", name: "Teal fresh", colors: { background: "#EAFBF3", accent: "#0F7A55", onAccent: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#14101F"));
  const accent = str(values.accent, pc("accent", "#4A32D8"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const title = str(values.title, "DROP IN");
  const startDays = Math.max(0, Math.min(30, Math.round(num(values.startDays, 2))));
  const startHours = Math.max(0, Math.min(23, Math.round(num(values.startHours, 6))));
  const startMinutes = Math.max(0, Math.min(59, Math.round(num(values.startMinutes, 0))));
  const showShimmer = values.showShimmer !== false;

  const startTotal = startDays * 86400 + startHours * 3600 + startMinutes * 60;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const familyDisplay = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });

  // --- Card sizing (width first, then font sizes fit it) ---
  const cardW = Math.min(safe.width * 0.88, minDim * 0.82);
  const cardPadX = Math.round(cardW * 0.08);
  const cardPadY = Math.round(cardW * 0.09);
  const availW = cardW - cardPadX * 2;

  const titleBase = Math.round(minDim * 0.058);
  const titleSize = shrinkToFit(title, measure, { maxWidth: availW, baseSize: titleBase, minSize: Math.round(titleBase * 0.55) });

  const digitSample = "88:88:88:88";
  const digitBase = Math.round(minDim * 0.128);
  const digitSize = shrinkToFit(digitSample, measure, { maxWidth: availW, baseSize: digitBase, minSize: Math.round(digitBase * 0.45) });

  const legendBase = Math.round(digitSize * 0.185);
  const legendText = "DAYS  ·  HRS  ·  MIN  ·  SEC";
  const legendSize = shrinkToFit(legendText, measure, { maxWidth: availW, baseSize: legendBase, minSize: Math.round(legendBase * 0.6) });

  // --- Vertical rhythm inside the card ---
  const titleH = titleSize * 1.15;
  const digitH = digitSize * 1.05;
  const legendH = legendSize * 1.3;
  const gapTitleDigits = Math.round(titleSize * 0.5);
  const gapDigitsLegend = Math.round(digitSize * 0.12);
  const innerH = titleH + gapTitleDigits + digitH + gapDigitsLegend + legendH;
  const cardH = innerH + cardPadY * 2;
  const cardR = cardH * 0.13;

  const cardCy = safe.y + safe.height / 2;

  // --- Card container: pops in ---
  const card = new Container();
  card.label = "card";
  card.position.set(cx, cardCy);
  card.alpha = 0;
  card.scale.set(0.78);
  root.addChild(card);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.3, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.78, to: 1, start: 0.05, duration: 0.62, ease: makeOutBack(1.5) })
    .to(card, { prop: "scale.y", from: 0.78, to: 1, start: 0.05, duration: 0.62, ease: makeOutBack(1.5) });

  const face = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(accent);
  face.label = "face";
  card.addChild(face);

  // Soft top highlight for a glassy sticker feel (purely cosmetic, cheap).
  const sheen = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH * 0.46, cardR).fill({ color: onAccent, alpha: 0.06 });
  card.addChild(sheen);

  let cursor = -innerH / 2;
  const titleCy = cursor + titleH / 2;
  cursor += titleH + gapTitleDigits;
  const digitsCy = cursor + digitH / 2;
  cursor += digitH + gapDigitsLegend;
  const legendCy = cursor + legendH / 2;

  // --- Title ---
  const titleNode = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: onAccent, anchor: 0.5, align: "center", letterSpacing: titleSize * 0.03 });
  titleNode.position.set(0, titleCy);
  titleNode.alpha = 0;
  card.addChild(titleNode);
  timeline
    .to(titleNode, { prop: "alpha", from: 0, to: 1, start: 0.32, duration: 0.35, ease: outQuad })
    .to(titleNode, { prop: "y", from: titleCy + 14, to: titleCy, start: 0.32, duration: 0.5, ease: spring(0.5) });

  // --- Digits (updated live from t) ---
  const digitsNode = makeText(fonts, { text: pad2(startDays) + ":" + pad2(startHours) + ":" + pad2(startMinutes) + ":00", role: "display", weight: 700, size: digitSize, color: onAccent, anchor: 0.5, align: "center" });
  digitsNode.position.set(0, digitsCy);
  digitsNode.alpha = 0;
  card.addChild(digitsNode);
  timeline
    .to(digitsNode, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.35, ease: outQuad })
    .to(digitsNode, { prop: "scale.x", from: 0.88, to: 1, start: 0.5, duration: 0.55, ease: makeOutBack(1.8) })
    .to(digitsNode, { prop: "scale.y", from: 0.88, to: 1, start: 0.5, duration: 0.55, ease: makeOutBack(1.8) });

  // --- Legend ---
  const legendNode = makeText(fonts, { text: legendText, role: "body", weight: 600, size: legendSize, color: onAccent, anchor: 0.5, align: "center", letterSpacing: 1 });
  legendNode.position.set(0, legendCy);
  legendNode.alpha = 0;
  card.addChild(legendNode);
  timeline.to(legendNode, { prop: "alpha", from: 0, to: 0.78, start: 0.72, duration: 0.4, ease: outQuad });

  // --- Shimmer: a soft diagonal band sweeps across the card twice ---
  if (showShimmer) {
    const shimmerLayer = new Container();
    shimmerLayer.label = "shimmer";
    card.addChild(shimmerLayer);

    const clipMask = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(0xffffff);
    shimmerLayer.addChild(clipMask);

    const sweep = new Container();
    const bandW = cardW * 0.24;
    const bandH = cardH * 2.4;
    const band = new Graphics().rect(-bandW / 2, -bandH / 2, bandW, bandH).fill({ color: onAccent, alpha: 0.24 });
    sweep.addChild(band);
    sweep.rotation = -20 * DEG;
    sweep.mask = clipMask;
    shimmerLayer.addChild(sweep);

    const travel = cardW * 1.4;
    const fromX = -travel / 2;
    const toX = travel / 2;
    sweep.position.set(fromX, 0);
    timeline
      .to(sweep, { prop: "x", from: fromX, to: toX, start: 1.35, duration: 0.85, ease: outQuad })
      .to(sweep, { prop: "x", from: fromX, to: toX, start: 3.0, duration: 0.85, ease: outQuad });
  }

  const update = (t: number): void => {
    const rem = Math.max(0, Math.floor(startTotal - t));
    const d = Math.floor(rem / 86400);
    const hh = Math.floor(rem / 3600) % 24;
    const mm = Math.floor(rem / 60) % 60;
    const ss = rem % 60;
    digitsNode.text = `${pad2(d)}:${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
  };

  return { timeline, duration: 4.2, update };
}

export const countdownSticker: TemplateDefinition = {
  id: "countdown-sticker",
  name: "Countdown Sticker",
  tagline: "An IG-style countdown sticker ticks down to your drop.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "DROP IN", maxLength: 24, shrinkToFit: true },
    { key: "startDays", type: "slider", label: "Days", default: 2, min: 0, max: 30, step: 1, help: "Starting day count for the demo countdown." },
    { key: "startHours", type: "slider", label: "Hours", default: 6, min: 0, max: 23, step: 1 },
    { key: "startMinutes", type: "slider", label: "Minutes", default: 0, min: 0, max: 59, step: 1 },
    { key: "showShimmer", type: "toggle", label: "Shimmer sweep", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Card color", default: "", optional: true },
  ],
  build,
};

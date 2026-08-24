import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
  spring,
  safeRect,
  shrinkToFit,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const DEG = Math.PI / 180;
const DEFAULT_STEPS = ["Follow us", "Like this post", "Tag a friend"];
const STEPS_START = 1.75;
const PER_STEP = 0.5;

const PALETTES: Palette[] = [
  { id: "confetti", name: "Confetti", colors: { background: "#FFF7E8", textColor: "#2A1B06", accent: "#FF4D1C" } },
  { id: "midnight-gold", name: "Midnight Gold", colors: { background: "#121016", textColor: "#FFFFFF", accent: "#F2B441" } },
  { id: "berry", name: "Berry", colors: { background: "#FFEEF6", textColor: "#3A0A28", accent: "#FF2E9E" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F7F0", textColor: "#08221A", accent: "#17A34A" } },
];

function stepsOf(values: Values): string[] {
  return asItems(values.steps, DEFAULT_STEPS).slice(0, 3);
}

function computeDuration(values: Values): number {
  const n = stepsOf(values).length;
  const lastStepStart = STEPS_START + Math.max(0, n - 1) * PER_STEP;
  return lastStepStart + 0.5 + 1.75;
}

/** A gift box with a bow, centered at roughly its own middle, bounding ~`size` wide. */
function makeGiftBox(size: number, boxColor: string, ribbonColor: string): Container {
  const c = new Container();
  const w = size;
  const bodyH = size * 0.62;
  const lidH = size * 0.2;
  const top = -bodyH / 2 - lidH * 0.5;
  c.addChild(new Graphics().roundRect(-w / 2, top + lidH, w, bodyH, size * 0.06).fill(boxColor));
  c.addChild(new Graphics().roundRect(-w / 2 - size * 0.03, top, w + size * 0.06, lidH, size * 0.05).fill(boxColor));
  const ribbonW = w * 0.15;
  c.addChild(new Graphics().rect(-ribbonW / 2, top, ribbonW, bodyH + lidH).fill(ribbonColor));
  const loopR = size * 0.15;
  const bowY = top - size * 0.03;
  c.addChild(new Graphics().ellipse(-loopR, bowY, loopR * 1.05, loopR * 0.7).fill(ribbonColor));
  c.addChild(new Graphics().ellipse(loopR, bowY, loopR * 1.05, loopR * 0.7).fill(ribbonColor));
  c.addChild(new Graphics().circle(0, bowY, loopR * 0.48).fill(ribbonColor));
  return c;
}

// Content is stacked vertically (gift → headline → prize → steps); the safe
// area's *height* varies a lot by aspect even though minDim (and so the base
// sizes below) does not, so scale the whole stack down for the shorter aspects
// to keep the gift box and steps list clear of the safe-zone edges.
function vScale(aspect: Aspect): number {
  switch (aspect) {
    case "9:16":
      return 1.0;
    case "4:5":
      return 0.9;
    case "1:1":
      return 0.72;
    case "16:9":
      return 0.68;
  }
}

const BAND = { gift: 0.13, head: 0.33, prize: 0.42, steps: 0.53 };

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF7E8"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#2A1B06"));
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const headline = str(values.headline, "GIVEAWAY");
  const prize = str(values.prize, "Win a $100 gift card");
  const steps = stepsOf(values);
  const showTicks = values.showTicks !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const w = size.width;
  const minDim = Math.min(w, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;
  const S = vScale(ctx.aspect);

  // --- Gift box (drops in with a bounce) ---
  const giftSize = minDim * 0.24 * S;
  const giftCy = safe.y + safe.height * BAND.gift;
  const giftFromY = giftCy - minDim * 0.32 * S;
  const gift = makeGiftBox(giftSize, accent, onAccent);
  gift.position.set(cx, giftFromY);
  gift.alpha = 0;
  gift.rotation = -6 * DEG;
  root.addChild(gift);
  timeline
    .to(gift, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.25, ease: outQuad })
    .to(gift, { prop: "y", from: giftFromY, to: giftCy, start: 0.1, duration: 0.75, ease: spring(0.45) })
    .to(gift, { prop: "rotation", from: -6 * DEG, to: 0, start: 0.1, duration: 0.7, ease: outExpo });

  // --- Headline ---
  const headBase = Math.round(minDim * 0.086 * S);
  const familyDisplay = fonts.family("display");
  const measureHead = (s: string, sz: number): number =>
    fonts.measure(s, { family: familyDisplay, weight: 700, size: sz, letterSpacing: sz * 0.02 });
  const headMaxW = safe.width * 0.86;
  const headSize = shrinkToFit(headline, measureHead, { maxWidth: headMaxW, baseSize: headBase, minSize: Math.round(headBase * 0.55) });
  const headY = safe.y + safe.height * BAND.head;
  const headText = makeText(fonts, {
    text: headline,
    role: "display",
    weight: 700,
    size: headSize,
    color: accent,
    anchor: 0.5,
    align: "center",
    letterSpacing: headSize * 0.02,
  });
  headText.position.set(cx, headY);
  headText.alpha = 0;
  headText.scale.set(0.7);
  root.addChild(headText);
  timeline
    .to(headText, { prop: "alpha", from: 0, to: 1, start: 0.75, duration: 0.3, ease: outQuad })
    .to(headText, { prop: "scale.x", from: 0.7, to: 1, start: 0.75, duration: 0.5, ease: makeOutBack(1.8) })
    .to(headText, { prop: "scale.y", from: 0.7, to: 1, start: 0.75, duration: 0.5, ease: makeOutBack(1.8) });

  // --- Prize line ---
  const prizeBase = Math.round(minDim * 0.044 * S);
  const familyBody = fonts.family("body");
  const measurePrize = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 600, size: sz });
  const prizeMaxW = safe.width * 0.86;
  const prizeSize = shrinkToFit(prize, measurePrize, { maxWidth: prizeMaxW, baseSize: prizeBase, minSize: Math.round(prizeBase * 0.6) });
  const prizeY = safe.y + safe.height * BAND.prize;
  const prizeText = makeText(fonts, { text: prize, role: "body", weight: 600, size: prizeSize, color: textColor, anchor: 0.5, align: "center" });
  prizeText.position.set(cx, prizeY + 16);
  prizeText.alpha = 0;
  root.addChild(prizeText);
  timeline
    .to(prizeText, { prop: "alpha", from: 0, to: 1, start: 1.25, duration: 0.45, ease: outQuad })
    .to(prizeText, { prop: "y", from: prizeY + 16, to: prizeY, start: 1.25, duration: 0.5, ease: outQuint });

  // --- Steps (reveal line-by-line, each with an accent tick) ---
  const rowH = minDim * 0.115 * S;
  const stepFontSize = Math.round(minDim * 0.036 * S);
  const chipR = minDim * 0.028 * S;
  const indent = chipR * 2.6;
  const stepsTopY = safe.y + safe.height * BAND.steps;
  const rowMaxW = Math.min(safe.width * 0.82, minDim * 0.86);
  const rowLeftX = cx - rowMaxW / 2;

  steps.forEach((stepText, i) => {
    const rowCy = stepsTopY + i * rowH + rowH / 2;
    const start = STEPS_START + i * PER_STEP;

    const row = new Container();
    row.alpha = 0;
    row.position.set(rowLeftX + 26, rowCy);
    root.addChild(row);

    if (showTicks) {
      const chip = new Container();
      chip.position.set(chipR, 0);
      chip.addChild(new Graphics().circle(0, 0, chipR).fill(accent));
      chip.addChild(
        new Graphics()
          .poly([-chipR * 0.42, 0, -chipR * 0.1, chipR * 0.36, chipR * 0.48, -chipR * 0.36], false)
          .stroke({ color: onAccent, width: Math.max(2, chipR * 0.2), cap: "round", join: "round" }),
      );
      chip.scale.set(0);
      row.addChild(chip);
      timeline
        .to(chip, { prop: "scale.x", from: 0, to: 1, start: start + 0.12, duration: 0.4, ease: makeOutBack(2) })
        .to(chip, { prop: "scale.y", from: 0, to: 1, start: start + 0.12, duration: 0.4, ease: makeOutBack(2) });
    }

    const label = makeText(fonts, { text: stepText, role: "body", weight: 500, size: stepFontSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    label.position.set(indent, 0);
    row.addChild(label);

    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(row, { prop: "x", from: rowLeftX + 26, to: rowLeftX, start, duration: 0.5, ease: outQuint });
  });

  return { timeline, duration: computeDuration(values) };
}

export const giveaway: TemplateDefinition = {
  id: "giveaway",
  name: "Giveaway",
  tagline: "A gift box drops in to announce a giveaway, with entry steps ticking off.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "GIVEAWAY", maxLength: 20, shrinkToFit: true },
    { key: "prize", type: "text", label: "Prize", default: "Win a $100 gift card", maxLength: 48, shrinkToFit: true },
    { key: "steps", type: "textlist", label: "How to enter", default: DEFAULT_STEPS, minItems: 1, maxItems: 3, maxLength: 40 },
    { key: "showTicks", type: "toggle", label: "Step ticks", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
  ],
  build,
};

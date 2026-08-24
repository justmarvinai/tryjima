import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  outExpo,
  safeZone,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const on = (v: unknown): boolean => v !== false;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const PALETTES: Palette[] = [
  { id: "paper-ink", name: "Paper + ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", empty: "#DEDEE3", roleColor: "#5B5B68" } },
  { id: "ink-night", name: "Ink night", colors: { background: "#131019", textColor: "#FFFFFF", accent: "#FFC94D", empty: "#3A3745", roleColor: "#B4AFC4" } },
  { id: "sky-cobalt", name: "Sky + cobalt", colors: { background: "#EAF1FF", textColor: "#0E2340", accent: "#2F6FED", empty: "#C7D4EC", roleColor: "#45577A" } },
  { id: "sunrise", name: "Sunrise", colors: { background: "#FFF7EA", textColor: "#2A2016", accent: "#F5A623", empty: "#E9DCC4", roleColor: "#7A6144" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const emptyColor = pc("empty", "#DEDEE3");
  const roleColor = pc("roleColor", "#5B5B68");

  const rating = Math.max(0, Math.min(5, num(values.rating, 4.8)));
  const label = str(values.label, "Customer rating");
  const reviewTarget = parseTargetNumber(str(values.reviewCount, "2,431"));
  const showCount = on(values.showCount);

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  const minDim = Math.min(W, H);
  const DUR = 4.2;

  // --- Background (full-frame, first child so transparent export can blank it) ---
  const bgRect = new Graphics().rect(-W / 2, -H / 2, W, H).fill(bg);
  bgRect.position.set(W / 2, H / 2);
  bgRect.label = "bg";
  bgRect.scale.set(1.02);
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  timeline
    .to(bgRect, { prop: "scale.x", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(bgRect, { prop: "scale.y", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad });

  // --- Layout: eyebrow label, star row, big number, review-count line — stacked
  // and centered within the platform-safe area. ---
  const zone = safeZone(ctx.aspect);
  const areaCY = (zone.top + (H - zone.bottom)) / 2;

  const hasLabel = label.length > 0;
  const labelSize = Math.round(minDim * 0.045);
  const starSize = Math.round(minDim * 0.1);
  const starsRowH = starSize * 1.3;
  const numSize = Math.round(minDim * 0.22);
  const numRowH = numSize * 1.05;
  const countSize = Math.round(minDim * 0.045);

  const gapLS = minDim * 0.045;
  const gapSN = minDim * 0.05;
  const gapNC = minDim * 0.04;

  const totalH =
    (hasLabel ? labelSize * 1.3 + gapLS : 0) +
    starsRowH +
    gapSN +
    numRowH +
    (showCount ? gapNC + countSize * 1.3 : 0);
  let cursorY = areaCY - totalH / 2;

  let labelY = 0;
  if (hasLabel) {
    labelY = cursorY + labelSize * 0.65;
    cursorY += labelSize * 1.3 + gapLS;
  }
  const starsY = cursorY + starsRowH / 2;
  cursorY += starsRowH + gapSN;
  const numY = cursorY + numRowH / 2;
  cursorY += numRowH + (showCount ? gapNC : 0);
  const countY = cursorY + countSize * 0.65;

  // --- Optional eyebrow label ---
  if (hasLabel) {
    const labelUpper = label.toUpperCase();
    const labelSpacing = Math.max(1, Math.round(labelSize * 0.1));
    const labelMaxWidth = W * 0.86;
    let labelFitSize = labelSize;
    const labelFamily = fonts.family("body");
    const labelWidth0 = fonts.measure(labelUpper, { family: labelFamily, weight: 600, size: labelFitSize, letterSpacing: labelSpacing });
    if (labelWidth0 > labelMaxWidth) labelFitSize = Math.max(10, Math.floor(labelFitSize * (labelMaxWidth / labelWidth0)));
    const labelText = makeText(fonts, {
      text: labelUpper,
      role: "body",
      weight: 600,
      size: labelFitSize,
      color: roleColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: labelSpacing,
    });
    const labelYFrom = labelY + 10;
    labelText.position.set(cx, labelYFrom);
    labelText.alpha = 0;
    root.addChild(labelText);
    timeline
      .to(labelText, { prop: "alpha", from: 0, to: 0.85, start: 0.05, duration: 0.4, ease: outQuad })
      .to(labelText, { prop: "y", from: labelYFrom, to: labelY, start: 0.05, duration: 0.45, ease: outQuint });
  }

  // --- Stars: pop in left-to-right, each filling to its share of `rating` ---
  const gap = starSize * 1.35;
  const starX0 = cx - gap * 2;
  const STAR_START0 = 0.2;
  const STAR_STAGGER = 0.13;

  for (let i = 0; i < 5; i++) {
    const fillFrac = clamp01(rating - i);
    const holder = new Container();
    holder.position.set(starX0 + i * gap, starsY);
    holder.scale.set(0);
    root.addChild(holder);

    holder.addChild(makeIcon("star", starSize, { color: emptyColor }));

    if (fillFrac > 0) {
      const accentStar = makeIcon("star", starSize, { color: accent });
      const maskW = starSize * 1.1;
      const maskH = starSize * 1.3;
      const maskG = new Graphics().rect(0, 0, maskW, maskH).fill(0xffffff);
      maskG.position.set(-starSize * 0.55, -starSize * 0.65);
      maskG.scale.x = 0;
      holder.addChild(accentStar, maskG);
      accentStar.mask = maskG;

      const fillStart = STAR_START0 + i * STAR_STAGGER + 0.1;
      timeline.to(maskG, { prop: "scale.x", from: 0, to: fillFrac, start: fillStart, duration: 0.45, ease: outExpo });
    }

    const popStart = STAR_START0 + i * STAR_STAGGER;
    timeline
      .to(holder, { prop: "scale.x", from: 0, to: 1, start: popStart, duration: 0.42, ease: makeOutBack(1.8) })
      .to(holder, { prop: "scale.y", from: 0, to: 1, start: popStart, duration: 0.42, ease: makeOutBack(1.8) });
  }

  // --- Big rating number, counts up to `rating` (one decimal place) ---
  const numberText = makeText(fonts, { text: "0.0", role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5, align: "center" });
  numberText.position.set(cx, numY);
  numberText.alpha = 0;
  numberText.scale.set(0.85);
  root.addChild(numberText);
  const NUM_ENTER = 0.85;
  timeline
    .to(numberText, { prop: "alpha", from: 0, to: 1, start: NUM_ENTER, duration: 0.3, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 0.85, to: 1, start: NUM_ENTER, duration: 0.4, ease: outQuint })
    .to(numberText, { prop: "scale.y", from: 0.85, to: 1, start: NUM_ENTER, duration: 0.4, ease: outQuint });

  const NUM_START = 0.95;
  const NUM_DUR = 1.0;
  const NUM_END = NUM_START + NUM_DUR;
  timeline
    .to(numberText, { prop: "scale.x", from: 1, to: 1.1, start: NUM_END, duration: 0.13, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 1.1, to: 1, start: NUM_END + 0.13, duration: 0.22, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1, to: 1.1, start: NUM_END, duration: 0.13, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1.1, to: 1, start: NUM_END + 0.13, duration: 0.22, ease: outQuad });

  // --- Review-count line (optional) ---
  let countText: Text | null = null;
  const COUNT_START = NUM_START + 0.35;
  const COUNT_DUR = 1.0;
  if (showCount) {
    const finalCountLine = `based on ${groupThousands(reviewTarget)} reviews`;
    const countMaxWidth = W * 0.86;
    let countFitSize = countSize;
    const countFamily = fonts.family("body");
    const countWidth0 = fonts.measure(finalCountLine, { family: countFamily, weight: 500, size: countFitSize });
    if (countWidth0 > countMaxWidth) countFitSize = Math.max(10, Math.floor(countFitSize * (countMaxWidth / countWidth0)));
    countText = makeText(fonts, {
      text: `based on ${groupThousands(0)} reviews`,
      role: "body",
      weight: 500,
      size: countFitSize,
      color: roleColor,
      anchor: 0.5,
      align: "center",
    });
    const countYFrom = countY + 10;
    countText.position.set(cx, countYFrom);
    countText.alpha = 0;
    root.addChild(countText);
    timeline
      .to(countText, { prop: "alpha", from: 0, to: 0.9, start: COUNT_START - 0.1, duration: 0.4, ease: outQuad })
      .to(countText, { prop: "y", from: countYFrom, to: countY, start: COUNT_START - 0.1, duration: 0.45, ease: outQuint });
  }

  const update = (t: number): void => {
    const ratingP = outExpo(clamp01((t - NUM_START) / NUM_DUR));
    numberText.text = (rating * ratingP).toFixed(1);
    if (countText) {
      const countP = outExpo(clamp01((t - COUNT_START) / COUNT_DUR));
      countText.text = `based on ${groupThousands(Math.round(reviewTarget * countP))} reviews`;
    }
  };

  return { timeline, duration: DUR, update };
}

export const ratingReveal: TemplateDefinition = {
  id: "rating-reveal",
  name: "Rating Reveal",
  tagline: "Stars fill in and a rating counts up beside a review count.",
  category: "testimonial",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "rating", type: "slider", label: "Rating", default: 4.8, min: 0, max: 5, step: 0.1 },
    { key: "reviewCount", type: "text", label: "Review count", default: "2,431", maxLength: 12, help: "Digits — counts up to this." },
    { key: "label", type: "text", label: "Label", default: "Customer rating", maxLength: 30, optional: true },
    { key: "showCount", type: "toggle", label: "Review count line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

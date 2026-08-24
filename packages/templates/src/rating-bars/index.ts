import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  safeZone,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", empty: "#D8D8DE" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", empty: "#C7D3EC" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A", empty: "#CFE8D9" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", empty: "#DCD3F2" } },
];

const STAR_LEVELS = [5, 4, 3, 2, 1];

/**
 * A plausible, deterministic review-score breakdown for the 5 star levels
 * (index 0 = 5-star .. index 4 = 1-star): weight decays with distance from
 * `rating`, plus a small fixed long-tail bump at 1-star (real products, even
 * highly-rated ones, collect a few). Pure function of `rating` — no rng.
 */
function distribution(rating: number): number[] {
  const raw = STAR_LEVELS.map((s) => Math.pow(0.42, Math.abs(s - rating)));
  const tailed = raw.map((v, i) => (i === 4 ? v + 0.06 : v));
  const sum = tailed.reduce((a, b) => a + b, 0);
  return tailed.map((v) => v / sum);
}

function formatRating(v: number): string {
  return (Math.round(v * 10) / 10).toFixed(1);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const emptyColor = pc("empty", "#D8D8DE");
  const rating = Math.max(1, Math.min(5, num(values.rating, 4.6)));
  const showStars = values.showStars !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const insets = safeZone(ctx.aspect);
  const band = { top: insets.top, bottom: h - insets.bottom };
  const bandH = band.bottom - band.top;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  // --- Sizes (constant fractions of minDim, which is 1080 in every aspect) ---
  const numSize = minDim * 0.2;
  const gapAfterNum = minDim * 0.065;
  const starSize = minDim * 0.058;
  const starsBlockH = showStars ? minDim * 0.12 : 0;
  const gapAfterStars = minDim * (showStars ? 0.045 : 0.075);
  const rowH = minDim * 0.074;
  const breakdownH = rowH * 5;

  const contentH = numSize + gapAfterNum + starsBlockH + gapAfterStars + breakdownH;
  const contentTop = band.top + Math.max(0, (bandH - contentH) / 2);

  // --- Big average rating, counts up ---
  const numCenterY = contentTop + numSize * 0.52;
  const numberText = makeText(fonts, { text: "0.0", role: "display", weight: 700, size: Math.round(numSize), color: textColor, anchor: 0.5, align: "center" });
  numberText.position.set(cx, numCenterY);
  numberText.alpha = 0;
  numberText.scale.set(0.85);
  root.addChild(numberText);
  timeline
    .to(numberText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.35, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 0.85, to: 1, start: 0, duration: 0.55, ease: outExpo })
    .to(numberText, { prop: "scale.y", from: 0.85, to: 1, start: 0, duration: 0.55, ease: outExpo });

  const COUNT_START = 0.25;
  const COUNT_DUR = 1.2;

  // --- Star row ---
  if (showStars) {
    const filled = Math.max(0, Math.min(5, Math.round(rating)));
    const starGap = starSize * 1.32;
    const starsY = contentTop + numSize + gapAfterNum + starsBlockH / 2;
    const starX0 = cx - starGap * 2;
    const STAR_START = 0.55;
    const STAR_EACH = 0.09;
    STAR_LEVELS.forEach((_, i) => {
      const holder = new Container();
      holder.addChild(makeIcon("star", starSize, { color: i < filled ? accent : emptyColor }));
      holder.position.set(starX0 + i * starGap, starsY);
      holder.scale.set(0);
      root.addChild(holder);
      const start = STAR_START + i * STAR_EACH;
      timeline
        .to(holder, { prop: "scale.x", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(1.7) })
        .to(holder, { prop: "scale.y", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(1.7) });
    });
  }

  // --- Breakdown: 5 rows (5-star..1-star), bars grow to a plausible distribution ---
  const dist = distribution(rating);
  let maxIdx = 0;
  for (let i = 1; i < dist.length; i++) {
    if ((dist[i] ?? 0) > (dist[maxIdx] ?? 0)) maxIdx = i;
  }
  const maxWeight = Math.max(...dist);

  const marginX = w * 0.1;
  const chartW = w - marginX * 2;
  const rowLabelW = minDim * 0.11;
  const barX0 = marginX + rowLabelW;
  const barW = chartW - rowLabelW;
  const barH = Math.min(rowH * 0.36, minDim * 0.06);
  const rowIconSize = minDim * 0.036;
  const rowNumSize = minDim * 0.034;

  const breakdownTop = contentTop + numSize + gapAfterNum + starsBlockH + gapAfterStars;
  const BREAK_START = 1.0;
  const BREAK_EACH = 0.15;
  const GROW = 0.7;

  STAR_LEVELS.forEach((level, i) => {
    const rowCY = breakdownTop + rowH * (i + 0.5);
    const start = BREAK_START + i * BREAK_EACH;
    const isMax = i === maxIdx;

    const icon = makeIcon("star", rowIconSize, { color: textColor });
    icon.position.set(marginX + rowIconSize * 0.55, rowCY);
    icon.alpha = 0;
    root.addChild(icon);

    const numeral = makeText(fonts, { text: String(level), role: "display", weight: 700, size: rowNumSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    numeral.position.set(marginX + rowIconSize * 1.3, rowCY);
    numeral.alpha = 0;
    root.addChild(numeral);

    const track = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill({ color: textColor, alpha: 0.08 });
    track.position.set(barX0, rowCY - barH / 2);
    root.addChild(track);

    const frac = maxWeight > 0 ? (dist[i] ?? 0) / maxWeight : 0;
    const targetW = Math.max(barH, barW * frac);
    const bar = new Graphics().roundRect(0, 0, targetW, barH, barH / 2).fill(isMax ? accent : { color: textColor, alpha: 0.22 });
    bar.position.set(barX0, rowCY - barH / 2);
    bar.scale.set(0, 1);
    root.addChild(bar);

    timeline
      .to(bar, { prop: "scale.x", from: 0, to: 1, start, duration: GROW, ease: outExpo })
      .to(icon, { prop: "alpha", from: 0, to: 0.7, start: start - 0.1, duration: 0.35, ease: outQuad })
      .to(numeral, { prop: "alpha", from: 0, to: 1, start: start - 0.1, duration: 0.35, ease: outQuad });
  });

  const update = (t: number): void => {
    const p = outExpo(clamp01((t - COUNT_START) / COUNT_DUR));
    numberText.text = formatRating(rating * p);
  };

  return { timeline, duration: 4.4, update };
}

export const ratingBars: TemplateDefinition = {
  id: "rating-bars",
  name: "Rating Bars",
  tagline: "A star average counts up above its rating breakdown.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.2,
  palettes: PALETTES,
  fields: [
    { key: "rating", type: "slider", label: "Rating", default: 4.6, min: 1, max: 5, step: 0.1 },
    { key: "showStars", type: "toggle", label: "Star row", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

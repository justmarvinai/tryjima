import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  safeRect,
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

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(12, Math.floor((size * maxWidth) / w)) : size;
}

function relLum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length >= 6 ? h.slice(0, 6) : h.padEnd(6, h.slice(-1) || "0");
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const contrastRatio = (a: string, b: string): number => {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const readableOn = (bg: string): string =>
  contrastRatio("#FFFFFF", bg) >= contrastRatio("#111318", bg) * 0.9 ? "#FFFFFF" : "#111318";

// cardBg is the palette-only chip surface. Label/rate render in textColor on
// background; chip amounts use auto ink on cardBg — both stay >= 4.5:1.
const PALETTES: Palette[] = [
  { id: "mint-cash", name: "Mint", colors: { background: "#ECF7F0", cardBg: "#FFFFFF", textColor: "#0C2A1E", accent: "#12925C" } },
  { id: "sky", name: "Sky", colors: { background: "#EEF3FF", cardBg: "#FFFFFF", textColor: "#0B1F4D", accent: "#2E7DF6" } },
  { id: "gold", name: "Gold", colors: { background: "#FBF4E6", cardBg: "#FFFFFF", textColor: "#2E2408", accent: "#B58A18" } },
  { id: "night", name: "Night", colors: { background: "#12151C", cardBg: "#1E2230", textColor: "#F2F5FA", accent: "#4FC3F7" } },
];

// Trend arrow colors are semantic (up=green, down=red) regardless of palette.
const TREND_COLORS: Record<string, string> = { up: "#17A34A", down: "#E5484D", flat: "#8A8F98" };

const DURATION = 3.8;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#ECF7F0"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0C2A1E"));
  const accent = str(values.accent, pc("accent", "#12925C"));
  const chipInk = readableOn(cardBg);

  const label = str(values.label, "Today's rate");
  const fromAmount = str(values.fromAmount, "$100");
  const toAmount = str(values.toAmount, "€92");
  const rate = str(values.rate, "1 USD = 0.92 EUR");
  const trend = str(values.trend, "up");
  const showTrend = on(values.showTrend);
  const trendColor = TREND_COLORS[trend] ?? TREND_COLORS.flat!;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Chip sizing (derive the per-chip max from the real available width so
  // both chips + the "=" always fit inside the safe zone) ---
  const padX = minDim * 0.04;
  const padY = minDim * 0.028;
  const eqSize = Math.round(minDim * 0.055);
  const eqW = fonts.measure("=", { family: fonts.family("display"), weight: 700, size: eqSize });
  const chipGap = minDim * 0.03;
  const chipInnerMax = Math.max(minDim * 0.1, (zone.width - eqW - 2 * chipGap) / 2 - padX * 2);
  const amtSize0 = Math.round(minDim * 0.062);
  const fromSize = fitSize(fonts, fromAmount, "display", 700, amtSize0, chipInnerMax);
  const toSize = fitSize(fonts, toAmount, "display", 700, amtSize0, chipInnerMax);
  const amtSize = Math.min(fromSize, toSize);
  const measure = (s: string): number => fonts.measure(s, { family: fonts.family("display"), weight: 700, size: amtSize });
  const chipH = amtSize + padY * 2;
  const fromW = measure(fromAmount) + padX * 2;
  const toW = measure(toAmount) + padX * 2;
  const radius = chipH * 0.32;

  // --- Vertical layout: [label] chip-row [rate + trend] ---
  const labelSize = fitSize(fonts, label, "body", 600, Math.round(minDim * 0.034), zone.width * 0.9);
  const rateSize = fitSize(fonts, rate, "body", 500, Math.round(minDim * 0.036), zone.width * 0.82);
  const hasLabel = label.length > 0;
  const gapM = minDim * 0.05;

  const totalH = (hasLabel ? labelSize + gapM : 0) + chipH + gapM + rateSize;
  let cursorY = zone.y + zone.height / 2 - totalH / 2;

  if (hasLabel) {
    const labelY = cursorY + labelSize / 2;
    const labelText = makeText(fonts, { text: label, role: "body", weight: 600, size: labelSize, color: textColor, anchor: 0.5, letterSpacing: 2 });
    labelText.position.set(cx, labelY);
    labelText.alpha = 0;
    root.addChild(labelText);
    timeline
      .to(labelText, { prop: "alpha", from: 0, to: 0.85, start: 0.1, duration: 0.45, ease: outQuad })
      .to(labelText, { prop: "y", from: labelY - 8, to: labelY, start: 0.1, duration: 0.5, ease: outQuint });
    cursorY += labelSize + gapM;
  }

  // --- Chip row ---
  const rowY = cursorY + chipH / 2;
  const rowW = fromW + chipGap + eqW + chipGap + toW;
  let rx = cx - rowW / 2;

  const makeChip = (text: string, cw: number, startAt: number): void => {
    const chip = new Container();
    chip.position.set(rx + cw / 2, rowY);
    chip.scale.set(0);
    root.addChild(chip);
    const e = Math.round(chipH * 0.03);
    const off = Math.round(chipH * 0.06);
    chip.addChild(
      new Graphics().roundRect(-cw / 2 - e, -chipH / 2 - e + off, cw + e * 2, chipH + e * 2, radius + e).fill({ color: "#000000", alpha: 0.14 }),
    );
    chip.addChild(
      new Graphics()
        .roundRect(-cw / 2, -chipH / 2, cw, chipH, radius)
        .fill(cardBg)
        .roundRect(-cw / 2, -chipH / 2, cw, chipH, radius)
        .stroke({ color: accent, width: Math.max(1.5, chipH * 0.035), alpha: 0.9 }),
    );
    chip.addChild(makeText(fonts, { text, role: "display", weight: 700, size: amtSize, color: chipInk, anchor: 0.5 }));
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: startAt, duration: 0.6, ease: spring(0.5) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: startAt, duration: 0.6, ease: spring(0.5) });
  };

  makeChip(fromAmount, fromW, 0.25);
  rx += fromW + chipGap;

  const eqX = rx + eqW / 2;
  const eq = makeText(fonts, { text: "=", role: "display", weight: 700, size: eqSize, color: textColor, anchor: 0.5 });
  eq.position.set(eqX, rowY);
  eq.alpha = 0;
  root.addChild(eq);
  timeline
    .to(eq, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.35, ease: outQuad })
    .to(eq, { prop: "scale.x", from: 0.4, to: 1, start: 0.5, duration: 0.5, ease: spring(0.45) })
    .to(eq, { prop: "scale.y", from: 0.4, to: 1, start: 0.5, duration: 0.5, ease: spring(0.45) });
  rx += eqW + chipGap;

  makeChip(toAmount, toW, 0.6);
  cursorY += chipH + gapM;

  // --- Rate line + trend arrow ---
  const rateY = cursorY + rateSize / 2;
  const arrowS = showTrend ? rateSize * 0.72 : 0;
  const arrowGap = showTrend ? minDim * 0.016 : 0;
  const rateW = fonts.measure(rate, { family: fonts.family("body"), weight: 500, size: rateSize });
  const groupW = rateW + arrowGap + arrowS;
  const groupLeft = cx - groupW / 2;

  const rateText = makeText(fonts, { text: rate, role: "body", weight: 500, size: rateSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  rateText.position.set(groupLeft, rateY + 10);
  rateText.alpha = 0;
  root.addChild(rateText);
  timeline
    .to(rateText, { prop: "alpha", from: 0, to: 1, start: 0.95, duration: 0.45, ease: outQuad })
    .to(rateText, { prop: "y", from: rateY + 10, to: rateY, start: 0.95, duration: 0.5, ease: outQuint });

  if (showTrend) {
    const arrow = new Graphics();
    const a = arrowS * 0.5;
    if (trend === "down") arrow.poly([-a, -a * 0.7, a, -a * 0.7, 0, a * 0.8]).fill(trendColor);
    else if (trend === "flat") arrow.roundRect(-a, -a * 0.18, a * 2, a * 0.36, a * 0.18).fill(trendColor);
    else arrow.poly([-a, a * 0.7, a, a * 0.7, 0, -a * 0.8]).fill(trendColor);
    arrow.position.set(groupLeft + rateW + arrowGap + arrowS / 2, rateY);
    arrow.alpha = 0;
    arrow.scale.set(0.4);
    root.addChild(arrow);
    timeline
      .to(arrow, { prop: "alpha", from: 0, to: 1, start: 1.15, duration: 0.35, ease: outQuad })
      .to(arrow, { prop: "scale.x", from: 0.4, to: 1, start: 1.15, duration: 0.5, ease: spring(0.45) })
      .to(arrow, { prop: "scale.y", from: 0.4, to: 1, start: 1.15, duration: 0.5, ease: spring(0.45) });
  }

  return { timeline, duration: DURATION };
}

export const currencyCard: TemplateDefinition = {
  id: "currency-card",
  name: "Currency Card",
  tagline: "Two currency chips snap together over an exchange rate and trend arrow.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { fromAmount: "display", toAmount: "display", rate: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Header", default: "Today's rate", maxLength: 24, optional: true, shrinkToFit: true },
    { key: "fromAmount", type: "text", label: "From amount", default: "$100", maxLength: 12, shrinkToFit: true },
    { key: "toAmount", type: "text", label: "To amount", default: "€92", maxLength: 12, shrinkToFit: true },
    { key: "rate", type: "text", label: "Rate line", default: "1 USD = 0.92 EUR", maxLength: 28, shrinkToFit: true },
    {
      key: "trend",
      type: "select",
      label: "Trend",
      default: "up",
      options: [
        { value: "up", label: "Up" },
        { value: "down", label: "Down" },
        { value: "flat", label: "Flat" },
      ],
    },
    { key: "showTrend", type: "toggle", label: "Trend arrow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

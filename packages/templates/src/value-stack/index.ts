import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { groupThousands, parseTargetNumber } from "../shared/format";

// Value Stack — benefits stack up as a quiet ledger, each with its own money
// figure, then the total counts itself up, gets struck through, and the real
// price lands underneath. Stacks worth, not boxes.

const DURATION = 5.2;
const COUNT_START = 2.2;
const COUNT_DUR = 0.95;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one crisp line. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

/** Leading currency symbol of a price string ("$120" → "$", "120" → ""). */
function currencyPrefix(s: string): string {
  const m = s.match(/^[^\d-]*/);
  return m ? m[0] : "";
}

const DEFAULT_ROWS = [
  "Signature serum|$120",
  "Ceramic diffuser|$180",
  "Refill pack ×3|$96",
  "Travel case|$90",
];

interface Row {
  label: string;
  value: string;
  amount: number;
}

function parseRows(values: Values): Row[] {
  return asList(values.rows, DEFAULT_ROWS)
    .slice(0, 5)
    .map((raw) => {
      const parts = raw.split("|").map((s) => s.trim());
      const label = parts[0];
      const value = parts[1] ?? "";
      return {
        label: label && label.length > 0 ? label : "—",
        value,
        amount: parseTargetNumber(value),
      };
    });
}

const PALETTES: Palette[] = [
  {
    id: "studio-linen",
    name: "Studio linen",
    colors: { background: "#F5F2ED", textColor: "#1B1815", muted: "#67615B", accent: "#A8492A", onAccent: "#FFFFFF" },
  },
  {
    id: "cool-gallery",
    name: "Cool gallery",
    colors: { background: "#EEF1F4", textColor: "#141920", muted: "#59636E", accent: "#2F5EA8", onAccent: "#FFFFFF" },
  },
  {
    id: "sage-atelier",
    name: "Sage atelier",
    colors: { background: "#E8EDE7", textColor: "#151F19", muted: "#546258", accent: "#2F6B4E", onAccent: "#FFFFFF" },
  },
  {
    id: "noir-studio",
    name: "Noir studio",
    colors: { background: "#131417", textColor: "#F1F2F4", muted: "#9AA0A8", accent: "#C8A96A", onAccent: "#17140D" },
  },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F2ED"));
  const textColor = str(values.textColor, pc("textColor", "#1B1815"));
  const muted = pc("muted", "#67615B");
  const accent = str(values.accent, pc("accent", "#A8492A"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const kicker = str(values.kicker, "Everything included").toUpperCase();
  const title = str(values.title, "The Morning Set");
  const rows = parseRows(values);
  const totalLabel = str(values.totalLabel, "Total value").toUpperCase();
  const totalOverride = typeof values.total === "string" ? values.total : "";
  const payLabel = str(values.payLabel, "You pay");
  const payPrice = str(values.payPrice, "$149");
  const showChecks = values.showChecks !== false;
  const showDividers = values.showDividers !== false;
  const showStrike = values.showStrike !== false;

  const sum = rows.reduce((a, r) => a + r.amount, 0);
  const totalTarget = totalOverride.length > 0 ? parseTargetNumber(totalOverride) : sum;
  const prefix =
    totalOverride.length > 0 ? currencyPrefix(totalOverride) : currencyPrefix(rows[0]?.value ?? "");
  const totalFinal = prefix + groupThousands(totalTarget);

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const n = rows.length;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // One vertical unit drives every metric, so 3–5 rows all fit any aspect.
  const u = Math.min(minDim * 0.078, zone.height / (8.35 + n));
  const colW = Math.min(zone.width, minDim * 0.92);
  const colLeft = cx - colW / 2;
  const hair = Math.max(1, minDim * 0.0014);

  const kickH = 0.9 * u;
  const titleH = 1.35 * u;
  const gapA = 0.75 * u;
  const rowH = 1.0 * u;
  const gapB = 0.7 * u;
  const tLabelH = 0.75 * u;
  const totalH = 1.85 * u;
  const gapC = 0.5 * u;
  const payH = 0.95 * u;
  const stackH = kickH + titleH + gapA + n * rowH + gapB + tLabelH + totalH + gapC + payH;
  const top = zone.y + (zone.height - stackH) / 2;

  // --- Kicker + title ---
  const kickSize = fitSize(fonts, kicker, "body", 600, Math.round(0.34 * u), colW * 0.95);
  const kickY = top + kickH * 0.5;
  const kickText = makeText(fonts, {
    text: kicker,
    role: "body",
    weight: 600,
    size: kickSize,
    color: muted,
    anchor: 0.5,
    align: "center",
    letterSpacing: kickSize * 0.16,
  });
  kickText.position.set(cx, kickY);
  kickText.alpha = 0;
  root.addChild(kickText);
  timeline
    .to(kickText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.6, ease: outQuad })
    .to(kickText, { prop: "y", from: kickY + u * 0.18, to: kickY, start: 0, duration: 0.85, ease: outQuint });

  const titleSize = fitSize(fonts, title, "display", 700, Math.round(0.86 * u), colW * 0.98);
  const titleY = top + kickH + titleH * 0.5;
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    letterSpacing: -titleSize * 0.018,
  });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.65, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + u * 0.28, to: titleY, start: 0.15, duration: 1.0, ease: outExpo });

  // --- Benefit rows ---
  const rowsTop = top + kickH + titleH + gapA;
  const badgeR = 0.22 * u;
  const labelX = showChecks ? 0.72 * u : 0;
  const labelSize0 = Math.round(0.4 * u);
  const valueSize = Math.round(0.42 * u);

  rows.forEach((r, i) => {
    const rowCy = rowsTop + (i + 0.5) * rowH;
    const row = new Container();
    row.position.set(colLeft, rowCy);
    row.alpha = 0;
    root.addChild(row);

    if (showDividers) {
      const div = new Graphics().rect(0, rowH * 0.5 - hair, colW, hair).fill({ color: muted, alpha: 0.3 });
      div.scale.set(0, 1);
      row.addChild(div);
      timeline.to(div, {
        prop: "scale.x",
        from: 0,
        to: 1,
        start: 0.82 + i * 0.115,
        duration: 0.95,
        ease: outExpo,
      });
    }

    if (showChecks) {
      const badge = new Container();
      badge.position.set(badgeR + 0.06 * u, 0);
      badge.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));
      badge.addChild(makeIcon("check", badgeR * 1.05, { color: onAccent }));
      row.addChild(badge);
    }

    let valueW = 0;
    if (r.value.length > 0) {
      const vText = makeText(fonts, {
        text: r.value,
        role: "display",
        weight: 600,
        size: valueSize,
        color: textColor,
        anchor: { x: 1, y: 0.5 },
        align: "right",
      });
      vText.position.set(colW, 0);
      row.addChild(vText);
      valueW = vText.width;
    }

    const labelMax = colW - labelX - valueW - 0.55 * u;
    const labelSize = fitSize(fonts, r.label, "body", 500, labelSize0, labelMax);
    const lText = makeText(fonts, {
      text: r.label,
      role: "body",
      weight: 500,
      size: labelSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
      align: "left",
    });
    lText.position.set(labelX, 0);
    row.addChild(lText);

    const start = 0.75 + i * 0.115;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start, duration: 0.5, ease: outQuad })
      .to(row, { prop: "x", from: colLeft - u * 0.55, to: colLeft, start, duration: 0.9, ease: outExpo });
  });

  // --- Total value (counts up, then gets struck through) ---
  const tLabelSize = fitSize(fonts, totalLabel, "body", 600, Math.round(0.34 * u), colW * 0.9);
  const tLabelY = rowsTop + n * rowH + gapB + tLabelH * 0.5;
  const tLabelText = makeText(fonts, {
    text: totalLabel,
    role: "body",
    weight: 600,
    size: tLabelSize,
    color: muted,
    anchor: 0.5,
    align: "center",
    letterSpacing: tLabelSize * 0.16,
  });
  tLabelText.position.set(cx, tLabelY);
  tLabelText.alpha = 0;
  root.addChild(tLabelText);
  timeline
    .to(tLabelText, { prop: "alpha", from: 0, to: 1, start: 2.0, duration: 0.6, ease: outQuad })
    .to(tLabelText, { prop: "y", from: tLabelY + u * 0.16, to: tLabelY, start: 2.0, duration: 0.8, ease: outQuint });

  const totalSize = fitSize(fonts, totalFinal, "display", 700, Math.round(1.5 * u), colW * 0.8);
  const totalCy = rowsTop + n * rowH + gapB + tLabelH + totalH * 0.5;
  const totalText = makeText(fonts, {
    text: totalFinal,
    role: "display",
    weight: 700,
    size: totalSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    letterSpacing: -totalSize * 0.02,
  });
  totalText.position.set(cx, totalCy);
  totalText.alpha = 0;
  root.addChild(totalText);
  timeline
    .to(totalText, { prop: "alpha", from: 0, to: 1, start: 2.1, duration: 0.55, ease: outQuad })
    .to(totalText, { prop: "y", from: totalCy + u * 0.22, to: totalCy, start: 2.1, duration: 0.9, ease: outExpo });

  if (showStrike) {
    const strikeW = fonts.measure(totalFinal, {
      family: fonts.family("display"),
      weight: 700,
      size: totalSize,
    });
    const strikeH = Math.max(2.5, u * 0.06);
    const strike = new Graphics().rect(0, -strikeH / 2, strikeW, strikeH).fill(accent);
    strike.position.set(cx - strikeW / 2, totalCy);
    strike.scale.set(0, 1);
    strike.alpha = 0;
    root.addChild(strike);
    timeline
      .to(strike, { prop: "alpha", from: 0, to: 1, start: 3.25, duration: 0.2, ease: outQuad })
      .to(strike, { prop: "scale.x", from: 0, to: 1, start: 3.25, duration: 0.65, ease: outExpo });
    // Ease the struck figure back a touch — still well above 4.5:1.
    timeline.to(totalText, { prop: "alpha", from: 1, to: 0.85, start: 3.35, duration: 0.5, ease: outQuad });
  }

  // --- "You pay" line ---
  const payCy = totalCy + totalH * 0.5 + gapC + payH * 0.5;
  const payLabelSize = Math.round(0.42 * u);
  const payPriceSize = Math.round(0.62 * u);
  const payRow = new Container();
  payRow.position.set(cx, payCy);
  payRow.alpha = 0;
  root.addChild(payRow);

  const payLabelText = makeText(fonts, {
    text: payLabel,
    role: "body",
    weight: 600,
    size: payLabelSize,
    color: muted,
    anchor: { x: 0, y: 0.5 },
    align: "left",
  });
  const payPriceText = makeText(fonts, {
    text: payPrice,
    role: "display",
    weight: 700,
    size: payPriceSize,
    color: accent,
    anchor: { x: 0, y: 0.5 },
    align: "left",
  });
  const payGap = payLabel.length > 0 && payPrice.length > 0 ? 0.34 * u : 0;
  const payW = payLabelText.width + payGap + payPriceText.width;
  payLabelText.position.set(-payW / 2, 0);
  payPriceText.position.set(-payW / 2 + payLabelText.width + payGap, 0);
  if (payLabel.length > 0) payRow.addChild(payLabelText);
  if (payPrice.length > 0) payRow.addChild(payPriceText);
  timeline
    .to(payRow, { prop: "alpha", from: 0, to: 1, start: 3.55, duration: 0.7, ease: outQuad })
    .to(payRow, { prop: "y", from: payCy + u * 0.4, to: payCy, start: 3.55, duration: 0.95, ease: outExpo });

  // Money counts itself up — pure in t.
  const update = (t: number): void => {
    const p = outExpo(clamp01((t - COUNT_START) / COUNT_DUR));
    totalText.text = prefix + groupThousands(totalTarget * p);
  };

  return { timeline, duration: DURATION, update };
}

export const valueStack: TemplateDefinition = {
  id: "value-stack",
  name: "Value Stack",
  tagline: "Benefits stack up with their price tags, then the total gets struck through.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 4.6,
  fontRoles: { title: "display", rows: "body" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Eyebrow", default: "Everything included", maxLength: 28, shrinkToFit: true },
    { key: "title", type: "text", label: "Title", default: "The Morning Set", maxLength: 26, shrinkToFit: true },
    {
      key: "rows",
      type: "textlist",
      label: "What's included",
      default: DEFAULT_ROWS,
      minItems: 3,
      maxItems: 5,
      maxLength: 30,
      help: 'One per line as "Benefit|$120". The values add up to the total.',
    },
    { key: "totalLabel", type: "text", label: "Total label", default: "Total value", maxLength: 20, shrinkToFit: true },
    {
      key: "total",
      type: "text",
      label: "Total (override)",
      default: "",
      maxLength: 14,
      optional: true,
      help: "Leave empty to add the values above together.",
    },
    { key: "payLabel", type: "text", label: "Pay label", default: "You pay", maxLength: 16, optional: true },
    { key: "payPrice", type: "text", label: "Your price", default: "$149", maxLength: 14, optional: true },
    { key: "showChecks", type: "toggle", label: "Check badges", default: true },
    { key: "showDividers", type: "toggle", label: "Row hairlines", default: true },
    { key: "showStrike", type: "toggle", label: "Strike-through", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

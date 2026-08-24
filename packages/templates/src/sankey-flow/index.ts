import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutCubic,
  outExpo,
  outQuad,
  outQuint,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

// One confident accent carries every ribbon (graded by rank), so the chart reads
// as a single flow rather than a colour-coded legend. Text is always textColor
// or mutedColor on background — both checked ≥ 4.5:1 in each palette.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", muted: "#6B7280" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", muted: "#4A5B80" } },
  { id: "sand", name: "Sand", colors: { background: "#F7F3EC", textColor: "#2A2118", accent: "#C2410C", muted: "#6E6055" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", muted: "#9AA1AC" } },
];

interface Flow {
  label: string;
  value: number;
  display: string;
}

const DEFAULT_FLOWS = ["Organic search|4,800", "Social|2,600", "Newsletter|1,900", "Referral|1,100"];

function parseFlow(raw: string, fallback: string): Flow {
  const parts = raw.split("|").map((s) => s.trim());
  const label = parts[0] ?? "";
  const vRaw = parts[1] ?? "0";
  return {
    label: label.length ? label : fallback,
    value: Math.max(0, parseTargetNumber(vRaw)),
    display: vRaw.length ? vRaw : "0",
  };
}

function flowsOf(values: Values): Flow[] {
  return asList(values.flows, DEFAULT_FLOWS)
    .slice(0, 5)
    .map((r, i) => parseFlow(r, `Channel ${i + 1}`));
}

/** Width fraction reserved on the right for the destination labels. */
function rightFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.28;
    case "1:1":
      return 0.33;
    case "4:5":
      return 0.33;
    case "9:16":
      return 0.38;
  }
}

/**
 * A ribbon as a closed polygon: both edges run source→destination on a
 * smootherstep curve, so the band leaves and lands perfectly horizontal and does
 * all its bending in the middle. Every ribbon shares the same source taper, so a
 * vertical cut anywhere across the flow still shows thickness ∝ value.
 */
function ribbonPoly(
  x0: number,
  x1: number,
  sy0: number,
  sy1: number,
  dy0: number,
  dy1: number,
  steps: number,
): number[] {
  const top: number[] = [];
  const bottom: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const s = u * u * u * (u * (u * 6 - 15) + 10); // smootherstep
    const x = x0 + (x1 - x0) * u;
    top.push(x, sy0 + (dy0 - sy0) * s);
    bottom.push(x, sy1 + (dy1 - sy1) * s);
  }
  const pts = top.slice();
  for (let i = bottom.length - 2; i >= 0; i -= 2) pts.push(bottom[i]!, bottom[i + 1]!);
  return pts;
}

/** The source node is drawn shorter than the destination stack, so the bands fan. */
const SRC_SCALE = 0.6;

const RIB_START = 0.75;
const RIB_EACH = 0.14;
const RIB_DUR = 0.95;
const BAR_OFF = 0.55;
const BAR_DUR = 0.6;
const LABEL_OFF = 0.68;
const LABEL_DUR = 0.5;
const HOLD = 1.6;

function computeDuration(values: Values): number {
  const n = Math.max(1, flowsOf(values).length);
  const last = RIB_START + (n - 1) * RIB_EACH;
  return Math.max(last + RIB_DUR, last + BAR_OFF + BAR_DUR, last + LABEL_OFF + LABEL_DUR) + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const mutedColor = str(values.mutedColor, pc("muted", "#6B7280"));

  const title = str(values.title, "Where the traffic goes");
  const sourceLabel = str(values.sourceLabel, "All visitors");
  const showAccentBar = values.accentBar !== false;
  const showTotal = values.showTotal !== false;
  const showShare = values.showShare !== false;

  const flows = flowsOf(values);
  const total = flows.reduce((a, f) => a + f.value, 0) || 1;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);

  // --- Title (+ accent underline) ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), zone.width);
  const titleY = zone.y + titleSize * 0.75;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  titleText.position.set(zone.x, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "x", from: zone.x - 18, to: zone.x, start: 0, duration: 0.65, ease: outQuint });

  let titleBottom = titleY + titleSize * 0.7;
  if (showAccentBar) {
    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(zone.x, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.28, duration: 0.55, ease: outExpo });
    titleBottom = titleY + titleSize * 0.9;
  }

  // --- Flow geometry (laid out first; the header then sits over the source) ---
  const eyebrowSize = Math.round(minDim * 0.022);
  const totalSize = Math.round(minDim * 0.042);
  const headerW = zone.width * 0.5;
  const headerBlockH = showTotal ? eyebrowSize * 1.15 + totalSize * 1.15 : eyebrowSize * 1.2;

  const flowTop = titleBottom + minDim * 0.05;
  const flowBottom = zone.y + zone.height - minDim * 0.02;
  const flowH = Math.max(minDim * 0.24, flowBottom - flowTop);

  const barW = Math.max(9, minDim * 0.022);
  const rightCol = zone.width * rightFrac(ctx.aspect);
  const srcX = zone.x;
  const dstX = zone.x + zone.width - rightCol - barW;
  const ribX0 = srcX + barW;
  const ribX1 = dstX;

  const n = flows.length;
  const gapH = flowH * 0.075;
  const avail = Math.max(minDim * 0.1, flowH - (n - 1) * gapH);

  // Label block height decides the smallest band we can still label legibly.
  const nameSize = Math.round(minDim * 0.028);
  const metaSize = Math.round(minDim * 0.023);
  const labelBlockH = nameSize * 1.15 + metaSize * 1.25;

  // Proportional heights, with a floor so a tiny channel stays readable; the
  // floor is paid for pro-rata by the bands that have room to spare.
  let heights = flows.map((f) => (avail * f.value) / total);
  const minH = Math.min(avail / n, labelBlockH * 0.92);
  let deficit = 0;
  heights = heights.map((v) => {
    if (v < minH) {
      deficit += minH - v;
      return minH;
    }
    return v;
  });
  if (deficit > 0) {
    const surplus = heights.reduce((a, v) => a + (v > minH ? v - minH : 0), 0);
    if (surplus > deficit) {
      heights = heights.map((v) => (v > minH ? v - ((v - minH) / surplus) * deficit : v));
    }
  }

  const dstStackH = heights.reduce((a, v) => a + v, 0);
  const srcStackH = dstStackH * SRC_SCALE;
  const srcTop = flowTop + (flowH - srcStackH) / 2;

  const ribbonAlpha = (i: number): number => Math.max(0.3, 0.9 - i * 0.16);

  // --- Source header: eyebrow + total, sitting directly over the source node ---
  const headerTop = Math.max(flowTop, srcTop - minDim * 0.03 - headerBlockH);
  const eyeText = sourceLabel.toUpperCase();
  const eyeSize = fitSize(fonts, eyeText, "body", 600, eyebrowSize, headerW);
  const eyebrowY = headerTop + eyebrowSize * 0.6;
  const eyebrow = makeText(fonts, { text: eyeText, role: "body", weight: 600, size: eyeSize, color: mutedColor, anchor: { x: 0, y: 0.5 }, letterSpacing: 1.6 });
  eyebrow.position.set(zone.x, eyebrowY);
  eyebrow.alpha = 0;
  root.addChild(eyebrow);
  timeline
    .to(eyebrow, { prop: "alpha", from: 0, to: 1, start: 0.22, duration: 0.45, ease: outQuad })
    .to(eyebrow, { prop: "y", from: eyebrowY + 10, to: eyebrowY, start: 0.22, duration: 0.6, ease: outQuint });

  if (showTotal) {
    const totalStr = groupThousands(total);
    const tSize = fitSize(fonts, totalStr, "display", 700, totalSize, headerW);
    const totalY = headerTop + eyebrowSize * 1.15;
    const totalText = makeText(fonts, { text: totalStr, role: "display", weight: 700, size: tSize, color: textColor, anchor: { x: 0, y: 0 } });
    totalText.position.set(zone.x, totalY);
    totalText.alpha = 0;
    root.addChild(totalText);
    timeline
      .to(totalText, { prop: "alpha", from: 0, to: 1, start: 0.32, duration: 0.45, ease: outQuad })
      .to(totalText, { prop: "y", from: totalY + 12, to: totalY, start: 0.32, duration: 0.7, ease: outQuint });
  }

  // --- Source bar: one column, wiping down before the ribbons leave it ---
  const srcBar = new Container();
  srcBar.position.set(srcX, srcTop);
  srcBar.scale.set(1, 0);
  srcBar.addChild(new Graphics().roundRect(0, 0, barW, srcStackH, barW / 2).fill(accent));
  root.addChild(srcBar);
  timeline.to(srcBar, { prop: "scale.y", from: 0, to: 1, start: 0.3, duration: 0.8, ease: outExpo });

  // --- Ribbons + destination bars + labels ---
  let srcCursor = srcTop;
  let dstCursor = flowTop;
  const labelX = dstX + barW + minDim * 0.022;
  const labelMaxW = Math.max(minDim * 0.12, zone.x + zone.width - labelX);

  flows.forEach((f, i) => {
    const th = heights[i] ?? 0;
    const sy0 = srcCursor;
    const sy1 = srcCursor + th * SRC_SCALE;
    const dy0 = dstCursor;
    const dy1 = dstCursor + th;
    srcCursor = sy1;
    dstCursor = dy1 + gapH;

    const start = RIB_START + i * RIB_EACH;
    const alpha = ribbonAlpha(i);

    // The ribbon itself, revealed by a mask sweeping left → right so it reads
    // as flowing out of the source bar.
    const holder = new Container();
    root.addChild(holder);
    const ribbon = new Graphics()
      .poly(ribbonPoly(ribX0, ribX1, sy0, sy1, dy0, dy1, 40))
      .fill({ color: accent, alpha });
    holder.addChild(ribbon);
    const sweep = new Graphics().rect(0, 0, ribX1 - ribX0 + barW, flowH + gapH).fill(0xffffff);
    sweep.position.set(ribX0, flowTop - gapH / 2);
    sweep.scale.set(0, 1);
    holder.addChild(sweep);
    ribbon.mask = sweep;
    timeline.to(sweep, { prop: "scale.x", from: 0, to: 1, start, duration: RIB_DUR, ease: inOutCubic });

    // Destination bar grows down as the ribbon lands on it.
    const dstBar = new Container();
    dstBar.position.set(dstX, dy0);
    dstBar.scale.set(1, 0);
    dstBar.addChild(new Graphics().roundRect(0, 0, barW, th, Math.min(barW / 2, th / 2)).fill({ color: accent, alpha: Math.min(1, alpha + 0.08) }));
    root.addChild(dstBar);
    timeline.to(dstBar, { prop: "scale.y", from: 0, to: 1, start: start + BAR_OFF, duration: BAR_DUR, ease: outExpo });

    // Name + value/share, drifting in from the bar.
    const cy = (dy0 + dy1) / 2;
    const labelC = new Container();
    labelC.position.set(0, cy);
    labelC.alpha = 0;
    root.addChild(labelC);

    const nSize = fitSize(fonts, f.label, "body", 600, nameSize, labelMaxW);
    const name = makeText(fonts, { text: f.label, role: "body", weight: 600, size: nSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    name.position.set(labelX, -metaSize * 0.62);
    labelC.addChild(name);

    const share = Math.round((f.value / total) * 100);
    const metaStr = showShare ? `${f.display} · ${share}%` : f.display;
    const mSize = fitSize(fonts, metaStr, "body", 500, metaSize, labelMaxW);
    const meta = makeText(fonts, { text: metaStr, role: "body", weight: 500, size: mSize, color: mutedColor, anchor: { x: 0, y: 0.5 } });
    meta.position.set(labelX, nameSize * 0.62);
    labelC.addChild(meta);

    timeline
      .to(labelC, { prop: "alpha", from: 0, to: 1, start: start + LABEL_OFF, duration: LABEL_DUR, ease: outQuad })
      .to(labelC, { prop: "x", from: -minDim * 0.018, to: 0, start: start + LABEL_OFF, duration: LABEL_DUR + 0.2, ease: outQuint });
  });

  return { timeline, duration: computeDuration(values) };
}

export const sankeyFlow: TemplateDefinition = {
  id: "sankey-flow",
  name: "Sankey Flow",
  tagline: "Curved ribbons flow out of one total and split into the channels behind it.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", flows: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Where the traffic goes", maxLength: 34, optional: true, shrinkToFit: true },
    { key: "sourceLabel", type: "text", label: "Source label", default: "All visitors", maxLength: 22, shrinkToFit: true },
    {
      key: "flows",
      type: "textlist",
      label: "Destinations (label | value)",
      default: DEFAULT_FLOWS,
      minItems: 3,
      maxItems: 5,
      maxLength: 26,
      help: 'One per line as "label | value", e.g. "Organic search | 4,800". Ribbon thickness follows the value.',
    },
    { key: "showTotal", type: "toggle", label: "Source total", default: true },
    { key: "showShare", type: "toggle", label: "Share of total", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Ribbons", default: "", optional: true },
    { key: "mutedColor", type: "color", label: "Secondary text", default: "", optional: true },
  ],
  build,
};

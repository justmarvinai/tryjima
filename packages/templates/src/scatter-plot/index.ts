import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
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
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

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

// Bubble fills are palette-only (`bubble` / `bubble2`); the trend line + accent
// bar carry the user accent (no text on them). All label text is
// textColor-on-background, ≥ 4.5:1 in every palette.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", bubble: "#2E7DF6", bubble2: "#7C5CFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#FF4D1C", bubble: "#2E7DF6", bubble2: "#17A34A" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#F97316", bubble: "#17A34A", bubble2: "#2E7DF6" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", bubble: "#38C7FF", bubble2: "#FF8A5C" } },
];

const N_BUBBLES = 10;

const AXES_START = 0.1;
const AXES_DUR = 0.5;
const GRID_START = 0.45;
const BUB_START = 0.85;
const BUB_EACH = 0.09;
const BUB_DUR = 0.4;
const TREND_START = 1.55;
const TREND_DUR = 0.7;
const HOLD = 1.1;
const DURATION = BUB_START + (N_BUBBLES - 1) * BUB_EACH + BUB_DUR > TREND_START + TREND_DUR
  ? BUB_START + (N_BUBBLES - 1) * BUB_EACH + BUB_DUR + HOLD
  : TREND_START + TREND_DUR + HOLD;

interface Bubble {
  fx: number;
  fy: number;
  r: number;
  alt: boolean;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const bubbleColor = pc("bubble", "#2E7DF6");
  const bubble2Color = pc("bubble2", "#7C5CFF");

  const title = str(values.title, "Reach vs. engagement");
  const xLabel = str(values.xLabel, "Reach");
  const yLabel = str(values.yLabel, "Engagement");
  const showTrend = values.showTrend !== false;
  const showGrid = values.showGrid !== false;
  const showAccentBar = values.accentBar !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);

  // --- Title (+ accent bar) ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), zone.width);
  const titleY = zone.y + titleSize * 0.75;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  titleText.position.set(zone.x, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: zone.x - 18, to: zone.x, start: 0, duration: 0.5, ease: outQuint });

  let titleBottom = titleY + titleSize * 0.7;
  if (showAccentBar) {
    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(zone.x, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
    titleBottom = titleY + titleSize * 0.9;
  }

  // --- Plot geometry ---
  const axisLabelSize = Math.round(minDim * 0.03);
  const leftPad = axisLabelSize + minDim * 0.03;
  const bottomPad = axisLabelSize + minDim * 0.04;
  const plotLeft = zone.x + leftPad;
  const plotRight = zone.x + zone.width - minDim * 0.02;
  const plotTop = titleBottom + minDim * 0.04;
  const plotBottom = zone.y + zone.height - bottomPad;
  const plotW = Math.max(minDim * 0.2, plotRight - plotLeft);
  const plotH = Math.max(minDim * 0.2, plotBottom - plotTop);
  const axisThick = Math.max(2.5, minDim * 0.006);

  // --- Grid (optional), behind everything ---
  if (showGrid) {
    for (let i = 1; i <= 3; i++) {
      const gx = plotLeft + (plotW * i) / 4;
      const gy = plotBottom - (plotH * i) / 4;
      const vline = new Graphics().rect(gx - axisThick * 0.25, plotTop, axisThick * 0.5, plotH).fill({ color: textColor, alpha: 0.08 });
      const hline = new Graphics().rect(plotLeft, gy - axisThick * 0.25, plotW, axisThick * 0.5).fill({ color: textColor, alpha: 0.08 });
      vline.alpha = 0;
      hline.alpha = 0;
      root.addChild(vline, hline);
      timeline
        .to(vline, { prop: "alpha", from: 0, to: 1, start: GRID_START + i * 0.05, duration: 0.4, ease: outQuad })
        .to(hline, { prop: "alpha", from: 0, to: 1, start: GRID_START + i * 0.05, duration: 0.4, ease: outQuad });
    }
  }

  // --- Axes draw in from the origin ---
  const yAxis = new Container();
  yAxis.position.set(plotLeft, plotBottom);
  yAxis.scale.set(1, 0);
  yAxis.addChild(new Graphics().rect(-axisThick / 2, -plotH, axisThick, plotH).fill(textColor));
  root.addChild(yAxis);
  timeline.to(yAxis, { prop: "scale.y", from: 0, to: 1, start: AXES_START, duration: AXES_DUR, ease: outExpo });

  const xAxis = new Container();
  xAxis.position.set(plotLeft, plotBottom);
  xAxis.scale.set(0, 1);
  xAxis.addChild(new Graphics().rect(0, -axisThick / 2, plotW, axisThick).fill(textColor));
  root.addChild(xAxis);
  timeline.to(xAxis, { prop: "scale.x", from: 0, to: 1, start: AXES_START, duration: AXES_DUR, ease: outExpo });

  // --- Axis labels ---
  const xLabelText = makeText(fonts, { text: xLabel, role: "body", weight: 600, size: fitSize(fonts, xLabel, "body", 600, axisLabelSize, plotW), color: textColor, anchor: 0.5 });
  xLabelText.position.set(plotLeft + plotW / 2, plotBottom + bottomPad * 0.62);
  xLabelText.alpha = 0;
  root.addChild(xLabelText);
  timeline.to(xLabelText, { prop: "alpha", from: 0, to: 1, start: AXES_START + 0.3, duration: 0.4, ease: outQuad });

  const yLabelText = makeText(fonts, { text: yLabel, role: "body", weight: 600, size: fitSize(fonts, yLabel, "body", 600, axisLabelSize, plotH), color: textColor, anchor: 0.5 });
  yLabelText.rotation = -Math.PI / 2;
  yLabelText.position.set(zone.x + axisLabelSize * 0.6, plotTop + plotH / 2);
  yLabelText.alpha = 0;
  root.addChild(yLabelText);
  timeline.to(yLabelText, { prop: "alpha", from: 0, to: 1, start: AXES_START + 0.3, duration: 0.4, ease: outQuad });

  // --- Bubbles: seeded deterministically, biased toward a positive trend ---
  const rMin = minDim * 0.018;
  const rMax = minDim * 0.055;
  const bubbles: Bubble[] = [];
  for (let i = 0; i < N_BUBBLES; i++) {
    const fx = rng.range(0.06, 0.94);
    const fy = clamp01(0.14 + fx * 0.68 + rng.range(-0.17, 0.17));
    const r = rng.range(rMin, rMax);
    bubbles.push({ fx, fy, r, alt: rng.next() < 0.4 });
  }
  bubbles.sort((a, b) => a.fx - b.fx);

  bubbles.forEach((b, rank) => {
    const bx = plotLeft + b.fx * plotW;
    const by = plotBottom - b.fy * plotH;
    const dot = new Graphics()
      .circle(0, 0, b.r)
      .fill({ color: b.alt ? bubble2Color : bubbleColor, alpha: 0.55 })
      .circle(0, 0, b.r)
      .stroke({ color: b.alt ? bubble2Color : bubbleColor, width: Math.max(1.5, b.r * 0.12) });
    dot.position.set(bx, by);
    dot.scale.set(0);
    root.addChild(dot);
    const start = BUB_START + rank * BUB_EACH;
    timeline
      .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: BUB_DUR, ease: makeOutBack(2) })
      .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: BUB_DUR, ease: makeOutBack(2) });
  });

  // --- Trend line (optional): least-squares fit, sweeps left→right ---
  if (showTrend) {
    const nB = bubbles.length;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const b of bubbles) {
      sx += b.fx;
      sy += b.fy;
      sxx += b.fx * b.fx;
      sxy += b.fx * b.fy;
    }
    const denom = nB * sxx - sx * sx;
    const m = Math.abs(denom) > 1e-6 ? (nB * sxy - sx * sy) / denom : 0;
    const c = (sy - m * sx) / nB;
    const fx0 = 0.04;
    const fx1 = 0.96;
    const x0 = plotLeft + fx0 * plotW;
    const y0 = plotBottom - clamp01(m * fx0 + c) * plotH;
    const x1 = plotLeft + fx1 * plotW;
    const y1 = plotBottom - clamp01(m * fx1 + c) * plotH;
    const len = Math.hypot(x1 - x0, y1 - y0);
    const trendThick = Math.max(3, minDim * 0.008);

    const trend = new Container();
    trend.position.set(x0, y0);
    trend.rotation = Math.atan2(y1 - y0, x1 - x0);
    trend.scale.set(0, 1);
    trend.addChild(new Graphics().roundRect(0, -trendThick / 2, len, trendThick, trendThick / 2).fill(accent));
    root.addChild(trend);
    timeline.to(trend, { prop: "scale.x", from: 0, to: 1, start: TREND_START, duration: TREND_DUR, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const scatterPlot: TemplateDefinition = {
  id: "scatter-plot",
  name: "Scatter Plot",
  tagline: "Axes draw in, bubbles pop across the field, and a trend line sweeps through.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { title: "display", xLabel: "body", yLabel: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Reach vs. engagement", maxLength: 34, shrinkToFit: true },
    { key: "xLabel", type: "text", label: "X axis label", default: "Reach", maxLength: 20, shrinkToFit: true },
    { key: "yLabel", type: "text", label: "Y axis label", default: "Engagement", maxLength: 20, shrinkToFit: true },
    { key: "showTrend", type: "toggle", label: "Trend line", default: true },
    { key: "showGrid", type: "toggle", label: "Grid", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

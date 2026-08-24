import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  linear,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

/** Create text; if it would overflow `maxWidth`, re-make one size smaller (crisp). */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

/**
 * Trace a smooth curve through (xs,ys) onto `g`, assuming the cursor already
 * sits at (xs[0], ys[0]) via a prior moveTo/lineTo. Uses the classic
 * quadratic-through-midpoints trick (control = the raw point, target = the
 * midpoint to the next point, with a final straight segment into the last
 * point) — cheap, deterministic, and reads as a gently rounded trend line.
 */
function smoothLineTo(g: Graphics, xs: number[], ys: number[]): void {
  const n = xs.length;
  if (n <= 1) return;
  if (n === 2) {
    g.lineTo(xs[1]!, ys[1]!);
    return;
  }
  for (let i = 1; i < n - 1; i++) {
    const mx = (xs[i]! + xs[i + 1]!) / 2;
    const my = (ys[i]! + ys[i + 1]!) / 2;
    g.quadraticCurveTo(xs[i]!, ys[i]!, mx, my);
  }
  g.lineTo(xs[n - 1]!, ys[n - 1]!);
}

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", accent2: "#2E7DF6" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", accent2: "#FF4D1C" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A", accent2: "#7C5CFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", accent2: "#17A34A" } },
];

const DEFAULT_POINTS = ["Jan:12", "Feb:18", "Mar:16", "Apr:24", "May:34", "Jun:42"];
const DEFAULT_POINTS2 = ["Jan:7", "Feb:10", "Mar:9", "Apr:14", "May:19", "Jun:24"];

interface Point {
  label: string;
  value: number;
}

function resolvePoints(values: Values): Point[] {
  const raw = asList(values.points, DEFAULT_POINTS).slice(0, 6);
  const items = raw.length >= 3 ? raw : DEFAULT_POINTS;
  return items.map((it) => {
    const idx = it.indexOf(":");
    const label = (idx >= 0 ? it.slice(0, idx) : it).trim();
    const valPart = idx >= 0 ? it.slice(idx + 1) : it;
    return { label: label.length ? label : it.trim(), value: Math.max(0, parseTargetNumber(valPart)) };
  });
}

/** Second series' values only, resampled/padded to match the first series' length. */
function resolveSeries2(values: Values, n: number): number[] {
  const raw = asList(values.points2, DEFAULT_POINTS2);
  const parsed = raw.map((it) => {
    const idx = it.indexOf(":");
    const valPart = idx >= 0 ? it.slice(idx + 1) : it;
    return Math.max(0, parseTargetNumber(valPart));
  });
  if (parsed.length === 0) return new Array(n).fill(0) as number[];
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(parsed[Math.min(i, parsed.length - 1)]!);
  return out;
}

const REVEAL_START = 0.5;
const HOLD = 1.3;

function revealDuration(n: number): number {
  return Math.min(2.0, 0.9 + n * 0.18);
}
function computeDuration(values: Values): number {
  return REVEAL_START + revealDuration(resolvePoints(values).length) + HOLD;
}

interface Band {
  titleY: number;
  top: number;
  bottom: number;
}

function bandFor(aspect: Aspect, h: number): Band {
  switch (aspect) {
    case "9:16":
      return { titleY: h * 0.1, top: h * 0.32, bottom: h * 0.68 };
    case "16:9":
      return { titleY: h * 0.12, top: h * 0.34, bottom: h * 0.86 };
    case "4:5":
      return { titleY: h * 0.08, top: h * 0.3, bottom: h * 0.84 };
    default:
      return { titleY: h * 0.09, top: h * 0.32, bottom: h * 0.82 }; // 1:1
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const accent2 = pc("accent2", "#2E7DF6");
  const showGrid = values.showGrid !== false;
  const showAccentBar = values.accentBar !== false;
  const showSecondSeries = values.showSecondSeries === true;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const pts = resolvePoints(values);
  const n = pts.length;
  const v2 = showSecondSeries ? resolveSeries2(values, n) : (new Array(n).fill(0) as number[]);
  const stackTotal = pts.map((p, i) => p.value + v2[i]!);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const band = bandFor(ctx.aspect, h);
  const marginX = w * 0.09;
  const chartW = w - marginX * 2;
  const chartTop = band.top + (showSecondSeries ? minDim * 0.045 : 0);
  const chartBottom = band.bottom;

  // --- Title (left) ---
  const titleRaw = str(values.title, "Revenue trend");
  const titleSize = fitSize(fonts, titleRaw, "display", 700, Math.round(minDim * 0.05), chartW * 0.5);
  const titleText = makeText(fonts, { text: titleRaw, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  titleText.position.set(marginX, band.titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: marginX - 16, to: marginX, start: 0, duration: 0.5, ease: outExpo });

  if (showAccentBar) {
    const ruleW = titleSize * 1.4;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(marginX, band.titleY + titleSize * 0.85);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
  }

  // --- Mini legend (only meaningful with two series), just under the title ---
  if (showSecondSeries) {
    const legendFont = Math.round(minDim * 0.024);
    const dotR = legendFont * 0.32;
    const legendY = band.titleY + titleSize * 1.5;
    const series1Name = str(values.series1Label, "This year");
    const series2Name = str(values.series2Label, "Last year");
    let cursorX = marginX;
    [
      { color: accent, label: series1Name },
      { color: accent2, label: series2Name },
    ].forEach((entry, i) => {
      const dot = new Graphics().circle(0, 0, dotR).fill(entry.color);
      dot.position.set(cursorX + dotR, legendY);
      dot.alpha = 0;
      root.addChild(dot);
      const txt = fitText(
        fonts,
        { text: entry.label, role: "body", weight: 600, size: legendFont, color: textColor, anchor: { x: 0, y: 0.5 } },
        chartW * 0.3,
      );
      txt.position.set(cursorX + dotR * 2.6, legendY);
      txt.alpha = 0;
      root.addChild(txt);
      const start = 0.3 + i * 0.12;
      timeline
        .to(dot, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
        .to(txt, { prop: "alpha", from: 0, to: 0.85, start, duration: 0.35, ease: outQuad });
      cursorX += dotR * 2.6 + txt.width + legendFont * 1.4;
    });
  }

  // --- Peak readout (right), counts up alongside the reveal ---
  const peak = Math.max(1, ...stackTotal);
  const maxPeakWidth = chartW * 0.42;
  const baseNumSize = Math.round(minDim * 0.062);
  const numSize = fitSize(fonts, groupThousands(peak), "display", 700, baseNumSize, maxPeakWidth);
  const numY = band.titleY + numSize * 0.3;
  const capY = band.titleY - numSize * 0.34;

  const peakLabelRaw = str(values.peakLabel, "Peak");
  if (peakLabelRaw.length > 0) {
    const capSize = Math.max(10, Math.round(numSize * 0.32));
    const capText = fitText(
      fonts,
      { text: peakLabelRaw, role: "body", weight: 600, size: capSize, color: textColor, anchor: { x: 1, y: 0.5 } },
      maxPeakWidth,
    );
    capText.position.set(marginX + chartW, capY);
    capText.alpha = 0;
    root.addChild(capText);
    timeline.to(capText, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.35, ease: outQuad });
  }

  const peakNum = makeText(fonts, { text: "0", role: "display", weight: 700, size: numSize, color: textColor, anchor: { x: 1, y: 0.5 } });
  peakNum.position.set(marginX + chartW, numY);
  peakNum.alpha = 0;
  root.addChild(peakNum);
  timeline.to(peakNum, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad });

  const COUNT_START = REVEAL_START;
  const revealDur = revealDuration(n);
  const COUNT_DUR = revealDur;
  timeline
    .to(peakNum, { prop: "scale.x", from: 1, to: 1.08, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(peakNum, { prop: "scale.x", from: 1.08, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.2, ease: outQuad })
    .to(peakNum, { prop: "scale.y", from: 1, to: 1.08, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(peakNum, { prop: "scale.y", from: 1.08, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.2, ease: outQuad });

  // --- Gridlines (decorative, toggled) ---
  if (showGrid) {
    const grid = new Graphics();
    for (const f of [0.18, 0.44, 0.7]) {
      const y = chartTop + f * (chartBottom - chartTop);
      grid.rect(marginX, y, chartW, Math.max(1, minDim * 0.0016)).fill({ color: textColor, alpha: 0.08 });
    }
    grid.alpha = 0;
    root.addChild(grid);
    timeline.to(grid, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad });
  }

  // --- Axis baseline (structural, always shown) ---
  const axis = new Graphics().rect(marginX, chartBottom, chartW, Math.max(2, minDim * 0.003)).fill({ color: textColor, alpha: 0.18 });
  axis.alpha = 0;
  root.addChild(axis);
  timeline.to(axis, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad });

  // --- Point geometry (true zero baseline, so the filled area reads honestly) ---
  const HEADROOM = 0.86;
  const xs = pts.map((_, i) => marginX + (n > 1 ? (chartW * i) / (n - 1) : chartW / 2));
  const ys1 = pts.map((p) => chartBottom - (p.value / peak) * (chartBottom - chartTop) * HEADROOM);
  const ysStack = stackTotal.map((v) => chartBottom - (v / peak) * (chartBottom - chartTop) * HEADROOM);

  const chartGroup = new Container();
  root.addChild(chartGroup);

  const strokeW = Math.max(2.5, minDim * 0.008);

  // Series 1: baseline-to-curve filled area + a crisp top edge.
  const area1 = new Graphics();
  area1.moveTo(xs[0]!, chartBottom).lineTo(xs[0]!, ys1[0]!);
  smoothLineTo(area1, xs, ys1);
  area1.lineTo(xs[n - 1]!, chartBottom).closePath().fill({ color: accent, alpha: 0.5 });
  chartGroup.addChild(area1);

  const line1 = new Graphics();
  line1.moveTo(xs[0]!, ys1[0]!);
  smoothLineTo(line1, xs, ys1);
  line1.stroke({ color: accent, width: strokeW, cap: "round", join: "round" });
  chartGroup.addChild(line1);

  // Series 2 (optional): a band stacked between series 1's curve and the combined total.
  if (showSecondSeries) {
    const rxs = [...xs].reverse();
    const rys1 = [...ys1].reverse();
    const area2 = new Graphics();
    // Trace the band as: up the left edge onto the stacked curve, forward along
    // it, down the right edge onto series 1's curve, then back along that
    // curve to the start — `smoothLineTo` always needs the cursor already
    // sitting on its arrays' first point, so each direction change gets an
    // explicit lineTo first.
    area2.moveTo(xs[0]!, ys1[0]!);
    area2.lineTo(xs[0]!, ysStack[0]!);
    smoothLineTo(area2, xs, ysStack);
    area2.lineTo(rxs[0]!, rys1[0]!);
    smoothLineTo(area2, rxs, rys1);
    area2.closePath().fill({ color: accent2, alpha: 0.5 });
    chartGroup.addChild(area2);

    const line2 = new Graphics();
    line2.moveTo(xs[0]!, ysStack[0]!);
    smoothLineTo(line2, xs, ysStack);
    line2.stroke({ color: accent2, width: strokeW, cap: "round", join: "round" });
    chartGroup.addChild(line2);
  }

  const maskPadY = minDim * 0.05;
  const revealMask = new Graphics().rect(0, 0, chartW, chartBottom - chartTop + maskPadY * 2).fill("#FFFFFF");
  revealMask.position.set(marginX, chartTop - maskPadY);
  revealMask.scale.set(0, 1);
  root.addChild(revealMask);
  chartGroup.mask = revealMask;
  timeline.to(revealMask, { prop: "scale.x", from: 0, to: 1, start: REVEAL_START, duration: revealDur, ease: linear });

  // --- X labels, revealed progressively as the wipe passes their position ---
  const labelMaxW = chartW / n;
  xs.forEach((x, i) => {
    const lbl = pts[i]!.label;
    if (lbl.length === 0) return;
    const f = n > 1 ? i / (n - 1) : 0;
    const start = REVEAL_START + f * revealDur;
    const lblSize = Math.max(8, Math.round(minDim * 0.024));
    const lblText = fitText(
      fonts,
      { text: lbl, role: "body", weight: 600, size: lblSize, color: textColor, anchor: { x: 0.5, y: 0 } },
      labelMaxW,
    );
    lblText.position.set(x, chartBottom + minDim * 0.022);
    lblText.alpha = 0;
    root.addChild(lblText);
    timeline.to(lblText, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad });
  });

  const update = (t: number): void => {
    const p = outExpo(clamp01((t - COUNT_START) / COUNT_DUR));
    peakNum.text = groupThousands(peak * p);
  };

  return { timeline, duration: computeDuration(values), update };
}

export const areaChart: TemplateDefinition = {
  id: "area-chart",
  name: "Area Chart",
  tagline: "A smooth filled trend rises left to right as the peak counts up.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.7,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", value: "display", label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Revenue trend", maxLength: 36, shrinkToFit: true },
    { key: "points", type: "textlist", label: "Points (label:value)", default: DEFAULT_POINTS, minItems: 3, maxItems: 6, maxLength: 16 },
    { key: "peakLabel", type: "text", label: "Peak label", default: "Peak", maxLength: 16, optional: true },
    { key: "showSecondSeries", type: "toggle", label: "Second series", default: false },
    { key: "points2", type: "textlist", label: "Second series (label:value)", default: DEFAULT_POINTS2, minItems: 2, maxItems: 6, maxLength: 16, optional: true },
    { key: "series1Label", type: "text", label: "Series 1 name", default: "This year", maxLength: 16, optional: true },
    { key: "series2Label", type: "text", label: "Series 2 name", default: "Last year", maxLength: 16, optional: true },
    { key: "showGrid", type: "toggle", label: "Gridlines", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

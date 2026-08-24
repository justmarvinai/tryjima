import { Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  linear,
  outCubic,
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

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF" } },
];

const DEFAULT_POINTS = ["Mon:18", "Tue:26", "Wed:22", "Thu:34", "Fri:48"];

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
    return { label: label.length ? label : it.trim(), value: parseTargetNumber(valPart) };
  });
}

const LINE_START = 0.5;
const AREA_DUR = 0.6;
const HOLD = 1.1;

function lineDuration(n: number): number {
  return Math.min(2.0, 0.9 + n * 0.18);
}

function computeDuration(values: Values): number {
  return LINE_START + lineDuration(resolvePoints(values).length) + AREA_DUR + HOLD;
}

interface Band {
  titleY: number;
  top: number;
  bottom: number;
}

function bandFor(aspect: Aspect, h: number): Band {
  switch (aspect) {
    case "9:16":
      return { titleY: h * 0.145, top: h * 0.32, bottom: h * 0.7 };
    case "16:9":
      return { titleY: h * 0.12, top: h * 0.34, bottom: h * 0.88 };
    case "4:5":
      return { titleY: h * 0.09, top: h * 0.28, bottom: h * 0.86 };
    default:
      return { titleY: h * 0.1, top: h * 0.3, bottom: h * 0.84 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const showArea = values.showArea !== false;
  const showAccentBar = values.accentBar !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const pts = resolvePoints(values);
  const n = pts.length;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const band = bandFor(ctx.aspect, h);
  const marginX = w * 0.09;
  const chartW = w - marginX * 2;
  const chartTop = band.top;
  const chartBottom = band.bottom;

  // --- Title (left) ---
  const titleRaw = str(values.title, "Weekly growth");
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

  // --- Peak readout (right), counts up alongside the line draw ---
  const maxV = Math.max(...pts.map((p) => p.value));
  const minV = Math.min(...pts.map((p) => p.value));
  const maxPeakWidth = chartW * 0.42;
  const baseNumSize = Math.round(minDim * 0.062);
  const numSize = fitSize(fonts, groupThousands(maxV), "display", 700, baseNumSize, maxPeakWidth);
  const numY = band.titleY + numSize * 0.3;
  const capY = band.titleY - numSize * 0.34;

  const peakLabelRaw = str(values.peakLabel, "");
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

  const COUNT_START = LINE_START;
  const lineDur = lineDuration(n);
  const COUNT_DUR = lineDur;
  timeline
    .to(peakNum, { prop: "scale.x", from: 1, to: 1.08, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(peakNum, { prop: "scale.x", from: 1.08, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.2, ease: outQuad })
    .to(peakNum, { prop: "scale.y", from: 1, to: 1.08, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(peakNum, { prop: "scale.y", from: 1.08, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.2, ease: outQuad });

  // --- Axis baseline (structural, always shown) ---
  const axis = new Graphics().rect(marginX, chartBottom, chartW, Math.max(2, minDim * 0.003)).fill({ color: textColor, alpha: 0.16 });
  axis.alpha = 0;
  root.addChild(axis);
  timeline.to(axis, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad });

  // --- Point geometry (min/max-normalized so the trend always uses the full band) ---
  const span = maxV - minV;
  const HEADROOM = 0.92;
  const xs = pts.map((_, i) => marginX + (n > 1 ? (chartW * i) / (n - 1) : chartW / 2));
  const ys = pts.map((p) => {
    const f = span > 0 ? (p.value - minV) / span : 0.5;
    return chartBottom - f * (chartBottom - chartTop) * HEADROOM;
  });

  // --- Soft area fill, rises from the baseline once the line has drawn ---
  if (showArea) {
    const areaG = new Graphics();
    areaG.moveTo(xs[0]!, chartBottom);
    xs.forEach((x, i) => areaG.lineTo(x, ys[i]!));
    areaG.lineTo(xs[n - 1]!, chartBottom);
    areaG.closePath().fill({ color: accent, alpha: 0.16 });
    root.addChild(areaG);

    const areaTopY = Math.min(...ys);
    const areaMaskH = chartBottom - areaTopY + minDim * 0.02;
    const areaMask = new Graphics().rect(0, -areaMaskH, chartW, areaMaskH).fill("#FFFFFF");
    areaMask.position.set(marginX, chartBottom);
    areaMask.scale.set(1, 0);
    root.addChild(areaMask);
    areaG.mask = areaMask;

    const areaStart = LINE_START + lineDur;
    timeline.to(areaMask, { prop: "scale.y", from: 0, to: 1, start: areaStart, duration: AREA_DUR, ease: outCubic });
  }

  // --- The line itself, drawn once and revealed left-to-right via a wipe mask ---
  const strokeW = Math.max(3, minDim * 0.011);
  const lineG = new Graphics();
  xs.forEach((x, i) => {
    if (i === 0) lineG.moveTo(x, ys[i]!);
    else lineG.lineTo(x, ys[i]!);
  });
  lineG.stroke({ color: accent, width: strokeW, cap: "round", join: "round" });
  root.addChild(lineG);

  const maskPadY = minDim * 0.05;
  const lineMaskH = chartBottom - chartTop + maskPadY * 2;
  const lineMask = new Graphics().rect(0, 0, chartW, lineMaskH).fill("#FFFFFF");
  lineMask.position.set(marginX, chartTop - maskPadY);
  lineMask.scale.set(0, 1);
  root.addChild(lineMask);
  lineG.mask = lineMask;
  timeline.to(lineMask, { prop: "scale.x", from: 0, to: 1, start: LINE_START, duration: lineDur, ease: linear });

  // --- Points pop in exactly as the reveal reaches their x position ---
  const labelMaxW = chartW / n;
  xs.forEach((x, i) => {
    const y = ys[i]!;
    const f = n > 1 ? i / (n - 1) : 0;
    const start = LINE_START + f * lineDur;
    const dotR = Math.max(5, minDim * 0.013);
    const dot = new Graphics().circle(0, 0, dotR).fill(accent).stroke({ color: bg, width: Math.max(2, dotR * 0.4) });
    dot.position.set(x, y);
    dot.scale.set(0);
    root.addChild(dot);
    timeline
      .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.34, ease: makeOutBack(2.2) })
      .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.34, ease: makeOutBack(2.2) });

    const lbl = pts[i]!.label;
    if (lbl.length > 0) {
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
    }
  });

  const update = (t: number): void => {
    const p = outExpo(clamp01((t - COUNT_START) / COUNT_DUR));
    peakNum.text = groupThousands(maxV * p);
  };

  return { timeline, duration: computeDuration(values), update };
}

export const lineGraph: TemplateDefinition = {
  id: "line-graph",
  name: "Line Graph",
  tagline: "A trend line draws in left to right as the peak counts up.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", value: "display", label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Weekly growth", maxLength: 36, shrinkToFit: true },
    { key: "points", type: "textlist", label: "Points (label:value)", default: DEFAULT_POINTS, minItems: 3, maxItems: 6, maxLength: 16 },
    { key: "peakLabel", type: "text", label: "Peak label", default: "Peak", maxLength: 16, optional: true },
    { key: "showArea", type: "toggle", label: "Area fill", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutCubic,
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
import { dashedPath } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const num = (v: unknown, fallback: number): number => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim().length > 0) {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
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
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", muted: "#6B7280", chipBg: "#F5F1EC" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", muted: "#4A5B80", chipBg: "#FFFFFF" } },
  { id: "sand", name: "Sand", colors: { background: "#F8F4ED", textColor: "#2A2118", accent: "#C2410C", muted: "#6E6055", chipBg: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", muted: "#9AA1AC", chipBg: "#1D1D24" } },
];

const Z_MIN = -3.1;
const Z_MAX = 3.1;
const SAMPLES = 160;

interface Tick {
  z: number;
  label: string;
}

const DEFAULT_TICKS = ["-2|Way below", "-1|Below", "0|Average", "1|Above", "2|Way above"];

function parseTick(raw: string, fallback: string): Tick {
  const parts = raw.split("|").map((s) => s.trim());
  const label = parts[1] ?? "";
  return {
    z: Math.max(Z_MIN, Math.min(Z_MAX, num(parts[0], 0))),
    label: label.length ? label : fallback,
  };
}

function ticksOf(values: Values): Tick[] {
  return asList(values.ticks, DEFAULT_TICKS)
    .slice(0, 7)
    .map((r, i) => parseTick(r, `Step ${i + 1}`));
}

const CURVE_START = 0.5;
const CURVE_DUR = 1.25;
const REGION_START = 1.5;
const MEAN_START = 1.85;
const CALLOUT_START = 2.35;
const CALLOUT_DUR = 0.55;
const TICK_START = 2.15;
const TICK_EACH = 0.08;
const TICK_DUR = 0.4;
const HOLD = 1.15;

function computeDuration(values: Values): number {
  const showTicks = values.showTicks !== false;
  const tickEnd = showTicks ? TICK_START + (ticksOf(values).length - 1) * TICK_EACH + TICK_DUR : 0;
  return Math.max(CALLOUT_START + CALLOUT_DUR, tickEnd) + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const mutedColor = str(values.mutedColor, pc("muted", "#6B7280"));
  const chipBg = pc("chipBg", "#F5F1EC");

  const title = str(values.title, "Most people land in the middle");
  const callout = str(values.callout, "68% land here");
  const showTicks = values.showTicks !== false;
  const showMean = values.showMean !== false;
  const showCallout = values.showCallout !== false;
  const showAccentBar = values.accentBar !== false;

  const mLow = Math.max(Z_MIN, Math.min(Z_MAX, num(values.markerLow, -1)));
  const mHigh = Math.max(Z_MIN, Math.min(Z_MAX, num(values.markerHigh, 1)));
  const zLow = Math.min(mLow, mHigh);
  const zHigh = Math.max(mLow, mHigh);

  const ticks = ticksOf(values);

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

  // --- Plot geometry ---
  const tickSize = Math.round(minDim * 0.024);
  const tickBandH = showTicks ? tickSize * 2.5 : minDim * 0.02;
  const baselineY = zone.y + zone.height - tickBandH;
  const chipH = Math.round(minDim * 0.062);
  const plotTop = titleBottom + minDim * 0.05;
  const curveTop = plotTop + (showCallout ? chipH + minDim * 0.05 : minDim * 0.02);
  const curveH = Math.max(minDim * 0.16, baselineY - curveTop);
  const plotL = zone.x;
  const plotW = zone.width;

  const xOf = (z: number): number => plotL + ((z - Z_MIN) / (Z_MAX - Z_MIN)) * plotW;
  const yOf = (z: number): number => baselineY - curveH * Math.exp(-0.5 * z * z);

  // --- Axis baseline ---
  const axisThick = Math.max(2, minDim * 0.0028);
  const axis = new Container();
  axis.position.set(plotL, baselineY);
  axis.scale.set(0, 1);
  axis.addChild(new Graphics().rect(0, -axisThick / 2, plotW, axisThick).fill({ color: textColor, alpha: 0.18 }));
  root.addChild(axis);
  timeline.to(axis, { prop: "scale.x", from: 0, to: 1, start: 0.25, duration: 0.6, ease: outExpo });

  // --- The distribution, drawing itself left → right under a sweeping mask ---
  const strokeW = Math.max(3.5, minDim * 0.008);
  const curveG = new Graphics();
  for (let i = 0; i <= SAMPLES; i++) {
    const z = Z_MIN + ((Z_MAX - Z_MIN) * i) / SAMPLES;
    const x = xOf(z);
    const y = yOf(z);
    if (i === 0) curveG.moveTo(x, y);
    else curveG.lineTo(x, y);
  }
  curveG.stroke({ color: accent, width: strokeW, cap: "round", join: "round" });
  const curveHolder = new Container();
  root.addChild(curveHolder);
  curveHolder.addChild(curveG);
  const curveSweep = new Graphics().rect(0, 0, plotW + strokeW, curveH + strokeW * 3).fill(0xffffff);
  curveSweep.position.set(plotL - strokeW / 2, curveTop - strokeW * 1.5);
  curveSweep.scale.set(0, 1);
  curveHolder.addChild(curveSweep);
  curveG.mask = curveSweep;
  timeline.to(curveSweep, { prop: "scale.x", from: 0, to: 1, start: CURVE_START, duration: CURVE_DUR, ease: inOutCubic });

  // --- Shaded region between the two markers, rising out of the baseline ---
  const regionC = new Container();
  regionC.position.set(0, baselineY);
  regionC.scale.set(1, 0);
  root.addChild(regionC);
  const regionPts: number[] = [xOf(zLow), 0];
  const regionSteps = 60;
  for (let i = 0; i <= regionSteps; i++) {
    const z = zLow + ((zHigh - zLow) * i) / regionSteps;
    regionPts.push(xOf(z), yOf(z) - baselineY);
  }
  regionPts.push(xOf(zHigh), 0);
  regionC.addChild(new Graphics().poly(regionPts).fill({ color: accent, alpha: 0.16 }));
  timeline.to(regionC, { prop: "scale.y", from: 0, to: 1, start: REGION_START, duration: 0.85, ease: outExpo });

  // --- Marker hairlines at each edge of the region ---
  const markerW = Math.max(2.5, minDim * 0.0032);
  [zLow, zHigh].forEach((z, k) => {
    const mC = new Container();
    mC.position.set(xOf(z), baselineY);
    mC.scale.set(1, 0);
    const len = baselineY - yOf(z);
    mC.addChild(new Graphics().rect(-markerW / 2, -len, markerW, len).fill({ color: accent, alpha: 0.75 }));
    root.addChild(mC);
    timeline.to(mC, { prop: "scale.y", from: 0, to: 1, start: 1.45 + k * 0.12, duration: 0.55, ease: outQuint });
  });

  // --- Mean line, dropping from the peak down to the axis ---
  if (showMean) {
    const meanX = xOf(0);
    const peakY = yOf(0);
    const len = baselineY - peakY;
    const meanHolder = new Container();
    meanHolder.position.set(meanX, peakY);
    root.addChild(meanHolder);
    const dashG = new Graphics();
    dashedPath(dashG, [0, 0, 0, len], {
      dash: minDim * 0.016,
      gap: minDim * 0.012,
      width: Math.max(2, minDim * 0.0026),
      color: textColor,
      cap: "butt",
    });
    dashG.alpha = 0.45;
    meanHolder.addChild(dashG);
    const dashMask = new Graphics().rect(-minDim * 0.02, 0, minDim * 0.04, len).fill(0xffffff);
    dashMask.scale.set(1, 0);
    meanHolder.addChild(dashMask);
    dashG.mask = dashMask;
    timeline.to(dashMask, { prop: "scale.y", from: 0, to: 1, start: MEAN_START, duration: 0.65, ease: outQuint });
  }

  // --- Callout chip above the shaded region ---
  if (showCallout) {
    const zMid = (zLow + zHigh) / 2;
    const chipFont = fitSize(fonts, callout, "body", 600, Math.round(minDim * 0.028), zone.width * 0.6);
    const chipText = makeText(fonts, { text: callout, role: "body", weight: 600, size: chipFont, color: textColor, anchor: 0.5 });
    const chipW = chipText.width + minDim * 0.05;
    const chipCx = Math.max(plotL + chipW / 2, Math.min(plotL + plotW - chipW / 2, xOf(zMid)));
    const chipCy = plotTop + chipH / 2;

    const chip = new Container();
    chip.position.set(chipCx, chipCy);
    chip.alpha = 0;
    root.addChild(chip);
    chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(chipBg));
    chip.addChild(
      new Graphics()
        .roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2)
        .stroke({ color: accent, width: Math.max(1.5, minDim * 0.002), alpha: 0.55 }),
    );
    chip.addChild(chipText);
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start: CALLOUT_START, duration: CALLOUT_DUR, ease: outQuad })
      .to(chip, { prop: "y", from: chipCy - minDim * 0.018, to: chipCy, start: CALLOUT_START, duration: CALLOUT_DUR + 0.15, ease: outExpo });

    // Hairline leader from the chip down to the curve it is talking about.
    const leadTop = chipCy + chipH / 2;
    const leadBottom = yOf(zMid) - minDim * 0.014;
    if (leadBottom > leadTop) {
      const lead = new Container();
      lead.position.set(chipCx, leadTop);
      lead.scale.set(1, 0);
      lead.addChild(
        new Graphics()
          .rect(-Math.max(1.5, minDim * 0.0022) / 2, 0, Math.max(1.5, minDim * 0.0022), leadBottom - leadTop)
          .fill({ color: accent, alpha: 0.55 }),
      );
      root.addChild(lead);
      timeline.to(lead, { prop: "scale.y", from: 0, to: 1, start: CALLOUT_START + 0.1, duration: 0.4, ease: outQuint });
    }
  }

  // --- Axis ticks, fading in along the baseline ---
  if (showTicks) {
    const labelMaxW = (plotW / Math.max(1, ticks.length)) * 0.94;
    ticks.forEach((tk, i) => {
      const tC = new Container();
      const tx = xOf(tk.z);
      tC.position.set(tx, baselineY);
      tC.alpha = 0;
      root.addChild(tC);
      tC.addChild(
        new Graphics()
          .rect(-Math.max(1.5, minDim * 0.002) / 2, 0, Math.max(1.5, minDim * 0.002), tickSize * 0.5)
          .fill({ color: textColor, alpha: 0.28 }),
      );
      const lSize = fitSize(fonts, tk.label, "body", 500, tickSize, labelMaxW);
      const lbl = makeText(fonts, { text: tk.label, role: "body", weight: 500, size: lSize, color: mutedColor, anchor: { x: 0.5, y: 0 } });
      lbl.position.set(0, tickSize * 0.85);
      tC.addChild(lbl);
      timeline
        .to(tC, { prop: "alpha", from: 0, to: 1, start: TICK_START + i * TICK_EACH, duration: TICK_DUR, ease: outQuad })
        .to(tC, { prop: "y", from: baselineY + minDim * 0.008, to: baselineY, start: TICK_START + i * TICK_EACH, duration: TICK_DUR + 0.15, ease: outQuint });
    });
  }

  return { timeline, duration: computeDuration(values) };
}

export const bellCurve: TemplateDefinition = {
  id: "bell-curve",
  name: "Bell Curve",
  tagline: "A normal curve draws itself, then the middle band shades in and gets named.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.5,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", ticks: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Most people land in the middle", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "callout", type: "text", label: "Callout", default: "68% land here", maxLength: 26, shrinkToFit: true },
    { key: "markerLow", type: "slider", label: "Left marker", default: -1, min: -3, max: 3, step: 0.25 },
    { key: "markerHigh", type: "slider", label: "Right marker", default: 1, min: -3, max: 3, step: 0.25 },
    {
      key: "ticks",
      type: "textlist",
      label: "Axis labels (position | label)",
      default: DEFAULT_TICKS,
      minItems: 3,
      maxItems: 7,
      maxLength: 18,
      help: 'One per line as "position | label", e.g. "-1 | Below". Position runs -3 (far left) to 3 (far right).',
    },
    { key: "showCallout", type: "toggle", label: "Callout chip", default: true },
    { key: "showMean", type: "toggle", label: "Mean line", default: true },
    { key: "showTicks", type: "toggle", label: "Axis labels", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Curve", default: "", optional: true },
    { key: "mutedColor", type: "color", label: "Axis labels", default: "", optional: true },
  ],
  build,
};

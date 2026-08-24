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
  type Values,
} from "@jima/engine";
import { parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

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

// Rising lines carry the accent, falling lines a deliberately muted second
// color — the slope IS the story. All chip/label text is textColor on
// chipBg/background (≥ 4.5:1 in every palette); lines carry no text.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", fall: "#A6ADB8", chipBg: "#F5F1EC" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", fall: "#9FB0CB", chipBg: "#FFFFFF" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A", fall: "#9DB8A8", chipBg: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", fall: "#5C6470", chipBg: "#1D1D24" } },
];

interface Series {
  label: string;
  before: number;
  after: number;
  beforeDisplay: string;
  afterDisplay: string;
}

const DEFAULT_SERIES = ["Organic|32|58", "Email|14|36", "Paid|46|41", "Referral|22|12"];

function parseSeries(raw: string, fallback: string): Series {
  const parts = raw.split("|").map((s) => s.trim());
  const label = parts[0] ?? "";
  const bRaw = parts[1] ?? "0";
  const aRaw = parts[2] ?? bRaw;
  return {
    label: label.length ? label : fallback,
    before: parseTargetNumber(bRaw),
    after: parseTargetNumber(aRaw),
    beforeDisplay: bRaw.length ? bRaw : "0",
    afterDisplay: aRaw.length ? aRaw : "0",
  };
}

function seriesOf(values: Values): Series[] {
  return asList(values.series, DEFAULT_SERIES)
    .slice(0, 5)
    .map((r, i) => parseSeries(r, `Series ${i + 1}`));
}

const SER_START = 1.0;
const SER_EACH = 0.24;
const LINE_DUR = 0.55;
const CHIP_TAIL = 0.35; // right chip: starts 0.05 before line end, pops for 0.4
const HOLD = 1.3;

function computeDuration(values: Values): number {
  return SER_START + (seriesOf(values).length - 1) * SER_EACH + LINE_DUR + CHIP_TAIL + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const fallColor = str(values.fallColor, pc("fall", "#A6ADB8"));
  const chipBg = pc("chipBg", "#F5F1EC");

  const title = str(values.title, "Traffic mix shift");
  const leftLabel = str(values.leftLabel, "Before");
  const rightLabel = str(values.rightLabel, "After");
  const showAxes = values.showAxes !== false;
  const showAccentBar = values.accentBar !== false;

  const series = seriesOf(values);

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

  // --- Chart geometry: exactly two moments in time ---
  const headerSize = Math.round(minDim * 0.026);
  const headerY = titleBottom + minDim * 0.055;
  const chartTop = headerY + headerSize + minDim * 0.03;
  const chartBottom = zone.y + zone.height - minDim * 0.02;
  const chartH = Math.max(minDim * 0.2, chartBottom - chartTop);
  const axisL = zone.x + zone.width * 0.34;
  const axisR = zone.x + zone.width * 0.87;

  let vMin = Math.min(...series.map((s) => Math.min(s.before, s.after)));
  let vMax = Math.max(...series.map((s) => Math.max(s.before, s.after)));
  if (vMax - vMin < 1e-6) {
    vMax = vMin + 1;
  }
  const pad = (vMax - vMin) * 0.09;
  vMin -= pad;
  vMax += pad;
  const mapY = (v: number): number => chartBottom - ((v - vMin) / (vMax - vMin)) * chartH;

  // --- Two vertical axes (optional) + editable headers ---
  const axisThick = Math.max(2, minDim * 0.0035);
  if (showAxes) {
    [axisL, axisR].forEach((ax, k) => {
      const axis = new Container();
      axis.position.set(ax, chartTop);
      axis.scale.set(1, 0);
      axis.addChild(new Graphics().rect(-axisThick / 2, 0, axisThick, chartH).fill({ color: textColor, alpha: 0.2 }));
      root.addChild(axis);
      timeline.to(axis, { prop: "scale.y", from: 0, to: 1, start: 0.35 + k * 0.1, duration: 0.5, ease: outExpo });
    });
  }

  const headerMaxW = zone.width * 0.24;
  [
    { text: leftLabel, x: axisL },
    { text: rightLabel, x: axisR },
  ].forEach((hd, k) => {
    const txt = hd.text.toUpperCase();
    const hSize = fitSize(fonts, txt, "body", 600, headerSize, headerMaxW);
    const header = makeText(fonts, { text: txt, role: "body", weight: 600, size: hSize, color: textColor, anchor: 0.5, letterSpacing: 1.5 });
    header.position.set(hd.x, headerY + headerSize / 2);
    header.alpha = 0;
    root.addChild(header);
    timeline.to(header, { prop: "alpha", from: 0, to: 0.8, start: 0.55 + k * 0.08, duration: 0.4, ease: outQuad });
  });

  // --- Value chip helper (chipBg fill, line-colored edge, textColor label) ---
  const chipFont = Math.round(minDim * 0.026);
  const makeChip = (display: string, edge: string): Container => {
    const chip = new Container();
    const tSize = fitSize(fonts, display, "display", 700, chipFont, minDim * 0.11);
    const txt = makeText(fonts, { text: display, role: "display", weight: 700, size: tSize, color: textColor, anchor: 0.5 });
    const cw = txt.width + minDim * 0.022;
    const chh = txt.height + minDim * 0.01;
    chip.addChild(new Graphics().roundRect(-cw / 2, -chh / 2, cw, chh, chh / 2).fill(chipBg));
    chip.addChild(new Graphics().roundRect(-cw / 2, -chh / 2, cw, chh, chh / 2).stroke({ color: edge, width: Math.max(1.5, minDim * 0.0025) }));
    chip.addChild(txt);
    return chip;
  };

  // --- Series: line sweeps left → right, endpoints dot + chips pop ---
  const dotR = Math.max(5, minDim * 0.011);
  const lineThick = Math.max(3.5, minDim * 0.009);
  const chipHalfW = minDim * 0.055;
  const labelFont = Math.round(minDim * 0.028);
  const labelMaxW = Math.max(minDim * 0.1, axisL - zone.x - chipHalfW * 2 - minDim * 0.05);

  series.forEach((s, i) => {
    const yL = mapY(s.before);
    const yR = mapY(s.after);
    const rising = s.after >= s.before;
    const col = rising ? accent : fallColor;
    const start = SER_START + i * SER_EACH;

    // Left cluster: series label + before-value chip, sliding in together.
    const leftC = new Container();
    leftC.position.set(0, yL);
    leftC.alpha = 0;
    root.addChild(leftC);
    const chipL = makeChip(s.beforeDisplay, col);
    chipL.position.set(axisL - minDim * 0.02 - chipL.width / 2, 0);
    leftC.addChild(chipL);
    const lSize = fitSize(fonts, s.label, "body", 600, labelFont, labelMaxW);
    const lbl = makeText(fonts, { text: s.label, role: "body", weight: 600, size: lSize, color: textColor, anchor: { x: 1, y: 0.5 } });
    lbl.position.set(axisL - minDim * 0.035 - chipL.width, 0);
    leftC.addChild(lbl);
    timeline
      .to(leftC, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(leftC, { prop: "x", from: -14, to: 0, start, duration: 0.45, ease: outQuint });

    // The slope line itself (a rotated bar scaling open along its length).
    const len = Math.hypot(axisR - axisL, yR - yL);
    const line = new Container();
    line.position.set(axisL, yL);
    line.rotation = Math.atan2(yR - yL, axisR - axisL);
    line.scale.set(0, 1);
    line.addChild(new Graphics().roundRect(0, -lineThick / 2, len, lineThick, lineThick / 2).fill({ color: col, alpha: 0.92 }));
    root.addChild(line);
    timeline.to(line, { prop: "scale.x", from: 0, to: 1, start, duration: LINE_DUR, ease: outQuint });

    // Endpoint dots.
    const dotL = new Graphics().circle(0, 0, dotR).fill(col).stroke({ color: bg, width: Math.max(2, dotR * 0.35) });
    dotL.position.set(axisL, yL);
    dotL.scale.set(0);
    root.addChild(dotL);
    timeline
      .to(dotL, { prop: "scale.x", from: 0, to: 1, start, duration: 0.35, ease: makeOutBack(2) })
      .to(dotL, { prop: "scale.y", from: 0, to: 1, start, duration: 0.35, ease: makeOutBack(2) });

    const arriveAt = start + LINE_DUR - 0.05;
    const dotRt = new Graphics().circle(0, 0, dotR).fill(col).stroke({ color: bg, width: Math.max(2, dotR * 0.35) });
    dotRt.position.set(axisR, yR);
    dotRt.scale.set(0);
    root.addChild(dotRt);
    timeline
      .to(dotRt, { prop: "scale.x", from: 0, to: 1, start: arriveAt, duration: 0.35, ease: makeOutBack(2) })
      .to(dotRt, { prop: "scale.y", from: 0, to: 1, start: arriveAt, duration: 0.35, ease: makeOutBack(2) });

    // Right after-value chip pops as the line lands.
    const chipR = makeChip(s.afterDisplay, col);
    chipR.position.set(axisR + minDim * 0.02 + chipR.width / 2, yR);
    chipR.scale.set(0);
    root.addChild(chipR);
    timeline
      .to(chipR, { prop: "scale.x", from: 0, to: 1, start: arriveAt, duration: 0.4, ease: makeOutBack(1.9) })
      .to(chipR, { prop: "scale.y", from: 0, to: 1, start: arriveAt, duration: 0.4, ease: makeOutBack(1.9) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const slopeGraph: TemplateDefinition = {
  id: "slope-graph",
  name: "Slope Graph",
  tagline: "Lines climb or slide between two moments — rising in accent, falling muted.",
  category: "comparison",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", series: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Traffic mix shift", maxLength: 34, optional: true, shrinkToFit: true },
    { key: "leftLabel", type: "text", label: "Left axis label", default: "Before", maxLength: 12, shrinkToFit: true },
    { key: "rightLabel", type: "text", label: "Right axis label", default: "After", maxLength: 12, shrinkToFit: true },
    {
      key: "series",
      type: "textlist",
      label: "Series (label | before | after)",
      default: DEFAULT_SERIES,
      minItems: 3,
      maxItems: 5,
      maxLength: 24,
      help: 'One per line as "label | before | after", e.g. "Organic | 32 | 58".',
    },
    { key: "showAxes", type: "toggle", label: "Axis lines", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Rising lines", default: "", optional: true },
    { key: "fallColor", type: "color", label: "Falling lines", default: "", optional: true },
  ],
  build,
};

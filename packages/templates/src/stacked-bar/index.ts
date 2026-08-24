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

// Segment fills are a fixed categorical set per palette (like donut-chart). On
// light palettes they are mid-dark with white inline % (`onSeg`); the midnight
// palette uses bright segments with dark inline %. Legend labels/percents are
// textColor-on-background (≥ 4.5:1 everywhere). Inline % is large bold text
// (≥ 3:1 bar) and every seg/onSeg pairing clears it.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", seg1: "#2563EB", seg2: "#C2410C", seg3: "#15803D", seg4: "#7C3AED", onSeg: "#FFFFFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", seg1: "#1D4ED8", seg2: "#C2410C", seg3: "#0B7A54", seg4: "#7C3AED", onSeg: "#FFFFFF" } },
  { id: "sunrise", name: "Sunrise", colors: { background: "#FFF6ED", textColor: "#3A1D00", accent: "#F97316", seg1: "#C2410C", seg2: "#1D4ED8", seg3: "#15803D", seg4: "#7C3AED", onSeg: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", seg1: "#60A5FA", seg2: "#FB923C", seg3: "#34D399", seg4: "#C4B5FD", onSeg: "#101014" } },
];

const DEFAULT_SEGMENTS = ["Chrome|63", "Safari|20", "Edge|11", "Firefox|6"];

const SEG_START = 0.6;
const SEG_EACH = 0.32;
const SEG_DUR = 0.6;
const HOLD = 1.2;

interface Segment {
  label: string;
  raw: number;
}

function segmentsOf(values: Values): Segment[] {
  const raw = asList(values.segments, DEFAULT_SEGMENTS).slice(0, 4);
  const items = raw.length >= 2 ? raw : DEFAULT_SEGMENTS;
  return items.map((it) => {
    const idx = it.indexOf("|");
    const label = (idx >= 0 ? it.slice(0, idx) : it).trim();
    const valPart = idx >= 0 ? it.slice(idx + 1) : "";
    const num = Math.max(0, parseFloat(valPart.replace(/[^\d.]/g, "")) || 0);
    return { label: label.length ? label : it.trim(), raw: num };
  });
}

function computeDuration(values: Values): number {
  const n = Math.max(1, segmentsOf(values).length);
  return SEG_START + (n - 1) * SEG_EACH + SEG_DUR + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const segColors = [pc("seg1", "#2563EB"), pc("seg2", "#C2410C"), pc("seg3", "#15803D"), pc("seg4", "#7C3AED")];
  const onSeg = pc("onSeg", "#FFFFFF");

  const title = str(values.title, "Browser market share");
  const showLegend = values.showLegend !== false;
  const showInline = values.showInline !== false;
  const showAccentBar = values.accentBar !== false;

  const segs = segmentsOf(values);
  const n = segs.length;
  const sum = segs.reduce((a, b) => a + b.raw, 0) || 1;
  const pcts = segs.map((s) => (s.raw / sum) * 100);

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

  let barTop = titleY + titleSize * 0.9 + minDim * 0.055;
  if (showAccentBar) {
    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(zone.x, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
    barTop = titleY + titleSize * 1.1 + minDim * 0.05;
  }

  // --- The 100% stacked bar ---
  const barX = zone.x;
  const barW = zone.width;
  const barH = Math.min(minDim * 0.12, zone.height * 0.16);
  const barContainer = new Container();
  barContainer.position.set(barX, barTop);
  root.addChild(barContainer);

  // Track behind the segments.
  barContainer.addChild(new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill({ color: textColor, alpha: 0.08 }));

  // Rounded mask so segment ends read as one pill.
  const mask = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill("#FFFFFF");
  barContainer.addChild(mask);
  const segLayer = new Container();
  segLayer.mask = mask;
  barContainer.addChild(segLayer);

  // Segments grow from the left, staggered.
  let cursorX = 0;
  const inlineSize = Math.round(barH * 0.34);
  segs.forEach((s, i) => {
    const frac = s.raw / sum;
    const segW = frac * barW;
    const startX = cursorX;
    cursorX += segW;
    const color = segColors[i % segColors.length]!;
    const start = SEG_START + i * SEG_EACH;

    const segC = new Container();
    segC.position.set(startX, 0);
    segC.scale.set(0, 1);
    segC.addChild(new Graphics().rect(0, 0, Math.max(1, segW), barH).fill(color));
    segLayer.addChild(segC);
    timeline.to(segC, { prop: "scale.x", from: 0, to: 1, start, duration: SEG_DUR, ease: outExpo });

    // Inline % (drawn above the mask so it is always crisp).
    if (showInline) {
      const pctLabel = `${Math.round(pcts[i]!)}%`;
      const pctW = fonts.measure(pctLabel, { family: fonts.family("display"), weight: 700, size: inlineSize });
      if (segW > pctW * 1.35) {
        const inline = makeText(fonts, { text: pctLabel, role: "display", weight: 700, size: inlineSize, color: onSeg, anchor: 0.5 });
        inline.position.set(startX + segW / 2, barH / 2);
        inline.alpha = 0;
        barContainer.addChild(inline);
        timeline.to(inline, { prop: "alpha", from: 0, to: 1, start: start + SEG_DUR * 0.65, duration: 0.35, ease: outQuad });
      }
    }
  });

  // --- Legend below (dot + label + %) ---
  if (showLegend) {
    const legendTop = barTop + barH + minDim * 0.06;
    const rowH = Math.min(minDim * 0.075, (zone.y + zone.height - legendTop) / n);
    const dotR = Math.max(6, rowH * 0.24);
    const legendFont = Math.round(rowH * 0.42);
    const pctFont = Math.round(rowH * 0.44);
    // Center the legend block: dot + gap + widest label ... percent right-aligned.
    const labelGap = dotR + legendFont * 0.6;
    const pctColW = fonts.measure("100%", { family: fonts.family("display"), weight: 700, size: pctFont }) + legendFont * 0.4;
    const maxLabelW = zone.width * 0.6;
    let widestLabel = 0;
    const labelSizes = segs.map((s) => {
      const fs = fitSize(fonts, s.label, "body", 600, legendFont, maxLabelW);
      const lw = fonts.measure(s.label, { family: fonts.family("body"), weight: 600, size: fs });
      if (lw > widestLabel) widestLabel = lw;
      return fs;
    });
    const blockW = dotR * 2 + labelGap + widestLabel + legendFont * 0.6 + pctColW;
    const blockLeft = zone.x + Math.max(0, (zone.width - blockW) / 2);

    segs.forEach((s, i) => {
      const rowCY = legendTop + (i + 0.5) * rowH;
      const start = SEG_START + i * SEG_EACH + 0.1;

      const dot = new Graphics().roundRect(-dotR, -dotR, dotR * 2, dotR * 2, dotR * 0.4).fill(segColors[i % segColors.length]!);
      dot.position.set(blockLeft + dotR, rowCY);
      dot.scale.set(0);
      root.addChild(dot);
      timeline
        .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(1.8) })
        .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(1.8) });

      const labelX = blockLeft + dotR * 2 + labelGap;
      const label = makeText(fonts, { text: s.label, role: "body", weight: 600, size: labelSizes[i]!, color: textColor, anchor: { x: 0, y: 0.5 } });
      label.position.set(labelX, rowCY);
      label.alpha = 0;
      root.addChild(label);

      const pctText = makeText(fonts, { text: `${Math.round(pcts[i]!)}%`, role: "display", weight: 700, size: pctFont, color: textColor, anchor: { x: 1, y: 0.5 } });
      pctText.position.set(blockLeft + blockW, rowCY);
      pctText.alpha = 0;
      root.addChild(pctText);

      timeline
        .to(label, { prop: "alpha", from: 0, to: 1, start: start + 0.05, duration: 0.35, ease: outQuad })
        .to(label, { prop: "x", from: labelX - 10, to: labelX, start: start + 0.05, duration: 0.4, ease: outQuint })
        .to(pctText, { prop: "alpha", from: 0, to: 1, start: start + 0.1, duration: 0.35, ease: outQuad });
    });
  }

  return { timeline, duration: computeDuration(values) };
}

export const stackedBar: TemplateDefinition = {
  id: "stacked-bar",
  name: "Stacked Bar",
  tagline: "A 100% stacked bar fills segment by segment with a labeled legend.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", legend: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Browser market share", maxLength: 36, shrinkToFit: true },
    { key: "segments", type: "textlist", label: "Segments (label|percent)", default: DEFAULT_SEGMENTS, minItems: 2, maxItems: 4, maxLength: 24, help: 'One per line as "label|percent"; percents are normalized to 100.' },
    { key: "showLegend", type: "toggle", label: "Legend", default: true },
    { key: "showInline", type: "toggle", label: "Inline %", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

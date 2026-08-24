import { Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
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

/** Create text; if it would overflow `maxWidth`, re-make one size smaller (crisp). */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

// Segment fills stay fixed per palette (a small categorical set); only the
// background/text/accent triad is user-editable, matching the rest of the
// stat family. `accent` doubles as segment 1's color.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", seg2: "#2E7DF6", seg3: "#17A34A", seg4: "#7C5CFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", seg2: "#FF4D1C", seg3: "#17A34A", seg4: "#7C5CFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", seg2: "#38C7FF", seg3: "#FF8A5C", seg4: "#B389FF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", seg2: "#FF4D1C", seg3: "#17A34A", seg4: "#2E7DF6" } },
];

const DEFAULT_SEGMENTS = ["Organic:5400", "Paid:3200", "Referral:1800", "Social:1600"];

interface Segment {
  label: string;
  value: number;
}

function resolveSegments(values: Values): Segment[] {
  const raw = asList(values.segments, DEFAULT_SEGMENTS).slice(0, 4);
  const items = raw.length >= 3 ? raw : DEFAULT_SEGMENTS;
  return items.map((it) => {
    const idx = it.indexOf(":");
    const label = (idx >= 0 ? it.slice(0, idx) : it).trim();
    const valPart = idx >= 0 ? it.slice(idx + 1) : it;
    return { label: label.length ? label : it.trim(), value: Math.max(0, parseTargetNumber(valPart)) };
  });
}

const SEG_START = 0.5;
const SEG_EACH = 0.38;
const SEG_DUR = 0.6;
const HOLD = 1.15;
const GAP_RAD = 0.05;

function sweepSpan(n: number): number {
  return Math.max(0, n - 1) * SEG_EACH + SEG_DUR;
}

function computeDuration(values: Values): number {
  return SEG_START + sweepSpan(resolveSegments(values).length) + HOLD;
}

interface RingLayout {
  cx: number;
  cy: number;
  R: number;
  titleY: number;
  legendX: number;
  legendTop: number;
  legendW: number;
  rowH: number;
}

/** Ring left / legend right on 16:9 (short + wide); ring top / legend below elsewhere. */
function layoutFor(aspect: Aspect, w: number, h: number, n: number): RingLayout {
  const minDim = Math.min(w, h);
  if (aspect === "16:9") {
    const R = minDim * 0.28;
    const cy = h * 0.56;
    const rowH = minDim * 0.12;
    return {
      cx: w * 0.28,
      cy,
      R,
      titleY: h * 0.13,
      legendX: w * 0.56,
      legendTop: cy - (n * rowH) / 2,
      legendW: w * 0.4,
      rowH,
    };
  }
  let titleYF: number;
  let RF: number;
  let cyF: number;
  let rowHF: number;
  switch (aspect) {
    case "4:5":
      titleYF = 0.1;
      RF = 0.19;
      cyF = 0.3;
      rowHF = 0.065;
      break;
    case "9:16":
      titleYF = 0.15625;
      RF = 0.2;
      cyF = 0.3385;
      rowHF = 0.06;
      break;
    default:
      titleYF = 0.12;
      RF = 0.167;
      cyF = 0.352;
      rowHF = 0.063;
  }
  const R = minDim * RF;
  const cy = h * cyF;
  const rowH = minDim * rowHF;
  return {
    cx: w / 2,
    cy,
    R,
    titleY: h * titleYF,
    legendX: w / 2 - w * 0.32,
    legendTop: cy + R + minDim * 0.065,
    legendW: w * 0.64,
    rowH,
  };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const segColors = [accent, pc("seg2", "#2E7DF6"), pc("seg3", "#17A34A"), pc("seg4", "#7C5CFF")];

  const title = str(values.title, "");
  const centerLabel = str(values.centerLabel, "Total");
  const showLegend = values.showLegend !== false;
  const showAccentBar = values.accentBar !== false;

  const segs = resolveSegments(values);
  const n = segs.length;
  const sumValues = segs.reduce((a, b) => a + b.value, 0);
  const angleTotal = Math.max(1, sumValues);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const L = layoutFor(ctx.aspect, w, h, n);

  // --- Title + accent underline ---
  if (title.length > 0) {
    const titleSize = Math.round(minDim * 0.052);
    const titleText = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.8,
    );
    titleText.position.set(w / 2, L.titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "y", from: L.titleY - 14, to: L.titleY, start: 0, duration: 0.5, ease: outExpo });

    if (showAccentBar) {
      const ruleW = titleSize * 1.6;
      const ruleH = Math.max(3, titleSize * 0.09);
      const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
      rule.position.set(w / 2 - ruleW / 2, L.titleY + titleSize * 0.85);
      rule.scale.set(0, 1);
      root.addChild(rule);
      timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
    }
  }

  // --- Faint full track behind the sweeping segments ---
  const thickness = Math.max(10, L.R * 0.38);
  const track = new Graphics().circle(0, 0, L.R).stroke({ color: textColor, width: thickness, alpha: 0.08 });
  track.position.set(L.cx, L.cy);
  root.addChild(track);

  // --- Segment arcs: redrawn per frame since an arc's angle can't be tweened
  // as a plain numeric prop (same technique as progress-ring, extended to N). ---
  const ring = new Graphics();
  ring.position.set(L.cx, L.cy);
  root.addChild(ring);

  let cursor = -Math.PI / 2;
  const segGeo = segs.map((s, i) => {
    const rawSpan = (s.value / angleTotal) * Math.PI * 2;
    const a0 = cursor + GAP_RAD / 2;
    cursor += rawSpan;
    const span = Math.max(0, rawSpan - GAP_RAD);
    const start = SEG_START + i * SEG_EACH;
    const pct = Math.round((s.value / angleTotal) * 100);
    return { a0, span, start, pct, color: segColors[i % segColors.length]! };
  });

  // --- Center total, counts up alongside the sweep ---
  const numSize = Math.round(L.R * 0.46);
  const totalText = makeText(fonts, { text: "0", role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5, align: "center" });
  totalText.position.set(L.cx, L.cy - numSize * 0.1);
  totalText.alpha = 0;
  totalText.scale.set(0.85);
  root.addChild(totalText);
  timeline
    .to(totalText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(totalText, { prop: "scale.x", from: 0.85, to: 1, start: 0.15, duration: 0.5, ease: outQuint })
    .to(totalText, { prop: "scale.y", from: 0.85, to: 1, start: 0.15, duration: 0.5, ease: outQuint });

  const COUNT_START = SEG_START;
  const COUNT_DUR = sweepSpan(n);
  // Landing beat once the count + sweep finish together.
  timeline
    .to(totalText, { prop: "scale.x", from: 1, to: 1.08, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(totalText, { prop: "scale.x", from: 1.08, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.2, ease: outQuad })
    .to(totalText, { prop: "scale.y", from: 1, to: 1.08, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(totalText, { prop: "scale.y", from: 1.08, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.2, ease: outQuad });

  const capSize = Math.round(numSize * 0.24);
  const capText = makeText(fonts, { text: centerLabel, role: "body", weight: 600, size: capSize, color: textColor, anchor: 0.5, align: "center" });
  capText.position.set(L.cx, L.cy + numSize * 0.56);
  capText.alpha = 0;
  root.addChild(capText);
  timeline.to(capText, { prop: "alpha", from: 0, to: 1, start: 0.35, duration: 0.4, ease: outQuad });

  // --- Legend: swatch + label + final percent, staggered with each segment ---
  if (showLegend) {
    const legendFont = Math.round(minDim * (ctx.aspect === "16:9" ? 0.03 : 0.032));
    const pctFont = Math.round(legendFont * 0.96);
    segGeo.forEach((g, i) => {
      const seg = segs[i]!;
      const rowCY = L.legendTop + (i + 0.5) * L.rowH;
      const swatchR = Math.max(6, L.rowH * 0.2);
      const swatchX = L.legendX + swatchR;
      const start = g.start;

      const swatch = new Graphics().roundRect(-swatchR, -swatchR, swatchR * 2, swatchR * 2, swatchR * 0.4).fill(g.color);
      swatch.position.set(swatchX, rowCY);
      swatch.scale.set(0);
      root.addChild(swatch);
      timeline
        .to(swatch, { prop: "scale.x", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(1.8) })
        .to(swatch, { prop: "scale.y", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(1.8) });

      const labelX = swatchX + swatchR + legendFont * 0.5;
      const labelMaxW = Math.max(20, L.legendW - swatchR * 2 - legendFont * 0.5 - legendFont * 2.4);
      const labelText = fitText(
        fonts,
        { text: seg.label, role: "body", weight: 600, size: legendFont, color: textColor, anchor: { x: 0, y: 0.5 } },
        labelMaxW,
      );
      labelText.position.set(labelX, rowCY);
      labelText.alpha = 0;
      root.addChild(labelText);

      const pctText = makeText(fonts, { text: `${g.pct}%`, role: "display", weight: 700, size: pctFont, color: textColor, anchor: { x: 1, y: 0.5 } });
      pctText.position.set(L.legendX + L.legendW, rowCY);
      pctText.alpha = 0;
      root.addChild(pctText);

      timeline
        .to(labelText, { prop: "alpha", from: 0, to: 1, start: start + 0.05, duration: 0.35, ease: outQuad })
        .to(labelText, { prop: "x", from: labelX - 10, to: labelX, start: start + 0.05, duration: 0.4, ease: outQuint })
        .to(pctText, { prop: "alpha", from: 0, to: 1, start: start + 0.1, duration: 0.35, ease: outQuad });
    });
  }

  const update = (t: number): void => {
    ring.clear();
    for (const g of segGeo) {
      const p = outExpo(clamp01((t - g.start) / SEG_DUR));
      if (p <= 0.001 || g.span <= 0) continue;
      const a1 = g.a0 + p * g.span;
      ring.arc(0, 0, L.R, g.a0, a1).stroke({ color: g.color, width: thickness, cap: "round" });
    }
    const cp = outExpo(clamp01((t - COUNT_START) / COUNT_DUR));
    totalText.text = groupThousands(sumValues * cp);
  };

  return { timeline, duration: computeDuration(values), update };
}

export const donutChart: TemplateDefinition = {
  id: "donut-chart",
  name: "Donut Chart",
  tagline: "A ring chart sweeps in by segment as the total counts up.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.4,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", total: "display", legend: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Traffic sources", maxLength: 32, optional: true, shrinkToFit: true },
    { key: "segments", type: "textlist", label: "Segments (label:value)", default: DEFAULT_SEGMENTS, minItems: 3, maxItems: 4, maxLength: 24 },
    { key: "centerLabel", type: "text", label: "Center label", default: "Total", maxLength: 16 },
    { key: "showLegend", type: "toggle", label: "Legend", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

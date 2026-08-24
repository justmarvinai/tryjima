import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type Values,
  type TemplateDefinition,
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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const s = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const num = parseInt(s || "000000", 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}
function lerpColor(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bl = Math.round(ab + (bb - ab) * t);
  return "#" + [r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("");
}

// Cell fills lerp cellLow → accent by intensity (decorative, no text on them).
// background/textColor keep ≥ 4.5:1 for every label in every palette.
const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#2E7DF6", cellLow: "#EAF1FF" } },
  { id: "ember", name: "Ember", colors: { background: "#FFF7F0", textColor: "#3A1500", accent: "#F97316", cellLow: "#FFE8D6" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A", cellLow: "#DCF6E6" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", cellLow: "#22222B" } },
];

const DEFAULT_COLS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const DEFAULT_ROWS = ["Wk 1", "Wk 2", "Wk 3", "Wk 4"];

const CELL_START = 0.55;
const CELL_STAGGER = 0.06;
const CELL_DUR = 0.42;
const HOLD = 0.9;

function colsOf(values: Values): string[] {
  return asList(values.cols, DEFAULT_COLS).slice(0, 7);
}
function rowsOf(values: Values): string[] {
  return asList(values.rows, DEFAULT_ROWS).slice(0, 6);
}

function computeDuration(values: Values): number {
  const r = rowsOf(values).length;
  const c = colsOf(values).length;
  return CELL_START + (r - 1 + c - 1) * CELL_STAGGER + CELL_DUR + 0.3 + HOLD;
}

function titleFrac(aspect: Aspect): number {
  return aspect === "9:16" ? 0.13 : aspect === "16:9" ? 0.11 : 0.1;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));
  const cellLow = pc("cellLow", "#EAF1FF");

  const title = str(values.title, "Activity heatmap");
  const showLegend = values.showLegend !== false;
  const showAccentBar = values.accentBar !== false;

  const cols = colsOf(values);
  const rows = rowsOf(values);
  const C = cols.length;
  const R = rows.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const safe = safeRect(ctx.aspect);

  // --- Title (+ accent underline) ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), safe.width);
  const titleY = h * titleFrac(ctx.aspect);
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 14, to: titleY, start: 0, duration: 0.5, ease: outQuint });

  if (showAccentBar) {
    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(w / 2 - ruleW / 2, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
  }

  // --- Grid geometry ---
  const gridTopBound = titleY + titleSize * 0.9 + minDim * 0.04;
  const legendH = showLegend ? minDim * 0.11 : 0;
  const gridBottomBound = safe.y + safe.height - legendH;
  const rowLabelW = minDim * 0.11;
  const colLabelH = minDim * 0.05;
  const areaW = safe.width - rowLabelW;
  const areaH = gridBottomBound - gridTopBound - colLabelH;
  const cell = Math.max(minDim * 0.04, Math.min(areaW / C, areaH / R));
  const gridW = cell * C;
  const gridH = cell * R;
  const gridLeft = safe.x + rowLabelW + Math.max(0, (areaW - gridW) / 2);
  const gridTop = gridTopBound + colLabelH + Math.max(0, (areaH - gridH) / 2);
  const gap = Math.max(2, cell * 0.06);
  const cellFont = Math.round(cell * 0.34);

  // --- Column labels (top axis) ---
  cols.forEach((label, c) => {
    const cx = gridLeft + c * cell + cell / 2;
    const t = makeText(fonts, { text: label, role: "body", weight: 600, size: fitSize(fonts, label, "body", 600, cellFont, cell * 0.98), color: textColor, anchor: { x: 0.5, y: 1 } });
    t.position.set(cx, gridTop - gap);
    t.alpha = 0;
    root.addChild(t);
    timeline.to(t, { prop: "alpha", from: 0, to: 0.85, start: 0.4 + c * 0.04, duration: 0.35, ease: outQuad });
  });

  // --- Row labels (left axis) ---
  rows.forEach((label, r) => {
    const cy = gridTop + r * cell + cell / 2;
    const t = makeText(fonts, { text: label, role: "body", weight: 600, size: fitSize(fonts, label, "body", 600, cellFont, rowLabelW - gap), color: textColor, anchor: { x: 1, y: 0.5 } });
    t.position.set(gridLeft - gap * 1.5, cy);
    t.alpha = 0;
    root.addChild(t);
    timeline.to(t, { prop: "alpha", from: 0, to: 0.85, start: 0.4 + r * 0.04, duration: 0.35, ease: outQuad });
  });

  // --- Cells (seeded intensity, diagonal wave) ---
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      const intensity = Math.pow(rng.next(), 0.85); // bias toward mid/low, deterministic
      const color = lerpColor(cellLow, accent, intensity);
      const cx = gridLeft + c * cell + cell / 2;
      const cy = gridTop + r * cell + cell / 2;
      const s = cell - gap;
      const box = new Container();
      box.position.set(cx, cy);
      box.scale.set(0.6);
      box.alpha = 0;
      box.addChild(new Graphics().roundRect(-s / 2, -s / 2, s, s, s * 0.16).fill(color));
      root.addChild(box);
      const start = CELL_START + (r + c) * CELL_STAGGER;
      timeline
        .to(box, { prop: "alpha", from: 0, to: 1, start, duration: CELL_DUR, ease: outQuad })
        .to(box, { prop: "scale.x", from: 0.6, to: 1, start, duration: CELL_DUR, ease: makeOutBack(1.7) })
        .to(box, { prop: "scale.y", from: 0.6, to: 1, start, duration: CELL_DUR, ease: makeOutBack(1.7) });
    }
  }

  // --- Legend: low→high gradient bar with a numeric scale ---
  if (showLegend) {
    const legendW = Math.min(safe.width * 0.6, minDim * 0.52);
    const barH = Math.max(minDim * 0.022, cell * 0.28);
    const legendCX = w / 2;
    const legendY = gridBottomBound + legendH * 0.55;
    const legendLeft = legendCX - legendW / 2;
    const legend = new Container();
    legend.position.set(0, 0);
    legend.alpha = 0;
    root.addChild(legend);
    const SEG = 26;
    for (let i = 0; i < SEG; i++) {
      const t0 = i / SEG;
      const seg = new Graphics().rect(legendLeft + t0 * legendW, legendY - barH / 2, legendW / SEG + 1, barH).fill(lerpColor(cellLow, accent, t0));
      legend.addChild(seg);
    }
    legend.addChild(new Graphics().roundRect(legendLeft, legendY - barH / 2, legendW, barH, barH * 0.4).stroke({ color: textColor, width: Math.max(1, minDim * 0.002), alpha: 0.25 }));
    const legFont = Math.round(minDim * 0.026);
    const lowLbl = makeText(fonts, { text: "0", role: "body", weight: 600, size: legFont, color: textColor, anchor: { x: 1, y: 0.5 } });
    lowLbl.position.set(legendLeft - minDim * 0.014, legendY);
    lowLbl.alpha = 0.75;
    legend.addChild(lowLbl);
    const highLbl = makeText(fonts, { text: "100", role: "body", weight: 600, size: legFont, color: textColor, anchor: { x: 0, y: 0.5 } });
    highLbl.position.set(legendLeft + legendW + minDim * 0.014, legendY);
    highLbl.alpha = 0.75;
    legend.addChild(highLbl);
    const lastStart = CELL_START + (R - 1 + C - 1) * CELL_STAGGER + CELL_DUR;
    timeline.to(legend, { prop: "alpha", from: 0, to: 1, start: lastStart + 0.1, duration: 0.4, ease: outQuad });
  }

  return { timeline, duration: computeDuration(values) };
}

export const heatmap: TemplateDefinition = {
  id: "heatmap",
  name: "Heatmap",
  tagline: "A labeled grid fills cell by cell, warmer where the values run higher.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.4,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", cols: "body", rows: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Activity heatmap", maxLength: 30, optional: true, shrinkToFit: true },
    { key: "cols", type: "textlist", label: "Column labels", default: DEFAULT_COLS, minItems: 3, maxItems: 7, maxLength: 10 },
    { key: "rows", type: "textlist", label: "Row labels", default: DEFAULT_ROWS, minItems: 2, maxItems: 6, maxLength: 10 },
    { key: "showLegend", type: "toggle", label: "Legend", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "High color", default: "", optional: true },
  ],
  build,
};

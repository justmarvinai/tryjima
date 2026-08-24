import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  spring,
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
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

// `badgeColor`/`onAccent` are a fixed, pre-darkened palette-only pair (see
// growth-arrow / flowchart comments) so the "Recommended" pill's text clears
// 4.5:1; the raw `accent` stays reserved for the tint panel border and the
// check icon (a Graphics glyph, not text).
const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFFFFF", textColor: "#151016", accent: "#FF4D1C", badgeColor: "#C2380F", onAccent: "#FFFFFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", badgeColor: "#2A5AD6", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FAF5EA", accent: "#D8F34D", badgeColor: "#D8F34D", onAccent: "#101014" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", badgeColor: "#6D3BEA", onAccent: "#FFFFFF" } },
];

const DEFAULT_COLUMNS = ["Basic", "Pro", "Team"];
const DEFAULT_ROWS = [
  "Unlimited exports | yes | yes | yes",
  "Custom fonts | no | yes | yes",
  "Team seats | no | no | yes",
  "Priority support",
  "API access | no | no | yes",
];

interface Row {
  feature: string;
  filled: boolean[];
}

function truthy(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t === "yes" || t === "y" || t === "✓" || t === "✔" || t === "true" || t === "1" || t === "win";
}

function resolveColumns(values: Values): string[] {
  const raw = asList(values.columns, DEFAULT_COLUMNS).slice(0, 3);
  return raw.length >= 2 ? raw : DEFAULT_COLUMNS;
}

function recommendedIndex(nCols: number): number {
  return nCols >= 3 ? 1 : nCols - 1;
}

function resolveRows(values: Values, nCols: number): Row[] {
  const raw = asList(values.rows, DEFAULT_ROWS).slice(0, 6);
  const items = raw.length >= 3 ? raw : DEFAULT_ROWS;
  const recIdx = recommendedIndex(nCols);
  return items.map((it) => {
    const parts = it.split("|");
    const feature = (parts[0] ?? "").trim();
    if (parts.length >= 2) {
      const filled: boolean[] = [];
      for (let i = 0; i < nCols; i++) filled.push(truthy(parts[i + 1] ?? ""));
      return { feature: feature.length ? feature : it.trim(), filled };
    }
    const filled = new Array(nCols).fill(false) as boolean[];
    filled[recIdx] = true;
    return { feature: it.trim(), filled };
  });
}

const ROWSTART = 1.3;
const ROW_EACH = 0.34;
const COL_STAGGER = 0.07;
const CHIP_DUR = 0.5;
const HOLD = 1.1;

function computeDuration(values: Values): number {
  const nCols = resolveColumns(values).length;
  const rows = resolveRows(values, nCols);
  const lastStart = ROWSTART + (rows.length - 1) * ROW_EACH + (nCols - 1) * COL_STAGGER;
  return lastStart + CHIP_DUR + HOLD;
}

const CFG: Record<Aspect, { titleY: number; headerY: number; rowsTop: number; rowsBot: number }> = {
  "16:9": { titleY: 0.1, headerY: 0.24, rowsTop: 0.35, rowsBot: 0.92 },
  "1:1": { titleY: 0.1, headerY: 0.22, rowsTop: 0.32, rowsBot: 0.93 },
  "4:5": { titleY: 0.085, headerY: 0.19, rowsTop: 0.275, rowsBot: 0.94 },
  "9:16": { titleY: 0.135, headerY: 0.235, rowsTop: 0.29, rowsBot: 0.775 },
};

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#151016"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const badgeColor = pc("badgeColor", "#C2380F");
  const onAccent = pc("onAccent", "#FFFFFF");
  const title = str(values.title, "Compare plans");
  const showHighlight = values.showHighlight !== false;
  const showStripes = values.rowStripes !== false;

  const columns = resolveColumns(values);
  const nCols = columns.length;
  const recIdx = recommendedIndex(nCols);
  const rows = resolveRows(values, nCols);
  const nRows = rows.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const cfg = CFG[aspect];
  const marginX = w * 0.07;
  const totalInner = w - marginX * 2;
  const featureW = totalInner * 0.3;
  const dataW = totalInner - featureW;
  const colW = dataW / nCols;
  const colCX = (i: number): number => marginX + featureW + colW * (i + 0.5);

  const titleY = h * cfg.titleY;
  const headerY = h * cfg.headerY;
  const rowsTop = h * cfg.rowsTop;
  const rowsBot = h * cfg.rowsBot;
  const rowH = (rowsBot - rowsTop) / nRows;
  const rowCY = (i: number): number => rowsTop + (i + 0.5) * rowH;
  const Rchk = Math.min(rowH * 0.3, colW * 0.22, minDim * 0.052);

  // --- Title ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.054), totalInner);
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 14, to: titleY, start: 0, duration: 0.5, ease: outExpo });

  // --- Recommended-column highlight panel (tint, never a solid fill under
  // text, so the header/feature text underneath stays at full contrast) ---
  if (showHighlight) {
    const panelTop = headerY - rowH * 0.22;
    const panelX = marginX + featureW + colW * recIdx;
    const panel = new Graphics()
      .roundRect(panelX + colW * 0.04, panelTop, colW * 0.92, rowsBot - panelTop, colW * 0.06)
      .fill({ color: accent, alpha: 0.09 })
      .roundRect(panelX + colW * 0.04, panelTop, colW * 0.92, rowsBot - panelTop, colW * 0.06)
      .stroke({ color: accent, width: Math.max(1.5, minDim * 0.0032), alpha: 0.55 });
    panel.alpha = 0;
    root.addChild(panel);
    timeline.to(panel, { prop: "alpha", from: 0, to: 1, start: 0.35, duration: 0.45, ease: outQuad });

    const badgeFont = Math.max(9, Math.round(minDim * 0.024));
    const padX = badgeFont * 0.75;
    const padY = badgeFont * 0.45;
    const badgeText = fitText(fonts, { text: "Recommended", role: "body", weight: 700, size: badgeFont, color: onAccent, anchor: 0.5 }, colW * 0.86);
    const bw = badgeText.width + padX * 2;
    const bh = badgeText.height + padY * 2;
    const badge = new Container();
    badge.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2).fill(badgeColor));
    badge.addChild(badgeText);
    badge.position.set(marginX + featureW + colW * (recIdx + 0.5), panelTop - bh * 0.45);
    badge.scale.set(0);
    root.addChild(badge);
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: 0.55, duration: 0.5, ease: spring(0.5) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: 0.55, duration: 0.5, ease: spring(0.5) });
  }

  // --- Column headers ---
  const headFont = Math.round(minDim * 0.036);
  columns.forEach((colName, i) => {
    const t = fitText(fonts, { text: colName, role: "display", weight: 700, size: headFont, color: textColor, anchor: 0.5, align: "center" }, colW * 0.9);
    t.position.set(colCX(i), headerY);
    t.alpha = 0;
    root.addChild(t);
    const delay = 0.45 + i * 0.08;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: delay, duration: 0.4, ease: outQuad })
      .to(t, { prop: "y", from: headerY - 14, to: headerY, start: delay, duration: 0.5, ease: outExpo });
  });

  // --- Feature column label + per-column check/cross chips, row by row ---
  const featureFont = Math.max(10, Math.round(minDim * 0.034));
  const checkChip = (filled: boolean, cx: number, cy: number): Container => {
    const c = new Container();
    c.position.set(cx, cy);
    if (filled) {
      c.addChild(new Graphics().circle(0, 0, Rchk).fill(accent));
      c.addChild(makeIcon("check", Rchk * 1.25, { color: onAccent }));
    } else {
      c.addChild(new Graphics().circle(0, 0, Rchk).fill({ color: textColor, alpha: 0.08 }));
      const a = Rchk * 0.4;
      c.addChild(
        new Graphics()
          .moveTo(-a, -a)
          .lineTo(a, a)
          .moveTo(a, -a)
          .lineTo(-a, a)
          .stroke({ color: textColor, width: Math.max(2, Rchk * 0.16), alpha: 0.55, cap: "round" }),
      );
    }
    c.scale.set(0);
    return c;
  };

  rows.forEach((row, ri) => {
    const cy = rowCY(ri);
    const rowStart = ROWSTART + ri * ROW_EACH;

    if (showStripes && ri % 2 === 1) {
      const stripe = new Graphics().rect(marginX, cy - rowH * 0.42, totalInner, rowH * 0.84).fill({ color: textColor, alpha: 0.035 });
      stripe.alpha = 0;
      root.addChild(stripe);
      timeline.to(stripe, { prop: "alpha", from: 0, to: 1, start: rowStart - 0.1, duration: 0.4, ease: outQuad });
    }

    const feature = fitText(
      fonts,
      { text: row.feature, role: "body", weight: 600, size: featureFont, color: textColor, anchor: { x: 0, y: 0.5 } },
      featureW * 0.9,
    );
    feature.position.set(marginX, cy);
    feature.alpha = 0;
    root.addChild(feature);
    timeline
      .to(feature, { prop: "alpha", from: 0, to: 1, start: rowStart, duration: 0.4, ease: outQuad })
      .to(feature, { prop: "x", from: marginX - 14, to: marginX, start: rowStart, duration: 0.5, ease: outExpo });

    for (let ci = 0; ci < nCols; ci++) {
      const filled = row.filled[ci] ?? false;
      const chip = checkChip(filled, colCX(ci), cy);
      root.addChild(chip);
      const chipStart = rowStart + 0.08 + ci * COL_STAGGER;
      timeline
        .to(chip, { prop: "scale.x", from: 0, to: 1, start: chipStart, duration: CHIP_DUR, ease: makeOutBack(1.7) })
        .to(chip, { prop: "scale.y", from: 0, to: 1, start: chipStart, duration: CHIP_DUR, ease: makeOutBack(1.7) });
    }
  });

  return { timeline, duration: computeDuration(values) };
}

export const comparisonTable: TemplateDefinition = {
  id: "comparison-table",
  name: "Comparison Table",
  tagline: "A plan comparison table checks off feature by feature.",
  category: "comparison",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.8,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", header: "display", feature: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Compare plans", maxLength: 32, shrinkToFit: true },
    { key: "columns", type: "textlist", label: "Plans", default: DEFAULT_COLUMNS, minItems: 2, maxItems: 3, maxLength: 16 },
    {
      key: "rows",
      type: "textlist",
      label: "Features",
      default: DEFAULT_ROWS,
      minItems: 3,
      maxItems: 6,
      maxLength: 48,
      help: "A feature per row. Optionally \"feature | yes | no | yes\" (one yes/no per plan).",
    },
    { key: "showHighlight", type: "toggle", label: "Highlight recommended", default: true },
    { key: "rowStripes", type: "toggle", label: "Row stripes", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

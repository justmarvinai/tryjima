import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

// Model: each row is a feature. If written "feature | a | b", a/b decide the
// check/cross per column (yes/✓/true/1 → check). A bare feature means option A
// wins (✓) and option B loses (✕) — the "why us" positioning.
const DEFAULT_ROWS = ["Free forever", "No account", "No watermark", "Runs in your browser"];
const PER_ROW = 0.5;

interface Row {
  feature: string;
  aWin: boolean;
  bWin: boolean;
}

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFFFFF", textColor: "#151016", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4F1FF", textColor: "#241452", accent: "#7C5CFF", onAccent: "#FFFFFF" } },
  { id: "ocean", name: "Ocean", colors: { background: "#EEF4FF", textColor: "#0B1F4D", accent: "#2E7DF6", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FAF5EA", accent: "#D8F34D", onAccent: "#101014" } },
];

function truthy(s: string): boolean {
  const t = s.trim().toLowerCase();
  return t === "yes" || t === "y" || t === "✓" || t === "✔" || t === "true" || t === "1" || t === "win";
}

function resolveRows(values: Values): Row[] {
  const items = asList(values.rows, DEFAULT_ROWS).slice(0, 4);
  return items.map((it) => {
    const parts = it.split("|");
    if (parts.length >= 3) {
      const feature = (parts[0] ?? "").trim();
      return { feature: feature.length ? feature : it.trim(), aWin: truthy(parts[1] ?? ""), bWin: truthy(parts[2] ?? "") };
    }
    return { feature: it.trim(), aWin: true, bWin: false };
  });
}

function computeDuration(values: Values): number {
  return 1.2 + resolveRows(values).length * PER_ROW + 1.0;
}

const CFG: Record<Aspect, { titleY: number; headerY: number; vsY: number; rowsTop: number; rowsBot: number }> = {
  "16:9": { titleY: 0.1, headerY: 0.24, vsY: 0.33, rowsTop: 0.42, rowsBot: 0.92 },
  "1:1": { titleY: 0.1, headerY: 0.23, vsY: 0.31, rowsTop: 0.39, rowsBot: 0.92 },
  "4:5": { titleY: 0.09, headerY: 0.2, vsY: 0.28, rowsTop: 0.35, rowsBot: 0.93 },
  "9:16": { titleY: 0.145, headerY: 0.2, vsY: 0.27, rowsTop: 0.34, rowsBot: 0.776 },
};

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#151016"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const title = str(values.title, "Why Jima");
  const optionA = str(values.optionA, "Jima");
  const optionB = str(values.optionB, "The others");
  const rows = resolveRows(values);
  const n = rows.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  const cfg = CFG[aspect];
  const marginX = w * 0.075;
  const totalInner = w - marginX * 2;
  const featureW = totalInner * 0.46;
  const colW = totalInner * 0.27;
  const boundaryX = marginX + featureW + colW;
  const colACX = marginX + featureW + colW * 0.5;
  const colBCX = marginX + featureW + colW + colW * 0.5;

  const titleY = h * cfg.titleY;
  const headerY = h * cfg.headerY;
  const vsY = h * cfg.vsY;
  const rowsTop = h * cfg.rowsTop;
  const rowsBot = h * cfg.rowsBot;
  const rowH = (rowsBot - rowsTop) / n;
  const rowCY = (i: number): number => rowsTop + (i + 0.5) * rowH;
  const Rchk = Math.min(rowH * 0.3, colW * 0.34, minDim * 0.062);

  // --- Title ---
  const titleSize = Math.round(minDim * 0.056);
  const titleText = fitText(
    fonts,
    { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } },
    totalInner,
  );
  titleText.position.set(marginX, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: marginX - 16, to: marginX, start: 0.0, duration: 0.55, ease: outExpo });

  // --- Column divider (behind the VS badge) ---
  const showDivider = values.divider !== false;
  if (showDivider) {
    const divTh = Math.max(2, minDim * 0.004);
    const divTop = headerY + titleSize * 0.6;
    const div = new Graphics().roundRect(-divTh / 2, divTop, divTh, rowsBot - divTop, divTh / 2).fill({ color: textColor, alpha: 0.1 });
    div.position.set(boundaryX, 0);
    div.alpha = 0;
    root.addChild(div);
    timeline.to(div, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.5, ease: outQuad });
  }

  // --- Column headers ---
  const headFont = Math.round(minDim * 0.038);
  const mkHeader = (text: string, cx: number, delay: number): void => {
    const t = fitText(fonts, { text, role: "display", weight: 700, size: headFont, color: textColor, anchor: 0.5, align: "center" }, colW * 0.92);
    t.position.set(cx, headerY);
    t.alpha = 0;
    root.addChild(t);
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: delay, duration: 0.4, ease: outQuad })
      .to(t, { prop: "y", from: headerY - 14, to: headerY, start: delay, duration: 0.5, ease: outExpo });
  };
  mkHeader(optionA, colACX, 0.4);
  mkHeader(optionB, colBCX, 0.5);

  // --- VS badge ---
  const Rvs = minDim * 0.062;
  const vsBadge = new Container();
  vsBadge.position.set(boundaryX, vsY);
  vsBadge.addChild(new Graphics().circle(0, 0, Rvs).fill(textColor).stroke({ color: bg, width: Math.max(2, Rvs * 0.1) }));
  vsBadge.addChild(makeText(fonts, { text: "VS", role: "display", weight: 700, size: Math.round(Rvs * 0.82), color: bg, anchor: 0.5, letterSpacing: 1 }));
  vsBadge.scale.set(0);
  vsBadge.rotation = -12 * DEG;
  root.addChild(vsBadge);
  timeline
    .to(vsBadge, { prop: "scale.x", from: 0, to: 1, start: 0.85, duration: 0.55, ease: spring(0.45) })
    .to(vsBadge, { prop: "scale.y", from: 0, to: 1, start: 0.85, duration: 0.55, ease: spring(0.45) })
    .to(vsBadge, { prop: "rotation", from: -12 * DEG, to: 0, start: 0.85, duration: 0.5, ease: makeOutBack(2) });

  // --- Rows ---
  const featureFont = Math.round(minDim * 0.04);

  const checkChip = (win: boolean, cx: number, cy: number): Container => {
    const c = new Container();
    c.position.set(cx, cy);
    if (win) {
      c.addChild(new Graphics().circle(0, 0, Rchk).fill(accent));
      c.addChild(makeIcon("check", Rchk * 1.25, { color: onAccent }));
      c.alpha = 1;
    } else {
      c.addChild(new Graphics().circle(0, 0, Rchk).fill({ color: textColor, alpha: 0.09 }));
      const a = Rchk * 0.4;
      c.addChild(
        new Graphics()
          .moveTo(-a, -a)
          .lineTo(a, a)
          .moveTo(a, -a)
          .lineTo(-a, a)
          .stroke({ color: textColor, width: Math.max(2, Rchk * 0.16), cap: "round" }),
      );
      c.alpha = 0.55;
    }
    c.scale.set(0);
    return c;
  };

  const showRowTrack = values.rowTrack !== false;
  rows.forEach((rowData, i) => {
    const cy = rowCY(i);
    const start = 1.2 + i * PER_ROW;

    // Faint row track for a table feel.
    if (showRowTrack) {
      const track = new Graphics()
        .roundRect(marginX, cy - rowH * 0.42, totalInner, rowH * 0.84, rowH * 0.16)
        .fill({ color: textColor, alpha: 0.05 });
      track.alpha = 0;
      root.addChild(track);
      timeline.to(track, { prop: "alpha", from: 0, to: 1, start: start - 0.1, duration: 0.4, ease: outQuad });
    }

    const feature = fitText(
      fonts,
      { text: rowData.feature, role: "body", weight: 600, size: featureFont, color: textColor, anchor: { x: 0, y: 0.5 } },
      featureW * 0.96,
    );
    feature.position.set(marginX, cy);
    feature.alpha = 0;
    root.addChild(feature);
    timeline
      .to(feature, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(feature, { prop: "x", from: marginX - 14, to: marginX, start, duration: 0.5, ease: outExpo });

    const aChip = checkChip(rowData.aWin, colACX, cy);
    const bChip = checkChip(rowData.bWin, colBCX, cy);
    root.addChild(aChip, bChip);
    timeline
      .to(aChip, { prop: "scale.x", from: 0, to: 1, start: start + 0.08, duration: 0.5, ease: spring(0.5) })
      .to(aChip, { prop: "scale.y", from: 0, to: 1, start: start + 0.08, duration: 0.5, ease: spring(0.5) })
      .to(bChip, { prop: "scale.x", from: 0, to: 1, start: start + 0.18, duration: 0.5, ease: spring(0.5) })
      .to(bChip, { prop: "scale.y", from: 0, to: 1, start: start + 0.18, duration: 0.5, ease: spring(0.5) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const comparisonVs: TemplateDefinition = {
  id: "comparison-vs",
  name: "Comparison VS",
  tagline: "A this-vs-that table checks off row by row.",
  category: "comparison",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.0,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Why Jima", maxLength: 36, shrinkToFit: true },
    { key: "optionA", type: "text", label: "Option A", default: "Jima", maxLength: 16 },
    { key: "optionB", type: "text", label: "Option B", default: "The others", maxLength: 16 },
    { key: "rows", type: "textlist", label: "Rows", default: DEFAULT_ROWS, minItems: 2, maxItems: 4, maxLength: 28, help: "A feature per row. Optionally \"feature | yes | no\" to set each column." },
    { key: "divider", type: "toggle", label: "Divider line", default: true },
    { key: "rowTrack", type: "toggle", label: "Row background", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outExpo,
  outQuad,
  safeZone,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { ICON_NAMES, makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const clampInt = (n: number, lo: number, hi: number): number => (n < lo ? lo : n > hi ? hi : Math.round(n));

const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#FFFFFF", cellColor: "#F5F6F8", accent: "#FF4D1C", textColor: "#101014" } },
  { id: "porcelain", name: "Porcelain", colors: { background: "#F1F4F9", cellColor: "#FFFFFF", accent: "#2E5BD6", textColor: "#16233A" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#101014", cellColor: "#1E1D24", accent: "#C7F24A", textColor: "#FFFFFF" } },
  { id: "sunrise", name: "Sunrise", colors: { background: "#FFF8EE", cellColor: "#FFFFFF", accent: "#F5A623", textColor: "#2A2016" } },
];

/** Rows per aspect/column-count so the grid never gets too sparse or crowded. */
function rowsFor(aspect: Aspect, cols: number): number {
  const vertical = aspect === "4:5" || aspect === "9:16";
  if (!vertical) return 2;
  return cols >= 4 ? 2 : 3;
}

/** Largest size ≤ size0 at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(14, Math.floor((size * maxWidth) / w)) : size;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const cellColor = str(values.cellColor, pc("cellColor", "#F5F6F8"));
  const textColor = pc("textColor", "#101014");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));

  const title = str(values.title, "Trusted by teams everywhere");
  const cols = clampInt(num(values.cols, 3), 2, 4);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const aspect = ctx.aspect;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeZone(aspect);
  const contentLeft = zone.left;
  const contentRight = w - zone.right;
  const contentW = contentRight - contentLeft;
  const cx = w / 2;

  // --- Title + accent rule ---
  const horizontal = aspect === "16:9" || aspect === "1:1";
  const titleSize0 = Math.round(minDim * (horizontal ? 0.05 : 0.058));
  const titleSize = fitSize(fonts, title, "display", 700, titleSize0, contentW * 0.92);
  const titleY = zone.top + titleSize * 0.9;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 16, to: titleY, start: 0, duration: 0.55, ease: outExpo });

  const ruleW = Math.min(contentW * 0.4, titleSize * 2.4);
  const rule = new Graphics().roundRect(-ruleW / 2, -1.5, ruleW, Math.max(3, titleSize * 0.07), 2).fill(accent);
  rule.position.set(cx, titleY + titleSize * 0.85);
  rule.scale.set(0, 1);
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.28, duration: 0.4, ease: outExpo });

  // --- Cell grid ---
  const rows = rowsFor(aspect, cols);
  const n = cols * rows;
  const gridTop = titleY + titleSize * 1.5;
  const gridBottom = h - zone.bottom;
  const gridH = gridBottom - gridTop;
  const cellW = contentW / cols;
  const cellH = gridH / rows;
  const cellBoxW = cellW * 0.84;
  const cellBoxH = cellH * 0.78;
  const cellR = Math.min(cellBoxW, cellBoxH) * 0.16;
  const markSize = Math.min(cellBoxW, cellBoxH) * 0.36;

  const START0 = 0.7;
  const STAG = Math.min(0.12, 2.4 / Math.max(1, n));

  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const cellCX = contentLeft + cellW * (col + 0.5);
    const cellCY = gridTop + cellH * (row + 0.5);

    const cell = new Container();
    cell.position.set(cellCX, cellCY);
    cell.alpha = 0;
    cell.scale.set(0.7);
    root.addChild(cell);

    cell.addChild(
      new Graphics()
        .roundRect(-cellBoxW / 2, -cellBoxH / 2, cellBoxW, cellBoxH, cellR)
        .fill(cellColor)
        .roundRect(-cellBoxW / 2, -cellBoxH / 2, cellBoxW, cellBoxH, cellR)
        .stroke({ color: textColor, width: 1, alpha: 0.08 }),
    );

    const markName = ICON_NAMES[rng.int(0, ICON_NAMES.length - 1)] ?? "bolt";
    const mark = makeIcon(markName, markSize, { color: textColor, holeColor: cellColor });
    mark.alpha = 0.4;
    cell.addChild(mark);

    const start = START0 + i * STAG;
    timeline
      .to(cell, { prop: "alpha", from: 0, to: 1, start, duration: 0.32, ease: outQuad })
      .to(cell, { prop: "scale.x", from: 0.7, to: 1, start, duration: 0.5, ease: makeOutBack(1.8) })
      .to(cell, { prop: "scale.y", from: 0.7, to: 1, start, duration: 0.5, ease: makeOutBack(1.8) });
  }

  return { timeline, duration: 4.2 };
}

export const logoGridReveal: TemplateDefinition = {
  id: "logo-grid-reveal",
  name: "Logo Grid",
  tagline: "A trusted-by grid of logo placeholders pops in row by row.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.2,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Trusted by teams everywhere", maxLength: 44, shrinkToFit: true },
    { key: "cols", type: "slider", label: "Columns", default: 3, min: 2, max: 4, step: 1 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "cellColor", type: "color", label: "Cell", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

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
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

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

// Quadrant tints are painted with accent/textColor at very low alpha, so item
// labels stay textColor-on-background at ≥ 4.5:1 across every palette.
const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#2E7DF6" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF3FF", textColor: "#0B2447", accent: "#2E7DF6" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D" } },
];

interface Item {
  label: string;
  x: number;
  y: number;
}

const DEFAULT_ITEMS = ["SEO|72|60", "Ads|45|82", "Email|65|30", "Events|30|38", "Referral|85|72"];
const DEFAULT_QUADS = ["Quick wins", "Big bets", "Fill-ins", "Time sinks"];

function parseItem(raw: string, fallback: string): Item {
  const parts = raw.split("|");
  const label = (parts[0] ?? "").trim();
  const x = clamp(Number((parts[1] ?? "").replace(/[^\d.-]/g, "")) || 50, 0, 100);
  const y = clamp(Number((parts[2] ?? "").replace(/[^\d.-]/g, "")) || 50, 0, 100);
  return { label: label.length ? label : fallback, x, y };
}

function itemsOf(values: Values): Item[] {
  return asList(values.items, DEFAULT_ITEMS).slice(0, 7).map((r, i) => parseItem(r, `Item ${i + 1}`));
}

const AXES_START = 0.45;
const LABELS_START = 0.7;
const DOT_START = 1.0;
const DOT_EACH = 0.13;
const DOT_DUR = 0.45;
const HOLD = 0.9;

function computeDuration(values: Values): number {
  const n = itemsOf(values).length;
  return DOT_START + (n - 1) * DOT_EACH + DOT_DUR + HOLD;
}

function titleFrac(aspect: Aspect): number {
  return aspect === "9:16" ? 0.12 : aspect === "16:9" ? 0.1 : 0.09;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));

  const title = str(values.title, "Prioritization matrix");
  const xLabel = str(values.xLabel, "Effort");
  const yLabel = str(values.yLabel, "Impact");
  const quads = asList(values.quadrantLabels, DEFAULT_QUADS).slice(0, 4);
  const items = itemsOf(values);
  const showTints = values.showTints !== false;
  const showQuadLabels = values.showQuadrantLabels !== false;
  const showAccentBar = values.accentBar !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const safe = safeRect(ctx.aspect);

  // --- Title (+ accent underline) ---
  const hasTitle = title.length > 0;
  const titleSize = hasTitle ? fitSize(fonts, title, "display", 700, Math.round(minDim * 0.048), safe.width) : 0;
  const titleY = h * titleFrac(ctx.aspect);
  let titleBottom = safe.y;
  if (hasTitle) {
    const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
    titleText.position.set(w / 2, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "y", from: titleY - 12, to: titleY, start: 0, duration: 0.5, ease: outQuint });
    titleBottom = titleY + titleSize * 0.7;
    if (showAccentBar) {
      const ruleW = titleSize * 1.5;
      const ruleH = Math.max(3, titleSize * 0.09);
      const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
      rule.position.set(w / 2 - ruleW / 2, titleY + titleSize * 0.72);
      rule.scale.set(0, 1);
      root.addChild(rule);
      timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
      titleBottom = titleY + titleSize * 0.9;
    }
  }

  // --- Plot geometry (square) ---
  const axisLabelSize = Math.round(minDim * 0.028);
  const yGutter = axisLabelSize + minDim * 0.03;
  const xGutter = axisLabelSize + minDim * 0.03;
  const availTop = titleBottom + minDim * 0.03;
  const availBottom = safe.y + safe.height;
  const availH = availBottom - availTop - xGutter;
  const availW = safe.width - yGutter;
  const plotSize = Math.max(minDim * 0.3, Math.min(availW, availH));
  const plotLeft = safe.x + yGutter + Math.max(0, (availW - plotSize) / 2);
  const plotTop = availTop + Math.max(0, (availH - plotSize) / 2);
  const plotRight = plotLeft + plotSize;
  const plotBottom = plotTop + plotSize;
  const plotCX = plotLeft + plotSize / 2;
  const plotCY = plotTop + plotSize / 2;
  const pad = plotSize * 0.045;

  // --- Quadrant tints (TR emphasized as the sweet spot) ---
  if (showTints) {
    const halfS = plotSize / 2;
    const tints: { x: number; y: number; color: string; alpha: number }[] = [
      { x: plotLeft, y: plotTop, color: textColor, alpha: 0.05 }, // TL
      { x: plotCX, y: plotTop, color: accent, alpha: 0.12 }, // TR
      { x: plotLeft, y: plotCY, color: textColor, alpha: 0.02 }, // BL
      { x: plotCX, y: plotCY, color: textColor, alpha: 0.05 }, // BR
    ];
    tints.forEach((t, i) => {
      const rectG = new Graphics().rect(t.x, t.y, halfS, halfS).fill({ color: t.color, alpha: t.alpha });
      rectG.alpha = 0;
      root.addChild(rectG);
      timeline.to(rectG, { prop: "alpha", from: 0, to: 1, start: 0.35 + i * 0.04, duration: 0.4, ease: outQuad });
    });
  }

  // Frame.
  const frame = new Graphics().roundRect(plotLeft, plotTop, plotSize, plotSize, minDim * 0.01).stroke({ color: textColor, width: Math.max(1.5, minDim * 0.003), alpha: 0.3 });
  frame.alpha = 0;
  root.addChild(frame);
  timeline.to(frame, { prop: "alpha", from: 0, to: 1, start: 0.38, duration: 0.4, ease: outQuad });

  // --- Cross axes (draw from center) ---
  const axisThick = Math.max(2.5, minDim * 0.005);
  const vAxis = new Container();
  vAxis.position.set(plotCX, plotCY);
  vAxis.scale.set(1, 0);
  vAxis.addChild(new Graphics().rect(-axisThick / 2, -plotSize / 2, axisThick, plotSize).fill({ color: textColor, alpha: 0.55 }));
  root.addChild(vAxis);
  timeline.to(vAxis, { prop: "scale.y", from: 0, to: 1, start: AXES_START, duration: 0.5, ease: outExpo });

  const hAxis = new Container();
  hAxis.position.set(plotCX, plotCY);
  hAxis.scale.set(0, 1);
  hAxis.addChild(new Graphics().rect(-plotSize / 2, -axisThick / 2, plotSize, axisThick).fill({ color: textColor, alpha: 0.55 }));
  root.addChild(hAxis);
  timeline.to(hAxis, { prop: "scale.x", from: 0, to: 1, start: AXES_START, duration: 0.5, ease: outExpo });

  // --- Axis labels + Low/High markers ---
  const fadeIn = (node: Container, start: number, to = 1): void => {
    node.alpha = 0;
    root.addChild(node);
    timeline.to(node, { prop: "alpha", from: 0, to, start, duration: 0.4, ease: outQuad });
  };
  const xText = makeText(fonts, { text: xLabel, role: "body", weight: 700, size: fitSize(fonts, xLabel, "body", 700, axisLabelSize * 1.1, plotSize), color: textColor, anchor: { x: 0.5, y: 0 } });
  xText.position.set(plotCX, plotBottom + xGutter * 0.32);
  fadeIn(xText, LABELS_START);

  const yText = makeText(fonts, { text: yLabel, role: "body", weight: 700, size: fitSize(fonts, yLabel, "body", 700, axisLabelSize * 1.1, plotSize), color: textColor, anchor: { x: 0.5, y: 1 } });
  yText.rotation = -Math.PI / 2;
  yText.position.set(safe.x + axisLabelSize * 0.7, plotCY);
  fadeIn(yText, LABELS_START);

  const endFont = Math.round(axisLabelSize * 0.82);
  const mk = (t: string, ax: number, ay: number): Container => makeText(fonts, { text: t, role: "body", weight: 600, size: endFont, color: textColor, anchor: { x: ax, y: ay } });
  const loX = mk("Low", 0, 0);
  loX.position.set(plotLeft, plotBottom + xGutter * 0.32);
  fadeIn(loX, LABELS_START + 0.1, 0.6);
  const hiX = mk("High", 1, 0);
  hiX.position.set(plotRight, plotBottom + xGutter * 0.32);
  fadeIn(hiX, LABELS_START + 0.1, 0.6);

  // --- Quadrant labels (outer corners) ---
  if (showQuadLabels) {
    const qFont = Math.round(minDim * 0.026);
    const qMaxW = plotSize / 2 - pad * 2;
    const defs: { text: string; x: number; y: number; ax: number; ay: number }[] = [
      { text: quads[0] ?? DEFAULT_QUADS[0]!, x: plotLeft + pad, y: plotTop + pad, ax: 0, ay: 0 },
      { text: quads[1] ?? DEFAULT_QUADS[1]!, x: plotRight - pad, y: plotTop + pad, ax: 1, ay: 0 },
      { text: quads[2] ?? DEFAULT_QUADS[2]!, x: plotLeft + pad, y: plotBottom - pad, ax: 0, ay: 1 },
      { text: quads[3] ?? DEFAULT_QUADS[3]!, x: plotRight - pad, y: plotBottom - pad, ax: 1, ay: 1 },
    ];
    defs.forEach((d, i) => {
      const t = makeText(fonts, { text: d.text, role: "display", weight: 700, size: fitSize(fonts, d.text, "display", 700, qFont, qMaxW), color: textColor, anchor: { x: d.ax, y: d.ay } });
      t.alpha = 0;
      root.addChild(t);
      t.position.set(d.x, d.y);
      timeline.to(t, { prop: "alpha", from: 0, to: 0.5, start: LABELS_START + 0.15 + i * 0.05, duration: 0.4, ease: outQuad });
    });
  }

  // --- Item dots ---
  const dotR = Math.max(minDim * 0.014, plotSize * 0.02);
  const itemFont = Math.round(minDim * 0.028);
  items.forEach((it, i) => {
    const px = plotLeft + (it.x / 100) * plotSize;
    const py = plotBottom - (it.y / 100) * plotSize;
    const start = DOT_START + i * DOT_EACH;

    const g = new Container();
    g.position.set(px, py);
    g.scale.set(0);
    root.addChild(g);
    g.addChild(new Graphics().circle(0, 0, dotR).fill({ color: "#000000", alpha: 0.12 }));
    g.addChild(new Graphics().circle(0, -dotR * 0.06, dotR).fill(accent));
    g.addChild(new Graphics().circle(0, -dotR * 0.06, dotR).stroke({ color: bg, width: Math.max(1.5, dotR * 0.14) }));
    timeline
      .to(g, { prop: "scale.x", from: 0, to: 1, start, duration: DOT_DUR, ease: makeOutBack(2) })
      .to(g, { prop: "scale.y", from: 0, to: 1, start, duration: DOT_DUR, ease: makeOutBack(2) });

    // Label: right of dot, or left if too close to the right edge.
    const rightRoom = plotRight - (px + dotR);
    const placeLeft = rightRoom < plotSize * 0.22;
    const lblMaxW = placeLeft ? px - dotR - plotLeft : plotRight - (px + dotR);
    const lSize = fitSize(fonts, it.label, "display", 700, itemFont, Math.max(minDim * 0.05, lblMaxW - pad));
    const lbl = makeText(fonts, { text: it.label, role: "display", weight: 700, size: lSize, color: textColor, anchor: { x: placeLeft ? 1 : 0, y: 0.5 } });
    lbl.position.set(px + (placeLeft ? -1 : 1) * (dotR + minDim * 0.012), py);
    lbl.alpha = 0;
    root.addChild(lbl);
    timeline.to(lbl, { prop: "alpha", from: 0, to: 1, start: start + 0.12, duration: 0.35, ease: outQuad });
  });

  return { timeline, duration: computeDuration(values) };
}

export const quadrant: TemplateDefinition = {
  id: "quadrant",
  name: "Quadrant",
  tagline: "Axes cross, then items plot into a 2x2 effort-vs-impact matrix.",
  category: "comparison",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.5,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", xLabel: "body", yLabel: "body", items: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Prioritization matrix", maxLength: 30, optional: true, shrinkToFit: true },
    { key: "xLabel", type: "text", label: "X axis", default: "Effort", maxLength: 18, shrinkToFit: true },
    { key: "yLabel", type: "text", label: "Y axis", default: "Impact", maxLength: 18, shrinkToFit: true },
    {
      key: "items",
      type: "textlist",
      label: "Items (label | x | y)",
      default: DEFAULT_ITEMS,
      minItems: 2,
      maxItems: 7,
      maxLength: 24,
      help: 'One per line as "label | x | y", x and y are 0-100.',
    },
    {
      key: "quadrantLabels",
      type: "textlist",
      label: "Quadrant labels",
      default: DEFAULT_QUADS,
      minItems: 4,
      maxItems: 4,
      maxLength: 18,
      help: "Order: top-left, top-right, bottom-left, bottom-right.",
    },
    { key: "showTints", type: "toggle", label: "Quadrant tints", default: true },
    { key: "showQuadrantLabels", type: "toggle", label: "Quadrant labels", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

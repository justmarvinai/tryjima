import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  safeRect,
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

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#2E7DF6" } },
  { id: "iris", name: "Iris", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#5B4DFF" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D" } },
];

interface Axis {
  label: string;
  value: number;
}

const DEFAULT_AXES = ["Speed|80", "Power|65", "Range|70", "Handling|90", "Comfort|55", "Tech|75"];

function parseAxis(raw: string, fallback: string): Axis {
  const idx = raw.indexOf("|");
  const label = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const valPart = (idx >= 0 ? raw.slice(idx + 1) : "0").trim();
  const num = Number(valPart.replace(/[^\d.-]/g, ""));
  const value = Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : 0;
  return { label: label.length ? label : fallback, value };
}

function axesOf(values: Values): Axis[] {
  return asList(values.axes, DEFAULT_AXES)
    .slice(0, 8)
    .map((r, i) => parseAxis(r, `Axis ${i + 1}`));
}

const GRID_START = 0.35;
const POLY_START = 1.0;
const POLY_DUR = 0.75;
const HOLD = 1.1;
const DURATION = POLY_START + POLY_DUR + HOLD;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));

  const title = str(values.title, "Performance profile");
  const showRings = values.showRings !== false;
  const showValues = values.showValues !== false;
  const showAccentBar = values.accentBar !== false;

  const axes = axesOf(values);
  const N = axes.length;

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
  const titleSize = hasTitle ? fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), safe.width) : 0;
  const titleY = h * (ctx.aspect === "9:16" ? 0.135 : ctx.aspect === "16:9" ? 0.11 : 0.1);
  let titleBottom = safe.y;
  if (hasTitle) {
    const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
    titleText.position.set(w / 2, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "y", from: titleY - 14, to: titleY, start: 0, duration: 0.5, ease: outQuint });
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

  // --- Chart geometry ---
  const chartTop = titleBottom + minDim * 0.03;
  const chartBottom = safe.y + safe.height;
  const cx = w / 2;
  const cy = (chartTop + chartBottom) / 2;
  const labelPad = minDim * 0.085;
  const half = Math.min(safe.width, chartBottom - chartTop) / 2;
  const maxR = Math.max(minDim * 0.15, half - labelPad);

  const dir = (i: number): { x: number; y: number } => {
    const a = -Math.PI / 2 + (i / N) * Math.PI * 2;
    return { x: Math.cos(a), y: Math.sin(a) };
  };

  // --- Grid: concentric polygon rings + spokes ---
  const gridThick = Math.max(1.5, minDim * 0.003);
  if (showRings) {
    const levels = [0.25, 0.5, 0.75, 1];
    levels.forEach((lv, li) => {
      const pts: number[] = [];
      for (let i = 0; i < N; i++) {
        const d = dir(i);
        pts.push(cx + d.x * maxR * lv, cy + d.y * maxR * lv);
      }
      const ring = new Graphics().poly(pts, true).stroke({ color: textColor, width: gridThick, alpha: lv === 1 ? 0.28 : 0.14 });
      ring.alpha = 0;
      root.addChild(ring);
      timeline.to(ring, { prop: "alpha", from: 0, to: 1, start: GRID_START + li * 0.06, duration: 0.4, ease: outQuad });
    });
  }
  // Spokes.
  for (let i = 0; i < N; i++) {
    const d = dir(i);
    const spoke = new Graphics().moveTo(cx, cy).lineTo(cx + d.x * maxR, cy + d.y * maxR).stroke({ color: textColor, width: gridThick, alpha: 0.2 });
    spoke.alpha = 0;
    root.addChild(spoke);
    timeline.to(spoke, { prop: "alpha", from: 0, to: 1, start: GRID_START + 0.1 + i * 0.03, duration: 0.4, ease: outQuad });
  }

  // --- Axis labels ---
  const labelFont0 = Math.round(minDim * 0.03);
  axes.forEach((ax, i) => {
    const d = dir(i);
    const lx = cx + d.x * (maxR + labelPad * 0.55);
    const ly = cy + d.y * (maxR + labelPad * 0.55);
    const anchorX = d.x > 0.35 ? 0 : d.x < -0.35 ? 1 : 0.5;
    const anchorY = d.y > 0.35 ? 0 : d.y < -0.35 ? 1 : 0.5;
    const lblSize = fitSize(fonts, ax.label, "body", 600, labelFont0, minDim * 0.24);
    const lbl = makeText(fonts, { text: ax.label, role: "body", weight: 600, size: lblSize, color: textColor, anchor: { x: anchorX, y: anchorY } });
    lbl.position.set(lx, ly);
    lbl.alpha = 0;
    root.addChild(lbl);
    timeline.to(lbl, { prop: "alpha", from: 0, to: 0.9, start: GRID_START + 0.3 + i * 0.04, duration: 0.4, ease: outQuad });
  });

  // --- Value polygon (expands from center) ---
  const poly = new Container();
  poly.position.set(cx, cy);
  poly.scale.set(0);
  root.addChild(poly);

  const vpts: number[] = [];
  for (let i = 0; i < N; i++) {
    const d = dir(i);
    const r = (axes[i]?.value ?? 0) / 100 * maxR;
    vpts.push(d.x * r, d.y * r);
  }
  poly.addChild(new Graphics().poly(vpts, true).fill({ color: accent, alpha: 0.28 }));
  poly.addChild(new Graphics().poly(vpts, true).stroke({ color: accent, width: Math.max(3, minDim * 0.008), join: "round" }));

  const dotR = Math.max(4, minDim * 0.009);
  for (let i = 0; i < N; i++) {
    const px = vpts[i * 2] ?? 0;
    const py = vpts[i * 2 + 1] ?? 0;
    poly.addChild(new Graphics().circle(px, py, dotR).fill(accent));

    if (showValues) {
      const val = axes[i]?.value ?? 0;
      const vChip = new Container();
      const vTxt = makeText(fonts, { text: String(val), role: "display", weight: 700, size: Math.round(minDim * 0.026), color: textColor, anchor: 0.5 });
      const cw = vTxt.width + minDim * 0.02;
      const ch = vTxt.height + minDim * 0.008;
      vChip.addChild(new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, ch / 2).fill(bg));
      vChip.addChild(new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, ch / 2).stroke({ color: accent, width: Math.max(1.5, minDim * 0.0025) }));
      vChip.addChild(vTxt);
      const d = dir(i);
      vChip.position.set(px + d.x * (dotR + minDim * 0.02), py + d.y * (dotR + minDim * 0.012));
      poly.addChild(vChip);
    }
  }

  timeline
    .to(poly, { prop: "scale.x", from: 0, to: 1, start: POLY_START, duration: POLY_DUR, ease: makeOutBack(1.5) })
    .to(poly, { prop: "scale.y", from: 0, to: 1, start: POLY_START, duration: POLY_DUR, ease: makeOutBack(1.5) });

  return { timeline, duration: DURATION };
}

export const radarChart: TemplateDefinition = {
  id: "radar-chart",
  name: "Radar Chart",
  tagline: "Spokes and rings draw in, then a value polygon inflates from the center.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { title: "display", axes: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Performance profile", maxLength: 30, optional: true, shrinkToFit: true },
    {
      key: "axes",
      type: "textlist",
      label: "Axes (label | value 0-100)",
      default: DEFAULT_AXES,
      minItems: 3,
      maxItems: 8,
      maxLength: 20,
      help: 'One per line as "label | value", value 0-100.',
    },
    { key: "showRings", type: "toggle", label: "Grid rings", default: true },
    { key: "showValues", type: "toggle", label: "Value labels", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

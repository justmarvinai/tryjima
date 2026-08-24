import { Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const asItems = (v: unknown, fallback: string[]): string[] => {
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
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", labelColor: "#5B5B68" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", labelColor: "#5566A0" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", labelColor: "#9BA0AE" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", labelColor: "#6F5E9E" } },
];

const DEFAULT_STATS = ["10000 | downloads", "4.9★ | rating", "120 | countries"];

interface Stat {
  prefix: string;
  target: number;
  decimals: number;
  suffix: string;
  label: string;
}

/** Parse "value | label" → animated number with kept prefix/suffix + label. */
function parseStat(raw: string): Stat {
  const idx = raw.indexOf("|");
  const valuePart = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const label = idx >= 0 ? raw.slice(idx + 1).trim() : "";
  // Locate the numeric core (digits, optionally with one decimal point).
  const m = valuePart.match(/[\d][\d,]*(\.\d+)?/);
  if (!m) {
    return { prefix: valuePart, target: 0, decimals: 0, suffix: "", label };
  }
  const numStr = m[0];
  const start = m.index ?? 0;
  const prefix = valuePart.slice(0, start);
  const suffix = valuePart.slice(start + numStr.length);
  const dot = numStr.indexOf(".");
  const decimals = dot >= 0 ? numStr.length - dot - 1 : 0;
  const target = decimals > 0 ? Number(numStr.replace(/,/g, "")) : parseTargetNumber(numStr);
  return { prefix, target, decimals, suffix, label };
}

function resolveStats(values: Values): Stat[] {
  return asItems(values.stats, DEFAULT_STATS).slice(0, 3).map(parseStat);
}

/** Format a mid-count value, preserving decimals. */
function formatValue(value: number, decimals: number): string {
  if (decimals > 0) {
    const factor = Math.pow(10, decimals);
    const rounded = Math.round(value * factor) / factor;
    const whole = Math.floor(rounded);
    const frac = Math.round((rounded - whole) * factor);
    return `${groupThousands(whole)}.${String(frac).padStart(decimals, "0")}`;
  }
  return groupThousands(value);
}

function numFrac(aspect: Aspect, n: number): number {
  // A big number per column; narrower columns (more stats / 16:9 row) → smaller.
  const base = aspect === "16:9" ? 0.13 : aspect === "9:16" ? 0.17 : 0.15;
  return n >= 3 ? base : base * 1.12;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const labelColor = pc("labelColor", "#5B5B68");
  const showDivider = values.divider !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const stats = resolveStats(values);
  const n = stats.length;
  const titleRaw = str(values.title, "");
  const aspect = ctx.aspect;
  const column = aspect === "9:16" || aspect === "4:5";

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  // Content band (respect 9:16 safe zone / ~6% margins elsewhere).
  const topSafe = aspect === "9:16" ? 220 : Math.round(minDim * 0.06);
  const botSafe = aspect === "9:16" ? 400 : Math.round(minDim * 0.06);
  const cx = w / 2;

  // Optional title on top.
  let bandTop = topSafe;
  if (titleRaw.length > 0) {
    const tSize = fitSize(fonts, titleRaw, "display", 700, Math.round(minDim * 0.05), w * 0.86);
    const tY = topSafe + tSize * 0.7;
    const title = makeText(fonts, { text: titleRaw, role: "display", weight: 700, size: tSize, color: textColor, anchor: 0.5, align: "center" });
    title.position.set(cx, tY);
    title.alpha = 0;
    root.addChild(title);
    timeline
      .to(title, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(title, { prop: "y", from: tY - 14, to: tY, start: 0, duration: 0.5, ease: outExpo });
    bandTop = tY + tSize * 0.9;
  }

  const bandBottom = h - botSafe;
  const bandCY = (bandTop + bandBottom) / 2;

  const counters: { stat: Stat; text: Text; start: number }[] = [];
  const COUNT = 1.1;

  if (column) {
    // Vertical stack; thin dividers between rows.
    const rowH = (bandBottom - bandTop) / n;
    let numSize = Math.round(w * (aspect === "9:16" ? 0.17 : 0.16));
    for (const s of stats) {
      const full = s.prefix + formatValue(s.target, s.decimals) + s.suffix;
      numSize = Math.min(numSize, fitSize(fonts, full, "display", 700, numSize, w * 0.82));
    }
    stats.forEach((s, i) => {
      const rowCY = bandTop + rowH * (i + 0.5);
      const start = 0.35 + i * 0.28;

      const numText = makeText(fonts, { text: s.prefix + "0" + s.suffix, role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5, align: "center" });
      numText.position.set(cx, rowCY - numSize * 0.12);
      numText.alpha = 0;
      root.addChild(numText);
      timeline
        .to(numText, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
        .to(numText, { prop: "scale.x", from: 0.7, to: 1, start, duration: 0.6, ease: outExpo })
        .to(numText, { prop: "scale.y", from: 0.7, to: 1, start, duration: 0.6, ease: outExpo });
      counters.push({ stat: s, text: numText, start: start + 0.1 });

      if (s.label.length > 0) {
        const lSize = fitSize(fonts, s.label, "body", 600, Math.round(numSize * 0.24), w * 0.7);
        const lY = rowCY + numSize * 0.55;
        const label = makeText(fonts, { text: s.label, role: "body", weight: 600, size: lSize, color: labelColor, anchor: 0.5, align: "center" });
        label.position.set(cx, lY);
        label.alpha = 0;
        root.addChild(label);
        timeline.to(label, { prop: "alpha", from: 0, to: 1, start: start + 0.15, duration: 0.4, ease: outQuad });
      }

      // Divider above each row after the first.
      if (i > 0 && showDivider) {
        const divW = w * 0.4;
        const divY = bandTop + rowH * i;
        const div = new Graphics().roundRect(-divW / 2, -1.5, divW, 3, 1.5).fill(accent);
        div.position.set(cx, divY);
        div.scale.set(0, 1);
        root.addChild(div);
        timeline.to(div, { prop: "scale.x", from: 0, to: 1, start: 0.25 + i * 0.28, duration: 0.45, ease: outExpo });
      }
    });
  } else {
    // Horizontal row; thin vertical dividers between columns.
    const colW = (w * 0.9) / n;
    const originX = cx - (colW * n) / 2;
    // Shrink the number so its widest (final) value fits the column — the
    // count-up's last frame is the widest, so fitting it prevents overflow.
    let numSize = Math.round(w * numFrac(aspect, n));
    for (const s of stats) {
      const full = s.prefix + formatValue(s.target, s.decimals) + s.suffix;
      numSize = Math.min(numSize, fitSize(fonts, full, "display", 700, numSize, colW * 0.84));
    }
    stats.forEach((s, i) => {
      const colCX = originX + colW * (i + 0.5);
      const start = 0.35 + i * 0.28;

      const numText = makeText(fonts, { text: s.prefix + "0" + s.suffix, role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5, align: "center" });
      numText.position.set(colCX, bandCY - numSize * 0.18);
      numText.alpha = 0;
      root.addChild(numText);
      timeline
        .to(numText, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
        .to(numText, { prop: "y", from: bandCY - numSize * 0.18 + 20, to: bandCY - numSize * 0.18, start, duration: 0.6, ease: outQuint })
        .to(numText, { prop: "scale.x", from: 0.7, to: 1, start, duration: 0.6, ease: outExpo })
        .to(numText, { prop: "scale.y", from: 0.7, to: 1, start, duration: 0.6, ease: outExpo });
      counters.push({ stat: s, text: numText, start: start + 0.1 });

      if (s.label.length > 0) {
        const lSize = fitSize(fonts, s.label, "body", 600, Math.round(numSize * 0.26), colW * 0.9);
        const lY = bandCY + numSize * 0.5;
        const label = makeText(fonts, { text: s.label, role: "body", weight: 600, size: lSize, color: labelColor, anchor: 0.5, align: "center" });
        label.position.set(colCX, lY);
        label.alpha = 0;
        root.addChild(label);
        timeline.to(label, { prop: "alpha", from: 0, to: 1, start: start + 0.15, duration: 0.4, ease: outQuad });
      }

      // Divider before each column after the first.
      if (i > 0 && showDivider) {
        const divH = (bandBottom - bandTop) * 0.42;
        const divX = originX + colW * i;
        const div = new Graphics().roundRect(-1.5, -divH / 2, 3, divH, 1.5).fill(accent);
        div.position.set(divX, bandCY);
        div.scale.set(1, 0);
        root.addChild(div);
        timeline.to(div, { prop: "scale.y", from: 0, to: 1, start: 0.25 + i * 0.28, duration: 0.45, ease: outExpo });
      }
    });
  }

  const update = (t: number): void => {
    for (const c of counters) {
      const p = outExpo(clamp01((t - c.start) / COUNT));
      c.text.text = c.stat.prefix + formatValue(c.stat.target * p, c.stat.decimals) + c.stat.suffix;
    }
  };

  return { timeline, duration: 4.0, update };
}

export const threeStats: TemplateDefinition = {
  id: "three-stats",
  name: "Three Stats",
  tagline: "Three headline numbers count up side by side.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "By the numbers", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "stats", type: "textlist", label: "Stats (value | label)", default: DEFAULT_STATS, minItems: 2, maxItems: 3, maxLength: 28 },
    { key: "divider", type: "toggle", label: "Divider line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

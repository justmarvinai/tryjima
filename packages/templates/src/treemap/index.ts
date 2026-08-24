import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
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

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
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

// --- Tiny deterministic colour maths (tiles are the accent at graded strength,
// so the label ink has to be chosen per tile to stay ≥ 4.5:1). ---

function hexToRgb(hex: string): [number, number, number] {
  const raw = hex.replace("#", "");
  const six =
    raw.length >= 6
      ? raw.slice(0, 6)
      : raw.length === 3
        ? `${raw[0]!}${raw[0]!}${raw[1]!}${raw[1]!}${raw[2]!}${raw[2]!}`
        : "000000";
  const n = Number.parseInt(six, 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp255(v: number): number {
  const r = Math.round(v);
  return r < 0 ? 0 : r > 255 ? 255 : r;
}

/** `over` composited onto `base` at `alpha` — the colour the eye actually sees. */
function mixHex(base: string, over: string, alpha: number): string {
  const [r0, g0, b0] = hexToRgb(base);
  const [r1, g1, b1] = hexToRgb(over);
  const t = alpha < 0 ? 0 : alpha > 1 ? 1 : alpha;
  const v = (clamp255(r0 + (r1 - r0) * t) << 16) | (clamp255(g0 + (g1 - g0) * t) << 8) | clamp255(b0 + (b1 - b0) * t);
  return `#${v.toString(16).padStart(6, "0")}`;
}

function relLum(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number): number => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(a: string, b: string): number {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Whichever of the two inks reads better on `surface`. */
function pickInk(surface: string, inkA: string, inkB: string): string {
  return contrastRatio(inkA, surface) >= contrastRatio(inkB, surface) ? inkA : inkB;
}

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", onAccent: "#FFFFFF", tileBg: "#F2EEE8" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#F3F7FF", textColor: "#0B1F4D", accent: "#2E7DF6", onAccent: "#FFFFFF", tileBg: "#FFFFFF" } },
  { id: "forest", name: "Forest", colors: { background: "#F2F7F3", textColor: "#10301F", accent: "#157F4C", onAccent: "#FFFFFF", tileBg: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0F1116", textColor: "#F2F2EE", accent: "#D8F34D", onAccent: "#101014", tileBg: "#1B1E26" } },
];

interface Item {
  label: string;
  value: number;
  display: string;
}

const DEFAULT_ITEMS = [
  "Search|4,820",
  "Social|3,140",
  "Email|2,060",
  "Direct|1,380",
  "Referral|860",
  "Other|540",
];

function parseItem(raw: string, fallback: string): Item {
  const parts = raw.split("|").map((s) => s.trim());
  const label = parts[0] ?? "";
  const vRaw = parts[1] ?? "0";
  return {
    label: label.length ? label : fallback,
    value: Math.max(0, parseTargetNumber(vRaw)),
    display: vRaw.length ? vRaw : "0",
  };
}

function itemsOf(values: Values): Item[] {
  return asList(values.items, DEFAULT_ITEMS)
    .slice(0, 7)
    .map((r, i) => parseItem(r, `Item ${i + 1}`));
}

// --- Squarified treemap (Bruls/Huizing/van Wijk): rectangles keep close to
// square, so AREA — not width or height alone — encodes the value. ---

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function worstRatio(max: number, min: number, sum: number, short: number): number {
  if (sum <= 0 || min <= 0 || short <= 0) return Number.POSITIVE_INFINITY;
  const s2 = sum * sum;
  const w2 = short * short;
  return Math.max((w2 * max) / s2, s2 / (w2 * min));
}

function squarify(valuesIn: number[], frame: Rect): Rect[] {
  const out: Rect[] = valuesIn.map(() => ({ x: frame.x, y: frame.y, w: 0, h: 0 }));
  const total = valuesIn.reduce((a, v) => a + v, 0);
  if (total <= 0 || frame.w <= 0 || frame.h <= 0) return out;
  const scale = (frame.w * frame.h) / total;
  const areas = valuesIn.map((v) => v * scale);

  let x = frame.x;
  let y = frame.y;
  let w = frame.w;
  let h = frame.h;
  let i = 0;
  while (i < areas.length && w > 0.5 && h > 0.5) {
    const short = Math.min(w, h);
    let rowSum = 0;
    let rowMin = Number.POSITIVE_INFINITY;
    let rowMax = 0;
    let best = Number.POSITIVE_INFINITY;
    let end = i;
    // Extend the row while it makes the tiles *less* elongated.
    while (end < areas.length) {
      const a = Math.max(1e-6, areas[end] ?? 0);
      const nextSum = rowSum + a;
      const nextMin = Math.min(rowMin, a);
      const nextMax = Math.max(rowMax, a);
      const ratio = worstRatio(nextMax, nextMin, nextSum, short);
      if (end > i && ratio > best) break;
      best = ratio;
      rowSum = nextSum;
      rowMin = nextMin;
      rowMax = nextMax;
      end++;
    }
    const thickness = rowSum / short;
    if (w >= h) {
      let cy = y;
      for (let k = i; k < end; k++) {
        const th = Math.max(1e-6, areas[k] ?? 0) / Math.max(1e-6, thickness);
        out[k] = { x, y: cy, w: thickness, h: th };
        cy += th;
      }
      x += thickness;
      w -= thickness;
    } else {
      let cx = x;
      for (let k = i; k < end; k++) {
        const tw = Math.max(1e-6, areas[k] ?? 0) / Math.max(1e-6, thickness);
        out[k] = { x: cx, y, w: tw, h: thickness };
        cx += tw;
      }
      y += thickness;
      h -= thickness;
    }
    i = end;
  }
  return out;
}

const TILE_START = 0.8;
const TILE_EACH = 0.13;
const TILE_DUR = 0.75;
const TEXT_OFF = 0.24;
const TEXT_DUR = 0.5;
const HOLD = 1.7;

function computeDuration(values: Values): number {
  const n = Math.max(1, itemsOf(values).length);
  return TILE_START + (n - 1) * TILE_EACH + Math.max(TILE_DUR, TEXT_OFF + TEXT_DUR) + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const tileBg = pc("tileBg", "#F2EEE8");

  const title = str(values.title, "Where the visits came from");
  const showAccentBar = values.accentBar !== false;
  const showShare = values.showShare !== false;
  const showValue = values.showValue !== false;

  // Biggest first — the layout and the reveal both read in size order.
  const items = itemsOf(values)
    .map((it, i) => ({ ...it, order: i }))
    .sort((a, b) => (b.value - a.value) || (a.order - b.order));
  const total = items.reduce((a, it) => a + it.value, 0) || 1;

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
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "x", from: zone.x - 18, to: zone.x, start: 0, duration: 0.65, ease: outQuint });

  let titleBottom = titleY + titleSize * 0.7;
  if (showAccentBar) {
    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(zone.x, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.28, duration: 0.55, ease: outExpo });
    titleBottom = titleY + titleSize * 0.9;
  }

  // --- The map itself ---
  const frame: Rect = {
    x: zone.x,
    y: titleBottom + minDim * 0.05,
    w: zone.width,
    h: Math.max(minDim * 0.3, zone.y + zone.height - (titleBottom + minDim * 0.05)),
  };
  const rects = squarify(items.map((it) => Math.max(it.value, total * 0.004)), frame);

  const gap = Math.max(3, minDim * 0.006);
  const radius = minDim * 0.016;
  const pad = minDim * 0.026;

  // Tile strength ramps down the ranking — but a mid-tone tint is the one
  // surface where neither ink clears 4.5:1, so every step is nudged back toward
  // the tile base until the better ink passes. Deterministic, and it keeps the
  // ramp monotone so the biggest share still reads as the strongest block.
  const inkPasses = (s: number): boolean => {
    const surf = mixHex(tileBg, accent, s);
    return Math.max(contrastRatio(textColor, surf), contrastRatio(onAccent, surf)) >= 4.6;
  };
  let topStrength = 1;
  for (let k = 0; k < 26 && !inkPasses(topStrength); k++) topStrength = Math.max(0, topStrength - 0.04);
  let prevStrength = topStrength;
  const strengths = items.map((_, i) => {
    let s = Math.min(prevStrength, Math.max(0.1, topStrength * (1 - i * 0.19)));
    for (let k = 0; k < 26 && !inkPasses(s); k++) s = Math.max(0, s - 0.04);
    prevStrength = s;
    return s;
  });

  items.forEach((it, i) => {
    const r = rects[i];
    if (!r || r.w <= gap * 2 || r.h <= gap * 2) return;
    const iw = r.w - gap * 2;
    const ih = r.h - gap * 2;
    const cxT = r.x + r.w / 2;
    const cyT = r.y + r.h / 2;

    const strength = strengths[i] ?? 0.1;
    const surface = mixHex(tileBg, accent, strength);
    const ink = pickInk(surface, textColor, onAccent);

    const tile = new Container();
    tile.position.set(cxT, cyT);
    tile.alpha = 0;
    tile.scale.set(0.9);
    root.addChild(tile);

    tile.addChild(new Graphics().roundRect(-iw / 2, -ih / 2, iw, ih, Math.min(radius, iw / 2, ih / 2)).fill(tileBg));
    tile.addChild(
      new Graphics()
        .roundRect(-iw / 2, -ih / 2, iw, ih, Math.min(radius, iw / 2, ih / 2))
        .fill({ color: accent, alpha: strength }),
    );

    const start = TILE_START + i * TILE_EACH;
    timeline
      .to(tile, { prop: "alpha", from: 0, to: 1, start, duration: TILE_DUR * 0.7, ease: outQuad })
      .to(tile, { prop: "scale.x", from: 0.9, to: 1, start, duration: TILE_DUR, ease: outQuint })
      .to(tile, { prop: "scale.y", from: 0.9, to: 1, start, duration: TILE_DUR, ease: outQuint });

    // --- Label block, top-left inside the tile (editorial, not centred) ---
    const p = Math.min(pad, iw * 0.12, ih * 0.16);
    const innerW = iw - p * 2;
    const labelBase = Math.min(minDim * 0.05, ih * 0.3, iw * 0.24);
    if (innerW <= 0 || labelBase < minDim * 0.013) return;
    const labelSize = fitSize(fonts, it.label, "display", 700, Math.round(labelBase), innerW);

    const textC = new Container();
    textC.alpha = 0;
    tile.addChild(textC);

    const label = makeText(fonts, { text: it.label, role: "display", weight: 700, size: labelSize, color: ink, anchor: { x: 0, y: 0 } });
    label.position.set(-iw / 2 + p, -ih / 2 + p);
    textC.addChild(label);

    const share = Math.round((it.value / total) * 100);
    const metaStr = showValue && showShare ? `${it.display} · ${share}%` : showValue ? it.display : `${share}%`;
    const metaBase = Math.max(minDim * 0.016, labelSize * 0.56);
    if (ih >= p * 2 + labelSize * 1.2 + metaBase * 1.25) {
      const metaSize = fitSize(fonts, metaStr, "body", 500, Math.round(metaBase), innerW);
      // Full opacity: a faded meta line would undo the contrast guarantee above.
      const meta = makeText(fonts, { text: metaStr, role: "body", weight: 500, size: metaSize, color: ink, anchor: { x: 0, y: 0 } });
      meta.position.set(-iw / 2 + p, -ih / 2 + p + labelSize * 1.22);
      textC.addChild(meta);
    }

    timeline
      .to(textC, { prop: "alpha", from: 0, to: 1, start: start + TEXT_OFF, duration: TEXT_DUR, ease: outQuad })
      .to(textC, { prop: "y", from: minDim * 0.012, to: 0, start: start + TEXT_OFF, duration: TEXT_DUR + 0.2, ease: outQuint });
  });

  return { timeline, duration: computeDuration(values) };
}

export const treemap: TemplateDefinition = {
  id: "treemap",
  name: "Treemap",
  tagline: "Proportional rectangles tile the frame, biggest share first — area is the number.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", items: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Where the visits came from", maxLength: 36, optional: true, shrinkToFit: true },
    {
      key: "items",
      type: "textlist",
      label: "Items (label | value)",
      default: DEFAULT_ITEMS,
      minItems: 3,
      maxItems: 7,
      maxLength: 24,
      help: 'One per line as "label | value", e.g. "Search | 4,820". Rectangle area follows the value.',
    },
    { key: "showValue", type: "toggle", label: "Show values", default: true },
    { key: "showShare", type: "toggle", label: "Show share %", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Tiles", default: "", optional: true },
  ],
  build,
};

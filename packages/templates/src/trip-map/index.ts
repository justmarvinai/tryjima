import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { dashedPath } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
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
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function relLum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length >= 6 ? h.slice(0, 6) : h.padEnd(6, h.slice(-1) || "0");
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const contrastRatio = (a: string, b: string): number => {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const readableOn = (bg: string): string =>
  contrastRatio("#FFFFFF", bg) >= contrastRatio("#111318", bg) * 0.9 ? "#FFFFFF" : "#111318";

// landColor is a palette-only role (the faint map grid). Title + stop labels use
// textColor on background (>= 4.5:1); pin numbers use auto ink on the accent.
const PALETTES: Palette[] = [
  { id: "atlas", name: "Atlas paper", colors: { background: "#F3EFE4", textColor: "#1E2530", accent: "#9E2E0D", landColor: "#1E2530" } },
  { id: "ocean", name: "Ocean", colors: { background: "#E8F1F6", textColor: "#0B2A3D", accent: "#123E86", landColor: "#0B2A3D" } },
  { id: "sage", name: "Sage", colors: { background: "#EEF3EA", textColor: "#16281C", accent: "#1B5C38", landColor: "#16281C" } },
  { id: "night", name: "Night", colors: { background: "#12141A", textColor: "#F4F1E9", accent: "#D8F34D", landColor: "#F4F1E9" } },
];

const DEFAULT_STOPS = ["Rome", "Florence", "Venice", "Milan"];

const STOP_FRACS: [number, number][] = [
  [0.16, 0.74],
  [0.44, 0.32],
  [0.66, 0.72],
  [0.86, 0.34],
];

const DROP_START = 0.65;
const STAGGER = 0.5;
const DROP_DUR = 0.55;
const SEG_DUR = 0.38;
const HOLD = 1.2;

interface Pt {
  x: number;
  y: number;
}

function stopsOf(values: Values): string[] {
  return asList(values.stops, DEFAULT_STOPS).slice(0, 4);
}

function computeDuration(values: Values): number {
  const n = Math.max(1, Math.min(4, stopsOf(values).length));
  return DROP_START + (n - 1) * STAGGER + DROP_DUR + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3EFE4"));
  const textColor = str(values.textColor, pc("textColor", "#1E2530"));
  const accent = str(values.accent, pc("accent", "#9E2E0D"));
  const landColor = pc("landColor", "#1E2530");
  const pinInk = readableOn(accent);

  const title = str(values.title, "Italy Itinerary");
  const stops = stopsOf(values);
  const n = Math.max(1, Math.min(4, stops.length));
  const showPath = values.showPath !== false;
  const showGrid = values.showGrid !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Faint coordinate grid (decorative map backdrop) ---
  if (showGrid) {
    const grid = new Graphics();
    const spacing = minDim * 0.085;
    for (let x = spacing; x < w; x += spacing) grid.moveTo(x, 0).lineTo(x, h);
    for (let y = spacing; y < h; y += spacing) grid.moveTo(0, y).lineTo(w, y);
    grid.stroke({ color: landColor, width: 1, alpha: 0.08 });
    grid.alpha = 0;
    root.addChild(grid);
    timeline.to(grid, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.6, ease: outQuad });
  }

  // --- Title ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.056), zone.width * 0.9);
  const titleY = zone.y + titleSize * 0.72;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0.5, y: 0.5 }, align: "center" });
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 14, to: titleY, start: 0, duration: 0.5, ease: outQuint });

  // --- Map area (below the title) ---
  const mapTop = titleY + titleSize * 0.7 + minDim * 0.03;
  const mapBottom = zone.y + zone.height - minDim * 0.02;
  const mapLeft = zone.x + minDim * 0.02;
  const mapRight = zone.x + zone.width - minDim * 0.02;
  const mapW = mapRight - mapLeft;
  const mapH = mapBottom - mapTop;

  const headR = minDim * 0.05;
  const pointerH = headR * 0.95;
  const tips: Pt[] = [];
  const heads: Pt[] = [];
  const landTimes: number[] = [];

  // Dashed connecting path (drawn progressively in update).
  const pathG = showPath ? new Graphics() : null;
  if (pathG) root.addChild(pathG);

  for (let i = 0; i < n; i++) {
    const frac = STOP_FRACS[i]!;
    const tipX = mapLeft + frac[0] * mapW;
    const tipY = mapTop + frac[1] * mapH;
    tips.push({ x: tipX, y: tipY });
    const headCy = tipY - pointerH - headR * 0.82;
    heads.push({ x: tipX, y: headCy });
    const landAt = DROP_START + i * STAGGER + DROP_DUR;
    landTimes.push(landAt);

    // Numbered pin (tip at origin).
    const pin = new Container();
    pin.position.set(tipX, tipY);
    pin.scale.set(0);
    root.addChild(pin);
    const g = new Graphics();
    g.poly([-headR * 0.5, -pointerH, headR * 0.5, -pointerH, 0, 0]).fill(accent);
    g.circle(0, -pointerH - headR * 0.82, headR).fill(accent);
    pin.addChild(g);
    const num = `${i + 1}`;
    const numText = makeText(fonts, { text: num, role: "display", weight: 700, size: Math.round(headR * 1.05), color: pinInk, anchor: 0.5 });
    numText.position.set(0, -pointerH - headR * 0.82);
    pin.addChild(numText);

    // Stop label above the pin head.
    const labelMaxW = Math.min(mapW * 0.42, minDim * 0.34);
    const labelSize = fitSize(fonts, stops[i]!, "body", 600, Math.round(minDim * 0.032), labelMaxW);
    const label = makeText(fonts, { text: stops[i]!, role: "body", weight: 600, size: labelSize, color: textColor, anchor: { x: 0.5, y: 1 }, align: "center" });
    label.position.set(tipX, headCy - headR - minDim * 0.012);
    label.alpha = 0;
    root.addChild(label);

    const dropStart = DROP_START + i * STAGGER;
    timeline
      .to(pin, { prop: "scale.x", from: 0, to: 1, start: dropStart, duration: DROP_DUR, ease: makeOutBack(1.8) })
      .to(pin, { prop: "scale.y", from: 0, to: 1, start: dropStart, duration: DROP_DUR, ease: makeOutBack(1.8) })
      .to(pin, { prop: "y", from: tipY - h * 0.28, to: tipY, start: dropStart, duration: DROP_DUR, ease: makeOutBack(1.6) })
      .to(label, { prop: "alpha", from: 0, to: 1, start: dropStart + 0.25, duration: 0.35, ease: outQuad })
      .to(label, { prop: "y", from: headCy - headR - minDim * 0.012 + 8, to: headCy - headR - minDim * 0.012, start: dropStart + 0.25, duration: 0.4, ease: outQuint });
  }

  const dashW = Math.max(2, minDim * 0.006);
  const update = (t: number): void => {
    if (!pathG) return;
    pathG.clear();
    let last = -1;
    for (let i = 0; i < n; i++) {
      if (t >= landTimes[i]!) last = i;
      else break;
    }
    if (last < 0) return;
    const flat: number[] = [heads[0]!.x, heads[0]!.y];
    for (let i = 1; i <= last; i++) flat.push(heads[i]!.x, heads[i]!.y);
    const nextI = last + 1;
    if (nextI < n) {
      const u = clamp01((t - landTimes[last]!) / SEG_DUR);
      if (u > 0) {
        const a = heads[last]!;
        const b = heads[nextI]!;
        flat.push(a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u);
      }
    }
    if (flat.length >= 4) {
      dashedPath(pathG, flat, { dash: minDim * 0.02, gap: minDim * 0.015, width: dashW, color: accent, cap: "round" });
    }
  };

  return { timeline, duration: computeDuration(values), update };
}

export const tripMap: TemplateDefinition = {
  id: "trip-map",
  name: "Trip Map",
  tagline: "Numbered stops drop onto a map, linked by a dashed path in order.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.2,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", stops: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Italy Itinerary", maxLength: 28, shrinkToFit: true },
    { key: "stops", type: "textlist", label: "Stops", default: DEFAULT_STOPS, minItems: 3, maxItems: 4, maxLength: 20, help: "3–4 stops, in visiting order." },
    { key: "showPath", type: "toggle", label: "Dashed path", default: true },
    { key: "showGrid", type: "toggle", label: "Map grid", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

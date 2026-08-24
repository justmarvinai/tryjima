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

/** Inverse of the inOutQuad easing — maps a progress fraction back to u. */
const invInOutQuad = (p: number): number =>
  p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.sqrt(p / 2) : 1 - Math.sqrt((1 - p) / 2);
const inOutQuadP = (u: number): number => (u < 0.5 ? 2 * u * u : 1 - 2 * (1 - u) * (1 - u));

/** Stroke the first `len` px of a polyline (flat [x0,y0,x1,y1,…]) into g. */
function strokePartial(
  g: Graphics,
  pts: number[],
  len: number,
  style: { color: string; width: number },
): void {
  if (len <= 0 || pts.length < 4) return;
  g.moveTo(pts[0]!, pts[1]!);
  let remaining = len;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    const x0 = pts[i]!;
    const y0 = pts[i + 1]!;
    const x1 = pts[i + 2]!;
    const y1 = pts[i + 3]!;
    const seg = Math.hypot(x1 - x0, y1 - y0);
    if (seg <= remaining) {
      g.lineTo(x1, y1);
      remaining -= seg;
    } else {
      const u = seg === 0 ? 0 : remaining / seg;
      g.lineTo(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u);
      remaining = 0;
      break;
    }
  }
  g.stroke({ color: style.color, width: style.width, cap: "round", join: "round" });
}

// Station labels render in textColor on background (>= 4.5:1); stationFill is
// the classic white metro tick, mutedLine paints the faint "other lines".
const PALETTES: Palette[] = [
  { id: "transit-cream", name: "Transit cream", colors: { background: "#F6F1E5", textColor: "#1E242C", accent: "#C7351F", stationFill: "#FFFFFF", mutedLine: "#1E242C" } },
  { id: "underground-night", name: "Underground night", colors: { background: "#0F1420", textColor: "#F2F5FA", accent: "#FFD23F", stationFill: "#FFFFFF", mutedLine: "#F2F5FA" } },
  { id: "seoul-mint", name: "Seoul mint", colors: { background: "#EAF3EE", textColor: "#11241A", accent: "#0E8A5C", stationFill: "#FFFFFF", mutedLine: "#11241A" } },
  { id: "tokyo-pink", name: "Tokyo pink", colors: { background: "#FFFFFF", textColor: "#17191E", accent: "#C2006B", stationFill: "#FFFFFF", mutedLine: "#17191E" } },
];

const DEFAULT_STATIONS = ["Shibuya", "Shinjuku", "Ueno", "Asakusa"];

const DRAW_START = 0.6;
const DRAW_DUR = 1.6;
const POP_DUR = 0.45;
const DURATION = 4.3;

function stationsOf(values: Values): string[] {
  return asList(values.stations, DEFAULT_STATIONS).slice(0, 4);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6F1E5"));
  const textColor = str(values.textColor, pc("textColor", "#1E242C"));
  const accent = str(values.accent, pc("accent", "#C7351F"));
  const stationFill = pc("stationFill", "#FFFFFF");
  const mutedLine = pc("mutedLine", "#1E242C");
  const badgeInk = readableOn(accent);

  const title = str(values.title, "Tokyo Transit");
  const badgeRaw = str(values.badge, "LINE 3").toUpperCase();
  const stations = stationsOf(values);
  const n = stations.length;
  const showBadge = values.showBadge !== false;
  const showOtherLines = values.showOtherLines !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Header: line badge chip + title ---
  const badgeSize = Math.round(minDim * 0.026);
  const badgeH = Math.round(minDim * 0.052);
  let cursorY = zone.y;
  if (showBadge) {
    const badgeFit = fitSize(fonts, badgeRaw, "body", 700, badgeSize, minDim * 0.24);
    const badgeTextW = fonts.measure(badgeRaw, { family: fonts.family("body"), weight: 700, size: badgeFit });
    const badgeW = badgeTextW + badgeH * 1.1;
    const chip = new Container();
    chip.position.set(cx, cursorY + badgeH / 2);
    chip.scale.set(0);
    root.addChild(chip);
    chip.addChild(new Graphics().roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, badgeH / 2).fill(accent));
    const badgeText = makeText(fonts, { text: badgeRaw, role: "body", weight: 700, size: badgeFit, color: badgeInk, anchor: 0.5, letterSpacing: 2 });
    chip.addChild(badgeText);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: 0.05, duration: 0.5, ease: makeOutBack(1.9) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: 0.05, duration: 0.5, ease: makeOutBack(1.9) });
    cursorY += badgeH + minDim * 0.022;
  }

  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.052), zone.width * 0.9);
  const titleY = cursorY + titleSize * 0.62;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 12, to: titleY, start: 0.15, duration: 0.5, ease: outQuint });

  // --- Diagram area ---
  const labelSize0 = Math.round(minDim * 0.03);
  const labelBand = labelSize0 * 2.4;
  const mapTop = titleY + titleSize * 0.7 + minDim * 0.03;
  const mapBottom = zone.y + zone.height - minDim * 0.015;
  const mapLeft = zone.x + minDim * 0.012;
  const mapRight = zone.x + zone.width - minDim * 0.012;
  const mapW = mapRight - mapLeft;
  const pathTop = mapTop + labelBand;
  const pathBottom = mapBottom - labelBand;
  const dy = Math.min(Math.max(40, pathBottom - pathTop), mapW * 0.16);
  const yMid = (pathTop + pathBottom) / 2;
  const yHigh = yMid - dy / 2;
  const yLow = yMid + dy / 2;

  // Schematic route: horizontal → 45° up → horizontal → 45° down → horizontal.
  const xA = mapLeft + mapW * 0.17;
  const xB = mapRight - mapW * 0.17 - dy;
  const xC = xB + dy;
  const pts = [mapLeft, yLow, xA, yLow, xA + dy, yHigh, xB, yHigh, xC, yLow, mapRight, yLow];

  let totalLen = 0;
  for (let i = 0; i + 3 < pts.length; i += 2) {
    totalLen += Math.hypot(pts[i + 2]! - pts[i]!, pts[i + 3]! - pts[i + 1]!);
  }
  /** Arc length along the route at horizontal position x (x is monotonic). */
  const arcAt = (x: number): number => {
    let acc = 0;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const x0 = pts[i]!;
      const y0 = pts[i + 1]!;
      const x1 = pts[i + 2]!;
      const y1 = pts[i + 3]!;
      const seg = Math.hypot(x1 - x0, y1 - y0);
      if (x >= x1) {
        acc += seg;
      } else {
        const u = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
        return acc + seg * clamp01(u);
      }
    }
    return acc;
  };

  const lw = Math.max(8, minDim * 0.022);

  // --- Faint "other line" stubs entering from the map edges (decorative) ---
  if (showOtherLines) {
    const stubs: { pts: number[]; tickX: number; tickY: number }[] = [
      {
        // top-left, dipping in with a 45° jog
        pts: [mapLeft, mapTop + labelBand * 0.2, mapLeft + mapW * 0.13, mapTop + labelBand * 0.2, mapLeft + mapW * 0.13 + labelBand * 0.55, mapTop + labelBand * 0.75],
        tickX: mapLeft + mapW * 0.08,
        tickY: mapTop + labelBand * 0.2,
      },
      {
        // bottom-right, rising out with a 45° jog
        pts: [mapRight - mapW * 0.13 - labelBand * 0.55, mapBottom - labelBand * 0.75, mapRight - mapW * 0.13, mapBottom - labelBand * 0.2, mapRight, mapBottom - labelBand * 0.2],
        tickX: mapRight - mapW * 0.08,
        tickY: mapBottom - labelBand * 0.2,
      },
    ];
    for (const s of stubs) {
      const other = new Graphics();
      strokePartial(other, s.pts, w * 4, { color: mutedLine, width: lw * 0.55 });
      other.alpha = 0;
      root.addChild(other);
      const oTick = new Graphics()
        .circle(s.tickX, s.tickY, lw * 0.42)
        .fill(stationFill)
        .circle(s.tickX, s.tickY, lw * 0.42)
        .stroke({ color: mutedLine, width: lw * 0.22 });
      oTick.alpha = 0;
      root.addChild(oTick);
      timeline
        .to(other, { prop: "alpha", from: 0, to: 0.16, start: 0.2, duration: 0.6, ease: outQuad })
        .to(oTick, { prop: "alpha", from: 0, to: 0.3, start: 0.2, duration: 0.6, ease: outQuad });
    }
  }

  // --- Track underlay (full route, faint) ---
  const track = new Graphics();
  strokePartial(track, pts, totalLen + 1, { color: mutedLine, width: lw });
  track.alpha = 0;
  root.addChild(track);
  timeline.to(track, { prop: "alpha", from: 0, to: 0.12, start: 0.25, duration: 0.5, ease: outQuad });

  // --- The colored line, drawn progressively in update(t) ---
  const lineG = new Graphics();
  root.addChild(lineG);

  // --- Stations ---
  interface Station {
    x: number;
    y: number;
    frac: number;
  }
  const sPts: Station[] = [];
  const firstX = mapLeft + (xA - mapLeft) * 0.55;
  const lastX = mapRight - (mapRight - xC) * 0.28;
  const h2Len = xB - (xA + dy);
  if (n >= 2) sPts.push({ x: firstX, y: yLow, frac: 0 });
  if (n === 4) {
    sPts.push({ x: xA + dy + h2Len * 0.25, y: yHigh, frac: 0 });
    sPts.push({ x: xA + dy + h2Len * 0.75, y: yHigh, frac: 0 });
  } else if (n === 3) {
    sPts.push({ x: xA + dy + h2Len * 0.52, y: yHigh, frac: 0 });
  }
  sPts.push({ x: lastX, y: yLow, frac: 0 });
  for (const s of sPts) s.frac = clamp01(arcAt(s.x) / totalLen);

  const tickR = lw * 1.02;
  const termR = tickR * 1.4;

  sPts.forEach((s, i) => {
    const isTerminal = i === sPts.length - 1;
    const r = isTerminal ? termR : tickR;
    const node = new Container();
    node.position.set(s.x, s.y);
    node.scale.set(0);
    root.addChild(node);
    const g = new Graphics().circle(0, 0, r).fill(stationFill).circle(0, 0, r).stroke({ color: accent, width: lw * 0.5 });
    if (isTerminal) g.circle(0, 0, r * 0.42).fill(accent);
    node.addChild(g);

    const above = i % 2 === 0;
    const labelFit = fitSize(fonts, stations[i]!, "body", 600, labelSize0, mapW * 0.3);
    const label = makeText(fonts, {
      text: stations[i]!,
      role: "body",
      weight: 600,
      size: labelFit,
      color: textColor,
      anchor: { x: 0.5, y: above ? 1 : 0 },
      align: "center",
    });
    const gap = r + lw * 0.5 + minDim * 0.014;
    const labelY = above ? s.y - gap : s.y + gap;
    label.position.set(s.x, labelY);
    label.alpha = 0;
    root.addChild(label);

    const popAt = DRAW_START + DRAW_DUR * invInOutQuad(s.frac);
    timeline
      .to(node, { prop: "scale.x", from: 0, to: 1, start: popAt, duration: POP_DUR, ease: makeOutBack(2.1) })
      .to(node, { prop: "scale.y", from: 0, to: 1, start: popAt, duration: POP_DUR, ease: makeOutBack(2.1) })
      .to(label, { prop: "alpha", from: 0, to: 1, start: popAt + 0.12, duration: 0.35, ease: outQuad })
      .to(label, {
        prop: "y",
        from: labelY + (above ? 8 : -8),
        to: labelY,
        start: popAt + 0.12,
        duration: 0.4,
        ease: outQuint,
      });
  });

  // --- Destination pulse rings (settle before the end hold) ---
  const term = sPts[sPts.length - 1]!;
  for (const ringStart of [2.5, 2.95]) {
    const ring = new Graphics().circle(0, 0, termR * 1.15).stroke({ color: accent, width: lw * 0.4 });
    ring.position.set(term.x, term.y);
    ring.alpha = 0;
    root.addChild(ring);
    timeline
      // Hold invisible until the pulse starts (a tween's `from` applies before
      // its window, so an explicit 0→0 hold precedes the fade-out).
      .to(ring, { prop: "alpha", from: 0, to: 0, start: 0, duration: ringStart, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0.75, to: 0, start: ringStart, duration: 0.85, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 1, to: 2.3, start: ringStart, duration: 0.85, ease: outQuad })
      .to(ring, { prop: "scale.y", from: 1, to: 2.3, start: ringStart, duration: 0.85, ease: outQuad });
  }

  const update = (t: number): void => {
    lineG.clear();
    const p = inOutQuadP(clamp01((t - DRAW_START) / DRAW_DUR));
    if (p <= 0) return;
    strokePartial(lineG, pts, totalLen * p, { color: accent, width: lw });
  };

  return { timeline, duration: DURATION, update };
}

export const metroMap: TemplateDefinition = {
  id: "metro-map",
  name: "Metro Map",
  tagline: "A schematic transit line draws across the frame, popping station stops in order.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.0,
  fontRoles: { title: "display", stations: "body", badge: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Tokyo Transit", maxLength: 26, shrinkToFit: true },
    { key: "badge", type: "text", label: "Line badge", default: "LINE 3", maxLength: 10, shrinkToFit: true },
    {
      key: "stations",
      type: "textlist",
      label: "Stations",
      default: DEFAULT_STATIONS,
      minItems: 3,
      maxItems: 4,
      maxLength: 16,
      help: "3–4 stops, in riding order. The last one is the destination.",
    },
    { key: "showBadge", type: "toggle", label: "Line badge chip", default: true },
    { key: "showOtherLines", type: "toggle", label: "Faint other lines", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Line color", default: "", optional: true },
  ],
  build,
};

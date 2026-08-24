import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inOutQuad,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { dashedPath } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

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

// landColor is a palette-only role (not user-exposed) for the abstract map fill.
const PALETTES: Palette[] = [
  { id: "atlas-paper", name: "Atlas paper", colors: { background: "#F3EFE4", textColor: "#1E2530", accent: "#9E2E0D", landColor: "#E4DCC8" } },
  { id: "ocean-mist", name: "Ocean mist", colors: { background: "#E8F1F6", textColor: "#0B2A3D", accent: "#123E86", landColor: "#CFE3EC" } },
  { id: "night-atlas", name: "Night atlas", colors: { background: "#12141A", textColor: "#F4F1E9", accent: "#D8F34D", landColor: "#1D2029" } },
  { id: "sage-explorer", name: "Sage explorer", colors: { background: "#EEF3EA", textColor: "#16281C", accent: "#1B5C38", landColor: "#DCE7D6" } },
];

interface Pt {
  x: number;
  y: number;
}

/** A soft, organic "landmass" silhouette — a fixed radial wobble, fully deterministic. */
function blobPoints(cx: number, cy: number, baseR: number, freq: number, amp: number, phase: number, steps = 28): number[] {
  const pts: number[] = [];
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = baseR * (1 + amp * Math.sin(freq * a + phase));
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  return pts;
}

function bezier(p0: Pt, p1: Pt, ctrl: Pt, u: number): Pt {
  const mt = 1 - u;
  return {
    x: mt * mt * p0.x + 2 * mt * u * ctrl.x + u * u * p1.x,
    y: mt * mt * p0.y + 2 * mt * u * ctrl.y + u * u * p1.y,
  };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3EFE4"));
  const textColor = str(values.textColor, pc("textColor", "#1E2530"));
  const accent = str(values.accent, pc("accent", "#9E2E0D"));
  const landColor = pc("landColor", "#E4DCC8");
  const showGrid = values.showGrid !== false;

  const originLabel = str(values.originLabel, "Home");
  const destLabel = str(values.destLabel, "Bali");
  const distance = str(values.distance, "6,742 mi");

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Abstract landmass shapes (always on — the map's base texture) ---
  const land = new Graphics();
  land.poly(blobPoints(w * 0.16, h * 0.82, minDim * 0.3, 3, 0.16, 0.4)).fill(landColor);
  land.poly(blobPoints(w * 0.86, h * 0.16, minDim * 0.22, 4, 0.15, 1.1)).fill(landColor);
  land.poly(blobPoints(w * 0.62, h * 0.68, minDim * 0.13, 5, 0.2, 2.0)).fill(landColor);
  land.alpha = 0;
  root.addChild(land);
  timeline.to(land, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.6, ease: outQuad });

  // --- Coordinate grid overlay (decorative — toggled) ---
  let grid: Graphics | null = null;
  if (showGrid) {
    grid = new Graphics();
    const spacing = minDim * 0.085;
    for (let x = spacing; x < w; x += spacing) grid.moveTo(x, 0).lineTo(x, h);
    for (let y = spacing; y < h; y += spacing) grid.moveTo(0, y).lineTo(w, y);
    grid.stroke({ color: textColor, width: 1, alpha: 0.08 });
    grid.alpha = 0;
    root.addChild(grid);
    timeline.to(grid, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.6, ease: outQuad });
  }

  // --- Origin / destination points ---
  const rect = safeRect(ctx.aspect);
  const origin: Pt = { x: rect.x + rect.width * 0.2, y: rect.y + rect.height * 0.72 };
  const dest: Pt = { x: rect.x + rect.width * 0.78, y: rect.y + rect.height * 0.26 };

  const pinSize = minDim * 0.095;

  function makePin(target: Pt): Container {
    const c = new Container();
    c.pivot.set(0, pinSize * 0.5);
    c.addChild(makeIcon("pin", pinSize, { color: accent, holeColor: bg }));
    c.position.set(target.x, target.y);
    return c;
  }

  function makeLabel(text: string, target: Pt, maxW: number): Container {
    const holder = new Container();
    const labelSize = fitSize(fonts, text, "display", 700, Math.round(minDim * 0.042), maxW);
    const t = makeText(fonts, { text, role: "display", weight: 700, size: labelSize, color: textColor, anchor: { x: 0.5, y: 1 } });
    t.position.set(target.x, target.y - pinSize * 1.05);
    holder.addChild(t);
    return holder;
  }

  const originPin = makePin(origin);
  originPin.scale.set(0);
  root.addChild(originPin);
  const originLabelNode = makeLabel(originLabel, origin, rect.width * 0.4);
  originLabelNode.alpha = 0;
  root.addChild(originLabelNode);

  const destPin = makePin(dest);
  destPin.scale.set(0);
  root.addChild(destPin);
  const destLabelNode = makeLabel(destLabel, dest, rect.width * 0.4);
  destLabelNode.alpha = 0;
  root.addChild(destLabelNode);

  timeline
    .to(originPin, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.5, ease: makeOutBack(2.2) })
    .to(originPin, { prop: "scale.y", from: 0, to: 1, start: 0.3, duration: 0.5, ease: makeOutBack(2.2) })
    .to(originLabelNode, { prop: "alpha", from: 0, to: 1, start: 0.6, duration: 0.4, ease: outQuad })
    .to(originLabelNode, { prop: "y", from: 10, to: 0, start: 0.6, duration: 0.45, ease: outQuint });

  // --- Route (bezier bulging toward the top of the frame) ---
  const dx = dest.x - origin.x;
  const dy = dest.y - origin.y;
  const dist = Math.hypot(dx, dy) || 1;
  let nx = -dy / dist;
  let ny = dx / dist;
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  const bulge = dist * 0.2;
  const ctrl: Pt = { x: (origin.x + dest.x) / 2 + nx * bulge, y: (origin.y + dest.y) / 2 + ny * bulge };

  const ROUTE_STEPS = 64;
  const fullPts: Pt[] = [];
  for (let i = 0; i <= ROUTE_STEPS; i++) fullPts.push(bezier(origin, dest, ctrl, i / ROUTE_STEPS));

  const routeG = new Graphics();
  root.addChild(routeG);

  const marker = new Container();
  const markerR = minDim * 0.014;
  marker.addChild(new Graphics().circle(0, 0, markerR).fill(accent));
  marker.addChild(new Graphics().circle(0, 0, markerR * 0.45).fill(bg));
  marker.visible = false;
  root.addChild(marker);

  const routeStart = 0.9;
  const routeEnd = 2.0;

  // --- Destination reveal (arrives with the marker) ---
  const destPinStart = routeEnd - 0.15;
  timeline
    .to(destPin, { prop: "scale.x", from: 0, to: 1, start: destPinStart, duration: 0.4, ease: makeOutBack(2.0) })
    .to(destPin, { prop: "scale.y", from: 0, to: 1, start: destPinStart, duration: 0.4, ease: makeOutBack(2.0) })
    .to(destLabelNode, { prop: "alpha", from: 0, to: 1, start: destPinStart + 0.2, duration: 0.4, ease: outQuad })
    .to(destLabelNode, { prop: "y", from: 10, to: 0, start: destPinStart + 0.2, duration: 0.45, ease: outQuint });

  // --- Distance caption (optional), floating above the route's midpoint ---
  let distNode: Container | null = null;
  if (distance.length > 0) {
    const mid = bezier(origin, dest, ctrl, 0.5);
    distNode = new Container();
    distNode.position.set(mid.x + nx * minDim * 0.05, mid.y + ny * minDim * 0.05);
    distNode.alpha = 0;
    const distSize = fitSize(fonts, distance, "body", 600, Math.round(minDim * 0.03), rect.width * 0.3);
    const distText = makeText(fonts, { text: distance, role: "body", weight: 600, size: distSize, color: textColor, anchor: 0.5, letterSpacing: 0.5 });
    distNode.addChild(distText);
    root.addChild(distNode);
    timeline
      .to(distNode, { prop: "alpha", from: 0, to: 0.9, start: 2.35, duration: 0.4, ease: outQuad })
      .to(distNode, { prop: "y", from: distNode.position.y + 8, to: distNode.position.y, start: 2.35, duration: 0.45, ease: outQuint });
  }

  const dashW = Math.max(2, minDim * 0.005);
  const update = (t: number): void => {
    if (t < routeStart) {
      routeG.clear();
      marker.visible = false;
      return;
    }
    const u = clamp01((t - routeStart) / (routeEnd - routeStart));
    const eased = inOutQuad(u);
    const idxF = eased * ROUTE_STEPS;
    const idx = Math.min(ROUTE_STEPS, Math.floor(idxF));
    const flat: number[] = [];
    for (let i = 0; i <= idx; i++) {
      const p = fullPts[i]!;
      flat.push(p.x, p.y);
    }
    let tipX: number;
    let tipY: number;
    if (idx < ROUTE_STEPS) {
      const frac = idxF - idx;
      const a = fullPts[idx]!;
      const b = fullPts[idx + 1]!;
      tipX = a.x + (b.x - a.x) * frac;
      tipY = a.y + (b.y - a.y) * frac;
      flat.push(tipX, tipY);
    } else {
      const last = fullPts[ROUTE_STEPS]!;
      tipX = last.x;
      tipY = last.y;
    }
    routeG.clear();
    if (flat.length >= 4) {
      dashedPath(routeG, flat, { dash: 9, gap: 7, width: dashW, color: accent, cap: "round" });
    }
    marker.visible = true;
    marker.position.set(tipX, tipY);
    marker.alpha = u >= 1 ? Math.max(0, 1 - (t - routeEnd) / 0.35) : 1;
  };

  return { timeline, duration: 3.8, update };
}

export const mapRoute: TemplateDefinition = {
  id: "map-route",
  name: "Map Route",
  tagline: "A dashed route draws across a stylized map between two pins.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.7,
  palettes: PALETTES,
  fields: [
    { key: "originLabel", type: "text", label: "From place", default: "Home", maxLength: 20, shrinkToFit: true },
    { key: "destLabel", type: "text", label: "To place", default: "Bali", maxLength: 20, shrinkToFit: true },
    { key: "distance", type: "text", label: "Distance", default: "6,742 mi", maxLength: 16, optional: true },
    { key: "showGrid", type: "toggle", label: "Coordinate grid", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

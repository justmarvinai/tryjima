import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
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
import { makeIcon } from "../shared/icons";

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
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "coastal-highway", name: "Coastal highway", colors: { background: "#EAF6FB", textColor: "#0B2A38", accent: "#E0672B" } },
  { id: "desert-mesa", name: "Desert mesa", colors: { background: "#FBF0E2", textColor: "#3A2410", accent: "#C2410C" } },
  { id: "night-drive", name: "Night drive", colors: { background: "#0E0F14", textColor: "#F2F0E8", accent: "#6FE7DC" } },
  { id: "meadow-loop", name: "Meadow loop", colors: { background: "#EEF6E9", textColor: "#16281A", accent: "#3E8C4C" } },
];

const DEFAULT_STOPS = ["Start", "Lake View", "Mountain Pass", "Finish"];

interface Pt {
  x: number;
  y: number;
}

/** Uniform Catmull-Rom segment, deterministic pure math. */
function catmullRom(p0: Pt, p1: Pt, p2: Pt, p3: Pt, u: number): Pt {
  const u2 = u * u;
  const u3 = u2 * u;
  const x = 0.5 * (2 * p1.x + (-p0.x + p2.x) * u + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * u2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * u3);
  const y = 0.5 * (2 * p1.y + (-p0.y + p2.y) * u + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * u2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * u3);
  return { x, y };
}

/** Sample a smooth winding path through `points` (padded at both ends). */
function buildSpline(points: Pt[], samplesPerSeg: number): Pt[] {
  const n = points.length;
  if (n < 2) return points.slice();
  const ext: Pt[] = [points[0]!, ...points, points[n - 1]!];
  const out: Pt[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = ext[i]!;
    const p1 = ext[i + 1]!;
    const p2 = ext[i + 2]!;
    const p3 = ext[i + 3]!;
    const startS = i === 0 ? 0 : 1;
    for (let s = startS; s <= samplesPerSeg; s++) {
      out.push(catmullRom(p0, p1, p2, p3, s / samplesPerSeg));
    }
  }
  return out;
}

/** A small side-profile car silhouette, centered at (0,0), nose pointing +X. */
function makeCar(size: number, colors: { body: string; window: string; wheel: string; outline: string }): Container {
  const c = new Container();
  const S = size;
  const body = new Graphics().roundRect(-0.5 * S, -0.16 * S, 1.0 * S, 0.34 * S, 0.14 * S).fill(colors.body);
  c.addChild(body);
  const cabin = new Graphics().roundRect(-0.14 * S, -0.34 * S, 0.5 * S, 0.22 * S, 0.1 * S).fill(colors.body);
  c.addChild(cabin);
  const win = new Graphics().roundRect(-0.07 * S, -0.29 * S, 0.34 * S, 0.13 * S, 0.06 * S).fill(colors.window);
  c.addChild(win);
  const wheelR = 0.14 * S;
  c.addChild(new Graphics().circle(-0.26 * S, 0.2 * S, wheelR).fill(colors.wheel));
  c.addChild(new Graphics().circle(0.26 * S, 0.2 * S, wheelR).fill(colors.wheel));
  c.addChild(
    new Graphics()
      .roundRect(-0.5 * S, -0.16 * S, 1.0 * S, 0.34 * S, 0.14 * S)
      .stroke({ color: colors.outline, width: Math.max(1, S * 0.025), alpha: 0.5 }),
  );
  return c;
}

function resolveStops(values: Values): string[] {
  return asItems(values.stops, DEFAULT_STOPS).slice(0, 4);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EAF6FB"));
  const textColor = str(values.textColor, pc("textColor", "#0B2A38"));
  const accent = str(values.accent, pc("accent", "#E0672B"));
  const showCar = values.showCar !== false;

  const title = str(values.title, "Weekend Road Trip");
  const stops = resolveStops(values);
  const n = Math.max(3, Math.min(4, stops.length));

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const rect = safeRect(ctx.aspect);

  // --- Title ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.06), rect.width * 0.86);
  const titleY = rect.y;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0.5, y: 0 }, align: "center" });
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 18, to: titleY, start: 0, duration: 0.55, ease: outExpo });

  // --- The winding route (fixed waypoints -> smooth spline, deterministic) ---
  const WP_FRACS: [number, number][] = [
    [0.12, 0.86],
    [0.32, 0.64],
    [0.16, 0.42],
    [0.64, 0.46],
    [0.88, 0.27],
  ];
  const waypoints: Pt[] = WP_FRACS.map(([fx, fy]) => ({ x: rect.x + fx * rect.width, y: rect.y + fy * rect.height }));
  const splinePts = buildSpline(waypoints, 28);
  const N = splinePts.length;

  const ROAD_START = 0.5;
  const ROAD_DUR = 2.0;
  const roadWidth = minDim * 0.022;
  const roadG = new Graphics();
  root.addChild(roadG);

  const carSize = minDim * 0.05;
  const car = showCar ? makeCar(carSize, { body: textColor, window: bg, wheel: textColor, outline: bg }) : null;
  if (car) {
    car.visible = false;
    root.addChild(car);
  }

  // --- Milestone stops (pins + labels) — pop in the instant the car/road
  // reaches their position along the route; scheduled as ordinary tweens since
  // each stop's spline position is fixed at build time. ---
  const pinSize = minDim * 0.05;
  stops.slice(0, n).forEach((label, i) => {
    const u = n === 1 ? 0 : i / (n - 1);
    const idx = Math.max(0, Math.min(N - 1, Math.round(u * (N - 1))));
    const p = splinePts[idx]!;

    const pinC = new Container();
    pinC.pivot.set(0, pinSize * 0.5);
    pinC.addChild(makeIcon("pin", pinSize, { color: accent, holeColor: bg }));
    pinC.position.set(p.x, p.y);
    pinC.scale.set(0);
    root.addChild(pinC);

    const labelY = p.y - pinSize * 1.15;
    const labelSize = fitSize(fonts, label, "body", 600, Math.round(minDim * 0.03), minDim * 0.22);
    const labelText = makeText(fonts, { text: label, role: "body", weight: 600, size: labelSize, color: textColor, anchor: { x: 0.5, y: 1 }, align: "center" });
    labelText.position.set(p.x, labelY);
    labelText.alpha = 0;
    root.addChild(labelText);

    const start = ROAD_START + u * ROAD_DUR;
    timeline
      .to(pinC, { prop: "scale.x", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(2.2) })
      .to(pinC, { prop: "scale.y", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(2.2) })
      .to(labelText, { prop: "alpha", from: 0, to: 1, start: start + 0.1, duration: 0.35, ease: outQuad })
      .to(labelText, { prop: "y", from: labelY + 10, to: labelY, start: start + 0.1, duration: 0.4, ease: outQuint });
  });

  // --- Per-frame: progressively draw the road + drive the car along it ---
  const update = (t: number): void => {
    const u = clamp01((t - ROAD_START) / ROAD_DUR);
    roadG.clear();
    if (u <= 0) {
      if (car) car.visible = false;
      return;
    }
    const idxF = u * (N - 1);
    const idx = Math.min(N - 1, Math.floor(idxF));
    let tipX: number;
    let tipY: number;
    let dirX = 0;
    let dirY = -1;
    if (idx < N - 1) {
      const frac = idxF - idx;
      const a = splinePts[idx]!;
      const b = splinePts[idx + 1]!;
      tipX = a.x + (b.x - a.x) * frac;
      tipY = a.y + (b.y - a.y) * frac;
      dirX = b.x - a.x;
      dirY = b.y - a.y;
    } else {
      const last = splinePts[N - 1]!;
      const prev = splinePts[N - 2]!;
      tipX = last.x;
      tipY = last.y;
      dirX = last.x - prev.x;
      dirY = last.y - prev.y;
    }

    roadG.moveTo(splinePts[0]!.x, splinePts[0]!.y);
    for (let i = 1; i <= idx; i++) roadG.lineTo(splinePts[i]!.x, splinePts[i]!.y);
    roadG.lineTo(tipX, tipY);
    roadG.stroke({ color: accent, width: roadWidth, cap: "round", join: "round" });

    // A dashed centerline (background-colored) drawn on top of the same path.
    let carry = 0;
    const dash = roadWidth * 1.5;
    const gap = roadWidth * 1.1;
    const drawDash = (x0: number, y0: number, x1: number, y1: number): void => {
      const segLen = Math.hypot(x1 - x0, y1 - y0);
      if (segLen === 0) return;
      const ux = (x1 - x0) / segLen;
      const uy = (y1 - y0) / segLen;
      let pos = 0;
      let phase = carry;
      const period = dash + gap;
      while (pos < segLen) {
        const inDash = phase < dash;
        const remain = inDash ? dash - phase : period - phase;
        const step = Math.min(remain, segLen - pos);
        if (inDash) roadG.moveTo(x0 + ux * pos, y0 + uy * pos).lineTo(x0 + ux * (pos + step), y0 + uy * (pos + step));
        pos += step;
        phase = (phase + step) % period;
      }
      carry = phase;
    };
    for (let i = 0; i < idx; i++) drawDash(splinePts[i]!.x, splinePts[i]!.y, splinePts[i + 1]!.x, splinePts[i + 1]!.y);
    drawDash(splinePts[idx]!.x, splinePts[idx]!.y, tipX, tipY);
    roadG.stroke({ color: bg, width: Math.max(1.5, roadWidth * 0.22), cap: "round" });

    if (car) {
      car.visible = true;
      car.position.set(tipX, tipY);
      car.rotation = Math.atan2(dirY, dirX);
      car.alpha = clamp01((t - ROAD_START) / 0.2);
    }
  };

  return { timeline, duration: 4.2, update };
}

export const roadTrip: TemplateDefinition = {
  id: "road-trip",
  name: "Road Trip",
  tagline: "A winding route draws in as a car passes each milestone stop.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Trip title", default: "Weekend Road Trip", maxLength: 32, shrinkToFit: true },
    { key: "stops", type: "textlist", label: "Milestone stops", default: DEFAULT_STOPS, minItems: 3, maxItems: 4, maxLength: 20, help: "3–4 stops along the route, in order." },
    { key: "showCar", type: "toggle", label: "Car marker", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

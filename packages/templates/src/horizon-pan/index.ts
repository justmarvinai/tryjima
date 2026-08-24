import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length >= 6 ? h.slice(0, 6) : h.padEnd(6, h.slice(-1) || "0");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function mixHex(a: string, b: string, u: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  let out = "#";
  for (let i = 0; i < 3; i++) {
    const v = Math.round(ca[i]! + (cb[i]! - ca[i]!) * clamp01(u));
    out += v.toString(16).padStart(2, "0");
  }
  return out;
}

const TAU = Math.PI * 2;

// `background` is the sky at the top (where the type sits — contrast is checked
// there); `horizonColor` is the sky at the skyline; the three band tones are
// the silhouette layers, far to near.
const PALETTES: Palette[] = [
  { id: "alpine-dawn", name: "Alpine dawn", colors: { background: "#E7EFF6", horizonColor: "#FBE3D0", bandFar: "#A9BCCE", bandMid: "#7C93AB", bandNear: "#4A5F78", textColor: "#16202C", accent: "#E07A4E" } },
  { id: "desert-dusk", name: "Desert dusk", colors: { background: "#2A1E2E", horizonColor: "#C2647A", bandFar: "#6B4459", bandMid: "#4A2E42", bandNear: "#2A1A2A", textColor: "#FCEFF3", accent: "#F0A868" } },
  { id: "sea-fog", name: "Sea fog", colors: { background: "#EDF3F2", horizonColor: "#CFE3E0", bandFar: "#9DB8B4", bandMid: "#6E8C88", bandNear: "#3E5754", textColor: "#0F211F", accent: "#0E7C6B" } },
  { id: "dune-gold", name: "Dune gold", colors: { background: "#FAF1E2", horizonColor: "#F3D8AE", bandFar: "#D9B98A", bandMid: "#B8905F", bandNear: "#7E5C36", textColor: "#2B1E10", accent: "#B5561F" } },
];

const PAN_DUR = 3.3;
const SKY_BANDS = 34;
const RIDGE_STEPS = 150;
const DURATION = 4.4;

const horizonFrac = (aspect: Aspect): number => (aspect === "16:9" ? 0.6 : 0.66);

/** Layered sine ridge in 0..1 — deterministic, seeded only through `ph`. */
function ridge(u: number, k: number, p0: number, p1: number, p2: number): number {
  return (
    0.5 +
    0.3 * Math.sin(u * TAU * k + p0) +
    0.14 * Math.sin(u * TAU * k * 2.3 + p1) +
    0.06 * Math.sin(u * TAU * k * 4.1 + p2)
  );
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#E7EFF6"));
  const horizonColor = str(values.horizonColor, pc("horizonColor", "#FBE3D0"));
  const bandFar = pc("bandFar", "#A9BCCE");
  const bandMid = pc("bandMid", "#7C93AB");
  const bandNear = pc("bandNear", "#4A5F78");
  const textColor = str(values.textColor, pc("textColor", "#16202C"));
  const accent = str(values.accent, pc("accent", "#E07A4E"));

  const place = str(values.place, "Reykjanes");
  const coords = str(values.coords, "63.8794° N   22.4194° W");
  const showClouds = values.showClouds !== false;
  const showCoords = values.showCoords !== false;
  const showRule = values.showRule !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const horizonY = h * horizonFrac(ctx.aspect);

  // --- Scene: sky + three silhouette bands, gliding at their own speeds ---
  const scene = new Container();
  scene.position.set(cx, h / 2);
  scene.pivot.set(cx, h / 2);
  scene.alpha = 0;
  root.addChild(scene);
  timeline
    .to(scene, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.75, ease: outQuad })
    .to(scene, { prop: "scale.x", from: 1.05, to: 1, start: 0, duration: PAN_DUR + 0.1, ease: outQuint })
    .to(scene, { prop: "scale.y", from: 1.05, to: 1, start: 0, duration: PAN_DUR + 0.1, ease: outQuint });

  const sky = new Graphics();
  const bandH = horizonY / SKY_BANDS;
  for (let i = 0; i < SKY_BANDS; i++) {
    sky.rect(-w * 0.08, i * bandH, w * 1.16, bandH + 1).fill(mixHex(bg, horizonColor, i / (SKY_BANDS - 1)));
  }
  sky.rect(-w * 0.08, horizonY, w * 1.16, h * 1.1 - horizonY).fill(horizonColor);
  scene.addChild(sky);

  // --- Thin cloud streaks, the slowest layer of all ---
  const placeSize = fitSize(fonts, place, "display", 700, Math.round(minDim * 0.082), zone.width * 0.86);
  const coordSize = fitSize(fonts, coords, "mono", 400, Math.round(minDim * 0.024), zone.width * 0.78);
  // Keep the type clear of the tallest possible ridge (far band top minus amp).
  const blockBottom = horizonY - minDim * 0.235;
  const coordY = blockBottom - coordSize * 0.5;
  const placeY = coordY - coordSize * 0.5 - minDim * 0.028 - placeSize * 0.5;
  const ruleY = placeY - placeSize * 0.62 - minDim * 0.03;

  if (showClouds) {
    const clouds = new Container();
    scene.addChild(clouds);
    const cloudTop = zone.y + minDim * 0.02;
    const cloudSpan = Math.max(minDim * 0.06, ruleY - minDim * 0.06 - cloudTop);
    const specs = [
      { fx: 0.18, fy: 0.14, wf: 0.22 },
      { fx: 0.64, fy: 0.5, wf: 0.16 },
      { fx: 0.36, fy: 0.84, wf: 0.13 },
    ];
    const g = new Graphics();
    specs.forEach((s, i) => {
      const r = rng.fork(i + 5);
      const cw = minDim * s.wf * r.range(0.85, 1.15);
      const ch = minDim * 0.008;
      const cy = cloudTop + cloudSpan * s.fy;
      // Two soft cirrus streaks per cloud read as weather, not as a white bar.
      g.roundRect(w * s.fx - cw / 2, cy, cw, ch, ch / 2).fill({ color: "#FFFFFF", alpha: 0.3 });
      const cw2 = cw * r.range(0.45, 0.66);
      g.roundRect(w * s.fx - cw / 2 + cw * r.range(0.1, 0.3), cy + ch * 2.1, cw2, ch * 0.85, ch / 2).fill({ color: "#FFFFFF", alpha: 0.18 });
    });
    clouds.addChild(g);
    timeline.to(clouds, { prop: "x", from: 0, to: -w * 0.05, start: 0, duration: PAN_DUR, ease: outQuint });
  }

  const bandSpecs = [
    { color: bandFar, top: horizonY - minDim * 0.11, amp: minDim * 0.085, k: 1.7, pan: -w * 0.1 },
    { color: bandMid, top: horizonY - minDim * 0.02, amp: minDim * 0.06, k: 2.6, pan: -w * 0.2 },
    { color: bandNear, top: horizonY + minDim * 0.07, amp: minDim * 0.045, k: 3.8, pan: -w * 0.34 },
  ];

  const x0 = -w * 0.12;
  const x1 = w * 1.55;
  bandSpecs.forEach((spec, i) => {
    const r = rng.fork(i + 21);
    const p0 = r.range(0, TAU);
    const p1 = r.range(0, TAU);
    const p2 = r.range(0, TAU);
    const g = new Graphics();
    g.moveTo(x0, spec.top - spec.amp * ridge(x0 / w, spec.k, p0, p1, p2));
    for (let s = 1; s <= RIDGE_STEPS; s++) {
      const x = x0 + ((x1 - x0) * s) / RIDGE_STEPS;
      g.lineTo(x, spec.top - spec.amp * ridge(x / w, spec.k, p0, p1, p2));
    }
    g.lineTo(x1, h * 1.1).lineTo(x0, h * 1.1).closePath().fill(spec.color);
    scene.addChild(g);
    // One long decelerating glide per layer — the pan never stops and restarts.
    timeline.to(g, { prop: "x", from: 0, to: spec.pan, start: 0, duration: PAN_DUR, ease: outQuint });
  });

  // --- Accent hairline, destination, coordinates ---
  if (showRule) {
    const ruleW = minDim * 0.09;
    const rh = Math.max(2, minDim * 0.004);
    const rule = new Graphics().rect(-ruleW / 2, -rh / 2, ruleW, rh).fill(accent);
    rule.position.set(cx, ruleY);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 2.05, duration: 0.75, ease: outExpo });
  }

  const placeText = makeText(fonts, { text: place, role: "display", weight: 700, size: placeSize, color: textColor, anchor: 0.5, align: "center" });
  placeText.position.set(cx, placeY);
  placeText.alpha = 0;
  root.addChild(placeText);
  timeline
    .to(placeText, { prop: "alpha", from: 0, to: 1, start: 2.25, duration: 0.55, ease: outQuad })
    .to(placeText, { prop: "y", from: placeY + 16, to: placeY, start: 2.25, duration: 0.7, ease: outQuint });

  if (showCoords) {
    const coordText = makeText(fonts, { text: coords, role: "mono", weight: 400, size: coordSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
    coordText.position.set(cx, coordY);
    coordText.alpha = 0;
    root.addChild(coordText);
    timeline
      .to(coordText, { prop: "alpha", from: 0, to: 0.7, start: 2.6, duration: 0.5, ease: outQuad })
      .to(coordText, { prop: "y", from: coordY + 10, to: coordY, start: 2.6, duration: 0.65, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const horizonPan: TemplateDefinition = {
  id: "horizon-pan",
  name: "Horizon",
  tagline: "A layered landscape drifts sideways and eases to rest under the destination name.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.0,
  fontRoles: { place: "display", coords: "mono" },
  palettes: PALETTES,
  fields: [
    { key: "place", type: "text", label: "Destination", default: "Reykjanes", maxLength: 22, shrinkToFit: true },
    { key: "coords", type: "text", label: "Coordinates", default: "63.8794° N   22.4194° W", maxLength: 30, shrinkToFit: true },
    { key: "showClouds", type: "toggle", label: "Cloud streaks", default: true },
    { key: "showRule", type: "toggle", label: "Accent hairline", default: true },
    { key: "showCoords", type: "toggle", label: "Coordinate line", default: true },
    { key: "background", type: "color", label: "Sky top", default: "", optional: true },
    { key: "horizonColor", type: "color", label: "Sky at horizon", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

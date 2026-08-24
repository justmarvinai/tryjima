import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inOutQuad,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

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

/** Mix two #rrggbb colors: u = 0 → a, u = 1 → b. */
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

// Scene palettes: `background` is the sky at the top of the frame (where the
// text sits — >= 4.5:1 against textColor even after the warm shift), hills are
// graduated silhouettes, warm/sun drive the sunrise.
const PALETTES: Palette[] = [
  { id: "dawn-blue", name: "Dawn blue", colors: { background: "#223354", horizonColor: "#A7C4E8", warmColor: "#FF9A57", sunColor: "#FFE9B8", hillFar: "#3D5378", hillMid: "#2C3E60", hillNear: "#1B2A47", textColor: "#FFF9EF" } },
  { id: "peach-morning", name: "Peach morning", colors: { background: "#FFE6CC", horizonColor: "#FFC291", warmColor: "#FF8E4F", sunColor: "#FFF3D0", hillFar: "#C97B4A", hillMid: "#A45B33", hillNear: "#7A3D1F", textColor: "#46220E" } },
  { id: "violet-dusk", name: "Violet dusk", colors: { background: "#2E2450", horizonColor: "#8D7BC0", warmColor: "#FF7BAB", sunColor: "#FFE9F2", hillFar: "#46386F", hillMid: "#372B59", hillNear: "#251C40", textColor: "#FBF3FF" } },
  { id: "sea-mist", name: "Sea mist", colors: { background: "#DCEEEB", horizonColor: "#B7DAD4", warmColor: "#FFB37C", sunColor: "#FFF6DC", hillFar: "#4E7F76", hillMid: "#376359", hillNear: "#22443D", textColor: "#0E2B26" } },
];

const RISE_START = 0.4;
const RISE_DUR = 2.0;
const SETTLE = 4.0; // birds glide to rest here
const DURATION = 4.4;

interface Bird {
  x0: number;
  y0: number;
  drift: number;
  bob: number;
  size: number;
  phase: number;
  flapPhase: number;
  flapSpeed: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#223354"));
  const horizonColor = pc("horizonColor", "#A7C4E8");
  const warmColor = pc("warmColor", "#FF9A57");
  const sunColor = str(values.sunColor, pc("sunColor", "#FFE9B8"));
  const hillFar = pc("hillFar", "#3D5378");
  const hillMid = pc("hillMid", "#2C3E60");
  const hillNear = pc("hillNear", "#1B2A47");
  const textColor = str(values.textColor, pc("textColor", "#FFF9EF"));

  const place = str(values.place, "Santorini");
  const tagline = str(values.tagline, "Chase the morning light");
  const showBirds = values.showBirds !== false;
  const showGlow = values.showGlow !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const horizonY = h * 0.7;

  // --- Cool sky gradient (banded — deterministic, resolution-independent) ---
  const N = 48;
  const bandH = horizonY / N;
  const coolBands = new Graphics();
  for (let i = 1; i < N; i++) {
    coolBands.rect(0, i * bandH, w, bandH + 1).fill(mixHex(bg, horizonColor, i / (N - 1)));
  }
  root.addChild(coolBands);

  // --- Warm sunrise overlay (crossfades in as the sun rises) ---
  const warmBands = new Graphics();
  for (let i = 0; i < N; i++) {
    const a = Math.pow(i / (N - 1), 1.5) * 0.85;
    if (a > 0.01) warmBands.rect(0, i * bandH, w, bandH + 1).fill({ color: warmColor, alpha: a });
  }
  warmBands.alpha = 0;
  root.addChild(warmBands);
  timeline.to(warmBands, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 1.8, ease: outQuad });

  // --- Sun (disc + glow) rising from behind the hills ---
  const sunR = minDim * 0.085;
  const sunX = w * 0.62;
  // Deep enough that the disc stays fully behind the hills even while they
  // slide up by their entrance lift.
  const sunStartY = h * 0.82;
  const sunEndY = zone.y + zone.height * 0.47;
  const sunGroup = new Container();
  sunGroup.position.set(sunX, sunStartY);
  root.addChild(sunGroup);
  if (showGlow) {
    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = warmColor;
    glow.width = glow.height = sunR * 7;
    glow.alpha = 0;
    sunGroup.addChild(glow);
    timeline.to(glow, { prop: "alpha", from: 0, to: 0.7, start: 0.6, duration: 1.6, ease: outQuad });
  }
  sunGroup.addChild(new Graphics().circle(0, 0, sunR).fill(sunColor));
  timeline.to(sunGroup, { prop: "y", from: sunStartY, to: sunEndY, start: RISE_START, duration: RISE_DUR, ease: inOutQuad });

  // --- Layered hills ---
  const amp = h * 0.03;
  const hillSpecs: { top: number; color: string; delay: number }[] = [
    { top: h * 0.66, color: hillFar, delay: 0.1 },
    { top: h * 0.745, color: hillMid, delay: 0.25 },
    { top: h * 0.84, color: hillNear, delay: 0.4 },
  ];
  hillSpecs.forEach((spec, i) => {
    const g = new Graphics();
    const y = spec.top;
    const dir = i % 2 === 0 ? 1 : -1;
    g.moveTo(0, y + amp * 0.4 * dir)
      .quadraticCurveTo(w * 0.25, y - amp * dir, w * 0.52, y + amp * 0.3 * dir)
      .quadraticCurveTo(w * 0.78, y + amp * 1.3 * dir, w, y - amp * 0.5 * dir)
      .lineTo(w, h + minDim * 0.12)
      .lineTo(0, h + minDim * 0.12)
      .closePath()
      .fill(spec.color);
    root.addChild(g);
    const lift = minDim * 0.028;
    timeline.to(g, { prop: "y", from: lift, to: 0, start: spec.delay, duration: 0.8, ease: outQuad });
  });

  // --- Birds (pure update(t): drift, bob and flap all settle before the end) ---
  const birdsG = new Graphics();
  birdsG.alpha = 0;
  root.addChild(birdsG);
  const birds: Bird[] = [];
  if (showBirds) {
    for (let i = 0; i < 2; i++) {
      const r = rng.fork(i + 7);
      // Kept left of ~0.26w so they never cross the centered title/tagline
      // (even on narrow 9:16) or the sun on the right.
      birds.push({
        x0: w * r.range(0.05, 0.14) + i * w * 0.055,
        y0: zone.y + zone.height * r.range(0.26, 0.38),
        drift: w * r.range(0.03, 0.055),
        bob: minDim * r.range(0.008, 0.016),
        size: minDim * r.range(0.014, 0.02),
        phase: r.range(0, Math.PI * 2),
        flapPhase: r.range(0, Math.PI * 2),
        flapSpeed: r.range(5.5, 7.5),
      });
    }
    timeline.to(birdsG, { prop: "alpha", from: 0, to: 0.85, start: 1.2, duration: 0.6, ease: outQuad });
  }

  // --- Destination name + tagline land in the sky ---
  const placeSize = fitSize(fonts, place, "display", 700, Math.round(minDim * 0.1), zone.width * 0.88);
  const placeY = zone.y + zone.height * 0.14 + placeSize * 0.5;
  const placeText = makeText(fonts, { text: place, role: "display", weight: 700, size: placeSize, color: textColor, anchor: 0.5, align: "center" });
  placeText.position.set(cx, placeY);
  placeText.alpha = 0;
  root.addChild(placeText);

  const tagSize = fitSize(fonts, tagline, "body", 500, Math.round(minDim * 0.032), zone.width * 0.8);
  const tagY = placeY + placeSize * 0.62 + tagSize * 0.9;
  const tagText = makeText(fonts, { text: tagline, role: "body", weight: 500, size: tagSize, color: textColor, anchor: 0.5, letterSpacing: 2 });
  tagText.position.set(cx, tagY);
  tagText.alpha = 0;
  root.addChild(tagText);

  timeline
    .to(placeText, { prop: "alpha", from: 0, to: 1, start: 2.35, duration: 0.5, ease: outQuad })
    .to(placeText, { prop: "y", from: placeY - 16, to: placeY, start: 2.35, duration: 0.6, ease: outQuint })
    .to(tagText, { prop: "alpha", from: 0, to: 0.9, start: 2.7, duration: 0.5, ease: outQuad })
    .to(tagText, { prop: "y", from: tagY - 10, to: tagY, start: 2.7, duration: 0.55, ease: outQuint });

  const update = (t: number): void => {
    if (birds.length === 0) return;
    birdsG.clear();
    for (const b of birds) {
      const driftU = outQuad(clamp01(t / SETTLE));
      const bobDamp = clamp01((SETTLE - t) / 0.8);
      const flapDamp = clamp01((SETTLE - 0.1 - t) / 0.6);
      const x = b.x0 + b.drift * driftU;
      const y = b.y0 + Math.sin(t * 1.6 + b.phase) * b.bob * bobDamp;
      const flap = Math.sin(t * b.flapSpeed + b.flapPhase) * flapDamp;
      const s = b.size;
      const wingY = s * (0.55 + 0.45 * flap);
      birdsG
        .moveTo(x - s, y)
        .quadraticCurveTo(x - s * 0.5, y - wingY, x, y)
        .quadraticCurveTo(x + s * 0.5, y - wingY, x + s, y)
        .stroke({ color: textColor, width: Math.max(2, s * 0.16), cap: "round" });
    }
  };

  return { timeline, duration: DURATION, update };
}

export const sunriseScene: TemplateDefinition = {
  id: "sunrise-scene",
  name: "Sunrise Scene",
  tagline: "A sun climbs over layered hills while the sky warms and the destination lands.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { place: "display", tagline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "place", type: "text", label: "Destination", default: "Santorini", maxLength: 22, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "Chase the morning light", maxLength: 34, shrinkToFit: true },
    { key: "showBirds", type: "toggle", label: "Birds", default: true },
    { key: "showGlow", type: "toggle", label: "Sun glow", default: true },
    { key: "background", type: "color", label: "Sky", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "sunColor", type: "color", label: "Sun", default: "", optional: true },
  ],
  build,
};

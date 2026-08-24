import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outCubic,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

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
  { id: "paper", name: "Paper map", colors: { background: "#F4F1EC", textColor: "#1E2530", accent: "#FF4D1C" } },
  { id: "mist", name: "Mist", colors: { background: "#EAEEF2", textColor: "#16202B", accent: "#2E7DF6" } },
  { id: "sage", name: "Sage", colors: { background: "#EAF0EA", textColor: "#1B2A20", accent: "#17A34A" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
];

interface L {
  landY: number;
  placeY: number;
  subY: number;
  pinSize: number;
}

function layout(aspect: Aspect, h: number, minDim: number): L {
  const f: Record<Aspect, { land: number; place: number; sub: number; pin: number }> = {
    "1:1": { land: 0.34, place: 0.58, sub: 0.69, pin: 0.19 },
    "4:5": { land: 0.34, place: 0.55, sub: 0.65, pin: 0.18 },
    "9:16": { land: 0.4, place: 0.55, sub: 0.63, pin: 0.16 },
    "16:9": { land: 0.34, place: 0.58, sub: 0.72, pin: 0.2 },
  };
  const b = f[aspect];
  return { landY: h * b.land, placeY: h * b.place, subY: h * b.sub, pinSize: minDim * b.pin };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F1EC"));
  const textColor = str(values.textColor, pc("textColor", "#1E2530"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const showMapDots = values.mapDots !== false;
  const showRipples = values.ripples !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const L = layout(ctx.aspect, h, minDim);
  const landY = L.landY;

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  // --- Faint dotted map backdrop (seeded jitter, deterministic) ---
  if (showMapDots) {
    const dots = new Graphics();
    const spacing = minDim * 0.09;
    const dotR = minDim * 0.006;
    for (let y = spacing * 0.5; y < h; y += spacing) {
      for (let x = spacing * 0.5; x < w; x += spacing) {
        const jx = rng.range(-spacing * 0.18, spacing * 0.18);
        const jy = rng.range(-spacing * 0.18, spacing * 0.18);
        dots.circle(x + jx, y + jy, dotR * rng.range(0.6, 1.3)).fill(textColor);
      }
    }
    dots.alpha = 0;
    root.addChild(dots);
    timeline.to(dots, { prop: "alpha", from: 0, to: 0.06, start: 0, duration: 0.6, ease: outQuad });
  }

  // --- Ripple rings (emitted on landing, driven purely by update) ---
  const rings: Graphics[] = [];
  const ringBaseR = L.pinSize * 0.55;
  const ringW = Math.max(3, minDim * 0.01);
  const ringStarts = [1.05, 1.25, 1.45];
  const RLIFE = 1.0;
  if (showRipples) {
    for (let i = 0; i < ringStarts.length; i++) {
      const g = new Graphics().circle(0, 0, ringBaseR).stroke({ color: accent, width: ringW });
      g.position.set(cx, landY);
      g.visible = false;
      root.addChild(g);
      rings.push(g);
    }
  }

  // --- Pin (drops, bounces, squashes onto the spot) ---
  const pinC = new Container();
  pinC.pivot.set(0, L.pinSize * 0.5); // pivot at the pin tip
  pinC.addChild(makeIcon("pin", L.pinSize, { color: accent, holeColor: bg }));
  pinC.position.set(cx, landY);
  root.addChild(pinC);
  timeline
    .to(pinC, { prop: "y", from: landY - h * 0.6, to: landY, start: 0.3, duration: 0.7, ease: makeOutBack(2) })
    // impact squash about the tip
    .to(pinC, { prop: "scale.y", from: 1, to: 0.82, start: 1.0, duration: 0.09, ease: outQuad })
    .to(pinC, { prop: "scale.y", from: 0.82, to: 1, start: 1.09, duration: 0.22, ease: outQuad })
    .to(pinC, { prop: "scale.x", from: 1, to: 1.16, start: 1.0, duration: 0.09, ease: outQuad })
    .to(pinC, { prop: "scale.x", from: 1.16, to: 1, start: 1.09, duration: 0.22, ease: outQuad })
    // gentle idle bob (ends exactly at rest for a clean hold)
    .to(pinC, { prop: "y", from: landY, to: landY - minDim * 0.012, start: 2.5, duration: 0.45, ease: outQuad })
    .to(pinC, { prop: "y", from: landY - minDim * 0.012, to: landY, start: 2.95, duration: 0.45, ease: outQuad });

  // --- Place name ---
  const placeRaw = str(values.place, "Jima HQ");
  const placeSize = fitSize(fonts, placeRaw, "display", 700, Math.round(minDim * 0.078), w * 0.82);
  const place = makeText(fonts, { text: placeRaw, role: "display", weight: 700, size: placeSize, color: textColor, anchor: 0.5, align: "center" });
  place.position.set(cx, L.placeY);
  place.alpha = 0;
  root.addChild(place);
  timeline
    .to(place, { prop: "alpha", from: 0, to: 1, start: 1.4, duration: 0.5, ease: outQuad })
    .to(place, { prop: "y", from: L.placeY + 22, to: L.placeY, start: 1.4, duration: 0.6, ease: outExpo });

  // --- Subtitle (optional) ---
  const subRaw = str(values.subtitle, "");
  if (subRaw.length > 0) {
    const subSize = fitSize(fonts, subRaw, "body", 500, Math.round(minDim * 0.036), w * 0.82);
    const sub = makeText(fonts, { text: subRaw, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center" });
    sub.position.set(cx, L.subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.72, start: 1.65, duration: 0.5, ease: outQuad })
      .to(sub, { prop: "y", from: L.subY + 16, to: L.subY, start: 1.65, duration: 0.6, ease: outExpo });
  }

  const update = (t: number): void => {
    for (let i = 0; i < rings.length; i++) {
      const g = rings[i]!;
      const tau = t - ringStarts[i]!;
      if (tau < 0 || tau > RLIFE) {
        g.visible = false;
        continue;
      }
      g.visible = true;
      const u = tau / RLIFE;
      const s = 0.3 + 1.9 * outCubic(u);
      g.scale.set(s);
      g.alpha = 0.8 * (1 - u);
    }
  };

  return { timeline, duration: 3.4, update };
}

export const locationPin: TemplateDefinition = {
  id: "location-pin",
  name: "Location Pin",
  tagline: "A map pin drops, bounces, and ripples onto the spot.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.2,
  palettes: PALETTES,
  fields: [
    { key: "place", type: "text", label: "Place", default: "Jima HQ", maxLength: 28, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "48.1371° N, 11.5754° E", maxLength: 40, optional: true },
    { key: "mapDots", type: "toggle", label: "Map dots", default: true },
    { key: "ripples", type: "toggle", label: "Ripple rings", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

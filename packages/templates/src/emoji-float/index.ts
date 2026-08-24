import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  linear,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B12", textColor: "#FFFFFF", accent: "#FF3B5C" } },
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "tiktok-dark", name: "TikTok dark", colors: { background: "#0D0D11", textColor: "#FFFFFF", accent: "#FE2C55" } },
  { id: "sunset-light", name: "Sunset light", colors: { background: "#FFF1EC", textColor: "#34120A", accent: "#FF6A3D" } },
];

// Mostly hearts, with a couple of stars/thumbs sprinkled in for variety.
const TYPES: IconName[] = ["heart", "heart", "heart", "heart", "star", "thumb"];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0B0B12"));
  const textColor = pc("textColor", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#FF3B5C"));
  const label = str(values.label, "Show some love");
  const count = Math.round(clamp(num(values.count, 12), 6, 18));

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;
  const DUR = 4.4;

  // --- Label (static headline caption; the stream rises over it) ---
  if (label.length > 0) {
    const labelBase = Math.round(minDim * (ctx.aspect === "16:9" ? 0.05 : 0.06));
    const measureDisplay = (s: string, sz: number): number => fonts.measure(s, { family: fonts.family("display"), weight: 700, size: sz });
    const labelSize = shrinkToFit(label, measureDisplay, { maxWidth: safe.width * 0.86, baseSize: labelBase, minSize: Math.round(labelBase * 0.45) });
    const labelCy = safe.y + safe.height * 0.46;
    const labelText = makeText(fonts, { text: label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: 0.5, align: "center" });
    labelText.position.set(cx, labelCy + 22);
    labelText.alpha = 0;
    root.addChild(labelText);
    timeline
      .to(labelText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.45, ease: outQuad })
      .to(labelText, { prop: "y", from: labelCy + 22, to: labelCy, start: 0.1, duration: 0.55, ease: outQuint });
  }

  // --- Particle stream: seeded once at build time; animated purely via tweens ---
  const baseY = safe.y + safe.height * 0.97;
  const topY = safe.y + safe.height * 0.04;
  const spreadX = Math.min(safe.width, minDim) * 0.42;
  const LAUNCH_WINDOW = 1.8;
  const tintPool = [accent, accent, accent, textColor];

  for (let i = 0; i < count; i++) {
    const type = rng.pick(TYPES);
    const color = rng.pick(tintPool);
    const iconSize = minDim * rng.range(0.05, 0.086);
    const xBase = cx + rng.range(-spreadX, spreadX);
    const xDrift = rng.range(-1, 1) * minDim * 0.12;
    const rise = rng.range(1.6, 2.3);
    const start = ((i + rng.range(0.1, 0.9)) / count) * LAUNCH_WINDOW;
    const rot0 = rng.range(-0.2, 0.2);
    const rot1 = rot0 + rng.range(-0.5, 0.5);

    const icon = makeIcon(type, iconSize, { color });
    icon.position.set(xBase, baseY);
    icon.alpha = 0;
    icon.scale.set(0.5);
    icon.rotation = rot0;
    root.addChild(icon);

    const popDur = Math.min(0.3, rise * 0.25);
    const fadeDur = rise * 0.32;
    const midT = start + rise * 0.5;

    timeline
      .to(icon, { prop: "alpha", from: 0, to: 1, start, duration: popDur, ease: outQuad })
      .to(icon, { prop: "alpha", from: 1, to: 0, start: start + rise - fadeDur, duration: fadeDur, ease: outQuad })
      .to(icon, { prop: "scale.x", from: 0.5, to: 1, start, duration: popDur, ease: outQuad })
      .to(icon, { prop: "scale.y", from: 0.5, to: 1, start, duration: popDur, ease: outQuad })
      .to(icon, { prop: "y", from: baseY, to: baseY - (baseY - topY) * 0.5, start, duration: rise * 0.5, ease: outQuad })
      .to(icon, { prop: "y", from: baseY - (baseY - topY) * 0.5, to: topY, start: midT, duration: rise * 0.5, ease: linear })
      .to(icon, { prop: "x", from: xBase, to: xBase + xDrift, start, duration: rise, ease: outQuad })
      .to(icon, { prop: "rotation", from: rot0, to: rot1, start, duration: rise, ease: outQuad });
  }

  return { timeline, duration: DUR };
}

export const emojiFloat: TemplateDefinition = {
  id: "emoji-float",
  name: "Reaction Float",
  tagline: "Hearts and reactions rise in a lively, staggered stream.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { label: "display" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Show some love", maxLength: 30, optional: true, shrinkToFit: true },
    { key: "count", type: "slider", label: "Reaction count", default: 12, min: 6, max: 18, step: 1 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Heart color", default: "", optional: true },
  ],
  build,
};

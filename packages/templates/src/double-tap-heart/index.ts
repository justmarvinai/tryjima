import { Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  inQuad,
  spring,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { radialGlowTexture } from "../shared/glow";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Parse a like count that may use a K/M/B suffix ("2.3K" → 2300). */
function parseLikes(s: string): { value: number; compact: boolean } {
  const m = /^\s*([\d.,]+)\s*([kmb])?/i.exec(s);
  if (!m) return { value: 0, compact: false };
  let v = Number(m[1]!.replace(/,/g, ""));
  if (!Number.isFinite(v)) v = 0;
  const suf = (m[2] ?? "").toLowerCase();
  if (suf === "k") v *= 1e3;
  else if (suf === "m") v *= 1e6;
  else if (suf === "b") v *= 1e9;
  return { value: Math.round(v), compact: suf !== "" };
}

function trimDot(s: string): string {
  return s.endsWith(".0") ? s.slice(0, -2) : s;
}
function fmtLikes(n: number, compact: boolean): string {
  if (!compact) return groupThousands(n);
  if (n >= 1_000_000) return trimDot((n / 1_000_000).toFixed(1)) + "M";
  if (n >= 1_000) return trimDot((n / 1_000).toFixed(1)) + "K";
  return String(n);
}

const PALETTES: Palette[] = [
  { id: "dark-rose", name: "Dark rose", colors: { background: "#0B0B0F", accent: "#FF3B5C", glow1: "#FF3B5C", glow2: "#7A2BFF", textColor: "#FFFFFF" } },
  { id: "ember", name: "Ember", colors: { background: "#0E0C0A", accent: "#FF4D1C", glow1: "#FF4D1C", glow2: "#FF8A3D", textColor: "#FFFFFF" } },
  { id: "dusk", name: "Dusk", colors: { background: "#14121F", accent: "#FF4D1C", glow1: "#7C5CFF", glow2: "#FF4D1C", textColor: "#FFFFFF" } },
  { id: "night-pink", name: "Night pink", colors: { background: "#101014", accent: "#FF2E9E", glow1: "#FF2E9E", glow2: "#2E7DF6", textColor: "#FFFFFF" } },
];

function cyFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.5 : 0.44;
}
function countFrac(aspect: Aspect): number {
  return aspect === "9:16" ? 0.74 : 0.89;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0B0B0F"));
  const accent = str(values.accent, pc("accent", "#FF3B5C"));
  const glow1 = pc("glow1", accent);
  const glow2 = pc("glow2", "#7A2BFF");
  const textColor = pc("textColor", "#FFFFFF");
  const caption = str(values.caption, "");
  const likeInfo = parseLikes(str(values.likes, "2.3K"));
  const showGlow = values.glow !== false;

  const DUR = 3.0;
  const cx = size.width / 2;
  const cy = size.height * cyFrac(ctx.aspect);
  const minDim = Math.min(size.width, size.height);
  const maxDim = Math.max(size.width, size.height);
  const timeline = new JimaTimeline();

  // Soft gradient background (static → loop-safe).
  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));
  if (showGlow) {
    const glowTex = radialGlowTexture();
    const s1 = new Sprite(glowTex);
    s1.anchor.set(0.5);
    s1.tint = glow1;
    s1.width = s1.height = maxDim * 1.1;
    s1.alpha = 0.45;
    s1.position.set(size.width * 0.3, size.height * 0.32);
    root.addChild(s1);
    const s2 = new Sprite(glowTex);
    s2.anchor.set(0.5);
    s2.tint = glow2;
    s2.width = s2.height = maxDim * 1.0;
    s2.alpha = 0.4;
    s2.position.set(size.width * 0.72, size.height * 0.7);
    root.addChild(s2);
  }

  // Big heart: pops in, gives a beat, fades out before the loop point.
  const heartSize = minDim * (ctx.aspect === "16:9" ? 0.34 : 0.42);
  const heart = makeIcon("heart", heartSize, { color: textColor });
  heart.position.set(cx, cy);
  heart.alpha = 0;
  heart.scale.set(0.5);
  root.addChild(heart);
  const POP = 0.15;
  timeline
    .to(heart, { prop: "alpha", from: 0, to: 1, start: POP, duration: 0.3, ease: outQuad })
    .to(heart, { prop: "scale.x", from: 0.5, to: 1, start: POP, duration: 0.6, ease: spring(0.4) })
    .to(heart, { prop: "scale.y", from: 0.5, to: 1, start: POP, duration: 0.6, ease: spring(0.4) })
    // gentle secondary beat
    .to(heart, { prop: "scale.x", from: 1, to: 1.09, start: 1.15, duration: 0.16, ease: outQuad })
    .to(heart, { prop: "scale.y", from: 1, to: 1.09, start: 1.15, duration: 0.16, ease: outQuad })
    .to(heart, { prop: "scale.x", from: 1.09, to: 1, start: 1.31, duration: 0.3, ease: outQuad })
    .to(heart, { prop: "scale.y", from: 1.09, to: 1, start: 1.31, duration: 0.3, ease: outQuad })
    // fade out so frame(DUR) ≈ frame(0)
    .to(heart, { prop: "alpha", from: 1, to: 0, start: DUR - 0.45, duration: 0.4, ease: inQuad });

  // Ring of little hearts bursting outward (interior window → recycles cleanly).
  const bursts: { g: Graphics; ang: number; dist: number; spin: number }[] = [];
  const BN = 8;
  for (let i = 0; i < BN; i++) {
    const hs = minDim * rng.range(0.05, 0.085);
    const g = makeIcon("heart", hs, { color: rng.pick([accent, textColor]) });
    g.position.set(cx, cy);
    g.visible = false;
    root.addChild(g);
    const ang = (i / BN) * Math.PI * 2 + rng.range(-0.2, 0.2);
    const dist = minDim * rng.range(0.28, 0.42);
    bursts.push({ g, ang, dist, spin: rng.range(-0.5, 0.5) });
  }
  const BURST = POP + 0.05;
  const BLIFE = 1.4;

  // Like count (bottom), fades in/out around an interior tick-up.
  const countSize = Math.round(minDim * 0.06);
  const countY = size.height * countFrac(ctx.aspect);
  const numTx = makeText(fonts, { text: fmtLikes(likeInfo.value, likeInfo.compact), role: "display", weight: 700, size: countSize, color: textColor, anchor: 0.5 });
  numTx.position.set(cx, countY);
  numTx.alpha = 0;
  root.addChild(numTx);
  timeline
    .to(numTx, { prop: "alpha", from: 0, to: 1, start: 0.4, duration: 0.4, ease: outQuad })
    .to(numTx, { prop: "alpha", from: 1, to: 0, start: DUR - 0.4, duration: 0.35, ease: inQuad });

  if (caption.length > 0) {
    const capSize = Math.round(minDim * 0.038);
    const capY = countY - countSize * 1.3;
    const capTx = makeText(fonts, { text: caption, role: "body", weight: 500, size: capSize, color: textColor, anchor: 0.5, align: "center" });
    capTx.position.set(cx, capY);
    capTx.alpha = 0;
    root.addChild(capTx);
    timeline
      .to(capTx, { prop: "alpha", from: 0, to: 0.9, start: 0.6, duration: 0.4, ease: outQuad })
      .to(capTx, { prop: "alpha", from: 0.9, to: 0, start: DUR - 0.4, duration: 0.35, ease: inQuad });
  }

  const cStart = 0.4;
  const cEnd = 1.7;
  const update = (t: number) => {
    const u = t <= cStart ? 0 : t >= cEnd ? 1 : (t - cStart) / (cEnd - cStart);
    const eased = 1 - Math.pow(1 - u, 3);
    numTx.text = fmtLikes(Math.round(likeInfo.value * eased), likeInfo.compact);
    for (const b of bursts) {
      const tau = t - BURST;
      if (tau < 0 || tau > BLIFE) {
        b.g.visible = false;
        continue;
      }
      const p = clamp01(tau / BLIFE);
      const grow = 1 - Math.pow(1 - p, 3);
      b.g.visible = true;
      b.g.x = cx + Math.cos(b.ang) * b.dist * grow;
      b.g.y = cy + Math.sin(b.ang) * b.dist * grow - minDim * 0.15 * p;
      b.g.alpha = 1 - p;
      b.g.rotation = b.spin * p;
      const sc = 0.5 + 0.5 * clamp01(tau / 0.2);
      b.g.scale.set(sc);
    }
  };

  return { timeline, duration: DUR, update };
}

export const doubleTapHeart: TemplateDefinition = {
  id: "double-tap-heart",
  name: "Double-Tap Heart",
  tagline: "The double-tap heart pops and bursts on a glowing loop.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: true,
  posterTime: 1.4,
  palettes: PALETTES,
  fields: [
    { key: "caption", type: "text", label: "Caption", default: "You liked this", maxLength: 60, optional: true },
    { key: "likes", type: "text", label: "Likes", default: "2.3K", maxLength: 10, help: "Counts up. Use K/M for compact (2.3K)." },
    { key: "glow", type: "toggle", label: "Glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

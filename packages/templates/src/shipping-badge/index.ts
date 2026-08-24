import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

// Accent shades are deliberately darker than the "brand orange/pink" used
// elsewhere so white badge text/icon clears the 4.5:1 end-frame rule
// (verified: onAccent #FFFFFF vs these exact hexes all land >=4.5:1).
const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", accent: "#B8330E", onAccent: "#FFFFFF", textColor: "#2A0F06" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", accent: "#B8330E", onAccent: "#FFFFFF", textColor: "#FFFFFF" } },
  { id: "royal", name: "Royal", colors: { background: "#EEF2FF", accent: "#3455E6", onAccent: "#FFFFFF", textColor: "#0B1E52" } },
  { id: "berry", name: "Berry", colors: { background: "#FFEEF6", accent: "#B8106B", onAccent: "#FFFFFF", textColor: "#3A0A28" } },
];

/** Create text, shrinking font size until it fits within `maxWidth`. */
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

/** Shrink font size until `text`, arced at `radius`, fits within `maxAngle` radians. */
function fitArcSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  radius: number,
  maxAngle: number,
): number {
  let s = size;
  for (let i = 0; i < 10; i++) {
    const w = fonts.measure(text, { family: fonts.family(role), weight, size: s });
    if (w / radius <= maxAngle || s <= 10) return s;
    s = Math.max(10, Math.floor(s * 0.92));
  }
  return s;
}

interface ArcChar {
  char: string;
  angle: number;
}

/**
 * Place each glyph of `text` along a circle of `radius`, centered on
 * `centerAngle` (radians; 0 = 3 o'clock, increasing clockwise since +y is
 * down). Returns per-glyph angle; callers rotate each glyph by angle+90deg so
 * it reads upright and tangent to the curve (verified: at centerAngle = -90deg
 * / top-of-circle, that rotation is exactly 0 = upright).
 */
function arcCharAngles(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  radius: number,
  centerAngle: number,
): ArcChar[] {
  const style = { family: fonts.family(role), weight, size };
  const measure = (s: string) => fonts.measure(s, style);
  const total = measure(text);
  const totalAngle = total / radius;
  let cursor = centerAngle - totalAngle / 2;
  const out: ArcChar[] = [];
  let prev = 0;
  for (let i = 0; i < text.length; i++) {
    const upto = measure(text.slice(0, i + 1));
    const charW = upto - prev;
    const dAngle = charW / radius;
    out.push({ char: text[i]!, angle: cursor + dAngle / 2 });
    cursor += dAngle;
    prev = upto;
  }
  return out;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const accent = str(values.accent, pc("accent", "#B8330E"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#2A0F06"));
  const label = str(values.label, "FREE SHIPPING");
  const sublabel = str(values.sublabel, "on all orders");
  const showRing = values.showRing !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const cy = h * 0.43;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const R = minDim * 0.28;

  // --- Impact ring (draws itself around the badge) ---
  let ringArc: Graphics | null = null;
  const ringR = R * 1.16;
  const ringW = Math.max(3, R * 0.032);
  const RING_START = 0.28;
  const RING_DUR = 0.9;
  if (showRing) {
    ringArc = new Graphics();
    ringArc.position.set(cx, cy);
    root.addChild(ringArc);
  }

  // --- Badge (seal + icon + arced label), stamped as one unit ---
  const badge = new Container();
  badge.position.set(cx, cy);
  const SCALE_FROM = 0.55;
  const ROT_FROM = -9 * DEG;
  badge.scale.set(SCALE_FROM);
  badge.rotation = ROT_FROM;
  badge.alpha = 0;
  root.addChild(badge);

  badge.addChild(new Graphics().circle(0, 0, R).fill(accent));
  badge.addChild(
    new Graphics().circle(0, 0, R * 0.86).stroke({ color: onAccent, width: Math.max(2, R * 0.024), alpha: 0.5 }),
  );

  const iconSize = R * 0.6;
  const icon = makeIcon("cart", iconSize, { color: onAccent });
  icon.position.set(0, R * 0.18);
  badge.addChild(icon);

  // Arced label along the top inner rim.
  const arcRadius = R * 0.72;
  const baseLabelSize = Math.round(R * 0.165);
  const labelSize = fitArcSize(fonts, label, "display", 700, baseLabelSize, arcRadius, 150 * DEG);
  const arcChars = arcCharAngles(fonts, label, "display", 700, labelSize, arcRadius, -90 * DEG);
  for (const c of arcChars) {
    if (c.char.trim().length === 0) continue;
    const t = makeText(fonts, { text: c.char, role: "display", weight: 700, size: labelSize, color: onAccent, anchor: 0.5 });
    t.position.set(Math.cos(c.angle) * arcRadius, Math.sin(c.angle) * arcRadius);
    t.rotation = c.angle + Math.PI / 2;
    badge.addChild(t);
  }

  const STAMP = 0.35;
  timeline
    .to(badge, { prop: "alpha", from: 0, to: 1, start: STAMP, duration: 0.16, ease: outQuad })
    .to(badge, { prop: "scale.x", from: SCALE_FROM, to: 1, start: STAMP, duration: 0.5, ease: makeOutBack(1.7) })
    .to(badge, { prop: "scale.y", from: SCALE_FROM, to: 1, start: STAMP, duration: 0.5, ease: makeOutBack(1.7) })
    .to(badge, { prop: "rotation", from: ROT_FROM, to: 0, start: STAMP, duration: 0.5, ease: makeOutBack(1.7) });

  // --- Sublabel caption (below the badge, on the page background) ---
  if (sublabel.length > 0) {
    const subSize = fitSize(fonts, sublabel, "body", 600, Math.round(minDim * 0.042), w * 0.8);
    const subY = cy + R * 1.5;
    const sub = makeText(fonts, { text: sublabel, role: "body", weight: 600, size: subSize, color: textColor, anchor: 0.5, align: "center" });
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 1, start: 1.1, duration: 0.5, ease: outQuad })
      .to(sub, { prop: "y", from: subY + 14, to: subY, start: 1.1, duration: 0.5, ease: outQuint });
  }

  const ring = ringArc;
  const update = (t: number): void => {
    if (!ring) return;
    const p = outExpo(clamp01((t - RING_START) / RING_DUR));
    ring.clear();
    if (p > 0.001) {
      const end = -Math.PI / 2 + p * Math.PI * 2;
      ring.arc(0, 0, ringR, -Math.PI / 2, end).stroke({ color: accent, width: ringW, cap: "round" });
    }
  };

  return { timeline, duration: 3.8, update };
}

export const shippingBadge: TemplateDefinition = {
  id: "shipping-badge",
  name: "Shipping Badge",
  tagline: "A free-shipping seal stamps down with a drawn ring.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "FREE SHIPPING", maxLength: 24, shrinkToFit: true },
    { key: "sublabel", type: "text", label: "Sublabel", default: "on all orders", maxLength: 32, optional: true, shrinkToFit: true },
    { key: "showRing", type: "toggle", label: "Ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

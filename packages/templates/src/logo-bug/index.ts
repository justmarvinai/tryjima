import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  makeOutBack,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** "Jima Motion" -> "JM"; a single word falls back to its first two letters. */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]!.slice(0, 1) + parts[1]!.slice(0, 1)).toUpperCase();
}

/** WCAG-2 relative luminance of a #rrggbb color (0..1). */
function relLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const lin = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}
function contrastOf(l1: number, l2: number): number {
  return l1 >= l2 ? (l1 + 0.05) / (l2 + 0.05) : (l2 + 0.05) / (l1 + 0.05);
}
/** Whichever of near-black / white actually contrasts best against a fill (WCAG-checked, not assumed). */
function bestTextOn(bgHex: string): string {
  const L = relLuminance(bgHex);
  return contrastOf(L, 1) >= contrastOf(L, relLuminance("#101014")) ? "#FFFFFF" : "#101014";
}

type Corner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

// A TV-channel corner "logo bug" watermark — a monogram (from a brand name's
// initials) fades and scales into a rounded badge, then idles with a subtle
// breathing pulse. Only the full-frame `bg` rect is tied to the background
// field (defaults to the transparent sentinel so it composites straight onto
// footage); the badge itself is filled with the (user-editable) accent, with
// the monogram color picked dynamically so it always reads clearly on it.
const PALETTES: Palette[] = [
  { id: "channel-onyx", name: "Channel onyx", colors: { accent: "#FF4D1C", textColor: "#FFFFFF" } },
  { id: "channel-cobalt", name: "Channel cobalt", colors: { accent: "#1B3A8A", textColor: "#FFFFFF" } },
  { id: "channel-moss", name: "Channel moss", colors: { accent: "#17A34A", textColor: "#FFFFFF" } },
  { id: "channel-grape", name: "Channel grape", colors: { accent: "#4A2FC9", textColor: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const glowColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const brand = str(values.brand, "Jima");
  const corner = str(values.corner, "top-right") as Corner;
  const showPulse = values.showPulse !== false;

  const monogram = initialsOf(brand) || "JM";
  const onAccent = bestTextOn(accent);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const badgeR = Math.round(minDim * 0.052);
  const monogramSize = Math.round(badgeR * 0.92);

  const isTop = corner === "top-left" || corner === "top-right";
  const isLeft = corner === "top-left" || corner === "bottom-left";
  const margin = Math.round(minDim * 0.028);
  const restX = isLeft ? zone.left + margin + badgeR : w - zone.right - margin - badgeR;
  const restY = isTop ? zone.top + margin + badgeR : h - zone.bottom - margin - badgeR;

  const badge = new Container();
  badge.position.set(restX, restY);
  badge.alpha = 0;
  badge.scale.set(0.5);
  root.addChild(badge);

  // Soft breathing glow, behind the badge fill (toggleable).
  let glow: Graphics | undefined;
  if (showPulse) {
    glow = new Graphics().circle(0, 0, badgeR).stroke({ color: glowColor, width: Math.max(2, badgeR * 0.1) });
    glow.alpha = 0;
    badge.addChild(glow);
  }

  badge.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));
  const monogramText = makeText(fonts, {
    text: monogram,
    role: "display",
    weight: 700,
    size: monogramSize,
    color: onAccent,
    anchor: 0.5,
  });
  badge.addChild(monogramText);

  const enterStart = 0.12;
  const enterDur = 0.55;
  timeline
    .to(badge, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.3, ease: outQuad })
    .to(badge, { prop: "scale.x", from: 0.5, to: 1, start: enterStart, duration: enterDur, ease: makeOutBack(1.8) })
    .to(badge, { prop: "scale.y", from: 0.5, to: 1, start: enterStart, duration: enterDur, ease: makeOutBack(1.8) });

  // --- Idle breathing pulse (toggleable): the whole badge scales gently, with
  // a soft glow ring breathing behind it. Fully static (locked at rest scale)
  // when disabled. ---
  const landTime = enterStart + enterDur;
  const PULSE_PERIOD = 2.6;
  const update = (t: number): void => {
    if (!showPulse) return;
    if (t < landTime) return;
    const u = ((t - landTime) % PULSE_PERIOD) / PULSE_PERIOD;
    const wave = Math.sin(u * Math.PI * 2);
    badge.scale.set(1 + 0.035 * wave);
    if (glow) {
      glow.scale.set(1 + 0.22 * (0.5 + 0.5 * wave));
      glow.alpha = 0.22 + 0.22 * (0.5 + 0.5 * wave);
    }
  };

  return { timeline, duration: 3.6, update };
}

export const logoBug: TemplateDefinition = {
  id: "logo-bug",
  name: "Logo Bug",
  tagline: "A monogram watermark fades into a corner and idles with a soft pulse.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { brand: "display" },
  palettes: PALETTES,
  fields: [
    { key: "brand", type: "text", label: "Brand / channel name", default: "Jima", maxLength: 30, help: "Only the initials show, e.g. “Jima Motion” → “JM”." },
    {
      key: "corner",
      type: "select",
      label: "Corner",
      default: "top-right",
      options: [
        { value: "top-left", label: "Top left" },
        { value: "top-right", label: "Top right" },
        { value: "bottom-left", label: "Bottom left" },
        { value: "bottom-right", label: "Bottom right" },
      ],
    },
    { key: "showPulse", type: "toggle", label: "Breathing pulse", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Glow", default: "", optional: true },
    { key: "accent", type: "color", label: "Badge color", default: "", optional: true },
  ],
  build,
};

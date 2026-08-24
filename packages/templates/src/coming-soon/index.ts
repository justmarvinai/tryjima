import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

// A teaser: kicker + big brand + a thin sweeping underline + a date. Text in the
// palette text color (≥4.5:1 everywhere); the kicker and sweep use the accent,
// which is dark enough on each light background to stay legible too.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FA", textColor: "#0F1420", accent: "#3B4FD6" } },
  { id: "cream", name: "Cream", colors: { background: "#FBF6EF", textColor: "#241A12", accent: "#C2410C" } },
  { id: "blush", name: "Blush", colors: { background: "#FDEEF4", textColor: "#2A0E1C", accent: "#BE185D" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C1018", textColor: "#F2F5FA", accent: "#6EA8FE" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#0F1420"));
  const accent = str(values.accent, pc("accent", "#3B4FD6"));

  const kicker = str(values.kicker, "Coming Soon").toUpperCase();
  const brand = str(values.brand, "Jima Motion");
  const date = str(values.date, "March 2026").toUpperCase();
  const showFrame = values.showFrame !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height * 0.5;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Thin inset frame (decorative) ---
  if (showFrame) {
    const inset = minDim * 0.06;
    const fx = zone.x + inset;
    const fy = zone.y + inset;
    const fw = zone.width - inset * 2;
    const fh = zone.height - inset * 2;
    const frame = new Graphics()
      .roundRect(fx, fy, fw, fh, minDim * 0.02)
      .stroke({ color: accent, width: Math.max(2, minDim * 0.004), alpha: 0.55 });
    frame.alpha = 0;
    root.addChild(frame);
    timeline.to(frame, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.6, ease: outQuad });
  }

  // --- Kicker ---
  const kickerSize = fitSize(fonts, kicker, "body", 600, Math.round(minDim * 0.03), zone.width * 0.8);
  const kickerY = cy - minDim * 0.15;
  const kickerText = makeText(fonts, { text: kicker, role: "body", weight: 600, size: kickerSize, color: accent, anchor: 0.5, letterSpacing: 6 });
  kickerText.position.set(cx, kickerY);
  kickerText.alpha = 0;
  root.addChild(kickerText);
  timeline
    .to(kickerText, { prop: "alpha", from: 0, to: 1, start: 0.25, duration: 0.5, ease: outQuad })
    .to(kickerText, { prop: "style.letterSpacing", from: kickerSize * 0.5, to: 6, start: 0.25, duration: 0.6, ease: outExpo });

  // --- Brand (hero) ---
  const brandSize = fitSize(fonts, brand, "display", 700, Math.round(minDim * 0.1), zone.width * 0.9);
  const brandText = makeText(fonts, { text: brand, role: "display", weight: 700, size: brandSize, color: textColor, anchor: 0.5 });
  brandText.position.set(cx, cy);
  brandText.alpha = 0;
  root.addChild(brandText);
  timeline
    .to(brandText, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.5, ease: outQuad })
    .to(brandText, { prop: "y", from: cy + 24, to: cy, start: 0.5, duration: 0.6, ease: outExpo });

  // --- Sweeping underline ---
  const ruleY = cy + brandSize * 0.72;
  const ruleW = Math.min(zone.width * 0.6, minDim * 0.42);
  const rule = new Graphics().roundRect(-ruleW / 2, -Math.max(1.5, minDim * 0.004), ruleW, Math.max(3, minDim * 0.008), 3).fill(accent);
  rule.position.set(cx, ruleY);
  rule.scale.set(0, 1);
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 1.0, duration: 0.7, ease: outExpo });

  // --- Date ---
  const dateSize = fitSize(fonts, date, "body", 600, Math.round(minDim * 0.028), zone.width * 0.8);
  const dateY = ruleY + dateSize * 1.5;
  const dateText = makeText(fonts, { text: date, role: "body", weight: 600, size: dateSize, color: textColor, anchor: 0.5, letterSpacing: 3 });
  dateText.position.set(cx, dateY);
  dateText.alpha = 0;
  root.addChild(dateText);
  timeline
    .to(dateText, { prop: "alpha", from: 0, to: 0.85, start: 1.35, duration: 0.45, ease: outQuad })
    .to(dateText, { prop: "y", from: dateY + 10, to: dateY, start: 1.35, duration: 0.45, ease: outQuint });

  return { timeline, duration: 4.0 };
}

export const comingSoon: TemplateDefinition = {
  id: "coming-soon",
  name: "Coming Soon",
  tagline: "A teaser with a kicker, brand, sweeping underline, and date.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { brand: "display" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "Coming Soon", maxLength: 24, shrinkToFit: true },
    { key: "brand", type: "text", label: "Brand", default: "Jima Motion", maxLength: 22, shrinkToFit: true },
    { key: "date", type: "text", label: "Date", default: "March 2026", maxLength: 24, shrinkToFit: true },
    { key: "showFrame", type: "toggle", label: "Frame", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

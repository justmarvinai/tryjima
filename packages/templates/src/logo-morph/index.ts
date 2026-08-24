import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  makeOutBack,
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

// A circle morphs (rotate + scale crossfade) into the initials tile, then the
// wordmark drops in. Deep `mark` tile + white `onMark` keep the initials ≥4.5:1.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FA", textColor: "#0F1420", accent: "#3B4FD6", mark: "#3B4FD6", onMark: "#FFFFFF" } },
  { id: "cream", name: "Cream", colors: { background: "#FBF6EF", textColor: "#241A12", accent: "#C2410C", mark: "#C2410C", onMark: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#EAF7F0", textColor: "#0B241A", accent: "#0A6B3A", mark: "#0A6B3A", onMark: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C1018", textColor: "#F2F5FA", accent: "#6EA8FE", mark: "#6EA8FE", onMark: "#0C1018" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#0F1420"));
  const accent = str(values.accent, pc("accent", "#3B4FD6"));
  const mark = pc("mark", "#3B4FD6");
  const onMark = pc("onMark", "#FFFFFF");

  const initials = str(values.initials, "JM").slice(0, 3).toUpperCase();
  const brand = str(values.brand, "Jima Motion");
  const showRing = values.showRing !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height * 0.42;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const tile = Math.round(minDim * 0.3);
  const tileR = Math.round(tile * 0.22);
  const circleR = tile * 0.5;

  // Decorative ring expanding once behind the mark.
  if (showRing) {
    const ring = new Graphics().circle(0, 0, tile * 0.78).stroke({ color: accent, width: Math.max(3, tile * 0.02) });
    ring.position.set(cx, cy);
    ring.alpha = 0;
    ring.scale.set(0.5);
    root.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 0.55, start: 0.7, duration: 0.4, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0.55, to: 0, start: 1.2, duration: 0.6, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.5, to: 1.2, start: 0.7, duration: 0.9, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.5, to: 1.2, start: 0.7, duration: 0.9, ease: outExpo });
  }

  // --- Morph shape A: circle ---
  const circle = new Graphics().circle(0, 0, circleR).fill(accent);
  circle.position.set(cx, cy);
  circle.scale.set(0);
  root.addChild(circle);
  timeline
    .to(circle, { prop: "scale.x", from: 0, to: 1, start: 0.05, duration: 0.55, ease: spring(0.5) })
    .to(circle, { prop: "scale.y", from: 0, to: 1, start: 0.05, duration: 0.55, ease: spring(0.5) })
    .to(circle, { prop: "rotation", from: 0, to: Math.PI * 0.5, start: 0.65, duration: 0.45, ease: outExpo })
    .to(circle, { prop: "scale.x", from: 1, to: 0.7, start: 0.78, duration: 0.32, ease: outQuad })
    .to(circle, { prop: "scale.y", from: 1, to: 0.7, start: 0.78, duration: 0.32, ease: outQuad })
    .to(circle, { prop: "alpha", from: 1, to: 0, start: 0.82, duration: 0.28, ease: outQuad });

  // --- Morph shape B: rounded tile (+ initials) ---
  const tileNode = new Container();
  tileNode.position.set(cx, cy);
  tileNode.alpha = 0;
  tileNode.rotation = -0.5;
  tileNode.scale.set(0.55);
  root.addChild(tileNode);
  tileNode.addChild(new Graphics().roundRect(-tile / 2, -tile / 2, tile, tile, tileR).fill(mark));
  const initSize = fitSize(fonts, initials, "display", 700, Math.round(tile * 0.5), tile * 0.72);
  const initText = makeText(fonts, { text: initials, role: "display", weight: 700, size: initSize, color: onMark, anchor: 0.5 });
  initText.alpha = 0;
  tileNode.addChild(initText);
  timeline
    .to(tileNode, { prop: "alpha", from: 0, to: 1, start: 0.78, duration: 0.3, ease: outQuad })
    .to(tileNode, { prop: "rotation", from: -0.5, to: 0, start: 0.72, duration: 0.5, ease: makeOutBack(1.6) })
    .to(tileNode, { prop: "scale.x", from: 0.55, to: 1, start: 0.72, duration: 0.5, ease: spring(0.5) })
    .to(tileNode, { prop: "scale.y", from: 0.55, to: 1, start: 0.72, duration: 0.5, ease: spring(0.5) })
    .to(initText, { prop: "alpha", from: 0, to: 1, start: 1.15, duration: 0.35, ease: outQuad });

  // --- Wordmark ---
  const brandSize = fitSize(fonts, brand, "display", 600, Math.round(minDim * 0.058), zone.width * 0.86);
  const brandY = cy + tile / 2 + brandSize * 1.05;
  const brandText = makeText(fonts, { text: brand, role: "display", weight: 600, size: brandSize, color: textColor, anchor: 0.5, letterSpacing: 0.5 });
  brandText.position.set(cx, brandY);
  brandText.alpha = 0;
  root.addChild(brandText);
  timeline
    .to(brandText, { prop: "alpha", from: 0, to: 1, start: 1.45, duration: 0.4, ease: outQuad })
    .to(brandText, { prop: "y", from: brandY + 16, to: brandY, start: 1.45, duration: 0.5, ease: outExpo });

  return { timeline, duration: 4.0 };
}

export const logoMorph: TemplateDefinition = {
  id: "logo-morph",
  name: "Logo Morph",
  tagline: "A circle morphs into the initials mark, then the wordmark drops in.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { brand: "display" },
  palettes: PALETTES,
  fields: [
    { key: "initials", type: "text", label: "Initials", default: "JM", maxLength: 3, shrinkToFit: true },
    { key: "brand", type: "text", label: "Brand", default: "Jima Motion", maxLength: 28, shrinkToFit: true },
    { key: "showRing", type: "toggle", label: "Accent ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

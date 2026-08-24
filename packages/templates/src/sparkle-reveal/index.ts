import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  safeRect,
  type Aspect,
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
const on = (v: unknown): boolean => v !== false;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

/** A 4-point sparkle (concave diamond star) centered at origin. */
function drawSparkle(s: number, color: string): Graphics {
  const g = new Graphics();
  const inner = s * 0.24;
  const pts: number[] = [];
  for (let k = 0; k < 8; k++) {
    const ang = (k * Math.PI) / 4;
    const rad = k % 2 === 0 ? s : inner;
    pts.push(Math.cos(ang) * rad, Math.sin(ang) * rad);
  }
  return g.poly(pts).fill(color);
}

// An elegant shimmer: seeded sparkles twinkle across an off-white stage and the
// title fades in with a soft shine sweep. Light throughout; the accent is the
// sparkles + shine, the held title is dark on the background (>= 4.5:1).
const PALETTES: Palette[] = [
  { id: "champagne", name: "Champagne", colors: { background: "#FBF7EF", textColor: "#1A140A", accent: "#D9A21B" } },
  { id: "rose-gold", name: "Rose gold", colors: { background: "#FCF3F2", textColor: "#241014", accent: "#E06A7A" } },
  { id: "frost", name: "Frost", colors: { background: "#F0F6FB", textColor: "#0F2033", accent: "#3E9AD6" } },
  { id: "lilac", name: "Lilac", colors: { background: "#F6F2FB", textColor: "#1E1338", accent: "#9366E0" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.084 : aspect === "9:16" ? 0.114 : 0.102;
}

const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF7EF"));
  const textColor = str(values.textColor, pc("textColor", "#1A140A"));
  const accent = str(values.accent, pc("accent", "#D9A21B"));
  const title = str(values.title, "Sparkle & Shine");
  const subtitle = str(values.subtitle, "a little magic");
  const showSparkles = on(values.showSparkles);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const centerY = zone.y + zone.height * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Seeded sparkles (twinkle then settle to a calm hold) ---
  if (showSparkles) {
    const layer = new Container();
    root.addChild(layer);
    const N = 22;
    for (let i = 0; i < N; i++) {
      const s = minDim * rng.range(0.01, 0.026);
      const sp = drawSparkle(s, accent);
      sp.position.set(rng.range(zone.x, zone.x + zone.width), rng.range(zone.y, zone.y + zone.height));
      sp.rotation = rng.range(-0.35, 0.35);
      sp.scale.set(0);
      sp.alpha = 0;
      layer.addChild(sp);

      const base = rng.range(0.5, 0.85);
      const delay = rng.range(0.1, 1.6);
      const bright = Math.min(1, base + 0.3);
      timeline
        .to(sp, { prop: "alpha", from: 0, to: base, start: delay, duration: 0.3, ease: outQuad })
        .to(sp, { prop: "scale.x", from: 0, to: 1, start: delay, duration: 0.45, ease: makeOutBack(2) })
        .to(sp, { prop: "scale.y", from: 0, to: 1, start: delay, duration: 0.45, ease: makeOutBack(2) })
        // one twinkle pulse, then rest
        .to(sp, { prop: "scale.x", from: 1, to: 1.25, start: delay + 0.4, duration: 0.2, ease: outQuad })
        .to(sp, { prop: "scale.x", from: 1.25, to: 1, start: delay + 0.6, duration: 0.32, ease: outQuad })
        .to(sp, { prop: "scale.y", from: 1, to: 1.25, start: delay + 0.4, duration: 0.2, ease: outQuad })
        .to(sp, { prop: "scale.y", from: 1.25, to: 1, start: delay + 0.6, duration: 0.32, ease: outQuad })
        .to(sp, { prop: "alpha", from: base, to: bright, start: delay + 0.4, duration: 0.2, ease: outQuad })
        .to(sp, { prop: "alpha", from: bright, to: base, start: delay + 0.6, duration: 0.32, ease: outQuad });
    }
  }

  // --- Title + subtitle ---
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.6 : 0.84);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW);
  const hasSub = subtitle.length > 0;
  const subSize = Math.round(titleSize * 0.3);
  const lineGap = subSize * 1.0;
  const totalH = titleSize + (hasSub ? lineGap + subSize : 0);

  const content = new Container();
  content.position.set(cx, centerY);
  root.addChild(content);

  const titleY = -totalH / 2 + titleSize / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(0, titleY + 12);
  titleText.alpha = 0;
  content.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.25, duration: 0.6, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 12, to: titleY, start: 0.25, duration: 0.7, ease: outQuint });

  if (hasSub) {
    const subY = totalH / 2 - subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
    subText.position.set(0, subY + 12);
    subText.alpha = 0;
    content.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.8, start: 0.6, duration: 0.5, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 12, to: subY, start: 0.6, duration: 0.55, ease: outQuint });
  }

  // --- Soft shine sweep over the title ---
  const shine = new Sprite(radialGlowTexture());
  shine.anchor.set(0.5);
  shine.tint = accent;
  shine.width = minDim * 0.3;
  shine.height = titleSize * 2.4;
  shine.alpha = 0;
  shine.position.set(cx, centerY);
  root.addChild(shine);
  const shineFrom = cx - maxW * 0.62;
  const shineTo = cx + maxW * 0.62;
  timeline
    .to(shine, { prop: "x", from: shineFrom, to: shineTo, start: 0.35, duration: 0.85, ease: outQuad })
    .to(shine, { prop: "alpha", from: 0, to: 0.45, start: 0.35, duration: 0.28, ease: outQuad })
    .to(shine, { prop: "alpha", from: 0.45, to: 0, start: 0.75, duration: 0.45, ease: outQuad });

  return { timeline, duration: DURATION };
}

export const sparkleReveal: TemplateDefinition = {
  id: "sparkle-reveal",
  name: "Sparkle Reveal",
  tagline: "Seeded sparkles twinkle across as the title fades in with a shine.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Sparkle & Shine", maxLength: 28, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "a little magic", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showSparkles", type: "toggle", label: "Sparkles", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

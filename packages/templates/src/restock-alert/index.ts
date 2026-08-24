import { Container, Graphics, Sprite, type Texture } from "pixi.js";
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
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one crisp line. */
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

// A "Back in stock" alert card bounces in with a ringing bell, a product chip,
// and a shop-now button. Only the full-frame bg is tied to `background`; the
// card/chip carry their own palette keys so the design survives alpha export.
const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardBg: "#FFFFFF", chipBg: "#F1EEE7", accent: "#C2380F", textColor: "#14140F", onAccent: "#FFFFFF" } },
  { id: "violet-cream", name: "Violet cream", colors: { background: "#F2EEFB", cardBg: "#FFFFFF", chipBg: "#F0EBFA", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardBg: "#FFFFFF", chipBg: "#E6EFFA", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardBg: "#21252C", chipBg: "#2A2F38", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A" } },
];

/** A small rounded product thumbnail: cover-fit image, or a designed silhouette. */
function productThumb(sizePx: number, tex: Texture | null, accent: string, cardColor: string): Container {
  const c = new Container();
  const r = sizePx * 0.22;
  c.addChild(new Graphics().roundRect(-sizePx / 2, -sizePx / 2, sizePx, sizePx, r).fill(cardColor));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.max(sizePx / tex.width, sizePx / tex.height));
    const mask = new Graphics().roundRect(-sizePx / 2, -sizePx / 2, sizePx, sizePx, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    c.addChild(new Graphics().circle(0, 0, sizePx * 0.36).fill({ color: accent, alpha: 0.16 }));
    const bw = sizePx * 0.34;
    const bh = sizePx * 0.56;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2 + bh * 0.06, bw, bh * 0.94, bw * 0.28).fill(accent));
    c.addChild(new Graphics().roundRect(-bw * 0.16, -bh / 2 - bh * 0.04, bw * 0.32, bh * 0.14, bw * 0.06).fill(accent));
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const chipBg = pc("chipBg", "#F1EEE7");
  const accent = str(values.accent, pc("accent", "#C2380F"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const product = str(values.product, "Aero Bottle");
  const label = str(values.label, "Back in stock");
  const cta = str(values.cta, "Shop now");
  const hasCta = cta.length > 0;
  const showPulse = values.showPulse !== false;
  const showThumb = values.showThumb !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Metrics ---
  const padX = minDim * 0.06;
  const padTop = minDim * 0.075;
  const padBot = minDim * 0.07;
  const bellD = minDim * 0.135;
  const labelSize0 = Math.round(minDim * 0.052);
  const nameSize0 = Math.round(minDim * 0.04);
  const ctaSize0 = Math.round(minDim * 0.032);
  const thumbSize = minDim * 0.11;
  const gap1 = minDim * 0.038;
  const gap2 = minDim * 0.032;
  const gap3 = minDim * 0.042;

  const cardW = Math.min(minDim * 0.82, zone.width);
  const innerW = cardW - padX * 2;
  const labelSize = fitSize(fonts, label, "display", 700, labelSize0, innerW);

  const chipH = Math.max((showThumb ? thumbSize : 0) * 1.28, nameSize0 * 2.3);
  const chipInnerGap = minDim * 0.028;
  const nameMaxW = innerW - minDim * 0.06 - (showThumb ? thumbSize + chipInnerGap : 0);
  const nameSize = fitSize(fonts, product, "display", 700, nameSize0, nameMaxW);

  const ctaH = ctaSize0 * 2.1;
  const contentH = bellD + gap1 + labelSize + gap2 + chipH + (hasCta ? gap3 + ctaH : 0);
  const cardH = padTop + contentH + padBot;
  const cardR = minDim * 0.05;

  const cardTop = cy - cardH / 2;

  // --- Card (bounces down + spring-scales in) ---
  const card = new Container();
  card.position.set(cx, cy);
  root.addChild(card);
  const shadow = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill({ color: 0x000000, alpha: 0.14 });
  shadow.position.set(0, minDim * 0.012);
  card.addChild(shadow);
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg));
  card.alpha = 0;
  card.scale.set(0.9);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.3, ease: outQuad })
    .to(card, { prop: "y", from: cy - minDim * 0.05, to: cy, start: 0.1, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.x", from: 0.9, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.9, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) });

  // Positions relative to card center.
  const bellCy = cardTop + padTop + bellD / 2 - cy;
  const labelCy = bellCy + bellD / 2 + gap1 + labelSize / 2;
  const chipCy = labelCy + labelSize / 2 + gap2 + chipH / 2;
  const ctaCy = chipCy + chipH / 2 + gap3 + ctaH / 2;

  // --- Pulse ring behind the bell (decorative, toggleable) ---
  if (showPulse) {
    const ring = new Graphics().circle(0, 0, bellD * 0.62).stroke({ color: accent, width: Math.max(3, minDim * 0.008) });
    ring.position.set(0, bellCy);
    ring.alpha = 0;
    ring.scale.set(0.6);
    card.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 0.7, start: 0.55, duration: 0.12, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0.7, to: 0, start: 0.67, duration: 0.6, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.6, to: 1.9, start: 0.55, duration: 0.72, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.6, to: 1.9, start: 0.55, duration: 0.72, ease: outExpo });
  }

  // --- Bell badge (pops, then rings with a wiggle) ---
  const bell = new Container();
  bell.position.set(0, bellCy);
  bell.addChild(new Graphics().circle(0, 0, bellD / 2).fill(accent));
  bell.addChild(makeIcon("bell", bellD * 0.56, { color: onAccent }));
  bell.scale.set(0);
  card.addChild(bell);
  timeline
    .to(bell, { prop: "scale.x", from: 0, to: 1, start: 0.35, duration: 0.6, ease: spring(0.42) })
    .to(bell, { prop: "scale.y", from: 0, to: 1, start: 0.35, duration: 0.6, ease: spring(0.42) })
    .to(bell, { prop: "rotation", from: 0, to: 0.26, start: 0.85, duration: 0.12, ease: outQuad })
    .to(bell, { prop: "rotation", from: 0.26, to: -0.2, start: 0.97, duration: 0.14, ease: outQuad })
    .to(bell, { prop: "rotation", from: -0.2, to: 0.12, start: 1.11, duration: 0.14, ease: outQuad })
    .to(bell, { prop: "rotation", from: 0.12, to: 0, start: 1.25, duration: 0.16, ease: outQuad });

  // --- Label ---
  const labelText = makeText(fonts, { text: label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: 0.5, align: "center" });
  labelText.position.set(0, labelCy);
  labelText.alpha = 0;
  card.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: 0.7, duration: 0.4, ease: outQuad })
    .to(labelText, { prop: "y", from: labelCy + minDim * 0.02, to: labelCy, start: 0.7, duration: 0.5, ease: outExpo });

  // --- Product chip (thumb + name) ---
  const chip = new Container();
  chip.position.set(0, chipCy);
  chip.addChild(new Graphics().roundRect(-innerW / 2, -chipH / 2, innerW, chipH, chipH * 0.28).fill(chipBg));
  const contentLeft = -innerW / 2 + minDim * 0.03;
  if (showThumb) {
    const thumb = productThumb(thumbSize, images.image ?? null, accent, cardBg);
    thumb.position.set(contentLeft + thumbSize / 2, 0);
    chip.addChild(thumb);
  }
  const nameX = showThumb ? contentLeft + thumbSize + chipInnerGap : 0;
  const nameText = makeText(fonts, {
    text: product,
    role: "display",
    weight: 700,
    size: nameSize,
    color: textColor,
    anchor: showThumb ? { x: 0, y: 0.5 } : 0.5,
    align: showThumb ? "left" : "center",
  });
  nameText.position.set(showThumb ? nameX : 0, 0);
  chip.addChild(nameText);
  chip.alpha = 0;
  chip.scale.set(0.85);
  card.addChild(chip);
  timeline
    .to(chip, { prop: "alpha", from: 0, to: 1, start: 0.95, duration: 0.35, ease: outQuad })
    .to(chip, { prop: "scale.x", from: 0.85, to: 1, start: 0.95, duration: 0.55, ease: makeOutBack(1.8) })
    .to(chip, { prop: "scale.y", from: 0.85, to: 1, start: 0.95, duration: 0.55, ease: makeOutBack(1.8) });

  // --- CTA pill ---
  if (hasCta) {
    const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize0, color: onAccent, anchor: 0.5 });
    const ctaW = Math.min(innerW, ctaLabel.width + ctaSize0 * 2.4);
    const ctaNode = new Container();
    ctaNode.addChild(new Graphics().roundRect(-ctaW / 2, -ctaH / 2, ctaW, ctaH, ctaH / 2).fill(accent));
    ctaNode.addChild(ctaLabel);
    ctaNode.position.set(0, ctaCy);
    ctaNode.scale.set(0);
    card.addChild(ctaNode);
    timeline
      .to(ctaNode, { prop: "scale.x", from: 0, to: 1, start: 1.2, duration: 0.55, ease: spring(0.45) })
      .to(ctaNode, { prop: "scale.y", from: 0, to: 1, start: 1.2, duration: 0.55, ease: spring(0.45) });
  }

  return { timeline, duration: 4.0 };
}

export const restockAlert: TemplateDefinition = {
  id: "restock-alert",
  name: "Restock Alert",
  tagline: "A back-in-stock card bounces in with a ringing bell and a product chip.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { product: "display", label: "display" },
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Product image", default: "", optional: true, help: "Fills the chip thumbnail; a clean product photo works best." },
    { key: "product", type: "text", label: "Product", default: "Aero Bottle", maxLength: 28, shrinkToFit: true },
    { key: "label", type: "text", label: "Label", default: "Back in stock", maxLength: 24, shrinkToFit: true },
    { key: "cta", type: "text", label: "Button", default: "Shop now", maxLength: 18, optional: true },
    { key: "showPulse", type: "toggle", label: "Bell pulse", default: true },
    { key: "showThumb", type: "toggle", label: "Product thumbnail", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

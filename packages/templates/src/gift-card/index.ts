import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  inQuad,
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

// A gift card is wrapped in a ribbon + bow; the bow unties and the amount pops.
const PALETTES: Palette[] = [
  { id: "festive", name: "Festive", colors: { background: "#F6ECEC", cardColor: "#B12A2A", accent: "#F0C862", textColor: "#FFF3E6" } },
  { id: "emerald", name: "Emerald", colors: { background: "#EAF3EE", cardColor: "#0B6B49", accent: "#F2D98C", textColor: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#ECEFF6", cardColor: "#1B2A4A", accent: "#E0A94F", textColor: "#FFFFFF" } },
  { id: "blush", name: "Blush", colors: { background: "#FBEEF3", cardColor: "#7A234E", accent: "#F4B8C4", textColor: "#FFF0F5" } },
];

/** A ribbon bow: two loops, a knot, two tails — as a container per part. */
function makeBow(s: number, accent: string): { node: Container; left: Container; right: Container; knot: Container; tails: Container } {
  const node = new Container();
  const lw = s * 0.62;
  const lh = s * 0.5;
  const left = new Container();
  left.addChild(new Graphics().poly([0, 0, -lw, -lh, -lw, lh]).fill(accent));
  left.addChild(new Graphics().poly([0, 0, -lw * 0.9, -lh * 0.5, -lw * 0.9, lh * 0.5]).fill({ color: 0xffffff, alpha: 0.12 }));
  const right = new Container();
  right.addChild(new Graphics().poly([0, 0, lw, -lh, lw, lh]).fill(accent));
  right.addChild(new Graphics().poly([0, 0, lw * 0.9, -lh * 0.5, lw * 0.9, lh * 0.5]).fill({ color: 0xffffff, alpha: 0.12 }));
  const tails = new Container();
  tails.addChild(new Graphics().poly([0, 0, -s * 0.34, s * 1.05, -s * 0.06, s * 1.0]).fill(accent));
  tails.addChild(new Graphics().poly([0, 0, s * 0.34, s * 1.05, s * 0.06, s * 1.0]).fill(accent));
  const knot = new Container();
  knot.addChild(new Graphics().roundRect(-s * 0.2, -s * 0.24, s * 0.4, s * 0.48, s * 0.12).fill(accent));
  knot.addChild(new Graphics().roundRect(-s * 0.2, -s * 0.24, s * 0.4, s * 0.16, s * 0.08).fill({ color: 0xffffff, alpha: 0.18 }));
  node.addChild(tails, left, right, knot);
  return { node, left, right, knot, tails };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6ECEC"));
  const cardColor = str(values.cardColor, pc("cardColor", "#B12A2A"));
  const accent = str(values.accent, pc("accent", "#F0C862"));
  const textColor = str(values.textColor, pc("textColor", "#FFF3E6"));

  const brand = str(values.brand, "Aero Studio");
  const amount = str(values.amount, "$50");
  const hasBrand = brand.length > 0;
  const showBow = values.showBow !== false;

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

  // --- Gift card ---
  const cardW = Math.min(minDim * 0.72, zone.width * 0.92);
  const cardH = Math.min(cardW * 0.62, zone.height * 0.72);
  const cardR = minDim * 0.04;

  const card = new Container();
  card.position.set(cx, cy);
  root.addChild(card);
  const shadow = new Graphics().roundRect(-cardW / 2, -cardH / 2 + minDim * 0.014, cardW, cardH, cardR).fill({ color: 0x000000, alpha: 0.16 });
  card.addChild(shadow);
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardColor));
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH * 0.42, cardR).fill({ color: 0xffffff, alpha: 0.06 }));
  card.alpha = 0;
  card.scale.set(0.9);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.12, duration: 0.35, ease: outQuad })
    .to(card, { prop: "y", from: cy + minDim * 0.05, to: cy, start: 0.12, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.x", from: 0.9, to: 1, start: 0.12, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.9, to: 1, start: 0.12, duration: 0.7, ease: spring(0.5) });

  // --- Amount + brand (revealed after the untie) ---
  const brandSize = fitSize(fonts, brand, "display", 700, Math.round(minDim * 0.036), cardW * 0.8);
  const brandText = makeText(fonts, { text: brand, role: "display", weight: 700, size: brandSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 1 });
  brandText.position.set(0, -cardH * 0.28);
  brandText.alpha = 0;
  const amountSize = fitSize(fonts, amount, "display", 700, Math.round(minDim * 0.13), cardW * 0.78);
  const amountText = makeText(fonts, { text: amount, role: "display", weight: 700, size: amountSize, color: textColor, anchor: 0.5, align: "center" });
  amountText.position.set(0, cardH * 0.08);
  amountText.alpha = 0;
  amountText.scale.set(0.6);
  card.addChild(brandText, amountText);

  const revealAt = showBow ? 1.5 : 0.7;
  timeline
    .to(amountText, { prop: "alpha", from: 0, to: 1, start: revealAt, duration: 0.35, ease: outQuad })
    .to(amountText, { prop: "scale.x", from: 0.6, to: 1, start: revealAt, duration: 0.6, ease: makeOutBack(2) })
    .to(amountText, { prop: "scale.y", from: 0.6, to: 1, start: revealAt, duration: 0.6, ease: makeOutBack(2) });
  if (hasBrand) {
    timeline
      .to(brandText, { prop: "alpha", from: 0, to: 1, start: revealAt + 0.15, duration: 0.4, ease: outQuad })
      .to(brandText, { prop: "y", from: -cardH * 0.28 - minDim * 0.015, to: -cardH * 0.28, start: revealAt + 0.15, duration: 0.5, ease: outQuint });
  }

  // --- Ribbon bands + bow (wrap the card, then untie) ---
  if (showBow) {
    const bandW = Math.min(cardW, cardH) * 0.16;
    const vBand = new Graphics().rect(-bandW / 2, -cardH / 2, bandW, cardH).fill(accent);
    const hBand = new Graphics().rect(-cardW / 2, -bandW / 2, cardW, bandW).fill(accent);
    vBand.addChild(new Graphics().rect(-bandW / 2, -cardH / 2, bandW * 0.24, cardH).fill({ color: 0xffffff, alpha: 0.14 }));
    card.addChild(vBand, hBand);

    // Bands slide off as the bow unties.
    timeline
      .to(vBand, { prop: "y", from: 0, to: -cardH * 1.3, start: 1.12, duration: 0.55, ease: inQuad })
      .to(vBand, { prop: "alpha", from: 1, to: 0, start: 1.3, duration: 0.4, ease: outQuad })
      .to(hBand, { prop: "x", from: 0, to: cardW * 1.3, start: 1.12, duration: 0.55, ease: inQuad })
      .to(hBand, { prop: "alpha", from: 1, to: 0, start: 1.3, duration: 0.4, ease: outQuad });

    const bowS = Math.min(cardW, cardH) * 0.34;
    const bow = makeBow(bowS, accent);
    bow.node.position.set(0, 0);
    card.addChild(bow.node);

    // Untie: loops fling outward + shrink, knot pops, tails drop.
    timeline
      .to(bow.left, { prop: "x", from: 0, to: -bowS * 1.1, start: 1.1, duration: 0.5, ease: outExpo })
      .to(bow.left, { prop: "rotation", from: 0, to: -0.7, start: 1.1, duration: 0.5, ease: outQuad })
      .to(bow.left, { prop: "scale.x", from: 1, to: 0, start: 1.1, duration: 0.5, ease: inQuad })
      .to(bow.left, { prop: "scale.y", from: 1, to: 0, start: 1.1, duration: 0.5, ease: inQuad })
      .to(bow.left, { prop: "alpha", from: 1, to: 0, start: 1.32, duration: 0.3, ease: outQuad })
      .to(bow.right, { prop: "x", from: 0, to: bowS * 1.1, start: 1.1, duration: 0.5, ease: outExpo })
      .to(bow.right, { prop: "rotation", from: 0, to: 0.7, start: 1.1, duration: 0.5, ease: outQuad })
      .to(bow.right, { prop: "scale.x", from: 1, to: 0, start: 1.1, duration: 0.5, ease: inQuad })
      .to(bow.right, { prop: "scale.y", from: 1, to: 0, start: 1.1, duration: 0.5, ease: inQuad })
      .to(bow.right, { prop: "alpha", from: 1, to: 0, start: 1.32, duration: 0.3, ease: outQuad })
      .to(bow.knot, { prop: "scale.x", from: 1, to: 0, start: 1.1, duration: 0.4, ease: inQuad })
      .to(bow.knot, { prop: "scale.y", from: 1, to: 0, start: 1.1, duration: 0.4, ease: inQuad })
      .to(bow.knot, { prop: "alpha", from: 1, to: 0, start: 1.28, duration: 0.28, ease: outQuad })
      .to(bow.tails, { prop: "y", from: 0, to: cardH * 0.5, start: 1.12, duration: 0.5, ease: inQuad })
      .to(bow.tails, { prop: "alpha", from: 1, to: 0, start: 1.2, duration: 0.42, ease: outQuad });
  }

  return { timeline, duration: 4.2 };
}

export const giftCard: TemplateDefinition = {
  id: "gift-card",
  name: "Gift Card",
  tagline: "A wrapped gift card unties its bow to reveal the amount.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { brand: "display", amount: "display" },
  palettes: PALETTES,
  fields: [
    { key: "brand", type: "text", label: "Brand", default: "Aero Studio", maxLength: 24, optional: true, shrinkToFit: true },
    { key: "amount", type: "text", label: "Amount", default: "$50", maxLength: 10, shrinkToFit: true },
    { key: "showBow", type: "toggle", label: "Ribbon bow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "cardColor", type: "color", label: "Card", default: "", optional: true },
    { key: "accent", type: "color", label: "Ribbon", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
  ],
  build,
};

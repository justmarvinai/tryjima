import { Container, Graphics, Sprite, type Text, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  inQuad,
  outQuint,
  outExpo,
  makeOutBack,
  spring,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#C2380F", textColor: "#14140F", onAccent: "#FFFFFF", muted: "#6B6B60" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", muted: "#6A5E85" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", muted: "#5A6A82" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", muted: "#8A93A0" } },
];

const DUR = 4.2;
const CARD_IN = 0.15;
const CART_IN = 0.35;
const NAME_IN = 0.75;
const PRICE_IN = 0.95;
const BTN_IN = 1.15;
const PRESS_T = 1.95;
const FLIGHT_START = PRESS_T + 0.18;
const FLIGHT_DUR = 0.5;
const ARRIVAL = FLIGHT_START + FLIGHT_DUR;

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one line. */
function fitOneLine(
  fonts: TemplateContext["fonts"],
  text: string,
  weight: number,
  size0: number,
  maxWidth: number,
  minSize = 14,
): number {
  const family = fonts.family("display");
  let size = size0;
  while (size > minSize && fonts.measure(text, { family, weight, size }) > maxWidth) size -= 1;
  return size;
}

/** A rounded product card: shadow + bg + cover-fit masked image, or a designed placeholder. */
function productCard(w: number, h: number, r: number, tex: Texture | null, cardColor: string, accent: string): Container {
  const c = new Container();
  const shadow = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill({ color: 0x000000, alpha: 0.14 });
  shadow.position.set(0, h * 0.035);
  c.addChild(shadow);
  c.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(cardColor));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(w / tex.width, h / tex.height);
    s.scale.set(cover);
    const mask = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    const minDim = Math.min(w, h);
    c.addChild(new Graphics().circle(0, 0, minDim * 0.4).fill({ color: accent, alpha: 0.12 }));
    c.addChild(new Graphics().circle(0, 0, minDim * 0.28).fill({ color: accent, alpha: 0.2 }));
    const bw = minDim * 0.34;
    const bh = minDim * 0.5;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
  return c;
}

interface ATCLayout {
  horizontal: boolean;
  cardCx: number;
  cardCy: number;
  cardW: number;
  cardH: number;
  cardR: number;
  textLeft: number;
  textCx: number;
  textW: number;
  anchorX: 0 | 0.5;
  blockCenterY: number;
  nameSize: number;
}

function atcLayout(aspect: Aspect, w: number, h: number): ATCLayout {
  const margin = Math.round(Math.min(w, h) * 0.07);
  const horizontal = aspect === "16:9" || aspect === "1:1";
  if (horizontal) {
    const cardW = aspect === "16:9" ? w * 0.3 : w * 0.38;
    const cardH = aspect === "16:9" ? h * 0.68 : h * 0.56;
    const cardCx = margin + cardW / 2;
    const textLeft = cardCx + cardW / 2 + w * 0.07;
    return {
      horizontal: true,
      cardCx,
      cardCy: h * 0.54,
      cardW,
      cardH,
      cardR: Math.min(cardW, cardH) * 0.08,
      textLeft,
      textCx: textLeft,
      textW: w - margin - textLeft,
      anchorX: 0,
      blockCenterY: h * 0.54,
      nameSize: Math.round(w * (aspect === "16:9" ? 0.046 : 0.056)),
    };
  }
  const top = aspect === "9:16" ? 260 : margin * 1.15;
  const cardW = aspect === "9:16" ? w * 0.56 : w * 0.58;
  const cardH = cardW;
  const cardCy = top + cardH / 2;
  return {
    horizontal: false,
    cardCx: w / 2,
    cardCy,
    cardW,
    cardH,
    cardR: Math.min(cardW, cardH) * 0.08,
    textLeft: margin,
    textCx: w / 2,
    textW: w - margin * 2,
    anchorX: 0.5,
    blockCenterY: 0,
    nameSize: Math.round(w * (aspect === "9:16" ? 0.066 : 0.06)),
  };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#C2380F"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const name = str(values.name, "Aero Bottle");
  const price = str(values.price, "$29");
  const cta = str(values.cta, "Add to cart");
  const cartCount = Math.max(0, Math.min(9, Math.round(num(values.cartCount, 2))));
  const showCartIcon = values.showCartIcon !== false;
  const showBurst = values.showBurst !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const L = atcLayout(ctx.aspect, W, H);

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Product card ---
  const tex = images.product ?? null;
  const card = productCard(L.cardW, L.cardH, L.cardR, tex, cardColor, accent);
  card.position.set(L.cardCx, L.cardCy);
  card.scale.set(0.86);
  card.alpha = 0;
  root.addChild(card);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: CARD_IN, duration: 0.35, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.86, to: 1, start: CARD_IN, duration: 0.75, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.86, to: 1, start: CARD_IN, duration: 0.75, ease: spring(0.5) });

  // --- Text column: name, price, "Add to cart" button ---
  const nameFit = fitOneLine(fonts, name, 700, L.nameSize, L.textW, 16);
  const nameH = nameFit * 1.2;
  const priceSize = Math.round(nameFit * 0.62);
  const priceH = priceSize * 1.3;
  const btnLabelSize = Math.round(L.nameSize * 0.38);
  const btnH = btnLabelSize * 2.05;
  const gapA = minDim * 0.032;
  const gapB = minDim * 0.05;

  const totalTextH = nameH + gapA + priceH + gapB + btnH;
  const blockTop = L.horizontal ? L.blockCenterY - totalTextH / 2 : L.cardCy + L.cardH / 2 + minDim * 0.065;
  const elemX = L.anchorX === 0 ? L.textLeft : L.textCx;

  let y = blockTop;
  const nameY = y + nameH / 2;
  y += nameH + gapA;
  const priceY = y + priceH / 2;
  y += priceH + gapB;
  const btnCy = y + btnH / 2;

  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameFit, color: textColor, anchor: { x: L.anchorX, y: 0.5 }, align: L.anchorX === 0 ? "left" : "center" });
  nameText.position.set(elemX, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: NAME_IN, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 14, to: nameY, start: NAME_IN, duration: 0.5, ease: outQuint });

  const priceText = makeText(fonts, { text: price, role: "display", weight: 700, size: priceSize, color: textColor, anchor: { x: L.anchorX, y: 0.5 }, align: L.anchorX === 0 ? "left" : "center" });
  priceText.position.set(elemX, priceY);
  priceText.alpha = 0;
  priceText.scale.set(0.85);
  root.addChild(priceText);
  timeline
    .to(priceText, { prop: "alpha", from: 0, to: 1, start: PRICE_IN, duration: 0.35, ease: outQuad })
    .to(priceText, { prop: "scale.x", from: 0.85, to: 1, start: PRICE_IN, duration: 0.5, ease: makeOutBack(1.7) })
    .to(priceText, { prop: "scale.y", from: 0.85, to: 1, start: PRICE_IN, duration: 0.5, ease: makeOutBack(1.7) });

  // --- "Add to cart" button: presses down, fills with a check ---
  const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: btnLabelSize, color: onAccent, anchor: 0.5 });
  const btnW = Math.max(ctaLabel.width + btnLabelSize * 2.0, btnH * 2.5);
  const checkIcon = makeIcon("check", btnLabelSize * 1.3, { color: onAccent });
  checkIcon.alpha = 0;
  checkIcon.scale.set(0.5);

  const btn = new Container();
  btn.addChild(new Graphics().roundRect(-btnW / 2, -btnH / 2, btnW, btnH, btnH / 2).fill(accent));
  btn.addChild(ctaLabel);
  btn.addChild(checkIcon);
  const btnCx = L.anchorX === 0 ? L.textLeft + btnW / 2 : L.textCx;
  btn.position.set(btnCx, btnCy);
  btn.scale.set(0);
  root.addChild(btn);
  timeline
    .to(btn, { prop: "scale.x", from: 0, to: 1, start: BTN_IN, duration: 0.6, ease: spring(0.45) })
    .to(btn, { prop: "scale.y", from: 0, to: 1, start: BTN_IN, duration: 0.6, ease: spring(0.45) });

  // Press-and-release bounce, label → check crossfade.
  timeline
    .to(btn, { prop: "scale.x", from: 1, to: 0.9, start: PRESS_T, duration: 0.09, ease: outQuad })
    .to(btn, { prop: "scale.x", from: 0.9, to: 1.05, start: PRESS_T + 0.09, duration: 0.16, ease: makeOutBack(2.0) })
    .to(btn, { prop: "scale.x", from: 1.05, to: 1, start: PRESS_T + 0.25, duration: 0.18, ease: outQuad })
    .to(btn, { prop: "scale.y", from: 1, to: 0.9, start: PRESS_T, duration: 0.09, ease: outQuad })
    .to(btn, { prop: "scale.y", from: 0.9, to: 1.05, start: PRESS_T + 0.09, duration: 0.16, ease: makeOutBack(2.0) })
    .to(btn, { prop: "scale.y", from: 1.05, to: 1, start: PRESS_T + 0.25, duration: 0.18, ease: outQuad })
    .to(ctaLabel, { prop: "alpha", from: 1, to: 0, start: PRESS_T + 0.04, duration: 0.16, ease: outQuad })
    .to(checkIcon, { prop: "alpha", from: 0, to: 1, start: PRESS_T + 0.14, duration: 0.22, ease: outQuad })
    .to(checkIcon, { prop: "scale.x", from: 0.5, to: 1, start: PRESS_T + 0.14, duration: 0.35, ease: makeOutBack(2.2) })
    .to(checkIcon, { prop: "scale.y", from: 0.5, to: 1, start: PRESS_T + 0.14, duration: 0.35, ease: makeOutBack(2.2) });

  // Confirmation glow ring (decorative — toggleable).
  if (showBurst) {
    const ring = new Graphics().circle(0, 0, btnH * 0.55).stroke({ color: accent, width: Math.max(3, minDim * 0.008) });
    ring.position.set(btnCx, btnCy);
    ring.scale.set(0.7);
    ring.alpha = 0;
    root.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 0.7, start: PRESS_T + 0.04, duration: 0.08, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0.7, to: 0, start: PRESS_T + 0.12, duration: 0.42, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.7, to: 1.7, start: PRESS_T + 0.04, duration: 0.5, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.7, to: 1.7, start: PRESS_T + 0.04, duration: 0.5, ease: outExpo });
  }

  // --- Cart icon + badge (toggleable) — a dot flies from the button to it,
  // and the badge count increments (a discrete `.set()`) on arrival. ---
  if (showCartIcon) {
    const cartSize = minDim * 0.075;
    const cartMargin = minDim * 0.06;
    const cartX = W - cartMargin - cartSize * 0.5;
    const cartY = (ctx.aspect === "9:16" ? 230 : cartMargin) + cartSize * 0.55;

    const cartIcon = makeIcon("cart", cartSize, { color: textColor });
    cartIcon.position.set(cartX, cartY);
    cartIcon.alpha = 0;
    cartIcon.scale.set(0.6);
    root.addChild(cartIcon);
    timeline
      .to(cartIcon, { prop: "alpha", from: 0, to: 1, start: CART_IN, duration: 0.4, ease: outQuad })
      .to(cartIcon, { prop: "scale.x", from: 0.6, to: 1, start: CART_IN, duration: 0.6, ease: spring(0.5) })
      .to(cartIcon, { prop: "scale.y", from: 0.6, to: 1, start: CART_IN, duration: 0.6, ease: spring(0.5) });

    const badgeR = cartSize * 0.34;
    const badgeCx = cartX + cartSize * 0.44;
    const badgeCy = cartY - cartSize * 0.46;
    const badgeChip = new Container();
    badgeChip.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));
    const badgeText: Text = makeText(fonts, { text: String(cartCount), role: "display", weight: 700, size: Math.round(badgeR * 1.15), color: onAccent, anchor: 0.5 });
    badgeChip.addChild(badgeText);
    badgeChip.position.set(badgeCx, badgeCy);
    badgeChip.alpha = 0;
    badgeChip.scale.set(0.6);
    root.addChild(badgeChip);
    timeline
      .to(badgeChip, { prop: "alpha", from: 0, to: 1, start: CART_IN + 0.15, duration: 0.35, ease: outQuad })
      .to(badgeChip, { prop: "scale.x", from: 0.6, to: 1, start: CART_IN + 0.15, duration: 0.5, ease: makeOutBack(2.0) })
      .to(badgeChip, { prop: "scale.y", from: 0.6, to: 1, start: CART_IN + 0.15, duration: 0.5, ease: makeOutBack(2.0) });

    // Flying dot: an arc from the button up to the cart icon.
    const dotR = minDim * 0.014;
    const startX = btnCx + btnW * 0.26;
    const startY = btnCy - btnH * 0.32;
    const peakY = Math.min(startY, cartY) - minDim * 0.1;
    const dot = new Graphics().circle(0, 0, dotR).fill(accent);
    dot.position.set(startX, startY);
    dot.alpha = 0;
    root.addChild(dot);
    timeline
      .to(dot, { prop: "alpha", from: 0, to: 1, start: FLIGHT_START, duration: 0.06, ease: outQuad })
      .to(dot, { prop: "alpha", from: 1, to: 0, start: FLIGHT_START + FLIGHT_DUR - 0.1, duration: 0.1, ease: outQuad })
      .to(dot, { prop: "x", from: startX, to: cartX, start: FLIGHT_START, duration: FLIGHT_DUR, ease: outQuad })
      .to(dot, { prop: "y", from: startY, to: peakY, start: FLIGHT_START, duration: FLIGHT_DUR * 0.45, ease: outQuad })
      .to(dot, { prop: "y", from: peakY, to: cartY, start: FLIGHT_START + FLIGHT_DUR * 0.45, duration: FLIGHT_DUR * 0.55, ease: inQuad })
      .to(dot, { prop: "scale.x", from: 1, to: 0.5, start: FLIGHT_START, duration: FLIGHT_DUR, ease: outQuad })
      .to(dot, { prop: "scale.y", from: 1, to: 0.5, start: FLIGHT_START, duration: FLIGHT_DUR, ease: outQuad });

    // Arrival: cart bumps, badge pops and increments.
    timeline
      .to(cartIcon, { prop: "scale.x", from: 1, to: 1.3, start: ARRIVAL, duration: 0.14, ease: outQuad })
      .to(cartIcon, { prop: "scale.x", from: 1.3, to: 1, start: ARRIVAL + 0.14, duration: 0.22, ease: outQuad })
      .to(cartIcon, { prop: "scale.y", from: 1, to: 1.3, start: ARRIVAL, duration: 0.14, ease: outQuad })
      .to(cartIcon, { prop: "scale.y", from: 1.3, to: 1, start: ARRIVAL + 0.14, duration: 0.22, ease: outQuad })
      .to(badgeChip, { prop: "scale.x", from: 1, to: 1.4, start: ARRIVAL, duration: 0.14, ease: outQuad })
      .to(badgeChip, { prop: "scale.x", from: 1.4, to: 1, start: ARRIVAL + 0.14, duration: 0.24, ease: outQuad })
      .to(badgeChip, { prop: "scale.y", from: 1, to: 1.4, start: ARRIVAL, duration: 0.14, ease: outQuad })
      .to(badgeChip, { prop: "scale.y", from: 1.4, to: 1, start: ARRIVAL + 0.14, duration: 0.24, ease: outQuad })
      .set(badgeText, "text", String(Math.min(9, cartCount + 1)), ARRIVAL);
  }

  return { timeline, duration: DUR };
}

export const addToCart: TemplateDefinition = {
  id: "add-to-cart",
  name: "Add to Cart",
  tagline: "A satisfying add-to-cart press, with a dot flying into the cart badge.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { name: "display" },
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Fills the card; a clean product photo works best." },
    { key: "name", type: "text", label: "Name", default: "Aero Bottle", maxLength: 28, shrinkToFit: true },
    { key: "price", type: "text", label: "Price", default: "$29", maxLength: 12 },
    { key: "cta", type: "text", label: "Button", default: "Add to cart", maxLength: 20 },
    { key: "cartCount", type: "slider", label: "Starting cart count", default: 2, min: 0, max: 9, step: 1 },
    { key: "showCartIcon", type: "toggle", label: "Cart icon", default: true },
    { key: "showBurst", type: "toggle", label: "Confirmation glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

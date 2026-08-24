import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
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
const on = (v: unknown): boolean => v !== false;

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

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
  return w > maxWidth ? Math.max(11, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A live-shopping product tag: a LIVE badge pops top-left, then a product card
// (thumbnail + name + price + "Tap to shop") slides up from the bottom and its
// CTA gently pulses. Full-frame `bg` carries the background field; the card and
// LIVE badge carry their own palette roles so they survive over footage.
const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B10", cardBg: "#1B1C22", thumbBg: "#2A2B33", textColor: "#FFFFFF", accent: "#FF2E5B", live: "#FF3B30" } },
  { id: "daylight", name: "Daylight", colors: { background: "#F4F5F8", cardBg: "#FFFFFF", thumbBg: "#EEF0F4", textColor: "#101014", accent: "#FF2E5B", live: "#FF3B30" } },
  { id: "grape", name: "Grape", colors: { background: "#17102E", cardBg: "#241645", thumbBg: "#33245C", textColor: "#FFFFFF", accent: "#B08BFF", live: "#FF3B30" } },
  { id: "mint", name: "Mint", colors: { background: "#EAF7EE", cardBg: "#FFFFFF", thumbBg: "#DCF3E6", textColor: "#08221A", accent: "#17A34A", live: "#FF3B30" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0B0B10"));
  const cardBg = pc("cardBg", "#1B1C22");
  const thumbBg = pc("thumbBg", "#2A2B33");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF2E5B"));
  const live = str(values.live, pc("live", "#FF3B30"));
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const onLive = luminance(live) < 0.5 ? "#FFFFFF" : "#101014";
  const product = str(values.product, "Sunset Hoodie");
  const price = str(values.price, "$48");
  const cta = str(values.cta, "Tap to shop");
  const showLive = on(values.showLive);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- LIVE badge (top-left, inside safe) ---
  if (showLive) {
    const liveH = Math.round(minDim * 0.056);
    const dotR = liveH * 0.16;
    const liveSize = Math.round(liveH * 0.44);
    const liveTextW = fonts.measure("LIVE", { family: fonts.family("display"), weight: 700, size: liveSize, letterSpacing: liveSize * 0.05 });
    const liveW = dotR * 2 + liveH * 0.3 + liveTextW + liveH * 0.8;
    const badge = new Container();
    badge.position.set(safe.x + liveW / 2 + minDim * 0.012, safe.y + liveH / 2 + minDim * 0.012);
    badge.scale.set(0);
    root.addChild(badge);
    badge.addChild(new Graphics().roundRect(-liveW / 2, -liveH / 2, liveW, liveH, liveH / 2).fill(live));
    const ldot = new Graphics().circle(-liveW / 2 + liveH * 0.4 + dotR, 0, dotR).fill(onLive);
    badge.addChild(ldot);
    const lText = makeText(fonts, { text: "LIVE", role: "display", weight: 700, size: liveSize, color: onLive, anchor: { x: 0, y: 0.5 }, letterSpacing: liveSize * 0.05 });
    lText.position.set(-liveW / 2 + liveH * 0.4 + dotR * 2 + liveH * 0.3, 0);
    badge.addChild(lText);
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.5, ease: makeOutBack(1.9) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.5, ease: makeOutBack(1.9) });
    // Blink the LIVE dot.
    for (let i = 0; i < 4; i++) {
      const s0 = 0.7 + i * 0.8;
      timeline
        .to(ldot, { prop: "alpha", from: 1, to: 0.3, start: s0, duration: 0.4, ease: outQuad })
        .to(ldot, { prop: "alpha", from: 0.3, to: 1, start: s0 + 0.4, duration: 0.4, ease: outQuad });
    }
  }

  // --- Product card (slides up from the bottom) ---
  const cardW = Math.min(safe.width * 0.9, minDim * 1.15);
  const cardH = Math.round(minDim * 0.17);
  const pad = Math.round(cardH * 0.15);
  const thumbS = cardH - pad * 2;
  const gap = Math.round(cardH * 0.14);
  const cardR = Math.round(cardH * 0.16);

  const ctaSize = fitSize(fonts, cta, "display", 700, Math.round(cardH * 0.2), cardW * 0.4);
  const ctaTextW = fonts.measure(cta, { family: fonts.family("display"), weight: 700, size: ctaSize });
  const ctaW = ctaTextW + ctaSize * 1.6;
  const ctaH = Math.round(cardH * 0.42);

  const textX = -cardW / 2 + pad + thumbS + gap;
  const textMaxW = cardW / 2 - pad - ctaW - gap - textX;
  const nameSize = fitSize(fonts, product, "display", 700, Math.round(cardH * 0.22), textMaxW);
  const priceSize = Math.round(cardH * 0.28);

  const cardCy = safe.y + safe.height - cardH / 2 - Math.round(minDim * 0.03);
  const slideDist = cardH + minDim * 0.1;

  const card = new Container();
  card.position.set(cx, cardCy + slideDist);
  card.alpha = 0;
  root.addChild(card);

  const e = Math.round(cardR * 0.4);
  const eo = Math.round(cardR * 0.5);
  card.addChild(new Graphics().roundRect(-cardW / 2 - e, -cardH / 2 - e + eo, cardW + e * 2, cardH + e * 2, cardR + e).fill({ color: "#000000", alpha: 0.2 }));
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg));

  // Thumbnail.
  const thumb = new Container();
  thumb.position.set(-cardW / 2 + pad + thumbS / 2, 0);
  thumb.addChild(new Graphics().roundRect(-thumbS / 2, -thumbS / 2, thumbS, thumbS, thumbS * 0.16).fill(thumbBg));
  thumb.addChild(makeIcon("cart", thumbS * 0.44, { color: accent }));
  card.addChild(thumb);

  // Name + price.
  const nameText = makeText(fonts, { text: product, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(textX, -cardH * 0.16);
  card.addChild(nameText);
  const priceText = makeText(fonts, { text: price, role: "display", weight: 700, size: priceSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  priceText.position.set(textX, cardH * 0.2);
  card.addChild(priceText);

  // CTA pill (right side).
  const ctaPill = new Container();
  ctaPill.position.set(cardW / 2 - pad - ctaW / 2, 0);
  ctaPill.addChild(new Graphics().roundRect(-ctaW / 2, -ctaH / 2, ctaW, ctaH, ctaH / 2).fill(accent));
  ctaPill.addChild(makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 }));
  card.addChild(ctaPill);

  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.3, ease: outQuad })
    .to(card, { prop: "y", from: cardCy + slideDist, to: cardCy, start: 0.5, duration: 0.7, ease: outExpo });

  // CTA pulse once the card has settled.
  const pStart = 1.4;
  for (let i = 0; i < 3; i++) {
    const s0 = pStart + i * 0.9;
    timeline
      .to(ctaPill, { prop: "scale.x", from: 1, to: 1.06, start: s0, duration: 0.28, ease: outQuad })
      .to(ctaPill, { prop: "scale.y", from: 1, to: 1.06, start: s0, duration: 0.28, ease: outQuad })
      .to(ctaPill, { prop: "scale.x", from: 1.06, to: 1, start: s0 + 0.28, duration: 0.4, ease: outQuad })
      .to(ctaPill, { prop: "scale.y", from: 1.06, to: 1, start: s0 + 0.28, duration: 0.4, ease: outQuad });
  }

  return { timeline, duration: 4.2 };
}

export const liveShopping: TemplateDefinition = {
  id: "live-shopping",
  name: "Live Shopping",
  tagline: "A product card slides up over a LIVE badge with a pulsing Tap to shop CTA.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { product: "display", price: "display", cta: "display" },
  palettes: PALETTES,
  fields: [
    { key: "product", type: "text", label: "Product", default: "Sunset Hoodie", maxLength: 28, shrinkToFit: true },
    { key: "price", type: "text", label: "Price", default: "$48", maxLength: 12, shrinkToFit: true },
    { key: "cta", type: "text", label: "CTA", default: "Tap to shop", maxLength: 16, shrinkToFit: true },
    { key: "showLive", type: "toggle", label: "LIVE badge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "live", type: "color", label: "LIVE color", default: "", optional: true },
  ],
  build,
};

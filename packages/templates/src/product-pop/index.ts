import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuint,
  outQuad,
  spring,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F3F1EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#101014" } },
  { id: "butter", name: "Butter", colors: { background: "#FFF4D6", cardColor: "#FFFFFF", accent: "#E8853A", textColor: "#3A2A10" } },
  { id: "sage", name: "Sage", colors: { background: "#E7F0E7", cardColor: "#FFFFFF", accent: "#2F8F5B", textColor: "#123023" } },
  { id: "charcoal-pop", name: "Charcoal pop", colors: { background: "#EDEEF0", cardColor: "#1B1D22", accent: "#FF4D1C", textColor: "#FFFFFF" } },
];

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.05 : aspect === "9:16" ? 0.07 : 0.062;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3F1EC"));
  const cardColor = str(values.cardColor, pc("cardColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const name = str(values.name, "Aura Headphones");
  const price = str(values.price, "€129");
  const cta = str(values.cta, "In stock →");
  const pattern = str(values.pattern, "dots");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const timeline = new JimaTimeline();
  const fontSize = Math.round(size.width * fontFrac(ctx.aspect));
  const cx = size.width / 2;

  // Drifting background pattern (one Graphics object, subtle diagonal drift).
  if (pattern !== "none") {
    const g = new Graphics();
    const step = Math.round(size.width * 0.06);
    for (let x = -step; x < size.width + step * 2; x += step) {
      for (let y = -step; y < size.height + step * 2; y += step) {
        if (pattern === "dots") g.circle(x, y, Math.max(2, step * 0.06));
        else g.rect(x, y, 1, step);
      }
    }
    g.fill({ color: 0x000000, alpha: 0.05 });
    g.position.set(-step, -step);
    root.addChild(g);
    timeline
      .to(g, { prop: "x", from: -step, to: 0, start: 0, duration: 5.0, ease: outQuad })
      .to(g, { prop: "y", from: -step, to: 0, start: 0, duration: 5.0, ease: outQuad });
  }

  // Card.
  const cardW = size.width * 0.72;
  const cardH = size.height * (ctx.aspect === "16:9" ? 0.72 : 0.62);
  const cardY = size.height * 0.5;
  const card = new Container();
  card.position.set(cx, cardY);
  card.pivot.set(0, 0);
  const shadow = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, fontSize * 0.6).fill({ color: 0x101014, alpha: 0.08 });
  shadow.position.set(0, fontSize * 0.5);
  const cardBg = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, fontSize * 0.6).fill(cardColor);
  card.addChild(shadow, cardBg);
  root.addChild(card);
  card.alpha = 0;
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.3, ease: outQuad })
    .to(card, { prop: "y", from: cardY + 40, to: cardY, start: 0.3, duration: 0.7, ease: outQuint });

  // Product image (contain-fit) or placeholder.
  const productBoxW = cardW * 0.62;
  const productBoxH = cardH * 0.44;
  const productY = cardY - cardH * 0.16;
  const tex = images.productImage ?? null;
  const productNode = new Container();
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const fitScale = Math.min(productBoxW / tex.width, productBoxH / tex.height);
    s.scale.set(fitScale);
    productNode.addChild(s);
  } else {
    const r = Math.min(productBoxW, productBoxH) * 0.42;
    productNode.addChild(new Graphics().circle(0, 0, r).fill({ color: accent, alpha: 0.16 }));
    productNode.addChild(new Graphics().circle(0, 0, r * 0.6).fill({ color: accent, alpha: 0.28 }));
  }
  productNode.position.set(cx, productY);
  root.addChild(productNode);
  productNode.alpha = 0;
  const shadowEllipse = new Graphics().ellipse(0, 0, productBoxW * 0.3, productBoxH * 0.06).fill({ color: 0x101014, alpha: 0.12 });
  shadowEllipse.position.set(cx, productY + productBoxH * 0.5);
  root.addChild(shadowEllipse);
  shadowEllipse.alpha = 0;
  timeline
    .to(productNode, { prop: "alpha", from: 0, to: 1, start: 0.8, duration: 0.25, ease: outQuad })
    .to(productNode, { prop: "y", from: productY - size.height * 0.12, to: productY, start: 0.8, duration: 0.7, ease: spring(0.55) })
    .to(shadowEllipse, { prop: "alpha", from: 0, to: 1, start: 1.1, duration: 0.4, ease: outQuad })
    .to(productNode, { prop: "rotation", from: 1 * DEG, to: -1 * DEG, start: 3.1, duration: 1.2, ease: outQuad })
    .to(productNode, { prop: "rotation", from: -1 * DEG, to: 1 * DEG, start: 4.3, duration: 1.2, ease: outQuad });

  // Name.
  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, cardY + cardH * 0.18);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 1.5, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "x", from: cx - 20, to: cx, start: 1.5, duration: 0.5, ease: outQuint });

  // Price tag (accent chip, rotates in).
  const priceSize = Math.round(fontSize * 0.9);
  const priceW = fonts.measure(price, { family: fonts.family("display"), weight: 700, size: priceSize }) + priceSize * 1.1;
  const priceH = priceSize * 1.5;
  const priceChip = new Container();
  priceChip.addChild(new Graphics().roundRect(-priceW / 2, -priceH / 2, priceW, priceH, priceH / 2).fill(accent));
  priceChip.addChild(makeText(fonts, { text: price, role: "display", weight: 700, size: priceSize, color: "#FFFFFF", anchor: 0.5 }));
  priceChip.position.set(cx, cardY + cardH * 0.34);
  priceChip.scale.set(0);
  priceChip.rotation = -8 * DEG;
  root.addChild(priceChip);
  timeline
    .to(priceChip, { prop: "scale.x", from: 0, to: 1, start: 2.1, duration: 0.5, ease: makeOutBack(1.8) })
    .to(priceChip, { prop: "scale.y", from: 0, to: 1, start: 2.1, duration: 0.5, ease: makeOutBack(1.8) })
    .to(priceChip, { prop: "rotation", from: -8 * DEG, to: 0, start: 2.1, duration: 0.5, ease: makeOutBack(1.8) });

  if (cta.length > 0) {
    const ctaText = makeText(fonts, { text: cta, role: "body", weight: 600, size: Math.round(fontSize * 0.5), color: accent, anchor: 0.5 });
    ctaText.position.set(cx, cardY + cardH * 0.46);
    ctaText.alpha = 0;
    root.addChild(ctaText);
    timeline.to(ctaText, { prop: "alpha", from: 0, to: 1, start: 2.6, duration: 0.4, ease: outQuad });
  }

  return { timeline, duration: 5.0 };
}

export const productPop: TemplateDefinition = {
  id: "product-pop",
  name: "Product Pop",
  tagline: "A product drops in with a springy bounce.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "productImage", type: "image", label: "Product image", default: "", optional: true, help: "Transparent PNG works best." },
    { key: "name", type: "text", label: "Name", default: "Aura Headphones", maxLength: 40 },
    { key: "price", type: "text", label: "Price", default: "€129", maxLength: 12 },
    { key: "cta", type: "text", label: "Tagline", default: "In stock →", maxLength: 20, optional: true },
    { key: "pattern", type: "select", label: "Pattern", default: "dots", options: [{ value: "dots", label: "Dots" }, { value: "grid", label: "Grid" }, { value: "none", label: "None" }] },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "cardColor", type: "color", label: "Card", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

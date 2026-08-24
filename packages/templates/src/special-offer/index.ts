import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outBack,
  spring,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makePill } from "../shared/ui";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const DEG = Math.PI / 180;

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", textColor: "#2A0F06", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "lime-pop", name: "Lime pop", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", onAccent: "#101014" } },
  { id: "berry", name: "Berry", colors: { background: "#FFEEF6", textColor: "#3A0A28", accent: "#FF2E9E", onAccent: "#FFFFFF" } },
];

interface L {
  kickerY: number;
  sealY: number;
  sealR: number;
  headY: number;
  priceY: number;
  ctaY: number;
  headSize: number;
}

function layout(aspect: Aspect, size: { width: number; height: number }): L {
  const w = size.width;
  const h = size.height;
  const base: Record<Aspect, Partial<L>> = {
    "16:9": { kickerY: 0.16, sealY: 0.44, sealR: 0.2, headY: 0.72, priceY: 0.84, ctaY: 0.93, headSize: 0.06 },
    "1:1": { kickerY: 0.13, sealY: 0.4, sealR: 0.2, headY: 0.66, priceY: 0.77, ctaY: 0.88, headSize: 0.07 },
    "4:5": { kickerY: 0.12, sealY: 0.38, sealR: 0.2, headY: 0.62, priceY: 0.73, ctaY: 0.84, headSize: 0.072 },
    "9:16": { kickerY: 0.14, sealY: 0.38, sealR: 0.22, headY: 0.6, priceY: 0.7, ctaY: 0.8, headSize: 0.082 },
  };
  const b = base[aspect];
  const minDim = Math.min(w, h);
  return {
    kickerY: h * b.kickerY!,
    sealY: h * b.sealY!,
    sealR: minDim * b.sealR!,
    headY: h * b.headY!,
    priceY: h * b.priceY!,
    ctaY: h * b.ctaY!,
    headSize: Math.round(w * b.headSize!),
  };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const textColor = str(values.textColor, pc("textColor", "#2A0F06"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = str(values.onAccent, pc("onAccent", "#FFFFFF"));
  const kicker = str(values.kicker, "LIMITED TIME OFFER");
  const discount = str(values.discount, "50% OFF");
  const headline = str(values.headline, "Summer Sale");
  const oldPrice = str(values.oldPrice, "$49");
  const newPrice = str(values.newPrice, "$24");
  const cta = str(values.cta, "Shop now");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));
  const L = layout(ctx.aspect, size);
  const cx = size.width / 2;
  const timeline = new JimaTimeline();

  // Kicker.
  const kick = makeText(fonts, { text: kicker, role: "body", weight: 600, size: Math.round(L.headSize * 0.34), color: accent, anchor: 0.5, letterSpacing: 3 });
  kick.position.set(cx, L.kickerY);
  kick.alpha = 0;
  root.addChild(kick);
  timeline
    .to(kick, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.5, ease: outQuad })
    .to(kick, { prop: "y", from: L.kickerY - 16, to: L.kickerY, start: 0.15, duration: 0.6, ease: outExpo });

  // Starburst seal with the discount.
  const seal = new Container();
  seal.position.set(cx, L.sealY);
  const burst = new Graphics().star(0, 0, 22, L.sealR, L.sealR * 0.84).fill(accent);
  seal.addChild(burst);
  seal.addChild(new Graphics().circle(0, 0, L.sealR * 0.78).fill(accent));
  const dparts = discount.split(/\s+/);
  const dTop = dparts[0] ?? discount;
  const dBot = dparts.slice(1).join(" ");
  seal.addChild(makeText(fonts, { text: dTop, role: "display", weight: 700, size: Math.round(L.sealR * (dBot ? 0.52 : 0.4)), color: onAccent, anchor: 0.5, align: "center" }));
  if (dBot) {
    const bt = makeText(fonts, { text: dBot, role: "display", weight: 700, size: Math.round(L.sealR * 0.34), color: onAccent, anchor: 0.5 });
    bt.position.set(0, L.sealR * 0.42);
    seal.addChild(bt);
  }
  seal.scale.set(0);
  seal.rotation = -18 * DEG;
  root.addChild(seal);
  timeline
    .to(seal, { prop: "scale.x", from: 0, to: 1, start: 0.4, duration: 0.8, ease: spring(0.4) })
    .to(seal, { prop: "scale.y", from: 0, to: 1, start: 0.4, duration: 0.8, ease: spring(0.4) })
    .to(seal, { prop: "rotation", from: -18 * DEG, to: 0, start: 0.4, duration: 0.7, ease: outBack })
    // gentle idle spin-breathe
    .to(seal, { prop: "rotation", from: 0, to: 4 * DEG, start: 1.6, duration: 1.1, ease: outQuad })
    .to(seal, { prop: "rotation", from: 4 * DEG, to: -2 * DEG, start: 2.7, duration: 1.1, ease: outQuad });

  // Headline.
  const head = makeText(fonts, { text: headline, role: "display", weight: 700, size: L.headSize, color: textColor, anchor: 0.5, align: "center" });
  head.position.set(cx, L.headY);
  head.alpha = 0;
  root.addChild(head);
  timeline
    .to(head, { prop: "alpha", from: 0, to: 1, start: 1.0, duration: 0.45, ease: outQuad })
    .to(head, { prop: "scale.x", from: 1.25, to: 1, start: 1.0, duration: 0.45, ease: outExpo })
    .to(head, { prop: "scale.y", from: 1.25, to: 1, start: 1.0, duration: 0.45, ease: outExpo });

  // Price row: old (struck through) + new.
  const priceSize = Math.round(L.headSize * 0.66);
  const oldT = makeText(fonts, { text: oldPrice, role: "display", weight: 500, size: priceSize, color: textColor, anchor: { x: 1, y: 0.5 } });
  oldT.alpha = 0;
  const newT = makeText(fonts, { text: newPrice, role: "display", weight: 700, size: Math.round(priceSize * 1.25), color: accent, anchor: { x: 0, y: 0.5 } });
  newT.alpha = 0;
  const gap = L.headSize * 0.5;
  oldT.position.set(cx - gap * 0.5, L.priceY);
  newT.position.set(cx + gap * 0.5, L.priceY);
  root.addChild(oldT);
  root.addChild(newT);
  const strike = new Graphics().roundRect(0, 0, oldT.width + priceSize * 0.2, Math.max(3, priceSize * 0.08), 2).fill(textColor);
  strike.pivot.set(0, strike.height / 2);
  strike.position.set(cx - gap * 0.5 - oldT.width - priceSize * 0.1, L.priceY);
  strike.scale.set(0, 1);
  root.addChild(strike);
  timeline
    .to(oldT, { prop: "alpha", from: 0, to: 0.7, start: 1.35, duration: 0.4, ease: outQuad })
    .to(newT, { prop: "alpha", from: 0, to: 1, start: 1.7, duration: 0.4, ease: outQuad })
    .to(newT, { prop: "y", from: L.priceY + 14, to: L.priceY, start: 1.7, duration: 0.5, ease: outBack })
    .to(strike, { prop: "scale.x", from: 0, to: 1, start: 1.55, duration: 0.35, ease: outExpo });

  // CTA pill.
  const ctaC = new Container();
  ctaC.position.set(cx, L.ctaY);
  const ctaText = makeText(fonts, { text: cta, role: "display", weight: 700, size: Math.round(L.headSize * 0.4), color: onAccent, anchor: 0.5 });
  const ctaW = ctaText.width + L.headSize * 0.9;
  const ctaH = L.headSize * 0.92;
  ctaC.addChild(makePill(ctaW, ctaH, accent));
  ctaC.addChild(ctaText);
  ctaC.scale.set(0);
  root.addChild(ctaC);
  timeline
    .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: 2.1, duration: 0.6, ease: spring(0.45) })
    .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: 2.1, duration: 0.6, ease: spring(0.45) })
    .to(ctaC, { prop: "scale.x", from: 1, to: 1.04, start: 3.0, duration: 0.45, ease: outQuad })
    .to(ctaC, { prop: "scale.x", from: 1.04, to: 1, start: 3.45, duration: 0.45, ease: outQuad });

  return { timeline, duration: 4.0 };
}

export const specialOffer: TemplateDefinition = {
  id: "special-offer",
  name: "Special Offer",
  tagline: "A discount seal stamps in over a price slash and CTA.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.5,
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "LIMITED TIME OFFER", maxLength: 32, optional: true },
    { key: "discount", type: "text", label: "Discount", default: "50% OFF", maxLength: 12 },
    { key: "headline", type: "text", label: "Headline", default: "Summer Sale", maxLength: 28, shrinkToFit: true },
    { key: "oldPrice", type: "text", label: "Old price", default: "$49", maxLength: 10, optional: true },
    { key: "newPrice", type: "text", label: "New price", default: "$24", maxLength: 10 },
    { key: "cta", type: "text", label: "Button", default: "Shop now", maxLength: 20 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

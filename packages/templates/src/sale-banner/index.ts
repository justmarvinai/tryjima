import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makePill } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const DEG = Math.PI / 180;

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

// onAccent is ink (#101014) everywhere — ≥4.5:1 on each accent below.
const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", onAccent: "#101014" } },
  { id: "cream", name: "Cream", colors: { background: "#FFF1EC", textColor: "#101014", accent: "#FF4D1C", onAccent: "#101014" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", onAccent: "#101014" } },
  { id: "violet", name: "Violet", colors: { background: "#241052", textColor: "#FFFFFF", accent: "#8F73FF", onAccent: "#101014" } },
];

interface L {
  discY: number;
  headY: number;
  ctaY: number;
}

function layout(aspect: Aspect, h: number): L {
  const f: Record<Aspect, { disc: number; head: number; cta: number }> = {
    "1:1": { disc: 0.4, head: 0.57, cta: 0.72 },
    "4:5": { disc: 0.38, head: 0.54, cta: 0.69 },
    "9:16": { disc: 0.42, head: 0.55, cta: 0.66 },
    "16:9": { disc: 0.4, head: 0.58, cta: 0.76 },
  };
  const b = f[aspect];
  return { discY: h * b.disc, headY: h * b.head, ctaY: h * b.cta };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#101014"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#101014");
  const showAccentBar = values.accentBar !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const aspect = ctx.aspect;
  const L = layout(aspect, h);

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  // --- Diagonal accent stripes (slide in behind content, decorative low-alpha) ---
  const diag = Math.hypot(w, h);
  const stripeLen = diag * 1.4;
  const angle = -20 * DEG;
  const stripeDefs = [
    { dy: -h * 0.26, sw: minDim * 0.14, alpha: 0.16, delay: 0.0 },
    { dy: 0, sw: minDim * 0.1, alpha: 0.1, delay: 0.08 },
    { dy: h * 0.28, sw: minDim * 0.16, alpha: 0.16, delay: 0.16 },
  ];
  stripeDefs.forEach((s) => {
    const stripe = new Graphics().roundRect(-stripeLen / 2, -s.sw / 2, stripeLen, s.sw, s.sw / 2).fill({ color: accent, alpha: s.alpha });
    stripe.rotation = angle;
    const restX = cx;
    const restY = h / 2 + s.dy;
    stripe.position.set(restX, restY);
    root.addChild(stripe);
    timeline.to(stripe, { prop: "x", from: restX - w * 1.3, to: restX, start: s.delay, duration: 0.7, ease: outExpo });
  });

  // --- Marquee strips ("SALE • …") along top + bottom edges ---
  const barH = Math.max(minDim * 0.05, 44);
  const wordSize = Math.round(barH * 0.42);
  const word = "SALE   •   ";
  let marquee = "";
  while (fonts.measure(marquee, { family: fonts.family("display"), weight: 700, size: wordSize, letterSpacing: 3 }) < w * 1.15) {
    marquee += word;
  }
  const topEdge = aspect === "9:16" ? 220 : Math.round(minDim * 0.05);
  const botEdge = aspect === "9:16" ? h - 400 : h - Math.round(minDim * 0.05) - barH;
  [topEdge, botEdge].forEach((yTop, i) => {
    const strip = new Container();
    strip.position.set(0, yTop);
    strip.addChild(new Graphics().rect(0, 0, w, barH).fill(accent));
    strip.addChild(makeText(fonts, { text: marquee, role: "display", weight: 700, size: wordSize, color: onAccent, anchor: { x: 0, y: 0.5 }, letterSpacing: 3 }));
    (strip.children[1] as { position: { set: (x: number, y: number) => void } }).position.set(barH * 0.3, barH / 2);
    strip.alpha = 0;
    root.addChild(strip);
    timeline
      .to(strip, { prop: "alpha", from: 0, to: 1, start: 0.15 + i * 0.1, duration: 0.4, ease: outQuad })
      .to(strip, { prop: "y", from: yTop + (i === 0 ? -barH : barH), to: yTop, start: 0.15 + i * 0.1, duration: 0.5, ease: outExpo });
  });

  // --- Discount (huge, slams in) ---
  const discRaw = str(values.discount, "30% OFF").toUpperCase();
  const discSize = fitSize(fonts, discRaw, "display", 700, Math.round(minDim * 0.19), w * 0.86);
  const disc = makeText(fonts, { text: discRaw, role: "display", weight: 700, size: discSize, color: textColor, anchor: 0.5, align: "center" });
  disc.position.set(cx, L.discY);
  disc.alpha = 0;
  root.addChild(disc);
  timeline
    .to(disc, { prop: "alpha", from: 0, to: 1, start: 0.35, duration: 0.2, ease: outQuad })
    .to(disc, { prop: "scale.x", from: 1.35, to: 1, start: 0.35, duration: 0.5, ease: outExpo })
    .to(disc, { prop: "scale.y", from: 1.35, to: 1, start: 0.35, duration: 0.5, ease: outExpo });

  // Accent slash under the discount (energy, not behind glyphs).
  if (showAccentBar) {
    const slashW = Math.min(w * 0.5, disc.width * 0.9);
    const slash = new Graphics().roundRect(-slashW / 2, -minDim * 0.012, slashW, minDim * 0.024, minDim * 0.012).fill(accent);
    slash.rotation = -3 * DEG;
    slash.position.set(cx, L.discY + discSize * 0.62);
    slash.scale.set(0, 1);
    root.addChild(slash);
    timeline.to(slash, { prop: "scale.x", from: 0, to: 1, start: 0.7, duration: 0.4, ease: outExpo });
  }

  // --- Headline / detail line ---
  const headRaw = str(values.headline, "Everything must go");
  const headSize = fitSize(fonts, headRaw, "body", 600, Math.round(minDim * 0.05), w * 0.82);
  const head = makeText(fonts, { text: headRaw, role: "body", weight: 600, size: headSize, color: textColor, anchor: 0.5, align: "center" });
  head.position.set(cx, L.headY);
  head.alpha = 0;
  root.addChild(head);
  timeline
    .to(head, { prop: "alpha", from: 0, to: 1, start: 0.95, duration: 0.4, ease: outQuad })
    .to(head, { prop: "y", from: L.headY + 16, to: L.headY, start: 0.95, duration: 0.5, ease: outExpo });

  // --- CTA pill (springs in, pulses) ---
  const ctaRaw = str(values.cta, "Shop the sale");
  const ctaSize = Math.round(minDim * 0.044);
  const ctaLabel = makeText(fonts, { text: ctaRaw, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
  const ctaW = Math.min(w * 0.86, ctaLabel.width + ctaSize * 1.8);
  const ctaH = ctaSize * 2.0;
  const ctaC = new Container();
  ctaC.position.set(cx, L.ctaY);
  ctaC.addChild(makePill(ctaW, ctaH, accent));
  ctaC.addChild(ctaLabel);
  ctaC.scale.set(0);
  root.addChild(ctaC);
  timeline
    .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: 1.35, duration: 0.55, ease: spring(0.42) })
    .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: 1.35, duration: 0.55, ease: spring(0.42) })
    .to(ctaC, { prop: "scale.x", from: 1, to: 1.06, start: 2.5, duration: 0.2, ease: outQuad })
    .to(ctaC, { prop: "scale.x", from: 1.06, to: 1, start: 2.7, duration: 0.25, ease: outQuad })
    .to(ctaC, { prop: "scale.y", from: 1, to: 1.06, start: 2.5, duration: 0.2, ease: outQuad })
    .to(ctaC, { prop: "scale.y", from: 1.06, to: 1, start: 2.7, duration: 0.25, ease: outQuad });

  return { timeline, duration: 4.0 };
}

export const saleBanner: TemplateDefinition = {
  id: "sale-banner",
  name: "Sale Banner",
  tagline: "A bold striped sale banner with a huge discount and CTA.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  palettes: PALETTES,
  fields: [
    { key: "discount", type: "text", label: "Discount", default: "30% OFF", maxLength: 14, shrinkToFit: true },
    { key: "headline", type: "text", label: "Headline", default: "Everything must go", maxLength: 40, shrinkToFit: true },
    { key: "cta", type: "text", label: "Button", default: "Shop the sale", maxLength: 20 },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

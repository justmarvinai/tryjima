import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

const DEFAULT_NAMES = ["Aero Bottle", "Trail Mug", "City Flask"];
const DEFAULT_PRICES = ["$29", "$24", "$34"];

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F", onAccent: "#FFFFFF", muted: "#6B6B60" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", muted: "#6A5E85" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", muted: "#5A6A82" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", muted: "#8A93A0" } },
];

interface CCfg {
  frameWF: number;
  frameHF: number;
  frameCyF: number;
  nameF: number;
  dotRF: number;
}

const CCFG: Record<Aspect, CCfg> = {
  "1:1": { frameWF: 0.6, frameHF: 0.46, frameCyF: 0.4, nameF: 0.072, dotRF: 0.011 },
  "4:5": { frameWF: 0.64, frameHF: 0.46, frameCyF: 0.4, nameF: 0.074, dotRF: 0.011 },
  "9:16": { frameWF: 0.72, frameHF: 0.42, frameCyF: 0.38, nameF: 0.082, dotRF: 0.013 },
  "16:9": { frameWF: 0.34, frameHF: 0.46, frameCyF: 0.38, nameF: 0.05, dotRF: 0.009 },
};

function nameList(values: Values): string[] {
  return asItems(values.names, DEFAULT_NAMES).slice(0, 4);
}

function computeDuration(values: Values): number {
  return 0.8 + nameList(values).length * 1.1 + 0.6;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

/** A carousel slide: cover-fit image (clipped by the viewport mask) or a designed placeholder. */
function slideNode(tex: Texture | null, w: number, h: number, accent: string): Container {
  const c = new Container();
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(w / tex.width, h / tex.height);
    s.scale.set(cover);
    c.addChild(s);
  } else {
    const minDim = Math.min(w, h);
    c.addChild(new Graphics().rect(-w / 2, -h / 2, w, h).fill({ color: accent, alpha: 0.06 }));
    c.addChild(new Graphics().circle(0, 0, minDim * 0.3).fill({ color: accent, alpha: 0.12 }));
    const bw = minDim * 0.26;
    const bh = minDim * 0.44;
    const r = bw * 0.24;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, r).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.32, r).fill({ color: 0xffffff, alpha: 0.18 }));
  }
  return c;
}

/** A price tag chip (accent pill + label). */
function priceChip(fonts: TemplateContext["fonts"], price: string, size: number, accent: string, onAccent: string, maxW: number): Container {
  const c = new Container();
  const label = fitText(fonts, { text: price, role: "display", weight: 700, size, color: onAccent, anchor: 0.5 }, maxW);
  const pw = label.width + size * 1.3;
  const ph = size * 1.6;
  c.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill(accent));
  c.addChild(label);
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const muted = pc("muted", "#6B6B60");

  const names = nameList(values);
  const prices = asItems(values.prices, DEFAULT_PRICES);
  const n = names.length;
  const imgs: (Texture | null)[] = [
    images.image1 ?? null,
    images.image2 ?? null,
    images.image3 ?? null,
    images.image4 ?? null,
  ];

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));

  const cfg = CCFG[ctx.aspect];
  const frameW = W * cfg.frameWF;
  const frameH = H * cfg.frameHF;
  const frameCy = H * cfg.frameCyF;
  const frameR = Math.min(frameW, frameH) * 0.08;

  const timeline = new JimaTimeline();

  // --- Timing ---
  const T0 = 0.8;
  const PER = 1.1;
  const shiftFrame = frameW * 0.6;
  const shiftLabel = W * 0.05;
  const slideDur = 0.52;
  const fadeDur = 0.4;

  // --- Framed card (springs in; clips the slides) ---
  const card = new Container();
  card.position.set(cx, frameCy);
  card.addChild(new Graphics().roundRect(-frameW / 2, -frameH / 2 + frameH * 0.04, frameW, frameH, frameR).fill({ color: 0x000000, alpha: 0.12 }));
  card.addChild(new Graphics().roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameR).fill(cardColor));

  const viewport = new Container();
  card.addChild(viewport);
  const maskG = new Graphics().roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameR).fill(0xffffff);
  card.addChild(maskG);
  viewport.mask = maskG;

  card.addChild(new Graphics().roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameR).stroke({ color: textColor, width: Math.max(1, frameW * 0.005), alpha: 0.12 }));
  root.addChild(card);
  card.alpha = 0;
  card.scale.set(0.86);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.35, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.86, to: 1, start: 0.2, duration: 0.8, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.86, to: 1, start: 0.2, duration: 0.8, ease: spring(0.5) });

  // --- Labels (name + price chip) fade in with the card ---
  const labelsC = new Container();
  root.addChild(labelsC);
  labelsC.alpha = 0;
  timeline.to(labelsC, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.5, ease: outQuad });

  const frameBottom = frameCy + frameH / 2;
  const gap = Math.min(W, H) * 0.05;
  const nameSize = Math.round(W * cfg.nameF);
  const nameY = frameBottom + gap + nameSize * 0.5;
  const priceSize = Math.round(nameSize * 0.82);
  const priceChipH = priceSize * 1.6;
  const priceY = nameY + nameSize * 0.6 + priceChipH / 2;
  const dotR = Math.max(4, W * cfg.dotRF);
  const dotsY = priceY + priceChipH / 2 + gap * 0.7 + dotR;

  // --- Per-product build: slide + name + price, each crossfading in sync ---
  for (let i = 0; i < n; i++) {
    const slide = slideNode(imgs[i] ?? null, frameW, frameH, accent);
    slide.position.set(i === 0 ? 0 : shiftFrame, 0);
    slide.alpha = i === 0 ? 1 : 0;
    viewport.addChild(slide);

    const nm = fitText(
      fonts,
      { text: str(names[i], `Item ${i + 1}`), role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" },
      W * 0.82,
    );
    nm.position.set(i === 0 ? cx : cx + shiftLabel, nameY);
    nm.alpha = i === 0 ? 1 : 0;
    labelsC.addChild(nm);

    const price = str(prices[i], "");
    let pr: Container | null = null;
    if (price.length > 0) {
      pr = priceChip(fonts, price, priceSize, accent, onAccent, frameW * 0.86);
      pr.position.set(i === 0 ? cx : cx + shiftLabel, priceY);
      pr.alpha = i === 0 ? 1 : 0;
      labelsC.addChild(pr);
    }

    // Exit at the boundary into the next product.
    if (i < n - 1) {
      const outAt = T0 + (i + 1) * PER - 0.26;
      timeline
        .to(slide, { prop: "x", from: 0, to: -shiftFrame, start: outAt, duration: slideDur, ease: outCubic })
        .to(slide, { prop: "alpha", from: 1, to: 0, start: outAt, duration: fadeDur, ease: outQuad })
        .to(nm, { prop: "x", from: cx, to: cx - shiftLabel, start: outAt, duration: slideDur, ease: outCubic })
        .to(nm, { prop: "alpha", from: 1, to: 0, start: outAt, duration: fadeDur, ease: outQuad });
      if (pr) {
        timeline
          .to(pr, { prop: "x", from: cx, to: cx - shiftLabel, start: outAt, duration: slideDur, ease: outCubic })
          .to(pr, { prop: "alpha", from: 1, to: 0, start: outAt, duration: fadeDur, ease: outQuad });
      }
    }

    // Enter at its own boundary (product 0 starts already held).
    if (i >= 1) {
      const inAt = T0 + i * PER - 0.26;
      timeline
        .to(slide, { prop: "x", from: shiftFrame, to: 0, start: inAt, duration: slideDur, ease: outCubic })
        .to(slide, { prop: "alpha", from: 0, to: 1, start: inAt, duration: fadeDur, ease: outQuad })
        .to(nm, { prop: "x", from: cx + shiftLabel, to: cx, start: inAt, duration: slideDur, ease: outCubic })
        .to(nm, { prop: "alpha", from: 0, to: 1, start: inAt, duration: fadeDur, ease: outQuad });
      if (pr) {
        timeline
          .to(pr, { prop: "x", from: cx + shiftLabel, to: cx, start: inAt, duration: slideDur, ease: outCubic })
          .to(pr, { prop: "alpha", from: 0, to: 1, start: inAt, duration: fadeDur, ease: outQuad });
      }
    }
  }

  // --- Dot indicators (muted base row + a traveling accent dot) ---
  const dotsC = new Container();
  root.addChild(dotsC);
  dotsC.alpha = 0;
  timeline.to(dotsC, { prop: "alpha", from: 0, to: 1, start: 0.6, duration: 0.5, ease: outQuad });

  const dotPitch = dotR * 3.2;
  const dotsW = (n - 1) * dotPitch;
  const dotX = (i: number): number => cx - dotsW / 2 + i * dotPitch;

  const base = new Graphics();
  for (let i = 0; i < n; i++) base.circle(dotX(i), dotsY, dotR);
  base.fill({ color: muted, alpha: 0.4 });
  dotsC.addChild(base);

  const travDot = new Graphics().circle(0, 0, dotR * 1.3).fill(accent);
  travDot.position.set(dotX(0), dotsY);
  dotsC.addChild(travDot);
  for (let i = 1; i < n; i++) {
    const at = T0 + i * PER - 0.26;
    timeline.to(travDot, { prop: "x", from: dotX(i - 1), to: dotX(i), start: at, duration: slideDur, ease: outCubic });
  }

  return { timeline, duration: computeDuration(values) };
}

export const productCarousel: TemplateDefinition = {
  id: "product-carousel",
  name: "Product Carousel",
  tagline: "A framed product cycles through your catalog with prices and dots.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.4,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "names", type: "textlist", label: "Names", default: DEFAULT_NAMES, minItems: 2, maxItems: 4, maxLength: 24 },
    { key: "prices", type: "textlist", label: "Prices", default: DEFAULT_PRICES, minItems: 2, maxItems: 4, maxLength: 10 },
    { key: "image1", type: "image", label: "Image 1", default: "", optional: true },
    { key: "image2", type: "image", label: "Image 2", default: "", optional: true },
    { key: "image3", type: "image", label: "Image 3", default: "", optional: true },
    { key: "image4", type: "image", label: "Image 4", default: "", optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

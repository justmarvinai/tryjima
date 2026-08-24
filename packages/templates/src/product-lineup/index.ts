import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
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

const DEFAULT_NAMES = ["Mini", "Classic", "Max"];
const DEFAULT_PRICES = ["$19", "$29", "$39"];

const PALETTES: Palette[] = [
  { id: "fresh-white", name: "Fresh white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F", onAccent: "#FFFFFF", muted: "#6B6B60" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", muted: "#6A5E85" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", muted: "#5A6A82" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", muted: "#8A93A0" } },
];

interface PLCfg {
  availWF: number;
  titleYF: number;
  centerYF: number;
  titleF: number;
  nameF: number;
  column: boolean;
}

const PLCFG: Record<Aspect, PLCfg> = {
  "16:9": { availWF: 0.86, titleYF: 0.13, centerYF: 0.54, titleF: 0.05, nameF: 0.032, column: false },
  "1:1": { availWF: 0.9, titleYF: 0.12, centerYF: 0.54, titleF: 0.058, nameF: 0.044, column: false },
  "4:5": { availWF: 0.9, titleYF: 0.11, centerYF: 0.52, titleF: 0.058, nameF: 0.044, column: false },
  "9:16": { availWF: 0.9, titleYF: 0.135, centerYF: 0.5, titleF: 0.06, nameF: 0.05, column: true },
};

function nameListOf(values: Values): string[] {
  return asItems(values.names, DEFAULT_NAMES).slice(0, 3);
}

function computeDuration(values: Values): number {
  return 1.0 + nameListOf(values).length * 0.4 + 1.4;
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

/** A rounded product frame: cover-fit masked image or a designed placeholder. */
function productFrame(side: number, r: number, tex: Texture | null, cardColor: string, accent: string, borderC: string): Container {
  const c = new Container();
  c.addChild(new Graphics().roundRect(-side / 2, -side / 2 + side * 0.04, side, side, r).fill({ color: 0x000000, alpha: 0.1 }));
  c.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(cardColor));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.max(side / tex.width, side / tex.height));
    const mask = new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    c.addChild(new Graphics().circle(0, 0, side * 0.32).fill({ color: accent, alpha: 0.12 }));
    c.addChild(new Graphics().circle(0, 0, side * 0.22).fill({ color: accent, alpha: 0.2 }));
    const bw = side * 0.28;
    const bh = side * 0.42;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
  c.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, r).stroke({ color: borderC, width: Math.max(1, side * 0.006), alpha: 0.35 }));
  return c;
}

/** A price tag chip (accent pill + label); returns the container and its width. */
function priceChip(fonts: TemplateContext["fonts"], price: string, size: number, accent: string, onAccent: string, maxW: number): { node: Container; width: number } {
  const node = new Container();
  const label = fitText(fonts, { text: price, role: "display", weight: 700, size, color: onAccent, anchor: 0.5 }, maxW);
  const pw = label.width + size * 1.2;
  const ph = size * 1.5;
  node.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill(accent));
  node.addChild(label);
  return { node, width: pw };
}

interface Item {
  cx: number;
  cy: number;
  side: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const title = str(values.title, "The collection");

  const names = nameListOf(values);
  const prices = asItems(values.prices, DEFAULT_PRICES);
  const n = names.length;
  const imgs: (Texture | null)[] = [images.image1 ?? null, images.image2 ?? null, images.image3 ?? null];

  const W = size.width;
  const H = size.height;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));

  const cfg = PLCFG[ctx.aspect];
  const gap = Math.min(W, H) * 0.045;
  const nameSize = Math.round(W * cfg.nameF);
  const priceSize = Math.round(nameSize * 0.86);
  const timeline = new JimaTimeline();

  // --- Item cells ---
  const items: Item[] = [];
  const horizontal = cfg.column;
  let textLocalX = 0;
  let textMaxW = 0;
  if (!cfg.column) {
    const availW = W * cfg.availWF;
    const pitch = availW / n;
    const side = Math.min(pitch * 0.84, H * 0.4);
    const frameCenterY = H * cfg.centerYF - H * 0.05;
    for (let i = 0; i < n; i++) {
      const x = W / 2 - availW / 2 + pitch * (i + 0.5);
      const rhythm = (i % 2 === 0 ? 1 : -1) * H * 0.018;
      items.push({ cx: x, cy: frameCenterY + rhythm, side });
    }
    textMaxW = side * 1.3;
  } else {
    const bandTop = 350;
    const bandBot = H - 380;
    const pitch = (bandBot - bandTop) / n;
    const side = Math.min(W * 0.34, pitch * 0.64);
    textMaxW = W * 0.4;
    const cellW = side + gap + textMaxW;
    textLocalX = side / 2 + gap;
    for (let i = 0; i < n; i++) {
      const cy = bandTop + pitch * (i + 0.5);
      const rhythmX = (i % 2 === 0 ? 1 : -1) * W * 0.03;
      const left = W / 2 - cellW / 2 + rhythmX;
      items.push({ cx: left + side / 2, cy, side });
    }
  }

  const rise = H * 0.1;
  items.forEach((it, i) => {
    const itemC = new Container();
    const frameR = it.side * 0.09;
    const frame = productFrame(it.side, frameR, imgs[i] ?? null, cardColor, accent, textColor);
    itemC.addChild(frame);

    if (!horizontal) {
      const nameLY = it.side / 2 + gap + nameSize * 0.55;
      const nm = fitText(
        fonts,
        { text: str(names[i], `Item ${i + 1}`), role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" },
        textMaxW,
      );
      nm.position.set(0, nameLY);
      itemC.addChild(nm);
      const price = str(prices[i], "");
      if (price.length > 0) {
        const { node } = priceChip(fonts, price, priceSize, accent, onAccent, textMaxW);
        node.position.set(0, nameLY + nameSize * 0.5 + priceSize * 0.75 + gap * 0.3);
        itemC.addChild(node);
      }
    } else {
      const nm = fitText(
        fonts,
        { text: str(names[i], `Item ${i + 1}`), role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } },
        textMaxW,
      );
      nm.position.set(textLocalX, -nameSize * 0.1);
      itemC.addChild(nm);
      const price = str(prices[i], "");
      if (price.length > 0) {
        const { node, width } = priceChip(fonts, price, priceSize, accent, onAccent, textMaxW);
        node.position.set(textLocalX + width / 2, nameSize * 0.95);
        itemC.addChild(node);
      }
    }

    itemC.position.set(it.cx, it.cy);
    itemC.alpha = 0;
    itemC.scale.set(0.8);
    root.addChild(itemC);

    const start = 0.6 + i * 0.34;
    timeline
      .to(itemC, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(itemC, { prop: "y", from: it.cy + rise, to: it.cy, start, duration: 0.75, ease: spring(0.5) })
      .to(itemC, { prop: "scale.x", from: 0.8, to: 1, start, duration: 0.75, ease: spring(0.5) })
      .to(itemC, { prop: "scale.y", from: 0.8, to: 1, start, duration: 0.75, ease: spring(0.5) });
  });

  // --- Title on top ---
  const titleSize = Math.round(W * cfg.titleF);
  const titleY = cfg.column ? 260 : H * cfg.titleYF;
  const titleText = fitText(
    fonts,
    { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
    W * 0.86,
  );
  titleText.position.set(W / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 18, to: titleY, start: 0.1, duration: 0.6, ease: outExpo });

  return { timeline, duration: computeDuration(values) };
}

export const productLineup: TemplateDefinition = {
  id: "product-lineup",
  name: "Product Lineup",
  tagline: "A family of products springs up in a tidy lineup.",
  category: "product",
  aspects: ["16:9", "1:1", "4:5", "9:16"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "The collection", maxLength: 32, shrinkToFit: true },
    { key: "names", type: "textlist", label: "Names", default: DEFAULT_NAMES, minItems: 2, maxItems: 3, maxLength: 18 },
    { key: "prices", type: "textlist", label: "Prices", default: DEFAULT_PRICES, minItems: 2, maxItems: 3, maxLength: 10 },
    { key: "image1", type: "image", label: "Image 1", default: "", optional: true },
    { key: "image2", type: "image", label: "Image 2", default: "", optional: true },
    { key: "image3", type: "image", label: "Image 3", default: "", optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

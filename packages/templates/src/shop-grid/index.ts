import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
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

const DEFAULT_PRODUCTS = ["Bottle | $29", "Mug | $19", "Flask | $34", "Tote | $15"];

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", accent: "#FF4D1C", textColor: "#14140F", onAccent: "#FFFFFF", tile: "#FFFFFF", muted: "#B7B2A6" } },
  { id: "violet-cream", name: "Violet cream", colors: { background: "#F2EEFB", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", tile: "#FFFFFF", muted: "#BCB0DA" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", tile: "#FFFFFF", muted: "#A9BFDE" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", tile: "#21252C", muted: "#6B7480" } },
];

function productList(values: Values): string[] {
  return asItems(values.products, DEFAULT_PRODUCTS).slice(0, 6);
}

function computeDuration(values: Values): number {
  const n = Math.max(2, Math.min(6, productList(values).length));
  return 1.0 + n * 0.3 + 1.4;
}

interface Product {
  name: string;
  price: string;
}

function parseProduct(s: string): Product {
  const idx = s.indexOf("|");
  if (idx === -1) return { name: s.trim(), price: "" };
  return { name: s.slice(0, idx).trim(), price: s.slice(idx + 1).trim() };
}

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one line. */
function fitSize(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return maxWidth > 0 && w > maxWidth ? Math.max(9, Math.floor((size0 * maxWidth) / w)) : size0;
}

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.045 : aspect === "9:16" ? 0.06 : 0.056;
}

/** A small "picture" glyph (frame + sun + hills) for empty product slots. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.05 * s) });
  g.circle(-0.18 * s, -0.12 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.02 * s, 0.06 * s, 0.16 * s, 0.28 * s, -0.1 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

/** One product card: framed cover-fit image (or placeholder) + name + price chip. */
function makeCard(
  pitch: number,
  prod: Product,
  tex: Texture | null,
  fonts: TemplateContext["fonts"],
  colors: { accent: string; textColor: string; onAccent: string; tile: string; muted: string },
): Container {
  const cell = new Container();
  const pad = pitch * 0.06;
  const nameSize = Math.round(pitch * 0.11);
  const nameH = nameSize * 1.1;
  const nameGap = pitch * 0.05;
  const imgSide = Math.min(pitch - pad * 2, pitch - nameH - nameGap - pad * 2);
  const blockH = imgSide + nameGap + nameH;
  const imgCy = -blockH / 2 + imgSide / 2;
  const nameCy = -blockH / 2 + imgSide + nameGap + nameH / 2;
  const r = imgSide * 0.1;

  // Frame: shadow + under-fill.
  cell.addChild(new Graphics().roundRect(-imgSide / 2, imgCy - imgSide / 2 + imgSide * 0.04, imgSide, imgSide, r).fill({ color: 0x000000, alpha: 0.1 }));
  cell.addChild(new Graphics().roundRect(-imgSide / 2, imgCy - imgSide / 2, imgSide, imgSide, r).fill(colors.tile));
  if (tex) {
    const holder = new Container();
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(imgSide / tex.width, imgSide / tex.height);
    s.scale.set(cover);
    s.position.set(0, imgCy);
    const mask = new Graphics().roundRect(-imgSide / 2, imgCy - imgSide / 2, imgSide, imgSide, r).fill(0xffffff);
    holder.addChild(s, mask);
    s.mask = mask;
    cell.addChild(holder);
  } else {
    const blobWrap = new Container();
    const blob = new Graphics().circle(imgSide * 0.28, imgCy - imgSide * 0.28, imgSide * 0.34).fill({ color: colors.accent, alpha: 0.14 });
    const blobMask = new Graphics().roundRect(-imgSide / 2, imgCy - imgSide / 2, imgSide, imgSide, r).fill(0xffffff);
    blobWrap.addChild(blob, blobMask);
    blob.mask = blobMask;
    cell.addChild(blobWrap);
    const glyph = imageGlyph(imgSide * 0.32, colors.muted);
    glyph.position.set(0, imgCy);
    cell.addChild(glyph);
  }
  cell.addChild(new Graphics().roundRect(-imgSide / 2, imgCy - imgSide / 2, imgSide, imgSide, r).stroke({ color: colors.textColor, width: Math.max(1, imgSide * 0.006), alpha: 0.25 }));

  // Name under the frame.
  const nameFit = fitSize(fonts, prod.name, "display", 700, nameSize, imgSide);
  const nameText = makeText(fonts, { text: prod.name, role: "display", weight: 700, size: nameFit, color: colors.textColor, anchor: 0.5, align: "center" });
  nameText.position.set(0, nameCy);
  cell.addChild(nameText);

  // Price chip on the frame's bottom-right corner.
  if (prod.price.length > 0) {
    const chipFont = Math.round(pitch * 0.075);
    const label = makeText(fonts, { text: prod.price, role: "display", weight: 700, size: chipFont, color: colors.onAccent, anchor: 0.5 });
    const chipW = label.width + chipFont * 0.9;
    const chipH = chipFont * 1.5;
    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(colors.accent));
    chip.addChild(label);
    chip.position.set(imgSide / 2 - chipW / 2 - pad * 0.5, imgCy + imgSide / 2 - chipH / 2 - pad * 0.5);
    cell.addChild(chip);
  }

  return cell;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const aspect: Aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const tile = pc("tile", "#FFFFFF");
  const muted = pc("muted", "#B7B2A6");

  const title = str(values.title, "Shop the collection");
  const products = productList(values).map(parseProduct);
  const n = products.length;
  const cta = str(values.cta, "Shop now");
  const hasCta = cta.length > 0;

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  const minDim = Math.min(W, H);
  const margin = Math.round(minDim * 0.06);
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));
  const timeline = new JimaTimeline();

  const imgs: (Texture | null)[] = [
    images.image1 ?? null,
    images.image2 ?? null,
    images.image3 ?? null,
    images.image4 ?? null,
  ];

  // --- Title ---
  const titleSize0 = Math.round(W * titleFrac(aspect));
  const titleSize = fitSize(fonts, title, "display", 700, titleSize0, W - margin * 2);
  const titleTop = aspect === "9:16" ? 220 : margin;
  const titleY = titleTop + titleSize * 0.7;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 16, to: titleY, start: 0.1, duration: 0.6, ease: outExpo });

  // --- CTA pill (bottom) ---
  const ctaSize = Math.round(minDim * (aspect === "16:9" ? 0.03 : 0.04));
  const ctaH = ctaSize * 2.05;
  const ctaBottom = aspect === "9:16" ? H - 400 : H - margin;
  const ctaCy = ctaBottom - ctaH / 2 - minDim * 0.01;

  // --- Grid geometry (square pitch, 2 columns) ---
  const rows = Math.ceil(n / 2);
  const gridTop = titleY + titleSize * 0.6 + minDim * 0.05;
  const gridBottom = ctaCy - ctaH / 2 - minDim * 0.04;
  const availW = W - margin * 2;
  const availH = gridBottom - gridTop;
  const pitch = Math.min(availW / 2, availH / rows);
  const gridCx = cx;
  const gridCy = (gridTop + gridBottom) / 2;

  const cardColors = { accent, textColor, onAccent, tile, muted };
  products.forEach((prod, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const alone = n % 2 === 1 && i === n - 1;
    const cardCx = alone ? gridCx : gridCx + (col === 0 ? -pitch / 2 : pitch / 2);
    const cardCy = gridCy + (row - (rows - 1) / 2) * pitch;

    const card = makeCard(pitch, prod, i < 4 ? imgs[i] ?? null : null, fonts, cardColors);
    card.position.set(cardCx, cardCy);
    card.scale.set(0);
    card.alpha = 0;
    root.addChild(card);
    const start = 0.7 + i * 0.3;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(card, { prop: "scale.x", from: 0, to: 1, start, duration: 0.65, ease: spring(0.5) })
      .to(card, { prop: "scale.y", from: 0, to: 1, start, duration: 0.65, ease: spring(0.5) });
  });

  // --- CTA pill ---
  if (hasCta) {
    const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
    const ctaW = ctaLabel.width + ctaSize * 1.8;
    const ctaNode = new Container();
    ctaNode.addChild(new Graphics().roundRect(-ctaW / 2, -ctaH / 2, ctaW, ctaH, ctaH / 2).fill(accent));
    ctaNode.addChild(ctaLabel);
    ctaNode.position.set(cx, ctaCy);
    ctaNode.scale.set(0);
    root.addChild(ctaNode);
    const ctaStart = 1.0 + n * 0.3;
    timeline
      .to(ctaNode, { prop: "scale.x", from: 0, to: 1, start: ctaStart, duration: 0.55, ease: spring(0.45) })
      .to(ctaNode, { prop: "scale.y", from: 0, to: 1, start: ctaStart, duration: 0.55, ease: spring(0.45) });
  }

  return { timeline, duration: computeDuration(values) };
}

export const shopGrid: TemplateDefinition = {
  id: "shop-grid",
  name: "Shop Grid",
  tagline: "A collection of product cards pops into a shoppable grid.",
  category: "product",
  aspects: ["4:5", "1:1", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Shop the collection", maxLength: 32, shrinkToFit: true },
    { key: "products", type: "textlist", label: "Products (name | price)", default: DEFAULT_PRODUCTS, minItems: 2, maxItems: 6, maxLength: 28, help: 'One per card, e.g. "Bottle | $29".' },
    { key: "image1", type: "image", label: "Image 1", default: "", optional: true },
    { key: "image2", type: "image", label: "Image 2", default: "", optional: true },
    { key: "image3", type: "image", label: "Image 3", default: "", optional: true },
    { key: "image4", type: "image", label: "Image 4", default: "", optional: true },
    { key: "cta", type: "text", label: "Button", default: "Shop now", maxLength: 18, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

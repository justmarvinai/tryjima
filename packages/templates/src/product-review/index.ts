import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F", onAccent: "#FFFFFF", muted: "#6B6B60", empty: "#DAD6CC" } },
  { id: "violet-cream", name: "Violet cream", colors: { background: "#F2EEFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", muted: "#6A5E85", empty: "#DDD3F0" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", muted: "#5A6A82", empty: "#CFDCEE" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", muted: "#8A93A0", empty: "#333A44" } },
];

/** Greedy-wrap into ≤ maxLines lines, then shrink so the widest line fits. */
function wrapAndFit(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family(role);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(12, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

/** Product card: shadow + rounded bg + cover-fit masked image or designed placeholder. */
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
    const m = Math.min(w, h);
    c.addChild(new Graphics().circle(0, 0, m * 0.4).fill({ color: accent, alpha: 0.12 }));
    c.addChild(new Graphics().circle(0, 0, m * 0.29).fill({ color: accent, alpha: 0.2 }));
    const bw = m * 0.34;
    const bh = m * 0.5;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const aspect: Aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const muted = pc("muted", "#6B6B60");
  const emptyColor = pc("empty", "#DAD6CC");

  const name = str(values.name, "Aero Bottle");
  const rating = Math.max(1, Math.min(5, Math.round(num(values.rating, 5))));
  const quote = str(values.quote, "Best purchase I've made all year — worth every penny.");
  const author = str(values.author, "— Verified buyer");
  const cta = str(values.cta, "Shop now");
  const hasAuthor = author.length > 0;
  const hasCta = cta.length > 0;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const margin = Math.round(minDim * 0.06);
  const tex = images.product ?? null;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));
  const timeline = new JimaTimeline();

  const horizontal = aspect === "16:9" || aspect === "1:1";

  // --- Resolve card rect + content column ---
  let cardW: number;
  let cardH: number;
  let cardCx: number;
  let cardCy: number;
  let colCx: number; // left edge (horizontal) or center (vertical)
  let colW: number;
  let anchorX: 0 | 0.5;
  let starSize: number;
  let quoteSize0: number;
  let authorSize: number;
  let nameSize: number;
  let ctaSize: number;
  let quoteLines: number;

  if (horizontal) {
    cardW = aspect === "16:9" ? W * 0.4 : W * 0.46;
    cardH = aspect === "16:9" ? H * 0.74 : H * 0.66;
    cardCx = margin + cardW / 2;
    cardCy = H / 2;
    colCx = cardCx + cardW / 2 + W * 0.06;
    colW = W - margin - colCx;
    anchorX = 0;
    starSize = Math.round(W * (aspect === "16:9" ? 0.04 : 0.055));
    quoteSize0 = Math.round(W * (aspect === "16:9" ? 0.034 : 0.05));
    authorSize = Math.round(W * (aspect === "16:9" ? 0.022 : 0.032));
    nameSize = Math.round(W * (aspect === "16:9" ? 0.032 : 0.046));
    ctaSize = Math.round(W * (aspect === "16:9" ? 0.024 : 0.038));
    quoteLines = 4;
  } else {
    cardW = W * (aspect === "9:16" ? 0.74 : 0.72);
    cardH = cardW * 0.6;
    cardCx = W / 2;
    colCx = W / 2;
    colW = W - margin * 2;
    anchorX = 0.5;
    starSize = Math.round(W * (aspect === "9:16" ? 0.07 : 0.066));
    quoteSize0 = Math.round(W * (aspect === "9:16" ? 0.056 : 0.052));
    authorSize = Math.round(W * 0.036);
    nameSize = Math.round(W * 0.05);
    ctaSize = Math.round(W * 0.042);
    quoteLines = 3;
    cardCy = 0; // set after centering
  }

  // Measure content block.
  const starGap = starSize * 1.18;
  const starRowW = starGap * 4 + starSize;
  const { lines: qLines, size: qSize } = wrapAndFit(fonts, quote, "serif", 600, quoteSize0, colW, quoteLines);
  const qLH = Math.round(qSize * 1.32);
  const quoteH = qLines.length * qLH;
  const starH = starSize;
  const authorH = hasAuthor ? authorSize * 1.3 : 0;
  const nameH = nameSize * 1.12;
  const ctaH = ctaSize * 2.05;
  const gA = minDim * 0.05;
  const gB = minDim * 0.035;
  const gC = minDim * 0.03;
  const gD = minDim * 0.045;
  const contentH =
    starH + gA + quoteH + gB + (hasAuthor ? authorH + gC : 0) + nameH + (hasCta ? gD + ctaH : 0);

  let blockTop: number;
  if (horizontal) {
    blockTop = H / 2 - contentH / 2;
  } else {
    const top = aspect === "9:16" ? 220 : margin;
    const bottom = aspect === "9:16" ? H - 400 : H - margin;
    const gapMid = minDim * 0.05;
    const totalH = cardH + gapMid + contentH;
    const startY = Math.max(top, (top + bottom) / 2 - totalH / 2);
    cardCy = startY + cardH / 2;
    blockTop = startY + cardH + gapMid;
  }

  // --- Product card ---
  const cardR = Math.min(cardW, cardH) * 0.08;
  const card = productCard(cardW, cardH, cardR, tex, cardColor, accent);
  card.position.set(cardCx, cardCy);
  card.scale.set(0.88);
  card.alpha = 0;
  root.addChild(card);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.88, to: 1, start: 0.15, duration: 0.8, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.88, to: 1, start: 0.15, duration: 0.8, ease: spring(0.5) });

  // --- Stars ---
  const starCy = blockTop + starH / 2;
  const starStartX = anchorX === 0 ? colCx + starSize / 2 : colCx - starRowW / 2 + starSize / 2;
  for (let i = 0; i < 5; i++) {
    const holder = new Container();
    holder.addChild(makeIcon("star", starSize, { color: i < rating ? accent : emptyColor }));
    holder.position.set(starStartX + i * starGap, starCy);
    holder.scale.set(0);
    root.addChild(holder);
    const start = 0.35 + i * 0.1;
    timeline
      .to(holder, { prop: "scale.x", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(1.7) })
      .to(holder, { prop: "scale.y", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(1.7) });
  }

  // --- Quote ---
  const quoteY = starCy + starH / 2 + gA;
  const quoteText = makeText(fonts, { text: qLines.join("\n"), role: "serif", weight: 600, size: qSize, color: textColor, anchor: { x: anchorX, y: 0 }, lineHeight: qLH, align: anchorX === 0 ? "left" : "center" });
  quoteText.position.set(colCx, quoteY);
  quoteText.alpha = 0;
  root.addChild(quoteText);
  timeline
    .to(quoteText, { prop: "alpha", from: 0, to: 1, start: 1.0, duration: 0.5, ease: outQuad })
    .to(quoteText, { prop: "y", from: quoteY + 16, to: quoteY, start: 1.0, duration: 0.6, ease: outExpo });

  let y = quoteY + quoteH + gB;

  // --- Author (optional) ---
  if (hasAuthor) {
    const authorText = makeText(fonts, { text: author, role: "body", weight: 500, size: authorSize, color: muted, anchor: { x: anchorX, y: 0 }, align: anchorX === 0 ? "left" : "center" });
    authorText.position.set(colCx, y);
    authorText.alpha = 0;
    root.addChild(authorText);
    timeline
      .to(authorText, { prop: "alpha", from: 0, to: 1, start: 1.9, duration: 0.45, ease: outQuad })
      .to(authorText, { prop: "y", from: y + 12, to: y, start: 1.9, duration: 0.5, ease: outQuint });
    y += authorH + gC;
  }

  // --- Product name ---
  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: anchorX, y: 0 }, align: anchorX === 0 ? "left" : "center" });
  nameText.position.set(colCx, y);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 2.2, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: y + 14, to: y, start: 2.2, duration: 0.55, ease: outExpo });
  y += nameH;

  // --- CTA pill (optional) ---
  if (hasCta) {
    y += gD;
    const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
    const ctaW = ctaLabel.width + ctaSize * 1.7;
    const ctaNode = new Container();
    ctaNode.addChild(new Graphics().roundRect(-ctaW / 2, -ctaH / 2, ctaW, ctaH, ctaH / 2).fill(accent));
    ctaNode.addChild(ctaLabel);
    const ctaCx = anchorX === 0 ? colCx + ctaW / 2 : colCx;
    ctaNode.position.set(ctaCx, y + ctaH / 2);
    ctaNode.scale.set(0);
    root.addChild(ctaNode);
    timeline
      .to(ctaNode, { prop: "scale.x", from: 0, to: 1, start: 2.7, duration: 0.55, ease: spring(0.45) })
      .to(ctaNode, { prop: "scale.y", from: 0, to: 1, start: 2.7, duration: 0.55, ease: spring(0.45) });
  }

  return { timeline, duration: 4.2 };
}

export const productReview: TemplateDefinition = {
  id: "product-review",
  name: "Product Review",
  tagline: "A product beside a five-star customer review.",
  category: "product",
  aspects: ["4:5", "1:1", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Fills the card; a clean product photo works best." },
    { key: "name", type: "text", label: "Name", default: "Aero Bottle", maxLength: 26, shrinkToFit: true },
    { key: "rating", type: "slider", label: "Rating", default: 5, min: 1, max: 5, step: 1 },
    { key: "quote", type: "textarea", label: "Quote", default: "Best purchase I've made all year — worth every penny.", maxLength: 120, shrinkToFit: true },
    { key: "author", type: "text", label: "Author", default: "— Verified buyer", maxLength: 28, optional: true },
    { key: "cta", type: "text", label: "Button", default: "Shop now", maxLength: 18, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

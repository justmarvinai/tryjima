import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
  spring,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F", onAccent: "#FFFFFF", muted: "#6B6B60" } },
  { id: "violet-cream", name: "Violet cream", colors: { background: "#F2EEFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", muted: "#6A5E85" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", muted: "#5A6A82" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", muted: "#8A93A0" } },
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
  return maxWidth > 0 && w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

/** A magnifier loupe: a real 2.1× crop of the product under the lens, or a zoomed detail motif. */
function makeLoupe(
  tex: Texture | null,
  px: number,
  py: number,
  cover: number,
  r: number,
  accent: string,
  cardColor: string,
  onAccent: string,
): Container {
  const c = new Container();
  const Z = 2.1;
  c.addChild(new Graphics().circle(0, 0, r).fill(cardColor));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(cover * Z);
    s.position.set(Z * px, Z * py);
    const mask = new Graphics().circle(0, 0, r * 0.94).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    c.addChild(new Graphics().circle(0, 0, r * 0.5).fill({ color: accent, alpha: 0.18 }));
    c.addChild(new Graphics().circle(0, 0, r * 0.28).fill(accent));
    c.addChild(new Graphics().circle(-r * 0.12, -r * 0.12, r * 0.1).fill({ color: onAccent, alpha: 0.9 }));
  }
  c.addChild(new Graphics().circle(-r * 0.34, -r * 0.34, r * 0.2).fill({ color: "#FFFFFF", alpha: 0.32 }));
  c.addChild(new Graphics().circle(0, 0, r).stroke({ color: accent, width: Math.max(3, r * 0.12) }));
  return c;
}

/** A thin accent leader that draws from (fx,fy) toward (tx,ty). */
function makeLeader(fx: number, fy: number, tx: number, ty: number, th: number, color: string): Graphics {
  const dx = tx - fx;
  const dy = ty - fy;
  const len = Math.max(1, Math.hypot(dx, dy));
  const g = new Graphics().roundRect(0, -th / 2, len, th, th / 2).fill(color);
  g.position.set(fx, fy);
  g.rotation = Math.atan2(dy, dx);
  g.pivot.set(0, 0);
  g.scale.set(0, 1);
  return g;
}

/** Product card: shadow + rounded bg + cover-fit masked image or designed placeholder. */
function buildCard(w: number, h: number, r: number, tex: Texture | null, cardColor: string, accent: string): Container {
  const c = new Container();
  const shadow = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill({ color: 0x000000, alpha: 0.12 });
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
    c.addChild(new Graphics().circle(0, 0, m * 0.28).fill({ color: accent, alpha: 0.2 }));
    const bw = m * 0.34;
    const bh = m * 0.52;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
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

  const name = str(values.name, "Aero Bottle");
  const detail = str(values.detail, "Leak-proof cap");
  const price = str(values.price, "$29");
  const cta = str(values.cta, "Buy now");
  const showConnector = values.connector !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const margin = Math.round(minDim * 0.06);
  const tex = images.product ?? null;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));
  const timeline = new JimaTimeline();
  const horizontal = ctx.aspect === "16:9";

  // Resolved anchors shared by both branches.
  let cardCx: number;
  let cardCy: number;
  let cardW: number;
  let cardH: number;
  let lensX: number;
  let lensY: number;
  let lensR: number;
  let detailCx: number;
  let detailCy: number;
  let nameCx: number;
  let nameTopY: number;
  let nameAnchorX: 0 | 0.5;
  let nameMaxW: number;
  let ctaCx: number;
  let ctaCy: number;

  const detailSize = Math.round(minDim * (horizontal ? 0.026 : 0.04));
  const priceSize = Math.round(minDim * (horizontal ? 0.032 : 0.05));
  const ctaSize = Math.round(minDim * (horizontal ? 0.028 : 0.042));
  const nameSize0 = Math.round(W * (horizontal ? 0.052 : ctx.aspect === "9:16" ? 0.078 : 0.072));
  const detailH = detailSize * 1.85;
  const ctaH = ctaSize * 2.05;
  const priceH = priceSize * 1.5;

  if (horizontal) {
    cardW = W * 0.34;
    cardH = H * 0.72;
    cardCx = margin + cardW / 2 + W * 0.02;
    cardCy = H / 2;
    const colLeft = cardCx + cardW / 2 + W * 0.07;
    const colRight = W - margin;
    const colW = colRight - colLeft;
    nameMaxW = colW;
    nameAnchorX = 0;
    nameCx = colLeft;
    const { size: nS, lines } = wrapAndFit(fonts, name, "display", 700, nameSize0, nameMaxW, 2);
    const nameBlockH = lines.length * Math.round(nS * 1.06);
    // Price rides on the card corner (both layouts), so the column stacks
    // detail pill → name → CTA only.
    const gapA = minDim * 0.05;
    const gapC = minDim * 0.06;
    const total = detailH + gapA + nameBlockH + gapC + ctaH;
    const blockTop = H / 2 - total / 2;
    detailCx = colLeft; // left-anchored pill; centered onto pillCx below
    detailCy = blockTop + detailH / 2;
    nameTopY = blockTop + detailH + gapA;
    ctaCx = colLeft;
    ctaCy = nameTopY + nameBlockH + gapC + ctaH / 2;
    lensX = cardCx + cardW * 0.16;
    lensY = cardCy - cardH * 0.2;
    lensR = Math.min(cardW, cardH) * 0.2;
  } else {
    const top = ctx.aspect === "9:16" ? 220 : margin;
    const bottom = ctx.aspect === "9:16" ? H - 400 : H - margin;
    cardW = W * (ctx.aspect === "9:16" ? 0.7 : 0.6);
    cardH = cardW * 0.82;
    nameMaxW = W - margin * 2;
    nameAnchorX = 0.5;
    nameCx = W / 2;
    const { size: nS, lines } = wrapAndFit(fonts, name, "display", 700, nameSize0, nameMaxW, 2);
    const nameBlockH = lines.length * Math.round(nS * 1.06);
    const gapA = minDim * 0.05;
    const gapB = minDim * 0.045;
    const gapC = minDim * 0.04;
    const total = detailH + gapA + cardH + gapB + nameBlockH + gapC + ctaH;
    const startY = Math.max(top, top + (bottom - top - total) / 2);
    detailCx = W / 2;
    detailCy = startY + detailH / 2;
    cardCx = W / 2;
    cardCy = startY + detailH + gapA + cardH / 2;
    nameTopY = cardCy + cardH / 2 + gapB;
    ctaCx = W / 2;
    ctaCy = nameTopY + nameBlockH + gapC + ctaH / 2;
    lensX = cardCx + cardW * 0.2;
    lensY = cardCy - cardH * 0.16;
    lensR = Math.min(cardW, cardH) * 0.19;
  }

  const cardR = Math.min(cardW, cardH) * 0.09;
  const cover = tex ? Math.max(cardW / tex.width, cardH / tex.height) : 0;

  // --- Product card ---
  const card = buildCard(cardW, cardH, cardR, tex, cardColor, accent);
  card.position.set(cardCx, cardCy);
  card.scale.set(0.9);
  card.alpha = 0;
  root.addChild(card);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.9, to: 1, start: 0.15, duration: 0.7, ease: spring(0.55) })
    .to(card, { prop: "scale.y", from: 0.9, to: 1, start: 0.15, duration: 0.7, ease: spring(0.55) });

  // --- Price chip pinned to the card corner ---
  if (price.length > 0) {
    const priceW = fonts.measure(price, { family: fonts.family("display"), weight: 700, size: priceSize }) + priceSize * 1.1;
    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-priceW / 2, -priceH / 2, priceW, priceH, priceH / 2).fill(textColor));
    chip.addChild(makeText(fonts, { text: price, role: "display", weight: 700, size: priceSize, color: bg, anchor: 0.5 }));
    const pad = minDim * 0.03;
    chip.position.set(cardCx + cardW / 2 - priceW / 2 - pad, cardCy + cardH / 2 - priceH / 2 - pad);
    chip.scale.set(0);
    chip.rotation = -6 * (Math.PI / 180);
    root.addChild(chip);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: 0.75, duration: 0.5, ease: makeOutBack(1.8) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: 0.75, duration: 0.5, ease: makeOutBack(1.8) })
      .to(chip, { prop: "rotation", from: -6 * (Math.PI / 180), to: 0, start: 0.75, duration: 0.5, ease: makeOutBack(1.8) });
  }

  // --- Leader line (drawn under the loupe + pill) ---
  const leader = showConnector ? makeLeader(detailCx, detailCy, lensX, lensY, Math.max(3, minDim * 0.006), accent) : null;
  if (leader) {
    root.addChild(leader);
    timeline.to(leader, { prop: "scale.x", from: 0, to: 1, start: 1.55, duration: 0.4, ease: outExpo });
  }

  // --- Magnifier loupe ---
  const loupe = makeLoupe(tex, cardCx - lensX, cardCy - lensY, cover, lensR, accent, cardColor, onAccent);
  loupe.position.set(lensX, lensY);
  loupe.scale.set(0);
  root.addChild(loupe);
  timeline
    .to(loupe, { prop: "scale.x", from: 0, to: 1, start: 1.0, duration: 0.7, ease: spring(0.5) })
    .to(loupe, { prop: "scale.y", from: 0, to: 1, start: 1.0, duration: 0.7, ease: spring(0.5) })
    // gentle idle drift over the product
    .to(loupe, { prop: "y", from: lensY, to: lensY - minDim * 0.012, start: 2.7, duration: 0.75, ease: outQuad })
    .to(loupe, { prop: "y", from: lensY - minDim * 0.012, to: lensY, start: 3.45, duration: 0.75, ease: outQuad });

  // --- Detail callout pill ---
  const detailFit = fitSize(fonts, detail, "body", 600, detailSize, nameMaxW - detailSize * 2.4);
  const detailTextW = fonts.measure(detail, { family: fonts.family("body"), weight: 600, size: detailFit });
  const dotR = detailFit * 0.28;
  const pillW = detailTextW + dotR * 2 + detailFit * 1.7;
  const pill = new Container();
  pill.addChild(new Graphics().roundRect(-pillW / 2, -detailH / 2, pillW, detailH, detailH / 2).fill(cardColor));
  pill.addChild(new Graphics().roundRect(-pillW / 2, -detailH / 2, pillW, detailH, detailH / 2).stroke({ color: accent, width: Math.max(2, detailFit * 0.09) }));
  pill.addChild(new Graphics().circle(-pillW / 2 + detailFit * 0.75 + dotR, 0, dotR).fill(accent));
  const dLabel = makeText(fonts, { text: detail, role: "body", weight: 600, size: detailFit, color: textColor, anchor: { x: 0, y: 0.5 } });
  dLabel.position.set(-pillW / 2 + detailFit * 0.75 + dotR * 2 + detailFit * 0.4, 0);
  pill.addChild(dLabel);
  const pillCx = horizontal ? detailCx + pillW / 2 : detailCx;
  pill.position.set(pillCx, detailCy);
  pill.alpha = 0;
  root.addChild(pill);
  // Re-point the leader at the actual pill center now that its width is known.
  if (leader) {
    leader.position.set(pillCx, detailCy);
    leader.rotation = Math.atan2(lensY - detailCy, lensX - pillCx);
  }
  timeline
    .to(pill, { prop: "alpha", from: 0, to: 1, start: 1.85, duration: 0.4, ease: outQuad })
    .to(pill, { prop: "scale.x", from: 0.9, to: 1, start: 1.85, duration: 0.5, ease: makeOutBack(1.6) })
    .to(pill, { prop: "scale.y", from: 0.9, to: 1, start: 1.85, duration: 0.5, ease: makeOutBack(1.6) });

  // --- Name ---
  const { lines: nameLines, size: nameSize } = wrapAndFit(fonts, name, "display", 700, nameSize0, nameMaxW, 2);
  const nameLH = Math.round(nameSize * 1.06);
  const nameText = makeText(fonts, { text: nameLines.join("\n"), role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: nameAnchorX, y: 0 }, lineHeight: nameLH, align: nameAnchorX === 0 ? "left" : "center" });
  nameText.position.set(nameCx, nameTopY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 2.2, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameTopY + 16, to: nameTopY, start: 2.2, duration: 0.55, ease: outQuint });

  // --- CTA pill ("Buy now") ---
  if (cta.length > 0) {
    const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
    const ctaW = ctaLabel.width + ctaSize * 1.8;
    const ctaNode = new Container();
    ctaNode.addChild(new Graphics().roundRect(-ctaW / 2, -ctaH / 2, ctaW, ctaH, ctaH / 2).fill(accent));
    ctaNode.addChild(ctaLabel);
    const cx2 = horizontal ? ctaCx + ctaW / 2 : ctaCx;
    ctaNode.position.set(cx2, ctaCy);
    ctaNode.scale.set(0);
    root.addChild(ctaNode);
    timeline
      .to(ctaNode, { prop: "scale.x", from: 0, to: 1, start: 2.6, duration: 0.55, ease: spring(0.45) })
      .to(ctaNode, { prop: "scale.y", from: 0, to: 1, start: 2.6, duration: 0.55, ease: spring(0.45) })
      .to(ctaNode, { prop: "scale.x", from: 1, to: 1.04, start: 3.4, duration: 0.4, ease: outQuad })
      .to(ctaNode, { prop: "scale.x", from: 1.04, to: 1, start: 3.8, duration: 0.2, ease: outQuad });
  }

  return { timeline, duration: 4.0 };
}

export const productDetail: TemplateDefinition = {
  id: "product-detail",
  name: "Product Detail",
  tagline: "A magnifier zooms a product detail, then the price and CTA land.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Fills the card; a clean product photo works best." },
    { key: "name", type: "text", label: "Name", default: "Aero Bottle", maxLength: 28, shrinkToFit: true },
    { key: "detail", type: "text", label: "Detail", default: "Leak-proof cap", maxLength: 32 },
    { key: "price", type: "text", label: "Price", default: "$29", maxLength: 12, optional: true },
    { key: "cta", type: "text", label: "Button", default: "Buy now", maxLength: 18 },
    { key: "connector", type: "toggle", label: "Connector line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

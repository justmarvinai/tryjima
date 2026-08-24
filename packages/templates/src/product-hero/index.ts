import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  spring,
  type Aspect,
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
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", muted: "#6A5E85" } },
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

/** A rounded product card: shadow + card bg + cover-fit image (masked) or a designed placeholder. */
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
    c.addChild(new Graphics().circle(0, 0, minDim * 0.29).fill({ color: accent, alpha: 0.2 }));
    const bw = minDim * 0.34;
    const bh = minDim * 0.5;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
  return c;
}

interface HeroLayout {
  horizontal: boolean;
  cardW: number;
  cardH: number;
  cardR: number;
  cardCx: number;
  cardCy: number;
  textCx: number;
  textLeft: number;
  textW: number;
  anchorX: number;
  blockCenterY: number;
  nameSize: number;
}

function heroLayout(aspect: Aspect, w: number, h: number): HeroLayout {
  const margin = Math.round(Math.min(w, h) * 0.06);
  const horizontal = aspect === "16:9" || aspect === "1:1";
  if (horizontal) {
    const cardW = aspect === "16:9" ? w * 0.4 : w * 0.44;
    const cardH = aspect === "16:9" ? h * 0.76 : h * 0.66;
    const cardCx = margin + cardW / 2;
    const textLeft = cardCx + cardW / 2 + w * 0.06;
    return {
      horizontal: true,
      cardW,
      cardH,
      cardR: Math.min(cardW, cardH) * 0.08,
      cardCx,
      cardCy: h / 2,
      textCx: textLeft,
      textLeft,
      textW: w - margin - textLeft,
      anchorX: 0,
      blockCenterY: h / 2,
      nameSize: Math.round(w * (aspect === "16:9" ? 0.058 : 0.072)),
    };
  }
  // Vertical stack (4:5, 9:16): image on top, text below.
  const top = aspect === "9:16" ? 236 : margin * 1.1;
  const cardW = aspect === "9:16" ? w * 0.72 : w * 0.7;
  const cardH = aspect === "9:16" ? w * 0.64 : w * 0.6;
  const cardCy = top + cardH / 2;
  return {
    horizontal: false,
    cardW,
    cardH,
    cardR: Math.min(cardW, cardH) * 0.08,
    cardCx: w / 2,
    cardCy,
    textCx: w / 2,
    textLeft: margin,
    textW: w - margin * 2,
    anchorX: 0.5,
    blockCenterY: 0, // unused in vertical (block flows below the card)
    nameSize: Math.round(w * (aspect === "9:16" ? 0.086 : 0.082)),
  };
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

  const kicker = str(values.kicker, "NEW").toUpperCase();
  const name = str(values.name, "Aero Bottle");
  const tagline = str(values.tagline, "Stays cold for 24 hours");
  const cta = str(values.cta, "Shop now");

  const W = size.width;
  const H = size.height;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));
  const timeline = new JimaTimeline();
  const L = heroLayout(ctx.aspect, W, H);

  // --- Product card ---
  const tex = images.product ?? null;
  const card = productCard(L.cardW, L.cardH, L.cardR, tex, cardColor, accent);
  card.position.set(L.cardCx, L.cardCy);
  card.scale.set(0.82);
  card.alpha = 0;
  root.addChild(card);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.35, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.82, to: 1, start: 0.2, duration: 0.8, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.82, to: 1, start: 0.2, duration: 0.8, ease: spring(0.5) })
    // gentle idle float
    .to(card, { prop: "y", from: L.cardCy, to: L.cardCy - H * 0.008, start: 2.6, duration: 0.7, ease: outQuad })
    .to(card, { prop: "y", from: L.cardCy - H * 0.008, to: L.cardCy, start: 3.3, duration: 0.7, ease: outQuad });

  // --- Text block ---
  const kickerSize = Math.round(L.nameSize * 0.3);
  const ctaSize = Math.round(L.nameSize * 0.36);
  const { lines: nameLines, size: nameSize } = wrapAndFit(fonts, name, "display", 700, L.nameSize, L.textW, 2);
  const nameLH = Math.round(nameSize * 1.06);
  const nameBlockH = nameLines.length * nameLH;
  const { lines: taglineLines, size: taglineSize } = wrapAndFit(fonts, tagline, "body", 500, Math.round(L.nameSize * 0.38), L.textW, 2);
  const taglineLH = Math.round(taglineSize * 1.24);
  const taglineBlockH = taglineLines.length * taglineLH;

  const gap1 = L.nameSize * 0.42;
  const gap2 = L.nameSize * 0.4;
  const gap3 = L.nameSize * 0.55;
  const kickerH = kickerSize * 1.1;
  const ctaH = ctaSize * 2.0;
  const totalTextH = kickerH + gap1 + nameBlockH + gap2 + taglineBlockH + gap3 + ctaH;

  const blockTop = L.horizontal
    ? L.blockCenterY - totalTextH / 2
    : L.cardCy + L.cardH / 2 + Math.min(W, H) * 0.06;

  const elemX = L.anchorX === 0 ? L.textLeft : L.textCx;

  // Kicker (accent caps).
  let y = blockTop;
  const kick = makeText(fonts, { text: kicker, role: "body", weight: 600, size: kickerSize, color: accent, anchor: { x: L.anchorX, y: 0 }, letterSpacing: 3, align: L.anchorX === 0 ? "left" : "center" });
  kick.position.set(elemX, y);
  kick.alpha = 0;
  root.addChild(kick);
  timeline
    .to(kick, { prop: "alpha", from: 0, to: 1, start: 0.9, duration: 0.4, ease: outQuad })
    .to(kick, { prop: "y", from: y + 14, to: y, start: 0.9, duration: 0.5, ease: outExpo });

  // Name.
  y += kickerH + gap1;
  const nameText = makeText(fonts, { text: nameLines.join("\n"), role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: L.anchorX, y: 0 }, lineHeight: nameLH, align: L.anchorX === 0 ? "left" : "center" });
  nameText.position.set(elemX, y);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 1.1, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: y + 18, to: y, start: 1.1, duration: 0.6, ease: outExpo });

  // Tagline.
  y += nameBlockH + gap2;
  const taglineText = makeText(fonts, { text: taglineLines.join("\n"), role: "body", weight: 500, size: taglineSize, color: muted, anchor: { x: L.anchorX, y: 0 }, lineHeight: taglineLH, align: L.anchorX === 0 ? "left" : "center" });
  taglineText.position.set(elemX, y);
  taglineText.alpha = 0;
  root.addChild(taglineText);
  timeline
    .to(taglineText, { prop: "alpha", from: 0, to: 1, start: 1.35, duration: 0.45, ease: outQuad })
    .to(taglineText, { prop: "y", from: y + 12, to: y, start: 1.35, duration: 0.5, ease: outQuint });

  // CTA pill.
  if (cta.length > 0) {
    y += taglineBlockH + gap3;
    const ctaC = new Container();
    const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
    const pillW = ctaLabel.width + ctaSize * 1.5;
    const pillH = ctaH;
    ctaC.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(accent));
    ctaC.addChild(ctaLabel);
    const ctaCx = L.anchorX === 0 ? L.textLeft + pillW / 2 : L.textCx;
    ctaC.position.set(ctaCx, y + pillH / 2);
    ctaC.scale.set(0);
    root.addChild(ctaC);
    timeline
      .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: 1.7, duration: 0.6, ease: spring(0.45) })
      .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: 1.7, duration: 0.6, ease: spring(0.45) })
      .to(ctaC, { prop: "scale.x", from: 1, to: 1.04, start: 2.9, duration: 0.45, ease: outQuad })
      .to(ctaC, { prop: "scale.x", from: 1.04, to: 1, start: 3.35, duration: 0.45, ease: outQuad });
  }

  return { timeline, duration: 4.0 };
}

export const productHero: TemplateDefinition = {
  id: "product-hero",
  name: "Product Hero",
  tagline: "A product card springs in beside a bold name and CTA.",
  category: "product",
  aspects: ["16:9", "1:1", "4:5", "9:16"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "product", type: "image", label: "Product image", default: "", optional: true, help: "Fills the card; a transparent PNG or a clean product photo works best." },
    { key: "kicker", type: "text", label: "Kicker", default: "NEW", maxLength: 18, optional: true },
    { key: "name", type: "text", label: "Name", default: "Aero Bottle", maxLength: 28, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "Stays cold for 24 hours", maxLength: 48 },
    { key: "cta", type: "text", label: "Button", default: "Shop now", maxLength: 20 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

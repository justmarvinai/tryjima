import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outBack,
  spring,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one crisp line. */
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
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

/** Split a phrase across (at most) two balanced lines for a round seal. */
function twoLines(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [text];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
}

// A "Limited Edition" foil seal thuds onto a product card, with an edition
// ribbon. The card carries its own palette key so it survives alpha export.
const PALETTES: Palette[] = [
  { id: "noir-gold", name: "Noir gold", colors: { background: "#14120C", cardBg: "#211D14", accent: "#D9A441", textColor: "#F7EEDD", onAccent: "#1A1509" } },
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardBg: "#FFFFFF", accent: "#B4472A", textColor: "#181410", onAccent: "#FFFFFF" } },
  { id: "royal", name: "Royal", colors: { background: "#ECEEF9", cardBg: "#FFFFFF", accent: "#3B3E8C", textColor: "#12122E", onAccent: "#FFFFFF" } },
  { id: "emerald", name: "Emerald", colors: { background: "#E9F4EE", cardBg: "#FFFFFF", accent: "#0E7A54", textColor: "#0A1F16", onAccent: "#FFFFFF" } },
];

/** Product card: shadow + rounded bg + cover-fit masked image or a designed placeholder. */
function productCard(w: number, h: number, r: number, tex: Texture | null, cardColor: string, accent: string): Container {
  const c = new Container();
  const shadow = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill({ color: 0x000000, alpha: 0.18 });
  shadow.position.set(0, h * 0.035);
  c.addChild(shadow);
  c.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(cardColor));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.max(w / tex.width, h / tex.height));
    const mask = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    const m = Math.min(w, h);
    c.addChild(new Graphics().circle(0, 0, m * 0.42).fill({ color: accent, alpha: 0.1 }));
    const bw = m * 0.32;
    const bh = m * 0.52;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.22).fill({ color: accent, alpha: 0.5 }));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.22).fill({ color: 0xffffff, alpha: 0.14 }));
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#14120C"));
  const cardBg = pc("cardBg", "#211D14");
  const accent = str(values.accent, pc("accent", "#D9A441"));
  const textColor = str(values.textColor, pc("textColor", "#F7EEDD"));
  const onAccent = pc("onAccent", "#1A1509");

  const product = str(values.product, "Aero Bottle");
  const seal = str(values.seal, "Limited Edition");
  const edition = str(values.edition, "1 of 500");
  const showRibbon = values.showRibbon !== false && edition.length > 0;
  const showBurst = values.showBurst !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Metrics + centered stack (card + product name) ---
  const cardW = Math.min(minDim * 0.54, zone.width * 0.92);
  const cardH = cardW * 1.12;
  const nameSize0 = Math.round(minDim * 0.044);
  const nameSize = fitSize(fonts, product, "display", 700, nameSize0, zone.width * 0.9);
  const nameH = nameSize * 1.2;
  const gapCard = minDim * 0.055;

  const stackH = cardH + gapCard + nameH;
  const top = zone.y + (zone.height - stackH) / 2;
  const cardCy = top + cardH / 2;
  const nameCy = cardCy + cardH / 2 + gapCard + nameH / 2;

  // --- Product card ---
  const card = productCard(cardW, cardH, minDim * 0.045, images.image ?? null, cardBg, accent);
  card.position.set(cx, cardCy);
  card.alpha = 0;
  card.scale.set(0.9);
  root.addChild(card);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.12, duration: 0.35, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.9, to: 1, start: 0.12, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.9, to: 1, start: 0.12, duration: 0.7, ease: spring(0.5) });

  // --- Foil seal (thuds down onto the card) ---
  const sealCy = cardCy - cardH * 0.08;
  const R = cardW * 0.3;

  if (showBurst) {
    const ring = new Graphics().circle(0, 0, R).stroke({ color: accent, width: Math.max(3, minDim * 0.01) });
    ring.position.set(cx, sealCy);
    ring.alpha = 0;
    ring.scale.set(0.7);
    root.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 0.8, start: 0.72, duration: 0.1, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0.8, to: 0, start: 0.82, duration: 0.55, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.7, to: 1.7, start: 0.72, duration: 0.6, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.7, to: 1.7, start: 0.72, duration: 0.6, ease: outExpo });
  }

  const sealNode = new Container();
  sealNode.position.set(cx, sealCy);
  sealNode.addChild(new Graphics().star(0, 0, 18, R, R * 0.84).fill(accent));
  sealNode.addChild(new Graphics().circle(0, 0, R * 0.8).fill(accent));
  sealNode.addChild(new Graphics().circle(0, 0, R * 0.72).stroke({ color: onAccent, width: Math.max(2, R * 0.03), alpha: 0.85 }));
  const topStar = makeIcon("star", R * 0.26, { color: onAccent });
  topStar.position.set(0, -R * 0.44);
  sealNode.addChild(topStar);

  const sealLines = twoLines(seal.toUpperCase());
  const sealSize0 = Math.round(R * (sealLines.length > 1 ? 0.26 : 0.3));
  const sealSize = fitSize(fonts, sealLines.reduce((a, b) => (a.length > b.length ? a : b), ""), "display", 700, sealSize0, R * 1.3);
  const sealLH = sealSize * 1.05;
  const sealText = makeText(fonts, { text: sealLines.join("\n"), role: "display", weight: 700, size: sealSize, color: onAccent, anchor: 0.5, align: "center", lineHeight: sealLH, letterSpacing: 1 });
  sealText.position.set(0, R * 0.04);
  sealNode.addChild(sealText);

  sealNode.alpha = 0;
  sealNode.scale.set(1.7);
  sealNode.rotation = -28 * DEG;
  root.addChild(sealNode);
  timeline
    .to(sealNode, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.18, ease: outQuad })
    .to(sealNode, { prop: "scale.x", from: 1.7, to: 1, start: 0.55, duration: 0.55, ease: spring(0.5) })
    .to(sealNode, { prop: "scale.y", from: 1.7, to: 1, start: 0.55, duration: 0.55, ease: spring(0.5) })
    .to(sealNode, { prop: "rotation", from: -28 * DEG, to: 0, start: 0.55, duration: 0.6, ease: outBack });

  // --- Edition ribbon (unrolls across the lower card) ---
  if (showRibbon) {
    const ribCy = cardCy + cardH * 0.3;
    const edSize = Math.round(minDim * 0.032);
    const edLabel = makeText(fonts, { text: edition, role: "display", weight: 700, size: edSize, color: cardBg, anchor: 0.5, letterSpacing: 1 });
    const rh = edSize * 1.9;
    const tail = rh * 0.5;
    const rw = Math.min(cardW * 0.86, edLabel.width + rh * 1.6);
    const ribbon = new Container();
    ribbon.position.set(cx, ribCy);
    ribbon.addChild(
      new Graphics()
        .poly([-rw / 2 - tail, 0, -rw / 2, -rh / 2, rw / 2, -rh / 2, rw / 2 + tail, 0, rw / 2, rh / 2, -rw / 2, rh / 2])
        .fill(textColor),
    );
    ribbon.addChild(edLabel);
    ribbon.alpha = 0;
    ribbon.scale.set(0.2, 1);
    root.addChild(ribbon);
    timeline
      .to(ribbon, { prop: "alpha", from: 0, to: 1, start: 1.25, duration: 0.25, ease: outQuad })
      .to(ribbon, { prop: "scale.x", from: 0.2, to: 1, start: 1.25, duration: 0.55, ease: makeOutBack(1.7) });
  }

  // --- Product name ---
  const nameText = makeText(fonts, { text: product, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameCy);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 1.55, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameCy + minDim * 0.02, to: nameCy, start: 1.55, duration: 0.55, ease: outExpo });

  return { timeline, duration: 4.2 };
}

export const limitedEdition: TemplateDefinition = {
  id: "limited-edition",
  name: "Limited Edition",
  tagline: "A foil seal thuds onto a product card with an edition ribbon.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { product: "display", seal: "display" },
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Product image", default: "", optional: true, help: "Fills the card; a clean product photo works best." },
    { key: "product", type: "text", label: "Product", default: "Aero Bottle", maxLength: 26, shrinkToFit: true },
    { key: "seal", type: "text", label: "Seal text", default: "Limited Edition", maxLength: 22, shrinkToFit: true },
    { key: "edition", type: "text", label: "Edition", default: "1 of 500", maxLength: 16, optional: true },
    { key: "showRibbon", type: "toggle", label: "Edition ribbon", default: true },
    { key: "showBurst", type: "toggle", label: "Impact ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

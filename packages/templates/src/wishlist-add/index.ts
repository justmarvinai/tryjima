import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
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

// A heart button pops over a product card — "Added to wishlist" — with a beat
// and floating hearts. The card carries its own palette key for alpha export.
const PALETTES: Palette[] = [
  { id: "blush", name: "Blush", colors: { background: "#FCEDF3", cardBg: "#FFFFFF", accent: "#E23768", textColor: "#2A0A18", onAccent: "#FFFFFF" } },
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardBg: "#FFFFFF", accent: "#C2380F", textColor: "#14140F", onAccent: "#FFFFFF" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardBg: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", cardBg: "#1C1C22", accent: "#FF3D77", textColor: "#FFFFFF", onAccent: "#FFFFFF" } },
];

/** Product card: shadow + rounded bg + cover-fit masked image or a designed placeholder. */
function productCard(w: number, h: number, r: number, tex: Texture | null, cardColor: string, accent: string): Container {
  const c = new Container();
  const shadow = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill({ color: 0x000000, alpha: 0.14 });
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
    c.addChild(new Graphics().circle(0, 0, m * 0.4).fill({ color: accent, alpha: 0.12 }));
    c.addChild(new Graphics().circle(0, 0, m * 0.28).fill({ color: accent, alpha: 0.2 }));
    const bw = m * 0.34;
    const bh = m * 0.5;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FCEDF3"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#E23768"));
  const textColor = str(values.textColor, pc("textColor", "#2A0A18"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const product = str(values.product, "Aero Bottle");
  const label = str(values.label, "Added to wishlist");
  const hasLabel = label.length > 0;
  const showHearts = values.showHearts !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Metrics + centered stack (card + label + name) ---
  const cardW = Math.min(minDim * 0.5, zone.width * 0.9);
  const cardH = cardW * 1.08;
  const labelSize0 = Math.round(minDim * 0.046);
  const nameSize0 = Math.round(minDim * 0.036);
  const labelSize = fitSize(fonts, label, "display", 700, labelSize0, zone.width * 0.9);
  const nameSize = fitSize(fonts, product, "body", 600, nameSize0, zone.width * 0.9);
  const labelH = hasLabel ? labelSize * 1.18 : 0;
  const nameH = nameSize * 1.2;
  const gapCard = minDim * 0.06;
  const gapLabel = minDim * 0.018;

  const stackH = cardH + gapCard + labelH + gapLabel + nameH;
  const top = zone.y + (zone.height - stackH) / 2;
  const cardCy = top + cardH / 2;
  const labelCy = cardCy + cardH / 2 + gapCard + labelH / 2;
  const nameCy = labelCy + labelH / 2 + gapLabel + nameH / 2;

  // --- Product card ---
  const card = productCard(cardW, cardH, minDim * 0.045, images.image ?? null, cardBg, accent);
  card.position.set(cx, cardCy);
  card.alpha = 0;
  card.scale.set(0.88);
  root.addChild(card);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.12, duration: 0.35, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.88, to: 1, start: 0.12, duration: 0.75, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.88, to: 1, start: 0.12, duration: 0.75, ease: spring(0.5) });

  // --- Heart badge in the card's top-right corner ---
  const badgeR = cardW * 0.16;
  const badgeX = cx + cardW / 2 - badgeR * 0.85;
  const badgeY = cardCy - cardH / 2 + badgeR * 0.85;

  // Burst ring behind the badge.
  const ring = new Graphics().circle(0, 0, badgeR * 1.05).stroke({ color: accent, width: Math.max(3, minDim * 0.009) });
  ring.position.set(badgeX, badgeY);
  ring.alpha = 0;
  ring.scale.set(0.6);
  root.addChild(ring);
  timeline
    .to(ring, { prop: "alpha", from: 0, to: 0.75, start: 0.62, duration: 0.1, ease: outQuad })
    .to(ring, { prop: "alpha", from: 0.75, to: 0, start: 0.72, duration: 0.55, ease: outQuad })
    .to(ring, { prop: "scale.x", from: 0.6, to: 1.9, start: 0.62, duration: 0.65, ease: outExpo })
    .to(ring, { prop: "scale.y", from: 0.6, to: 1.9, start: 0.62, duration: 0.65, ease: outExpo });

  const badge = new Container();
  badge.position.set(badgeX, badgeY);
  badge.addChild(new Graphics().circle(0, 0, badgeR).fill({ color: 0x000000, alpha: 0.12 }).circle(0, badgeR * 0.05, badgeR).fill(onAccent));
  badge.addChild(makeIcon("heart", badgeR * 1.1, { color: accent }));
  badge.scale.set(0);
  root.addChild(badge);
  timeline
    .to(badge, { prop: "scale.x", from: 0, to: 1, start: 0.5, duration: 0.55, ease: spring(0.4) })
    .to(badge, { prop: "scale.y", from: 0, to: 1, start: 0.5, duration: 0.55, ease: spring(0.4) })
    // double heart beat
    .to(badge, { prop: "scale.x", from: 1, to: 1.18, start: 1.15, duration: 0.14, ease: outQuad })
    .to(badge, { prop: "scale.x", from: 1.18, to: 1, start: 1.29, duration: 0.2, ease: outQuad })
    .to(badge, { prop: "scale.y", from: 1, to: 1.18, start: 1.15, duration: 0.14, ease: outQuad })
    .to(badge, { prop: "scale.y", from: 1.18, to: 1, start: 1.29, duration: 0.2, ease: outQuad });

  // --- Floating hearts rising from the badge ---
  if (showHearts) {
    for (let i = 0; i < 6; i++) {
      const hs = minDim * rng.range(0.028, 0.05);
      const heart = makeIcon("heart", hs, { color: accent });
      heart.position.set(badgeX, badgeY);
      heart.alpha = 0;
      root.addChild(heart);
      const start = 0.75 + i * 0.11;
      const driftX = badgeX + minDim * rng.range(-0.07, 0.07);
      const rise = minDim * rng.range(0.16, 0.28);
      timeline
        .to(heart, { prop: "alpha", from: 0, to: 0.9, start, duration: 0.18, ease: outQuad })
        .to(heart, { prop: "alpha", from: 0.9, to: 0, start: start + 0.4, duration: 0.5, ease: outQuad })
        .to(heart, { prop: "y", from: badgeY, to: badgeY - rise, start, duration: 0.9, ease: outQuad })
        .to(heart, { prop: "x", from: badgeX, to: driftX, start, duration: 0.9, ease: outQuad })
        .to(heart, { prop: "scale.x", from: 0.4, to: 1, start, duration: 0.5, ease: makeOutBack(2) })
        .to(heart, { prop: "scale.y", from: 0.4, to: 1, start, duration: 0.5, ease: makeOutBack(2) });
    }
  }

  // --- Label ---
  if (hasLabel) {
    const labelText = makeText(fonts, { text: label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: 0.5, align: "center" });
    labelText.position.set(cx, labelCy);
    labelText.alpha = 0;
    root.addChild(labelText);
    timeline
      .to(labelText, { prop: "alpha", from: 0, to: 1, start: 1.35, duration: 0.4, ease: outQuad })
      .to(labelText, { prop: "y", from: labelCy + minDim * 0.02, to: labelCy, start: 1.35, duration: 0.5, ease: outExpo });
  }

  // --- Product name ---
  const nameText = makeText(fonts, { text: product, role: "body", weight: 600, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameCy);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 0.92, start: 1.5, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameCy + minDim * 0.014, to: nameCy, start: 1.5, duration: 0.5, ease: outQuint });

  return { timeline, duration: 4.2 };
}

export const wishlistAdd: TemplateDefinition = {
  id: "wishlist-add",
  name: "Wishlist Add",
  tagline: "A heart button pops over a product card with floating hearts.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { label: "display", product: "body" },
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Product image", default: "", optional: true, help: "Fills the card; a clean product photo works best." },
    { key: "product", type: "text", label: "Product", default: "Aero Bottle", maxLength: 28, shrinkToFit: true },
    { key: "label", type: "text", label: "Label", default: "Added to wishlist", maxLength: 24, optional: true, shrinkToFit: true },
    { key: "showHearts", type: "toggle", label: "Floating hearts", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
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
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

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

// A product card with a rank ribbon and rating stars.
const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardBg: "#FFFFFF", accent: "#C2380F", textColor: "#14140F", onAccent: "#FFFFFF", empty: "#DAD6CC" } },
  { id: "violet-cream", name: "Violet cream", colors: { background: "#F2EEFB", cardBg: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", empty: "#DDD3F0" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardBg: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", empty: "#CFDCEE" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardBg: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", empty: "#333A44" } },
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
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#C2380F"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const emptyColor = pc("empty", "#DAD6CC");

  const product = str(values.product, "Aero Bottle");
  const rank = str(values.rank, "#1 Bestseller");
  const rating = Math.max(1, Math.min(5, Math.round(num(values.rating, 5))));
  const showStars = values.showStars !== false;
  const showRibbon = values.showRibbon !== false && rank.length > 0;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Metrics + centered stack (card + stars + name) ---
  const cardW = Math.min(minDim * 0.52, zone.width * 0.9);
  const cardH = cardW * 1.06;
  const starSize = showStars ? minDim * 0.058 : 0;
  const starGap = starSize * 1.2;
  const starRowH = showStars ? starSize : 0;
  const nameSize0 = Math.round(minDim * 0.05);
  const nameSize = fitSize(fonts, product, "display", 700, nameSize0, zone.width * 0.9);
  const nameH = nameSize * 1.16;
  const gapCard = minDim * 0.05;
  const gapStars = showStars ? minDim * 0.038 : 0;

  const stackH = cardH + (showStars ? gapCard + starRowH : 0) + gapStars + nameH + (showStars ? 0 : gapCard);
  const top = zone.y + (zone.height - stackH) / 2;
  const cardCy = top + cardH / 2;
  const starsCy = cardCy + cardH / 2 + gapCard + starRowH / 2;
  const nameCy = (showStars ? starsCy + starRowH / 2 : cardCy + cardH / 2 + gapCard) + gapStars + nameH / 2;

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

  // --- Rank ribbon (unrolls across the upper card) ---
  if (showRibbon) {
    const ribCy = cardCy - cardH * 0.26;
    const rankSize0 = Math.round(minDim * 0.04);
    const rankSize = fitSize(fonts, rank, "display", 700, rankSize0, cardW * 0.82);
    const rankLabel = makeText(fonts, { text: rank, role: "display", weight: 700, size: rankSize, color: onAccent, anchor: 0.5, letterSpacing: 0.5 });
    const rh = rankSize * 1.9;
    const tail = rh * 0.5;
    const rw = Math.min(cardW * 1.02, rankLabel.width + rh * 1.5);
    const ribbon = new Container();
    ribbon.position.set(cx, ribCy);
    // Fishtail folds behind the ends (a darker tuck).
    ribbon.addChild(new Graphics().poly([-rw / 2, rh / 2, -rw / 2 - tail, rh / 2 + tail * 0.7, -rw / 2, -rh * 0.1]).fill({ color: 0x000000, alpha: 0.22 }));
    ribbon.addChild(new Graphics().poly([rw / 2, rh / 2, rw / 2 + tail, rh / 2 + tail * 0.7, rw / 2, -rh * 0.1]).fill({ color: 0x000000, alpha: 0.22 }));
    ribbon.addChild(
      new Graphics()
        .poly([-rw / 2 - tail, -rh / 2, -rw / 2, 0, -rw / 2 - tail, rh / 2, rw / 2 + tail, rh / 2, rw / 2, 0, rw / 2 + tail, -rh / 2])
        .fill(accent),
    );
    ribbon.addChild(rankLabel);
    ribbon.alpha = 0;
    ribbon.scale.set(0.2, 1);
    root.addChild(ribbon);
    timeline
      .to(ribbon, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.25, ease: outQuad })
      .to(ribbon, { prop: "scale.x", from: 0.2, to: 1, start: 0.55, duration: 0.6, ease: makeOutBack(1.7) });
  }

  // --- Rating stars ---
  if (showStars) {
    const rowW = starGap * 4 + starSize;
    const startX = cx - rowW / 2 + starSize / 2;
    for (let i = 0; i < 5; i++) {
      const holder = new Container();
      holder.addChild(makeIcon("star", starSize, { color: i < rating ? accent : emptyColor }));
      holder.position.set(startX + i * starGap, starsCy);
      holder.scale.set(0);
      root.addChild(holder);
      const start = 0.95 + i * 0.1;
      timeline
        .to(holder, { prop: "scale.x", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(1.9) })
        .to(holder, { prop: "scale.y", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(1.9) });
    }
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

export const bestsellerTag: TemplateDefinition = {
  id: "bestseller-tag",
  name: "Bestseller Tag",
  tagline: "A product card earns a rank ribbon and a row of rating stars.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { product: "display", rank: "display" },
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Product image", default: "", optional: true, help: "Fills the card; a clean product photo works best." },
    { key: "product", type: "text", label: "Product", default: "Aero Bottle", maxLength: 26, shrinkToFit: true },
    { key: "rank", type: "text", label: "Rank", default: "#1 Bestseller", maxLength: 22, shrinkToFit: true },
    { key: "rating", type: "slider", label: "Rating", default: 5, min: 1, max: 5, step: 1 },
    { key: "showStars", type: "toggle", label: "Rating stars", default: true },
    { key: "showRibbon", type: "toggle", label: "Rank ribbon", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

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
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#C2380F", textColor: "#14140F", onAccent: "#FFFFFF", muted: "#6B6B60" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", muted: "#6A5E85" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", muted: "#5A6A82" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", muted: "#8A93A0" } },
];

const DUR = 4.7;

/** Content band (keeps clear of 9:16 platform-UI safe zones), matching sibling templates. */
function band(aspect: Aspect, w: number, h: number): { top: number; bottom: number } {
  if (aspect === "9:16") return { top: 230, bottom: h - 410 };
  const m = Math.round(Math.min(w, h) * 0.06);
  return { top: m, bottom: h - m };
}

/** Largest size ≤ size0 at which `text` fits `maxWidth` on one line. */
function fitOneLine(
  fonts: TemplateContext["fonts"],
  text: string,
  weight: number,
  size0: number,
  maxWidth: number,
  minSize = 14,
): number {
  const family = fonts.family("display");
  let size = size0;
  while (size > minSize && fonts.measure(text, { family, weight, size }) > maxWidth) size -= 1;
  return size;
}

/** A small square product card: shadow + bg + cover-fit masked image, or a placeholder. */
function miniCard(side: number, tex: Texture | null, cardColor: string, accent: string): Container {
  const c = new Container();
  const r = side * 0.1;
  c.addChild(new Graphics().roundRect(-side / 2, -side / 2 + side * 0.045, side, side, r).fill({ color: 0x000000, alpha: 0.16 }));
  c.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(cardColor));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.max(side / tex.width, side / tex.height));
    const mask = new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    c.addChild(new Graphics().circle(0, 0, side * 0.3).fill({ color: accent, alpha: 0.14 }));
    const bw = side * 0.3;
    const bh = side * 0.44;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#C2380F"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const muted = pc("muted", "#6B6B60");

  const label = str(values.label, "3-in-1 Bundle");
  const price = str(values.price, "$59");
  const oldPriceRaw = typeof values.oldPrice === "string" ? values.oldPrice.trim() : "";
  const cta = str(values.cta, "Get the bundle");
  const showBadge = values.showBadge !== false;

  const imgs: (Texture | null)[] = [images.image1 ?? null, images.image2 ?? null, images.image3 ?? null];

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  const minDim = Math.min(W, H);

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const b = band(ctx.aspect, W, H);
  const bandH = b.bottom - b.top;

  // --- Geometry: center the whole (stack + reveal) composition in the band ---
  const cardSide = minDim * 0.32;
  const stackHalf = cardSide * 0.66;
  const gap1 = minDim * 0.06;
  const labelSize = Math.round(minDim * 0.05);
  const labelH = labelSize * 1.25;
  const gapLP = minDim * 0.038;
  const priceSize = Math.round(minDim * 0.086);
  const priceH = priceSize * 1.3;
  const gapPC = minDim * 0.05;
  const ctaSize = Math.round(minDim * 0.04);
  const ctaH = ctaSize * 2.05;

  const belowH = gap1 + labelH + gapLP + priceH + gapPC + ctaH;
  const totalH = stackHalf * 2 + belowH;
  const compTop = b.top + Math.max(0, (bandH - totalH) / 2);
  const stackCy = compTop + stackHalf;

  let y = stackCy + stackHalf + gap1;
  const labelY = y + labelH / 2;
  y += labelH + gapLP;
  const priceY = y + priceH / 2;
  y += priceH + gapPC;
  const ctaCy = y + ctaH / 2;

  // --- Three cards fly in from different directions and fan into a stack ---
  const finals = [
    { dx: -cardSide * 0.17, dy: -cardSide * 0.015, rot: -9 * DEG },
    { dx: cardSide * 0.02, dy: cardSide * 0.03, rot: 2 * DEG },
    { dx: cardSide * 0.18, dy: -cardSide * 0.01, rot: 10 * DEG },
  ];
  const starts = [
    { x: cx - W * 0.62, y: stackCy - H * 0.1, rot: -52 * DEG },
    { x: cx, y: -cardSide * 0.9, rot: -16 * DEG },
    { x: cx + W * 0.62, y: stackCy - H * 0.1, rot: 52 * DEG },
  ];
  const cardStarts = [0.25, 0.55, 0.85];

  for (let i = 0; i < 3; i++) {
    const fork = rng.fork(i);
    const fin = finals[i]!;
    const st = starts[i]!;
    const finalX = cx + fin.dx + fork.range(-1, 1) * cardSide * 0.015;
    const finalY = stackCy + fin.dy + fork.range(-1, 1) * cardSide * 0.015;
    const finalRot = fin.rot + fork.range(-2, 2) * DEG;

    const card = miniCard(cardSide, imgs[i] ?? null, cardColor, accent);
    card.position.set(st.x, st.y);
    card.rotation = st.rot;
    card.alpha = 0;
    root.addChild(card);

    const start = cardStarts[i]!;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(card, { prop: "x", from: st.x, to: finalX, start, duration: 0.85, ease: spring(0.55) })
      .to(card, { prop: "y", from: st.y, to: finalY, start, duration: 0.85, ease: spring(0.55) })
      .to(card, { prop: "rotation", from: st.rot, to: finalRot, start, duration: 0.75, ease: outExpo });
  }

  // --- "BUNDLE" badge stamped on the stack's top-right corner ---
  if (showBadge) {
    const badgeSize = Math.round(minDim * 0.034);
    const badgeLabel = makeText(fonts, { text: "BUNDLE", role: "display", weight: 700, size: badgeSize, color: onAccent, anchor: 0.5, letterSpacing: 1 });
    const bw = badgeLabel.width + badgeSize * 1.3;
    const bh = badgeSize * 1.9;
    const badge = new Container();
    badge.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bh * 0.32).fill(accent));
    badge.addChild(badgeLabel);
    badge.position.set(cx + cardSide * 0.36, stackCy - stackHalf * 0.85);
    badge.rotation = -20 * DEG;
    badge.scale.set(0);
    root.addChild(badge);
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: 1.85, duration: 0.55, ease: makeOutBack(2.1) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: 1.85, duration: 0.55, ease: makeOutBack(2.1) })
      .to(badge, { prop: "rotation", from: -20 * DEG, to: -6 * DEG, start: 1.85, duration: 0.55, ease: makeOutBack(2.1) });
  }

  // --- Bundle label ---
  const labelFit = fitOneLine(fonts, label, 700, labelSize, W * 0.82, 18);
  const labelText = makeText(fonts, { text: label, role: "display", weight: 700, size: labelFit, color: textColor, anchor: 0.5, align: "center" });
  labelText.position.set(cx, labelY);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: 2.05, duration: 0.4, ease: outQuad })
    .to(labelText, { prop: "y", from: labelY + 14, to: labelY, start: 2.05, duration: 0.5, ease: outQuint });

  // --- Combined price, with a strike-through original price ---
  const priceFit = fitOneLine(fonts, price, 700, priceSize, W * 0.5, 24);
  const priceText = makeText(fonts, { text: price, role: "display", weight: 700, size: priceFit, color: textColor, anchor: 0.5 });
  const showOld = oldPriceRaw.length > 0;
  let priceCx = cx;
  if (showOld) {
    const oldSize = Math.round(priceFit * 0.5);
    const oldText = makeText(fonts, { text: oldPriceRaw, role: "display", weight: 600, size: oldSize, color: muted, anchor: 0.5 });
    const gapp = priceFit * 0.3;
    priceCx = cx + (oldText.width + gapp) / 2;
    const oldCx = priceCx - priceText.width / 2 - gapp - oldText.width / 2;
    const oldC = new Container();
    oldText.position.set(oldCx, priceY);
    const strikeH = Math.max(2, priceFit * 0.045);
    oldC.addChild(oldText);
    oldC.addChild(new Graphics().roundRect(oldCx - oldText.width / 2, priceY - strikeH / 2, oldText.width, strikeH, strikeH / 2).fill(muted));
    oldC.alpha = 0;
    root.addChild(oldC);
    timeline.to(oldC, { prop: "alpha", from: 0, to: 1, start: 2.55, duration: 0.4, ease: outQuad });
  }
  priceText.position.set(priceCx, priceY);
  priceText.alpha = 0;
  priceText.scale.set(0.6);
  root.addChild(priceText);
  timeline
    .to(priceText, { prop: "alpha", from: 0, to: 1, start: 2.3, duration: 0.35, ease: outQuad })
    .to(priceText, { prop: "scale.x", from: 0.6, to: 1, start: 2.3, duration: 0.6, ease: spring(0.45) })
    .to(priceText, { prop: "scale.y", from: 0.6, to: 1, start: 2.3, duration: 0.6, ease: spring(0.45) });

  // --- CTA pill (optional) ---
  if (cta.length > 0) {
    const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
    const ctaW = ctaLabel.width + ctaSize * 1.6;
    const ctaC = new Container();
    ctaC.addChild(new Graphics().roundRect(-ctaW / 2, -ctaH / 2, ctaW, ctaH, ctaH / 2).fill(accent));
    ctaC.addChild(ctaLabel);
    ctaC.position.set(cx, ctaCy);
    ctaC.scale.set(0);
    root.addChild(ctaC);
    timeline
      .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: 2.7, duration: 0.6, ease: spring(0.45) })
      .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: 2.7, duration: 0.6, ease: spring(0.45) })
      .to(ctaC, { prop: "scale.x", from: 1, to: 1.04, start: 3.6, duration: 0.4, ease: outQuad })
      .to(ctaC, { prop: "scale.x", from: 1.04, to: 1, start: 4.0, duration: 0.28, ease: outQuad });
  }

  return { timeline, duration: DUR };
}

export const bundleStack: TemplateDefinition = {
  id: "bundle-stack",
  name: "Bundle Stack",
  tagline: "Three cards fly in and fan into a stacked bundle deal.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.3,
  fontRoles: { label: "display" },
  palettes: PALETTES,
  fields: [
    { key: "image1", type: "image", label: "Image 1", default: "", optional: true },
    { key: "image2", type: "image", label: "Image 2", default: "", optional: true },
    { key: "image3", type: "image", label: "Image 3", default: "", optional: true },
    { key: "label", type: "text", label: "Bundle name", default: "3-in-1 Bundle", maxLength: 28, shrinkToFit: true },
    { key: "price", type: "text", label: "Bundle price", default: "$59", maxLength: 12 },
    { key: "oldPrice", type: "text", label: "Old price", default: "$96", maxLength: 12, optional: true },
    { key: "cta", type: "text", label: "Button", default: "Get the bundle", maxLength: 20, optional: true },
    { key: "showBadge", type: "toggle", label: "Bundle badge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

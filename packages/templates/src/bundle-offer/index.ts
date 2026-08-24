import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { groupThousands, parseTargetNumber } from "../shared/format";

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "fresh-white", name: "Fresh white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F", onAccent: "#FFFFFF", muted: "#6B6B60" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", muted: "#6A5E85" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", muted: "#5A6A82" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", muted: "#8A93A0" } },
];

interface BCfg {
  frameSF: number;
  rowCyF: number;
  labelF: number;
  priceF: number;
  ctaF: number;
  badgeYF: number;
}

const BCFG: Record<Aspect, BCfg> = {
  "1:1": { frameSF: 0.24, rowCyF: 0.4, labelF: 0.05, priceF: 0.09, ctaF: 0.042, badgeYF: 0.14 },
  "4:5": { frameSF: 0.24, rowCyF: 0.38, labelF: 0.05, priceF: 0.09, ctaF: 0.042, badgeYF: 0.13 },
  "9:16": { frameSF: 0.26, rowCyF: 0.36, labelF: 0.05, priceF: 0.09, ctaF: 0.042, badgeYF: 0.14 },
  "16:9": { frameSF: 0.26, rowCyF: 0.38, labelF: 0.034, priceF: 0.055, ctaF: 0.028, badgeYF: 0.14 },
};

const DUR = 4.2;

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
    c.addChild(new Graphics().circle(0, 0, side * 0.3).fill({ color: accent, alpha: 0.12 }));
    c.addChild(new Graphics().circle(0, 0, side * 0.21).fill({ color: accent, alpha: 0.2 }));
    const bw = side * 0.28;
    const bh = side * 0.42;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
  c.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, r).stroke({ color: borderC, width: Math.max(1, side * 0.006), alpha: 0.35 }));
  return c;
}

/** A rounded pill with a centered label (and optional leading star icon). */
function pill(fonts: TemplateContext["fonts"], text: string, size: number, fill: string, txtColor: string, star: boolean): Container {
  const c = new Container();
  const label = makeText(fonts, { text, role: "display", weight: 700, size, color: txtColor, anchor: 0.5, letterSpacing: 0.5 });
  const iconW = star ? size * 1.0 : 0;
  const iconGap = star ? size * 0.4 : 0;
  const padX = size * 0.85;
  const inner = iconW + iconGap + label.width;
  const pw = inner + padX * 2;
  const ph = size * 2.0;
  c.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill(fill));
  if (star) {
    const ic = makeIcon("star", iconW, { color: txtColor });
    ic.position.set(-pw / 2 + padX + iconW / 2, 0);
    c.addChild(ic);
  }
  label.position.set(-pw / 2 + padX + iconW + iconGap + label.width / 2, 0);
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

  const label = str(values.label, "Starter Bundle");
  const price = str(values.price, "$49");
  const oldRaw = typeof values.oldPrice === "string" ? values.oldPrice : "$78";
  const oldPrice = oldRaw.trim();
  const cta = str(values.cta, "Get the bundle");
  const showBadge = values.badge !== false;

  const oldN = parseTargetNumber(oldPrice);
  const newN = parseTargetNumber(price);
  const save = oldN > newN ? oldN - newN : 0;
  const symMatch = price.match(/^\D+/);
  const sym = symMatch?.[0] ?? "";
  const showOld = oldPrice.length > 0 && save > 0;
  const saveLabel = save > 0 ? `SAVE ${sym}${groupThousands(save)}` : "";

  const imgs: (Texture | null)[] = [images.image1 ?? null, images.image2 ?? null, images.image3 ?? null];
  const n = images.image3 ? 3 : 2;

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));

  const cfg = BCFG[ctx.aspect];
  const timeline = new JimaTimeline();

  // --- Frame row geometry ---
  const denom = 1.5 * n - 0.5;
  const baseSide = Math.min(W, H) * cfg.frameSF;
  const frameSide = Math.min(baseSide, (W * 0.86) / denom);
  const plusGap = frameSide * 0.5;
  const totalW = frameSide * denom;
  const rowCy = H * cfg.rowCyF;
  const startX = cx - totalW / 2 + frameSide / 2;
  const frameX = (i: number): number => startX + i * (frameSide + plusGap);

  const gap = Math.min(W, H) * 0.05;
  const labelSize = Math.round(W * cfg.labelF);
  const labelY = rowCy + frameSide / 2 + gap + labelSize * 0.5;
  const priceSize = Math.round(W * cfg.priceF);
  const priceY = labelY + labelSize * 0.5 + gap * 0.7 + priceSize * 0.5;
  const saveSize = Math.round(labelSize * 0.62);
  const saveY = priceY + priceSize * 0.5 + saveSize * 0.95;
  const ctaSize = Math.round(W * cfg.ctaF);
  const ctaH = ctaSize * 2.0;
  const ctaY = saveY + saveSize * 0.6 + gap + ctaH / 2;

  // --- Product frames + "+" glyphs ---
  const rise = H * 0.08;
  for (let i = 0; i < n; i++) {
    const frame = productFrame(frameSide, frameSide * 0.1, imgs[i] ?? null, cardColor, accent, textColor);
    frame.position.set(frameX(i), rowCy + rise);
    frame.alpha = 0;
    frame.scale.set(0.4);
    root.addChild(frame);
    const start = 0.4 + i * 0.18;
    timeline
      .to(frame, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(frame, { prop: "y", from: rowCy + rise, to: rowCy, start, duration: 0.7, ease: spring(0.5) })
      .to(frame, { prop: "scale.x", from: 0.4, to: 1, start, duration: 0.7, ease: spring(0.5) })
      .to(frame, { prop: "scale.y", from: 0.4, to: 1, start, duration: 0.7, ease: spring(0.5) });

    if (i < n - 1) {
      const plusG = makeIcon("plus", frameSide * 0.26, { color: accent });
      plusG.position.set(frameX(i) + frameSide / 2 + plusGap / 2, rowCy);
      plusG.scale.set(0);
      root.addChild(plusG);
      const pStart = start + 0.32;
      timeline
        .to(plusG, { prop: "scale.x", from: 0, to: 1, start: pStart, duration: 0.5, ease: makeOutBack(2.0) })
        .to(plusG, { prop: "scale.y", from: 0, to: 1, start: pStart, duration: 0.5, ease: makeOutBack(2.0) });
    }
  }

  // --- "BUNDLE" badge (ink pill with a star) ---
  if (showBadge) {
    const badgeY = H * cfg.badgeYF;
    const badgeSize = Math.round(Math.min(W, H) * 0.032);
    const badge = pill(fonts, "BUNDLE", badgeSize, textColor, bg, true);
    badge.position.set(cx, badgeY);
    badge.scale.set(0);
    badge.rotation = -4 * DEG;
    root.addChild(badge);
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: 0.2, duration: 0.6, ease: makeOutBack(1.8) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: 0.2, duration: 0.6, ease: makeOutBack(1.8) })
      .to(badge, { prop: "rotation", from: -4 * DEG, to: 0, start: 0.2, duration: 0.6, ease: makeOutBack(1.8) });
  }

  // --- Bundle label ---
  const labelText = fitText(
    fonts,
    { text: label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: 0.5, align: "center" },
    W * 0.8,
  );
  labelText.position.set(cx, labelY);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: 1.1, duration: 0.4, ease: outQuad })
    .to(labelText, { prop: "y", from: labelY + 14, to: labelY, start: 1.1, duration: 0.5, ease: outExpo });

  // --- Price row: [old struck] [total], group centered on the canvas ---
  const priceText = fitText(
    fonts,
    { text: price, role: "display", weight: 700, size: priceSize, color: textColor, anchor: 0.5 },
    W * 0.56,
  );
  let priceCx = cx;
  if (showOld) {
    const oldSize = Math.round(priceSize * 0.52);
    const oldText = makeText(fonts, { text: oldPrice, role: "display", weight: 600, size: oldSize, color: muted, anchor: 0.5 });
    const oldW = oldText.width;
    const gapp = priceSize * 0.32;
    priceCx = cx + (oldW + gapp) / 2;
    const oldCx = priceCx - priceText.width / 2 - gapp - oldW / 2;
    const oldC = new Container();
    oldText.position.set(oldCx, priceY);
    const strikeH = Math.max(2, priceSize * 0.045);
    oldC.addChild(oldText);
    oldC.addChild(new Graphics().roundRect(oldCx - oldW / 2, priceY - strikeH / 2, oldW, strikeH, strikeH / 2).fill(muted));
    oldC.alpha = 0;
    root.addChild(oldC);
    timeline.to(oldC, { prop: "alpha", from: 0, to: 1, start: 1.65, duration: 0.4, ease: outQuad });
  }
  priceText.position.set(priceCx, priceY);
  priceText.alpha = 0;
  priceText.scale.set(0.6);
  root.addChild(priceText);
  timeline
    .to(priceText, { prop: "alpha", from: 0, to: 1, start: 1.4, duration: 0.35, ease: outQuad })
    .to(priceText, { prop: "scale.x", from: 0.6, to: 1, start: 1.4, duration: 0.6, ease: spring(0.45) })
    .to(priceText, { prop: "scale.y", from: 0.6, to: 1, start: 1.4, duration: 0.6, ease: spring(0.45) });

  // --- SAVE chip ---
  if (saveLabel.length > 0) {
    const saveChip = pill(fonts, saveLabel, saveSize, accent, onAccent, false);
    saveChip.position.set(cx, saveY);
    saveChip.scale.set(0);
    saveChip.rotation = -5 * DEG;
    root.addChild(saveChip);
    timeline
      .to(saveChip, { prop: "scale.x", from: 0, to: 1, start: 1.95, duration: 0.55, ease: makeOutBack(1.9) })
      .to(saveChip, { prop: "scale.y", from: 0, to: 1, start: 1.95, duration: 0.55, ease: makeOutBack(1.9) })
      .to(saveChip, { prop: "rotation", from: -5 * DEG, to: 0, start: 1.95, duration: 0.55, ease: makeOutBack(1.9) });
  }

  // --- CTA pill ---
  if (cta.length > 0) {
    const ctaC = pill(fonts, cta, ctaSize, accent, onAccent, false);
    ctaC.position.set(cx, ctaY);
    ctaC.scale.set(0);
    root.addChild(ctaC);
    timeline
      .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: 2.2, duration: 0.6, ease: spring(0.45) })
      .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: 2.2, duration: 0.6, ease: spring(0.45) })
      .to(ctaC, { prop: "scale.x", from: 1, to: 1.04, start: 3.3, duration: 0.45, ease: outQuad })
      .to(ctaC, { prop: "scale.x", from: 1.04, to: 1, start: 3.75, duration: 0.45, ease: outQuad });
  }

  return { timeline, duration: DUR };
}

export const bundleOffer: TemplateDefinition = {
  id: "bundle-offer",
  name: "Bundle Offer",
  tagline: "Products group into a bundle with a big total and a save chip.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.8,
  palettes: PALETTES,
  fields: [
    { key: "image1", type: "image", label: "Image 1", default: "", optional: true },
    { key: "image2", type: "image", label: "Image 2", default: "", optional: true },
    { key: "image3", type: "image", label: "Image 3", default: "", optional: true, help: "Add a third to show a 3-item bundle." },
    { key: "label", type: "text", label: "Label", default: "Starter Bundle", maxLength: 28, shrinkToFit: true },
    { key: "price", type: "text", label: "Total price", default: "$49", maxLength: 12 },
    { key: "oldPrice", type: "text", label: "Old price", default: "$78", maxLength: 12, optional: true },
    { key: "cta", type: "text", label: "Button", default: "Get the bundle", maxLength: 20 },
    { key: "badge", type: "toggle", label: "Badge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

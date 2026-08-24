import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  spring,
  makeOutBack,
  makeInBack,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", imageBack: "#FFFFFF", accent: "#C2380F", textColor: "#14140F", onAccent: "#FFFFFF" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", imageBack: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", imageBack: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", imageBack: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A" } },
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

/** A rounded product frame: cover-fit masked image, or a designed placeholder. */
function productFrame(side: number, r: number, tex: Texture | null, imageBack: string, accent: string): Container {
  const c = new Container();
  c.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(imageBack));
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(side / tex.width, side / tex.height);
    s.scale.set(cover);
    const mask = new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(0xffffff);
    c.addChild(s, mask);
    s.mask = mask;
  } else {
    c.addChild(new Graphics().circle(0, 0, side * 0.34).fill({ color: accent, alpha: 0.12 }));
    c.addChild(new Graphics().circle(0, 0, side * 0.24).fill({ color: accent, alpha: 0.2 }));
    const bw = side * 0.3;
    const bh = side * 0.42;
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bw * 0.2).fill(accent));
    c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh * 0.34, bw * 0.2).fill({ color: 0xffffff, alpha: 0.2 }));
  }
  return c;
}

function frameSideFor(aspect: Aspect, w: number, h: number): number {
  switch (aspect) {
    case "16:9":
      return h * 0.56;
    case "1:1":
      return w * 0.5;
    case "4:5":
      return w * 0.56;
    case "9:16":
      return w * 0.62;
  }
}

function titleSizeFor(aspect: Aspect, w: number): number {
  switch (aspect) {
    case "16:9":
      return Math.round(w * 0.048);
    case "9:16":
      return Math.round(w * 0.082);
    default:
      return Math.round(w * 0.074);
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const imageBack = str(values.imageBack, pc("imageBack", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const showBadge = values.showBadge !== false;

  const title = str(values.title, "The New One");
  const price = str(values.price, "");

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const DUR = 4.5;

  // --- Layout: frame, title, price stacked and vertically centered ---
  const side = frameSideFor(ctx.aspect, w, h);
  const frameR = side * 0.09;
  const marginX = Math.round(minDim * 0.06);
  const textW = w - marginX * 2;
  const titleSize0 = titleSizeFor(ctx.aspect, w);
  const { lines: titleLines, size: titleSize } = wrapAndFit(fonts, title, "display", 700, titleSize0, textW, 2);
  const titleLH = Math.round(titleSize * 1.08);
  const titleBlockH = titleLines.length * titleLH;
  const hasPrice = price.length > 0;
  const priceSize = Math.round(titleSize0 * 0.46);
  const priceH = priceSize * 1.8;
  const gap1 = minDim * 0.06;
  const gap2 = minDim * 0.045;
  const totalH = side + gap1 + titleBlockH + (hasPrice ? gap2 + priceH : 0);

  const centerY = ctx.aspect === "9:16" ? 220 + (h - 220 - 400) / 2 : h / 2;
  const top = centerY - totalH / 2;
  const frameCy = top + side / 2;
  const titleY = top + side + gap1;
  const priceCy = titleY + titleBlockH + gap2 + priceH / 2;

  // --- Product frame: rises + scales in ---
  const tex = images.image ?? null;
  const frame = productFrame(side, frameR, tex, imageBack, accent);
  const riseFrom = frameCy + minDim * 0.06;
  frame.position.set(cx, riseFrom);
  frame.scale.set(0.8);
  frame.alpha = 0;
  root.addChild(frame);
  timeline
    .to(frame, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.35, ease: outQuad })
    .to(frame, { prop: "scale.x", from: 0.8, to: 1, start: 0.15, duration: 0.75, ease: spring(0.5) })
    .to(frame, { prop: "scale.y", from: 0.8, to: 1, start: 0.15, duration: 0.75, ease: spring(0.5) })
    .to(frame, { prop: "y", from: riseFrom, to: frameCy, start: 0.15, duration: 0.7, ease: outQuint })
    // gentle idle bob late in the hold
    .to(frame, { prop: "y", from: frameCy, to: frameCy - minDim * 0.01, start: 3.0, duration: 0.6, ease: outQuad })
    .to(frame, { prop: "y", from: frameCy - minDim * 0.01, to: frameCy, start: 3.6, duration: 0.6, ease: outQuad });

  // --- "NEW" badge stamps onto the frame's top-right corner ---
  if (showBadge) {
    const badgeR = side * 0.155;
    const bx = cx + side / 2 - badgeR * 0.3;
    const by = frameCy - side / 2 + badgeR * 0.3;
    const badge = new Container();
    badge.position.set(bx, by);
    badge.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));
    badge.addChild(new Graphics().circle(0, 0, badgeR * 0.84).stroke({ color: onAccent, width: Math.max(2, badgeR * 0.05), alpha: 0.9 }));
    badge.addChild(makeText(fonts, { text: "NEW", role: "display", weight: 700, size: Math.round(badgeR * 0.6), color: onAccent, anchor: 0.5, letterSpacing: 1 }));
    badge.scale.set(2.0);
    badge.rotation = -16 * DEG;
    badge.alpha = 0;
    root.addChild(badge);

    const STAMP = 0.82;
    timeline
      .to(badge, { prop: "alpha", from: 0, to: 1, start: STAMP, duration: 0.1, ease: outQuad })
      .to(badge, { prop: "scale.x", from: 2.0, to: 1, start: STAMP, duration: 0.3, ease: makeInBack(1.6) })
      .to(badge, { prop: "scale.y", from: 2.0, to: 1, start: STAMP, duration: 0.3, ease: makeInBack(1.6) })
      .to(badge, { prop: "rotation", from: -16 * DEG, to: 3 * DEG, start: STAMP, duration: 0.2, ease: outExpo })
      .to(badge, { prop: "rotation", from: 3 * DEG, to: -2.5 * DEG, start: STAMP + 0.2, duration: 0.08, ease: outQuad })
      .to(badge, { prop: "rotation", from: -2.5 * DEG, to: 1.3 * DEG, start: STAMP + 0.28, duration: 0.08, ease: outQuad })
      .to(badge, { prop: "rotation", from: 1.3 * DEG, to: 0, start: STAMP + 0.36, duration: 0.16, ease: outQuad });
  }

  // --- Title ---
  const titleText = makeText(fonts, {
    text: titleLines.join("\n"),
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: { x: 0.5, y: 0 },
    lineHeight: titleLH,
    align: "center",
  });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 1.45, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 18, to: titleY, start: 1.45, duration: 0.6, ease: outExpo });

  // --- Price chip ---
  if (hasPrice) {
    const priceLabel = makeText(fonts, { text: price, role: "display", weight: 700, size: priceSize, color: onAccent, anchor: 0.5 });
    const priceW = priceLabel.width + priceSize * 1.4;
    const priceChip = new Container();
    priceChip.addChild(new Graphics().roundRect(-priceW / 2, -priceH / 2, priceW, priceH, priceH / 2).fill(accent));
    priceChip.addChild(priceLabel);
    priceChip.position.set(cx, priceCy);
    priceChip.scale.set(0);
    root.addChild(priceChip);
    timeline
      .to(priceChip, { prop: "scale.x", from: 0, to: 1, start: 2.1, duration: 0.55, ease: makeOutBack(1.8) })
      .to(priceChip, { prop: "scale.y", from: 0, to: 1, start: 2.1, duration: 0.55, ease: makeOutBack(1.8) });
  }

  return { timeline, duration: DUR };
}

export const newDrop: TemplateDefinition = {
  id: "new-drop",
  name: "New Drop",
  tagline: "A product rises in as a NEW badge stamps its corner.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Product image", default: "", optional: true, help: "Fills the frame; a clean product photo works best." },
    { key: "title", type: "text", label: "Title", default: "The New One", maxLength: 30, shrinkToFit: true },
    { key: "price", type: "text", label: "Price", default: "$39", maxLength: 12, optional: true },
    { key: "showBadge", type: "toggle", label: "NEW badge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "imageBack", type: "color", label: "Image back", default: "", optional: true },
  ],
  build,
};

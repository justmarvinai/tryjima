import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  inOutQuad,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

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

// A sealed card flips through zero width to reveal the logo lockup on its back.
// The card surface uses its own `cardBg` (survives transparent export); the mark
// tile uses a deep `mark` + white `onMark` so the initials always clear 4.5:1.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FA", textColor: "#0F1420", accent: "#3B4FD6", cardBg: "#FFFFFF", mark: "#3B4FD6", onMark: "#FFFFFF" } },
  { id: "cream", name: "Cream", colors: { background: "#FBF6EF", textColor: "#241A12", accent: "#C2410C", cardBg: "#FFFFFF", mark: "#C2410C", onMark: "#FFFFFF" } },
  { id: "blush", name: "Blush", colors: { background: "#FDEEF4", textColor: "#2A0E1C", accent: "#BE185D", cardBg: "#FFFFFF", mark: "#BE185D", onMark: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C1018", textColor: "#F2F5FA", accent: "#6EA8FE", cardBg: "#161C28", mark: "#6EA8FE", onMark: "#0C1018" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#0F1420"));
  const accent = str(values.accent, pc("accent", "#3B4FD6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const mark = pc("mark", "#3B4FD6");
  const onMark = pc("onMark", "#FFFFFF");

  const initials = str(values.initials, "JM").slice(0, 3).toUpperCase();
  const brand = str(values.brand, "Jima Motion");
  const tagline = str(values.tagline, "motion for everyone");
  const showRule = values.showRule !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height * 0.5;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const cardW = Math.min(zone.width * 0.9, minDim * 0.56);
  const cardH = Math.min(zone.height * 0.86, minDim * 0.64);
  const cardR = Math.round(minDim * 0.04);

  const card = new Container();
  card.position.set(cx, cy);
  card.scale.set(0);
  root.addChild(card);

  // Soft shadow so the card reads as a floating surface.
  const e = Math.round(minDim * 0.008);
  const off = Math.round(minDim * 0.014);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - e, -cardH / 2 - e + off, cardW + e * 2, cardH + e * 2, cardR + e)
      .fill({ color: "#000000", alpha: 0.14 }),
  );

  // --- Front face: sealed accent card ---
  const front = new Container();
  card.addChild(front);
  front.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(accent));
  front.addChild(
    new Graphics().circle(0, 0, minDim * 0.12).stroke({ color: onMark, width: Math.max(3, minDim * 0.008), alpha: 0.9 }),
  );
  front.addChild(
    new Graphics().circle(0, 0, minDim * 0.03).fill({ color: onMark, alpha: 0.9 }),
  );

  // --- Back face: the logo lockup ---
  const back = new Container();
  back.visible = false;
  card.addChild(back);
  back.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg));

  const tile = Math.round(minDim * 0.2);
  const tileR = Math.round(tile * 0.22);
  const tileY = -cardH * 0.16;
  const tileNode = new Container();
  tileNode.position.set(0, tileY);
  back.addChild(tileNode);
  tileNode.addChild(new Graphics().roundRect(-tile / 2, -tile / 2, tile, tile, tileR).fill(mark));
  const initSize = fitSize(fonts, initials, "display", 700, Math.round(tile * 0.5), tile * 0.72);
  tileNode.addChild(makeText(fonts, { text: initials, role: "display", weight: 700, size: initSize, color: onMark, anchor: 0.5 }));
  tileNode.scale.set(0.8);

  const brandSize = fitSize(fonts, brand, "display", 700, Math.round(minDim * 0.05), cardW * 0.82);
  const brandY = tileY + tile / 2 + brandSize * 0.9;
  const brandText = makeText(fonts, { text: brand, role: "display", weight: 700, size: brandSize, color: textColor, anchor: 0.5 });
  brandText.position.set(0, brandY);
  brandText.alpha = 0;
  back.addChild(brandText);

  const ruleY = brandY + brandSize * 0.72;
  if (showRule) {
    const ruleW = minDim * 0.09;
    const rule = new Graphics().roundRect(-ruleW / 2, -Math.max(1.5, minDim * 0.004), ruleW, Math.max(3, minDim * 0.008), 3).fill(accent);
    rule.position.set(0, ruleY);
    rule.scale.set(0, 1);
    back.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 1.5, duration: 0.4, ease: outExpo });
  }

  if (tagline.length > 0) {
    const tagSize = fitSize(fonts, tagline, "body", 500, Math.round(minDim * 0.024), cardW * 0.82);
    const tagY = ruleY + tagSize * 1.3;
    const tag = makeText(fonts, { text: tagline, role: "body", weight: 500, size: tagSize, color: textColor, anchor: 0.5, letterSpacing: 1 });
    tag.position.set(0, tagY);
    tag.alpha = 0;
    back.addChild(tag);
    timeline.to(tag, { prop: "alpha", from: 0, to: 0.82, start: 1.55, duration: 0.45, ease: outQuad });
  }

  // Entry pop.
  timeline
    .to(card, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.5, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.5, ease: spring(0.5) });

  // Flip: compress to zero width (front), swap faces at the seam, expand (back).
  const flip0 = 0.9;
  const flipMid = 1.25;
  const flip1 = 1.6;
  timeline
    .to(card, { prop: "scale.x", from: 1, to: 0.02, start: flip0, duration: flipMid - flip0, ease: inOutQuad })
    .to(card, { prop: "scale.x", from: 0.02, to: 1, start: flipMid, duration: flip1 - flipMid, ease: outExpo });
  timeline.set(front, "visible", false, flipMid);
  timeline.set(back, "visible", true, flipMid);

  // Back content settle.
  timeline
    .to(tileNode, { prop: "scale.x", from: 0.8, to: 1, start: flipMid, duration: 0.4, ease: outExpo })
    .to(tileNode, { prop: "scale.y", from: 0.8, to: 1, start: flipMid, duration: 0.4, ease: outExpo })
    .to(brandText, { prop: "alpha", from: 0, to: 1, start: flipMid + 0.1, duration: 0.4, ease: outQuad });

  return { timeline, duration: 4.4 };
}

export const logoFlip: TemplateDefinition = {
  id: "logo-flip",
  name: "Logo Flip",
  tagline: "A sealed card flips over to reveal the logo lockup.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { brand: "display" },
  palettes: PALETTES,
  fields: [
    { key: "initials", type: "text", label: "Initials", default: "JM", maxLength: 3, shrinkToFit: true },
    { key: "brand", type: "text", label: "Brand", default: "Jima Motion", maxLength: 24, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "motion for everyone", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

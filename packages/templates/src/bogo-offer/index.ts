import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  makeOutBack,
  outBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

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

// Two products slide in, a "FREE" tag pops, and a bold BOGO badge thuds down.
const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", accent: "#C2380F", textColor: "#2A0E06", onAccent: "#FFFFFF" } },
  { id: "royal", name: "Royal", colors: { background: "#EEF2FF", accent: "#3455E6", textColor: "#0C1330", onAccent: "#FFFFFF" } },
  { id: "berry", name: "Berry", colors: { background: "#FFEEF6", accent: "#C21473", textColor: "#2E0A1E", onAccent: "#FFFFFF" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A" } },
];

/** A simple product-bottle silhouette with a shine, centered at origin. */
function bottle(bw: number, bh: number, color: string, hi: string): Container {
  const c = new Container();
  c.addChild(new Graphics().roundRect(-bw / 2, -bh / 2 + bh * 0.09, bw, bh * 0.91, bw * 0.26).fill(color));
  c.addChild(new Graphics().roundRect(-bw * 0.17, -bh / 2 - bh * 0.02, bw * 0.34, bh * 0.16, bw * 0.08).fill(color));
  c.addChild(new Graphics().roundRect(-bw / 2 + bw * 0.14, -bh / 2 + bh * 0.2, bw * 0.19, bh * 0.56, bw * 0.09).fill({ color: hi, alpha: 0.24 }));
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const accent = str(values.accent, pc("accent", "#C2380F"));
  const textColor = str(values.textColor, pc("textColor", "#2A0E06"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const headline = str(values.headline, "Buy 1 Get 1");
  const detail = str(values.detail, "Add 2 — pay for 1");
  const hasDetail = detail.length > 0;
  const showTag = values.showTag !== false;
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

  // --- Metrics ---
  const productW = minDim * 0.23;
  const productH = minDim * 0.36;
  const pairGap = minDim * 0.06;
  const badgeH = minDim * 0.17;
  const detailSize0 = Math.round(minDim * 0.038);
  const gapA = minDim * 0.055;
  const gapB = minDim * 0.05;
  const detailH = hasDetail ? detailSize0 * 1.3 : 0;

  const stackH = badgeH + gapA + productH + (hasDetail ? gapB + detailH : 0);
  const top = zone.y + (zone.height - stackH) / 2;

  const badgeCy = top + badgeH / 2;
  const rowCy = top + badgeH + gapA + productH / 2;
  const detailCy = rowCy + productH / 2 + gapB + detailH / 2;

  // --- Two product silhouettes (slide in from the sides) ---
  const leftX = cx - (productW / 2 + pairGap / 2);
  const rightX = cx + (productW / 2 + pairGap / 2);

  const left = bottle(productW, productH, accent, onAccent);
  left.position.set(leftX, rowCy);
  left.alpha = 0;
  root.addChild(left);
  timeline
    .to(left, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.35, ease: outQuad })
    .to(left, { prop: "x", from: leftX - minDim * 0.14, to: leftX, start: 0.15, duration: 0.6, ease: outExpo });

  const right = new Container();
  right.position.set(rightX, rowCy);
  right.addChild(bottle(productW, productH, accent, onAccent));
  right.alpha = 0;
  root.addChild(right);
  timeline
    .to(right, { prop: "alpha", from: 0, to: 1, start: 0.28, duration: 0.35, ease: outQuad })
    .to(right, { prop: "x", from: rightX + minDim * 0.14, to: rightX, start: 0.28, duration: 0.6, ease: outExpo });

  // "FREE" tag on the second product (inverted colors so it always reads).
  if (showTag) {
    const tagSize = Math.round(productW * 0.24);
    const tagLabel = makeText(fonts, { text: "FREE", role: "display", weight: 700, size: tagSize, color: accent, anchor: 0.5, letterSpacing: 1 });
    const tagW = tagLabel.width + tagSize * 1.1;
    const tagH = tagSize * 1.7;
    const tag = new Container();
    tag.addChild(new Graphics().roundRect(-tagW / 2, -tagH / 2, tagW, tagH, tagH / 2).fill(onAccent));
    tag.addChild(tagLabel);
    tag.position.set(productW * 0.28, -productH * 0.34);
    tag.rotation = 12 * DEG;
    tag.scale.set(0);
    right.addChild(tag);
    timeline
      .to(tag, { prop: "scale.x", from: 0, to: 1, start: 0.72, duration: 0.5, ease: makeOutBack(2.2) })
      .to(tag, { prop: "scale.y", from: 0, to: 1, start: 0.72, duration: 0.5, ease: makeOutBack(2.2) });
  }

  // --- Impact ring under the badge (decorative) ---
  if (showBurst) {
    const ring = new Graphics().circle(0, 0, badgeH * 0.7).stroke({ color: accent, width: Math.max(3, minDim * 0.009) });
    ring.position.set(cx, badgeCy);
    ring.alpha = 0;
    ring.scale.set(0.6);
    root.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 0.75, start: 0.82, duration: 0.1, ease: outQuad })
      .to(ring, { prop: "alpha", from: 0.75, to: 0, start: 0.92, duration: 0.55, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.6, to: 2.0, start: 0.82, duration: 0.65, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.6, to: 2.0, start: 0.82, duration: 0.65, ease: outExpo });
  }

  // --- BOGO badge (thuds down from above onto the products) ---
  const badgeLabel0 = Math.round(badgeH * 0.42);
  const maxBadgeW = zone.width * 0.92;
  const badgeSize = fitSize(fonts, headline, "display", 700, badgeLabel0, maxBadgeW - badgeH);
  const badgeText = makeText(fonts, { text: headline, role: "display", weight: 700, size: badgeSize, color: onAccent, anchor: 0.5, align: "center" });
  const badgeW = Math.min(maxBadgeW, badgeText.width + badgeH * 1.0);
  const badge = new Container();
  badge.addChild(new Graphics().roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, badgeH * 0.32).fill(accent));
  badge.addChild(badgeText);
  badge.position.set(cx, badgeCy);
  badge.alpha = 0;
  badge.scale.set(0.5);
  badge.rotation = -6 * DEG;
  root.addChild(badge);
  timeline
    .to(badge, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.2, ease: outQuad })
    .to(badge, { prop: "y", from: badgeCy - minDim * 0.06, to: badgeCy, start: 0.5, duration: 0.4, ease: outQuad })
    .to(badge, { prop: "scale.x", from: 0.5, to: 1, start: 0.5, duration: 0.62, ease: spring(0.4) })
    .to(badge, { prop: "scale.y", from: 0.5, to: 1, start: 0.5, duration: 0.62, ease: spring(0.4) })
    .to(badge, { prop: "rotation", from: -6 * DEG, to: 0, start: 0.5, duration: 0.55, ease: outBack });

  // --- Detail ---
  if (hasDetail) {
    const detailSize = fitSize(fonts, detail, "body", 600, detailSize0, zone.width * 0.9);
    const detailText = makeText(fonts, { text: detail, role: "body", weight: 600, size: detailSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 0.5 });
    detailText.position.set(cx, detailCy);
    detailText.alpha = 0;
    root.addChild(detailText);
    timeline
      .to(detailText, { prop: "alpha", from: 0, to: 0.92, start: 1.05, duration: 0.4, ease: outQuad })
      .to(detailText, { prop: "y", from: detailCy + minDim * 0.02, to: detailCy, start: 1.05, duration: 0.5, ease: outExpo });
  }

  return { timeline, duration: 4.0 };
}

export const bogoOffer: TemplateDefinition = {
  id: "bogo-offer",
  name: "BOGO Offer",
  tagline: "Two products slide in and a bold buy-one-get-one badge thuds down.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { headline: "display" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Badge headline", default: "Buy 1 Get 1", maxLength: 20, shrinkToFit: true },
    { key: "detail", type: "text", label: "Detail", default: "Add 2 — pay for 1", maxLength: 28, optional: true, shrinkToFit: true },
    { key: "showTag", type: "toggle", label: "FREE tag", default: true },
    { key: "showBurst", type: "toggle", label: "Impact ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

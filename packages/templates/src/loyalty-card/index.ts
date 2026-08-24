import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  inCubic,
  outQuint,
  outCubic,
  makeOutBack,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { dashedPath, arcPoints } from "../shared/ui";

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

// A punch card fills up stamp by stamp; the final slot lands bigger with a
// star, and a reward ribbon slides out from under the card. The punch-progress
// mechanic is the star here — not a wrapped reveal like gift-card.
const PALETTES: Palette[] = [
  { id: "espresso-cream", name: "Espresso cream", colors: { background: "#F3EDE4", cardColor: "#FFFFFF", textColor: "#2B1B10", muted: "#B8A896", accent: "#7A4A2B", onAccent: "#FFFFFF", gold: "#F2B441", onGold: "#4A2E00" } },
  { id: "berry-punch", name: "Berry punch", colors: { background: "#FDEEF3", cardColor: "#FFFFFF", textColor: "#3A0A22", muted: "#D9B3C4", accent: "#C2186B", onAccent: "#FFFFFF", gold: "#F2B441", onGold: "#4A2E00" } },
  { id: "forest-stamp", name: "Forest stamp", colors: { background: "#EAF3EC", cardColor: "#FFFFFF", textColor: "#10291B", muted: "#A9C4B1", accent: "#146B45", onAccent: "#FFFFFF", gold: "#F0BC47", onGold: "#443000" } },
  { id: "ink-citrus", name: "Ink citrus", colors: { background: "#16181D", cardColor: "#22262E", textColor: "#FFFFFF", muted: "#59616E", accent: "#FFA94D", onAccent: "#331A00", gold: "#FFD166", onGold: "#3D2A00" } },
];

const SLOTS = 8;
const STAMPS_START = 0.85;
const STAGGER = 0.27;
const LAST_AT = STAMPS_START + (SLOTS - 1) * STAGGER; // 2.74
const RIBBON_AT = 3.25;
const SHINE_AT = 3.9;
const DURATION = 4.7;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3EDE4"));
  const cardColor = str(values.cardColor, pc("cardColor", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#2B1B10"));
  const muted = pc("muted", "#B8A896");
  const accent = str(values.accent, pc("accent", "#7A4A2B"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const gold = pc("gold", "#F2B441");
  const onGold = pc("onGold", "#4A2E00");

  const brand = str(values.brand, "Bloom Coffee");
  const subtitle = typeof values.subtitle === "string" ? values.subtitle : "Buy 8, get 1 free";
  const rewardText = str(values.rewardText, "Free reward unlocked!");
  const showRipples = values.showRipples !== false;
  const showShine = values.showShine !== false;

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const cy = zone.y + zone.height / 2 - minDim * 0.03;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Card ---
  const cardW = Math.min(minDim * 0.82, zone.width * 0.95);
  const cardH = cardW * 0.64;
  const cardR = cardW * 0.055;
  const ribbonH = minDim * 0.07;

  const card = new Container();
  card.position.set(cx, cy);
  root.addChild(card);

  const shadow = new Graphics().roundRect(-cardW / 2, -cardH / 2 + minDim * 0.014, cardW, cardH, cardR).fill({ color: 0x000000, alpha: 0.15 });
  card.addChild(shadow);

  // Reward ribbon lives behind the card face and slides down into view.
  const ribbonW = cardW * 0.72;
  const ribbonHiddenY = cardH / 2 - ribbonH * 0.8;
  const ribbonShownY = cardH / 2 + ribbonH * 0.62;
  const ribbon = new Container();
  ribbon.position.set(0, ribbonHiddenY);
  ribbon.addChild(new Graphics().roundRect(-ribbonW / 2, -ribbonH / 2, ribbonW, ribbonH, ribbonH / 2).fill(accent));
  const ribbonFont = fitSize(fonts, rewardText, "display", 700, Math.round(ribbonH * 0.4), ribbonW - ribbonH * 1.1);
  ribbon.addChild(makeText(fonts, { text: rewardText, role: "display", weight: 700, size: ribbonFont, color: onAccent, anchor: 0.5, align: "center" }));
  card.addChild(ribbon);
  timeline.to(ribbon, { prop: "y", from: ribbonHiddenY, to: ribbonShownY, start: RIBBON_AT, duration: 0.55, ease: makeOutBack(1.5) });

  const face = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardColor);
  card.addChild(face);

  card.alpha = 0;
  card.scale.set(0.94);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.35, ease: outQuad })
    .to(card, { prop: "y", from: cy + minDim * 0.04, to: cy, start: 0.1, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.x", from: 0.94, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.94, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) });
  // A tiny thud when the star stamp lands.
  timeline
    .to(card, { prop: "y", from: cy, to: cy + minDim * 0.007, start: LAST_AT + 0.18, duration: 0.09, ease: outQuad })
    .to(card, { prop: "y", from: cy + minDim * 0.007, to: cy, start: LAST_AT + 0.27, duration: 0.2, ease: outQuad });

  // --- Brand row ---
  const dotR = cardW * 0.026;
  const brandSize = fitSize(fonts, brand, "display", 700, Math.round(cardW * 0.052), cardW * 0.7);
  const brandLabel = makeText(fonts, { text: brand, role: "display", weight: 700, size: brandSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  const brandRow = new Container();
  const rowW = dotR * 2 + cardW * 0.02 + brandLabel.width;
  const logoDot = new Container();
  logoDot.addChild(new Graphics().circle(0, 0, dotR).fill(accent));
  logoDot.addChild(makeIcon("star", dotR * 1.15, { color: onAccent }));
  logoDot.position.set(-rowW / 2 + dotR, 0);
  brandLabel.position.set(-rowW / 2 + dotR * 2 + cardW * 0.02, 0);
  brandRow.addChild(logoDot, brandLabel);
  brandRow.position.set(0, -cardH * 0.335);
  brandRow.alpha = 0;
  card.addChild(brandRow);
  timeline
    .to(brandRow, { prop: "alpha", from: 0, to: 1, start: 0.4, duration: 0.35, ease: outQuad })
    .to(brandRow, { prop: "y", from: -cardH * 0.335 + 12, to: -cardH * 0.335, start: 0.4, duration: 0.5, ease: outQuint });

  if (subtitle.length > 0) {
    const subSize = fitSize(fonts, subtitle, "body", 600, Math.round(cardW * 0.031), cardW * 0.8);
    const subLabel = makeText(fonts, { text: subtitle, role: "body", weight: 600, size: subSize, color: muted, anchor: 0.5, letterSpacing: 0.5 });
    subLabel.position.set(0, -cardH * 0.215);
    subLabel.alpha = 0;
    card.addChild(subLabel);
    timeline.to(subLabel, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.4, ease: outQuad });
  }

  // --- Punch grid: 2 rows x 4 dashed slots ---
  const slotR = cardW * 0.062;
  const colXs = [-0.33, -0.11, 0.11, 0.33].map((f) => f * cardW);
  const rowYs = [-0.02, 0.245].map((f) => f * cardH);

  for (let i = 0; i < SLOTS; i++) {
    const x = colXs[i % 4] ?? 0;
    const y = rowYs[i < 4 ? 0 : 1] ?? 0;

    // Empty slot: faint fill + dashed outline.
    const slot = new Graphics().circle(x, y, slotR).fill({ color: muted, alpha: 0.12 });
    dashedPath(slot, arcPoints(x, y, slotR, 0, Math.PI * 2, 44), {
      dash: slotR * 0.32,
      gap: slotR * 0.22,
      width: Math.max(2, slotR * 0.08),
      color: muted,
      cap: "round",
    });
    card.addChild(slot);

    const isLast = i === SLOTS - 1;
    const start = STAMPS_START + i * STAGGER;
    const rot0 = rng.range(-0.16, 0.16);

    // The stamp thunks in: big + loose, scales down hard, settles.
    const stamp = new Container();
    stamp.position.set(x, y);
    const sR = isLast ? slotR * 1.24 : slotR * 0.88;
    stamp.addChild(new Graphics().circle(0, 0, sR).fill(isLast ? gold : accent));
    if (isLast) {
      stamp.addChild(new Graphics().circle(0, 0, sR * 0.8).stroke({ color: onGold, width: Math.max(2, sR * 0.07), alpha: 0.5 }));
    }
    const icon = makeIcon(isLast ? "star" : "check", sR * (isLast ? 1.05 : 1.15), { color: isLast ? onGold : onAccent });
    stamp.addChild(icon);
    stamp.rotation = rot0;
    stamp.alpha = 0;
    stamp.scale.set(isLast ? 2.3 : 1.75);
    card.addChild(stamp);

    const dropDur = isLast ? 0.2 : 0.16;
    timeline
      .to(stamp, { prop: "alpha", from: 0, to: 1, start, duration: 0.08, ease: outQuad })
      .to(stamp, { prop: "scale.x", from: isLast ? 2.3 : 1.75, to: 0.96, start, duration: dropDur, ease: inCubic })
      .to(stamp, { prop: "scale.y", from: isLast ? 2.3 : 1.75, to: 0.96, start, duration: dropDur, ease: inCubic })
      .to(stamp, { prop: "scale.x", from: 0.96, to: 1, start: start + dropDur, duration: 0.16, ease: outQuad })
      .to(stamp, { prop: "scale.y", from: 0.96, to: 1, start: start + dropDur, duration: 0.16, ease: outQuad })
      .to(stamp, { prop: "rotation", from: rot0 * 3, to: rot0, start, duration: dropDur + 0.08, ease: inCubic });

    if (showRipples) {
      const ring = new Graphics().circle(0, 0, sR).stroke({ color: isLast ? gold : accent, width: Math.max(2, slotR * 0.09) });
      ring.position.set(x, y);
      ring.alpha = 0;
      ring.scale.set(0.8);
      card.addChild(ring);
      const ringAt = start + dropDur;
      const ringGrow = isLast ? 2.1 : 1.6;
      timeline
        .to(ring, { prop: "alpha", from: 0, to: 0.5, start: ringAt, duration: 0.06, ease: outQuad })
        .to(ring, { prop: "alpha", from: 0.5, to: 0, start: ringAt + 0.06, duration: 0.38, ease: outQuad })
        .to(ring, { prop: "scale.x", from: 0.8, to: ringGrow, start: ringAt, duration: 0.44, ease: outCubic })
        .to(ring, { prop: "scale.y", from: 0.8, to: ringGrow, start: ringAt, duration: 0.44, ease: outCubic });
    }
  }

  // --- Shine sweep across the card face (decorative) ---
  if (showShine) {
    const shineMask = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(0xffffff);
    card.addChild(shineMask);
    const shine = new Graphics().rect(-cardW * 0.09, -cardH * 0.9, cardW * 0.18, cardH * 1.8).fill({ color: 0xffffff, alpha: 0.16 });
    shine.rotation = -0.35;
    shine.position.set(-cardW * 0.75, 0);
    shine.mask = shineMask;
    card.addChild(shine);
    timeline.to(shine, { prop: "x", from: -cardW * 0.75, to: cardW * 0.75, start: SHINE_AT, duration: 0.6, ease: outCubic });
  }

  return { timeline, duration: DURATION };
}

export const loyaltyCard: TemplateDefinition = {
  id: "loyalty-card",
  name: "Loyalty Card",
  tagline: "A punch card fills stamp by stamp until the reward ribbon slides free.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.85,
  fontRoles: { brand: "display", rewardText: "display" },
  palettes: PALETTES,
  fields: [
    { key: "brand", type: "text", label: "Brand", default: "Bloom Coffee", maxLength: 24, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "Buy 8, get 1 free", maxLength: 32, optional: true },
    { key: "rewardText", type: "text", label: "Reward line", default: "Free reward unlocked!", maxLength: 30, shrinkToFit: true },
    { key: "showRipples", type: "toggle", label: "Stamp ripples", default: true },
    { key: "showShine", type: "toggle", label: "Shine sweep", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "cardColor", type: "color", label: "Card", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Stamps", default: "", optional: true },
  ],
  build,
};

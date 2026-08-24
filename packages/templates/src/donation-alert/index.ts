import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outCubic,
  spring,
  safeZone,
  TRANSPARENT_BG,
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
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A stream tip/donation alert that slides in from the side with a heart badge
// and a little coin pop. Only the full-frame `bg` rect is tied to the
// background field (defaults to the transparent sentinel so it composites
// straight onto footage); the card uses its own palette-only `cardBg` (with a
// soft shadow) so the alert survives once the canvas fill is gone. `onAccent`
// is a fixed, contrast-checked color for the glyph on the `accent` badge.
const PALETTES: Palette[] = [
  { id: "warm", name: "Warm", colors: { cardBg: "#FFFFFF", textColor: "#2A1B06", muted: "#7A6248", accent: "#C2410C", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { cardBg: "#1E1B24", textColor: "#FFFFFF", muted: "#A79BB0", accent: "#F2B441", onAccent: "#151016" } },
  { id: "berry", name: "Berry", colors: { cardBg: "#FFFFFF", textColor: "#3A0A28", muted: "#8A6478", accent: "#B01D5C", onAccent: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { cardBg: "#FFFFFF", textColor: "#08221A", muted: "#4F6960", accent: "#0F7A55", onAccent: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#2A1B06"));
  const muted = pc("muted", "#7A6248");
  const accent = str(values.accent, pc("accent", "#C2410C"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const name = str(values.name, "Sam");
  const amount = str(values.amount, "$5");
  const message = str(values.message, "Keep up the great work!");
  const showCoins = values.showCoins !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const badgeR = Math.round(minDim * 0.05);
  const padX = Math.round(minDim * 0.03);
  const padY = Math.round(minDim * 0.026);
  const gapBT = Math.round(minDim * 0.024);
  const rowGap = Math.round(minDim * 0.008);

  const headline = `${name} tipped ${amount}!`;
  const maxTextW = Math.max(120, w * 0.44);
  const headlineSize = fitSize(fonts, headline, "display", 700, Math.round(minDim * 0.036), maxTextW);
  const msgSize = message.length > 0 ? fitSize(fonts, message, "body", 500, Math.round(minDim * 0.024), maxTextW) : 0;

  const headlineW = fonts.measure(headline, { family: fonts.family("display"), weight: 700, size: headlineSize });
  const msgW = message.length > 0 ? fonts.measure(message, { family: fonts.family("body"), weight: 500, size: msgSize }) : 0;
  const textBlockW = Math.max(headlineW, msgW);

  const textRowsH = message.length > 0 ? headlineSize + rowGap + msgSize : headlineSize;
  const contentH = Math.max(badgeR * 2, textRowsH);
  const cardW = padX * 2 + badgeR * 2 + gapBT + textBlockW;
  const cardH = padY * 2 + contentH;
  const cardRadius = Math.round(minDim * 0.022);

  const margin = Math.round(minDim * 0.03);
  const restX = zone.left + margin + cardW / 2;
  const restY = h - zone.bottom - margin - cardH / 2;
  const startX = -cardW / 2 - minDim * 0.04;

  const card = new Container();
  card.position.set(startX, restY);
  card.alpha = 0;
  root.addChild(card);

  const e = Math.round(cardRadius * 0.3);
  const shOff = Math.round(cardRadius * 0.5);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - e, -cardH / 2 - e + shOff, cardW + e * 2, cardH + e * 2, cardRadius + e)
      .fill({ color: "#000000", alpha: 0.2 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(cardBg));

  // --- Heart badge (accent) that pops. ---
  const badgeCX = -cardW / 2 + padX + badgeR;
  const badge = new Container();
  badge.position.set(badgeCX, 0);
  badge.scale.set(0);
  card.addChild(badge);
  badge.addChild(new Graphics().circle(0, 0, badgeR).fill(accent));
  badge.addChild(makeIcon("heart", badgeR * 1.05, { color: onAccent }));

  // --- Text column. ---
  const textX = -cardW / 2 + padX + badgeR * 2 + gapBT;
  const headlineY = message.length > 0 ? -textRowsH / 2 + headlineSize / 2 : 0;
  const msgY = message.length > 0 ? textRowsH / 2 - msgSize / 2 : 0;

  const headlineText = makeText(fonts, { text: headline, role: "display", weight: 700, size: headlineSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  headlineText.position.set(textX, headlineY);
  card.addChild(headlineText);

  if (message.length > 0) {
    const msgText = makeText(fonts, { text: message, role: "body", weight: 500, size: msgSize, color: muted, anchor: { x: 0, y: 0.5 } });
    msgText.position.set(textX, msgY);
    card.addChild(msgText);
  }

  // --- Little coins/hearts popping outward from the badge (toggleable). ---
  const coins: { g: Graphics; ang: number; dist: number; delay: number; spin: number }[] = [];
  if (showCoins) {
    const N = 10;
    for (let i = 0; i < N; i++) {
      const s = minDim * rng.range(0.012, 0.022);
      const g = rng.next() < 0.5 ? makeIcon("star", s, { color: accent }) : new Graphics().circle(0, 0, s * 0.5).fill(accent);
      g.position.set(badgeCX, 0);
      g.visible = false;
      card.addChild(g);
      coins.push({
        g,
        ang: -Math.PI / 2 + rng.range(-1.1, 1.1),
        dist: badgeR * rng.range(1.2, 2.2),
        delay: rng.range(0, 0.14),
        spin: rng.range(-3.5, 3.5),
      });
    }
  }

  // --- Entrance: card slides in from the left, badge pops, coins burst. ---
  const enterStart = 0.1;
  const enterDur = 0.55;
  timeline
    .to(card, { prop: "x", from: startX, to: restX, start: enterStart, duration: enterDur, ease: outExpo })
    .to(card, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.3, ease: outQuad });

  const BADGE_POP = enterStart + enterDur * 0.7;
  const BADGE_DUR = 0.5;
  timeline
    .to(badge, { prop: "scale.x", from: 0, to: 1, start: BADGE_POP, duration: BADGE_DUR, ease: spring(0.42) })
    .to(badge, { prop: "scale.y", from: 0, to: 1, start: BADGE_POP, duration: BADGE_DUR, ease: spring(0.42) });

  const BURST = BADGE_POP + BADGE_DUR - 0.1;
  const COIN_LIFE = 0.7;
  const update = (t: number): void => {
    if (!showCoins) return;
    for (const c of coins) {
      const tau = t - BURST - c.delay;
      if (tau < 0 || tau > COIN_LIFE) {
        c.g.visible = false;
        continue;
      }
      const p = clamp01(tau / COIN_LIFE);
      const grow = outCubic(p);
      c.g.visible = true;
      c.g.x = badgeCX + Math.cos(c.ang) * c.dist * grow;
      c.g.y = Math.sin(c.ang) * c.dist * grow - minDim * 0.04 * p;
      c.g.rotation = c.spin * p;
      c.g.alpha = 1 - p;
    }
  };

  return { timeline, duration: 4.2, update };
}

export const donationAlert: TemplateDefinition = {
  id: "donation-alert",
  name: "Donation Alert",
  tagline: "A tip alert slides in from the side with a heart badge and coin pop.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { name: "display", message: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Sam", maxLength: 24, shrinkToFit: true },
    { key: "amount", type: "text", label: "Amount", default: "$5", maxLength: 10, shrinkToFit: true },
    { key: "message", type: "text", label: "Message", default: "Keep up the great work!", maxLength: 48, optional: true, shrinkToFit: true },
    { key: "showCoins", type: "toggle", label: "Coin pop", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outExpo,
  outQuint,
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
import { groupThousands, parseTargetNumber } from "../shared/format";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

/** A teardrop flame silhouette — pointy tip up, round base — centered near (0,0). */
function flameShape(g: Graphics, s: number, color: string): void {
  g.moveTo(0, -0.52 * s)
    .bezierCurveTo(0.05 * s, -0.32 * s, 0.34 * s, -0.24 * s, 0.36 * s, 0.06 * s)
    .bezierCurveTo(0.37 * s, 0.28 * s, 0.2 * s, 0.46 * s, 0, 0.46 * s)
    .bezierCurveTo(-0.2 * s, 0.46 * s, -0.37 * s, 0.28 * s, -0.36 * s, 0.06 * s)
    .bezierCurveTo(-0.34 * s, -0.24 * s, -0.05 * s, -0.32 * s, 0, -0.52 * s)
    .closePath()
    .fill(color);
}

// cardColor / labelColor / onAccent / tickEmpty / flame / flameInner are
// palette-only roles so the card surface, muted labels and the semantic warm
// flame stay legible whatever background/text/accent the user picks.
const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EC", cardColor: "#FFFFFF", textColor: "#2A1508", labelColor: "#77543E", accent: "#C2380F", onAccent: "#FFFFFF", tickEmpty: "#F3E3D7", flame: "#FF6B2C", flameInner: "#FFC93C" } },
  { id: "daybreak", name: "Daybreak", colors: { background: "#EEF3FF", cardColor: "#FFFFFF", textColor: "#0B1F4D", labelColor: "#45557E", accent: "#2A5AD6", onAccent: "#FFFFFF", tickEmpty: "#E3EAF8", flame: "#FF6B2C", flameInner: "#FFC93C" } },
  { id: "matcha", name: "Matcha", colors: { background: "#E9F7F0", cardColor: "#FFFFFF", textColor: "#08221A", labelColor: "#3E6153", accent: "#0F7A3D", onAccent: "#FFFFFF", tickEmpty: "#DDEEE4", flame: "#FF6B2C", flameInner: "#FFC93C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#12131A", cardColor: "#1D1F2A", textColor: "#F5F6FA", labelColor: "#A6ACBD", accent: "#FFB020", onAccent: "#241505", tickEmpty: "#2B2E3C", flame: "#FF8A3D", flameInner: "#FFD34D" } },
];

const DAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

const COUNT_START = 0.6;
const COUNT_END = 1.7;
const TICKS_START = 1.9;
const TICK_STAGGER = 0.12;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF4EC"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#2A1508"));
  const labelColor = pc("labelColor", "#77543E");
  const accent = str(values.accent, pc("accent", "#C2380F"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const tickEmpty = pc("tickEmpty", "#F3E3D7");
  const flameColor = str(values.flameColor, pc("flame", "#FF6B2C"));
  const flameInner = pc("flameInner", "#FFC93C");

  const target = Math.max(1, Math.round(parseTargetNumber(str(values.streak, "47")) || 47));
  const label = str(values.label, "DAY STREAK");
  const message = str(values.message, "Longest run yet — keep it going!");
  const showGlow = on(values.showGlow);
  const showDays = on(values.showDays);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // Flicker phases — drawn up-front so toggles don't reshuffle the stream.
  const ph1 = rng.range(0, Math.PI * 2);
  const ph2 = rng.range(0, Math.PI * 2);
  const ph3 = rng.range(0, Math.PI * 2);

  // --- Vertical rhythm (all fractions of the card width) ---
  const ratio = showDays ? 1.17 : 0.97;
  const cardW = Math.min(safe.width * 0.88, minDim * 0.72, (safe.height * 0.96) / ratio);

  const padTop = cardW * 0.095;
  const flameS = cardW * 0.3;
  const flameBlock = flameS * 1.12;
  const gap1 = cardW * 0.035;
  const finalCount = groupThousands(target);
  const numSize = fitSize(fonts, finalCount, "display", 700, Math.round(cardW * 0.21), cardW * 0.78);
  const numBlock = numSize * 1.04;
  const gapNL = cardW * 0.014;
  const labelSize = fitSize(fonts, label, "body", 600, Math.round(cardW * 0.042), cardW * 0.8);
  const labelBlock = labelSize * 1.25;
  const gap2 = cardW * 0.065;
  const tickD = cardW * 0.088;
  const letterSize = Math.round(cardW * 0.03);
  const tickBlock = showDays ? tickD + cardW * 0.018 + letterSize * 1.15 : 0;
  const gap3 = showDays ? cardW * 0.06 : 0;
  const msgSize = fitSize(fonts, message, "body", 500, Math.round(cardW * 0.04), cardW * 0.82);
  const msgBlock = msgSize * 1.3;
  const padBottom = cardW * 0.095;

  const cardH =
    padTop + flameBlock + gap1 + numBlock + gapNL + labelBlock + gap2 + tickBlock + gap3 + msgBlock + padBottom;
  const cardCy = safe.y + safe.height / 2;

  // --- Card ---
  const card = new Container();
  card.position.set(cx, cardCy);
  card.alpha = 0;
  card.scale.set(0.94);
  root.addChild(card);
  const radius = cardW * 0.055;
  const shadow = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill({ color: 0x000000, alpha: 0.14 });
  shadow.position.set(0, cardH * 0.02);
  card.addChild(shadow);
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill(cardColor));
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.35, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.94, to: 1, start: 0, duration: 0.5, ease: makeOutBack(1.4) })
    .to(card, { prop: "scale.y", from: 0.94, to: 1, start: 0, duration: 0.5, ease: makeOutBack(1.4) });

  let cursor = -cardH / 2 + padTop;

  // --- Flame (glow + outer teardrop + inner flame, gentle flicker) ---
  const flameCy = cursor + flameBlock * 0.54;
  if (showGlow) {
    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = flameColor;
    const gs = (cardW * 0.62) / 256;
    glow.scale.set(gs * 0.7);
    glow.alpha = 0;
    glow.position.set(0, flameCy);
    card.addChild(glow);
    timeline
      .to(glow, { prop: "alpha", from: 0, to: 0.5, start: 0.18, duration: 0.5, ease: outQuad })
      .to(glow, { prop: "scale.x", from: gs * 0.7, to: gs, start: 0.18, duration: 0.6, ease: outCubic })
      .to(glow, { prop: "scale.y", from: gs * 0.7, to: gs, start: 0.18, duration: 0.6, ease: outCubic });
  }

  const flamePop = new Container();
  flamePop.position.set(0, flameCy);
  flamePop.scale.set(0);
  card.addChild(flamePop);
  const flameSway = new Container();
  flamePop.addChild(flameSway);
  const outerG = new Graphics();
  flameShape(outerG, flameS, flameColor);
  flameSway.addChild(outerG);
  const innerSway = new Container();
  innerSway.position.set(0, flameS * 0.14);
  const innerG = new Graphics();
  flameShape(innerG, flameS * 0.52, flameInner);
  innerSway.addChild(innerG);
  flameSway.addChild(innerSway);
  timeline
    .to(flamePop, { prop: "scale.x", from: 0, to: 1, start: 0.25, duration: 0.55, ease: makeOutBack(1.7) })
    .to(flamePop, { prop: "scale.y", from: 0, to: 1, start: 0.25, duration: 0.55, ease: makeOutBack(1.7) });
  cursor += flameBlock + gap1;

  // --- Big streak count (ticks up in update) ---
  const numCy = cursor + numBlock * 0.5;
  const numText = makeText(fonts, { text: "0", role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5 });
  numText.position.set(0, numCy);
  numText.alpha = 0;
  card.addChild(numText);
  timeline
    .to(numText, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.3, ease: outQuad })
    .to(numText, { prop: "y", from: numCy + 12, to: numCy, start: 0.5, duration: 0.45, ease: outQuint })
    .to(numText, { prop: "scale.x", from: 1, to: 1.07, start: COUNT_END, duration: 0.14, ease: outQuad })
    .to(numText, { prop: "scale.y", from: 1, to: 1.07, start: COUNT_END, duration: 0.14, ease: outQuad })
    .to(numText, { prop: "scale.x", from: 1.07, to: 1, start: COUNT_END + 0.14, duration: 0.3, ease: outCubic })
    .to(numText, { prop: "scale.y", from: 1.07, to: 1, start: COUNT_END + 0.14, duration: 0.3, ease: outCubic });
  cursor += numBlock + gapNL;

  // --- Label ---
  const labelCy = cursor + labelBlock * 0.5;
  const labelText = makeText(fonts, { text: label, role: "body", weight: 600, size: labelSize, color: labelColor, anchor: 0.5, letterSpacing: 2 });
  labelText.position.set(0, labelCy);
  labelText.alpha = 0;
  card.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: 0.72, duration: 0.4, ease: outQuad })
    .to(labelText, { prop: "y", from: labelCy + 10, to: labelCy, start: 0.72, duration: 0.4, ease: outQuint });
  cursor += labelBlock + gap2;

  // --- Last-7-days tick row ---
  if (showDays) {
    const n = 7;
    const tickGap = cardW * 0.028;
    const rowW = n * tickD + (n - 1) * tickGap;
    const rowLeft = -rowW / 2;
    const tickCy = cursor + tickD / 2;
    for (let i = 0; i < n; i++) {
      const tcx = rowLeft + tickD / 2 + i * (tickD + tickGap);
      card.addChild(new Graphics().circle(tcx, tickCy, tickD / 2).fill(tickEmpty));

      const disc = new Container();
      disc.position.set(tcx, tickCy);
      disc.scale.set(0);
      disc.addChild(new Graphics().circle(0, 0, tickD / 2).fill(accent));
      const check = makeIcon("check", tickD * 0.52, { color: onAccent });
      check.scale.set(0);
      disc.addChild(check);
      card.addChild(disc);

      const start = TICKS_START + i * TICK_STAGGER;
      timeline
        .to(disc, { prop: "scale.x", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(2) })
        .to(disc, { prop: "scale.y", from: 0, to: 1, start, duration: 0.42, ease: makeOutBack(2) })
        .to(check, { prop: "scale.x", from: 0, to: 1, start: start + 0.08, duration: 0.36, ease: makeOutBack(2.2) })
        .to(check, { prop: "scale.y", from: 0, to: 1, start: start + 0.08, duration: 0.36, ease: makeOutBack(2.2) });

      const letter = makeText(fonts, { text: DAY_LETTERS[i]!, role: "body", weight: 600, size: letterSize, color: labelColor, anchor: 0.5 });
      letter.position.set(tcx, tickCy + tickD / 2 + cardW * 0.018 + letterSize * 0.55);
      letter.alpha = 0;
      card.addChild(letter);
      timeline.to(letter, { prop: "alpha", from: 0, to: 1, start: start + 0.05, duration: 0.3, ease: outQuad });

      // "Today" ring on the last tick.
      if (i === n - 1) {
        const ringW = Math.max(2.5, tickD * 0.09);
        const ring = new Graphics().circle(0, 0, tickD / 2 + ringW * 1.1).stroke({ color: accent, width: ringW });
        ring.position.set(tcx, tickCy);
        ring.alpha = 0;
        ring.scale.set(1.3);
        card.addChild(ring);
        timeline
          .to(ring, { prop: "alpha", from: 0, to: 1, start: 2.95, duration: 0.25, ease: outQuad })
          .to(ring, { prop: "scale.x", from: 1.3, to: 1, start: 2.95, duration: 0.4, ease: outCubic })
          .to(ring, { prop: "scale.y", from: 1.3, to: 1, start: 2.95, duration: 0.4, ease: outCubic });
      }
    }
    cursor += tickBlock + gap3;
  }

  // --- Message ---
  const msgCy = cursor + msgBlock * 0.5;
  const msgText = makeText(fonts, { text: message, role: "body", weight: 500, size: msgSize, color: labelColor, anchor: 0.5 });
  msgText.position.set(0, msgCy);
  msgText.alpha = 0;
  card.addChild(msgText);
  timeline
    .to(msgText, { prop: "alpha", from: 0, to: 1, start: 3.1, duration: 0.4, ease: outQuad })
    .to(msgText, { prop: "y", from: msgCy + 10, to: msgCy, start: 3.1, duration: 0.4, ease: outExpo });

  // --- Pure per-frame hook: count-up + gentle flame flicker ---
  const update = (t: number): void => {
    const u = clamp01((t - COUNT_START) / (COUNT_END - COUNT_START));
    const eased = 1 - Math.pow(1 - u, 3);
    numText.text = groupThousands(Math.round(target * eased));

    const e = clamp01((t - 1.0) / 0.5) * 0.028;
    const mix = 0.6 * Math.sin(t * 9.7 + ph1) + 0.4 * Math.sin(t * 15.3 + ph2);
    flameSway.scale.y = 1 + e * mix;
    flameSway.scale.x = 1 - e * 0.7 * mix;
    flameSway.rotation = e * 1.3 * Math.sin(t * 6.1 + ph3);
    innerSway.scale.y = 1 + e * 1.6 * Math.sin(t * 12.4 + ph2);
  };

  return { timeline, duration: DURATION, update };
}

export const streakFlame: TemplateDefinition = {
  id: "streak-flame",
  name: "Streak Counter",
  tagline: "A flame flickers to life, the day count ticks up, and the last seven days check in.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { streak: "display", label: "body", message: "body" },
  palettes: PALETTES,
  fields: [
    { key: "streak", type: "text", label: "Streak (days)", default: "47", maxLength: 6 },
    { key: "label", type: "text", label: "Label", default: "DAY STREAK", maxLength: 24, shrinkToFit: true },
    { key: "message", type: "text", label: "Message", default: "Longest run yet — keep it going!", maxLength: 48, shrinkToFit: true },
    { key: "showDays", type: "toggle", label: "Last-7-days row", default: true },
    { key: "showGlow", type: "toggle", label: "Flame glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "flameColor", type: "color", label: "Flame", default: "", optional: true },
  ],
  build,
};

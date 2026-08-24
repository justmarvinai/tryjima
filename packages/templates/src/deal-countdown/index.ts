import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Parse a small non-negative integer from a string field. */
function toInt(v: unknown, fallback: number): number {
  const n = parseInt(str(v, ""), 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const pad2 = (v: number): string => (v < 10 ? "0" + String(v) : String(v));

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#C2380F", textColor: "#14140F", onAccent: "#FFFFFF", muted: "#6B6B60" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", muted: "#6A5E85" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", muted: "#5A6A82" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", muted: "#8A93A0" } },
];

const DUR = 4.5;
const ROLL_SECONDS = 0.22;

/** Largest size ≤ size0 (down to minSize) at which `text` fits `maxWidth` on one line. */
function fitOneLine(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  minSize = 12,
): number {
  const family = fonts.family(role);
  let size = size0;
  while (size > minSize && fonts.measure(text, { family, weight, size }) > maxWidth) size -= 1;
  return size;
}

function cardWidthFor(aspect: Aspect, w: number): number {
  switch (aspect) {
    case "16:9":
      return Math.min(w * 0.4, 780);
    case "1:1":
      return w * 0.74;
    case "4:5":
      return w * 0.8;
    case "9:16":
      return w * 0.86;
  }
}

interface TileState {
  text: string;
  squash: number;
}

/**
 * Pure countdown-tile state: given the seconds still `remaining` (itself a
 * pure function of t), decide the digit pair to show and a squash factor that
 * mimics a mechanical roll in the final ROLL_SECONDS before each tick down.
 * No wall clock — everything derives from `remaining`.
 */
function tileState(remaining: number, period: number, mod: number): TileState {
  const raw = remaining / period;
  const curInt = Math.floor(raw);
  const unitValue = ((curInt % mod) + mod) % mod;
  const fracRaw = raw - curInt;
  const timeToNext = fracRaw * period;
  if (timeToNext >= ROLL_SECONDS) {
    return { text: pad2(unitValue), squash: 1 };
  }
  const flipLocal = 1 - timeToNext / ROLL_SECONDS;
  const prevValue = ((curInt + 1) % mod + mod) % mod;
  const text = flipLocal < 0.5 ? pad2(prevValue) : pad2(unitValue);
  return { text, squash: Math.abs(Math.cos(flipLocal * Math.PI)) };
}

interface TileRef {
  inner: Container;
  digit: Text;
  period: number;
  mod: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#C2380F"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const muted = pc("muted", "#6B6B60");
  const tileColor = bg; // an inset shade of the page, distinct from the card

  const kicker = str(values.kicker, "LIMITED-TIME DEAL").toUpperCase();
  const percent = str(values.percent, "40% OFF");
  const price = str(values.price, "$59");
  const oldPriceRaw = typeof values.oldPrice === "string" ? values.oldPrice.trim() : "";
  const cta = str(values.cta, "Shop the deal");
  const showPulse = values.showPulse !== false;

  const startTotal =
    toInt(values.startHours, 1) * 3600 + toInt(values.startMinutes, 30) * 60 + toInt(values.startSeconds, 0);

  const W = size.width;
  const H = size.height;

  const bgRect = new Graphics().rect(0, 0, W, H).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Card metrics + a top-to-bottom content walk (mirrors price-card) ---
  const Wc = cardWidthFor(ctx.aspect, W);
  const pad = Wc * 0.09;
  const kickerSize = Math.round(Wc * 0.042);
  const percentSize = Math.round(Wc * 0.2);
  const priceSize = Math.round(Wc * 0.1);
  const oldSize = Math.round(priceSize * 0.5);
  const ctaSize = Math.round(Wc * 0.062);
  const ctaH = ctaSize * 2.0;

  const gap1 = Wc * 0.05;
  const gap2 = Wc * 0.038;
  const gap3 = Wc * 0.058;
  const gap4 = Wc * 0.058;

  const colonFrac = 0.34;
  const availW = Wc - pad * 2;
  const tileW = availW / (3 + 2 * colonFrac);
  const tileH = tileW * 1.05;
  const numSize = Math.round(tileW * 0.42);
  const unitSize = Math.round(tileW * 0.15);
  const tileR = tileW * 0.16;

  let y = pad * 1.1;
  const kickerCy = y + kickerSize * 0.5;
  y = kickerCy + kickerSize * 0.5 + gap1;
  const percentCy = y + percentSize * 0.5;
  y = percentCy + percentSize * 0.5 + gap2;
  const priceCy = y + priceSize * 0.5;
  y = priceCy + priceSize * 0.5 + gap3;
  const tileRowCy = y + tileH * 0.5;
  y = tileRowCy + tileH * 0.5 + gap4;
  const ctaCy = y + ctaH * 0.5;
  y = ctaCy + ctaH * 0.5 + pad * 1.1;
  const totalH = y;

  const centerY = ctx.aspect === "9:16" ? 230 + (H - 230 - 410) / 2 : H / 2;
  const card = new Container();
  card.pivot.set(Wc / 2, totalH / 2);
  card.position.set(W / 2, centerY);
  card.scale.set(0.87);
  card.alpha = 0;
  root.addChild(card);

  const shadow = new Graphics().roundRect(0, 0, Wc, totalH, Wc * 0.05).fill({ color: 0x000000, alpha: 0.12 });
  shadow.position.set(0, totalH * 0.02);
  card.addChild(shadow);
  card.addChild(new Graphics().roundRect(0, 0, Wc, totalH, Wc * 0.05).fill(cardColor));

  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.35, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.87, to: 1, start: 0.15, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.87, to: 1, start: 0.15, duration: 0.7, ease: spring(0.5) });

  // --- Kicker ---
  const kickerText = makeText(fonts, { text: kicker, role: "body", weight: 600, size: kickerSize, color: muted, anchor: 0.5, letterSpacing: 2 });
  kickerText.position.set(Wc / 2, kickerCy);
  kickerText.alpha = 0;
  card.addChild(kickerText);
  timeline
    .to(kickerText, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.4, ease: outQuad })
    .to(kickerText, { prop: "y", from: kickerCy + 10, to: kickerCy, start: 0.55, duration: 0.45, ease: outQuint });

  // --- Big deal percent ---
  const percentFit = fitOneLine(fonts, percent, "display", 700, percentSize, Wc - pad * 2, 24);
  const percentText = makeText(fonts, { text: percent, role: "display", weight: 700, size: percentFit, color: textColor, anchor: 0.5 });
  percentText.position.set(Wc / 2, percentCy);
  percentText.alpha = 0;
  percentText.scale.set(0.7);
  card.addChild(percentText);
  timeline
    .to(percentText, { prop: "alpha", from: 0, to: 1, start: 0.75, duration: 0.35, ease: outQuad })
    .to(percentText, { prop: "scale.x", from: 0.7, to: 1, start: 0.75, duration: 0.6, ease: spring(0.42) })
    .to(percentText, { prop: "scale.y", from: 0.7, to: 1, start: 0.75, duration: 0.6, ease: spring(0.42) });

  // --- Price row (with a strike-through old price) ---
  const priceText = makeText(fonts, { text: price, role: "display", weight: 700, size: priceSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  let priceGroupW = priceText.width;
  const showOld = oldPriceRaw.length > 0;
  let oldNode: Container | null = null;
  if (showOld) {
    const oldText = makeText(fonts, { text: oldPriceRaw, role: "display", weight: 600, size: oldSize, color: muted, anchor: { x: 0, y: 0.5 } });
    const gapOld = priceSize * 0.28;
    oldText.position.set(priceGroupW + gapOld, priceSize * 0.03);
    const strikeH = Math.max(2, oldSize * 0.08);
    const oldC = new Container();
    oldC.addChild(oldText);
    oldC.addChild(new Graphics().roundRect(priceGroupW + gapOld, priceSize * 0.03 - strikeH / 2, oldText.width, strikeH, strikeH / 2).fill(muted));
    oldNode = oldC;
    priceGroupW += gapOld + oldText.width;
  }
  const priceGroup = new Container();
  priceGroup.addChild(priceText);
  if (oldNode) priceGroup.addChild(oldNode);
  priceGroup.position.set(Wc / 2 - priceGroupW / 2, priceCy);
  priceGroup.alpha = 0;
  card.addChild(priceGroup);
  timeline
    .to(priceGroup, { prop: "alpha", from: 0, to: 1, start: 1.05, duration: 0.35, ease: outQuad })
    .to(priceGroup, { prop: "scale.x", from: 1.12, to: 1, start: 1.05, duration: 0.5, ease: outExpo })
    .to(priceGroup, { prop: "scale.y", from: 1.12, to: 1, start: 1.05, duration: 0.5, ease: outExpo });

  // --- Countdown tiles: HH : MM : SS ---
  const UNITS: { label: string; period: number; mod: number }[] = [
    { label: "HRS", period: 3600, mod: 100 },
    { label: "MIN", period: 60, mod: 60 },
    { label: "SEC", period: 1, mod: 60 },
  ];
  const rowW = tileW * 3 + tileW * colonFrac * 2;
  const rowLeft = Wc / 2 - rowW / 2;
  const tiles: TileRef[] = [];

  UNITS.forEach((u, i) => {
    const tileCx = rowLeft + tileW / 2 + i * tileW * (1 + colonFrac);

    // Outer: the entrance pop (timeline-driven; settles and holds at 1).
    const outer = new Container();
    outer.position.set(tileCx, tileRowCy);
    outer.scale.set(0);
    card.addChild(outer);
    const start = 1.35 + i * 0.12;
    timeline
      .to(outer, { prop: "scale.x", from: 0, to: 1, start, duration: 0.55, ease: spring(0.45) })
      .to(outer, { prop: "scale.y", from: 0, to: 1, start, duration: 0.55, ease: spring(0.45) });

    // Inner: the ongoing per-second roll squash (update()-driven every frame,
    // independent of the entrance tween above).
    const inner = new Container();
    outer.addChild(inner);
    inner.addChild(new Graphics().roundRect(-tileW / 2, -tileH / 2, tileW, tileH, tileR).fill(tileColor));
    const digit = makeText(fonts, { text: "00", role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5 });
    digit.position.set(0, -tileH * 0.08);
    inner.addChild(digit);
    const unitLabel = makeText(fonts, { text: u.label, role: "body", weight: 600, size: unitSize, color: muted, anchor: 0.5, letterSpacing: 1 });
    unitLabel.position.set(0, tileH * 0.32);
    inner.addChild(unitLabel);

    tiles.push({ inner, digit, period: u.period, mod: u.mod });

    if (i < UNITS.length - 1) {
      const colonX = tileCx + tileW / 2 + (tileW * colonFrac) / 2;
      const colon = makeText(fonts, { text: ":", role: "display", weight: 700, size: Math.round(numSize * 0.9), color: textColor, anchor: 0.5 });
      colon.position.set(colonX, tileRowCy - tileH * 0.06);
      colon.alpha = 0;
      card.addChild(colon);
      timeline.to(colon, { prop: "alpha", from: 0, to: 0.8, start: start + 0.15, duration: 0.35, ease: outQuad });
    }
  });

  // --- CTA pill (pulses when showPulse is on) ---
  const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
  const ctaW = Math.min(Wc - pad * 2, ctaLabel.width + ctaSize * 1.7);
  const ctaC = new Container();
  ctaC.addChild(new Graphics().roundRect(-ctaW / 2, -ctaH / 2, ctaW, ctaH, ctaH / 2).fill(accent));
  ctaC.addChild(ctaLabel);
  ctaC.position.set(Wc / 2, ctaCy);
  ctaC.scale.set(0);
  card.addChild(ctaC);
  timeline
    .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: 1.9, duration: 0.6, ease: spring(0.42) })
    .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: 1.9, duration: 0.6, ease: spring(0.42) });

  if (showPulse) {
    const cycle = [2.75, 3.4];
    for (const t0 of cycle) {
      timeline
        .to(ctaC, { prop: "scale.x", from: 1, to: 1.06, start: t0, duration: 0.24, ease: outQuad })
        .to(ctaC, { prop: "scale.x", from: 1.06, to: 1, start: t0 + 0.24, duration: 0.3, ease: outQuad })
        .to(ctaC, { prop: "scale.y", from: 1, to: 1.06, start: t0, duration: 0.24, ease: outQuad })
        .to(ctaC, { prop: "scale.y", from: 1.06, to: 1, start: t0 + 0.24, duration: 0.3, ease: outQuad });
    }
  }

  // Countdown digits + roll squash — a pure function of t, no wall clock.
  const update = (t: number): void => {
    const remaining = Math.max(0, startTotal - t);
    for (const tile of tiles) {
      const st = tileState(remaining, tile.period, tile.mod);
      if (tile.digit.text !== st.text) tile.digit.text = st.text;
      tile.inner.scale.y = st.squash;
    }
  };

  return { timeline, duration: DUR, update };
}

export const dealCountdown: TemplateDefinition = {
  id: "deal-countdown",
  name: "Deal Countdown",
  tagline: "A deal card with a live rolling countdown and a pulsing CTA.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { percent: "display", kicker: "body" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "LIMITED-TIME DEAL", maxLength: 24 },
    { key: "percent", type: "text", label: "Deal headline", default: "40% OFF", maxLength: 12, shrinkToFit: true },
    { key: "price", type: "text", label: "Price", default: "$59", maxLength: 12 },
    { key: "oldPrice", type: "text", label: "Old price", default: "$99", maxLength: 12, optional: true },
    { key: "cta", type: "text", label: "Button", default: "Shop the deal", maxLength: 20 },
    { key: "startHours", type: "text", label: "Start hours", default: "01", maxLength: 2, help: "0–99 hours; for longer countdowns use Countdown Timer instead." },
    { key: "startMinutes", type: "text", label: "Start minutes", default: "30", maxLength: 3 },
    { key: "startSeconds", type: "text", label: "Start seconds", default: "00", maxLength: 3 },
    { key: "showPulse", type: "toggle", label: "Pulsing button", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

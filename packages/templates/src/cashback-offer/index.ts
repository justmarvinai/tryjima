import { Container, Graphics } from "pixi.js";
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

// A rewards card: coins drop and bounce over a big "X% back — in rewards".
const PALETTES: Palette[] = [
  { id: "mint", name: "Mint", colors: { background: "#EAF6EF", cardBg: "#FFFFFF", accent: "#0C6B48", textColor: "#0A1F16", muted: "#5C6B62", onAccent: "#FFFFFF" } },
  { id: "amber", name: "Amber", colors: { background: "#FFF6E6", cardBg: "#FFFFFF", accent: "#A8480F", textColor: "#2B1605", muted: "#7A6650", onAccent: "#FFFFFF" } },
  { id: "royal", name: "Royal", colors: { background: "#EEF2FF", cardBg: "#FFFFFF", accent: "#3455E6", textColor: "#0C1330", muted: "#5A6488", onAccent: "#FFFFFF" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#12130F", cardBg: "#1C1E17", accent: "#C7F24A", textColor: "#FFFFFF", muted: "#93A08A", onAccent: "#14161A" } },
];

/** A coin: filled disc + rim + a percent glyph. */
function coin(d: number, accent: string, onAccent: string, fonts: FontRegistry): Container {
  const c = new Container();
  c.addChild(new Graphics().circle(0, 0, d / 2).fill(accent));
  c.addChild(new Graphics().circle(0, 0, d / 2).stroke({ color: onAccent, width: Math.max(2, d * 0.05), alpha: 0.7 }));
  c.addChild(makeText(fonts, { text: "%", role: "display", weight: 700, size: Math.round(d * 0.48), color: onAccent, anchor: 0.5 }));
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EAF6EF"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#0C6B48"));
  const textColor = str(values.textColor, pc("textColor", "#0A1F16"));
  const muted = pc("muted", "#5C6B62");
  const onAccent = pc("onAccent", "#FFFFFF");

  const percent = str(values.percent, "10%");
  const detail = str(values.detail, "in rewards");
  const hasDetail = detail.length > 0;
  const showCoins = values.showCoins !== false;

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
  const padX = minDim * 0.075;
  const padTop = minDim * 0.085;
  const padBot = minDim * 0.08;
  const coinD = minDim * 0.12;
  const coinBandH = showCoins ? coinD * 1.15 : 0;
  const percentSize0 = Math.round(minDim * 0.14);
  const detailSize0 = Math.round(minDim * 0.04);
  const gapCoins = showCoins ? minDim * 0.05 : 0;
  const gapDetail = minDim * 0.025;

  const cardW = Math.min(minDim * 0.74, zone.width * 0.94);
  const innerW = cardW - padX * 2;

  // Fit "PERCENT back" as one baseline group.
  const backWord = "back";
  let percentSize = percentSize0;
  const backRatio = 0.4;
  const gapPB = minDim * 0.02;
  const measureGroup = (ps: number): number => {
    const pw = fonts.measure(percent, { family: fonts.family("display"), weight: 700, size: ps });
    const bw = fonts.measure(backWord, { family: fonts.family("display"), weight: 700, size: Math.round(ps * backRatio) });
    return pw + gapPB + bw;
  };
  while (percentSize > 16 && measureGroup(percentSize) > innerW) percentSize -= 2;
  const backSize = Math.round(percentSize * backRatio);
  const headlineH = percentSize * 1.05;

  const detailSize = hasDetail ? fitSize(fonts, detail, "body", 600, detailSize0, innerW) : 0;
  const detailH = hasDetail ? detailSize * 1.3 : 0;

  const contentH = coinBandH + gapCoins + headlineH + (hasDetail ? gapDetail + detailH : 0);
  const cardH = padTop + contentH + padBot;
  const cardR = minDim * 0.05;

  const cy = zone.y + zone.height / 2;
  const cardTop = cy - cardH / 2;

  // --- Card ---
  const card = new Container();
  card.position.set(cx, cy);
  root.addChild(card);
  const shadow = new Graphics().roundRect(-cardW / 2, -cardH / 2 + minDim * 0.012, cardW, cardH, cardR).fill({ color: 0x000000, alpha: 0.12 });
  card.addChild(shadow);
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg));
  card.alpha = 0;
  card.scale.set(0.9);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.3, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.9, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.9, to: 1, start: 0.1, duration: 0.7, ease: spring(0.5) });

  const coinsCy = cardTop + padTop + coinBandH / 2 - cy;
  const headlineCy = coinsCy + coinBandH / 2 + gapCoins + headlineH / 2;
  const detailCy = headlineCy + headlineH / 2 + gapDetail + detailH / 2;

  // --- Coins drop + bounce ---
  if (showCoins) {
    const nCoins = 4;
    const spacing = coinD * 0.62;
    for (let i = 0; i < nCoins; i++) {
      const restX = (i - (nCoins - 1) / 2) * spacing;
      const cn = coin(coinD, accent, onAccent, fonts);
      cn.position.set(restX, coinsCy);
      cn.alpha = 0;
      card.addChild(cn);
      const start = 0.35 + i * 0.11;
      const fromY = coinsCy - minDim * 0.22;
      timeline
        .to(cn, { prop: "alpha", from: 0, to: 1, start, duration: 0.2, ease: outQuad })
        .to(cn, { prop: "y", from: fromY, to: coinsCy, start, duration: 0.72, ease: spring(0.42) })
        .to(cn, { prop: "rotation", from: (i % 2 === 0 ? -1 : 1) * 0.4, to: 0, start, duration: 0.7, ease: outExpo });
    }
  }

  // --- Headline "PERCENT back" ---
  const groupW = measureGroup(percentSize);
  const groupLeft = -groupW / 2;
  const percentText = makeText(fonts, { text: percent, role: "display", weight: 700, size: percentSize, color: accent, anchor: { x: 0, y: 0.5 } });
  percentText.position.set(groupLeft, headlineCy);
  const backText = makeText(fonts, { text: backWord, role: "display", weight: 700, size: backSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  backText.position.set(groupLeft + percentText.width + gapPB, headlineCy);
  for (const t of [percentText, backText]) {
    t.alpha = 0;
    card.addChild(t);
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: 0.95, duration: 0.35, ease: outQuad })
      .to(t, { prop: "y", from: headlineCy + minDim * 0.02, to: headlineCy, start: 0.95, duration: 0.55, ease: makeOutBack(1.6) });
  }

  // --- Detail ---
  if (hasDetail) {
    const detailText = makeText(fonts, { text: detail, role: "body", weight: 600, size: detailSize, color: muted, anchor: 0.5, align: "center", letterSpacing: 0.5 });
    detailText.position.set(0, detailCy);
    detailText.alpha = 0;
    card.addChild(detailText);
    timeline
      .to(detailText, { prop: "alpha", from: 0, to: 1, start: 1.2, duration: 0.4, ease: outQuad })
      .to(detailText, { prop: "y", from: detailCy + minDim * 0.014, to: detailCy, start: 1.2, duration: 0.5, ease: outExpo });
  }

  return { timeline, duration: 4.0 };
}

export const cashbackOffer: TemplateDefinition = {
  id: "cashback-offer",
  name: "Cashback Offer",
  tagline: "Coins drop and bounce over a big percent-back rewards card.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { percent: "display" },
  palettes: PALETTES,
  fields: [
    { key: "percent", type: "text", label: "Percent", default: "10%", maxLength: 8, shrinkToFit: true },
    { key: "detail", type: "text", label: "Detail", default: "in rewards", maxLength: 24, optional: true, shrinkToFit: true },
    { key: "showCoins", type: "toggle", label: "Coins", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

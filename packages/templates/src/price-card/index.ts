import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  makeOutBack,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const DEG = Math.PI / 180;

const DEFAULT_FEATURES = ["Unlimited exports", "No watermark", "Every aspect ratio", "1080p quality"];

const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F", onAccent: "#FFFFFF", muted: "#6B6B60", divider: "#E7E4DB" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E", onAccent: "#FFFFFF", muted: "#6A5E85", divider: "#E6DEF6" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E", onAccent: "#FFFFFF", muted: "#5A6A82", divider: "#DBE6F3" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF", onAccent: "#14161A", muted: "#98A0AD", divider: "#333A44" } },
];

function computeDuration(values: Values): number {
  const n = Math.max(2, Math.min(5, asItems(values.features, DEFAULT_FEATURES).length));
  return 1.2 + n * 0.4 + 1.2;
}

/** Largest size ≤ size0 (down to minSize) at which `text` fits `maxWidth` on one line. */
function fitOneLine(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  minSize = 14,
): number {
  const family = fonts.family(role);
  let size = size0;
  while (size > minSize && fonts.measure(text, { family, weight, size }) > maxWidth) size -= 1;
  return size;
}

function cardWidthFor(aspect: Aspect, w: number): number {
  switch (aspect) {
    case "16:9":
      return Math.min(w * 0.36, 720);
    case "1:1":
      return w * 0.66;
    case "4:5":
      return w * 0.7;
    case "9:16":
      return w * 0.78;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const muted = pc("muted", "#6B6B60");
  const dividerColor = pc("divider", "#E7E4DB");

  const plan = str(values.plan, "Pro");
  const price = str(values.price, "$0");
  const period = str(values.period, "forever");
  const features = asItems(values.features, DEFAULT_FEATURES).slice(0, 5);
  const cta = str(values.cta, "Get started");
  const badge = str(values.badge, "FREE");

  const W = size.width;
  const H = size.height;
  root.addChild(new Graphics().rect(0, 0, W, H).fill(bg));
  const timeline = new JimaTimeline();

  // --- Card metrics + content walk ---
  const Wc = cardWidthFor(ctx.aspect, W);
  const pad = Wc * 0.09;
  const planSize = Math.round(Wc * 0.072);
  const periodSize = Math.round(Wc * 0.058);
  const hasPeriod = period.length > 0;
  const periodDisplay = period.startsWith("/") ? period : `/${period}`;
  const periodW = hasPeriod ? fonts.measure(periodDisplay, { family: fonts.family("body"), weight: 500, size: periodSize }) + periodSize * 0.35 : 0;
  const priceSize = fitOneLine(fonts, price, "display", 700, Math.round(Wc * 0.19), Wc - pad * 2 - periodW, 40);
  const featBase = Math.round(Wc * 0.055);
  const checkR = featBase * 0.62;
  const featAvailW = Wc - pad * 1.05 - checkR * 2.4 - pad * 0.5;
  let featSize = featBase;
  for (const f of features) featSize = Math.min(featSize, fitOneLine(fonts, f, "body", 500, featBase, featAvailW, 16));
  const rowH = featBase * 1.95;
  const ctaSize = Math.round(Wc * 0.062);
  const ctaLabelSize = fitOneLine(fonts, cta, "display", 700, ctaSize, Wc - pad * 2 - ctaSize * 1.2, 18);
  const ctaH = ctaSize * 2.0;

  let y = pad * 1.15;
  const planCy = y + planSize * 0.5;
  y = planCy + planSize * 0.5 + pad * 0.55;
  const priceCy = y + priceSize * 0.5;
  y = priceCy + priceSize * 0.5 + pad * 0.7;
  const dividerY = y;
  y += pad * 0.7;
  const featTop = y;
  y = featTop + features.length * rowH + pad * 0.5;
  const ctaCy = y + ctaH * 0.5;
  y = ctaCy + ctaH * 0.5 + pad * 1.15;
  const totalH = y;

  const centerY = ctx.aspect === "9:16" ? 220 + (H - 220 - 400) / 2 : H / 2;
  const card = new Container();
  // Local coords run (0,0)→(Wc,totalH); pivot at the center so the spring scales in place.
  card.pivot.set(Wc / 2, totalH / 2);
  card.position.set(W / 2, centerY);
  card.scale.set(0.85);
  card.alpha = 0;
  root.addChild(card);

  const shadow = new Graphics().roundRect(0, 0, Wc, totalH, Wc * 0.05).fill({ color: 0x000000, alpha: 0.12 });
  shadow.position.set(0, totalH * 0.02);
  card.addChild(shadow);
  card.addChild(new Graphics().roundRect(0, 0, Wc, totalH, Wc * 0.05).fill(cardColor));

  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.35, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.85, to: 1, start: 0.15, duration: 0.7, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.85, to: 1, start: 0.15, duration: 0.7, ease: spring(0.5) });

  // --- Plan name ---
  const planText = makeText(fonts, { text: plan, role: "display", weight: 600, size: planSize, color: muted, anchor: 0.5, letterSpacing: 1 });
  planText.position.set(Wc / 2, planCy);
  planText.alpha = 0;
  card.addChild(planText);
  timeline
    .to(planText, { prop: "alpha", from: 0, to: 1, start: 0.6, duration: 0.4, ease: outQuad })
    .to(planText, { prop: "y", from: planCy + 12, to: planCy, start: 0.6, duration: 0.5, ease: outQuint });

  // --- Price + period group (centered) ---
  const priceGroup = new Container();
  const priceText = makeText(fonts, { text: price, role: "display", weight: 700, size: priceSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  priceGroup.addChild(priceText);
  let groupW = priceText.width;
  if (hasPeriod) {
    const periodText = makeText(fonts, { text: periodDisplay, role: "body", weight: 500, size: periodSize, color: muted, anchor: { x: 0, y: 0.5 } });
    periodText.position.set(priceText.width + periodSize * 0.35, priceSize * 0.16);
    priceGroup.addChild(periodText);
    groupW = priceText.width + periodSize * 0.35 + periodText.width;
  }
  priceGroup.position.set(Wc / 2 - groupW / 2, priceCy);
  priceGroup.alpha = 0;
  card.addChild(priceGroup);
  timeline
    .to(priceGroup, { prop: "alpha", from: 0, to: 1, start: 0.8, duration: 0.35, ease: outQuad })
    .to(priceGroup, { prop: "scale.x", from: 1.14, to: 1, start: 0.8, duration: 0.5, ease: outExpo })
    .to(priceGroup, { prop: "scale.y", from: 1.14, to: 1, start: 0.8, duration: 0.5, ease: outExpo });

  // --- Divider ---
  const showDivider = values.divider !== false;
  if (showDivider) {
    const divider = new Graphics().roundRect(0, 0, Wc - pad * 2, Math.max(2, Wc * 0.004), 2).fill(dividerColor);
    divider.pivot.set(0, 0);
    divider.position.set(pad, dividerY);
    divider.scale.set(0, 1);
    card.addChild(divider);
    timeline.to(divider, { prop: "scale.x", from: 0, to: 1, start: 1.0, duration: 0.4, ease: outExpo });
  }

  // --- Feature rows ---
  const rowLeft = pad * 1.05;
  features.forEach((item, i) => {
    const rowCy = featTop + i * rowH + rowH * 0.5;
    const row = new Container();
    row.position.set(rowLeft, rowCy);
    row.alpha = 0;
    card.addChild(row);

    const chip = new Container();
    chip.position.set(checkR, 0);
    chip.addChild(new Graphics().circle(0, 0, checkR).fill(accent));
    chip.addChild(
      new Graphics()
        .poly([-checkR * 0.4, 0, -checkR * 0.1, checkR * 0.35, checkR * 0.45, -checkR * 0.35], false)
        .stroke({ color: onAccent, width: Math.max(2, checkR * 0.2), cap: "round", join: "round" }),
    );
    chip.scale.set(0);
    row.addChild(chip);

    const label = makeText(fonts, { text: item, role: "body", weight: 500, size: featSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    label.position.set(checkR * 2.4, 0);
    row.addChild(label);

    const start = 1.2 + i * 0.4;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(row, { prop: "x", from: rowLeft + 26, to: rowLeft, start, duration: 0.5, ease: outQuint })
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: start + 0.1, duration: 0.4, ease: makeOutBack(2) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: start + 0.1, duration: 0.4, ease: makeOutBack(2) });
  });

  // --- CTA pill ---
  const ctaC = new Container();
  const ctaLabel = makeText(fonts, { text: cta, role: "display", weight: 700, size: ctaLabelSize, color: onAccent, anchor: 0.5 });
  const pillW = Math.min(Wc - pad * 2, ctaLabel.width + ctaSize * 1.5);
  ctaC.addChild(new Graphics().roundRect(-pillW / 2, -ctaH / 2, pillW, ctaH, ctaH / 2).fill(accent));
  ctaC.addChild(ctaLabel);
  ctaC.position.set(Wc / 2, ctaCy);
  ctaC.scale.set(0);
  card.addChild(ctaC);
  const ctaStart = 1.2 + features.length * 0.4 + 0.1;
  timeline
    .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: ctaStart, duration: 0.6, ease: spring(0.45) })
    .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: ctaStart, duration: 0.6, ease: spring(0.45) });

  // --- Optional corner badge (ribbon) ---
  if (badge.length > 0) {
    const badgeSize = Math.round(Wc * 0.044);
    const badgeC = new Container();
    const badgeLabel = makeText(fonts, { text: badge.toUpperCase(), role: "display", weight: 700, size: badgeSize, color: onAccent, anchor: 0.5, letterSpacing: 1 });
    const bW = badgeLabel.width + badgeSize * 1.2;
    const bH = badgeSize * 1.7;
    badgeC.addChild(new Graphics().roundRect(-bW / 2, -bH / 2, bW, bH, bH * 0.32).fill(accent));
    badgeC.addChild(badgeLabel);
    badgeC.position.set(Wc - bW * 0.42, bH * 0.28);
    badgeC.rotation = -8 * DEG;
    badgeC.scale.set(0);
    card.addChild(badgeC);
    timeline
      .to(badgeC, { prop: "scale.x", from: 0, to: 1, start: 0.5, duration: 0.55, ease: makeOutBack(2.2) })
      .to(badgeC, { prop: "scale.y", from: 0, to: 1, start: 0.5, duration: 0.55, ease: makeOutBack(2.2) })
      .to(badgeC, { prop: "rotation", from: -22 * DEG, to: -8 * DEG, start: 0.5, duration: 0.55, ease: outExpo });
  }

  return { timeline, duration: computeDuration(values) };
}

export const priceCard: TemplateDefinition = {
  id: "price-card",
  name: "Price Card",
  tagline: "A pricing card reveals its plan, price and features in turn.",
  category: "product",
  aspects: ["4:5", "1:1", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.0,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "plan", type: "text", label: "Plan", default: "Pro", maxLength: 20 },
    { key: "price", type: "text", label: "Price", default: "$0", maxLength: 12 },
    { key: "period", type: "text", label: "Period", default: "forever", maxLength: 14, optional: true },
    { key: "features", type: "textlist", label: "Features", default: DEFAULT_FEATURES, minItems: 2, maxItems: 5, maxLength: 28 },
    { key: "cta", type: "text", label: "Button", default: "Get started", maxLength: 20 },
    { key: "badge", type: "text", label: "Badge", default: "FREE", maxLength: 12, optional: true },
    { key: "divider", type: "toggle", label: "Divider line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
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

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

/** Relative luminance of a #RRGGBB color (sRGB → linear). */
function hexLum(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0.5;
  const n = parseInt(m[1]!, 16);
  const ch = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch((n >> 16) & 255) + 0.7152 * ch((n >> 8) & 255) + 0.0722 * ch(n & 255);
}
/** Pick black or white ink for legibility on an arbitrary fill (best-effort). */
function readableOn(bg: string): string {
  return hexLum(bg) > 0.42 ? "#111318" : "#FFFFFF";
}

const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FB", cardColor: "#FFFFFF", textColor: "#131722", accent: "#2F5FE0", muted: "#7A8291" } },
  { id: "coral", name: "Coral", colors: { background: "#FFF3EF", cardColor: "#FFFFFF", textColor: "#2A1206", accent: "#E2513C", muted: "#B79A90" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EFFF", cardColor: "#FFFFFF", textColor: "#1E1247", accent: "#6C3CE0", muted: "#9488BE" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0E1017", cardColor: "#1B1F2B", textColor: "#F2F4F8", accent: "#5B8CFF", muted: "#8891A6" } },
];

const DEFAULT_PLANS = [
  "Basic | $0 | 3 projects | Community support | 1 GB storage",
  "Pro | $12 | Unlimited projects | Priority support | 50 GB storage",
  "Team | $29 | Team roles & SSO | Dedicated support | 500 GB storage",
];

interface Plan {
  name: string;
  price: string;
  features: string[];
}

function parsePlan(raw: string, fallback: string): Plan {
  const parts = raw.split("|").map((s) => s.trim());
  const src = parts[0] && parts[0].length ? parts : fallback.split("|").map((s) => s.trim());
  const features = src.slice(2).filter((s) => s.length > 0).slice(0, 3);
  return { name: src[0] ?? "Plan", price: src[1] ?? "$0", features };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FB"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#131722"));
  const accent = str(values.accent, pc("accent", "#2F5FE0"));
  const muted = pc("muted", "#7A8291");

  const title = str(values.title, "Simple, honest pricing");
  const showBadge = values.showBadge !== false;
  const plans = asList(values.plans, DEFAULT_PLANS)
    .slice(0, 3)
    .map((p, i) => parsePlan(p, DEFAULT_PLANS[i] ?? DEFAULT_PLANS[0]!));
  while (plans.length < 3) plans.push(parsePlan(DEFAULT_PLANS[plans.length]!, DEFAULT_PLANS[plans.length]!));

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const cx = w / 2;

  // Title.
  const hasTitle = title.length > 0;
  const titleY = zone.y + minDim * 0.05;
  if (hasTitle) {
    const tSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), zone.width * 0.92);
    const tNode = makeText(fonts, { text: title, role: "display", weight: 700, size: tSize, color: textColor, anchor: 0.5, align: "center" });
    tNode.position.set(cx, titleY);
    tNode.alpha = 0;
    root.addChild(tNode);
    timeline
      .to(tNode, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(tNode, { prop: "y", from: titleY - 14, to: titleY, start: 0, duration: 0.5, ease: outExpo });
  }

  // Card geometry.
  const bandTop = hasTitle ? titleY + minDim * 0.06 : zone.y;
  const bandH = zone.y + zone.height - bandTop;
  const rowW = Math.min(zone.width, w * 0.92);
  const gap = rowW * 0.035;
  const cardW = (rowW - 2 * gap) / 3;
  const cardH = Math.min(cardW * 1.85, bandH * 0.78);
  const rowLeft = cx - rowW / 2;
  const cy = bandTop + bandH / 2;
  const midRise = cardH * 0.05;

  const startTimes = [0.32, 0.56, 0.44]; // left, middle(last-ish), right — middle emphasised

  plans.forEach((plan, i) => {
    const isMid = i === 1;
    const ccx = rowLeft + i * (cardW + gap) + cardW / 2;
    const finalY = cy - (isMid ? midRise : 0);
    const card = new Container();
    card.position.set(ccx, finalY + cardH * 0.14);
    card.alpha = 0;
    card.scale.set(0.92);
    root.addChild(card);

    const r = cardW * 0.09;
    // Shadow.
    card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.03, cardW, cardH, r).fill({ color: "#000000", alpha: isMid ? 0.22 : 0.12 }));
    // Body.
    card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(cardColor));
    // Accent header tint (subtle) + border for the highlighted card.
    if (isMid) {
      card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH * 0.2, r).fill({ color: accent, alpha: 0.14 }));
      card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).stroke({ color: accent, width: Math.max(2, cardW * 0.014) }));
    }

    const pad = cardW * 0.1;
    // Plan name.
    const nameSize = fitSize(fonts, plan.name, "display", 700, Math.round(cardW * 0.13), cardW - pad * 2);
    const nameNode = makeText(fonts, { text: plan.name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    nameNode.position.set(-cardW / 2 + pad, -cardH / 2 + cardH * 0.1);
    card.addChild(nameNode);

    // Price.
    const hasNum = /\d/.test(plan.price);
    const priceSize = fitSize(fonts, plan.price, "display", 700, Math.round(cardW * 0.26), cardW - pad * 2 - (hasNum ? cardW * 0.16 : 0));
    const priceNode = makeText(fonts, { text: plan.price, role: "display", weight: 700, size: priceSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    priceNode.position.set(-cardW / 2 + pad, -cardH / 2 + cardH * 0.28);
    card.addChild(priceNode);
    if (hasNum) {
      const perNode = makeText(fonts, { text: "/mo", role: "body", weight: 600, size: Math.round(cardW * 0.08), color: muted, anchor: { x: 0, y: 1 } });
      perNode.position.set(-cardW / 2 + pad + priceNode.width + cardW * 0.02, -cardH / 2 + cardH * 0.28 + priceSize * 0.42);
      card.addChild(perNode);
    }

    // Divider.
    card.addChild(new Graphics().rect(-cardW / 2 + pad, -cardH / 2 + cardH * 0.42, cardW - pad * 2, Math.max(1, cardH * 0.004)).fill({ color: muted, alpha: 0.3 }));

    // Feature ticks.
    const featTop = -cardH / 2 + cardH * 0.53;
    const featGap = cardH * 0.11;
    const checkSize = cardW * 0.09;
    plan.features.forEach((f, k) => {
      const fy = featTop + k * featGap;
      const badge = new Graphics().circle(0, 0, checkSize * 0.7).fill({ color: accent, alpha: 0.16 });
      badge.position.set(-cardW / 2 + pad + checkSize * 0.7, fy);
      card.addChild(badge);
      const chk = makeIcon("check", checkSize, { color: accent });
      chk.position.set(-cardW / 2 + pad + checkSize * 0.7, fy);
      card.addChild(chk);
      const fSize = fitSize(fonts, f, "body", 500, Math.round(cardW * 0.078), cardW - pad * 2 - checkSize * 1.8);
      const fNode = makeText(fonts, { text: f, role: "body", weight: 500, size: fSize, color: textColor, anchor: { x: 0, y: 0.5 } });
      fNode.position.set(-cardW / 2 + pad + checkSize * 1.7, fy);
      fNode.alpha = 0.92;
      card.addChild(fNode);
    });

    // CTA button.
    const ctaW = cardW - pad * 2;
    const ctaH = cardH * 0.12;
    const ctaY = cardH / 2 - cardH * 0.11;
    const ctaLabel = isMid ? "Get started" : "Choose plan";
    if (isMid) {
      card.addChild(new Graphics().roundRect(-ctaW / 2, ctaY - ctaH / 2, ctaW, ctaH, ctaH * 0.4).fill(accent));
      const cLabel = makeText(fonts, { text: ctaLabel, role: "body", weight: 700, size: Math.round(ctaH * 0.42), color: readableOn(accent), anchor: 0.5 });
      cLabel.position.set(0, ctaY);
      card.addChild(cLabel);
    } else {
      card.addChild(new Graphics().roundRect(-ctaW / 2, ctaY - ctaH / 2, ctaW, ctaH, ctaH * 0.4).stroke({ color: muted, alpha: 0.6, width: Math.max(1.5, cardW * 0.008) }));
      const cLabel = makeText(fonts, { text: ctaLabel, role: "body", weight: 700, size: Math.round(ctaH * 0.42), color: textColor, anchor: 0.5 });
      cLabel.position.set(0, ctaY);
      card.addChild(cLabel);
    }

    // "Popular" badge above the highlighted card.
    if (isMid && showBadge) {
      const bW = cardW * 0.5;
      const bH = cardH * 0.09;
      const badgeC = new Container();
      badgeC.position.set(0, -cardH / 2 - bH * 0.2);
      badgeC.addChild(new Graphics().roundRect(-bW / 2, -bH / 2, bW, bH, bH / 2).fill(accent));
      const bLabel = makeText(fonts, { text: "POPULAR", role: "body", weight: 700, size: Math.round(bH * 0.44), color: readableOn(accent), anchor: 0.5, letterSpacing: 1.5 });
      badgeC.addChild(bLabel);
      card.addChild(badgeC);
    }

    const start = startTimes[i] ?? 0.4;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(card, { prop: "y", from: finalY + cardH * 0.14, to: finalY, start, duration: 0.7, ease: outExpo })
      .to(card, { prop: "scale.x", from: 0.92, to: 1, start, duration: 0.65, ease: makeOutBack(isMid ? 1.7 : 1.2) })
      .to(card, { prop: "scale.y", from: 0.92, to: 1, start, duration: 0.65, ease: makeOutBack(isMid ? 1.7 : 1.2) });
  });

  return { timeline, duration: 4.0 };
}

export const pricingTiers: TemplateDefinition = {
  id: "pricing-tiers",
  name: "Pricing Tiers",
  tagline: "Three pricing cards rise in with the popular plan highlighted.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { title: "display", price: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Simple, honest pricing", maxLength: 32, optional: true, shrinkToFit: true },
    {
      key: "plans",
      type: "textlist",
      label: "Plans (name | price | feat | feat | feat)",
      default: DEFAULT_PLANS,
      minItems: 3,
      maxItems: 3,
      maxLength: 70,
    },
    { key: "showBadge", type: "toggle", label: "Popular badge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

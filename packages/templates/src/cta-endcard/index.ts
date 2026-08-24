import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makePill } from "../shared/ui";
import { makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "white", name: "White", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#0B1F4D", textColor: "#FFFFFF", accent: "#38C7FF", onAccent: "#06213A" } },
  { id: "grape", name: "Grape", colors: { background: "#241052", textColor: "#FFFFFF", accent: "#D8F34D", onAccent: "#241052" } },
];

const DEFAULT_SOCIALS = ["youtube | @jima", "instagram | @jima.studio"];

const PLATFORM_ICON: Record<string, IconName> = {
  youtube: "play",
  instagram: "heart",
  tiktok: "star",
  web: "share",
};

interface Social {
  platform: string;
  handle: string;
}

function parseSocial(raw: string): Social {
  const idx = raw.indexOf("|");
  if (idx >= 0) {
    const platform = raw.slice(0, idx).trim().toLowerCase();
    const handle = raw.slice(idx + 1).trim();
    if (handle.length > 0) return { platform, handle };
    return { platform: "web", handle: platform };
  }
  return { platform: "web", handle: raw.trim() };
}

function socialsList(values: Values): Social[] {
  const raw = asItems(values.socials, DEFAULT_SOCIALS).slice(0, 4);
  return raw.map(parseSocial);
}

function computeDuration(values: Values): number {
  return 1.6 + socialsList(values).length * 0.15 + 1.4;
}

interface VLayout {
  brand: number;
  head: number;
  cta: number;
}

function vlayout(aspect: Aspect): VLayout {
  const f: Record<Aspect, VLayout> = {
    "1:1": { brand: 0.3, head: 0.5, cta: 0.66 },
    "4:5": { brand: 0.28, head: 0.47, cta: 0.63 },
    "9:16": { brand: 0.34, head: 0.5, cta: 0.63 },
    "16:9": { brand: 0.3, head: 0.51, cta: 0.68 },
  };
  return f[aspect];
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#101014"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const aspect = ctx.aspect;
  const L = vlayout(aspect);

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  const botSafe = aspect === "9:16" ? 400 : Math.round(minDim * 0.06);
  const sideMargin = aspect === "9:16" ? 64 : Math.round(minDim * 0.06);
  const availW = w - sideMargin * 2;

  // --- Logo (image) or brand text — springs in center ---
  const brandCY = h * L.brand;
  const logoHolder = new Container();
  logoHolder.position.set(cx, brandCY);
  root.addChild(logoHolder);
  const tex = images.logo ?? null;
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const box = minDim * 0.3;
    s.scale.set(Math.min(box / tex.width, box / tex.height));
    logoHolder.addChild(s);
  } else {
    const brandRaw = str(values.brandText, "jima");
    const brandSize = fitSize(fonts, brandRaw, "display", 700, Math.round(w * 0.12), availW * 0.9);
    logoHolder.addChild(makeText(fonts, { text: brandRaw, role: "display", weight: 700, size: brandSize, color: textColor, anchor: 0.5, align: "center" }));
  }
  logoHolder.scale.set(0);
  timeline
    .to(logoHolder, { prop: "scale.x", from: 0, to: 1, start: 0, duration: 0.75, ease: spring(0.45) })
    .to(logoHolder, { prop: "scale.y", from: 0, to: 1, start: 0, duration: 0.75, ease: spring(0.45) });

  // --- Headline ---
  const headRaw = str(values.headline, "Start creating — free");
  const headSize = fitSize(fonts, headRaw, "display", 700, Math.round(minDim * 0.075), availW * 0.94);
  const headY = h * L.head;
  const head = makeText(fonts, { text: headRaw, role: "display", weight: 700, size: headSize, color: textColor, anchor: 0.5, align: "center" });
  head.position.set(cx, headY);
  head.alpha = 0;
  root.addChild(head);
  timeline
    .to(head, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.4, ease: outQuad })
    .to(head, { prop: "y", from: headY + 18, to: headY, start: 0.5, duration: 0.55, ease: outExpo });

  // --- CTA pill ---
  const ctaRaw = str(values.cta, "jima.studio");
  const ctaSize = Math.round(minDim * 0.044);
  const ctaLabel = makeText(fonts, { text: ctaRaw, role: "display", weight: 700, size: ctaSize, color: onAccent, anchor: 0.5 });
  const ctaW = Math.min(availW * 0.9, ctaLabel.width + ctaSize * 1.8);
  const ctaH = ctaSize * 2.0;
  const ctaC = new Container();
  const ctaY = h * L.cta;
  ctaC.position.set(cx, ctaY);
  ctaC.addChild(makePill(ctaW, ctaH, accent));
  ctaC.addChild(ctaLabel);
  ctaC.scale.set(0);
  root.addChild(ctaC);
  timeline
    .to(ctaC, { prop: "scale.x", from: 0, to: 1, start: 0.9, duration: 0.55, ease: spring(0.45) })
    .to(ctaC, { prop: "scale.y", from: 0, to: 1, start: 0.9, duration: 0.55, ease: spring(0.45) });

  // --- Socials row (bottom) ---
  const socials = socialsList(values);
  const socialsY = h - botSafe - minDim * 0.045;

  let chipR = minDim * 0.028;
  let gapCH = chipR * 0.7; // chip-to-handle gap
  let itemGap = minDim * 0.05; // gap between items
  let handleSize = Math.round(minDim * 0.03);

  const handleWidth = (s: Social): number =>
    fonts.measure(s.handle, { family: fonts.family("body"), weight: 600, size: handleSize });

  const measureRow = (): number => {
    let total = 0;
    socials.forEach((s, i) => {
      total += chipR * 2 + gapCH + handleWidth(s);
      if (i > 0) total += itemGap;
    });
    return total;
  };

  let total = measureRow();
  if (total > availW) {
    const factor = availW / total;
    chipR *= factor;
    gapCH *= factor;
    itemGap *= factor;
    handleSize = Math.max(10, Math.floor(handleSize * factor));
    total = measureRow();
  }

  let cursorX = cx - total / 2;
  socials.forEach((s, i) => {
    const iconName = PLATFORM_ICON[s.platform] ?? "user";
    const item = new Container();
    item.position.set(0, socialsY);
    item.alpha = 0;
    root.addChild(item);

    const chipCX = cursorX + chipR;
    const chip = new Container();
    chip.position.set(chipCX, 0);
    chip.addChild(new Graphics().circle(0, 0, chipR).fill(accent));
    chip.addChild(makeIcon(iconName, chipR * 1.25, { color: onAccent, holeColor: accent }));
    item.addChild(chip);

    const handle = makeText(fonts, { text: s.handle, role: "body", weight: 600, size: handleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    handle.position.set(chipCX + chipR + gapCH, 0);
    item.addChild(handle);

    cursorX += chipR * 2 + gapCH + handleWidth(s) + itemGap;

    const start = 1.5 + i * 0.15;
    timeline
      .to(item, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(item, { prop: "y", from: socialsY + 14, to: socialsY, start, duration: 0.5, ease: outExpo });
  });

  return { timeline, duration: computeDuration(values) };
}

export const ctaEndcard: TemplateDefinition = {
  id: "cta-endcard",
  name: "CTA End Card",
  tagline: "An outro that lands the brand, a CTA, and your socials.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "logo", type: "image", label: "Logo", default: "", optional: true, help: "Transparent PNG. Falls back to the brand text." },
    { key: "brandText", type: "text", label: "Brand text", default: "jima", maxLength: 20 },
    { key: "headline", type: "text", label: "Headline", default: "Start creating — free", maxLength: 40, shrinkToFit: true },
    { key: "cta", type: "text", label: "Button", default: "jima.studio", maxLength: 24 },
    { key: "socials", type: "textlist", label: "Socials (platform | handle)", default: DEFAULT_SOCIALS, minItems: 1, maxItems: 4, maxLength: 30, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

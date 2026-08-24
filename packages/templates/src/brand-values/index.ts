import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  inOutQuad,
  inOutCubic,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  trackingEm = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size: size0,
    letterSpacing: trackingEm * size0,
  });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

// Each value owns the whole frame in turn — no single rotating slot, no cards.
// They crossfade with a scale-and-fade on both ends, and the last one shrinks
// straight into its slot in the closing lockup, so the set assembles rather
// than cutting.
const PALETTES: Palette[] = [
  { id: "chalk", name: "Chalk", colors: { background: "#F6F5F2", textColor: "#15171B", accent: "#1F6F5C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C0F16", textColor: "#F3F6FB", accent: "#9FB6FF" } },
  { id: "sand", name: "Sand", colors: { background: "#F5EEE4", textColor: "#26190E", accent: "#A2542A" } },
  { id: "slate", name: "Slate", colors: { background: "#EDF0F4", textColor: "#101720", accent: "#2563A8" } },
];

const DEFAULT_VALUES = ["Clarity", "Craft", "Courage"];

const TRACK = 0.05; // em — shared by hero + lockup so the hand-off is seamless.
const WORD_STEP = 1.4;
const WORD_IN = 0.12;
const WORD_HOLD = 1.18;
const SCALE_IN_DUR = 0.7;
const SETTLE_START = 3.62;
const SETTLE_DUR = 0.9;
const SWAP_AT = 4.38;
const SWAP_DUR = 0.16;
const DURATION = 5.2;

function heroFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.155;
    case "1:1":
      return 0.145;
    case "4:5":
      return 0.14;
    case "9:16":
      return 0.132;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6F5F2"));
  const textColor = str(values.textColor, pc("textColor", "#15171B"));
  const accent = str(values.accent, pc("accent", "#1F6F5C"));

  const words = asList(values.values, DEFAULT_VALUES)
    .slice(0, 3)
    .map((s) => s.toUpperCase());
  const brandName = str(values.brandName, "Northlight");
  const showDots = values.showDots !== false;
  const showRule = values.showRule !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);
  const n = words.length;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Closing lockup geometry (needed first: the last hero word lands in it) ---
  const nameSize = fitSize(fonts, brandName, "display", 700, Math.round(minDim * 0.062), zone.width * 0.74);
  const rowSize = Math.round(minDim * 0.04);
  const rowGap = rowSize * 2.0;
  const ruleH = Math.max(2, Math.round(minDim * 0.0022));
  const gapNameRule = nameSize * 0.6;
  const gapRuleRows = nameSize * 0.66;
  const rowsH = (n - 1) * rowGap + rowSize;
  const blockH = nameSize * 1.05 + gapNameRule + ruleH + gapRuleRows + rowsH;
  const blockTop = zone.y + zone.height / 2 - blockH / 2;
  const nameY = blockTop + nameSize * 0.55;
  const ruleY = blockTop + nameSize * 1.05 + gapNameRule + ruleH / 2;
  const rowsTop = ruleY + ruleH / 2 + gapRuleRows;
  const rowY = (i: number): number => rowsTop + rowSize / 2 + i * rowGap;

  // --- Hero type: one size for all three so the sequence reads as a set ---
  const heroBase = Math.round(minDim * heroFrac(ctx.aspect));
  let heroSize = heroBase;
  for (const word of words) {
    heroSize = Math.min(heroSize, fitSize(fonts, word, "display", 600, heroBase, zone.width * 0.84, TRACK));
  }
  const heroCy = zone.y + zone.height / 2;
  const landScale = rowSize / heroSize;

  // --- Progress dots (which value is on screen) ---
  if (showDots && n > 1) {
    const dotR = Math.max(3, minDim * 0.0075);
    const dotStep = dotR * 5;
    const dots = new Container();
    dots.position.set(cx, zone.y + zone.height * 0.93);
    root.addChild(dots);
    for (let i = 0; i < n; i++) {
      const x = (i - (n - 1) / 2) * dotStep;
      const base = new Graphics().circle(x, 0, dotR).fill(textColor);
      base.alpha = 0.18;
      dots.addChild(base);
      const live = new Graphics().circle(x, 0, dotR).fill(accent);
      live.alpha = 0;
      dots.addChild(live);
      const inAt = WORD_IN + i * WORD_STEP;
      timeline.to(live, { prop: "alpha", from: 0, to: 1, start: inAt, duration: 0.35, ease: outQuad });
      if (i < n - 1) {
        timeline.to(live, { prop: "alpha", from: 1, to: 0, start: inAt + WORD_HOLD, duration: 0.35, ease: outQuad });
      }
    }
    dots.alpha = 0;
    timeline
      .to(dots, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.5, ease: outQuad })
      .to(dots, { prop: "alpha", from: 1, to: 0, start: SETTLE_START - 0.12, duration: 0.45, ease: outQuad });
  }

  // --- Hero pass: each word takes the frame, then crossfades to the next ---
  words.forEach((word, i) => {
    const hero = makeText(fonts, {
      text: word,
      role: "display",
      weight: 600,
      size: heroSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: heroSize * TRACK,
    });
    hero.position.set(cx, heroCy);
    hero.alpha = 0;
    hero.scale.set(1.12);
    root.addChild(hero);

    const inAt = WORD_IN + i * WORD_STEP;
    timeline
      .to(hero, { prop: "alpha", from: 0, to: 1, start: inAt, duration: 0.55, ease: outQuad })
      .to(hero, { prop: "scale.x", from: 1.12, to: 1, start: inAt, duration: SCALE_IN_DUR, ease: outExpo })
      .to(hero, { prop: "scale.y", from: 1.12, to: 1, start: inAt, duration: SCALE_IN_DUR, ease: outExpo });

    if (i < n - 1) {
      const outAt = inAt + WORD_HOLD;
      timeline
        .to(hero, { prop: "alpha", from: 1, to: 0, start: outAt, duration: 0.44, ease: inOutQuad })
        .to(hero, { prop: "scale.x", from: 1, to: 0.94, start: outAt, duration: 0.6, ease: inOutQuad })
        .to(hero, { prop: "scale.y", from: 1, to: 0.94, start: outAt, duration: 0.6, ease: inOutQuad });
    } else {
      // The last word doesn't leave — it settles into its lockup slot, then
      // hands off to the small row at matching size/tracking (an invisible swap).
      timeline
        .to(hero, { prop: "y", from: heroCy, to: rowY(i), start: SETTLE_START, duration: SETTLE_DUR, ease: inOutCubic })
        .to(hero, { prop: "scale.x", from: 1, to: landScale, start: SETTLE_START, duration: SETTLE_DUR, ease: inOutCubic })
        .to(hero, { prop: "scale.y", from: 1, to: landScale, start: SETTLE_START, duration: SETTLE_DUR, ease: inOutCubic })
        .to(hero, { prop: "alpha", from: 1, to: 0, start: SWAP_AT, duration: SWAP_DUR, ease: inOutQuad });
    }
  });

  // --- Lockup: brand name, hairline, the three values stacked ---
  const nameText = makeText(fonts, {
    text: brandName,
    role: "display",
    weight: 700,
    size: nameSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
  });
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 4.18, duration: 0.5, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 16, to: nameY, start: 4.18, duration: 0.62, ease: outExpo });

  if (showRule) {
    const ruleW = Math.min(zone.width * 0.22, nameSize * 2);
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(cx, ruleY);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 4.28, duration: 0.5, ease: outExpo });
  }

  words.forEach((word, i) => {
    const y = rowY(i);
    const row = makeText(fonts, {
      text: word,
      role: "display",
      weight: 600,
      size: rowSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: rowSize * TRACK,
    });
    row.position.set(cx, y);
    row.alpha = 0;
    root.addChild(row);
    if (i < n - 1) {
      const start = 4.26 + i * 0.08;
      timeline
        .to(row, { prop: "alpha", from: 0, to: 1, start, duration: 0.44, ease: outQuad })
        .to(row, { prop: "y", from: y + 12, to: y, start, duration: 0.55, ease: outExpo });
    } else {
      timeline.to(row, { prop: "alpha", from: 0, to: 1, start: SWAP_AT, duration: SWAP_DUR, ease: inOutQuad });
    }
  });

  return { timeline, duration: DURATION };
}

export const brandValues: TemplateDefinition = {
  id: "brand-values",
  name: "Brand Values",
  tagline: "Three values each take the frame, then settle into one quiet lockup.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 4.95,
  fontRoles: { values: "display", brandName: "display" },
  palettes: PALETTES,
  fields: [
    {
      key: "values",
      type: "textlist",
      label: "Values",
      default: DEFAULT_VALUES,
      minItems: 3,
      maxItems: 3,
      maxLength: 14,
      help: "One word each reads best — they end up stacked under your name.",
    },
    { key: "brandName", type: "text", label: "Brand name", default: "Northlight", maxLength: 22, shrinkToFit: true },
    { key: "showDots", type: "toggle", label: "Progress dots", default: true },
    { key: "showRule", type: "toggle", label: "Hairline", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

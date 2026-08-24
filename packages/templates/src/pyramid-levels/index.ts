import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  spring,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import type { Text } from "pixi.js";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

// Tier fills (`tier1`..`tier4`, base→top) and the numeral badge are fixed,
// pre-darkened palette-only roles — only background/textColor/accent are
// user-editable. The badge color is deliberately darkened (not the raw accent)
// so its white numeral clears the 4.5:1 bar in every palette (CLAUDE.md pitfall:
// "white on saturated accent often fails").
const PALETTES: Palette[] = [
  {
    id: "ink",
    name: "Ink",
    colors: {
      background: "#FFFFFF", textColor: "#151016", accent: "#FF4D1C",
      tier1: "#C2380F", tier2: "#FF6B3D", tier3: "#FF9B6E", tier4: "#FFD3BB",
      badgeColor: "#C2380F", onBadge: "#FFFFFF",
    },
  },
  {
    id: "cobalt",
    name: "Cobalt",
    colors: {
      background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6",
      tier1: "#2A5AD6", tier2: "#4C86F2", tier3: "#89ADF7", tier4: "#C9DBFC",
      badgeColor: "#2A5AD6", onBadge: "#FFFFFF",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    colors: {
      background: "#101014", textColor: "#FAF5EA", accent: "#D8F34D",
      tier1: "#4A5A12", tier2: "#7C9420", tier3: "#AFC93A", tier4: "#D8F34D",
      badgeColor: "#3A4A0E", onBadge: "#FFFFFF",
    },
  },
  {
    id: "grape",
    name: "Grape",
    colors: {
      background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF",
      tier1: "#5B3FE0", tier2: "#8268F0", tier3: "#AC9AF7", tier4: "#D9CFFC",
      badgeColor: "#5B3FE0", onBadge: "#FFFFFF",
    },
  },
];

const DEFAULT_TIERS = ["Awareness", "Consideration", "Decision", "Loyalty"];

function resolveTiers(values: Values): string[] {
  const raw = asList(values.tiers, DEFAULT_TIERS).slice(0, 4);
  return raw.length >= 3 ? raw : DEFAULT_TIERS;
}

const TIER0 = 0.4;
const TIER_EACH = 0.38;
const TIER_DUR = 0.55;
const BADGE_DELAY = 0.2;
const BADGE_DUR = 0.42;
const LABEL_DELAY = 0.32;
const LABEL_DUR = 0.4;
const HOLD = 1.15;

function computeDuration(values: Values): number {
  const n = resolveTiers(values).length;
  const lastStart = TIER0 + (n - 1) * TIER_EACH;
  return lastStart + Math.max(TIER_DUR, LABEL_DELAY + LABEL_DUR) + HOLD;
}

/** Evenly pick `n` shades out of the 4-step ramp (keeps contrast between
 * neighboring tiers even when there are only 3 of them). */
function rampIndex(k: number, n: number): number {
  if (n <= 1) return 0;
  return Math.round((k * 3) / (n - 1));
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#151016"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const ramp = [pc("tier1", "#C2380F"), pc("tier2", "#FF6B3D"), pc("tier3", "#FF9B6E"), pc("tier4", "#FFD3BB")];
  const badgeColor = pc("badgeColor", "#C2380F");
  const onBadge = pc("onBadge", "#FFFFFF");

  const title = str(values.title, "How it builds");
  const tiers = resolveTiers(values);
  const n = tiers.length;
  const buildDirection = str(values.buildDirection, "base-up");
  const showSideLabels = values.showSideLabels !== false;
  const showBadges = values.showBadges !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const insets = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const hasTitle = title.length > 0;
  const titleY = insets.top + minDim * 0.045;
  const apexY = hasTitle ? titleY + minDim * 0.085 : insets.top + minDim * 0.03;
  const baseY = h - insets.bottom - minDim * 0.02;

  if (hasTitle) {
    const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), w * 0.8);
    const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
    titleText.position.set(w / 2, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "y", from: titleY - 14, to: titleY, start: 0, duration: 0.5, ease: outQuint });
  }

  const availW = w - insets.left - insets.right;
  const pyramidCX = insets.left + availW * 0.38;
  const halfWBase = minDim * 0.24;
  const gap = minDim * 0.06;
  const labelX = Math.min(pyramidCX + halfWBase + gap, w - insets.right - minDim * 0.26);
  const labelColW = Math.max(minDim * 0.18, w - insets.right - labelX);

  const H = baseY - apexY;
  const tierH = H / n;
  // Linear taper: 0 at the apex (y=apexY) widening to halfWBase at the base (y=baseY).
  const hwAt = (y: number): number => Math.max(0, halfWBase * ((y - apexY) / H));

  const order = buildDirection === "top-down" ? [...Array(n).keys()].reverse() : [...Array(n).keys()];
  const slideDist = minDim * 0.07;

  const badgeR = Math.max(11, minDim * 0.024);
  const badgeFont = Math.round(badgeR * 1.02);
  const labelFont = Math.max(10, Math.round(minDim * 0.032));
  const stemTh = Math.max(2, minDim * 0.006);

  for (let k = 0; k < n; k++) {
    const yBot = baseY - k * tierH;
    const yTop = baseY - (k + 1) * tierH;
    const hwBot = hwAt(yBot);
    const hwTop = hwAt(yTop);
    const yMid = (yBot + yTop) / 2;
    const hwMid = hwAt(yMid);
    const color = ramp[rampIndex(k, n)] ?? accent;
    const start = TIER0 + order.indexOf(k) * TIER_EACH;

    const tierC = new Container();
    tierC.position.set(pyramidCX, slideDist);
    tierC.scale.set(0, 1);
    tierC.addChild(
      new Graphics().poly([-hwBot, yBot, hwBot, yBot, hwTop, yTop, -hwTop, yTop]).fill(color),
    );
    root.addChild(tierC);
    timeline
      .to(tierC, { prop: "scale.x", from: 0, to: 1, start, duration: TIER_DUR, ease: outExpo })
      .to(tierC, { prop: "y", from: slideDist, to: 0, start, duration: TIER_DUR, ease: outQuint });

    // Numeral badge on the tier's right edge (toggle-guarded decoration).
    const badgeX = pyramidCX + hwMid + badgeR * 0.25;
    if (showBadges) {
      const badge = new Container();
      badge.position.set(badgeX, yMid);
      badge.addChild(new Graphics().circle(0, 0, badgeR).fill(badgeColor));
      badge.addChild(makeText(fonts, { text: String(k + 1), role: "display", weight: 700, size: badgeFont, color: onBadge, anchor: 0.5 }));
      badge.scale.set(0);
      root.addChild(badge);
      const badgeStart = start + BADGE_DELAY;
      timeline
        .to(badge, { prop: "scale.x", from: 0, to: 1, start: badgeStart, duration: BADGE_DUR, ease: spring(0.5) })
        .to(badge, { prop: "scale.y", from: 0, to: 1, start: badgeStart, duration: BADGE_DUR, ease: spring(0.5) });
    }

    // Side label: stem + descriptive text, toggle-guarded (node + tweens).
    if (showSideLabels) {
      const stemStart = badgeX + (showBadges ? badgeR : badgeR * 0.4);
      const stemLen = Math.max(4, labelX - stemStart - minDim * 0.012);
      const stem = new Graphics().roundRect(0, -stemTh / 2, stemLen, stemTh, stemTh / 2).fill({ color: textColor, alpha: 0.25 });
      stem.position.set(stemStart, yMid);
      stem.scale.set(0, 1);
      root.addChild(stem);
      const labelStart = start + LABEL_DELAY;
      timeline.to(stem, { prop: "scale.x", from: 0, to: 1, start: labelStart, duration: 0.3, ease: outExpo });

      const label = fitText(
        fonts,
        { text: tiers[k] ?? "", role: "body", weight: 600, size: labelFont, color: textColor, anchor: { x: 0, y: 0.5 } },
        labelColW,
      );
      label.position.set(labelX, yMid);
      label.alpha = 0;
      root.addChild(label);
      timeline
        .to(label, { prop: "alpha", from: 0, to: 1, start: labelStart + 0.05, duration: LABEL_DUR, ease: outQuad })
        .to(label, { prop: "x", from: labelX - 10, to: labelX, start: labelStart + 0.05, duration: LABEL_DUR + 0.1, ease: outQuint });
    }
  }

  return { timeline, duration: computeDuration(values) };
}

export const pyramidLevels: TemplateDefinition = {
  id: "pyramid-levels",
  name: "Pyramid Levels",
  tagline: "A hierarchy pyramid builds tier by tier with side labels.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.7,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", label: "body", badge: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "How it builds", maxLength: 32, optional: true, shrinkToFit: true },
    { key: "tiers", type: "textlist", label: "Tiers (base to top)", default: DEFAULT_TIERS, minItems: 3, maxItems: 4, maxLength: 24 },
    {
      key: "buildDirection",
      type: "select",
      label: "Build direction",
      default: "base-up",
      options: [
        { value: "base-up", label: "Base up" },
        { value: "top-down", label: "Top down" },
      ],
    },
    { key: "showSideLabels", type: "toggle", label: "Side labels", default: true },
    { key: "showBadges", type: "toggle", label: "Numeral badges", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  spring,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
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

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

// Tier badge colors are fixed and chosen for ≥ 4.5:1 with white letters
// (S red, A orange, B green, C blue). When "tier colors" is off, badges fall
// back to textColor with a background-colored letter — guaranteed-contrast both
// ways. Item chips are `chipBg` cards with textColor labels.
const TIERS = ["S", "A", "B", "C"] as const;
type Tier = (typeof TIERS)[number];
const TIER_COLORS: Record<Tier, string> = {
  S: "#C1121F",
  A: "#C2410C",
  B: "#15803D",
  C: "#1D4ED8",
};

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", chipBg: "#F4F1EC", lane: "#101014" } },
  { id: "slate", name: "Slate", colors: { background: "#EEF1F5", textColor: "#0F1B2A", accent: "#2E5BD6", chipBg: "#FFFFFF", lane: "#0F1B2A" } },
  { id: "cream", name: "Cream", colors: { background: "#FFF8E6", textColor: "#2A2410", accent: "#F59E0B", chipBg: "#FFFFFF", lane: "#2A2410" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", chipBg: "#1D1D24", lane: "#F4F1E8" } },
];

const DEFAULT_ITEMS = ["S|Short-form video", "S|Carousels", "A|Newsletters", "A|Live streams", "B|Long blogs", "C|Cold DMs"];

const CHIPS_START = 1.0;
const CHIP_STAGGER = 0.16;
const CHIP_DUR = 0.5;
const HOLD = 1.0;

interface Item {
  tier: Tier;
  label: string;
}

function parseItem(raw: string): Item {
  const idx = raw.indexOf("|");
  const tierRaw = (idx >= 0 ? raw.slice(0, idx) : "").trim().toUpperCase();
  const label = (idx >= 0 ? raw.slice(idx + 1) : raw).trim();
  const tier = (TIERS as readonly string[]).includes(tierRaw) ? (tierRaw as Tier) : "C";
  return { tier, label: label.length ? label : raw.trim() };
}

function itemsOf(values: Values): Item[] {
  return asList(values.items, DEFAULT_ITEMS).slice(0, 8).map(parseItem);
}

function computeDuration(values: Values): number {
  const k = Math.max(1, itemsOf(values).length);
  return CHIPS_START + (k - 1) * CHIP_STAGGER + CHIP_DUR + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const chipBg = pc("chipBg", "#F4F1EC");
  const laneColor = pc("lane", "#101014");

  const title = str(values.title, "Tier list");
  const showTierColors = values.showTierColors !== false;
  const showTitle = values.showTitle !== false;
  const items = itemsOf(values);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);

  // --- Title ---
  let rowsTop = zone.y;
  if (showTitle) {
    const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), zone.width);
    const titleY = zone.y + titleSize * 0.75;
    const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    titleText.position.set(zone.x, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "x", from: zone.x - 20, to: zone.x, start: 0, duration: 0.5, ease: outQuint });

    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(zone.x, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outQuint });

    rowsTop = titleY + titleSize * 1.0 + minDim * 0.035;
  }

  // --- Rows (S/A/B/C) ---
  const rowsBottom = zone.y + zone.height;
  const rowH = (rowsBottom - rowsTop) / TIERS.length;
  const laneH = Math.min(rowH * 0.78, minDim * 0.15);
  const badgeSize = Math.min(rowH * 0.66, laneH * 0.92, minDim * 0.12);
  const pad = minDim * 0.016;
  const badgeCx = zone.x + badgeSize / 2;
  const laneX = zone.x + badgeSize + pad * 2;
  const laneRight = zone.x + zone.width;
  const laneW = laneRight - laneX;

  const grouped: Record<Tier, Item[]> = { S: [], A: [], B: [], C: [] };
  for (const it of items) grouped[it.tier].push(it);

  // Chips stagger in a single global order: top row first, left→right.
  let orderK = 0;

  TIERS.forEach((tier, ti) => {
    const rowCY = rowsTop + (ti + 0.5) * rowH;
    const rowStart = 0.35 + ti * 0.14;

    // Lane background.
    const lane = new Graphics()
      .roundRect(laneX, rowCY - laneH / 2, laneW, laneH, laneH * 0.18)
      .fill({ color: laneColor, alpha: 0.07 });
    lane.alpha = 0;
    root.addChild(lane);
    timeline.to(lane, { prop: "alpha", from: 0, to: 1, start: rowStart, duration: 0.4, ease: outQuad });

    // Tier badge.
    const badge = new Container();
    badge.position.set(badgeCx, rowCY);
    badge.scale.set(0);
    const badgeFill = showTierColors ? TIER_COLORS[tier] : textColor;
    const letterColor = showTierColors ? "#FFFFFF" : bg;
    badge.addChild(new Graphics().roundRect(-badgeSize / 2, -badgeSize / 2, badgeSize, badgeSize, badgeSize * 0.22).fill(badgeFill));
    badge.addChild(makeText(fonts, { text: tier, role: "display", weight: 700, size: Math.round(badgeSize * 0.52), color: letterColor, anchor: 0.5 }));
    root.addChild(badge);
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: rowStart, duration: 0.45, ease: makeOutBack(2) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: rowStart, duration: 0.45, ease: makeOutBack(2) });

    // Item chips for this tier, flowed left→right, scaled to fit the lane.
    const rowItems = grouped[tier];
    if (rowItems.length > 0) {
      const chipH = laneH * 0.66;
      const chipFont0 = Math.round(chipH * 0.44);
      const chipPadX = chipH * 0.42;
      const chipGap = minDim * 0.012;
      const innerPad = minDim * 0.012;

      const baseW = rowItems.map((it) => {
        const fs = fitSize(fonts, it.label, "body", 600, chipFont0, laneW * 0.6);
        const lw = fonts.measure(it.label, { family: fonts.family("body"), weight: 600, size: fs });
        return { fs, chipW: lw + chipPadX * 2 };
      });
      const totalW = baseW.reduce((a, b) => a + b.chipW, 0) + (rowItems.length - 1) * chipGap;
      const avail = laneW - innerPad * 2;
      const scale = totalW > avail ? avail / totalW : 1;

      let cursor = laneX + innerPad;
      rowItems.forEach((it, j) => {
        const bw = baseW[j]!;
        const cw = bw.chipW * scale;
        const fs = Math.max(9, Math.floor(bw.fs * scale));
        const chipCx = cursor + cw / 2;
        cursor += cw + chipGap * scale;

        const chip = new Container();
        chip.position.set(chipCx, rowCY);
        chip.alpha = 0;
        root.addChild(chip);
        chip.addChild(new Graphics().roundRect(-cw / 2, -chipH / 2 + chipH * 0.08, cw, chipH, chipH * 0.24).fill({ color: "#000000", alpha: 0.12 }));
        chip.addChild(new Graphics().roundRect(-cw / 2, -chipH / 2, cw, chipH, chipH * 0.24).fill(chipBg));
        chip.addChild(makeText(fonts, { text: it.label, role: "body", weight: 600, size: fs, color: textColor, anchor: 0.5 }));

        const start = CHIPS_START + orderK * CHIP_STAGGER;
        orderK++;
        const dropFrom = rowCY - rowH * 0.5;
        timeline
          .to(chip, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
          .to(chip, { prop: "y", from: dropFrom, to: rowCY, start, duration: CHIP_DUR, ease: spring(0.55) });
      });
    }
  });

  return { timeline, duration: computeDuration(values) };
}

export const tierList: TemplateDefinition = {
  id: "tier-list",
  name: "Tier List",
  tagline: "Items drop into S, A, B and C tiers with colored tier badges.",
  category: "comparison",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.9,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", items: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Tier list", maxLength: 28, shrinkToFit: true },
    { key: "items", type: "textlist", label: "Items (tier|label)", default: DEFAULT_ITEMS, minItems: 4, maxItems: 8, maxLength: 24, help: 'One per line as "tier|label", e.g. "S|Product". Tiers: S, A, B, C.' },
    { key: "showTierColors", type: "toggle", label: "Tier colors", default: true },
    { key: "showTitle", type: "toggle", label: "Title", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

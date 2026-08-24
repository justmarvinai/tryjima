import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
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
import { makeIcon, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
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
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

// City / country / labels sit on the background in `textColor` (>= 4.5:1); the
// chip surface has its own `cardBg` so it survives an alpha export as content.
const PALETTES: Palette[] = [
  { id: "sand", name: "Sand", colors: { background: "#FBF3E7", cardBg: "#FFFFFF", textColor: "#241A0E", accent: "#E4692B" } },
  { id: "azure", name: "Azure", colors: { background: "#EAF3FB", cardBg: "#FFFFFF", textColor: "#0B2036", accent: "#1E7FC2" } },
  { id: "sunset", name: "Sunset", colors: { background: "#2A1230", cardBg: "#3E2047", textColor: "#FBEFF6", accent: "#FF8A5B" } },
  { id: "olive", name: "Olive", colors: { background: "#EEF2E4", cardBg: "#FFFFFF", textColor: "#1E2410", accent: "#6C8B2A" } },
];

const DEFAULT_HIGHLIGHTS = ["Eat", "See", "Stay"];
const CHIP_ICONS: IconName[] = ["star", "pin", "bookmark"];
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF3E7"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#241A0E"));
  const accent = str(values.accent, pc("accent", "#E4692B"));

  const city = str(values.city, "Lisbon");
  const country = str(values.country, "Portugal");
  const ratingRaw = str(values.rating, "4.8");
  const ratingNum = Math.max(0, Math.min(5, parseFloat(ratingRaw) || 0));
  const highlights = asList(values.highlights, DEFAULT_HIGHLIGHTS).slice(0, 3);
  const showRating = on(values.showRating);
  const showChips = on(values.showChips);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const maxW = zone.width * 0.92;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Measure the blocks ---
  const gap = minDim * 0.04;
  const cityFont = fitSize(fonts, city, "display", 700, Math.round(minDim * 0.1), maxW);
  const cityH = Math.round(cityFont * 1.02);
  const countryFont = Math.round(minDim * 0.036);
  const countryH = Math.round(countryFont * 1.3);
  const starSize = Math.round(minDim * 0.05);
  const ratingH = Math.round(starSize * 1.15);

  const chipGap = minDim * 0.028;
  const chipCellW = Math.min(minDim * 0.21, (zone.width - (highlights.length - 1) * chipGap) / Math.max(1, highlights.length));
  const chipH = chipCellW * 0.92;

  interface Block {
    key: "city" | "country" | "rating" | "chips";
    h: number;
  }
  const blocks: Block[] = [{ key: "city", h: cityH }, { key: "country", h: countryH }];
  if (showRating) blocks.push({ key: "rating", h: ratingH });
  if (showChips && highlights.length > 0) blocks.push({ key: "chips", h: chipH });

  const totalH = blocks.reduce((s, b) => s + b.h, 0) + (blocks.length - 1) * gap;
  let cursorY = zone.y + zone.height / 2 - totalH / 2;
  const centers: Record<string, number> = {};
  blocks.forEach((b, i) => {
    centers[b.key] = cursorY + b.h / 2;
    cursorY += b.h + (i < blocks.length - 1 ? gap : 0);
  });

  // --- City ---
  const cityText = makeText(fonts, { text: city, role: "display", weight: 700, size: cityFont, color: textColor, anchor: 0.5, align: "center" });
  cityText.position.set(cx, centers.city!);
  cityText.alpha = 0;
  root.addChild(cityText);
  timeline
    .to(cityText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.45, ease: outQuad })
    .to(cityText, { prop: "y", from: centers.city! - 16, to: centers.city!, start: 0.1, duration: 0.6, ease: outExpo });

  // --- Country ---
  const countryText = makeText(fonts, { text: country.toUpperCase(), role: "body", weight: 600, size: countryFont, color: textColor, anchor: 0.5, letterSpacing: Math.max(2, Math.round(countryFont * 0.12)) });
  countryText.alpha = 0;
  countryText.position.set(cx, centers.country!);
  root.addChild(countryText);
  timeline
    .to(countryText, { prop: "alpha", from: 0, to: 0.9, start: 0.24, duration: 0.4, ease: outQuad })
    .to(countryText, { prop: "y", from: centers.country! + 8, to: centers.country!, start: 0.24, duration: 0.45, ease: outQuint });

  // --- Star rating ---
  if (showRating) {
    const starGap = starSize * 0.28;
    const numText = ratingRaw;
    const numFont = Math.round(starSize * 0.92);
    const numW = fonts.measure(numText, { family: fonts.family("display"), weight: 700, size: numFont });
    const numGap = starSize * 0.5;
    const rowW = 5 * starSize + 4 * starGap + numGap + numW;
    const rowLeft = cx - rowW / 2;
    const cy = centers.rating!;
    const rowStart = 0.4;
    for (let i = 0; i < 5; i++) {
      const scx = rowLeft + starSize / 2 + i * (starSize + starGap);
      const full = i < Math.floor(ratingNum);
      const half = !full && i < ratingNum - 0.001;
      // muted base star
      const base = makeIcon("star", starSize, { color: textColor });
      base.alpha = 0.16;
      base.position.set(scx, cy);
      root.addChild(base);
      if (full || half) {
        const lit = makeIcon("star", starSize, { color: accent });
        lit.position.set(scx, cy);
        lit.alpha = 0;
        lit.scale.set(0.4);
        root.addChild(lit);
        const st = rowStart + i * 0.07;
        timeline
          .to(lit, { prop: "alpha", from: 0, to: half ? 0.55 : 1, start: st, duration: 0.3, ease: outQuad })
          .to(lit, { prop: "scale.x", from: 0.4, to: 1, start: st, duration: 0.5, ease: makeOutBack(2.2) })
          .to(lit, { prop: "scale.y", from: 0.4, to: 1, start: st, duration: 0.5, ease: makeOutBack(2.2) });
      }
    }
    const num = makeText(fonts, { text: numText, role: "display", weight: 700, size: numFont, color: textColor, anchor: { x: 0, y: 0.5 } });
    num.position.set(rowLeft + 5 * starSize + 4 * starGap + numGap, cy);
    num.alpha = 0;
    root.addChild(num);
    timeline.to(num, { prop: "alpha", from: 0, to: 1, start: rowStart + 0.35, duration: 0.4, ease: outQuad });
  }

  // --- Highlight chips ---
  if (showChips && highlights.length > 0) {
    const n = highlights.length;
    const rowW = n * chipCellW + (n - 1) * chipGap;
    const rowLeft = cx - rowW / 2;
    const cy = centers.chips!;
    const rowStart = 0.62;
    const iconSize = chipCellW * 0.3;
    const labelFont = Math.round(chipCellW * 0.15);
    highlights.forEach((label, i) => {
      const ccx = rowLeft + i * (chipCellW + chipGap) + chipCellW / 2;
      const chip = new Container();
      chip.position.set(ccx, cy);
      chip.scale.set(0);
      root.addChild(chip);
      // Shadow + surface.
      chip.addChild(new Graphics().roundRect(-chipCellW / 2 - 2, -chipH / 2 + chipH * 0.05, chipCellW + 4, chipH, chipCellW * 0.16).fill({ color: "#000000", alpha: 0.12 }));
      chip.addChild(new Graphics().roundRect(-chipCellW / 2, -chipH / 2, chipCellW, chipH, chipCellW * 0.16).fill(cardBg));
      // Accent-tinted icon disc.
      const discR = iconSize * 0.86;
      chip.addChild(new Graphics().circle(0, -chipH * 0.16, discR).fill({ color: accent, alpha: 0.16 }));
      const icon = makeIcon(CHIP_ICONS[i % CHIP_ICONS.length]!, iconSize, { color: accent, holeColor: cardBg });
      icon.position.set(0, -chipH * 0.16);
      chip.addChild(icon);
      const lf = fitSize(fonts, label, "body", 600, labelFont, chipCellW * 0.86);
      const lbl = makeText(fonts, { text: label, role: "body", weight: 600, size: lf, color: textColor, anchor: 0.5 });
      lbl.position.set(0, chipH * 0.28);
      chip.addChild(lbl);
      const st = rowStart + i * 0.09;
      timeline
        .to(chip, { prop: "scale.x", from: 0, to: 1, start: st, duration: 0.55, ease: makeOutBack(1.9) })
        .to(chip, { prop: "scale.y", from: 0, to: 1, start: st, duration: 0.55, ease: makeOutBack(1.9) });
    });
  }

  return { timeline, duration: DURATION };
}

export const cityGuide: TemplateDefinition = {
  id: "city-guide",
  name: "City Guide",
  tagline: "A destination card — big city name, star rating, and highlight chips.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { city: "display" },
  palettes: PALETTES,
  fields: [
    { key: "city", type: "text", label: "City", default: "Lisbon", maxLength: 22, shrinkToFit: true },
    { key: "country", type: "text", label: "Country", default: "Portugal", maxLength: 24, shrinkToFit: true },
    { key: "rating", type: "text", label: "Rating (0–5)", default: "4.8", maxLength: 4 },
    {
      key: "highlights",
      type: "textlist",
      label: "Highlights",
      default: DEFAULT_HIGHLIGHTS,
      minItems: 1,
      maxItems: 3,
      maxLength: 14,
      help: "One short label per line (up to 3), e.g. Eat / See / Stay.",
    },
    { key: "showRating", type: "toggle", label: "Star rating", default: true },
    { key: "showChips", type: "toggle", label: "Highlight chips", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

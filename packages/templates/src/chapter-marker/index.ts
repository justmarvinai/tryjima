import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  makeOutBack,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0, letterSpacing });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A clean, editorial video-chapter marker anchored lower-left. A thin accent
// rule draws in first, then a letter-spaced kicker ("CHAPTER 01") slides in
// above a larger chapter title. Optional accent number chip. Only the
// full-frame `bg` rect is tied to the background field (blanked by transparent
// export); the number chip uses its own palette-only `accent`/`accentText`
// surface (with a soft shadow) so it survives as overlay content over footage.
// `accentText` is a fixed, contrast-checked color for the digit on the accent
// chip, so it stays legible under any accent pick.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F6", textColor: "#0B0B0F", accent: "#1D4ED8", accentText: "#FFFFFF" } },
  { id: "paper", name: "Paper", colors: { background: "#F4F1EA", textColor: "#17130D", accent: "#B31232", accentText: "#FFFFFF" } },
  { id: "forest", name: "Forest", colors: { background: "#EAF3EC", textColor: "#0C1F14", accent: "#046A4E", accentText: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#0E0E12", textColor: "#F4F4F6", accent: "#FF8A3D", accentText: "#101014" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const textColor = str(values.textColor, pc("textColor", "#0B0B0F"));
  const accent = str(values.accent, pc("accent", "#1D4ED8"));
  const accentText = pc("accentText", "#FFFFFF");

  const number = str(values.number, "01");
  const kickerRaw = str(values.kicker, "CHAPTER");
  const title = str(values.title, "Getting started");
  const showChip = values.showChip !== false;
  const showRule = values.showRule !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // The kicker carries the number only when the chip is hidden, so the digit
  // never appears twice.
  const kickerTxt = (showChip ? kickerRaw : `${kickerRaw} ${number}`).toUpperCase();

  const rightEdge = w - zone.right;
  const ruleW = Math.max(3, Math.round(minDim * 0.006));
  const ruleGap = Math.round(minDim * 0.024);

  // Provisional sizes; text width is bounded after we know the chip budget.
  const kickerSize0 = Math.round(minDim * 0.022);
  const titleSize0 = Math.round(minDim * 0.052);
  const kickerLS = kickerSize0 * 0.14;
  const rowGap = Math.round(minDim * 0.012);

  const provTitleSize = titleSize0;
  const blockH = kickerSize0 + rowGap + provTitleSize;
  const chipSize = showChip ? Math.round(blockH * 0.98) : 0;
  const chipGap = showChip ? Math.round(minDim * 0.02) : 0;

  const textLeft = zone.left + ruleW + ruleGap + (showChip ? chipSize + chipGap : 0);
  const maxTextW = Math.max(80, rightEdge - textLeft);

  const kickerSize = fitSize(fonts, kickerTxt, "body", 700, kickerSize0, maxTextW, kickerLS);
  const titleSize = fitSize(fonts, title, "display", 700, titleSize0, maxTextW);

  // --- Vertical placement, anchored lower-left, built upward. ---
  const marginBottom = Math.round(minDim * 0.03);
  const stackBottomY = h - zone.bottom - marginBottom;
  const titleCenterY = stackBottomY - titleSize / 2;
  const kickerCenterY = stackBottomY - titleSize - rowGap - kickerSize / 2;
  const blockTopY = kickerCenterY - kickerSize / 2;
  const realBlockH = stackBottomY - blockTopY;

  // --- Thin accent rule (draws in top -> bottom). ---
  if (showRule) {
    const rule = new Container();
    rule.position.set(zone.left, blockTopY);
    rule.scale.set(1, 0);
    rule.addChild(new Graphics().roundRect(0, 0, ruleW, realBlockH, ruleW / 2).fill(accent));
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.y", from: 0, to: 1, start: 0, duration: 0.42, ease: outExpo });
  }

  // --- Number chip (accent square, own shadow). ---
  if (showChip) {
    const chipCenterX = zone.left + ruleW + ruleGap + chipSize / 2;
    const chipCenterY = stackBottomY - realBlockH / 2;
    const chip = new Container();
    chip.position.set(chipCenterX, chipCenterY);
    chip.scale.set(0);
    root.addChild(chip);

    const cornerR = Math.round(chipSize * 0.24);
    const e = Math.round(chipSize * 0.04);
    const off = Math.round(chipSize * 0.06);
    chip.addChild(
      new Graphics()
        .roundRect(-chipSize / 2 - e, -chipSize / 2 - e + off, chipSize + e * 2, chipSize + e * 2, cornerR + e)
        .fill({ color: "#000000", alpha: 0.18 }),
    );
    chip.addChild(new Graphics().roundRect(-chipSize / 2, -chipSize / 2, chipSize, chipSize, cornerR).fill(accent));

    const numSize = fitSize(fonts, number, "display", 700, Math.round(chipSize * 0.52), chipSize * 0.74);
    const numText = makeText(fonts, { text: number, role: "display", weight: 700, size: numSize, color: accentText, anchor: 0.5 });
    chip.addChild(numText);

    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: 0.14, duration: 0.5, ease: makeOutBack(1.7) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: 0.14, duration: 0.5, ease: makeOutBack(1.7) });
  }

  // --- Kicker (slides in from the left, above the title). ---
  const slideFrom = Math.round(minDim * 0.03);
  const kickerText = makeText(fonts, {
    text: kickerTxt,
    role: "body",
    weight: 700,
    size: kickerSize,
    color: accent,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: kickerSize * 0.14,
  });
  kickerText.position.set(textLeft - slideFrom, kickerCenterY);
  kickerText.alpha = 0;
  root.addChild(kickerText);
  timeline
    .to(kickerText, { prop: "alpha", from: 0, to: 1, start: 0.24, duration: 0.4, ease: outExpo })
    .to(kickerText, { prop: "x", from: textLeft - slideFrom, to: textLeft, start: 0.24, duration: 0.5, ease: outExpo });

  // --- Title (slides in, follows the kicker). ---
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  titleText.position.set(textLeft - slideFrom, titleCenterY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.36, duration: 0.42, ease: outExpo })
    .to(titleText, { prop: "x", from: textLeft - slideFrom, to: textLeft, start: 0.36, duration: 0.55, ease: outExpo });

  return { timeline, duration: 4.0 };
}

export const chapterMarker: TemplateDefinition = {
  id: "chapter-marker",
  name: "Chapter Marker",
  tagline: "An editorial chapter kicker and title slide in beside an accent rule.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { number: "display", kicker: "body", title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "number", type: "text", label: "Number", default: "01", maxLength: 4, shrinkToFit: true },
    { key: "kicker", type: "text", label: "Kicker", default: "CHAPTER", maxLength: 20, shrinkToFit: true },
    { key: "title", type: "text", label: "Title", default: "Getting started", maxLength: 40, shrinkToFit: true },
    { key: "showChip", type: "toggle", label: "Number chip", default: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

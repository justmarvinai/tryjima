import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
  safeRect,
  shrinkToFit,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const DEFAULT_ITEMS = ["#nofilter", "#goldenhour", "#reels"];
const ROWS_START = 0.75;
const PER_ROW = 0.4;
const HOLD = 1.8;

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", muted: "#F1F1F3" } },
  { id: "dark", name: "Dark", colors: { background: "#0B0B0F", textColor: "#FFFFFF", accent: "#FF4D1C", muted: "#1E1E24" } },
  { id: "electric", name: "Electric", colors: { background: "#0E1020", textColor: "#FFFFFF", accent: "#7C5CFF", muted: "#211F3D" } },
  { id: "mint", name: "Mint", colors: { background: "#EAFBF3", textColor: "#08221A", accent: "#17A34A", muted: "#DFF3E9" } },
];

function itemsOf(values: Values): string[] {
  return asItems(values.items, DEFAULT_ITEMS).slice(0, 4);
}

function computeDuration(values: Values): number {
  const n = itemsOf(values).length;
  const lastRowStart = ROWS_START + Math.max(0, n - 1) * PER_ROW;
  const settleEnd = lastRowStart + 0.55;
  const pulseEnd = settleEnd + 0.3 + 0.4;
  return pulseEnd + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const muted = pc("muted", "#F1F1F3");
  const onAccent = luminance(accent) < 0.5 ? "#FFFFFF" : "#101014";
  const title = str(values.title, "Trending now");
  const items = itemsOf(values);
  const showRank = values.showRank !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  // --- Header: bolt icon + title ---
  const iconSize = minDim * 0.062;
  const titleBase = Math.round(minDim * 0.05);
  const familyDisplay = fonts.family("display");
  const measureTitle = (s: string, sz: number): number =>
    fonts.measure(s, { family: familyDisplay, weight: 700, size: sz, letterSpacing: sz * 0.01 });
  const gapIconTitle = minDim * 0.026;
  const titleMaxW = safe.width * 0.7;
  const titleSize = shrinkToFit(title, measureTitle, { maxWidth: titleMaxW, baseSize: titleBase, minSize: Math.round(titleBase * 0.6) });
  const titleW = measureTitle(title, titleSize);
  const headerW = iconSize + gapIconTitle + titleW;
  const headerLeft = cx - headerW / 2;
  const headerY = safe.y + safe.height * 0.1;

  const iconHolder = new Container();
  iconHolder.addChild(makeIcon("bolt", iconSize, { color: accent }));
  iconHolder.position.set(headerLeft + iconSize / 2, headerY);
  iconHolder.scale.set(0);
  root.addChild(iconHolder);
  timeline
    .to(iconHolder, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.5, ease: makeOutBack(2) })
    .to(iconHolder, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.5, ease: makeOutBack(2) });

  const titleRestX = headerLeft + iconSize + gapIconTitle;
  const titleFromX = titleRestX + 14;
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: titleSize * 0.01,
  });
  titleText.position.set(titleFromX, headerY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.22, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: titleFromX, to: titleRestX, start: 0.22, duration: 0.5, ease: outExpo });

  // --- Ranked rows ---
  const n = items.length;
  const rowH = minDim * 0.145;
  const rowW = Math.min(safe.width * 0.86, minDim * 0.9);
  const rowLeftX = cx - rowW / 2;
  const rowFromX = rowLeftX - minDim * 0.03;
  const rowsTopY = safe.y + safe.height * 0.28;
  const rankBase = Math.round(minDim * 0.05);
  const labelBase = Math.round(minDim * 0.042);
  const padX = minDim * 0.045;

  let topRow: Container | null = null;
  items.forEach((itemRaw, i) => {
    const isTop = i === 0;
    const rowCy = rowsTopY + i * rowH + rowH / 2;
    const barH = isTop ? rowH * 0.78 : rowH * 0.66;
    const fill = isTop ? accent : muted;
    const rankColor = isTop ? onAccent : accent;
    const labelColor = isTop ? onAccent : textColor;
    const rSize = isTop ? Math.round(rankBase * 1.15) : rankBase;
    const lSize = isTop ? Math.round(labelBase * 1.1) : labelBase;

    const row = new Container();
    row.alpha = 0;
    row.position.set(rowFromX, rowCy);
    root.addChild(row);

    const bar = new Graphics().roundRect(0, -barH / 2, rowW, barH, barH * 0.24).fill(fill);
    bar.scale.set(0, 1);
    row.addChild(bar);

    if (showRank) {
      const rankText = makeText(fonts, { text: String(i + 1), role: "display", weight: 700, size: rSize, color: rankColor, anchor: { x: 0, y: 0.5 } });
      rankText.position.set(padX, 0);
      row.addChild(rankText);
    }

    const labelMaxW = rowW - padX * 2 - (showRank ? rSize * 1.2 : 0);
    const labelFamily = fonts.family("body");
    const measureLabel = (s: string, sz: number): number => fonts.measure(s, { family: labelFamily, weight: 600, size: sz });
    const fittedLabelSize = shrinkToFit(itemRaw, measureLabel, { maxWidth: labelMaxW, baseSize: lSize, minSize: Math.round(lSize * 0.55) });
    const labelText = makeText(fonts, { text: itemRaw, role: "body", weight: 600, size: fittedLabelSize, color: labelColor, anchor: { x: 0, y: 0.5 } });
    labelText.position.set(padX + (showRank ? rSize * 1.2 : 0), 0);
    row.addChild(labelText);

    const start = ROWS_START + i * PER_ROW;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(row, { prop: "x", from: rowFromX, to: rowLeftX, start, duration: 0.55, ease: outQuint })
      .to(bar, { prop: "scale.x", from: 0, to: 1, start, duration: 0.55, ease: outExpo });

    if (isTop) topRow = row;
  });

  // Emphasis pulse on the #1 row once the list has settled.
  if (topRow) {
    const lastRowStart = ROWS_START + Math.max(0, n - 1) * PER_ROW;
    const pulseAt = lastRowStart + 0.55 + 0.3;
    timeline
      .to(topRow, { prop: "scale.x", from: 1, to: 1.035, start: pulseAt, duration: 0.2, ease: outQuad })
      .to(topRow, { prop: "scale.y", from: 1, to: 1.035, start: pulseAt, duration: 0.2, ease: outQuad })
      .to(topRow, { prop: "scale.x", from: 1.035, to: 1, start: pulseAt + 0.2, duration: 0.2, ease: outQuad })
      .to(topRow, { prop: "scale.y", from: 1.035, to: 1, start: pulseAt + 0.2, duration: 0.2, ease: outQuad });
  }

  return { timeline, duration: computeDuration(values) };
}

export const trendingNow: TemplateDefinition = {
  id: "trending-now",
  name: "Trending Now",
  tagline: "A ranked trending list slides in row by row, top spot emphasized.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Trending now", maxLength: 24, shrinkToFit: true },
    { key: "items", type: "textlist", label: "Items", default: DEFAULT_ITEMS, minItems: 2, maxItems: 4, maxLength: 24 },
    { key: "showRank", type: "toggle", label: "Rank numbers", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
  ],
  build,
};

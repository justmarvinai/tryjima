import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

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
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

// chipBg is a palette-only checkbox surface. Labels sit in textColor on
// background (>= 4.5:1); the only text-on-color is the white check on accent.
const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#FFFFFF", textColor: "#10131A", accent: "#2E7DF6", chipBg: "#FFFFFF" } },
  { id: "sunny", name: "Sunny", colors: { background: "#FFF7E8", textColor: "#3A2A08", accent: "#DD7A16", chipBg: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A", chipBg: "#FFFFFF" } },
  { id: "coral", name: "Coral", colors: { background: "#FFF0EE", textColor: "#3A130C", accent: "#E2553C", chipBg: "#FFFFFF" } },
];

const DEFAULT_ITEMS = ["Passport & tickets", "Sunscreen", "Swimwear", "Phone charger", "Camera"];

const ROWS_START = 0.75;
const ROW_STAGGER = 0.42;
const TICK_OFFSET = 0.25;
const TICK_DUR = 0.4;
const HOLD = 1.1;

function itemsOf(values: Values): string[] {
  return asList(values.items, DEFAULT_ITEMS).slice(0, 6);
}

function computeDuration(values: Values): number {
  const n = Math.max(1, itemsOf(values).length);
  return ROWS_START + (n - 1) * ROW_STAGGER + TICK_OFFSET + TICK_DUR + HOLD;
}

function makeSuitcase(S: number, color: string, accent: string): Container {
  const c = new Container();
  const g = new Graphics();
  // Handle.
  g.roundRect(-0.17 * S, -0.56 * S, 0.34 * S, 0.22 * S, 0.1 * S).stroke({ color, width: Math.max(2, S * 0.06) });
  // Body.
  g.roundRect(-0.5 * S, -0.4 * S, 1.0 * S, 0.8 * S, 0.12 * S).fill(color);
  c.addChild(g);
  // Accent strap + latch.
  const strap = new Graphics();
  strap.rect(-0.5 * S, -0.08 * S, 1.0 * S, 0.16 * S).fill(accent);
  strap.roundRect(-0.1 * S, -0.13 * S, 0.2 * S, 0.26 * S, 0.04 * S).fill(color);
  c.addChild(strap);
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#10131A"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));
  const chipBg = pc("chipBg", "#FFFFFF");

  const destination = str(values.destination, "Bali");
  const items = itemsOf(values);
  const n = items.length;
  const showSuitcase = on(values.showSuitcase);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Header: suitcase + "Packing for <destination>" ---
  const suitR = showSuitcase ? minDim * 0.05 : 0;
  const suitGap = showSuitcase ? minDim * 0.03 : 0;
  const titleText = `Packing for ${destination}`;
  const titleX = zone.x + (showSuitcase ? suitR * 2 + suitGap : 0);
  const titleMaxW = zone.x + zone.width - titleX;
  const titleSize = fitSize(fonts, titleText, "display", 700, Math.round(minDim * 0.05), titleMaxW);
  const headerY = zone.y + Math.max(suitR, titleSize * 0.5);

  if (showSuitcase) {
    const suit = makeSuitcase(suitR * 2, textColor, accent);
    suit.position.set(zone.x + suitR, headerY);
    suit.scale.set(0);
    root.addChild(suit);
    timeline
      .to(suit, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.6, ease: makeOutBack(2) })
      .to(suit, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.6, ease: makeOutBack(2) });
  }

  const title = makeText(fonts, { text: titleText, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  title.position.set(titleX, headerY);
  title.alpha = 0;
  root.addChild(title);
  timeline
    .to(title, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(title, { prop: "x", from: titleX - 18, to: titleX, start: 0.15, duration: 0.5, ease: outQuint });

  // --- Checklist rows ---
  const rowsTop = headerY + Math.max(suitR, titleSize * 0.5) + minDim * 0.05;
  const rowsBottom = zone.y + zone.height;
  const rowH = (rowsBottom - rowsTop) / n;
  const boxSize = Math.min(rowH * 0.5, minDim * 0.06);
  const gap = boxSize * 0.62;
  const labelSize = Math.min(Math.round(rowH * 0.34), Math.round(minDim * 0.04));
  const labelMaxW = zone.width - boxSize - gap - minDim * 0.01;

  items.forEach((item, i) => {
    const rowCY = rowsTop + (i + 0.5) * rowH;
    const row = new Container();
    row.position.set(zone.x, rowCY);
    row.alpha = 0;
    root.addChild(row);

    const tintH = Math.min(rowH * 0.86, boxSize * 1.9);
    const tint = new Graphics()
      .roundRect(-boxSize * 0.3, -tintH / 2, zone.width + boxSize * 0.3, tintH, tintH * 0.28)
      .fill({ color: accent, alpha: 0.09 });
    tint.alpha = 0;
    row.addChild(tint);

    const boxCx = boxSize / 2;
    const boxBase = new Graphics()
      .roundRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, boxSize * 0.26)
      .fill(chipBg)
      .roundRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, boxSize * 0.26)
      .stroke({ color: textColor, width: Math.max(2, boxSize * 0.06), alpha: 0.28 });
    boxBase.position.set(boxCx, 0);
    row.addChild(boxBase);

    const fillBox = new Container();
    fillBox.position.set(boxCx, 0);
    fillBox.scale.set(0);
    fillBox.addChild(new Graphics().roundRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, boxSize * 0.26).fill(accent));
    row.addChild(fillBox);

    const check = makeIcon("check", boxSize * 0.72, { color: "#FFFFFF" });
    check.position.set(boxCx, 0);
    check.scale.set(0);
    row.addChild(check);

    const labelText = makeText(fonts, { text: item, role: "body", weight: 600, size: fitSize(fonts, item, "body", 600, labelSize, labelMaxW), color: textColor, anchor: { x: 0, y: 0.5 } });
    labelText.position.set(boxSize + gap, 0);
    row.addChild(labelText);

    const rowStart = ROWS_START + i * ROW_STAGGER;
    const tickAt = rowStart + TICK_OFFSET;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start: rowStart, duration: 0.4, ease: outQuad })
      .to(row, { prop: "x", from: zone.x + 24, to: zone.x, start: rowStart, duration: 0.5, ease: outQuint })
      .to(tint, { prop: "alpha", from: 0, to: 1, start: tickAt, duration: 0.4, ease: outQuad })
      .to(fillBox, { prop: "scale.x", from: 0, to: 1, start: tickAt, duration: TICK_DUR, ease: makeOutBack(2) })
      .to(fillBox, { prop: "scale.y", from: 0, to: 1, start: tickAt, duration: TICK_DUR, ease: makeOutBack(2) })
      .to(check, { prop: "scale.x", from: 0, to: 1, start: tickAt + 0.08, duration: TICK_DUR, ease: makeOutBack(2.4) })
      .to(check, { prop: "scale.y", from: 0, to: 1, start: tickAt + 0.08, duration: TICK_DUR, ease: makeOutBack(2.4) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const packingList: TemplateDefinition = {
  id: "packing-list",
  name: "Packing List",
  tagline: "A trip checklist ticks off its items one by one beside a little suitcase.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.4,
  estimateDuration: computeDuration,
  fontRoles: { destination: "display", items: "body" },
  palettes: PALETTES,
  fields: [
    { key: "destination", type: "text", label: "Destination", default: "Bali", maxLength: 22, shrinkToFit: true },
    { key: "items", type: "textlist", label: "Items", default: DEFAULT_ITEMS, minItems: 3, maxItems: 6, maxLength: 40 },
    { key: "showSuitcase", type: "toggle", label: "Suitcase", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

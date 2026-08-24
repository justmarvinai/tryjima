import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
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
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
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
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// Rows tick one by one, so the only text-on-color pairing is the white check
// glyph on the accent box (a decorative graphic, not label text). Label text is
// always textColor-on-background; every palette keeps that ≥ 4.5:1. `chipBg` is
// palette-only (the empty checkbox fill).
const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", chipBg: "#FFFFFF" } },
  { id: "mint", name: "Mint", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A", chipBg: "#FFFFFF" } },
  { id: "sky", name: "Sky", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", chipBg: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", chipBg: "#FFFFFF" } },
];

const DEFAULT_ITEMS = [
  "Write the launch post",
  "Schedule the reel",
  "Reply to early comments",
  "Update the link in bio",
  "Send the newsletter",
];

const ROWS_START = 0.7;
const ROW_STAGGER = 0.5;
const TICK_OFFSET = 0.3;
const TICK_DUR = 0.4;
const HOLD = 1.1;

function itemsOf(values: Values): string[] {
  return asList(values.items, DEFAULT_ITEMS).slice(0, 6);
}

function computeDuration(values: Values): number {
  const n = Math.max(1, itemsOf(values).length);
  return ROWS_START + (n - 1) * ROW_STAGGER + TICK_OFFSET + TICK_DUR + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const chipBg = pc("chipBg", "#FFFFFF");

  const title = str(values.title, "Launch checklist");
  const items = itemsOf(values);
  const n = items.length;
  const showProgress = values.showProgress !== false;
  const showAccentBar = values.accentBar !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);

  // --- Title (+ optional progress readout on the right) ---
  const progressAll = `${n}/${n} done`;
  const progressSize = showProgress ? Math.round(minDim * 0.032) : 0;
  const progressW = showProgress
    ? fonts.measure(progressAll, { family: fonts.family("body"), weight: 700, size: progressSize }) + minDim * 0.02
    : 0;

  const titleMaxW = zone.width - progressW;
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.052), titleMaxW);
  const titleY = zone.y + titleSize * 0.75;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  titleText.position.set(zone.x, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: zone.x - 20, to: zone.x, start: 0, duration: 0.5, ease: outQuint });

  let progressText: Text | null = null;
  const tickTimes: number[] = [];
  if (showProgress) {
    progressText = makeText(fonts, { text: `0/${n} done`, role: "body", weight: 700, size: progressSize, color: accent, anchor: { x: 1, y: 0.5 } });
    progressText.position.set(zone.x + zone.width, titleY);
    progressText.alpha = 0;
    root.addChild(progressText);
    timeline.to(progressText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad });
  }

  if (showAccentBar) {
    const ruleW = titleSize * 1.6;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(zone.x, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outQuint });
  }

  // --- Rows ---
  const rowsTop = titleY + titleSize * (showAccentBar ? 1.05 : 0.85) + minDim * 0.04;
  const rowsBottom = zone.y + zone.height;
  const rowAreaH = rowsBottom - rowsTop;
  const rowH = rowAreaH / n;
  const boxSize = Math.min(rowH * 0.5, minDim * 0.062);
  const gap = boxSize * 0.62;
  const labelSize = Math.min(Math.round(rowH * 0.34), Math.round(minDim * 0.04));
  const labelMaxW = zone.width - boxSize - gap - minDim * 0.01;

  items.forEach((item, i) => {
    const rowCY = rowsTop + (i + 0.5) * rowH;
    const row = new Container();
    row.position.set(zone.x, rowCY);
    row.alpha = 0;
    root.addChild(row);

    // Subtle accent tint behind the row once it is ticked.
    const tintH = Math.min(rowH * 0.86, boxSize * 1.9);
    const tint = new Graphics()
      .roundRect(-boxSize * 0.3, -tintH / 2, zone.width + boxSize * 0.3, tintH, tintH * 0.28)
      .fill({ color: accent, alpha: 0.09 });
    tint.alpha = 0;
    row.addChild(tint);

    // Empty checkbox outline (visible from row entrance).
    const boxCx = boxSize / 2;
    const boxBase = new Graphics()
      .roundRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, boxSize * 0.26)
      .fill(chipBg)
      .roundRect(-boxSize / 2, -boxSize / 2, boxSize, boxSize, boxSize * 0.26)
      .stroke({ color: textColor, width: Math.max(2, boxSize * 0.06), alpha: 0.28 });
    boxBase.position.set(boxCx, 0);
    row.addChild(boxBase);

    // Accent fill + white check that pop at tick time.
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
    tickTimes.push(tickAt + TICK_DUR * 0.45);
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start: rowStart, duration: 0.4, ease: outQuad })
      .to(row, { prop: "x", from: zone.x + 26, to: zone.x, start: rowStart, duration: 0.5, ease: outQuint })
      .to(tint, { prop: "alpha", from: 0, to: 1, start: tickAt, duration: 0.4, ease: outQuad })
      .to(fillBox, { prop: "scale.x", from: 0, to: 1, start: tickAt, duration: TICK_DUR, ease: makeOutBack(2) })
      .to(fillBox, { prop: "scale.y", from: 0, to: 1, start: tickAt, duration: TICK_DUR, ease: makeOutBack(2) })
      .to(check, { prop: "scale.x", from: 0, to: 1, start: tickAt + 0.08, duration: TICK_DUR, ease: makeOutBack(2.4) })
      .to(check, { prop: "scale.y", from: 0, to: 1, start: tickAt + 0.08, duration: TICK_DUR, ease: makeOutBack(2.4) });
  });

  const update = (t: number): void => {
    let done = 0;
    for (const tt of tickTimes) if (t >= tt) done++;
    if (progressText) progressText.text = `${done}/${n} done`;
  };

  return showProgress
    ? { timeline, duration: computeDuration(values), update }
    : { timeline, duration: computeDuration(values) };
}

export const checklist: TemplateDefinition = {
  id: "checklist",
  name: "Checklist",
  tagline: "A checklist ticks off its rows one by one, top to bottom.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.9,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", items: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Launch checklist", maxLength: 32, shrinkToFit: true },
    { key: "items", type: "textlist", label: "Items", default: DEFAULT_ITEMS, minItems: 3, maxItems: 6, maxLength: 44 },
    { key: "showProgress", type: "toggle", label: "Progress count", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  outCubic,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type Values,
  type TemplateDefinition,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

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

// The #1 gold accent is a fixed pair (bright gold + near-black number) verified
// ≥ 4.5:1; card surfaces use their own palette key so labels stay legible.
const GOLD = "#F6B93B";
const GOLD_TEXT = "#3A2A00";

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#F4F6FA", textColor: "#101014", accent: "#2E7DF6", cardBg: "#FFFFFF", rankBg: "#EAEDF3" } },
  { id: "dark", name: "Dark", colors: { background: "#0E0E12", textColor: "#FFFFFF", accent: "#33E2A0", cardBg: "#1B1B22", rankBg: "#2A2A33" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", cardBg: "#FFFFFF", rankBg: "#E9E1FB" } },
  { id: "sunset", name: "Sunset", colors: { background: "#FFF4EC", textColor: "#401D07", accent: "#FF7A1A", cardBg: "#FFFFFF", rankBg: "#FBE6D6" } },
];

interface Entry {
  name: string;
  value: number;
  display: string;
  countable: boolean;
}

const NUM_RE = /^[\d,]+$/;
const DEFAULT_ENTRIES = ["Aria|9,820", "Milo|8,140", "Zoe|7,650", "Kai|6,900", "Nia|5,430"];

function parseEntry(raw: string): Entry {
  const idx = raw.indexOf("|");
  const name = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const valPart = (idx >= 0 ? raw.slice(idx + 1) : "0").trim();
  return {
    name: name.length ? name : "—",
    value: parseTargetNumber(valPart),
    display: valPart.length ? valPart : "0",
    countable: NUM_RE.test(valPart),
  };
}

function entriesOf(values: Values): Entry[] {
  return asList(values.entries, DEFAULT_ENTRIES)
    .slice(0, 5)
    .map(parseEntry)
    .sort((a, b) => b.value - a.value);
}

const ROW_START = 0.5;
const ROW_EACH = 0.16;
const ROW_DUR = 0.5;
const BAR_GROW = 0.75;
const HOLD = 0.95;

function computeDuration(values: Values): number {
  const n = entriesOf(values).length;
  return ROW_START + (n - 1) * ROW_EACH + 0.2 + BAR_GROW + HOLD;
}

function titleFrac(aspect: Aspect): number {
  return aspect === "9:16" ? 0.135 : aspect === "16:9" ? 0.12 : 0.11;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const rankBg = pc("rankBg", "#EAEDF3");

  const title = str(values.title, "Top players");
  const showBars = values.showBars !== false;
  const highlightTop = values.highlightTop !== false;
  const showAccentBar = values.accentBar !== false;

  const entries = entriesOf(values);
  const n = entries.length;
  const maxVal = Math.max(1, ...entries.map((e) => e.value));

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const safe = safeRect(ctx.aspect);

  // --- Title (+ accent underline) ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.052), safe.width);
  const titleY = h * titleFrac(ctx.aspect);
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  titleText.position.set(safe.x, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: safe.x - 16, to: safe.x, start: 0, duration: 0.5, ease: outQuint });

  if (showAccentBar) {
    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(safe.x, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
  }

  // --- Rows region ---
  const rowsTop = titleY + titleSize * 0.95 + minDim * 0.045;
  const rowsBottom = safe.y + safe.height;
  const slotH = (rowsBottom - rowsTop) / n;
  const cardH = Math.min(slotH * 0.82, minDim * 0.15);
  const cardW = safe.width;
  const cardLeft = safe.x;
  const rowGap = slotH - cardH;
  const radius = cardH * 0.26;

  const nameFont = Math.round(cardH * 0.32);
  const valueFont = Math.round(cardH * 0.34);
  const rankFont = Math.round(cardH * 0.36);
  const badgeR = cardH * 0.34;
  const padX = cardH * 0.32;

  const counters: { text: Text; value: number; start: number; entry: Entry }[] = [];

  entries.forEach((e, i) => {
    const isTop = i === 0 && highlightTop;
    const slotY = rowsTop + i * slotH + rowGap / 2;
    const cy = slotY + cardH / 2;
    const start = ROW_START + i * ROW_EACH;

    const row = new Container();
    row.position.set(cardLeft + cardW / 2, cy);
    row.alpha = 0;
    root.addChild(row);

    // Shadow + card surface.
    const shOff = Math.round(cardH * 0.05);
    row.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + shOff, cardW, cardH, radius).fill({ color: "#000000", alpha: 0.1 }));
    row.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill(cardBg));
    if (isTop) {
      row.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).stroke({ color: GOLD, width: Math.max(2.5, cardH * 0.045) }));
    }

    // Proportional value bar behind text (grows).
    const barMaxW = cardW - padX * 2;
    const barW = Math.max(cardH * 0.5, barMaxW * (e.value / maxVal));
    if (showBars) {
      const bar = new Graphics().roundRect(0, 0, barW, cardH * 0.7, cardH * 0.18).fill({ color: isTop ? GOLD : accent, alpha: isTop ? 0.2 : 0.14 });
      bar.position.set(-cardW / 2 + padX, -cardH * 0.35);
      bar.scale.set(0, 1);
      row.addChild(bar);
      timeline.to(bar, { prop: "scale.x", from: 0, to: 1, start: start + 0.18, duration: BAR_GROW, ease: outExpo });
    }

    // Rank badge.
    const badge = new Container();
    badge.position.set(-cardW / 2 + padX + badgeR, 0);
    badge.scale.set(0);
    badge.addChild(new Graphics().circle(0, 0, badgeR).fill(isTop ? GOLD : rankBg));
    badge.addChild(makeText(fonts, { text: String(i + 1), role: "display", weight: 700, size: rankFont, color: isTop ? GOLD_TEXT : textColor, anchor: 0.5 }));
    row.addChild(badge);
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: start + 0.12, duration: 0.45, ease: makeOutBack(2) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: start + 0.12, duration: 0.45, ease: makeOutBack(2) });

    // Value (right).
    const valueText = makeText(fonts, { text: e.countable ? "0" : e.display, role: "display", weight: 700, size: valueFont, color: textColor, anchor: { x: 1, y: 0.5 } });
    valueText.position.set(cardW / 2 - padX, 0);
    row.addChild(valueText);
    if (e.countable) counters.push({ text: valueText, value: e.value, start: start + 0.18, entry: e });
    const valueW = fonts.measure(e.countable ? groupThousands(e.value) : e.display, { family: fonts.family("display"), weight: 700, size: valueFont });

    // Name.
    const nameLeft = -cardW / 2 + padX + badgeR * 2 + padX * 0.7;
    const nameMaxW = cardW / 2 - padX - valueW - padX * 0.6 - nameLeft;
    const nameSize = fitSize(fonts, e.name, "display", 700, nameFont, Math.max(minDim * 0.06, nameMaxW));
    const nameText = makeText(fonts, { text: e.name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    nameText.position.set(nameLeft, 0);
    row.addChild(nameText);

    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(row, { prop: "x", from: cardLeft + cardW / 2 - 30, to: cardLeft + cardW / 2, start, duration: ROW_DUR, ease: outExpo });

    if (isTop) {
      const lastStart = ROW_START + (n - 1) * ROW_EACH + 0.18 + BAR_GROW;
      timeline
        .to(row, { prop: "scale.x", from: 1, to: 1.025, start: lastStart, duration: 0.16, ease: outQuad })
        .to(row, { prop: "scale.y", from: 1, to: 1.025, start: lastStart, duration: 0.16, ease: outQuad })
        .to(row, { prop: "scale.x", from: 1.025, to: 1, start: lastStart + 0.16, duration: 0.26, ease: outQuad })
        .to(row, { prop: "scale.y", from: 1.025, to: 1, start: lastStart + 0.16, duration: 0.26, ease: outQuad });
    }
  });

  const update = (t: number): void => {
    for (const c of counters) {
      const p = outCubic(clamp01((t - c.start) / BAR_GROW));
      c.text.text = groupThousands(Math.round(c.value * p));
    }
  };

  return { timeline, duration: computeDuration(values), update };
}

export const leaderboard: TemplateDefinition = {
  id: "leaderboard",
  name: "Leaderboard",
  tagline: "Ranked rows slide in and count up, with the leader crowned in gold.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.7,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", entries: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Top players", maxLength: 28, optional: true, shrinkToFit: true },
    {
      key: "entries",
      type: "textlist",
      label: "Entries (name | value)",
      default: DEFAULT_ENTRIES,
      minItems: 2,
      maxItems: 5,
      maxLength: 26,
      help: 'One per line as "name | value". Rows are sorted highest-first.',
    },
    { key: "showBars", type: "toggle", label: "Value bars", default: true },
    { key: "highlightTop", type: "toggle", label: "Gold #1", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

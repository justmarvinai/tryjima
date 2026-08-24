import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

interface Stat {
  label: string;
  prefix: string;
  suffix: string;
  target: number;
  isStatic: boolean;
  raw: string;
}

/** Parse "Viewers | 1,240" into a label + an animatable value. */
function parseStat(raw: string, fallbackLabel: string): Stat {
  const parts = raw.split("|");
  const label = (parts[0] ?? "").trim() || fallbackLabel;
  const valueRaw = (parts[1] ?? "").trim();
  const m = /^(\D*)(\d[\d,]*)(.*)$/.exec(valueRaw);
  if (!m) return { label, prefix: "", suffix: "", target: 0, isStatic: true, raw: valueRaw || "0" };
  return { label, prefix: m[1] ?? "", suffix: m[3] ?? "", target: parseTargetNumber(m[2] ?? ""), isStatic: false, raw: valueRaw };
}

const fmtStat = (s: Stat, p: number): string =>
  s.isStatic ? s.raw : s.prefix + groupThousands(Math.round(s.target * p)) + s.suffix;

const DEFAULT_STATS = ["Viewers | 1,240", "Likes | 8,530", "Followers | 24,100"];

function statsOf(values: Values): Stat[] {
  return asList(values.stats, DEFAULT_STATS)
    .slice(0, 3)
    .map((r, i) => parseStat(r, `Stat ${i + 1}`));
}

// A bottom strip of 2–3 mini live stats whose numbers count up (pure fn of t).
// Only the full-frame `bg` rect is tied to the background field (defaults to the
// transparent sentinel so it composites straight onto footage); the strip uses
// its own palette-only `stripBg` (with a soft shadow) so the stats survive once
// the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { stripBg: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", divider: "#2A2A31" } },
  { id: "paper", name: "Paper", colors: { stripBg: "#FFFFFF", textColor: "#101014", accent: "#2E5BD6", divider: "#E4E6EA" } },
  { id: "mint", name: "Mint", colors: { stripBg: "#FFFFFF", textColor: "#0B1F16", accent: "#17A34A", divider: "#E0EFE7" } },
  { id: "night", name: "Night", colors: { stripBg: "#131A2A", textColor: "#FFFFFF", accent: "#66A9FF", divider: "#26314A" } },
];

const COUNT_START0 = 0.55;
const COUNT_STAGGER = 0.14;
const COUNT_DUR = 0.9;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const stripBg = pc("stripBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const divider = pc("divider", "#2A2A31");
  const showDivider = values.showDivider !== false;
  const stats = statsOf(values);
  const n = stats.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Strip geometry (full safe width). ---
  const stripW = w - zone.left - zone.right;
  const stripH = Math.round(minDim * 0.11);
  const stripRadius = Math.round(minDim * 0.014);
  const padX = Math.round(minDim * 0.02);
  const innerW = stripW - padX * 2;
  const cellW = innerW / n;

  const margin = Math.round(minDim * 0.03);
  const stripCX = w / 2;
  const stripCY = h - zone.bottom - margin - stripH / 2;

  const strip = new Container();
  const slideOffset = stripH + minDim * 0.06;
  strip.position.set(stripCX, stripCY + slideOffset);
  strip.alpha = 0;
  root.addChild(strip);

  const e = Math.round(stripRadius * 0.5);
  const shOff = Math.round(stripRadius * 0.6);
  strip.addChild(
    new Graphics()
      .roundRect(-stripW / 2 - e, -stripH / 2 - e + shOff, stripW + e * 2, stripH + e * 2, stripRadius + e)
      .fill({ color: "#000000", alpha: 0.2 }),
  );
  strip.addChild(new Graphics().roundRect(-stripW / 2, -stripH / 2, stripW, stripH, stripRadius).fill(stripBg));

  // --- Dividers between cells (toggleable). ---
  if (showDivider && n > 1) {
    const dH = Math.round(stripH * 0.5);
    for (let i = 1; i < n; i++) {
      const dx = -innerW / 2 + i * cellW;
      strip.addChild(new Graphics().roundRect(dx - 1, -dH / 2, 2, dH, 1).fill(divider));
    }
  }

  // --- Cells: count-up number over a muted label. ---
  const numSize0 = Math.round(stripH * 0.34);
  const labelSize0 = Math.round(stripH * 0.2);
  const vGap = Math.round(stripH * 0.06);

  const numNodes: { text: Text; stat: Stat }[] = [];

  stats.forEach((s, i) => {
    const slotCX = -innerW / 2 + (i + 0.5) * cellW;
    const cellBudget = cellW * 0.88;

    const finalNum = fmtStat(s, 1);
    const numSize = fitSize(fonts, finalNum, "display", 700, numSize0, cellBudget);
    const labelSize = fitSize(fonts, s.label, "body", 600, labelSize0, cellBudget);
    const contentH = numSize + vGap + labelSize;

    const cell = new Container();
    cell.position.set(slotCX, 0);
    cell.alpha = 0;
    strip.addChild(cell);

    const numText = makeText(fonts, { text: fmtStat(s, 0), role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5 });
    numText.position.set(0, -contentH / 2 + numSize / 2);
    cell.addChild(numText);
    numNodes.push({ text: numText, stat: s });

    // A tiny accent tick above the number keeps the strip lively.
    const tickW = Math.round(numSize * 0.5);
    const tick = new Graphics().roundRect(-tickW / 2, -contentH / 2 - Math.round(stripH * 0.05), tickW, Math.max(2, Math.round(stripH * 0.03)), 2).fill(accent);
    cell.addChild(tick);

    const labelText = makeText(fonts, { text: s.label, role: "body", weight: 600, size: labelSize, color: textColor, anchor: 0.5 });
    labelText.alpha = 0.66;
    labelText.position.set(0, contentH / 2 - labelSize / 2);
    cell.addChild(labelText);

    const start = 0.2 + i * 0.08;
    timeline.to(cell, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad });
  });

  // --- Entrance: the strip slides up + fades in. ---
  const enterStart = 0.1;
  const enterDur = 0.55;
  timeline
    .to(strip, { prop: "position.y", from: stripCY + slideOffset, to: stripCY, start: enterStart, duration: enterDur, ease: outExpo })
    .to(strip, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.3, ease: outQuad });

  const update = (t: number): void => {
    numNodes.forEach(({ text, stat }, i) => {
      const start = COUNT_START0 + i * COUNT_STAGGER;
      const p = clamp01((t - start) / COUNT_DUR);
      text.text = fmtStat(stat, outExpo(p));
    });
  };

  return { timeline, duration: 4.2, update };
}

export const statStrip: TemplateDefinition = {
  id: "stat-strip",
  name: "Stat Strip",
  tagline: "A bottom strip of 2–3 live stats that count up together.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { stats: "display" },
  palettes: PALETTES,
  fields: [
    {
      key: "stats",
      type: "textlist",
      label: "Stats (label | value)",
      default: DEFAULT_STATS,
      minItems: 2,
      maxItems: 3,
      maxLength: 24,
      help: 'One per line as "label | value", e.g. "Viewers | 1,240".',
    },
    { key: "showDivider", type: "toggle", label: "Dividers", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

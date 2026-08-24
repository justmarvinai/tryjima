import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon, ICON_NAMES, type IconName } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

const ICON_SET = new Set<string>(ICON_NAMES);
const DEFAULT_FEATURES = [
  "bolt | Fast | Renders in seconds",
  "check | Free | No account ever",
  "heart | Loved | By 10k creators",
  "star | Simple | No timeline",
];

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", accent: "#FF4D1C", textColor: "#101014", card: "#FFFFFF", muted: "#5B5B68" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", card: "#FFFFFF", muted: "#6B6088" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", card: "#FFFFFF", muted: "#52607A" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", accent: "#84CC16", textColor: "#FFFFFF", card: "#1B1D22", muted: "#A7ADB8" } },
];

interface FCfg {
  titleYF: number;
  bandTopF: number;
  bandBotF: number;
  titleF: number;
  availWF: number;
}

const FCFG: Record<Aspect, FCfg> = {
  "1:1": { titleYF: 0.12, bandTopF: 0.24, bandBotF: 0.9, titleF: 0.058, availWF: 0.86 },
  "4:5": { titleYF: 0.11, bandTopF: 0.22, bandBotF: 0.9, titleF: 0.058, availWF: 0.86 },
  "9:16": { titleYF: 0.14, bandTopF: 0.22, bandBotF: 0.78, titleF: 0.06, availWF: 0.82 },
  "16:9": { titleYF: 0.14, bandTopF: 0.3, bandBotF: 0.9, titleF: 0.05, availWF: 0.9 },
};

interface Feature {
  icon: IconName | null;
  title: string;
  blurb: string;
}

function parseFeature(raw: string): Feature {
  const parts = raw.split("|").map((s) => s.trim());
  const p0 = parts[0] ?? "";
  if (ICON_SET.has(p0)) {
    return { icon: p0 as IconName, title: parts[1] ?? "", blurb: parts[2] ?? "" };
  }
  return { icon: null, title: p0, blurb: parts[1] ?? "" };
}

function featureList(values: Values): Feature[] {
  return asItems(values.features, DEFAULT_FEATURES).slice(0, 4).map(parseFeature);
}

function computeDuration(values: Values): number {
  return 1.0 + featureList(values).length * 0.35 + 1.4;
}

interface Cell {
  cx: number;
  cy: number;
  w: number;
  h: number;
  horizontal: boolean;
}

function layout(aspect: Aspect, size: TemplateContext["size"], cfg: FCfg, n: number): Cell[] {
  const cols = aspect === "16:9" ? n : aspect === "9:16" ? 1 : 2;
  const rows = Math.ceil(n / cols);
  const cx = size.width / 2;
  const availW = size.width * cfg.availWF;
  const bandTop = size.height * cfg.bandTopF;
  const bandH = size.height * (cfg.bandBotF - cfg.bandTopF);
  const cellW = availW / cols;
  const cellH = bandH / rows;
  const cardW = cellW * 0.9;
  const cardH = cellH * 0.86;
  const horizontal = cardW > cardH * 1.6;
  const cells: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const inRow = Math.min(cols, n - row * cols);
    const startX = cx - (inRow * cellW) / 2 + cellW / 2;
    cells.push({ cx: startX + col * cellW, cy: bandTop + (row + 0.5) * cellH, w: cardW, h: cardH, horizontal });
  }
  return cells;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function iconChip(feat: Feature, side: number, accent: string, holeColor: string): Container {
  const chip = new Container();
  chip.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, side * 0.28).fill({ color: accent, alpha: 0.14 }));
  if (feat.icon) {
    chip.addChild(makeIcon(feat.icon, side * 0.56, { color: accent, holeColor }));
  } else {
    chip.addChild(new Graphics().circle(0, 0, side * 0.16).fill(accent));
  }
  return chip;
}

function makeCard(
  feat: Feature,
  cell: Cell,
  accent: string,
  textColor: string,
  muted: string,
  cardBg: string,
  borderC: string,
  fonts: TemplateContext["fonts"],
  showFrame: boolean,
): Container {
  const { w, h, horizontal } = cell;
  const r = Math.min(w, h) * 0.12;
  const card = new Container();
  card.addChild(new Graphics().roundRect(-w / 2, -h / 2 + h * 0.05, w, h, r).fill({ color: 0x000000, alpha: 0.08 }));
  const cardBase = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(cardBg);
  if (showFrame) {
    cardBase.stroke({ color: borderC, width: Math.max(1, w * 0.006), alpha: 0.35 });
  }
  card.addChild(cardBase);

  if (horizontal) {
    const side = Math.min(h * 0.52, w * 0.24);
    const chipX = -w / 2 + w * 0.06 + side / 2;
    const chip = iconChip(feat, side, accent, cardBg);
    chip.position.set(chipX, 0);
    card.addChild(chip);
    const textX = chipX + side / 2 + w * 0.05;
    const maxW = w / 2 - w * 0.05 - textX;
    const titleSize = Math.round(h * 0.24);
    const title = fitText(
      fonts,
      { text: feat.title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } },
      maxW,
    );
    title.position.set(textX, feat.blurb.length > 0 ? -h * 0.14 : 0);
    card.addChild(title);
    if (feat.blurb.length > 0) {
      const blurb = fitText(
        fonts,
        { text: feat.blurb, role: "body", weight: 500, size: Math.round(h * 0.16), color: muted, anchor: { x: 0, y: 0.5 } },
        maxW,
      );
      blurb.position.set(textX, h * 0.16);
      card.addChild(blurb);
    }
  } else {
    const side = Math.min(h * 0.34, w * 0.4);
    const chip = iconChip(feat, side, accent, cardBg);
    chip.position.set(0, -h * 0.24);
    card.addChild(chip);
    const titleSize = Math.round(Math.min(w, h) * 0.13);
    const title = fitText(
      fonts,
      { text: feat.title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.84,
    );
    title.position.set(0, feat.blurb.length > 0 ? h * 0.04 : h * 0.14);
    card.addChild(title);
    if (feat.blurb.length > 0) {
      const blurb = fitText(
        fonts,
        { text: feat.blurb, role: "body", weight: 500, size: Math.round(Math.min(w, h) * 0.088), color: muted, anchor: 0.5, align: "center" },
        w * 0.86,
      );
      blurb.position.set(0, h * 0.26);
      card.addChild(blurb);
    }
  }
  return card;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF4EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const cardBg = pc("card", "#FFFFFF");
  const muted = pc("muted", "#5B5B68");
  const title = str(values.title, "Why you'll love it");
  const features = featureList(values);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const cfg = FCFG[ctx.aspect];
  const w = size.width;
  const h = size.height;
  const timeline = new JimaTimeline();

  const cells = layout(ctx.aspect, size, cfg, features.length);
  const showFrame = values.frame !== false;
  features.forEach((feat, i) => {
    const cell = cells[i];
    if (!cell) return;
    const card = makeCard(feat, cell, accent, textColor, muted, cardBg, textColor, fonts, showFrame);
    card.position.set(cell.cx, cell.cy + cell.h * 0.1);
    card.scale.set(0);
    card.alpha = 0;
    root.addChild(card);
    const start = 1.0 + i * 0.35;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(card, { prop: "y", from: cell.cy + cell.h * 0.1, to: cell.cy, start, duration: 0.66, ease: spring(0.5) })
      .to(card, { prop: "scale.x", from: 0, to: 1, start, duration: 0.66, ease: spring(0.5) })
      .to(card, { prop: "scale.y", from: 0, to: 1, start, duration: 0.66, ease: spring(0.5) });
  });

  // Section title on top.
  const titleSize = Math.round(w * cfg.titleF);
  const titleY = h * cfg.titleYF;
  const titleText = fitText(
    fonts,
    { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
    w * 0.86,
  );
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 18, to: titleY, start: 0.1, duration: 0.6, ease: outExpo });

  return { timeline, duration: computeDuration(values) };
}

export const featureGrid: TemplateDefinition = {
  id: "feature-grid",
  name: "Feature Grid",
  tagline: "Feature cards pop in around a headline.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Why you'll love it", maxLength: 40, shrinkToFit: true },
    { key: "features", type: "textlist", label: "Features", default: DEFAULT_FEATURES, minItems: 2, maxItems: 4, maxLength: 44, help: "One per line as \"icon | title | blurb\" (icon optional)." },
    { key: "frame", type: "toggle", label: "Frame", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

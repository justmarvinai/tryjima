import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
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
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// Every word color is verified ≥ 4.5:1 on its palette background (dark hues on
// light, light hues on dark); `accent` is the top-word emphasis color and is
// held to the same bar.
const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#C2255C", wordB: "#1C7A4D", wordC: "#2557D6" } },
  { id: "cream", name: "Cream", colors: { background: "#FFF7F0", textColor: "#3A1500", accent: "#C2255C", wordB: "#1C6E5A", wordC: "#2557D6" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#C2255C", wordB: "#1C7A4D", wordC: "#5B2AB5" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#FFB4C6", wordB: "#7EE5A8", wordC: "#8FC2FF" } },
];

interface Word {
  text: string;
  weight: number;
}

const DEFAULT_WORDS = [
  "growth|10",
  "brand|8",
  "reach|7",
  "content|6",
  "video|6",
  "story|5",
  "reels|5",
  "hooks|4",
  "caption|4",
  "trend|3",
  "viral|5",
  "engage|4",
];

function parseWord(raw: string): Word {
  const idx = raw.indexOf("|");
  const text = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const wPart = (idx >= 0 ? raw.slice(idx + 1) : "5").trim();
  const num = Number(wPart.replace(/[^\d.]/g, ""));
  return { text: text.length ? text : "word", weight: Number.isFinite(num) && num > 0 ? num : 5 };
}

function wordsOf(values: Values): Word[] {
  return asList(values.words, DEFAULT_WORDS)
    .slice(0, 14)
    .map(parseWord)
    .sort((a, b) => b.weight - a.weight);
}

const POP_START = 0.35;
const POP_EACH = 0.1;
const POP_DUR = 0.5;
const HOLD = 1.0;

function computeDuration(values: Values): number {
  const n = wordsOf(values).length;
  return POP_START + (n - 1) * POP_EACH + POP_DUR + HOLD;
}

function titleFrac(aspect: Aspect): number {
  return aspect === "9:16" ? 0.12 : aspect === "16:9" ? 0.1 : 0.09;
}

interface Placed {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#C2255C"));
  const wordB = pc("wordB", "#1C7A4D");
  const wordC = pc("wordC", "#2557D6");

  const title = str(values.title, "What we do");
  const showTitle = values.showTitle !== false && title.length > 0;
  const multicolor = values.multicolor !== false;

  const words = wordsOf(values);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const safe = safeRect(ctx.aspect);

  // --- Optional title ---
  let regionTop = safe.y;
  if (showTitle) {
    const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.042), safe.width);
    const titleY = h * titleFrac(ctx.aspect);
    const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
    titleText.position.set(w / 2, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "y", from: titleY - 12, to: titleY, start: 0, duration: 0.5, ease: outQuint });
    regionTop = titleY + titleSize * 0.9 + minDim * 0.03;
  }

  // --- Placement region ---
  const region = { x: safe.x, y: regionTop, width: safe.width, height: safe.y + safe.height - regionTop };
  const regionCX = region.x + region.width / 2;
  const regionCY = region.y + region.height / 2;

  const weights = words.map((wd) => wd.weight);
  const minW = Math.min(...weights);
  const maxW = Math.max(...weights);
  const sizeMax = minDim * 0.11;
  const sizeMin = minDim * 0.036;
  const midThresh = (minW + maxW) / 2;

  const yStretch = region.height / region.width; // fill region shape
  const placed: Placed[] = [];
  const spiralA = minDim * 0.0016;

  const colorFor = (rank: number): string => {
    if (!multicolor) return textColor;
    if (rank === 0) return accent;
    const set = [textColor, wordB, wordC, accent];
    return set[rng.int(0, set.length - 1)] ?? textColor;
  };

  words.forEach((wd, rank) => {
    const t = maxW > minW ? (wd.weight - minW) / (maxW - minW) : 0.6;
    const fw = wd.weight >= midThresh ? 700 : 500;
    let fsize = sizeMin + (sizeMax - sizeMin) * Math.pow(t, 0.85);
    fsize = fitSize(fonts, wd.text, "display", fw, fsize, region.width * 0.96);
    const measuredW = fonts.measure(wd.text, { family: fonts.family("display"), weight: fw, size: fsize });
    const pad = fsize * 0.14;
    const hw = measuredW / 2 + pad;
    const hh = fsize * 0.62 + pad;

    // Deterministic spiral search for a non-overlapping slot.
    let px = regionCX;
    let py = regionCY;
    let ang = rng.range(0, Math.PI * 2);
    for (let step = 0; step < 900; step++) {
      const rad = spiralA * ang;
      const cxTry = regionCX + Math.cos(ang) * rad;
      const cyTry = regionCY + Math.sin(ang) * rad * yStretch;
      ang += 0.35;
      if (cxTry - hw < region.x || cxTry + hw > region.x + region.width) continue;
      if (cyTry - hh < region.y || cyTry + hh > region.y + region.height) continue;
      let overlaps = false;
      for (const p of placed) {
        if (Math.abs(cxTry - p.x) < hw + p.hw && Math.abs(cyTry - p.y) < hh + p.hh) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        px = cxTry;
        py = cyTry;
        break;
      }
    }
    placed.push({ x: px, y: py, hw, hh });

    const wordC0 = new Container();
    wordC0.position.set(px, py);
    wordC0.scale.set(0);
    wordC0.alpha = 0;
    wordC0.addChild(makeText(fonts, { text: wd.text, role: "display", weight: fw, size: fsize, color: colorFor(rank), anchor: 0.5 }));
    root.addChild(wordC0);

    const start = POP_START + rank * POP_EACH;
    timeline
      .to(wordC0, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(wordC0, { prop: "scale.x", from: 0, to: 1, start, duration: POP_DUR, ease: spring(0.55) })
      .to(wordC0, { prop: "scale.y", from: 0, to: 1, start, duration: POP_DUR, ease: spring(0.55) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const wordCloud: TemplateDefinition = {
  id: "word-cloud",
  name: "Word Cloud",
  tagline: "Weighted words pop into a tidy cloud, the biggest ideas landing first.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.9,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", words: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "What we do", maxLength: 24, optional: true, shrinkToFit: true },
    {
      key: "words",
      type: "textlist",
      label: "Words (word | weight)",
      default: DEFAULT_WORDS,
      minItems: 5,
      maxItems: 14,
      maxLength: 16,
      help: 'One per line as "word | weight". Higher weight = bigger word.',
    },
    { key: "showTitle", type: "toggle", label: "Title", default: true },
    { key: "multicolor", type: "toggle", label: "Multicolor", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

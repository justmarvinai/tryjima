import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  shrinkToFit,
  inOutCubic,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

// Weight Shift — a typographic weight morph. Two perfectly registered copies of
// each headline line (one at weight 400, one at 700) crossfade into each other
// while their tracking tightens in the same breath, so the type reads as gaining
// confidence rather than as one thing swapping for another. Nothing else in the
// library animates font weight; this is not a fade-in, not a scale, not a swap.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#FAF9F6", textColor: "#17181C", accent: "#C2402A" } },
  { id: "graphite", name: "Graphite", colors: { background: "#17181C", textColor: "#F6F5F1", accent: "#D9A441" } },
  { id: "mist", name: "Mist", colors: { background: "#E8ECEF", textColor: "#14181D", accent: "#2554D4" } },
  { id: "moss", name: "Moss", colors: { background: "#EEF0E9", textColor: "#1A1E16", accent: "#3C6B3A" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerFrac: number;
  blockHFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.078, maxWidthFrac: 0.78, centerFrac: 0.45, blockHFrac: 0.44 };
    case "9:16":
      return { fontFrac: 0.1, maxWidthFrac: 0.82, centerFrac: 0.44, blockHFrac: 0.4 };
    case "4:5":
      return { fontFrac: 0.094, maxWidthFrac: 0.8, centerFrac: 0.45, blockHFrac: 0.42 };
    case "1:1":
    default:
      return { fontFrac: 0.096, maxWidthFrac: 0.8, centerFrac: 0.46, blockHFrac: 0.44 };
  }
}

const LIGHT_IN = 0.3;
const MORPH_START = 1.2;
const MORPH_DUR = 1.1;
const LINE_STAGGER = 0.09;
const RULE_START = 2.7;
const SUB_START = 2.95;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FAF9F6"));
  const textColor = str(values.textColor, pc("textColor", "#17181C"));
  const accent = str(values.accent, pc("accent", "#C2402A"));
  const headline = str(values.headline, "Say it with weight");
  const subline = str(values.subline, "").trim();
  const showRule = on(values.showRule);
  const showMark = on(values.showMark);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  // Wrap against the BOLD weight (the wider of the two) with a little headroom
  // for the open tracking the light copy starts on, so neither copy overflows.
  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.16);
  const relayout = () =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 700,
      fontSize,
      lineHeight,
      maxWidth: maxWidth * 0.94,
      align: "center",
      anchorX: cx,
      centerY,
    });
  let boxes = relayout();
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lineCount * lineHeight > maxBlockH; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.16);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: DURATION };

  const content = new Container();
  content.label = "content";
  root.addChild(content);

  const lineIdx = [...new Set(boxes.map((b) => b.line))].sort((a, b) => a - b);
  const rise = fontSize * 0.16;

  // Tracking targets: airy while light, tight once bold — the micro-move that
  // sells the weight change.
  const lightFrom = fontSize * 0.04;
  const lightTo = fontSize * 0.012;
  const boldFrom = fontSize * 0.024;
  const boldTo = -fontSize * 0.008;

  lineIdx.forEach((li, i) => {
    const lineBoxes = boxes.filter((b) => b.line === li);
    const text = lineBoxes.map((b) => b.text).join(" ");
    const cy = lineBoxes.length ? Math.min(...lineBoxes.map((b) => b.cy)) : centerY;
    const inStart = LIGHT_IN + i * 0.11;
    const morphStart = MORPH_START + i * LINE_STAGGER;

    // Light copy — arrives first, holds the frame on its own for a beat.
    const light = makeText(fonts, {
      text,
      role: "display",
      weight: 400,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: lightFrom,
    });
    light.position.set(cx, cy);
    light.alpha = 0;
    content.addChild(light);

    // Bold copy — registered on the exact same centre so the crossfade never
    // shifts; it only thickens.
    const bold = makeText(fonts, {
      text,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: boldFrom,
    });
    bold.position.set(cx, cy);
    bold.alpha = 0;
    content.addChild(bold);

    timeline
      .to(light, { prop: "alpha", from: 0, to: 1, start: inStart, duration: 0.7, ease: outQuad })
      .to(light, { prop: "y", from: cy + rise, to: cy, start: inStart, duration: 0.9, ease: outExpo })
      .to(light, { prop: "alpha", from: 1, to: 0, start: morphStart, duration: MORPH_DUR, ease: inOutCubic })
      .to(light, { prop: "style.letterSpacing", from: lightFrom, to: lightTo, start: morphStart, duration: MORPH_DUR, ease: inOutCubic })
      .to(bold, { prop: "alpha", from: 0, to: 1, start: morphStart, duration: MORPH_DUR, ease: inOutCubic })
      .to(bold, { prop: "style.letterSpacing", from: boldFrom, to: boldTo, start: morphStart, duration: MORPH_DUR, ease: inOutCubic })
      .to(bold, { prop: "y", from: cy + rise, to: cy, start: inStart, duration: 0.9, ease: outExpo });
  });

  const blockLeft = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const blockRight = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const blockBottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.6;
  const blockTop = Math.min(...boxes.map((b) => b.cy)) - fontSize * 0.66;

  // --- A small accent mark above the block: the quiet "before" state marker ---
  if (showMark) {
    const markW = Math.max(4, Math.round(fontSize * 0.42));
    const markH = Math.max(3, Math.round(size.width * 0.0022));
    const mark = new Graphics().roundRect(-markW / 2, -markH / 2, markW, markH, markH / 2).fill(accent);
    mark.position.set(cx, blockTop - fontSize * 0.42);
    mark.alpha = 0;
    mark.scale.x = 0.4;
    content.addChild(mark);
    timeline
      .to(mark, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.5, ease: outQuad })
      .to(mark, { prop: "scale.x", from: 0.4, to: 1, start: 0.15, duration: 0.8, ease: outExpo });
  }

  // --- Hairline rule opens under the settled block ---
  const ruleY = blockBottom + fontSize * 0.24;
  if (showRule) {
    const ruleW = Math.min(blockRight - blockLeft, maxWidth);
    const ruleH = Math.max(2, Math.round(size.width * 0.0015));
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(cx, ruleY);
    rule.scale.x = 0;
    content.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: RULE_START, duration: 0.65, ease: outExpo });
  }

  // --- Subline last, quiet ---
  if (subline.length > 0) {
    const family = fonts.family("body");
    const base = Math.round(fontSize * 0.28);
    const subSize = shrinkToFit(
      subline,
      (s, sz) => fonts.measure(s, { family, weight: 400, size: sz }),
      { maxWidth, baseSize: base, minSize: Math.round(base * 0.55) },
    );
    const subY = ruleY + fontSize * 0.56;
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 400,
      size: subSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    sub.position.set(cx, subY);
    sub.alpha = 0;
    content.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.72, start: SUB_START, duration: 0.7, ease: outQuad })
      .to(sub, { prop: "y", from: subY + fontSize * 0.14, to: subY, start: SUB_START, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const weightShift: TemplateDefinition = {
  id: "weight-shift",
  name: "Weight Shift",
  tagline: "The headline morphs from light to bold as its tracking quietly tightens.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.8,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Say it with weight", maxLength: 48, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Light to bold, in one breath", maxLength: 70, optional: true },
    { key: "showMark", type: "toggle", label: "Accent mark", default: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  shrinkToFit,
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

// Depth Stack — the same headline exists three times at three depths: a huge
// faint copy far behind, a mid copy, and the crisp foreground copy. They drift
// toward each other at different speeds (true parallax: the far copy travels
// furthest and arrives last) and merge into one clean line, the two depth copies
// dissolving exactly as they land. Not `blur-focus` (one copy sharpening) and
// not `echo-zoom` (copies rippling outward from a settled line): here three
// layers converge inward into one.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "chalk", name: "Chalk", colors: { background: "#F7F7F5", textColor: "#131417", accent: "#3A5BD9" } },
  { id: "onyx", name: "Onyx", colors: { background: "#121317", textColor: "#F5F4F0", accent: "#8FB8FF" } },
  { id: "sepia", name: "Sepia", colors: { background: "#F1EAE0", textColor: "#251F19", accent: "#A4462A" } },
  { id: "pine", name: "Pine", colors: { background: "#E9EEEA", textColor: "#131A16", accent: "#1F5F4B" } },
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
      return { fontFrac: 0.074, maxWidthFrac: 0.66, centerFrac: 0.45, blockHFrac: 0.42 };
    case "9:16":
      return { fontFrac: 0.096, maxWidthFrac: 0.78, centerFrac: 0.45, blockHFrac: 0.38 };
    case "4:5":
      return { fontFrac: 0.09, maxWidthFrac: 0.76, centerFrac: 0.45, blockHFrac: 0.4 };
    case "1:1":
    default:
      return { fontFrac: 0.092, maxWidthFrac: 0.76, centerFrac: 0.46, blockHFrac: 0.42 };
  }
}

interface DepthSpec {
  scale: number;
  dx: number;
  dy: number;
  alpha: number;
  travel: number;
  fadeOutAt: number;
  fadeOutDur: number;
}

const CONV_START = 0.3;
const RULE_START = 1.95;
const SUB_START = 2.25;
const DURATION = 4.3;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F7F7F5"));
  const textColor = str(values.textColor, pc("textColor", "#131417"));
  const accent = str(values.accent, pc("accent", "#3A5BD9"));
  const headline = str(values.headline, "Depth in every layer");
  const subline = str(values.subline, "").trim();
  const showRule = on(values.showRule);
  const showPeriod = on(values.showPeriod);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.14);
  const relayout = () =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 700,
      fontSize,
      lineHeight,
      maxWidth,
      align: "center",
      anchorX: cx,
      centerY,
    });
  let boxes = relayout();
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lineCount * lineHeight > maxBlockH; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.14);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: DURATION };

  const blockLeft = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const blockRight = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const blockTop = Math.min(...boxes.map((b) => b.cy));
  const blockBottom = Math.max(...boxes.map((b) => b.cy));
  const blockCx = (blockLeft + blockRight) / 2;
  const blockCy = (blockTop + blockBottom) / 2;

  // Far layers travel further and take longer — the parallax that makes the
  // convergence read as depth rather than as three fades.
  const depths: DepthSpec[] = [
    { scale: 1.5, dx: -size.width * 0.14, dy: fontSize * 0.3, alpha: 0.15, travel: 1.5, fadeOutAt: 1.2, fadeOutDur: 0.62 },
    { scale: 1.24, dx: size.width * 0.09, dy: -fontSize * 0.22, alpha: 0.32, travel: 1.2, fadeOutAt: 1.02, fadeOutDur: 0.55 },
    { scale: 1.07, dx: -size.width * 0.035, dy: fontSize * 0.1, alpha: 1, travel: 0.95, fadeOutAt: 0, fadeOutDur: 0 },
  ];

  for (const d of depths) {
    const layer = new Container();
    layer.pivot.set(blockCx, blockCy);
    layer.position.set(blockCx + d.dx, blockCy + d.dy);
    layer.scale.set(d.scale);
    layer.alpha = 0;
    root.addChild(layer);

    for (const box of boxes) {
      const t = makeText(fonts, {
        text: box.text,
        role: "display",
        weight: 700,
        size: fontSize,
        color: textColor,
        anchor: 0.5,
        letterSpacing: -fontSize * 0.012,
      });
      t.position.set(box.cx, box.cy);
      layer.addChild(t);
    }

    timeline
      .to(layer, { prop: "x", from: blockCx + d.dx, to: blockCx, start: CONV_START, duration: d.travel, ease: outExpo })
      .to(layer, { prop: "y", from: blockCy + d.dy, to: blockCy, start: CONV_START, duration: d.travel, ease: outExpo })
      .to(layer, { prop: "scale.x", from: d.scale, to: 1, start: CONV_START, duration: d.travel, ease: outExpo })
      .to(layer, { prop: "scale.y", from: d.scale, to: 1, start: CONV_START, duration: d.travel, ease: outExpo })
      .to(layer, { prop: "alpha", from: 0, to: d.alpha, start: CONV_START, duration: d.fadeOutDur > 0 ? 0.45 : 0.6, ease: outQuad });

    if (d.fadeOutDur > 0) {
      timeline.to(layer, {
        prop: "alpha",
        from: d.alpha,
        to: 0,
        start: d.fadeOutAt,
        duration: d.fadeOutDur,
        ease: outQuad,
      });
    }
  }

  // --- A small accent full stop lands beside the last word ---
  if (showPeriod) {
    const lastLine = lineCount - 1;
    const lastBoxes = boxes.filter((b) => b.line === lastLine);
    const lastRight = lastBoxes.length ? Math.max(...lastBoxes.map((b) => b.cx + b.width / 2)) : blockRight;
    const lastCy = lastBoxes.length ? Math.max(...lastBoxes.map((b) => b.cy)) : blockBottom;
    const dotR = Math.max(4, Math.round(fontSize * 0.085));
    const dotX = Math.min(lastRight + fontSize * 0.16 + dotR, size.width - fontSize * 0.3);
    const dot = new Graphics().circle(0, 0, dotR).fill(accent);
    dot.position.set(dotX, lastCy + fontSize * 0.26);
    dot.alpha = 0;
    dot.scale.set(0.4);
    root.addChild(dot);
    timeline
      .to(dot, { prop: "alpha", from: 0, to: 1, start: RULE_START, duration: 0.4, ease: outQuad })
      .to(dot, { prop: "scale.x", from: 0.4, to: 1, start: RULE_START, duration: 0.7, ease: outExpo })
      .to(dot, { prop: "scale.y", from: 0.4, to: 1, start: RULE_START, duration: 0.7, ease: outExpo });
  }

  // --- Hairline rule opens under the merged line ---
  const ruleY = blockBottom + fontSize * 0.92;
  if (showRule) {
    const ruleW = Math.min(blockRight - blockLeft, maxWidth);
    const ruleH = Math.max(2, Math.round(size.width * 0.0015));
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(cx, ruleY);
    rule.scale.x = 0;
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: RULE_START, duration: 0.7, ease: outExpo });
  }

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
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.72, start: SUB_START, duration: 0.75, ease: outQuad })
      .to(sub, { prop: "y", from: subY + fontSize * 0.14, to: subY, start: SUB_START, duration: 0.85, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const depthStackText: TemplateDefinition = {
  id: "depth-stack-text",
  name: "Depth Stack",
  tagline: "Three copies of the headline drift in from three depths and merge into one.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Depth in every layer", maxLength: 48, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Three passes, one line", maxLength: 70, optional: true },
    { key: "showPeriod", type: "toggle", label: "Accent full stop", default: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

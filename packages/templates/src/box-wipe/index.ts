import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outCubic,
  inCubic,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

function fontFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.088;
    case "9:16":
      return 0.092;
    case "4:5":
      return 0.088;
    case "1:1":
    default:
      return 0.09;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Wipe it clean");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const leftX = size.width * 0.1;
  const maxWidth = size.width * 0.8;
  const centerY = size.height * 0.5;

  // --- Left-aligned headline, wrapped + shrunk so it never overflows ---
  let fontSize = Math.round(size.width * fontFrac(ctx.aspect));
  let lineHeight = Math.round(fontSize * 1.16);
  const relayout = () =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 700,
      fontSize,
      lineHeight,
      maxWidth,
      align: "left",
      anchorX: leftX,
      centerY,
    });
  let boxes = relayout();
  const maxBlockH = size.height * 0.62;
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let g = 0; g < 8 && lineCount * lineHeight > maxBlockH; g++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.16);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  const lineIdx = [...new Set(boxes.map((b) => b.line))].sort((a, b) => a - b);
  const wordsByLine = new Map<number, string[]>();
  for (const b of boxes) {
    const arr = wordsByLine.get(b.line);
    if (arr) arr.push(b.text);
    else wordsByLine.set(b.line, [b.text]);
  }

  const barW = Math.max(3, Math.round(fontSize * 0.09));
  const maskHalfH = fontSize * 0.72; // generous → no descender/ascender clipping
  const barHalfH = fontSize * 0.6;
  const offRight = size.width * 0.12;
  const wipeDur = 0.7;
  const stagger = 0.22;
  const start0 = 0.4;
  const exitDur = 0.36;
  let lastEnd = 0;

  lineIdx.forEach((li, order) => {
    const lineText = (wordsByLine.get(li) ?? []).join(" ");
    const cy = boxes.find((b) => b.line === li)?.cy ?? centerY;

    // The line text, left-anchored, revealed by a mask that grows L→R.
    const lineC = new Container();
    const t = makeText(fonts, {
      text: lineText,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    t.position.set(leftX, cy);
    lineC.addChild(t);
    root.addChild(lineC);
    const w = Math.max(1, t.width);

    // Mask pivots at its left edge, so scale.x 0→1 wipes the text in rightward.
    const mask = new Graphics().rect(0, -maskHalfH, w, maskHalfH * 2).fill("#FFFFFF");
    mask.position.set(leftX, cy);
    mask.pivot.set(0, 0);
    mask.scale.set(0, 1);
    root.addChild(mask);
    lineC.mask = mask;

    const S = start0 + order * stagger;
    timeline.to(mask, { prop: "scale.x", from: 0, to: 1, start: S, duration: wipeDur, ease: outExpo });

    // A thin accent bar rides the wipe's leading edge (same ease → stays exactly
    // on the edge), then accelerates off the right and fades as the text lands.
    const bar = new Graphics().roundRect(-barW / 2, -barHalfH, barW, barHalfH * 2, barW / 2).fill(accent);
    bar.position.set(leftX, cy);
    bar.alpha = 0;
    root.addChild(bar);
    const exitStart = S + wipeDur;
    timeline
      .to(bar, { prop: "alpha", from: 0, to: 1, start: S, duration: 0.08, ease: outCubic })
      .to(bar, { prop: "x", from: leftX, to: leftX + w, start: S, duration: wipeDur, ease: outExpo })
      .to(bar, { prop: "x", from: leftX + w, to: leftX + w + offRight, start: exitStart, duration: exitDur, ease: inCubic })
      .to(bar, { prop: "alpha", from: 1, to: 0, start: exitStart, duration: exitDur, ease: outCubic });

    lastEnd = Math.max(lastEnd, exitStart + exitDur);
  });

  return { timeline, duration: Math.max(3.6, lastEnd + 0.9) };
}

export const boxWipe: TemplateDefinition = {
  id: "box-wipe",
  name: "Box Wipe",
  tagline: "An accent bar wipes each line clean, left to right.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { headline: "display" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Wipe it clean", maxLength: 56, shrinkToFit: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

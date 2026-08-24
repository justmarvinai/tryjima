import type { Text } from "pixi.js";
import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  outExpo,
  type EaseFn,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

interface AspectLayout {
  align: "left" | "center";
  fontFrac: number; // of canvas width
  maxWidthFrac: number;
  anchorXFrac: number;
  centerYFrac: number;
}

function aspectLayout(aspect: Aspect): AspectLayout {
  switch (aspect) {
    case "16:9":
      return { align: "left", fontFrac: 0.072, maxWidthFrac: 0.6, anchorXFrac: 0.06, centerYFrac: 0.44 };
    case "1:1":
      return { align: "center", fontFrac: 0.1, maxWidthFrac: 0.82, anchorXFrac: 0.5, centerYFrac: 0.44 };
    case "4:5":
      return { align: "center", fontFrac: 0.1, maxWidthFrac: 0.82, anchorXFrac: 0.5, centerYFrac: 0.42 };
    case "9:16":
      return { align: "center", fontFrac: 0.112, maxWidthFrac: 0.84, anchorXFrac: 0.5, centerYFrac: 0.44 };
  }
}

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "white-orange", name: "White on orange", colors: { background: "#FF4D1C", textColor: "#FFFFFF", accent: "#101014" } },
  { id: "ink-lime", name: "Ink on lime", colors: { background: "#D8F34D", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "violet-cream", name: "Violet on cream", colors: { background: "#FAF5EA", textColor: "#3A1D6E", accent: "#7C5CFF" } },
];

interface StyleEntrance {
  scaleFrom: number;
  rotFrom: number; // radians
  yOffset: number;
  dur: number;
  ease: EaseFn;
}

function styleEntrance(style: string): StyleEntrance {
  switch (style) {
    case "rise":
      return { scaleFrom: 0.92, rotFrom: 0, yOffset: 46, dur: 0.6, ease: outQuint };
    case "slam":
      return { scaleFrom: 1.4, rotFrom: 0, yOffset: 0, dur: 0.32, ease: outExpo };
    case "pop":
    default:
      return { scaleFrom: 0.6, rotFrom: 8 * DEG, yOffset: 0, dur: 0.5, ease: makeOutBack(1.6) };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const L = aspectLayout(ctx.aspect);

  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFFFFF"));
  const textColor = str(values.textColor, pcol("textColor", "#101014"));
  const accent = str(values.accent, pcol("accent", "#FF4D1C"));
  const headline = str(values.headline, "Say it with motion.");
  const subline = str(values.subline, "");
  const style = str(values.style, "pop");
  const showAccentBar = values.accentBar !== false;
  const showAccentDot = values.accentDot !== false;

  const fontSize = Math.round(size.width * L.fontFrac);
  const lineHeight = Math.round(fontSize * 1.06);
  const anchorX = size.width * L.anchorXFrac;
  const centerY = size.height * L.centerYFrac;

  // --- Background (subtle settle) ---
  const bgRect = new Graphics().rect(-size.width / 2, -size.height / 2, size.width, size.height).fill(bg);
  bgRect.position.set(size.width / 2, size.height / 2);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const content = new Container();
  content.label = "content";
  root.addChild(content);

  // --- Words ---
  const boxes = layoutWords(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth: size.width * L.maxWidthFrac,
    align: L.align,
    anchorX,
    centerY,
  });

  const entrance = styleEntrance(style);
  const timeline = new JimaTimeline();
  const wordStart = 0.35;
  const stagger = 0.18;

  const wordNodes: Text[] = [];
  boxes.forEach((box, i) => {
    const t = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
    });
    t.position.set(box.cx, box.cy);
    content.addChild(t);
    wordNodes.push(t);

    const start = wordStart + i * stagger;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: Math.min(0.3, entrance.dur), ease: outQuad })
      .to(t, { prop: "scale.x", from: entrance.scaleFrom, to: 1, start, duration: entrance.dur, ease: entrance.ease })
      .to(t, { prop: "scale.y", from: entrance.scaleFrom, to: 1, start, duration: entrance.dur, ease: entrance.ease });
    if (entrance.rotFrom !== 0) {
      timeline.to(t, { prop: "rotation", from: entrance.rotFrom, to: 0, start, duration: entrance.dur, ease: entrance.ease });
    }
    if (entrance.yOffset !== 0) {
      timeline.to(t, { prop: "y", from: box.cy + entrance.yOffset, to: box.cy, start, duration: entrance.dur, ease: entrance.ease });
    }
    t.alpha = 0;
  });

  // Block extents (from the word boxes).
  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const topY = Math.min(...boxes.map((b) => b.cy)) - fontSize / 2;
  const lastLine = Math.max(...boxes.map((b) => b.line));
  const lastLineBoxes = boxes.filter((b) => b.line === lastLine);
  const ulX0 = Math.min(...lastLineBoxes.map((b) => b.cx - b.width / 2));
  const ulX1 = Math.max(...lastLineBoxes.map((b) => b.cx + b.width / 2));
  const ulY = Math.max(...lastLineBoxes.map((b) => b.cy)) + fontSize * 0.62;

  // --- Accent underline (sweep + breathe) ---
  if (showAccentBar) {
    const ulWidth = ulX1 - ulX0;
    const ulHeight = Math.max(4, Math.round(fontSize * 0.09));
    const underline = new Graphics().roundRect(0, 0, ulWidth, ulHeight, ulHeight / 2).fill(accent);
    underline.position.set(ulX0, ulY);
    underline.scale.set(0, 1);
    underline.label = "underline";
    content.addChild(underline);
    timeline
      .to(underline, { prop: "scale.x", from: 0, to: 1, start: 2.0, duration: 0.4, ease: outExpo })
      .to(underline, { prop: "scale.x", from: 1, to: 1.02, start: 3.0, duration: 0.5, ease: outQuad })
      .to(underline, { prop: "scale.x", from: 1.02, to: 1, start: 3.5, duration: 0.5, ease: outQuad });
  }

  // --- Accent dot (drops in top-left of the block) ---
  if (showAccentDot) {
    const dotR = Math.max(6, Math.round(fontSize * 0.16));
    const dotX = L.align === "left" ? left + dotR : left - dotR * 1.4;
    const dotY = topY - dotR * 0.4;
    const dot = new Graphics().circle(0, 0, dotR).fill(accent);
    dot.position.set(dotX, dotY);
    dot.label = "dot";
    content.addChild(dot);
    dot.alpha = 0;
    timeline
      .to(dot, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.25, ease: outQuad })
      .to(dot, { prop: "y", from: dotY - 60, to: dotY, start: 0.05, duration: 0.4, ease: makeOutBack(2) });
  }

  // --- Subline (fades up) ---
  if (subline.length > 0) {
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: Math.round(fontSize * 0.26),
      color: textColor,
      align: L.align,
      anchor: L.align === "left" ? { x: 0, y: 0.5 } : { x: 0.5, y: 0.5 },
    });
    const subX = L.align === "left" ? left : (left + right) / 2;
    const subY = ulY + fontSize * 0.5;
    sub.position.set(subX, subY);
    sub.alpha = 0;
    content.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 1, start: 2.4, duration: 0.6, ease: outQuad })
      .to(sub, { prop: "y", from: subY + 12, to: subY, start: 2.4, duration: 0.6, ease: outQuint });
  }

  // Background settle over the whole thing.
  timeline
    .to(bgRect, { prop: "scale.x", from: 1.02, to: 1, start: 0, duration: 0.35, ease: outQuad })
    .to(bgRect, { prop: "scale.y", from: 1.02, to: 1, start: 0, duration: 0.35, ease: outQuad });

  return { timeline, duration: 4.0 };
}

export const kineticHeadline: TemplateDefinition = {
  id: "kinetic-headline",
  name: "Kinetic Headline",
  tagline: "Big word-by-word kinetic typography.",
  category: "announcement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Say it with motion.", maxLength: 60, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Made in Jima", maxLength: 80, optional: true },
    {
      key: "style",
      type: "select",
      label: "Entrance",
      default: "pop",
      options: [
        { value: "pop", label: "Pop" },
        { value: "rise", label: "Rise" },
        { value: "slam", label: "Slam" },
      ],
    },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "accentDot", type: "toggle", label: "Accent dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

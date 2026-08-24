import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  composeUpdates,
  outCubic,
  outExpo,
  squashStretch,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

interface L {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.074, maxWidthFrac: 0.72, centerYFrac: 0.45 };
    case "9:16":
      return { fontFrac: 0.102, maxWidthFrac: 0.8, centerYFrac: 0.44 };
    case "1:1":
      return { fontFrac: 0.092, maxWidthFrac: 0.76, centerYFrac: 0.45 };
    case "4:5":
    default:
      return { fontFrac: 0.096, maxWidthFrac: 0.74, centerYFrac: 0.44 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Slide in from the side");
  const showAccentBar = values.accentBar !== false;
  const squashOn = on(values.squash);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const fontSize = Math.round(size.width * L.fontFrac);
  const lineHeight = Math.round(fontSize * 1.18);
  const content = new Container();
  root.addChild(content);

  const boxes = layoutWords(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth: size.width * L.maxWidthFrac,
    align: "center",
    anchorX: size.width / 2,
    centerY: size.height * L.centerYFrac,
  });

  const timeline = new JimaTimeline();

  // Each line slides in from an alternating side (line 0 left, line 1 right, …)
  // while fading in; the far-off start is invisible, so nothing peeks past the
  // safe margins. outExpo settles the slide fast and smooth.
  const lineIndices = [...new Set(boxes.map((b) => b.line))].sort((a, b) => a - b);
  const offset = size.width * 0.45;
  const squash: ((t: number) => void)[] = [];
  lineIndices.forEach((li, order) => {
    const lineBoxes = boxes.filter((b) => b.line === li);
    const lineC = new Container();
    for (const b of lineBoxes) {
      const t = makeText(fonts, { text: b.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
      t.position.set(b.cx, b.cy);
      lineC.addChild(t);
    }
    const from = order % 2 === 0 ? -offset : offset;
    lineC.x = from;
    lineC.alpha = 0;
    content.addChild(lineC);
    const start = 0.35 + order * 0.18;
    timeline
      .to(lineC, { prop: "x", from, to: 0, start, duration: 0.85, ease: outExpo })
      .to(lineC, { prop: "alpha", from: 0, to: 1, start, duration: 0.7, ease: outCubic });
    // The line arrives fast and stops dead; a little stretch along the travel
    // and a settle back to round is what sells the deceleration.
    if (squashOn) squash.push(squashStretch(timeline, lineC, { amount: 0.14 }));
  });

  // A short accent underline draws in beneath the block as a quiet finish.
  const bottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.74;
  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const cxMid = (left + right) / 2;
  const lineW = Math.min(right - left, size.width * 0.18);
  const ulStart = 0.35 + lineIndices.length * 0.18 + 0.1;
  if (showAccentBar) {
    const underline = new Graphics().roundRect(-lineW / 2, 0, lineW, Math.max(3, fontSize * 0.06), 2).fill(accent);
    underline.position.set(cxMid, bottom);
    underline.alpha = 0;
    underline.scale.set(0.3, 1);
    content.addChild(underline);
    timeline
      .to(underline, { prop: "alpha", from: 0, to: 1, start: ulStart, duration: 0.5, ease: outCubic })
      .to(underline, { prop: "scale.x", from: 0.3, to: 1, start: ulStart, duration: 0.7, ease: outExpo });
  }

  const linesEnd = 0.35 + (lineIndices.length - 1) * 0.18 + 0.85;
  const end = Math.max(linesEnd, ulStart + 0.7);
  const update = composeUpdates(...squash);
  return { timeline, duration: Math.max(3.6, end + 0.7), ...(update ? { update } : {}) };
}

export const sideSlide: TemplateDefinition = {
  id: "side-slide",
  name: "Side Slide",
  tagline: "Lines slide in from alternating sides and settle into place.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Slide in from the side", maxLength: 70, shrinkToFit: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "squash", type: "toggle", label: "Squash & stretch", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

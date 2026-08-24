import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outCubic,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords, type WordBox } from "../shared/words";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "ocean", name: "Ocean", colors: { background: "#0B2447", textColor: "#FFFFFF", accent: "#57C4E5" } },
];

interface L {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.08, maxWidthFrac: 0.82, centerYFrac: 0.46 };
    case "9:16":
      return { fontFrac: 0.104, maxWidthFrac: 0.84, centerYFrac: 0.44 };
    case "4:5":
      return { fontFrac: 0.094, maxWidthFrac: 0.84, centerYFrac: 0.45 };
    case "1:1":
    default:
      return { fontFrac: 0.094, maxWidthFrac: 0.84, centerYFrac: 0.46 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Split and reveal");
  const showAccentBar = values.accentBar !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));
  const L = layout(ctx.aspect);
  const fontSize = Math.round(size.width * L.fontFrac);
  const lineHeight = Math.round(fontSize * 1.18);

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
  if (boxes.length === 0) return { timeline, duration: 3.6 };

  const lineIndices = [...new Set(boxes.map((b) => b.line))].sort((a, b) => a - b);
  const windowHalf = fontSize * 0.72;
  const offset = windowHalf * 1.5;
  const pad = fontSize * 0.14;
  const overlap = Math.max(1, Math.round(fontSize * 0.02));

  const mkLine = (lineBoxes: WordBox[], color: string): Container => {
    const c = new Container();
    for (const b of lineBoxes) {
      const t = makeText(fonts, { text: b.text, role: "display", weight: 700, size: fontSize, color, anchor: 0.5 });
      t.position.set(b.cx, b.cy);
      c.addChild(t);
    }
    return c;
  };

  lineIndices.forEach((li, order) => {
    const lineBoxes = boxes.filter((b) => b.line === li);
    const cy = lineBoxes[0]!.cy;
    const xL = Math.min(...lineBoxes.map((b: WordBox) => b.cx - b.width / 2));
    const xR = Math.max(...lineBoxes.map((b: WordBox) => b.cx + b.width / 2));
    const w = xR - xL + pad * 2;

    // Upper half-window: the top of the line slides DOWN into place from above.
    const upMask = new Graphics().rect(xL - pad, cy - windowHalf, w, windowHalf + overlap).fill("#FFFFFF");
    root.addChild(upMask);
    const upC = mkLine(lineBoxes, textColor);
    upC.mask = upMask;
    root.addChild(upC);

    // Lower half-window: the bottom of the line slides UP into place from below.
    const loMask = new Graphics().rect(xL - pad, cy - overlap, w, windowHalf + overlap).fill("#FFFFFF");
    root.addChild(loMask);
    const loC = mkLine(lineBoxes, textColor);
    loC.mask = loMask;
    root.addChild(loC);

    const start = 0.35 + order * 0.16;
    timeline
      .to(upC, { prop: "y", from: -offset, to: 0, start, duration: 0.9, ease: outExpo })
      .to(loC, { prop: "y", from: offset, to: 0, start, duration: 0.9, ease: outExpo });
  });

  // Accent baseline draws in from the center as a quiet finish.
  const bottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.74;
  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const ruleStart = 0.35 + (lineIndices.length - 1) * 0.16 + 0.7;
  if (showAccentBar) {
    const ruleW = right - left;
    const rule = new Graphics().roundRect(-ruleW / 2, 0, ruleW, Math.max(3, fontSize * 0.06), 2).fill(accent);
    rule.position.set((left + right) / 2, bottom);
    rule.alpha = 0;
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline
      .to(rule, { prop: "alpha", from: 0, to: 1, start: ruleStart, duration: 0.5, ease: outCubic })
      .to(rule, { prop: "scale.x", from: 0, to: 1, start: ruleStart, duration: 0.7, ease: outExpo });
  }

  return { timeline, duration: Math.max(3.6, ruleStart + 0.7 + 0.8) };
}

export const splitReveal: TemplateDefinition = {
  id: "split-reveal",
  name: "Split Reveal",
  tagline: "Each line assembles from a clean horizontal split.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Split and reveal", maxLength: 60, shrinkToFit: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

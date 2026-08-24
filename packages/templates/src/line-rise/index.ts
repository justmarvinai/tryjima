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
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.08 : aspect === "9:16" ? 0.104 : 0.094;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Rise into view, line by line.");
  const align = str(values.align, "left") === "center" ? "center" : "left";
  const showAccentBar = values.accentBar !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const fontSize = Math.round(size.width * fontFrac(ctx.aspect));
  const lineHeight = Math.round(fontSize * 1.16);
  const anchorX = align === "left" ? size.width * 0.1 : size.width * 0.5;

  const boxes = layoutWords(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth: size.width * (align === "left" ? 0.82 : 0.84),
    align,
    anchorX,
    centerY: size.height * 0.46,
  });

  const timeline = new JimaTimeline();
  const lineIndices = [...new Set(boxes.map((b) => b.line))].sort((a, b) => a - b);
  const windowH = fontSize * 1.34;

  lineIndices.forEach((li, order) => {
    const lineBoxes = boxes.filter((b) => b.line === li);
    const cy = lineBoxes[0]!.cy;
    const xL = Math.min(...lineBoxes.map((b: WordBox) => b.cx - b.width / 2));
    const xR = Math.max(...lineBoxes.map((b: WordBox) => b.cx + b.width / 2));

    // Static reveal window (a mask); the line slides up into it from below.
    const mask = new Graphics().rect(xL - fontSize * 0.1, cy - fontSize * 0.86, xR - xL + fontSize * 0.2, windowH).fill("#FFFFFF");
    root.addChild(mask);

    const lineC = new Container();
    for (const b of lineBoxes) {
      const t = makeText(fonts, { text: b.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
      t.position.set(b.cx, b.cy);
      lineC.addChild(t);
    }
    lineC.mask = mask;
    root.addChild(lineC);

    const start = 0.35 + order * 0.2;
    timeline.to(lineC, { prop: "y", from: windowH, to: 0, start, duration: 0.85, ease: outExpo });
  });

  // Accent baseline under the block draws in at the end.
  const bottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.7;
  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const ruleStart = 0.35 + lineIndices.length * 0.2 + 0.1;
  if (showAccentBar) {
    const rule = new Graphics().roundRect(left, bottom, right - left, Math.max(3, fontSize * 0.07), 2).fill(accent);
    rule.pivot.set(align === "left" ? left : (left + right) / 2, 0);
    rule.position.set(align === "left" ? left : (left + right) / 2, 0);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: ruleStart, duration: 0.7, ease: outCubic });
  }

  return { timeline, duration: Math.max(3.0, ruleStart + 1.2) };
}

export const lineRise: TemplateDefinition = {
  id: "line-rise",
  name: "Line Rise",
  tagline: "Each line slides up from behind a clean edge.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Rise into view, line by line.", maxLength: 80, shrinkToFit: true },
    { key: "align", type: "select", label: "Align", default: "left", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }] },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

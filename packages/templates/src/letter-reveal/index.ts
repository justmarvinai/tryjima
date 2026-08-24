import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outCubic,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutChars } from "../shared/words";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "ocean", name: "Ocean", colors: { background: "#0B2447", textColor: "#FFFFFF", accent: "#57C4E5" } },
];

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.082 : aspect === "9:16" ? 0.12 : 0.108;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Every letter lands.");
  const emphasisLast = str(values.emphasisLast, "on") === "on";

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const fontSize = Math.round(size.width * fontFrac(ctx.aspect));
  const lineHeight = Math.round(fontSize * 1.12);
  const content = new Container();
  root.addChild(content);

  const boxes = layoutChars(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth: size.width * 0.86,
    align: "center",
    anchorX: size.width / 2,
    centerY: size.height * 0.46,
  });

  // Highlight the final word's glyphs in the accent color for a little lift.
  const lastWord = headline.trim().split(/\s+/).pop() ?? "";
  const accentFrom = emphasisLast ? Math.max(0, boxes.length - lastWord.length) : boxes.length;

  const timeline = new JimaTimeline();
  const perChar = 0.032;
  const pop = makeOutBack(1.5);
  boxes.forEach((box, i) => {
    const isAccent = i >= accentFrom;
    const t = makeText(fonts, { text: box.char, role: "display", weight: 700, size: fontSize, color: isAccent ? accent : textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    t.scale.set(0.4);
    content.addChild(t);
    const start = 0.3 + box.index * perChar;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outCubic })
      .to(t, { prop: "scale.x", from: 0.4, to: 1, start, duration: 0.5, ease: pop })
      .to(t, { prop: "scale.y", from: 0.4, to: 1, start, duration: 0.5, ease: pop })
      .to(t, { prop: "y", from: box.cy + fontSize * 0.25, to: box.cy, start, duration: 0.5, ease: outCubic });
  });

  const lastStart = 0.3 + (boxes.length ? boxes[boxes.length - 1]!.index : 0) * perChar;
  return { timeline, duration: Math.max(2.6, lastStart + 1.4) };
}

export const letterReveal: TemplateDefinition = {
  id: "letter-reveal",
  name: "Letter Reveal",
  tagline: "Each character pops into place in sequence.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Every letter lands.", maxLength: 48, shrinkToFit: true },
    { key: "emphasisLast", type: "toggle", label: "Accent last word", default: "on" },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

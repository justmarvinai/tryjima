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
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

const DEFAULT_LINES = ["We design.", "We animate.", "We ship — free."];
const PER_LINE = 0.5;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "ocean", name: "Ocean", colors: { background: "#0B2447", textColor: "#FFFFFF", accent: "#57C4E5" } },
];

function computeDuration(values: Values): number {
  const lines = asList(values.lines, DEFAULT_LINES).slice(0, 4);
  return 1.0 + lines.length * PER_LINE + 1.2;
}

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.058 : aspect === "9:16" ? 0.072 : 0.08;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const lines = asList(values.lines, DEFAULT_LINES).slice(0, 4);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  // Shrink one shared size to fit the widest line — single Text per line never wraps.
  const maxWidth = size.width * 0.84;
  const base = Math.round(size.width * fontFrac(ctx.aspect));
  const family = fonts.family("display");
  let widest = 0;
  for (const line of lines) widest = Math.max(widest, fonts.measure(line, { family, weight: 700, size: base }));
  const fitScale = widest > maxWidth ? maxWidth / widest : 1;
  const fontSize = Math.max(Math.round(size.width * 0.032), Math.floor(base * fitScale));
  const lineH = Math.round(fontSize * 1.24);

  const n = lines.length;
  const centerY = size.height * 0.5;

  // A stack container: each line sits at a fixed local y (top line at 0). The
  // container shifts UP as lines are added so the growing block stays centered.
  const stack = new Container();
  stack.position.set(size.width / 2, centerY);
  root.addChild(stack);

  const timeline = new JimaTimeline();

  lines.forEach((line, i) => {
    const isAccent = i === n - 1;
    const t = makeText(fonts, { text: line, role: "display", weight: 700, size: fontSize, color: isAccent ? accent : textColor, anchor: 0.5, align: "center" });
    const localY = i * lineH;
    t.position.set(0, localY);
    t.alpha = 0;
    stack.addChild(t);

    const start = 0.6 + i * PER_LINE;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outCubic })
      .to(t, { prop: "y", from: localY + lineH * 0.7, to: localY, start, duration: 0.55, ease: outExpo });

    // Shift the whole stack up by half a line so lines 0..i stay centered.
    if (i > 0) {
      timeline.to(stack, {
        prop: "y",
        from: centerY - ((i - 1) * lineH) / 2,
        to: centerY - (i * lineH) / 2,
        start,
        duration: 0.55,
        ease: outExpo,
      });
    }
  });

  return { timeline, duration: computeDuration(values) };
}

export const stackedBuild: TemplateDefinition = {
  id: "stacked-build",
  name: "Stacked Build",
  tagline: "Lines rise in one by one and stack into a centered statement.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "lines", type: "textlist", label: "Lines", default: DEFAULT_LINES, minItems: 2, maxItems: 4, maxLength: 40 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

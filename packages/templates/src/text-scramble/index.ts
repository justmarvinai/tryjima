import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outCubic,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutChars } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

// Glyphs a scrambling character may cycle through before it resolves.
const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&*".split("");
const SEQ_LEN = 24;
const SCRAMBLE_RATE = 18; // cycles/sec — Math.floor(t * RATE) keeps it pure in t
const FLASH = 0.18; // seconds a resolved glyph flashes the accent colour

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.09 : aspect === "9:16" ? 0.12 : 0.11;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Decoding motion");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const fontSize = Math.round(size.width * fontFrac(ctx.aspect));
  const lineHeight = Math.round(fontSize * 1.14);
  const content = new Container();
  content.alpha = 0;
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

  const timeline = new JimaTimeline();
  // The line materialises softly; the decode itself carries the motion.
  timeline.to(content, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.3, ease: outCubic });

  const glyphs: Text[] = [];
  const real: string[] = [];
  const seq: string[][] = [];
  const resolveTime: number[] = [];
  // Cache of the colour currently applied to each glyph, so update() only mutates
  // the (expensive) style.fill when it actually changes — output stays pure in t.
  const appliedColor: string[] = [];

  boxes.forEach((box, i) => {
    const g = makeText(fonts, {
      text: box.char,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
    });
    g.position.set(box.cx, box.cy);
    content.addChild(g);
    glyphs.push(g);
    real.push(box.char);

    // Precompute a fixed scramble sequence: fork ONCE per glyph, draw SEQ_LEN
    // picks from that forked stream so the sequence is deterministic and stable.
    const fi = rng.fork(i);
    const s: string[] = [];
    for (let k = 0; k < SEQ_LEN; k++) s.push(fi.pick(CHARSET));
    seq.push(s);

    resolveTime.push(0.3 + i * 0.045);
    appliedColor.push(textColor);
  });

  const lastIndex = boxes.length - 1;
  const duration = Math.max(2.8, 0.3 + lastIndex * 0.045 + 1.2);

  // Pure in t: for a given t every glyph's shown character and colour are fully
  // determined — no per-frame randomness, so the same t always renders the same.
  const update = (t: number): void => {
    const step = Math.floor(t * SCRAMBLE_RATE);
    for (let i = 0; i < glyphs.length; i++) {
      const g = glyphs[i]!;
      const rt = resolveTime[i]!;
      let wantText: string;
      let wantColor: string;
      if (t >= rt) {
        wantText = real[i]!;
        wantColor = t - rt < FLASH ? accent : textColor;
      } else {
        wantText = seq[i]![((step % SEQ_LEN) + SEQ_LEN) % SEQ_LEN]!;
        wantColor = textColor;
      }
      if (g.text !== wantText) g.text = wantText;
      if (appliedColor[i] !== wantColor) {
        g.style.fill = wantColor;
        appliedColor[i] = wantColor;
      }
    }
  };

  return { timeline, duration, update };
}

export const textScramble: TemplateDefinition = {
  id: "text-scramble",
  name: "Text Scramble",
  tagline: "Letters flicker through noise and decode into place.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Decoding motion", maxLength: 40, shrinkToFit: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

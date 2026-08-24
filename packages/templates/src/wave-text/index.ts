import { Container, Graphics, type Text } from "pixi.js";
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

const TAU = Math.PI * 2;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
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
      return { fontFrac: 0.082, maxWidthFrac: 0.86, centerYFrac: 0.5 };
    case "9:16":
      return { fontFrac: 0.12, maxWidthFrac: 0.86, centerYFrac: 0.46 };
    case "4:5":
      return { fontFrac: 0.108, maxWidthFrac: 0.86, centerYFrac: 0.47 };
    case "1:1":
    default:
      return { fontFrac: 0.108, maxWidthFrac: 0.86, centerYFrac: 0.48 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const headline = str(values.headline, "Riding the wave");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));
  const L = layout(ctx.aspect);
  const fontSize = Math.round(size.width * L.fontFrac);
  const lineHeight = Math.round(fontSize * 1.12);

  const content = new Container();
  root.addChild(content);

  const boxes = layoutChars(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth: size.width * L.maxWidthFrac,
    align: "center",
    anchorX: size.width / 2,
    centerY: size.height * L.centerYFrac,
  });

  // One full period => the last frame equals the first: a seamless loop.
  const period = 2.9;
  const amp = fontSize * 0.14;
  const pop = makeOutBack(1.4);

  const timeline = new JimaTimeline();
  const glyphs: { t: Text; baseY: number; index: number }[] = [];
  for (const box of boxes) {
    const t = makeText(fonts, { text: box.char, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    t.scale.set(0.4);
    content.addChild(t);
    const start = 0.3 + box.index * 0.03;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outCubic })
      .to(t, { prop: "scale.x", from: 0.4, to: 1, start, duration: 0.5, ease: pop })
      .to(t, { prop: "scale.y", from: 0.4, to: 1, start, duration: 0.5, ease: pop });
    glyphs.push({ t, baseY: box.cy, index: box.index });
  }

  // Continuous sine bob — pure in t, seamless because sin repeats every period.
  const omega = TAU / period;
  const update = (t: number): void => {
    const phase = t * omega;
    for (const g of glyphs) {
      g.t.y = g.baseY + amp * Math.sin(g.index * 0.5 + phase);
    }
  };

  return { timeline, duration: period, update };
}

export const waveText: TemplateDefinition = {
  id: "wave-text",
  name: "Wave Text",
  tagline: "Letters settle in, then ride a gentle sine wave on loop.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: true,
  posterTime: 1.5,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Riding the wave", maxLength: 40, shrinkToFit: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

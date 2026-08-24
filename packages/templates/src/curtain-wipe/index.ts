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
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "ocean", name: "Ocean", colors: { background: "#0B2447", textColor: "#FFFFFF", accent: "#57C4E5" } },
];

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.082 : aspect === "9:16" ? 0.104 : 0.094;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Reveal the story");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const fontSize = Math.round(size.width * fontFrac(ctx.aspect));
  const lineHeight = Math.round(fontSize * 1.14);
  const maxWidthFrac = ctx.aspect === "16:9" ? 0.78 : 0.84;

  const boxes = layoutWords(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth: size.width * maxWidthFrac,
    align: "center",
    anchorX: size.width / 2,
    centerY: size.height * 0.5,
  });

  const timeline = new JimaTimeline();

  // Fallback for an empty headline: nothing to reveal, hold a clean frame.
  if (!boxes.length) return { timeline, duration: 3.4 };

  // Text block bounds (the region the curtain covers and the mask reveals).
  const blockLeft = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const blockRight = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const blockTop = Math.min(...boxes.map((b) => b.cy)) - fontSize * 0.72;
  const blockBottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.72;
  const blockH = blockBottom - blockTop;
  const blockMidY = (blockTop + blockBottom) / 2;

  const pad = fontSize * 0.12;
  const maskLeft = blockLeft - pad;
  const maskW = blockRight - blockLeft + pad * 2;
  const maskRight = maskLeft + maskW;

  // Headline text, hidden behind a left-anchored mask that grows to reveal it.
  const content = new Container();
  const mask = new Graphics().rect(0, 0, maskW, blockH).fill("#FFFFFF");
  mask.position.set(maskLeft, blockTop);
  mask.scale.set(0, 1);
  root.addChild(mask);
  for (const b of boxes) {
    const t = makeText(fonts, { text: b.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(b.cx, b.cy);
    content.addChild(t);
  }
  content.mask = mask;
  root.addChild(content);

  // Solid accent curtain bar, sitting over the text, leading the reveal edge
  // (phase A tracks the mask exactly) then sliding off the right (phase B).
  const barW = maskW + fontSize * 0.3;
  const barH = blockH + fontSize * 0.4;
  const bar = new Graphics().rect(0, 0, barW, barH).fill(accent);
  bar.position.set(maskLeft, blockMidY - barH / 2);
  root.addChild(bar);

  const S = 0.45;
  const D1 = 1.0;
  const D2 = 0.6;
  timeline
    .to(mask, { prop: "scale.x", from: 0, to: 1, start: S, duration: D1, ease: outExpo })
    .to(bar, { prop: "x", from: maskLeft, to: maskRight, start: S, duration: D1, ease: outExpo })
    .to(bar, { prop: "x", from: maskRight, to: size.width + barW, start: S + D1, duration: D2, ease: outCubic });

  return { timeline, duration: 3.4 };
}

export const curtainWipe: TemplateDefinition = {
  id: "curtain-wipe",
  name: "Curtain Wipe",
  tagline: "An accent curtain sweeps across and leaves the headline behind.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Reveal the story", maxLength: 56, shrinkToFit: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

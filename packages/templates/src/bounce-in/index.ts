import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outCubic,
  outQuad,
  spring,
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
  { id: "lime", name: "Lime pop", colors: { background: "#0F1408", textColor: "#F3F8E4", accent: "#B6F24D" } },
];

interface L {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.08, maxWidthFrac: 0.8, centerYFrac: 0.5 };
    case "9:16":
      return { fontFrac: 0.11, maxWidthFrac: 0.84, centerYFrac: 0.44 };
    case "4:5":
      return { fontFrac: 0.1, maxWidthFrac: 0.84, centerYFrac: 0.45 };
    case "1:1":
    default:
      return { fontFrac: 0.1, maxWidthFrac: 0.84, centerYFrac: 0.46 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const headline = str(values.headline, "Bounce into it");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));
  const L = layout(ctx.aspect);
  const fontSize = Math.round(size.width * L.fontFrac);
  const lineHeight = Math.round(fontSize * 1.16);

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
  if (boxes.length === 0) return { timeline, duration: 3.4 };

  const offset = fontSize * 1.15;
  const drop = spring(0.55); // soft, well-damped bounce on landing
  const settle = spring(0.5);

  let lastStart = 0.3;
  boxes.forEach((box, i) => {
    const t = makeText(fonts, { text: box.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    t.scale.set(1);
    content.addChild(t);

    const start = 0.3 + i * 0.14;
    lastStart = start;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.22, ease: outCubic })
      .to(t, { prop: "y", from: box.cy - offset, to: box.cy, start, duration: 0.9, ease: drop })
      // subtle landing squash: dip vertically, stretch horizontally, then settle
      .to(t, { prop: "scale.y", from: 1, to: 0.9, start: start + 0.38, duration: 0.1, ease: outQuad })
      .to(t, { prop: "scale.y", from: 0.9, to: 1, start: start + 0.48, duration: 0.34, ease: settle })
      .to(t, { prop: "scale.x", from: 1, to: 1.05, start: start + 0.38, duration: 0.1, ease: outQuad })
      .to(t, { prop: "scale.x", from: 1.05, to: 1, start: start + 0.48, duration: 0.34, ease: settle });
  });

  return { timeline, duration: Math.max(3.4, lastStart + 1.4) };
}

export const bounceIn: TemplateDefinition = {
  id: "bounce-in",
  name: "Bounce In",
  tagline: "Words drop from above and settle with a soft bounce.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.2,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Bounce into it", maxLength: 44, shrinkToFit: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

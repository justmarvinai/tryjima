import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outCubic,
  outExpo,
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
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
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
      return { fontFrac: 0.078, maxWidthFrac: 0.8, centerYFrac: 0.46 };
    case "9:16":
      return { fontFrac: 0.106, maxWidthFrac: 0.84, centerYFrac: 0.44 };
    case "4:5":
      return { fontFrac: 0.098, maxWidthFrac: 0.84, centerYFrac: 0.45 };
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
  const headline = str(values.headline, "Flip the script");
  const showAccentBar = values.accentBar !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const fontSize = Math.round(size.width * L.fontFrac);
  const lineHeight = Math.round(fontSize * 1.14);
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

  // Each word flips down into place: a squash-open on the vertical axis
  // (scale.y 0 → 1) plus a small drop, staggered. outExpo keeps the flip smooth
  // and lands it cleanly with no bounce.
  const drop = fontSize * 0.2;
  boxes.forEach((box, i) => {
    const t = makeText(fonts, { text: box.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy - drop);
    t.alpha = 0;
    t.scale.set(1, 0);
    content.addChild(t);
    const start = 0.35 + i * 0.14;
    timeline
      .to(t, { prop: "scale.y", from: 0, to: 1, start, duration: 0.75, ease: outExpo })
      .to(t, { prop: "y", from: box.cy - drop, to: box.cy, start, duration: 0.75, ease: outExpo })
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outCubic });
  });

  // A short accent underline draws in beneath the block as a quiet finish.
  const bottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.72;
  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const cxMid = (left + right) / 2;
  const lineW = Math.min(right - left, size.width * 0.18);
  const ulStart = 0.35 + boxes.length * 0.14 + 0.12;
  if (showAccentBar) {
    const underline = new Graphics().roundRect(-lineW / 2, 0, lineW, Math.max(3, fontSize * 0.06), 2).fill(accent);
    underline.position.set(cxMid, bottom);
    underline.alpha = 0;
    underline.scale.set(0.35, 1);
    content.addChild(underline);
    timeline
      .to(underline, { prop: "alpha", from: 0, to: 1, start: ulStart, duration: 0.5, ease: outCubic })
      .to(underline, { prop: "scale.x", from: 0.35, to: 1, start: ulStart, duration: 0.7, ease: outExpo });
  }

  const end = ulStart + 0.7;
  return { timeline, duration: Math.max(3.4, end + 0.7) };
}

export const flipWords: TemplateDefinition = {
  id: "flip-words",
  name: "Flip Words",
  tagline: "Each word flips down into place on the vertical axis.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Flip the script", maxLength: 50, shrinkToFit: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

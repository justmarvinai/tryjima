import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outCubic,
  outExpo,
  outQuint,
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

interface L {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.072, maxWidthFrac: 0.78, centerYFrac: 0.44 };
    case "9:16":
      return { fontFrac: 0.1, maxWidthFrac: 0.84, centerYFrac: 0.43 };
    case "4:5":
      return { fontFrac: 0.09, maxWidthFrac: 0.84, centerYFrac: 0.44 };
    case "1:1":
    default:
      return { fontFrac: 0.088, maxWidthFrac: 0.84, centerYFrac: 0.45 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Bring it into focus");
  const subline = str(values.subline, "");
  const showAccentBar = values.accentBar !== false;

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

  // Each word starts wide + soft + slightly large, then converges sharp — like a
  // lens pulling into focus. letterSpacing collapses to 0, alpha ramps, scale
  // settles from 1.06 → 1. outExpo makes the resolve feel crisp but smooth.
  const spread = fontSize * 0.4;
  boxes.forEach((box, i) => {
    const t = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
      letterSpacing: spread,
    });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    t.scale.set(1.06);
    content.addChild(t);
    const start = 0.35 + i * 0.12;
    timeline
      .to(t, { prop: "style.letterSpacing", from: spread, to: 0, start, duration: 0.8, ease: outExpo })
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.7, ease: outCubic })
      .to(t, { prop: "scale.x", from: 1.06, to: 1, start, duration: 0.8, ease: outExpo })
      .to(t, { prop: "scale.y", from: 1.06, to: 1, start, duration: 0.8, ease: outExpo });
  });

  // A short accent underline settles in as a quiet finish.
  const bottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.72;
  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const cxMid = (left + right) / 2;
  const lineW = Math.min(right - left, size.width * 0.16);
  const ulStart = 0.35 + boxes.length * 0.12 + 0.1;
  if (showAccentBar) {
    const underline = new Graphics().roundRect(-lineW / 2, 0, lineW, Math.max(3, fontSize * 0.055), 2).fill(accent);
    underline.position.set(cxMid, bottom);
    underline.alpha = 0;
    underline.scale.set(0.4, 1);
    content.addChild(underline);
    timeline
      .to(underline, { prop: "alpha", from: 0, to: 1, start: ulStart, duration: 0.5, ease: outCubic })
      .to(underline, { prop: "scale.x", from: 0.4, to: 1, start: ulStart, duration: 0.7, ease: outExpo });
  }

  let end = ulStart + 0.7;
  if (subline.length > 0) {
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: Math.round(fontSize * 0.3),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const subY = bottom + fontSize * 0.55;
    sub.position.set(cxMid, subY);
    sub.alpha = 0;
    content.addChild(sub);
    const subStart = ulStart + 0.25;
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.85, start: subStart, duration: 0.7, ease: outCubic })
      .to(sub, { prop: "y", from: subY + fontSize * 0.25, to: subY, start: subStart, duration: 0.8, ease: outQuint });
    end = subStart + 0.8;
  }

  return { timeline, duration: Math.max(3.6, end + 0.6) };
}

export const focusIn: TemplateDefinition = {
  id: "focus-in",
  name: "Focus In",
  tagline: "Words pull into sharp focus, letter spacing collapsing like a lens.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Bring it into focus", maxLength: 60, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Sharp, smooth, effortless", maxLength: 80, optional: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

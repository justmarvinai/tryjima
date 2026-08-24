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
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

interface L {
  fontFrac: number;
  maxWidthFrac: number;
  align: "left" | "center";
  anchorXFrac: number;
  centerYFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.078, maxWidthFrac: 0.78, align: "center", anchorXFrac: 0.5, centerYFrac: 0.46 };
    case "9:16":
      return { fontFrac: 0.11, maxWidthFrac: 0.84, align: "center", anchorXFrac: 0.5, centerYFrac: 0.44 };
    case "4:5":
      return { fontFrac: 0.1, maxWidthFrac: 0.84, align: "center", anchorXFrac: 0.5, centerYFrac: 0.44 };
    case "1:1":
    default:
      return { fontFrac: 0.098, maxWidthFrac: 0.84, align: "center", anchorXFrac: 0.5, centerYFrac: 0.45 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Say it softly, and let it move.");
  const subline = str(values.subline, "");
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
    align: L.align,
    anchorX: size.width * L.anchorXFrac,
    centerY: size.height * L.centerYFrac,
  });

  const timeline = new JimaTimeline();
  const drift = fontSize * 0.5;
  boxes.forEach((box, i) => {
    const t = makeText(fonts, { text: box.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    content.addChild(t);
    const start = 0.3 + i * 0.12;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.7, ease: outCubic })
      .to(t, { prop: "y", from: box.cy + drift, to: box.cy, start, duration: 0.9, ease: outQuint });
  });

  // A thin accent line drifts in beneath the block as a quiet finish.
  const bottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.72;
  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const lineW = Math.min(right - left, size.width * 0.2);
  const cxMid = (left + right) / 2;
  const lineStart = 0.3 + boxes.length * 0.12 + 0.1;
  if (showAccentBar) {
    const accentLine = new Graphics().roundRect(-lineW / 2, 0, lineW, Math.max(3, fontSize * 0.06), 2).fill(accent);
    accentLine.position.set(cxMid, bottom);
    accentLine.alpha = 0;
    accentLine.scale.set(0.4, 1);
    content.addChild(accentLine);
    timeline
      .to(accentLine, { prop: "alpha", from: 0, to: 1, start: lineStart, duration: 0.6, ease: outCubic })
      .to(accentLine, { prop: "scale.x", from: 0.4, to: 1, start: lineStart, duration: 0.7, ease: outExpo });
  }

  let end = lineStart + 0.7;
  if (subline.length > 0) {
    const sub = makeText(fonts, { text: subline, role: "body", weight: 500, size: Math.round(fontSize * 0.32), color: textColor, anchor: 0.5, align: "center" });
    const subY = bottom + fontSize * 0.6;
    sub.position.set(cxMid, subY);
    sub.alpha = 0;
    content.addChild(sub);
    const subStart = lineStart + 0.3;
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.85, start: subStart, duration: 0.7, ease: outCubic })
      .to(sub, { prop: "y", from: subY + fontSize * 0.3, to: subY, start: subStart, duration: 0.8, ease: outQuint });
    end = subStart + 0.8;
  }

  return { timeline, duration: Math.max(3.2, end + 0.8) };
}

export const fadeCascade: TemplateDefinition = {
  id: "fade-cascade",
  name: "Fade Cascade",
  tagline: "Words fade and drift up, one soft beat at a time.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Say it softly, and let it move.", maxLength: 70, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Made in Jima", maxLength: 80, optional: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

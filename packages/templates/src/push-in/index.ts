import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outCubic,
  outQuint,
  inOutQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

interface L {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
  blockHFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.09, maxWidthFrac: 0.72, centerYFrac: 0.44, blockHFrac: 0.58 };
    case "9:16":
      return { fontFrac: 0.115, maxWidthFrac: 0.82, centerYFrac: 0.42, blockHFrac: 0.48 };
    case "4:5":
      return { fontFrac: 0.104, maxWidthFrac: 0.82, centerYFrac: 0.43, blockHFrac: 0.52 };
    case "1:1":
    default:
      return { fontFrac: 0.1, maxWidthFrac: 0.82, centerYFrac: 0.44, blockHFrac: 0.54 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Lean in close");
  const subline = str(values.subline, "");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  // Fit the headline vertically — shrink the font if it would overflow.
  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.1);
  let boxes = layoutWords(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth,
    align: "center",
    anchorX: cx,
    centerY,
  });
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lineCount * lineHeight > maxBlockH; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.1);
    boxes = layoutWords(headline, fonts, {
      role: "display",
      weight: 700,
      fontSize,
      lineHeight,
      maxWidth,
      align: "center",
      anchorX: cx,
      centerY,
    });
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  // One container carries the whole camera move, scaling about the block center.
  const content = new Container();
  content.position.set(cx, centerY);
  content.pivot.set(cx, centerY);
  root.addChild(content);

  const timeline = new JimaTimeline();

  // Camera settle: start slightly large, ease to rest with outExpo, then a very
  // slow continuous drift so the hold stays quietly alive.
  timeline
    .to(content, { prop: "scale.x", from: 1.25, to: 1, start: 0.2, duration: 1.0, ease: outExpo })
    .to(content, { prop: "scale.y", from: 1.25, to: 1, start: 0.2, duration: 1.0, ease: outExpo })
    .to(content, { prop: "scale.x", from: 1, to: 1.02, start: 1.2, duration: 2.1, ease: inOutQuad })
    .to(content, { prop: "scale.y", from: 1, to: 1.02, start: 1.2, duration: 2.1, ease: inOutQuad });

  // Words are soft (alpha 0) at the large scale and fade up with a tiny stagger.
  boxes.forEach((box, i) => {
    const t = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
    });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    content.addChild(t);
    const start = 0.2 + i * 0.05;
    timeline.to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.6, ease: outCubic });
  });

  // A short accent rule settles in beneath the headline as the push lands.
  const showAccentBar = values.accentBar !== false;
  const bottom = boxes.length ? Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.72 : centerY;
  const ruleStart = 1.15;
  if (showAccentBar) {
    const ruleW = Math.min(size.width * 0.14, fontSize * 2.4);
    const rule = new Graphics().roundRect(-ruleW / 2, 0, ruleW, Math.max(3, fontSize * 0.055), 2).fill(accent);
    rule.position.set(cx, bottom);
    rule.alpha = 0;
    rule.scale.set(0.3, 1);
    content.addChild(rule);
    timeline
      .to(rule, { prop: "alpha", from: 0, to: 1, start: ruleStart, duration: 0.5, ease: outCubic })
      .to(rule, { prop: "scale.x", from: 0.3, to: 1, start: ruleStart, duration: 0.7, ease: outExpo });
  }

  let end = ruleStart + 0.7;
  if (subline.length > 0) {
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: Math.round(fontSize * 0.34),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const subY = bottom + fontSize * 0.62;
    sub.position.set(cx, subY);
    sub.alpha = 0;
    content.addChild(sub);
    const subStart = ruleStart + 0.35;
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.82, start: subStart, duration: 0.6, ease: outCubic })
      .to(sub, { prop: "y", from: subY + fontSize * 0.32, to: subY, start: subStart, duration: 0.75, ease: outQuint });
    end = subStart + 0.75;
  }

  return { timeline, duration: Math.max(3.6, end + 0.6) };
}

export const pushIn: TemplateDefinition = {
  id: "push-in",
  name: "Push In",
  tagline: "A cinematic push-in settles the headline, then breathes.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Lean in close", maxLength: 50, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Every detail counts", maxLength: 70, optional: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

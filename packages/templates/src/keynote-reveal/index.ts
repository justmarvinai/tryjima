import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
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
  { id: "keynote-light", name: "Keynote light", colors: { background: "#F5F5F7", textColor: "#1D1D1F", accent: "#FF4D1C" } },
  { id: "keynote-dark", name: "Keynote dark", colors: { background: "#000000", textColor: "#F5F5F7", accent: "#FF4D1C" } },
  { id: "paper", name: "Paper", colors: { background: "#FAF5EA", textColor: "#2A1A5E", accent: "#7C5CFF" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
];

interface AspectLayout {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
  blockHFrac: number;
}

function aspectLayout(aspect: Aspect): AspectLayout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.07, maxWidthFrac: 0.78, centerYFrac: 0.42, blockHFrac: 0.42 };
    case "1:1":
      return { fontFrac: 0.086, maxWidthFrac: 0.82, centerYFrac: 0.43, blockHFrac: 0.46 };
    case "4:5":
      return { fontFrac: 0.085, maxWidthFrac: 0.82, centerYFrac: 0.43, blockHFrac: 0.46 };
    case "9:16":
      return { fontFrac: 0.092, maxWidthFrac: 0.84, centerYFrac: 0.43, blockHFrac: 0.44 };
  }
}

const DURATION = 4.5;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F5F7"));
  const textColor = str(values.textColor, pc("textColor", "#1D1D1F"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Think different. Move different.");
  const subline = str(values.subline, "");
  const showAccentBar = values.accentBar !== false;

  const L = aspectLayout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  // --- Refined weight-500 headline, fit so it never overflows the block ---
  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.16);
  const relayout = () =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 500,
      fontSize,
      lineHeight,
      maxWidth,
      align: "center",
      anchorX: cx,
      centerY,
    });
  let boxes = relayout();
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lineCount * lineHeight > maxBlockH; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.16);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();

  // --- Word-by-word soft focus-in (fade + rise + settle from 1.06) ---
  const wordStart = 0.4;
  const stagger = 0.16;
  const rise = Math.max(12, fontSize * 0.12);
  boxes.forEach((box, i) => {
    const start = wordStart + i * stagger;
    const t = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 500,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
    });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    root.addChild(t);
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.6, ease: outQuad })
      .to(t, { prop: "y", from: box.cy + rise, to: box.cy, start, duration: 0.7, ease: outExpo })
      .to(t, { prop: "scale.x", from: 1.06, to: 1, start, duration: 0.7, ease: outExpo })
      .to(t, { prop: "scale.y", from: 1.06, to: 1, start, duration: 0.7, ease: outExpo });
  });

  const blockBottom = boxes.length ? Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.5 : centerY;
  const n = boxes.length;
  const headlineLanded = wordStart + Math.max(0, n - 1) * stagger + 0.5;

  // --- Thin accent divider draws from centre after the headline lands ---
  const dividerY = blockBottom + fontSize * 0.62;
  const divStart = Math.max(1.7, headlineLanded + 0.2);
  if (showAccentBar) {
    const divW = fontSize * 2.4;
    const divH = Math.max(2, Math.round(size.width * 0.0016));
    const divider = new Graphics().roundRect(-divW / 2, -divH / 2, divW, divH, divH / 2).fill(accent);
    divider.position.set(cx, dividerY);
    divider.scale.x = 0;
    root.addChild(divider);
    timeline.to(divider, { prop: "scale.x", from: 0, to: 1, start: divStart, duration: 0.6, ease: outExpo });
  }

  // --- Muted subline fades up last, lots of air ---
  if (subline.length > 0) {
    const subY = dividerY + fontSize * 0.72;
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 400,
      size: Math.round(fontSize * 0.32),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    const subStart = divStart + 0.65;
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.62, start: subStart, duration: 0.7, ease: outQuad })
      .to(sub, { prop: "y", from: subY + 12, to: subY, start: subStart, duration: 0.7, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const keynoteReveal: TemplateDefinition = {
  id: "keynote-reveal",
  name: "Keynote Reveal",
  tagline: "A calm, spacious Apple-keynote word-by-word reveal.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Think different. Move different.", maxLength: 60, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Motion for everyone.", maxLength: 80, optional: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

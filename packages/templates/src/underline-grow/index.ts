import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  shrinkToFit,
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
const num = (v: unknown, d: number): number => (typeof v === "number" ? v : d);

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "ocean", name: "Ocean", colors: { background: "#0B2447", textColor: "#FFFFFF", accent: "#57C4E5" } },
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
      return { fontFrac: 0.076, maxWidthFrac: 0.72, centerYFrac: 0.46, blockHFrac: 0.54 };
    case "9:16":
      return { fontFrac: 0.094, maxWidthFrac: 0.84, centerYFrac: 0.42, blockHFrac: 0.5 };
    case "4:5":
      return { fontFrac: 0.088, maxWidthFrac: 0.82, centerYFrac: 0.43, blockHFrac: 0.56 };
    case "1:1":
    default:
      return { fontFrac: 0.09, maxWidthFrac: 0.82, centerYFrac: 0.44, blockHFrac: 0.54 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Say it clearly");
  const sublineRaw = typeof values.subline === "string" ? values.subline : "Made in Jima Studio";
  const subline = sublineRaw.trim();
  const showUnderline = values.showUnderline !== false;
  const underlineWeight = Math.min(0.16, Math.max(0.04, num(values.underlineWeight, 0.09)));

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  // Fit the headline vertically — shrink if it wraps to too many lines.
  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.16);
  const relayout = () =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 700,
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

  const content = new Container();
  content.label = "content";
  root.addChild(content);
  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: 4.2 };

  // --- Headline: a calm fade + rise, word by word ---
  const numWords = boxes.length;
  boxes.forEach((b, i) => {
    const t = makeText(fonts, { text: b.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(b.cx, b.cy + fontSize * 0.32);
    t.alpha = 0;
    content.addChild(t);
    const start = 0.2 + i * 0.06;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.45, ease: outQuad })
      .to(t, { prop: "y", from: b.cy + fontSize * 0.32, to: b.cy, start, duration: 0.55, ease: outExpo });
  });
  const headlineWordsDone = 0.2 + Math.max(0, numWords - 1) * 0.06 + 0.55;

  // Geometry for the underline sits under the LAST LINE, regardless of toggle
  // state, so the subline below it is positioned consistently either way.
  const lastLine = Math.max(...boxes.map((b) => b.line));
  const lastLineBoxes = boxes.filter((b) => b.line === lastLine);
  const ulX0 = Math.min(...lastLineBoxes.map((b) => b.cx - b.width / 2));
  const ulX1 = Math.max(...lastLineBoxes.map((b) => b.cx + b.width / 2));
  const ulY = Math.max(...lastLineBoxes.map((b) => b.cy)) + fontSize * 0.64;
  const ulHeight = Math.max(4, Math.round(fontSize * underlineWeight));

  const hasSubline = subline.length > 0;
  const sublineStart = headlineWordsDone + 0.1;
  const afterText = hasSubline ? sublineStart + 0.55 : headlineWordsDone + 0.1;

  // --- Subline: fades/rises in alongside the headline's settle (own shrink-fit) ---
  if (hasSubline) {
    const subFamily = fonts.family("body");
    const subMeasure = (s: string, sz: number): number => fonts.measure(s, { family: subFamily, weight: 500, size: sz });
    const subBaseSize = Math.round(fontSize * 0.28);
    const subSize = shrinkToFit(subline, subMeasure, { maxWidth, baseSize: subBaseSize, minSize: Math.round(subBaseSize * 0.5) });
    const subY = ulY + ulHeight + fontSize * 0.46;
    const sub = makeText(fonts, { text: subline, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center" });
    sub.position.set(cx, subY + 12);
    sub.alpha = 0;
    content.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.85, start: sublineStart, duration: 0.5, ease: outQuad })
      .to(sub, { prop: "y", from: subY + 12, to: subY, start: sublineStart, duration: 0.55, ease: outQuint });
  }

  // --- The star: the accent underline grows in, then breathes once (toggleable) ---
  const underlineStart = afterText + 0.3;
  const underlineDur = 0.55;
  let breatheEnd = underlineStart + underlineDur;
  if (showUnderline) {
    const underline = new Graphics().roundRect(0, 0, ulX1 - ulX0, ulHeight, ulHeight / 2).fill(accent);
    underline.position.set(ulX0, ulY);
    underline.scale.set(0, 1);
    content.addChild(underline);
    timeline
      .to(underline, { prop: "scale.x", from: 0, to: 1, start: underlineStart, duration: underlineDur, ease: outExpo })
      .to(underline, { prop: "scale.x", from: 1, to: 1.035, start: underlineStart + underlineDur, duration: 0.35, ease: outQuad })
      .to(underline, { prop: "scale.x", from: 1.035, to: 1, start: underlineStart + underlineDur + 0.35, duration: 0.4, ease: outQuad });
    breatheEnd = underlineStart + underlineDur + 0.35 + 0.4;
  }

  const duration = Math.max(4.2, breatheEnd + 1.1);
  return { timeline, duration };
}

export const underlineGrow: TemplateDefinition = {
  id: "underline-grow",
  name: "Underline Grow",
  tagline: "A calm headline settles, then the accent bar grows in underneath.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Say it clearly", maxLength: 60, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Made in Jima Studio", maxLength: 80, optional: true },
    { key: "showUnderline", type: "toggle", label: "Underline", default: true },
    { key: "underlineWeight", type: "slider", label: "Underline weight", default: 0.09, min: 0.04, max: 0.16, step: 0.01 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

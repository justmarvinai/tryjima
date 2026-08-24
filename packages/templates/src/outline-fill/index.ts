import { Container, Graphics, Text, TextStyle } from "pixi.js";
import {
  JimaTimeline,
  outQuad,
  outExpo,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night-lime", name: "Night lime", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "cream-ink", name: "Cream ink", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.12, maxWidthFrac: 0.78, centerYFrac: 0.5 };
    case "9:16":
      return { fontFrac: 0.15, maxWidthFrac: 0.82, centerYFrac: 0.44 };
    case "4:5":
      return { fontFrac: 0.14, maxWidthFrac: 0.82, centerYFrac: 0.45 };
    case "1:1":
    default:
      return { fontFrac: 0.14, maxWidthFrac: 0.82, centerYFrac: 0.47 };
  }
}

/** Greedy-wrap into <=2 lines, then shrink so the widest line fits maxWidth. */
function wrapAndFit(
  fonts: FontRegistry,
  text: string,
  size0: number,
  maxWidth: number,
): { lines: string[]; size: number } {
  const family = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight: 700, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  const maxLines = 2;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(14, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

/**
 * A headline Text with an optional stroke. The "outline" copy is built with
 * fill = background (so its interior blends into the backdrop, reading as a
 * hollow letterform) and stroke = accent; the "fill" copy is a plain solid
 * Text with no stroke, layered on top and revealed via a mask.
 */
function makeLayeredText(
  fonts: FontRegistry,
  text: string,
  size: number,
  lineHeight: number,
  fillColor: string,
  strokeColor: string | null,
  strokeWidth: number,
): Text {
  const style = new TextStyle({
    fontFamily: fonts.family("display"),
    fontSize: size,
    fontWeight: String(700) as TextStyle["fontWeight"],
    fill: fillColor,
    align: "center",
    lineHeight,
    ...(strokeColor ? { stroke: { color: strokeColor, width: strokeWidth, join: "round" as const } } : {}),
  });
  const t = new Text({ text, style });
  t.anchor.set(0.5);
  return t;
}

const DUR = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Make a statement");
  const showOutline = on(values.showOutline);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cy = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const size0 = Math.round(size.width * L.fontFrac);
  const { lines, size: fitSize } = wrapAndFit(fonts, headline, size0, maxWidth);
  const lineHeight = Math.round(fitSize * 1.08);
  const joined = lines.join("\n");
  const strokeWidth = Math.max(2, Math.round(fitSize * 0.05));

  const timeline = new JimaTimeline();

  if (showOutline) {
    // Stage 1: the outline appears (hollow letterforms, stroke only).
    const outlineLayer = new Container();
    outlineLayer.label = "outline";
    root.addChild(outlineLayer);
    const outlineText = makeLayeredText(fonts, joined, fitSize, lineHeight, bg, accent, strokeWidth);
    outlineText.position.set(cx, cy);
    outlineText.alpha = 0;
    outlineText.scale.set(0.94);
    outlineLayer.addChild(outlineText);
    timeline
      .to(outlineText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.45, ease: outQuad })
      .to(outlineText, { prop: "scale.x", from: 0.94, to: 1, start: 0.15, duration: 0.5, ease: outExpo })
      .to(outlineText, { prop: "scale.y", from: 0.94, to: 1, start: 0.15, duration: 0.5, ease: outExpo });

    // Stage 2: the solid fill wipes left -> right over the outline.
    const fillLayer = new Container();
    fillLayer.label = "fill";
    root.addChild(fillLayer);
    const fillText = makeLayeredText(fonts, joined, fitSize, lineHeight, textColor, null, 0);
    fillText.position.set(cx, cy);
    fillLayer.addChild(fillText);

    const padX = fitSize * 0.3;
    const padY = fitSize * 0.6;
    const maskW = fillText.width + padX * 2;
    const maskH = fillText.height + padY * 2;
    const fillMask = new Graphics().rect(0, 0, maskW, maskH).fill("#FFFFFF");
    fillMask.position.set(cx - fillText.width / 2 - padX, cy - fillText.height / 2 - padY);
    fillMask.scale.x = 0; // pivoted at its own left edge -> grows rightward
    root.addChild(fillMask);
    fillLayer.mask = fillMask;

    timeline.to(fillMask, { prop: "scale.x", from: 0, to: 1, start: 1.0, duration: 0.85, ease: outExpo });
  } else {
    // Outline off: a plain, simple fade/rise of the solid headline.
    const fillText = makeLayeredText(fonts, joined, fitSize, lineHeight, textColor, null, 0);
    fillText.position.set(cx, cy);
    fillText.alpha = 0;
    root.addChild(fillText);
    timeline
      .to(fillText, { prop: "alpha", from: 0, to: 1, start: 0.25, duration: 0.6, ease: outQuad })
      .to(fillText, { prop: "y", from: cy + fitSize * 0.25, to: cy, start: 0.25, duration: 0.65, ease: outExpo });
  }

  return { timeline, duration: DUR };
}

export const outlineFill: TemplateDefinition = {
  id: "outline-fill",
  name: "Outline Fill",
  tagline: "A headline appears as an outline, then its solid fill wipes across.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { headline: "display" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Make a statement", maxLength: 40, shrinkToFit: true },
    { key: "showOutline", type: "toggle", label: "Outline entrance", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Outline", default: "", optional: true },
  ],
  build,
};

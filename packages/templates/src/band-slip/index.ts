import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutQuint,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

// Band Slip — the headline is sliced into horizontal bands that start offset
// left and right like a mis-cut print, then slide back into a single aligned
// word. `split-reveal` cuts once down the middle; this cuts across, into five
// or more strips, and every strip travels a different distance.
//
// The slices are real: the same text is drawn once per band and each copy is
// masked to its own horizontal strip, so the letterforms tear exactly where the
// cuts fall rather than being faked with separate lines of type.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#F6F5F1", textColor: "#131316", accent: "#D6453B" } },
  { id: "ink", name: "Ink", colors: { background: "#101216", textColor: "#F4F4F2", accent: "#5EEAD4" } },
  { id: "amber", name: "Amber", colors: { background: "#1A1408", textColor: "#FDF6E7", accent: "#F5A623" } },
  { id: "slate", name: "Slate", colors: { background: "#EDF0F3", textColor: "#111820", accent: "#2563EB" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.1, maxWidthFrac: 0.76, centerFrac: 0.47 };
    case "9:16":
      return { fontFrac: 0.13, maxWidthFrac: 0.86, centerFrac: 0.46 };
    case "4:5":
      return { fontFrac: 0.122, maxWidthFrac: 0.84, centerFrac: 0.47 };
    case "1:1":
    default:
      return { fontFrac: 0.124, maxWidthFrac: 0.84, centerFrac: 0.47 };
  }
}

const SLIP_START = 0.25;
const SLIP_DUR = 1.25;
const DURATION = 3.9;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6F5F1"));
  const textColor = str(values.textColor, pc("textColor", "#131316"));
  const accent = str(values.accent, pc("accent", "#D6453B"));
  const headline = str(values.headline, "Realign");
  const subline = str(values.subline, "").trim();
  const bandCount = Math.round(num(values.bands, 6));
  const showAccentBand = on(values.showAccentBand);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerFrac;
  const maxWidth = size.width * L.maxWidthFrac;

  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.06);
  const relayout = () =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 800,
      fontSize,
      lineHeight,
      maxWidth,
      align: "center",
      anchorX: cx,
      centerY,
    });
  let boxes = relayout();
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lineCount * lineHeight > size.height * 0.5; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.06);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: DURATION };

  const top = Math.min(...boxes.map((b) => b.cy)) - lineHeight * 0.68;
  const bottom = Math.max(...boxes.map((b) => b.cy)) + lineHeight * 0.68;
  const blockH = bottom - top;
  const bands = Math.max(3, Math.min(10, bandCount));
  const bandH = blockH / bands;

  const drawWords = (parent: Container, color: string): void => {
    for (const box of boxes) {
      const t = makeText(fonts, {
        text: box.text,
        role: "display",
        weight: 800,
        size: fontSize,
        color,
        anchor: 0.5,
        letterSpacing: -fontSize * 0.014,
      });
      t.position.set(box.cx, box.cy);
      parent.addChild(t);
    }
  };

  // One band, one masked copy of the whole headline. The mask is a strip; the
  // copy slides behind it, so the visible slice tears at the strip edges.
  for (let i = 0; i < bands; i++) {
    const y0 = top + bandH * i;
    const band = new Container();
    root.addChild(band);
    drawWords(band, textColor);

    const strip = new Graphics().rect(0, y0, size.width, bandH + 1).fill("#FFFFFF");
    root.addChild(strip);
    band.mask = strip;

    // Alternate direction, with a seeded magnitude so no two projects tear the
    // same way, and a per-band delay so the block knits together top-to-bottom.
    const dir = i % 2 === 0 ? -1 : 1;
    const dist = size.width * (0.28 + rng.range(0, 0.34)) * dir;
    const at = SLIP_START + i * 0.055;
    band.alpha = 0;
    timeline
      .to(band, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.28, ease: outQuad })
      .to(band, { prop: "x", from: dist, to: 0, start: at, duration: SLIP_DUR, ease: inOutQuint });
  }

  // One band re-drawn in the accent colour, offset a hair longer, so the final
  // frame keeps a trace of the tear.
  if (showAccentBand) {
    // Low in the block, not through the middle: a slice offset across the
    // x-height reads as a strikethrough, one across the baseline reads as slip.
    const i = Math.min(bands - 1, Math.max(1, Math.round(bands * 0.74)));
    const y0 = top + bandH * i;
    const band = new Container();
    root.addChild(band);
    drawWords(band, accent);
    const strip = new Graphics().rect(0, y0, size.width, bandH + 1).fill("#FFFFFF");
    root.addChild(strip);
    band.mask = strip;
    const dist = -size.width * 0.42;
    // It comes to rest a hair short of alignment, so the end frame still shows
    // one slice out of register — the visual signature of the template.
    const rest = -size.width * 0.014;
    timeline
      .to(band, { prop: "alpha", from: 0, to: 1, start: SLIP_START, duration: 0.3, ease: outQuad })
      .to(band, { prop: "x", from: dist, to: rest, start: SLIP_START, duration: SLIP_DUR * 1.18, ease: inOutQuint });
  }

  const ruleH = Math.max(3, Math.round(size.width * 0.0032));
  const ruleW = Math.min(maxWidth, Math.max(...boxes.map((b) => b.cx + b.width / 2)) - Math.min(...boxes.map((b) => b.cx - b.width / 2)));
  const rule = new Graphics().rect(-ruleW / 2, -ruleH / 2, ruleW, ruleH).fill(accent);
  rule.position.set(cx, bottom + fontSize * 0.3);
  rule.scale.x = 0;
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: SLIP_START + SLIP_DUR * 0.75, duration: 0.7, ease: outExpo });

  if (subline.length > 0) {
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: Math.round(fontSize * 0.23),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const subY = bottom + fontSize * 0.72;
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.74, start: 1.85, duration: 0.6, ease: outQuad })
      .to(sub, { prop: "y", from: subY + fontSize * 0.14, to: subY, start: 1.85, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const bandSlip: TemplateDefinition = {
  id: "band-slip",
  name: "Band Slip",
  tagline: "The headline is sliced into strips that slide back into one aligned word.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Realign", maxLength: 28, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Everything back in place", maxLength: 60, optional: true },
    { key: "bands", type: "slider", label: "Slices", default: 6, min: 3, max: 10, step: 1 },
    { key: "showAccentBand", type: "toggle", label: "Accent slice", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

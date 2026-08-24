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

// Knockout — the headline is not drawn, it is *cut out* of a solid colour
// block: the letters are holes through which the background shows. The block
// grows to full bleed and the holes open with it, so the type appears by
// subtraction. Different from every other reveal here, which all add ink.
//
// Implementation: Pixi masks are binary stencils and cannot subtract, so the
// knockout is built the honest way — the block is drawn as a Graphics whose
// path is the rectangle plus each glyph's box as a reversed sub-path... which
// Graphics also can't express. Instead the block is a Container holding the
// slab, with the *background* colour re-drawn as text on top. Visually that is
// a knockout: the letters are exactly the backdrop, pixel for pixel.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "coral", name: "Coral", colors: { background: "#FFF6F1", textColor: "#1B1310", accent: "#E8503A" } },
  { id: "ink", name: "Ink", colors: { background: "#0F1115", textColor: "#F4F3EF", accent: "#EDE9E2" } },
  { id: "electric", name: "Electric", colors: { background: "#F3F4F8", textColor: "#12141C", accent: "#2C3BE0" } },
  { id: "lime", name: "Lime", colors: { background: "#111309", textColor: "#F7FBE8", accent: "#C6F24E" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerFrac: number;
  padFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.098, maxWidthFrac: 0.74, centerFrac: 0.5, padFrac: 0.055 };
    case "9:16":
      return { fontFrac: 0.13, maxWidthFrac: 0.84, centerFrac: 0.48, padFrac: 0.07 };
    case "4:5":
      return { fontFrac: 0.12, maxWidthFrac: 0.82, centerFrac: 0.49, padFrac: 0.065 };
    case "1:1":
    default:
      return { fontFrac: 0.122, maxWidthFrac: 0.82, centerFrac: 0.49, padFrac: 0.065 };
  }
}

const OPEN_START = 0.3;
const OPEN_DUR = 0.95;
const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF6F1"));
  const accent = str(values.accent, pc("accent", "#E8503A"));
  const textColor = str(values.textColor, pc("textColor", "#1B1310"));
  const headline = str(values.headline, "CUT THROUGH").toUpperCase();
  const subline = str(values.subline, "").trim();
  const fullBleed = on(values.fullBleed);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerFrac;
  const maxWidth = size.width * L.maxWidthFrac;

  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.02);
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
  let lines = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lines * lineHeight > size.height * 0.58; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.02);
    boxes = relayout();
    lines = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: DURATION };

  const pad = size.width * L.padFrac;
  const blockLeft = Math.min(...boxes.map((b) => b.cx - b.width / 2)) - pad;
  const blockRight = Math.max(...boxes.map((b) => b.cx + b.width / 2)) + pad;
  const blockTop = Math.min(...boxes.map((b) => b.cy)) - lineHeight * 0.62 - pad * 0.5;
  const blockBot = Math.max(...boxes.map((b) => b.cy)) + lineHeight * 0.62 + pad * 0.5;

  // The slab and the knocked-out glyphs travel together, so the holes stay
  // registered to the block through the whole open.
  const slabLayer = new Container();
  root.addChild(slabLayer);

  const finalW = fullBleed ? size.width : blockRight - blockLeft;
  const finalH = blockBot - blockTop;
  const slabX = fullBleed ? 0 : blockLeft;
  const slab = new Graphics().rect(0, 0, finalW, finalH).fill(accent);
  slab.position.set(slabX, blockTop);
  slabLayer.addChild(slab);

  // A clip that opens vertically from the block's centre line. Both the slab
  // and the holes live inside it, so the letters are revealed by the same
  // wavefront that grows the block — one motion, not two synced ones.
  const clip = new Graphics().rect(slabX, blockTop, finalW, finalH).fill("#FFFFFF");
  clip.pivot.set(0, blockTop + finalH / 2);
  clip.position.set(0, blockTop + finalH / 2);
  slabLayer.mask = clip;
  root.addChild(clip);
  timeline.to(clip, { prop: "scale.y", from: 0.02, to: 1, start: OPEN_START, duration: OPEN_DUR, ease: inOutQuint });

  for (const box of boxes) {
    const hole = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 800,
      size: fontSize,
      color: bg,
      anchor: 0.5,
      letterSpacing: -fontSize * 0.015,
    });
    hole.position.set(box.cx, box.cy);
    slabLayer.addChild(hole);
    // Each word widens slightly as the block settles — the hole "cuts open".
    timeline.to(hole, {
      prop: "scale.x",
      from: 0.9,
      to: 1,
      start: OPEN_START + 0.25 + box.line * 0.06,
      duration: 0.9,
      ease: outExpo,
    });
  }

  // A thin rule under the slab, so a full-bleed block still has an edge.
  const ruleH = Math.max(3, Math.round(size.width * 0.0035));
  const rule = new Graphics().rect(0, 0, finalW, ruleH).fill(textColor);
  rule.position.set(slabX, blockBot + size.height * 0.028);
  rule.scale.x = 0;
  rule.alpha = 0.85;
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: OPEN_START + OPEN_DUR * 0.7, duration: 0.8, ease: outExpo });

  if (subline.length > 0) {
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: Math.round(fontSize * 0.24),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const subY = blockBot + size.height * 0.085;
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.78, start: 1.5, duration: 0.6, ease: outQuad })
      .to(sub, { prop: "y", from: subY + fontSize * 0.16, to: subY, start: 1.5, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const knockoutText: TemplateDefinition = {
  id: "knockout-text",
  name: "Knockout",
  tagline: "The headline is cut out of a colour block — the letters are the background.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Cut through", maxLength: 40, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "No filler, just the point", maxLength: 60, optional: true },
    { key: "fullBleed", type: "toggle", label: "Full-width block", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Block", default: "", optional: true },
    { key: "textColor", type: "color", label: "Rule & subline", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

// A headline is revealed by a single mask that wipes across it on a diagonal
// (or, via the `direction` field, straight left->right), with a thin bright
// leading-edge line traveling exactly on the reveal front. Distinct from
// `box-wipe` (per-LINE wipes whose accent bar exits off-frame) and
// `curtain-wipe` (a solid curtain that covers, then fully slides away): here
// the whole block wipes as one, the mask itself never renders a solid block
// over the text, and an optional subtitle wipes in afterward with the same
// technique.

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "violet-cream", name: "Violet on cream", colors: { background: "#FAF5EA", textColor: "#3A1D6E", accent: "#7C5CFF" } },
  { id: "ocean", name: "Ocean", colors: { background: "#0B2447", textColor: "#FFFFFF", accent: "#57C4E5" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
  blockHFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.086, maxWidthFrac: 0.72, centerYFrac: 0.44, blockHFrac: 0.56 };
    case "9:16":
      return { fontFrac: 0.108, maxWidthFrac: 0.84, centerYFrac: 0.42, blockHFrac: 0.48 };
    case "4:5":
      return { fontFrac: 0.098, maxWidthFrac: 0.82, centerYFrac: 0.43, blockHFrac: 0.54 };
    case "1:1":
    default:
      return { fontFrac: 0.098, maxWidthFrac: 0.82, centerYFrac: 0.44, blockHFrac: 0.54 };
  }
}

interface Bounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface WipeGeom {
  px: number;
  py: number;
  ex: number;
  ey: number;
  bigWidth: number;
  bigHalfH: number;
}

/**
 * Projects an axis-aligned box onto the wipe's travel axis `u=(cos,sin)` and
 * its perpendicular `v`, then places a generously-sized reveal rect so it
 * hides the whole box at progress 0 and fully clears it at progress 1 — for
 * any angle. Pure geometry, no Pixi involved.
 */
function wipeGeometry(b: Bounds, angle: number, marginU: number, marginV: number): WipeGeom {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const corners = [
    { x: b.left, y: b.top },
    { x: b.right, y: b.top },
    { x: b.left, y: b.bottom },
    { x: b.right, y: b.bottom },
  ];
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const c of corners) {
    const pu = c.x * cos + c.y * sin;
    const pv = -c.x * sin + c.y * cos;
    if (pu < minU) minU = pu;
    if (pu > maxU) maxU = pu;
    if (pv < minV) minV = pv;
    if (pv > maxV) maxV = pv;
  }
  const centerV = (minV + maxV) / 2;
  const startU = minU - marginU;
  const bigWidth = maxU - startU + marginU;
  const bigHalfH = (maxV - minV) / 2 + marginV;
  const px = startU * cos - centerV * sin;
  const py = startU * sin + centerV * cos;
  return { px, py, ex: px + bigWidth * cos, ey: py + bigWidth * sin, bigWidth, bigHalfH };
}

interface WipeOptions {
  angle: number;
  accent: string;
  start: number;
  dur: number;
  showEdge: boolean;
  edgeWidth: number;
  marginU: number;
  marginV: number;
}

/** Masks `layer` behind a growing wipe, with an optional thin bright edge
 * line tracking the reveal front (same start/duration/ease, so it never
 * drifts off the boundary). */
function addWipe(root: Container, timeline: JimaTimeline, layer: Container, bounds: Bounds, opts: WipeOptions): void {
  const geom = wipeGeometry(bounds, opts.angle, opts.marginU, opts.marginV);
  const mask = new Graphics().rect(0, -geom.bigHalfH, geom.bigWidth, geom.bigHalfH * 2).fill("#FFFFFF");
  mask.position.set(geom.px, geom.py);
  mask.rotation = opts.angle;
  mask.scale.x = 0;
  root.addChild(mask);
  layer.mask = mask;
  timeline.to(mask, { prop: "scale.x", from: 0, to: 1, start: opts.start, duration: opts.dur, ease: outExpo });

  if (opts.showEdge) {
    const edgeHalfH = geom.bigHalfH * 0.86;
    const edge = new Graphics()
      .roundRect(-opts.edgeWidth / 2, -edgeHalfH, opts.edgeWidth, edgeHalfH * 2, opts.edgeWidth / 2)
      .fill(opts.accent);
    edge.rotation = opts.angle;
    edge.position.set(geom.px, geom.py);
    edge.alpha = 0;
    root.addChild(edge);
    timeline
      .to(edge, { prop: "alpha", from: 0, to: 1, start: opts.start, duration: 0.1, ease: outQuad })
      .to(edge, { prop: "x", from: geom.px, to: geom.ex, start: opts.start, duration: opts.dur, ease: outExpo })
      .to(edge, { prop: "y", from: geom.py, to: geom.ey, start: opts.start, duration: opts.dur, ease: outExpo })
      .to(edge, { prop: "alpha", from: 1, to: 0, start: opts.start + opts.dur, duration: 0.3, ease: outQuad });
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Unveiling something new");
  const subline = str(values.subline, "");
  const direction = str(values.direction, "diagonal") === "horizontal" ? "horizontal" : "diagonal";
  const showEdge = on(values.showEdge);
  const angle = direction === "diagonal" ? -13 * DEG : 0;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.14);
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
    lineHeight = Math.round(fontSize * 1.14);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: 3.6 };

  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const topY = Math.min(...boxes.map((b) => b.cy)) - fontSize * 0.7;
  const botY = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.7;

  const headlineLayer = new Container();
  headlineLayer.label = "headline";
  root.addChild(headlineLayer);
  for (const box of boxes) {
    const t = makeText(fonts, { text: box.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    headlineLayer.addChild(t);
  }

  const wipeStart = 0.35;
  const wipeDur = 0.85;
  const edgeWidth = Math.max(3, Math.round(fontSize * 0.06));
  addWipe(
    root,
    timeline,
    headlineLayer,
    { left, right, top: topY, bottom: botY },
    { angle, accent, start: wipeStart, dur: wipeDur, showEdge, edgeWidth, marginU: fontSize * 0.6, marginV: fontSize * 0.14 },
  );

  let end = wipeStart + wipeDur;

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
    const subY = botY + fontSize * 0.55;
    sub.position.set(cx, subY);
    const subLayer = new Container();
    subLayer.label = "subline";
    subLayer.addChild(sub);
    root.addChild(subLayer);

    const subLeft = cx - sub.width / 2 - fontSize * 0.12;
    const subRight = cx + sub.width / 2 + fontSize * 0.12;
    const subTop = subY - sub.height / 2 - fontSize * 0.1;
    const subBottom = subY + sub.height / 2 + fontSize * 0.1;

    const subStart = wipeStart + wipeDur + 0.2;
    const subDur = 0.5;
    const subEdgeWidth = Math.max(2, Math.round(fontSize * 0.04));
    addWipe(
      root,
      timeline,
      subLayer,
      { left: subLeft, right: subRight, top: subTop, bottom: subBottom },
      { angle, accent, start: subStart, dur: subDur, showEdge, edgeWidth: subEdgeWidth, marginU: fontSize * 0.4, marginV: fontSize * 0.08 },
    );
    end = subStart + subDur;
  }

  return { timeline, duration: Math.max(3.6, end + 1.3) };
}

export const maskWipe: TemplateDefinition = {
  id: "mask-wipe",
  name: "Mask Wipe",
  tagline: "A diagonal wipe reveals the headline behind a traveling edge of light.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Unveiling something new", maxLength: 50, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Worth the wait", maxLength: 70, optional: true },
    {
      key: "direction",
      type: "select",
      label: "Wipe direction",
      default: "diagonal",
      options: [
        { value: "diagonal", label: "Diagonal" },
        { value: "horizontal", label: "Horizontal" },
      ],
    },
    { key: "showEdge", type: "toggle", label: "Leading edge", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

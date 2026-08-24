import { Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outQuint,
  outExpo,
  inOutQuad,
  makeOutBack,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Shadow Pop — a retro-print headline. The solid fill pops in first, then
// three hard-edged offset copies (flat color layers, deliberately no blur)
// slide out diagonally behind it like misregistered screen-print passes, and
// the whole stack takes one slow breath before settling. Print-poster energy,
// not a glow and not an echo.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  {
    id: "print-cream",
    name: "Print cream",
    colors: { background: "#FAF3E3", textColor: "#1B1B1F", accent: "#E85D3D", shadow2: "#F2B33D", shadow3: "#3D8F83" },
  },
  {
    id: "poster-white",
    name: "Poster white",
    colors: { background: "#FFFFFF", textColor: "#16161A", accent: "#FF4D1C", shadow2: "#7C5CFF", shadow3: "#FFC53D" },
  },
  {
    id: "mint-soda",
    name: "Mint soda",
    colors: { background: "#E9F7F1", textColor: "#123B2D", accent: "#16A26D", shadow2: "#FFB53C", shadow3: "#E2543E" },
  },
  {
    id: "midnight-neon",
    name: "Midnight neon",
    colors: { background: "#14121C", textColor: "#F5F2E9", accent: "#FF3D8A", shadow2: "#35D0BA", shadow3: "#FFD34D" },
  },
];

interface Layout {
  fontFrac: number; // of canvas width
  maxWidthFrac: number;
  centerFrac: number; // of safe-rect height
}

function layoutOf(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.105, maxWidthFrac: 0.72, centerFrac: 0.46 };
    case "9:16":
      return { fontFrac: 0.128, maxWidthFrac: 0.8, centerFrac: 0.44 };
    case "4:5":
      return { fontFrac: 0.125, maxWidthFrac: 0.78, centerFrac: 0.44 };
    case "1:1":
    default:
      return { fontFrac: 0.122, maxWidthFrac: 0.78, centerFrac: 0.45 };
  }
}

/** Greedy-wrap into <= 2 lines, then shrink so the widest line fits maxWidth. */
function wrapAndFit(
  fonts: FontRegistry,
  text: string,
  size0: number,
  maxWidth: number,
): { joined: string; size: number } {
  const family = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight: 700, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { joined: "", size: size0 };
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
  if (packed.length > 2) packed = [packed[0]!, packed.slice(1).join(" ")];
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(14, Math.floor(size * (maxWidth / widest)));
  }
  return { joined: packed.join("\n"), size };
}

/** A flat four-point retro sparkle, centered at 0,0. */
function sparkle(size: number, color: string): Graphics {
  const r = size / 2;
  const q = r * 0.24;
  return new Graphics()
    .poly([0, -r, q, -q, r, 0, q, q, 0, r, -q, q, -r, 0, -q, -q])
    .fill(color);
}

const POP_AT = 0.3;
const SLIDE_AT = 0.95;
const BREATHE_AT = 2.15;
const BREATHE_FACTOR = 1.24;
const DURATION = 4.3;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FAF3E3"));
  const textColor = str(values.textColor, pc("textColor", "#1B1B1F"));
  const accent = str(values.accent, pc("accent", "#E85D3D"));
  const shadow2 = str(values.shadowColor2, pc("shadow2", "#F2B33D"));
  const shadow3 = str(values.shadowColor3, pc("shadow3", "#3D8F83"));
  const headline = str(values.headline, "Stack it up");
  const subline = typeof values.subline === "string" ? values.subline : "";
  const showSparks = on(values.showSparks);

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const L = layoutOf(ctx.aspect);
  const cx = w / 2;
  const cy = zone.y + zone.height * L.centerFrac;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const { joined, size: fs } = wrapAndFit(fonts, headline, Math.round(w * L.fontFrac), zone.width * L.maxWidthFrac);
  const lineHeight = Math.round(fs * 1.04);
  const timeline = new JimaTimeline();

  const makeCopy = (color: string): Text => {
    const t = makeText(fonts, {
      text: joined,
      role: "display",
      weight: 700,
      size: fs,
      color,
      align: "center",
      anchor: 0.5,
      lineHeight,
    });
    t.position.set(cx, cy);
    return t;
  };

  // Hard offset layers, deepest first so the stack reads farthest -> nearest.
  const unit = fs * 0.115;
  const layers: { node: Text; dx: number; dy: number; start: number }[] = [
    { node: makeCopy(shadow3), dx: unit * 3, dy: unit * 2.76, start: SLIDE_AT + 0.36 },
    { node: makeCopy(shadow2), dx: unit * 2, dy: unit * 1.84, start: SLIDE_AT + 0.18 },
    { node: makeCopy(accent), dx: unit, dy: unit * 0.92, start: SLIDE_AT },
  ];
  for (const layer of layers) {
    layer.node.alpha = 0;
    root.addChild(layer.node);
    timeline
      .to(layer.node, { prop: "alpha", from: 0, to: 1, start: layer.start, duration: 0.12, ease: outQuad })
      .to(layer.node, { prop: "x", from: cx, to: cx + layer.dx, start: layer.start, duration: 0.5, ease: outExpo })
      .to(layer.node, { prop: "y", from: cy, to: cy + layer.dy, start: layer.start, duration: 0.5, ease: outExpo })
      // One slow breath of the offset, then back to the resting stack.
      .to(layer.node, { prop: "x", from: cx + layer.dx, to: cx + layer.dx * BREATHE_FACTOR, start: BREATHE_AT, duration: 0.75, ease: inOutQuad })
      .to(layer.node, { prop: "y", from: cy + layer.dy, to: cy + layer.dy * BREATHE_FACTOR, start: BREATHE_AT, duration: 0.75, ease: inOutQuad })
      .to(layer.node, { prop: "x", from: cx + layer.dx * BREATHE_FACTOR, to: cx + layer.dx, start: BREATHE_AT + 0.75, duration: 0.75, ease: inOutQuad })
      .to(layer.node, { prop: "y", from: cy + layer.dy * BREATHE_FACTOR, to: cy + layer.dy, start: BREATHE_AT + 0.75, duration: 0.75, ease: inOutQuad });
  }

  // The crisp fill on top, popping in first.
  const main = makeCopy(textColor);
  main.alpha = 0;
  root.addChild(main);
  timeline
    .to(main, { prop: "alpha", from: 0, to: 1, start: POP_AT, duration: 0.22, ease: outQuad })
    .to(main, { prop: "scale.x", from: 0.66, to: 1, start: POP_AT, duration: 0.5, ease: makeOutBack(1.9) })
    .to(main, { prop: "scale.y", from: 0.66, to: 1, start: POP_AT, duration: 0.5, ease: makeOutBack(1.9) });

  const blockW = main.width;
  const blockH = main.height;

  // Retro sparkles at opposite corners of the lockup (decorative, toggleable).
  if (showSparks) {
    const sSize = fs * 0.38;
    const clampX = (x: number): number =>
      Math.min(Math.max(x, zone.x + sSize / 2), zone.x + zone.width - sSize / 2);
    const spots = [
      { x: clampX(cx - blockW / 2 - fs * 0.5), y: cy - blockH / 2 - fs * 0.12, start: 1.55 },
      { x: clampX(cx + blockW / 2 + fs * 0.58), y: cy + blockH / 2 - fs * 0.05, start: 1.7 },
    ];
    for (const spot of spots) {
      const sp = sparkle(sSize, accent);
      sp.position.set(spot.x, spot.y);
      sp.alpha = 0;
      sp.scale.set(0);
      root.addChild(sp);
      timeline
        .to(sp, { prop: "alpha", from: 0, to: 1, start: spot.start, duration: 0.18, ease: outQuad })
        .to(sp, { prop: "scale.x", from: 0, to: 1, start: spot.start, duration: 0.45, ease: makeOutBack(2.4) })
        .to(sp, { prop: "scale.y", from: 0, to: 1, start: spot.start, duration: 0.45, ease: makeOutBack(2.4) })
        .to(sp, { prop: "rotation", from: -1.4, to: 0, start: spot.start, duration: 0.5, ease: outCubic })
        // A final twinkle as the stack settles.
        .to(sp, { prop: "scale.x", from: 1, to: 1.18, start: 3.1, duration: 0.28, ease: outQuad })
        .to(sp, { prop: "scale.y", from: 1, to: 1.18, start: 3.1, duration: 0.28, ease: outQuad })
        .to(sp, { prop: "scale.x", from: 1.18, to: 1, start: 3.38, duration: 0.32, ease: outQuad })
        .to(sp, { prop: "scale.y", from: 1.18, to: 1, start: 3.38, duration: 0.32, ease: outQuad });
    }
  }

  // Kicker subline under the stack.
  if (subline.length > 0) {
    const subSize = Math.max(15, Math.round(fs * 0.185));
    const subY = cy + blockH / 2 + unit * 3 + fs * 0.42;
    const sub = makeText(fonts, {
      text: subline.toUpperCase(),
      role: "body",
      weight: 600,
      size: subSize,
      color: textColor,
      anchor: 0.5,
      letterSpacing: Math.max(1, subSize * 0.14),
    });
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.9, start: 2.6, duration: 0.5, ease: outQuad })
      .to(sub, { prop: "y", from: subY + 14, to: subY, start: 2.6, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const shadowPop: TemplateDefinition = {
  id: "shadow-pop",
  name: "Shadow Pop",
  tagline: "A retro-print headline whose flat offset shadows slide out and breathe.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.9,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Stack it up", maxLength: 32, shrinkToFit: true },
    { key: "subline", type: "text", label: "Kicker", default: "Print-shop energy", maxLength: 40, optional: true },
    { key: "showSparks", type: "toggle", label: "Corner sparkles", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Shadow layer 1", default: "", optional: true },
    { key: "shadowColor2", type: "color", label: "Shadow layer 2", default: "", optional: true },
    { key: "shadowColor3", type: "color", label: "Shadow layer 3", default: "", optional: true },
  ],
  build,
};

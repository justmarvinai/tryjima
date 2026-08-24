import { Container, Graphics, BlurFilter, ColorMatrixFilter } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outCubic,
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

// A headline rushes from a heavy Gaussian blur into crisp focus — like a
// camera rack-focus snap — paired with a gentle scale/opacity settle and a
// small "autofocus reticle" that closes in around the block and disappears
// once focus lands. Distinct from `focus-in` (which collapses letter-spacing,
// no blur filter at all): here the whole block is genuinely out-of-focus via
// a real BlurFilter, not a typographic spacing trick.

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
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
      return { fontFrac: 0.09, maxWidthFrac: 0.7, centerYFrac: 0.46, blockHFrac: 0.6 };
    case "9:16":
      return { fontFrac: 0.115, maxWidthFrac: 0.84, centerYFrac: 0.44, blockHFrac: 0.52 };
    case "4:5":
      return { fontFrac: 0.105, maxWidthFrac: 0.82, centerYFrac: 0.45, blockHFrac: 0.58 };
    case "1:1":
    default:
      return { fontFrac: 0.11, maxWidthFrac: 0.82, centerYFrac: 0.46, blockHFrac: 0.58 };
  }
}

const PEAK_BLUR = 18;
const SNAP_START = 0.22;
const SNAP_DUR = 0.62;
const DURATION = 3.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Snap into focus");
  const subline = str(values.subline, "");
  const showUnderline = on(values.showUnderline);
  const showFocusRing = on(values.showFocusRing);

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
  if (boxes.length === 0) return { timeline, duration: DURATION };

  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const topY = Math.min(...boxes.map((b) => b.cy)) - fontSize * 0.7;
  const botY = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.7;
  const blockCx = (left + right) / 2;
  const blockCy = (topY + botY) / 2;

  // --- The headline block: heavy blur -> crisp focus ---
  // Alpha + scale animate on the OUTER `content`; the BlurFilter lives on an
  // INNER wrapper whose own transform never changes (only `strength` animates).
  // A filtered container that ALSO animates its alpha/scale re-renders its
  // filter into a shifting region and is not pixel-exact on re-seek — keeping
  // the filtered node's transform constant (as `photo-develop` does) is what
  // makes the determinism golden pass.
  const content = new Container();
  content.label = "content";
  content.pivot.set(blockCx, blockCy);
  content.position.set(blockCx, blockCy);
  content.alpha = 0;
  content.scale.set(1.06);
  root.addChild(content);

  const blurWrap = new Container();
  blurWrap.label = "blurWrap";
  content.addChild(blurWrap);

  for (const box of boxes) {
    const t = makeText(fonts, { text: box.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    t.position.set(box.cx, box.cy);
    blurWrap.addChild(t);
  }

  const blur = new BlurFilter({ strength: PEAK_BLUR, quality: 4 });
  // Determinism: hold the blur padding constant (sized for the heaviest blur)
  // and drive strength from a pure update(t) that never reaches 0. Auto-padding
  // shrinks as strength drops, so a heavy-blur frame visited during a re-seek
  // would otherwise leave its wide padding region uncleared on the way back to
  // a near-crisp frame. A constant region + a floored strength (the kernel
  // always runs, never the strength-0 passthrough) keeps re-seek pixel-exact.
  // The identity ColorMatrixFilter fully rewrites the pooled intermediate first
  // (mirrors the working `photo-develop` filter chain).
  const maxPad = blur.padding;
  const clear = new ColorMatrixFilter();
  blurWrap.filters = [clear, blur];

  timeline
    .to(content, { prop: "alpha", from: 0, to: 1, start: SNAP_START, duration: SNAP_DUR, ease: outCubic })
    .to(content, { prop: "scale.x", from: 1.06, to: 1, start: SNAP_START, duration: SNAP_DUR, ease: outCubic })
    .to(content, { prop: "scale.y", from: 1.06, to: 1, start: SNAP_START, duration: SNAP_DUR, ease: outCubic });

  // Blur strength runs in update(t) (pure in t) so we can pin padding each frame.
  const focusBlur = (t: number): void => {
    const u = Math.max(0, Math.min(1, (t - SNAP_START) / SNAP_DUR));
    blur.strength = Math.max(0.5, PEAK_BLUR * (1 - outCubic(u)));
    blur.padding = maxPad;
  };

  // --- Autofocus-reticle corner brackets: close in as focus lands, then fade.
  // Kept OUTSIDE `content` (unblurred) — like a camera's own UI overlay, it
  // stays crisp while the subject behind it is still resolving into focus. ---
  if (showFocusRing) {
    const pad = fontSize * 0.38;
    const armLen = fontSize * 0.3;
    const strokeW = Math.max(2, fontSize * 0.045);
    const spread = fontSize * 0.42;
    const corners: { x: number; y: number; rot: number; dx: number; dy: number }[] = [
      { x: left - pad, y: topY - pad, rot: 0, dx: -1, dy: -1 },
      { x: right + pad, y: topY - pad, rot: 90 * DEG, dx: 1, dy: -1 },
      { x: right + pad, y: botY + pad, rot: 180 * DEG, dx: 1, dy: 1 },
      { x: left - pad, y: botY + pad, rot: 270 * DEG, dx: -1, dy: 1 },
    ];
    for (const c of corners) {
      const g = new Graphics()
        .moveTo(0, armLen)
        .lineTo(0, 0)
        .lineTo(armLen, 0)
        .stroke({ color: accent, width: strokeW, cap: "round", join: "round" });
      g.rotation = c.rot;
      const fromX = c.x + c.dx * spread;
      const fromY = c.y + c.dy * spread;
      g.position.set(fromX, fromY);
      g.alpha = 0.85;
      root.addChild(g);
      timeline
        .to(g, { prop: "x", from: fromX, to: c.x, start: SNAP_START, duration: SNAP_DUR, ease: outCubic })
        .to(g, { prop: "y", from: fromY, to: c.y, start: SNAP_START, duration: SNAP_DUR, ease: outCubic })
        .to(g, { prop: "alpha", from: 0.85, to: 0, start: SNAP_START + SNAP_DUR, duration: 0.24, ease: outQuad });
    }
  }

  // --- Accent underline wipes in once focus has landed ---
  const lastLine = lineCount - 1;
  const lastLineBoxes = boxes.filter((b) => b.line === lastLine);
  const ulX0 = Math.min(...lastLineBoxes.map((b) => b.cx - b.width / 2));
  const ulX1 = Math.max(...lastLineBoxes.map((b) => b.cx + b.width / 2));
  const ulY = Math.max(...lastLineBoxes.map((b) => b.cy)) + fontSize * 0.62;
  const underlineStart = SNAP_START + SNAP_DUR + 0.15;
  if (showUnderline) {
    const ulH = Math.max(4, Math.round(fontSize * 0.09));
    const underline = new Graphics().roundRect(0, 0, ulX1 - ulX0, ulH, ulH / 2).fill(accent);
    underline.position.set(ulX0, ulY);
    underline.scale.set(0, 1);
    content.addChild(underline);
    timeline.to(underline, { prop: "scale.x", from: 0, to: 1, start: underlineStart, duration: 0.4, ease: outExpo });
  }

  // --- Optional subline settles in beneath ---
  if (subline.length > 0) {
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: Math.round(fontSize * 0.28),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const subY = ulY + fontSize * 0.55;
    sub.position.set(blockCx, subY);
    sub.alpha = 0;
    content.addChild(sub);
    const subStart = underlineStart + 0.2;
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.85, start: subStart, duration: 0.6, ease: outCubic })
      .to(sub, { prop: "y", from: subY + fontSize * 0.22, to: subY, start: subStart, duration: 0.7, ease: outQuint });
  }

  return { timeline, duration: DURATION, update: focusBlur };
}

export const blurFocus: TemplateDefinition = {
  id: "blur-focus",
  name: "Blur Focus",
  tagline: "A headline rushes from a heavy blur into crisp, camera-sharp focus.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Snap into focus", maxLength: 46, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Clear in an instant", maxLength: 70, optional: true },
    { key: "showUnderline", type: "toggle", label: "Accent underline", default: true },
    { key: "showFocusRing", type: "toggle", label: "Focus ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

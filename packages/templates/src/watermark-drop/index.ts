import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { radialGlowTexture } from "../shared/glow";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Rough perceived luminance of a #rrggbb color (0..1). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

const PALETTES: Palette[] = [
  { id: "paper-light", name: "Paper Light", colors: { background: "#F7F5F0", watermarkColor: "#DAD4C7", imageBack: "#FFFFFF" } },
  { id: "studio-white", name: "Studio White", colors: { background: "#FFFFFF", watermarkColor: "#E1E1E1", imageBack: "#F2F2F2" } },
  { id: "blush-paper", name: "Blush Paper", colors: { background: "#FBF3F1", watermarkColor: "#E8D6D1", imageBack: "#FFFFFF" } },
  { id: "ink-dark", name: "Ink Dark", colors: { background: "#101014", watermarkColor: "#2B2B33", imageBack: "#1C1C22" } },
];

/** A small 4-point sparkle (✦), centered at the origin. */
function sparkle(s: number, color: string, alpha: number): Graphics {
  const o = s * 0.16;
  return new Graphics()
    .poly([0, -s, o, -o, s, 0, o, o, 0, s, -o, o, -s, 0, -o, -o])
    .fill({ color, alpha });
}

/** Square product-card side, sized per aspect (mirrors other product templates). */
function cardSideFor(aspect: Aspect, w: number, h: number): number {
  switch (aspect) {
    case "16:9":
      return h * 0.58;
    case "1:1":
      return w * 0.5;
    case "4:5":
      return w * 0.56;
    case "9:16":
      return w * 0.62;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#F7F5F0"));
  const watermarkColor = str(values.watermarkColor, pcol("watermarkColor", "#DAD4C7"));
  const imageBack = str(values.imageBack, pcol("imageBack", "#FFFFFF"));
  const watermark = str(values.watermark, "your store");
  const showGlyphs = values.showGlyphs !== false;
  const showShadow = values.showShadow !== false;

  const w = size.width;
  const h = size.height;
  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const DUR = 4.4;

  // --- Tiled diagonal brand watermark, built as one rotated group ---
  const tileLayer = new Container();
  tileLayer.label = "watermark";
  tileLayer.position.set(w / 2, h / 2);
  tileLayer.rotation = -26 * DEG;
  root.addChild(tileLayer);

  const minDim = Math.min(w, h);
  const diag = Math.hypot(w, h);
  // The pre-rotation grid must cover at least the canvas diagonal so the
  // rotated group leaves no gaps at the corners, at any aspect.
  const tileExtent = diag * 1.05;
  const baseCellPitch = minDim * 0.58;
  const maxCellPitch = minDim * 1.05;
  // Longer (e.g. German) watermark strings must widen the repeat spacing
  // rather than overlap the next tile — shrink the label first if even a
  // wider pitch can't accommodate it at a legible size.
  let labelSize = Math.round(baseCellPitch * 0.16);
  const measure = (sz: number): number =>
    fonts.measure(watermark, { family: fonts.family("display"), weight: 600, size: sz, letterSpacing: 1 });
  for (let guard = 0; guard < 8; guard++) {
    if (measure(labelSize) * 1.4 <= maxCellPitch || labelSize <= 22) break;
    labelSize = Math.max(22, Math.floor(labelSize * 0.88));
  }
  const cellPitch = Math.max(baseCellPitch, measure(labelSize) * 1.4);
  const rowPitch = cellPitch * 0.66;
  const cols = Math.ceil(tileExtent / cellPitch) + 2;
  const rows = Math.ceil(tileExtent / rowPitch) + 2;
  const originX = -((cols - 1) * cellPitch) / 2;
  const originY = -((rows - 1) * rowPitch) / 2;

  for (let rIdx = 0; rIdx < rows; rIdx++) {
    const rowShift = (rIdx % 2) * (cellPitch / 2);
    const y = originY + rIdx * rowPitch;
    for (let cIdx = 0; cIdx < cols; cIdx++) {
      const x = originX + cIdx * cellPitch + rowShift;
      const label = makeText(fonts, {
        text: watermark,
        role: "display",
        weight: 600,
        size: labelSize,
        color: watermarkColor,
        anchor: 0.5,
        align: "center",
        letterSpacing: 1,
      });
      label.alpha = 0.9;
      label.position.set(x, y);
      tileLayer.addChild(label);
      if (showGlyphs) {
        const g = sparkle(labelSize * 0.34, watermarkColor, 0.75);
        g.position.set(x + cellPitch / 2, y + rowPitch / 2);
        tileLayer.addChild(g);
      }
    }
  }

  tileLayer.alpha = 0;
  tileLayer.scale.set(1.04);
  timeline
    .to(tileLayer, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.5, ease: outQuad })
    .to(tileLayer, { prop: "scale.x", from: 1.04, to: 1, start: 0, duration: 0.6, ease: outQuad })
    .to(tileLayer, { prop: "scale.y", from: 1.04, to: 1, start: 0, duration: 0.6, ease: outQuad });

  // --- Product spotlight ---
  const cx = w / 2;
  const cy = h * 0.47;
  const side = cardSideFor(ctx.aspect, w, h);
  const r = side * 0.1;
  const ENTER_AT = 0.18;

  // Soft contact shadow — a tinted, squashed glow sprite anchored to the
  // "ground"; only its scale/alpha react to the product's bob (never its y).
  const shadowW = side * 1.05;
  const shadowH = side * 0.24;
  const shadowBaseAlpha = 0.34;
  const shadow = new Sprite(radialGlowTexture());
  shadow.anchor.set(0.5);
  shadow.tint = "#000000";
  shadow.width = shadowW;
  shadow.height = shadowH;
  const shadowScaleX = shadow.scale.x;
  const shadowScaleY = shadow.scale.y;
  shadow.alpha = 0;
  shadow.position.set(cx, cy + side / 2 + shadowH * 0.16);
  if (showShadow) {
    root.addChild(shadow);
    timeline.to(shadow, { prop: "alpha", from: 0, to: shadowBaseAlpha, start: ENTER_AT, duration: 0.5, ease: outQuad });
  }

  // floatWrap owns the continuous bob (update only); riser owns the one-time
  // entrance (timeline only) — kept separate so neither ever clobbers the other.
  const floatWrap = new Container();
  floatWrap.position.set(cx, cy);
  root.addChild(floatWrap);

  const riser = new Container();
  const RISE_FROM = side * 0.16;
  riser.alpha = 0;
  riser.scale.set(0.7);
  riser.y = RISE_FROM;
  floatWrap.addChild(riser);

  riser.addChild(new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(imageBack));
  const tex: Texture | null = images.image ?? null;
  if (tex) {
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(side / tex.width, side / tex.height);
    sprite.scale.set(cover);
    const mask = new Graphics().roundRect(-side / 2, -side / 2, side, side, r).fill(0xffffff);
    riser.addChild(sprite, mask);
    sprite.mask = mask;
  } else {
    const isDark = luminance(imageBack) < 0.5;
    const glyphColor = isDark ? "#7A8088" : "#B9BEC6";
    riser.addChild(new Graphics().circle(0, 0, side * 0.34).fill({ color: watermarkColor, alpha: isDark ? 0.35 : 0.6 }));
    riser.addChild(new Graphics().circle(0, 0, side * 0.24).fill({ color: watermarkColor, alpha: isDark ? 0.5 : 0.85 }));
    riser.addChild(makeIcon("cart", side * 0.3, { color: glyphColor }));
  }

  timeline
    .to(riser, { prop: "alpha", from: 0, to: 1, start: ENTER_AT, duration: 0.32, ease: outQuad })
    .to(riser, { prop: "scale.x", from: 0.7, to: 1, start: ENTER_AT, duration: 0.78, ease: spring(0.48) })
    .to(riser, { prop: "scale.y", from: 0.7, to: 1, start: ENTER_AT, duration: 0.78, ease: spring(0.48) })
    .to(riser, { prop: "y", from: RISE_FROM, to: 0, start: ENTER_AT, duration: 0.72, ease: outQuint });

  // --- Continuous: a gentle float, with the shadow answering inversely ---
  const BOB_START = 1.05;
  const BOB_PERIOD = 2.6;
  const bobAmp = side * 0.035;
  const update = (t: number): void => {
    const tau = t - BOB_START;
    if (tau <= 0) {
      floatWrap.y = cy;
      if (showShadow) shadow.scale.set(shadowScaleX, shadowScaleY);
      return;
    }
    const env = Math.min(1, tau / 0.5);
    const n = Math.sin((tau / BOB_PERIOD) * Math.PI * 2) * env;
    floatWrap.y = cy - bobAmp * n;
    if (showShadow) {
      shadow.scale.set(shadowScaleX * (1 - 0.16 * n), shadowScaleY * (1 - 0.16 * n));
      shadow.alpha = shadowBaseAlpha * (1 - 0.3 * n);
    }
  };

  return { timeline, duration: DUR, update };
}

export const watermarkDrop: TemplateDefinition = {
  id: "watermark-drop",
  name: "Watermark Drop",
  tagline: "A product floats above a subtle, rotated brand-watermark tiling.",
  category: "product",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Product image", default: "", optional: true, help: "Fills the card; a clean product photo or transparent PNG works best." },
    { key: "watermark", type: "text", label: "Watermark", default: "your store", maxLength: 20 },
    { key: "showGlyphs", type: "toggle", label: "Sparkle glyphs", default: true },
    { key: "showShadow", type: "toggle", label: "Drop shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "watermarkColor", type: "color", label: "Watermark color", default: "", optional: true },
    { key: "imageBack", type: "color", label: "Image back", default: "", optional: true },
  ],
  build,
};

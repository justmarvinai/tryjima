import { Container, Graphics, Sprite, Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  inOutQuad,
  inOutCubic,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

// A dissolve, not a cut: the second frame is uncovered by a wide soft-edged
// wipe travelling across the frame while both images drift in opposite
// directions. The wipe is a gradient Sprite used as an alpha mask (Pixi routes
// Sprite masks through the alpha-mask pipe, so its edge is genuinely soft);
// once the reveal completes the mask is released so the hold frame is a plain,
// filter-free composite.
const PALETTES: Palette[] = [
  {
    id: "dune",
    name: "Dune",
    colors: {
      background: "#F3ECE1", textColor: "#1F1810", accent: "#A0522A", plate: "#FBF7F1",
      muted: "#A5937D", sweep: "#FFF6E9",
      aSky: "#F0D9B6", aLand: "#D39A5E", aInk: "#A96A34",
      bSky: "#DCE3E6", bLand: "#8CA0A8", bInk: "#546A75",
    },
  },
  {
    id: "harbour",
    name: "Harbour",
    colors: {
      background: "#EAF0F4", textColor: "#0E1B24", accent: "#1E6C8C", plate: "#FAFCFD",
      muted: "#8AA0AD", sweep: "#F2FAFF",
      aSky: "#CFE2EC", aLand: "#7FA9BF", aInk: "#3F6D85",
      bSky: "#E7DED2", bLand: "#BFA88C", bInk: "#8C7358",
    },
  },
  {
    id: "orchard",
    name: "Orchard",
    colors: {
      background: "#F1F4EC", textColor: "#16200F", accent: "#4A7A2E", plate: "#FBFCF8",
      muted: "#93A184", sweep: "#F6FFEC",
      aSky: "#DCE8CC", aLand: "#9CB77C", aInk: "#5E7C40",
      bSky: "#EEDCE2", bLand: "#C79AA6", bInk: "#93596C",
    },
  },
  {
    id: "midnight",
    name: "Midnight",
    colors: {
      background: "#0E1116", textColor: "#EEF2F7", accent: "#7FA8FF", plate: "#191E27",
      muted: "#798394", sweep: "#BFD4FF",
      aSky: "#2A3346", aLand: "#3E4C68", aInk: "#5A6E93",
      bSky: "#3A2B36", bLand: "#5A4150", bInk: "#7C5A6C",
    },
  },
];

interface Cfg {
  /** Caption plate width as a fraction of the safe width. */
  plateWF: number;
  titleF: number;
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { plateWF: 0.46, titleF: 0.052 },
  "1:1": { plateWF: 0.7, titleF: 0.05 },
  "4:5": { plateWF: 0.74, titleF: 0.048 },
  "9:16": { plateWF: 0.98, titleF: 0.046 },
};

// Scene content is drawn 14% larger than the frame so the drift/scale moves
// never expose an edge.
const OVERSCAN = 1.14;

const WIPE_START = 1.05;
const WIPE_DUR = 1.4;
const WIPE_END = WIPE_START + WIPE_DUR; // 2.45
const PLATE_START = 2.3;
const DURATION = 4.6;

/**
 * A one-dimensional soft wipe ramp baked to a texture: fully transparent for the
 * first 15%, a wide feathered ramp, then fully opaque. Alpha stops are
 * sqrt-shaped because Pixi's alpha-mask shader multiplies the mask's red and
 * alpha channels (premultiplied source), which would otherwise square the ramp.
 */
function softWipeTexture(): Texture {
  const tw = 512;
  const th = 8;
  const canvas = document.createElement("canvas");
  canvas.width = tw;
  canvas.height = th;
  const c2d = canvas.getContext("2d");
  if (!c2d) throw new Error("image-morph: 2D context unavailable");
  const grad = c2d.createLinearGradient(0, 0, tw, 0);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.15, "rgba(255,255,255,0)");
  grad.addColorStop(0.22, "rgba(255,255,255,0.34)");
  grad.addColorStop(0.29, "rgba(255,255,255,0.56)");
  grad.addColorStop(0.36, "rgba(255,255,255,0.74)");
  grad.addColorStop(0.43, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.5, "rgba(255,255,255,1)");
  grad.addColorStop(1, "rgba(255,255,255,1)");
  c2d.fillStyle = grad;
  c2d.fillRect(0, 0, tw, th);
  return Texture.from(canvas);
}

/**
 * A soft drop shadow: five progressively larger, offset rounded rects at low
 * alpha. Overlap makes the core dense and the rim feathered — a gradient edge
 * without a resolution-dependent blur filter.
 */
function softShadow(w: number, h: number, r: number, spread: number): Container {
  const c = new Container();
  for (let i = 1; i <= 5; i++) {
    const o = spread * i * 0.36;
    const dy = spread * i * 0.3;
    c.addChild(
      new Graphics()
        .roundRect(-o, -o + dy, w + o * 2, h + o * 2, r + o)
        .fill({ color: "#000000", alpha: 0.036 }),
    );
  }
  return c;
}

/** Cover-fit sprite centered on its own origin. */
function coverSprite(tex: Texture, w: number, h: number): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.scale.set(Math.max(w / tex.width, h / tex.height));
  return s;
}

/** Drawn stand-in "A": a low sun over soft dune bands. */
function sceneA(w: number, h: number, sky: string, land: string, ink: string): Container {
  const c = new Container();
  const g = new Graphics();
  g.rect(-w / 2, -h / 2, w, h).fill(sky);
  g.circle(-w * 0.16, -h * 0.13, Math.min(w, h) * 0.15).fill({ color: ink, alpha: 0.55 });
  g.ellipse(-w * 0.22, h * 0.4, w * 0.72, h * 0.34).fill({ color: land, alpha: 0.9 });
  g.ellipse(w * 0.34, h * 0.5, w * 0.62, h * 0.3).fill(ink);
  g.rect(-w / 2, h * 0.42, w, h * 0.08).fill({ color: ink, alpha: 0.35 });
  c.addChild(g);
  return c;
}

/** Drawn stand-in "B": layered ridges under a high, cool light. */
function sceneB(w: number, h: number, sky: string, land: string, ink: string): Container {
  const c = new Container();
  const g = new Graphics();
  g.rect(-w / 2, -h / 2, w, h).fill(sky);
  g.circle(w * 0.24, -h * 0.24, Math.min(w, h) * 0.09).fill({ color: land, alpha: 0.6 });
  g.poly([-w * 0.6, h * 0.5, -w * 0.14, -h * 0.06, w * 0.18, h * 0.5]).fill({ color: land, alpha: 0.85 });
  g.poly([-w * 0.1, h * 0.5, w * 0.3, h * 0.02, w * 0.62, h * 0.5]).fill(ink);
  g.ellipse(-w * 0.26, h * 0.44, w * 0.55, h * 0.14).fill({ color: land, alpha: 0.55 });
  g.rect(-w / 2, h * 0.36, w, h * 0.14).fill({ color: ink, alpha: 0.16 });
  c.addChild(g);
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3ECE1"));
  const textColor = str(values.textColor, pc("textColor", "#1F1810"));
  const accent = str(values.accent, pc("accent", "#A0522A"));
  const plateColor = pc("plate", "#FBF7F1");
  const muted = pc("muted", "#A5937D");
  const sweepColor = pc("sweep", "#FFF6E9");

  const title = str(values.title, "Two frames, one moment");
  const caption = str(values.caption, "A slow dissolve between takes.");
  const showRule = on(values.showRule);
  const showSweep = on(values.showSweep);
  const showShadow = on(values.showShadow);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cfg = CFG[ctx.aspect];
  const safe = safeRect(ctx.aspect);
  const timeline = new JimaTimeline();

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  // --- Layer A: the outgoing frame (full bleed, drifting outward) ---
  const cw = w * OVERSCAN;
  const ch = h * OVERSCAN;
  const texA = images.imageA ?? null;
  const layerA = new Container();
  layerA.addChild(
    texA ? coverSprite(texA, cw, ch) : sceneA(cw, ch, pc("aSky", "#F0D9B6"), pc("aLand", "#D39A5E"), pc("aInk", "#A96A34")),
  );
  layerA.position.set(w / 2, h / 2);
  root.addChild(layerA);
  timeline
    .to(layerA, { prop: "scale.x", from: 1, to: 1.05, start: 0.1, duration: 2.9, ease: inOutQuad })
    .to(layerA, { prop: "scale.y", from: 1, to: 1.05, start: 0.1, duration: 2.9, ease: inOutQuad })
    .to(layerA, { prop: "x", from: w / 2, to: w / 2 + w * 0.022, start: 0.1, duration: 2.9, ease: inOutQuad })
    .to(layerA, { prop: "alpha", from: 1, to: 0, start: WIPE_END + 0.1, duration: 0.4, ease: inOutQuad });

  // --- Layer B: the incoming frame, uncovered by a travelling soft mask ---
  const texB = images.imageB ?? null;
  const layerB = new Container();
  layerB.addChild(
    texB ? coverSprite(texB, cw, ch) : sceneB(cw, ch, pc("bSky", "#DCE3E6"), pc("bLand", "#8CA0A8"), pc("bInk", "#546A75")),
  );
  layerB.position.set(w / 2 - w * 0.026, h / 2);
  layerB.scale.set(1.07);
  const softLayer = new Container();
  softLayer.addChild(layerB);
  root.addChild(softLayer);
  timeline
    .to(layerB, { prop: "scale.x", from: 1.07, to: 1, start: 0.6, duration: 2.6, ease: inOutCubic })
    .to(layerB, { prop: "scale.y", from: 1.07, to: 1, start: 0.6, duration: 2.6, ease: inOutCubic })
    .to(layerB, { prop: "x", from: w / 2 - w * 0.026, to: w / 2, start: 0.6, duration: 2.6, ease: inOutCubic });

  // The wipe sprite: 2.2 frame-widths wide, ramp centred at 32% of its span.
  const wipeW = w * 2.2;
  const wipeStartX = w - 0.15 * wipeW; // ramp begins exactly at the right edge
  const wipeEndX = -0.52 * wipeW; // opaque region fully past the left edge
  const wipe = new Sprite(softWipeTexture());
  wipe.anchor.set(0, 0.5);
  wipe.width = wipeW;
  wipe.height = h * 1.4;
  wipe.position.set(wipeStartX, h / 2);
  wipe.renderable = false;
  root.addChild(wipe);
  softLayer.mask = wipe;
  timeline
    .set(softLayer, "mask", wipe, 0)
    .to(wipe, { prop: "x", from: wipeStartX, to: wipeEndX, start: WIPE_START, duration: WIPE_DUR, ease: inOutCubic })
    // Released once the frame is fully uncovered: the hold frame is a plain composite.
    .set(softLayer, "mask", null, WIPE_END + 0.15);

  // --- Travelling light on the wipe front ---
  if (showSweep) {
    const sweep = new Sprite(radialGlowTexture());
    sweep.anchor.set(0.5);
    sweep.width = w * 0.42;
    sweep.height = h * 1.7;
    sweep.tint = sweepColor;
    sweep.alpha = 0;
    sweep.position.set(wipeStartX + 0.32 * wipeW, h / 2);
    root.addChild(sweep);
    timeline
      .to(sweep, { prop: "x", from: wipeStartX + 0.32 * wipeW, to: wipeEndX + 0.32 * wipeW, start: WIPE_START, duration: WIPE_DUR, ease: inOutCubic })
      .to(sweep, { prop: "alpha", from: 0, to: 0.42, start: WIPE_START, duration: 0.45, ease: outQuad })
      .to(sweep, { prop: "alpha", from: 0.42, to: 0, start: WIPE_START + 0.95, duration: 0.45, ease: inOutQuad });
  }

  // --- Caption plate (solid, so the type never fights the picture) ---
  const plateW = safe.width * cfg.plateWF;
  const pad = minDim * 0.038;
  const innerW = plateW - pad * 2;
  const ruleH = Math.max(3, Math.round(minDim * 0.005));
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * cfg.titleF), innerW);
  const capSize = fitSize(fonts, caption, "body", 500, Math.round(minDim * 0.024), innerW);

  const ruleBlockH = showRule ? ruleH + minDim * 0.032 : 0;
  const capBlockH = caption.length > 0 ? capSize * 1.25 + minDim * 0.016 : 0;
  const plateH = pad * 2 + ruleBlockH + titleSize * 1.2 + capBlockH;

  const plateX = safe.x;
  const plateY = safe.y + safe.height - plateH;
  const plateR = minDim * 0.022;

  const plate = new Container();
  plate.position.set(plateX, plateY);
  plate.alpha = 0;
  root.addChild(plate);
  if (showShadow) plate.addChild(softShadow(plateW, plateH, plateR, minDim * 0.012));
  plate.addChild(new Graphics().roundRect(0, 0, plateW, plateH, plateR).fill(plateColor));
  timeline
    .to(plate, { prop: "alpha", from: 0, to: 1, start: PLATE_START, duration: 0.5, ease: outQuad })
    .to(plate, { prop: "y", from: plateY + minDim * 0.045, to: plateY, start: PLATE_START, duration: 0.85, ease: outExpo });

  let cursorY = pad;

  // Two-segment progress rule: the first frame is done, the second completes.
  if (showRule) {
    const segGap = innerW * 0.03;
    const segW = (innerW - segGap) / 2;
    plate.addChild(new Graphics().roundRect(pad, cursorY, segW, ruleH, ruleH / 2).fill({ color: muted, alpha: 0.5 }));
    plate.addChild(new Graphics().roundRect(pad, cursorY, segW, ruleH, ruleH / 2).fill(accent));
    plate.addChild(
      new Graphics().roundRect(pad + segW + segGap, cursorY, segW, ruleH, ruleH / 2).fill({ color: muted, alpha: 0.5 }),
    );
    const segTwo = new Graphics().roundRect(0, 0, segW, ruleH, ruleH / 2).fill(accent);
    segTwo.position.set(pad + segW + segGap, cursorY);
    segTwo.scale.x = 0;
    plate.addChild(segTwo);
    timeline.to(segTwo, { prop: "scale.x", from: 0, to: 1, start: PLATE_START + 0.4, duration: 0.7, ease: outExpo });
    cursorY += ruleH + minDim * 0.032;
  }

  const titleY = cursorY + titleSize * 0.6;
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: -titleSize * 0.012,
  });
  titleText.position.set(pad, titleY);
  titleText.alpha = 0;
  plate.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: PLATE_START + 0.15, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + minDim * 0.016, to: titleY, start: PLATE_START + 0.15, duration: 0.7, ease: outQuint });
  cursorY += titleSize * 1.2;

  if (caption.length > 0) {
    const capY = cursorY + minDim * 0.016 + capSize * 0.6;
    const capText = makeText(fonts, {
      text: caption,
      role: "body",
      weight: 500,
      size: capSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    capText.position.set(pad, capY);
    capText.alpha = 0;
    plate.addChild(capText);
    timeline
      .to(capText, { prop: "alpha", from: 0, to: 0.74, start: PLATE_START + 0.3, duration: 0.45, ease: outQuad })
      .to(capText, { prop: "y", from: capY + minDim * 0.012, to: capY, start: PLATE_START + 0.3, duration: 0.65, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const imageMorph: TemplateDefinition = {
  id: "image-morph",
  name: "Image Morph",
  tagline: "One picture dissolves into another behind a soft travelling edge.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.2,
  fontRoles: { title: "display", caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Two frames, one moment", maxLength: 30, shrinkToFit: true },
    { key: "caption", type: "text", label: "Caption", default: "A slow dissolve between takes.", maxLength: 46, shrinkToFit: true, optional: true },
    { key: "imageA", type: "image", label: "First image", default: "", optional: true, help: "A drawn scene stands in when empty." },
    { key: "imageB", type: "image", label: "Second image", default: "", optional: true, help: "The frame the first one dissolves into." },
    { key: "showRule", type: "toggle", label: "Progress rule", default: true },
    { key: "showSweep", type: "toggle", label: "Travelling light", default: true },
    { key: "showShadow", type: "toggle", label: "Plate shadow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

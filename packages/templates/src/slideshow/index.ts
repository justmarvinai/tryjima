import { Container, Graphics, FillGradient } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  inOutQuad,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

function fitSize(fonts: FontRegistry, text: string, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family("display"), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

// A cross-fade slideshow: gradient "photos" fade between each other with a
// caption per slide and dot indicators. Each slide's gradient blends two of the
// palette's four hues.
const PALETTES: Palette[] = [
  { id: "sunset", name: "Sunset", colors: { background: "#12101A", h1: "#FF8A5B", h2: "#FF5FA2", h3: "#7C5CFF", h4: "#FFC15E", accent: "#FFFFFF", muted: "#4A4658" } },
  { id: "ocean", name: "Ocean", colors: { background: "#0A1622", h1: "#2E9BFF", h2: "#41E0C0", h3: "#3B6EF5", h4: "#7C5CFF", accent: "#FFFFFF", muted: "#33465C" } },
  { id: "bloom", name: "Bloom", colors: { background: "#F4F5F8", h1: "#FF6B8A", h2: "#FFA45B", h3: "#12B76A", h4: "#7C5CFF", accent: "#131722", muted: "#C3C7D2" } },
  { id: "mono", name: "Mono", colors: { background: "#0E0E12", h1: "#3A3F52", h2: "#6B7189", h3: "#23283A", h4: "#8E94AC", accent: "#FFFFFF", muted: "#3A3E4C" } },
];

const DEFAULT_CAPS = ["Golden hour", "City lights", "Quiet mornings"];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#12101A"));
  const hues = [pc("h1", "#FF8A5B"), pc("h2", "#FF5FA2"), pc("h3", "#7C5CFF"), pc("h4", "#FFC15E")];
  const accent = str(values.accent, pc("accent", "#FFFFFF"));
  const muted = pc("muted", "#4A4658");

  const captions = asList(values.captions, DEFAULT_CAPS).slice(0, 4);
  const n = Math.max(2, captions.length);
  const showDots = values.showDots !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const cx = w / 2;

  const dotZone = showDots ? minDim * 0.06 : 0;
  const frameW = zone.width * 0.94;
  const frameH = zone.height - dotZone - minDim * 0.02;
  const frameY = zone.y;
  const frameCy = frameY + frameH / 2;
  const frameR = minDim * 0.025;

  // Frame group (pops in).
  const frameG = new Container();
  frameG.position.set(cx, frameCy);
  frameG.alpha = 0;
  frameG.scale.set(0.95);
  root.addChild(frameG);
  timeline
    .to(frameG, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(frameG, { prop: "scale.x", from: 0.95, to: 1, start: 0, duration: 0.55, ease: makeOutBack(1.3) })
    .to(frameG, { prop: "scale.y", from: 0.95, to: 1, start: 0, duration: 0.55, ease: makeOutBack(1.3) });

  frameG.addChild(new Graphics().roundRect(-frameW / 2, -frameH / 2 + frameH * 0.02, frameW, frameH, frameR).fill({ color: "#000000", alpha: 0.22 }));

  const photosWrap = new Container();
  const mask = new Graphics().roundRect(-frameW / 2, -frameH / 2, frameW, frameH, frameR).fill(0xffffff);
  frameG.addChild(photosWrap, mask);
  photosWrap.mask = mask;

  const SLIDE = 1.0;
  const FADE = 0.55;
  const BASE = 0.45;

  // Photos.
  for (let i = 0; i < n; i++) {
    const cA = hues[i % 4]!;
    const cB = hues[(i + 2) % 4]!;
    const photo = new Container();
    photo.alpha = 0;
    photosWrap.addChild(photo);
    const grad = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 1, y: 1 },
      colorStops: [
        { offset: 0, color: cA },
        { offset: 1, color: cB },
      ],
      textureSpace: "local",
    });
    photo.addChild(new Graphics().rect(-frameW / 2, -frameH / 2, frameW, frameH).fill(grad));
    // Soft decorative shapes for depth.
    const shapes = new Container();
    shapes.addChild(new Graphics().circle(frameW * 0.28, -frameH * 0.22, frameW * 0.3).fill({ color: "#FFFFFF", alpha: 0.14 }));
    shapes.addChild(new Graphics().circle(-frameW * 0.3, frameH * 0.28, frameW * 0.22).fill({ color: "#000000", alpha: 0.12 }));
    photo.addChild(shapes);

    const start = BASE + i * SLIDE;
    timeline
      .to(photo, { prop: "alpha", from: 0, to: 1, start, duration: FADE, ease: inOutQuad })
      .to(photo, { prop: "scale.x", from: 1.07, to: 1, start, duration: SLIDE * 1.3, ease: outQuint })
      .to(photo, { prop: "scale.y", from: 1.07, to: 1, start, duration: SLIDE * 1.3, ease: outQuint });
    if (i < n - 1) {
      timeline.to(photo, { prop: "alpha", from: 1, to: 0, start: BASE + (i + 1) * SLIDE, duration: FADE, ease: inOutQuad });
    }
  }

  // Caption scrim (constant) + per-slide caption text.
  const scrimH = frameH * 0.3;
  const scrimGrad = new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: "rgba(0,0,0,0)" },
      { offset: 1, color: "rgba(0,0,0,0.8)" },
    ],
    textureSpace: "local",
  });
  const scrim = new Graphics().rect(-frameW / 2, frameH / 2 - scrimH, frameW, scrimH).fill(scrimGrad);
  scrim.alpha = 0;
  photosWrap.addChild(scrim);
  timeline.to(scrim, { prop: "alpha", from: 0, to: 1, start: BASE + 0.2, duration: 0.5, ease: outQuad });

  captions.forEach((cap, i) => {
    const capSize = fitSize(fonts, cap, 700, Math.round(minDim * 0.045), frameW * 0.84);
    const node = makeText(fonts, { text: cap, role: "display", weight: 700, size: capSize, color: "#FFFFFF", anchor: { x: 0, y: 1 } });
    node.position.set(-frameW / 2 + frameW * 0.06, frameH / 2 - frameH * 0.07);
    node.alpha = 0;
    photosWrap.addChild(node);
    const start = BASE + i * SLIDE;
    timeline
      .to(node, { prop: "alpha", from: 0, to: 1, start, duration: FADE, ease: outQuad })
      .to(node, { prop: "y", from: frameH / 2 - frameH * 0.04, to: frameH / 2 - frameH * 0.07, start, duration: SLIDE * 0.6, ease: outExpo });
    if (i < n - 1) {
      timeline.to(node, { prop: "alpha", from: 1, to: 0, start: BASE + (i + 1) * SLIDE, duration: FADE * 0.7, ease: outQuad });
    }
  });

  // Dot indicators.
  if (showDots) {
    const dotR = minDim * 0.008;
    const gap = dotR * 4;
    const activeW = dotR * 5;
    const totalW = (n - 1) * gap + n * dotR * 2;
    const dotY = frameY + frameH + minDim * 0.035;
    const startX = cx - totalW / 2 + dotR;
    for (let i = 0; i < n; i++) {
      const dx = startX + i * (dotR * 2 + gap);
      root.addChild(new Graphics().circle(dx, dotY, dotR).fill({ color: muted, alpha: 0.9 }));
    }
    // Active pill fades between positions per slide.
    for (let i = 0; i < n; i++) {
      const dx = startX + i * (dotR * 2 + gap);
      const pill = new Graphics().roundRect(dx - activeW / 2, dotY - dotR, activeW, dotR * 2, dotR).fill(accent);
      pill.alpha = 0;
      root.addChild(pill);
      const start = BASE + i * SLIDE;
      timeline.to(pill, { prop: "alpha", from: 0, to: 1, start, duration: FADE, ease: outQuad });
      if (i < n - 1) timeline.to(pill, { prop: "alpha", from: 1, to: 0, start: BASE + (i + 1) * SLIDE, duration: FADE, ease: outQuad });
    }
  }

  const duration = BASE + (n - 1) * SLIDE + FADE + 0.9;
  return { timeline, duration };
}

export const slideshow: TemplateDefinition = {
  id: "slideshow",
  name: "Slideshow",
  tagline: "Gradient photos cross-fade with a caption and dot indicators.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.3,
  fontRoles: { captions: "display" },
  palettes: PALETTES,
  fields: [
    { key: "captions", type: "textlist", label: "Captions (one per slide)", default: DEFAULT_CAPS, minItems: 2, maxItems: 4, maxLength: 28 },
    { key: "showDots", type: "toggle", label: "Dot indicators", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics, Sprite, Text, TextStyle } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

const DEFAULT_POINTS = ["No account needed", "Every aspect ratio", "Export in seconds"];

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", panel: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", muted: "#5B5B68", imageBack: "#F0ECE6" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", panel: "#FFFFFF", textColor: "#241452", accent: "#7C5CFF", muted: "#6B6088", imageBack: "#EFE9FB" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", panel: "#FFFFFF", textColor: "#0F1B2A", accent: "#2E5BD6", muted: "#52607A", imageBack: "#E7EEF7" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#101014", panel: "#16171C", textColor: "#FFFFFF", accent: "#84CC16", muted: "#A7ADB8", imageBack: "#0C0D11" } },
];

function pointList(values: Values): string[] {
  return asItems(values.points, DEFAULT_POINTS).slice(0, 3);
}

function computeDuration(values: Values): number {
  return 1.2 + pointList(values).length * 0.35 + 1.4;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

/** A word-wrapped text block, shrunk so it fits within (maxWidth × maxHeight). */
function makeWrapped(
  fonts: FontRegistry,
  text: string,
  weight: number,
  size: number,
  color: string,
  maxWidth: number,
  maxHeight: number,
): Text {
  const make = (px: number): Text => {
    const style = new TextStyle({
      fontFamily: fonts.family("display"),
      fontSize: px,
      fontWeight: String(weight) as TextStyle["fontWeight"],
      fill: color,
      align: "left",
      wordWrap: true,
      wordWrapWidth: maxWidth,
      lineHeight: Math.round(px * 1.12),
    });
    const t = new Text({ text, style });
    t.anchor.set(0, 0);
    return t;
  };
  let s = size;
  for (let i = 0; i < 8; i++) {
    const t = make(s);
    if (t.height <= maxHeight || s <= 12) return t;
    s = Math.max(12, Math.floor(s * 0.9));
  }
  return make(s);
}

function fillImageHalf(
  holder: Container,
  hw: number,
  hh: number,
  tex: TemplateContext["images"][string],
  accent: string,
): void {
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(hw / tex.width, hh / tex.height);
    s.scale.set(cover);
    s.position.set(hw / 2, hh / 2);
    holder.addChild(s);
  } else {
    holder.addChild(new Graphics().rect(0, 0, hw, hh).fill(accent));
    for (const [bx, by, tint, a] of [
      [0.28, 0.3, "#FFFFFF", 0.5],
      [0.72, 0.72, "#101014", 0.18],
    ] as const) {
      const blob = new Sprite(radialGlowTexture());
      blob.anchor.set(0.5);
      blob.tint = tint;
      blob.width = blob.height = Math.max(hw, hh) * 1.1;
      blob.alpha = a;
      blob.position.set(hw * bx, hh * by);
      holder.addChild(blob);
    }
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const panelColor = pc("panel", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const imageBack = pc("imageBack", "#F0ECE6");
  const kicker = str(values.kicker, "");
  const title = str(values.title, "Built for creators");
  const points = pointList(values);
  const showAccentBar = values.accentBar !== false;
  const showAccentDot = values.accentDot !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const horizontal = ctx.aspect === "9:16" || ctx.aspect === "4:5";
  const timeline = new JimaTimeline();

  // Split geometry: image half + panel half.
  let imgX: number;
  let imgY: number;
  let imgW: number;
  let imgH: number;
  let panX: number;
  let panY: number;
  let panW: number;
  let panH: number;

  if (horizontal) {
    imgH = Math.round(h * (ctx.aspect === "9:16" ? 0.4 : 0.44));
    imgX = 0;
    imgY = 0;
    imgW = w;
    panX = 0;
    panY = imgH;
    panW = w;
    panH = h - imgH;
  } else {
    imgW = Math.round(w * 0.5);
    imgX = 0;
    imgY = 0;
    imgH = h;
    panX = imgW;
    panY = 0;
    panW = w - imgW;
    panH = h;
  }

  // Panel fill (drawn first, under the sliding image seam).
  root.addChild(new Graphics().rect(panX, panY, panW, panH).fill(panelColor));

  // Image half: backing + a sliding, masked image.
  root.addChild(new Graphics().rect(imgX, imgY, imgW, imgH).fill(imageBack));
  const imgMask = new Graphics().rect(imgX, imgY, imgW, imgH).fill(0xffffff);
  const imgSlide = new Container();
  imgSlide.position.set(imgX, imgY);
  const inner = new Container();
  fillImageHalf(inner, imgW, imgH, images.image ?? null, accent);
  imgSlide.addChild(inner);
  root.addChild(imgSlide, imgMask);
  imgSlide.mask = imgMask;
  if (horizontal) {
    timeline.to(imgSlide, { prop: "y", from: imgY - imgH, to: imgY, start: 0.15, duration: 0.75, ease: outExpo });
  } else {
    timeline.to(imgSlide, { prop: "x", from: imgX - imgW, to: imgX, start: 0.15, duration: 0.75, ease: outExpo });
  }

  // Accent seam.
  if (showAccentBar) {
    const seamT = Math.max(4, Math.min(w, h) * 0.006);
    if (horizontal) {
      const seam = new Graphics().rect(0, -seamT / 2, w, seamT).fill(accent);
      seam.scale.set(0, 1);
      seam.pivot.set(w / 2, 0);
      seam.position.set(w / 2, imgH);
      root.addChild(seam);
      timeline.to(seam, { prop: "scale.x", from: 0, to: 1, start: 0.7, duration: 0.5, ease: outExpo });
    } else {
      const seam = new Graphics().rect(-seamT / 2, 0, seamT, h).fill(accent);
      seam.pivot.set(0, h / 2);
      seam.position.set(imgW, h / 2);
      seam.scale.set(1, 0);
      root.addChild(seam);
      timeline.to(seam, { prop: "scale.y", from: 0, to: 1, start: 0.7, duration: 0.5, ease: outExpo });
    }
  }

  // Panel content.
  const botSafe = ctx.aspect === "9:16" ? 400 : Math.round(Math.min(w, h) * 0.06);
  const padX = panW * (horizontal ? 0.08 : 0.11);
  const contentX = panX + padX;
  const contentW = panW - padX * 2;
  const contentTop = panY + (horizontal ? panH * 0.12 : Math.max(panH * 0.16, Math.round(Math.min(w, h) * 0.06)));
  const contentBottom = horizontal ? h - botSafe : h - Math.round(Math.min(w, h) * 0.06);

  let cursorY = contentTop;

  if (kicker.length > 0) {
    const kSize = Math.round(w * (horizontal ? 0.032 : 0.024));
    const kText = fitText(
      fonts,
      { text: kicker.toUpperCase(), role: "body", weight: 700, size: kSize, color: accent, letterSpacing: kSize * 0.14, anchor: { x: 0, y: 0 } },
      contentW,
    );
    kText.position.set(contentX, cursorY);
    kText.alpha = 0;
    root.addChild(kText);
    timeline
      .to(kText, { prop: "alpha", from: 0, to: 1, start: 0.9, duration: 0.4, ease: outQuad })
      .to(kText, { prop: "x", from: contentX - 14, to: contentX, start: 0.9, duration: 0.5, ease: outQuint });
    cursorY += kSize * 1.9;
  }

  const titleSize = Math.round(w * (horizontal ? 0.07 : 0.052));
  const titleText = makeWrapped(fonts, title, 700, titleSize, textColor, contentW, panH * 0.4);
  titleText.position.set(contentX, cursorY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 1.05, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "y", from: cursorY + 18, to: cursorY, start: 1.05, duration: 0.6, ease: outQuint });
  cursorY += titleText.height + (contentBottom - cursorY - titleText.height) * 0.14;

  // Bullet points tick in (accent dot pops, text slides).
  const n = points.length;
  const pointsTop = cursorY + panH * 0.04;
  const rowGap = Math.min((contentBottom - pointsTop) / n, panH * (horizontal ? 0.12 : 0.16));
  const dotR = Math.round(w * (horizontal ? 0.012 : 0.009));
  const pSize = Math.round(w * (horizontal ? 0.038 : 0.028));
  points.forEach((point, i) => {
    const rowY = pointsTop + rowGap * (i + 0.5);
    const start = 1.2 + i * 0.35;
    if (showAccentDot) {
      const dot = new Graphics().circle(0, 0, dotR).fill(accent);
      dot.position.set(contentX + dotR, rowY);
      dot.scale.set(0);
      root.addChild(dot);
      timeline
        .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(2.2) })
        .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(2.2) });
    }
    const pText = fitText(
      fonts,
      { text: point, role: "body", weight: 600, size: pSize, color: textColor, anchor: { x: 0, y: 0.5 } },
      contentW - dotR * 3.4,
    );
    pText.position.set(contentX + dotR * 3.4, rowY);
    pText.alpha = 0;
    root.addChild(pText);
    timeline
      .to(pText, { prop: "alpha", from: 0, to: 1, start: start + 0.05, duration: 0.4, ease: outQuad })
      .to(pText, { prop: "x", from: contentX + dotR * 3.4 - 16, to: contentX + dotR * 3.4, start: start + 0.05, duration: 0.5, ease: outQuint });
  });

  return { timeline, duration: computeDuration(values) };
}

export const splitShowcase: TemplateDefinition = {
  id: "split-showcase",
  name: "Split Showcase",
  tagline: "Image on one side, talking points on the other.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "image", type: "image", label: "Image", default: "", optional: true, help: "Fills one half; cover-fit." },
    { key: "kicker", type: "text", label: "Kicker", default: "SHOWCASE", maxLength: 20, optional: true },
    { key: "title", type: "text", label: "Title", default: "Built for creators", maxLength: 40, shrinkToFit: true },
    { key: "points", type: "textlist", label: "Points", default: DEFAULT_POINTS, minItems: 2, maxItems: 3, maxLength: 30 },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "accentDot", type: "toggle", label: "Accent dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

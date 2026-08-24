import { BlurFilter, ColorMatrixFilter, Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  spring,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const BRIGHT_FROM = 2.6;
const DEVELOP_START = 0.3;
const DEVELOP_DUR = 1.8;
const CAPTION_START = 1.3;

const PALETTES: Palette[] = [
  { id: "warm", name: "Warm", colors: { background: "#F4E9DB", accent: "#FF6A3C", onAccent: "#FFFFFF", textColor: "#3A2E28", card: "#FFFFFF", muted: "#B9A793", placeholder: "#ECE4DA" } },
  { id: "dusk", name: "Dusk", colors: { background: "#F1ECFB", accent: "#6D3BEA", onAccent: "#FFFFFF", textColor: "#241452", card: "#FFFFFF", muted: "#9E96B4", placeholder: "#E8E1F7" } },
  { id: "harbor", name: "Harbor", colors: { background: "#E7EFF6", accent: "#1E6FE0", onAccent: "#FFFFFF", textColor: "#24303A", card: "#FFFFFF", muted: "#A6B4C0", placeholder: "#E2E9F0" } },
  { id: "noir-lime", name: "Noir lime", colors: { background: "#15171C", accent: "#D8F34D", onAccent: "#14160A", textColor: "#F4F1EA", card: "#FFFFFF", muted: "#7D8290", placeholder: "#E7E4DA" } },
];

interface PDCfg {
  cardWF: number;
  cyF: number;
}

// Uniform-mat framed photo (square outer + square photo) verified per-aspect
// with comfortable margin against every safe zone.
const PD: Record<Aspect, PDCfg> = {
  "1:1": { cardWF: 0.58, cyF: 0.47 },
  "4:5": { cardWF: 0.62, cyF: 0.45 },
  "9:16": { cardWF: 0.74, cyF: 0.42 },
  "16:9": { cardWF: 0.34, cyF: 0.48 },
};

/** A small "picture" glyph for the empty-photo placeholder. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
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

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4E9DB"));
  const accent = str(values.accent, pc("accent", "#FF6A3C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#3A2E28"));
  const cardC = pc("card", "#FFFFFF");
  const muted = pc("muted", "#B9A793");
  const placeholderC = pc("placeholder", "#ECE4DA");
  const title = str(values.title, "");
  const caption = str(values.caption, "Some moments are worth the wait");
  const showFrame = values.showFrame !== false;

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const cfg = PD[ctx.aspect];
  const cx = w / 2;
  const cy = h * cfg.cyF;
  const cardW = w * cfg.cardWF;
  const cardH = cardW;
  const border = cardW * 0.05;
  const photoSide = cardW - 2 * border;

  const timeline = new JimaTimeline();

  const frameGroup = new Container();
  frameGroup.position.set(cx, cy);
  frameGroup.alpha = 0;
  frameGroup.scale.set(0.92);
  root.addChild(frameGroup);
  timeline
    .to(frameGroup, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.45, ease: outQuad })
    .to(frameGroup, { prop: "scale.x", from: 0.92, to: 1, start: 0, duration: 0.6, ease: spring(0.55) })
    .to(frameGroup, { prop: "scale.y", from: 0.92, to: 1, start: 0, duration: 0.6, ease: spring(0.55) });

  if (showFrame) {
    frameGroup.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.025, cardW, cardH, cardW * 0.02).fill({ color: 0x000000, alpha: 0.18 }));
    frameGroup.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardW * 0.02).fill(cardC));
  }

  // Photo: filtered (brightness + blur) content, clipped to a rounded square.
  const clip = new Container();
  const photoInner = new Container();
  clip.addChild(photoInner);
  const photoMask = new Graphics().roundRect(-photoSide / 2, -photoSide / 2, photoSide, photoSide, photoSide * 0.03).fill(0xffffff);
  clip.addChild(photoMask);
  clip.mask = photoMask;
  frameGroup.addChild(clip);

  const tex = images.photo ?? null;
  if (tex) {
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    // Slight oversize so the blur samples real content, not a transparent edge.
    sprite.scale.set(Math.max(photoSide / tex.width, photoSide / tex.height) * 1.08);
    sprite.position.set(0, 0);
    photoInner.addChild(sprite);
  } else {
    photoInner.addChild(new Graphics().rect(-photoSide * 0.55, -photoSide * 0.55, photoSide * 1.1, photoSide * 1.1).fill(placeholderC));
    const glyph = imageGlyph(photoSide * 0.3, muted);
    photoInner.addChild(glyph);
  }

  const blurFrom = Math.max(14, Math.round(photoSide * 0.045));
  const blur = new BlurFilter({ strength: blurFrom, quality: 4 });
  const colorMatrix = new ColorMatrixFilter();
  colorMatrix.brightness(BRIGHT_FROM, false);
  photoInner.filters = [colorMatrix, blur];

  timeline.to(blur, { prop: "strength", from: blurFrom, to: 0, start: DEVELOP_START, duration: DEVELOP_DUR, ease: outQuad });

  const update = (t: number): void => {
    const u = clamp01((t - DEVELOP_START) / DEVELOP_DUR);
    const eased = outQuad(u);
    colorMatrix.brightness(BRIGHT_FROM + (1 - BRIGHT_FROM) * eased, false);
  };

  // Caption placard (part of the frame decoration, toggled with it).
  if (showFrame && caption.length > 0) {
    const capH = cardH * 0.095;
    const gap = cardH * 0.045;
    const capSize = Math.round(capH * 0.42);
    const capTextNode = fitText(
      fonts,
      { text: caption, role: "body", weight: 600, size: capSize, color: onAccent, anchor: 0.5, align: "center" },
      cardW * 0.85,
    );
    const pillW = Math.min(cardW * 1.05, capTextNode.width + capH * 1.3);
    const pillY = cardH / 2 + gap + capH / 2;
    const placard = new Container();
    placard.addChild(new Graphics().roundRect(-pillW / 2, -capH / 2, pillW, capH, capH / 2).fill(accent));
    placard.addChild(capTextNode);
    placard.position.set(0, pillY + 14);
    placard.alpha = 0;
    frameGroup.addChild(placard);
    timeline
      .to(placard, { prop: "alpha", from: 0, to: 1, start: CAPTION_START, duration: 0.5, ease: outQuad })
      .to(placard, { prop: "y", from: pillY + 14, to: pillY, start: CAPTION_START, duration: 0.55, ease: outQuint });
  }

  // Title above the frame (independent of the frame toggle).
  if (title.length > 0) {
    const titleSize = Math.round(w * 0.045);
    const frameTop = cy - cardH / 2;
    const titleY = frameTop - titleSize * 1.15;
    const titleText = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.8,
    );
    titleText.position.set(cx, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
      .to(titleText, { prop: "y", from: titleY - 14, to: titleY, start: 0.1, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: 3.6, update };
}

export const photoDevelop: TemplateDefinition = {
  id: "photo-develop",
  name: "Photo Develop",
  tagline: "A framed photo blooms from blown-out and blurry to sharp.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { title: "display", caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "photo", type: "image", label: "Photo", default: "", optional: true },
    { key: "title", type: "text", label: "Title", default: "", maxLength: 28, optional: true, shrinkToFit: true },
    { key: "caption", type: "text", label: "Caption", default: "Some moments are worth the wait", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showFrame", type: "toggle", label: "Frame + caption strip", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

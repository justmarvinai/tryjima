import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", accent: "#FF4D1C", textColor: "#101014", caption: "#5B5B68", tile: "#ECEEF1", muted: "#8A8F98" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", caption: "#6B6088", tile: "#ECE7F7", muted: "#9891B0" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", caption: "#52607A", tile: "#E6ECF4", muted: "#8895A8" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", accent: "#FF6A3C", textColor: "#FFFFFF", caption: "#A7ADB8", tile: "#1B1D22", muted: "#6B7280" } },
];

interface GCfg {
  titleYF: number;
  centerYF: number;
  availWF: number;
  ratio: number;
  capYF: number;
  grid: boolean;
  titleF: number;
}

const GCFG: Record<Aspect, GCfg> = {
  "1:1": { titleYF: 0.12, centerYF: 0.53, availWF: 0.88, ratio: 1.16, capYF: 0.86, grid: false, titleF: 0.058 },
  "4:5": { titleYF: 0.11, centerYF: 0.51, availWF: 0.88, ratio: 1.24, capYF: 0.88, grid: false, titleF: 0.058 },
  "9:16": { titleYF: 0.14, centerYF: 0.49, availWF: 0.86, ratio: 1.0, capYF: 0.77, grid: true, titleF: 0.062 },
  "16:9": { titleYF: 0.13, centerYF: 0.55, availWF: 0.84, ratio: 0.66, capYF: 0.9, grid: false, titleF: 0.048 },
};

interface Rect {
  cx: number;
  cy: number;
  w: number;
  h: number;
  scale: number;
}

function cardRects(size: TemplateContext["size"], cfg: GCfg): Rect[] {
  const cx = size.width / 2;
  const centerY = size.height * cfg.centerYF;
  const availW = size.width * cfg.availWF;
  const rects: Rect[] = [];
  if (cfg.grid) {
    const band = size.height * 0.5;
    const cell = Math.min(availW / 2, band / 2);
    const side = cell * 0.9;
    for (let i = 0; i < 4; i++) {
      const c = i % 2;
      const r = Math.floor(i / 2);
      rects.push({ cx: cx + (c - 0.5) * cell, cy: centerY + (r - 0.5) * cell, w: side, h: side, scale: i === 0 ? 1.08 : 1 });
    }
  } else {
    const pitch = availW / 4;
    const cardW = pitch * 0.84;
    const cardH = cardW * cfg.ratio;
    const x0 = cx - availW / 2 + pitch / 2;
    for (let i = 0; i < 4; i++) {
      rects.push({ cx: x0 + i * pitch, cy: centerY, w: cardW, h: cardH, scale: i === 0 ? 1.12 : 1 });
    }
  }
  return rects;
}

/** A small "picture" glyph (frame + sun + mountains) for empty slots. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

function makeCard(
  tex: Texture | null,
  rect: Rect,
  r: number,
  accent: string,
  muted: string,
  tileC: string,
  borderC: string,
  showFrame: boolean,
): Container {
  const card = new Container();
  const { w, h } = rect;
  // Soft drop shadow.
  card.addChild(new Graphics().roundRect(-w / 2, -h / 2 + h * 0.05, w, h, r).fill({ color: 0x000000, alpha: 0.1 }));
  // Under-fill (shows through transparent PNGs / behind placeholder).
  card.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(tileC));
  if (tex) {
    const holder = new Container();
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(w / tex.width, h / tex.height);
    sprite.scale.set(cover);
    const maskG = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(0xffffff);
    holder.addChild(sprite, maskG);
    sprite.mask = maskG;
    card.addChild(holder);
  } else {
    // Soft accent corner, clipped to the rounded card.
    const blobWrap = new Container();
    const blob = new Graphics().circle(w * 0.32, -h * 0.32, Math.min(w, h) * 0.28).fill({ color: accent, alpha: 0.14 });
    const blobMask = new Graphics().roundRect(-w / 2, -h / 2, w, h, r).fill(0xffffff);
    blobWrap.addChild(blob, blobMask);
    blob.mask = blobMask;
    card.addChild(blobWrap);
    const glyph = imageGlyph(Math.min(w, h) * 0.34, muted);
    glyph.position.set(0, -h * 0.04);
    card.addChild(glyph);
    card.addChild(new Graphics().roundRect(-w * 0.26, h * 0.26, w * 0.52, Math.max(4, h * 0.05), h * 0.025).fill({ color: muted, alpha: 0.5 }));
  }
  // Hairline border.
  if (showFrame) {
    card.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, r).stroke({ color: borderC, width: Math.max(1, w * 0.006), alpha: 0.4 }));
  }
  return card;
}

/** Crisp-fit: re-make one size smaller if it would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
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
  const bg = str(values.background, pc("background", "#FFF4EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const captionColor = pc("caption", "#5B5B68");
  const tileC = pc("tile", "#ECEEF1");
  const muted = pc("muted", "#8A8F98");
  const title = str(values.title, "Our work");
  const caption = str(values.caption, "");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const cfg = GCFG[ctx.aspect];
  const w = size.width;
  const h = size.height;
  const timeline = new JimaTimeline();

  const rects = cardRects(size, cfg);
  const imgs: (Texture | null)[] = [images.image1 ?? null, images.image2 ?? null, images.image3 ?? null, images.image4 ?? null];
  const showFrame = values.frame !== false;

  rects.forEach((rect, i) => {
    const r = Math.min(rect.w, rect.h) * 0.09;
    const card = makeCard(imgs[i] ?? null, rect, r, accent, muted, tileC, textColor, showFrame);
    const off = rect.h * 0.14;
    card.position.set(rect.cx, rect.cy + off);
    card.scale.set(0);
    card.alpha = 0;
    root.addChild(card);
    const start = 0.5 + i * 0.14;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(card, { prop: "y", from: rect.cy + off, to: rect.cy, start, duration: 0.7, ease: spring(0.5) })
      .to(card, { prop: "scale.x", from: 0, to: rect.scale, start, duration: 0.7, ease: spring(0.5) })
      .to(card, { prop: "scale.y", from: 0, to: rect.scale, start, duration: 0.7, ease: spring(0.5) });
  });

  // Title on top.
  const titleSize = Math.round(w * cfg.titleF);
  const titleY = h * cfg.titleYF;
  const titleText = fitText(
    fonts,
    { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
    w * 0.86,
  );
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 18, to: titleY, start: 0.1, duration: 0.6, ease: outExpo });

  // Optional caption below the strip.
  if (caption.length > 0) {
    const capSize = Math.round(w * cfg.titleF * 0.56);
    const capY = h * cfg.capYF;
    const capText = fitText(
      fonts,
      { text: caption, role: "body", weight: 500, size: capSize, color: captionColor, anchor: 0.5, align: "center" },
      w * 0.8,
    );
    capText.position.set(w / 2, capY);
    capText.alpha = 0;
    root.addChild(capText);
    timeline.to(capText, { prop: "alpha", from: 0, to: 1, start: 1.9, duration: 0.5, ease: outQuad });
  }

  return { timeline, duration: 4.2 };
}

export const galleryStrip: TemplateDefinition = {
  id: "gallery-strip",
  name: "Gallery Strip",
  tagline: "A set of photos cascades into a tidy gallery.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.8,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Our work", maxLength: 36, shrinkToFit: true },
    { key: "image1", type: "image", label: "Image 1", default: "", optional: true },
    { key: "image2", type: "image", label: "Image 2", default: "", optional: true },
    { key: "image3", type: "image", label: "Image 3", default: "", optional: true },
    { key: "image4", type: "image", label: "Image 4", default: "", optional: true },
    { key: "caption", type: "text", label: "Caption", default: "", maxLength: 40, optional: true },
    { key: "frame", type: "toggle", label: "Frame", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  safeZone,
  outQuad,
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
  { id: "ember", name: "Ember", colors: { background: "#FFF4EE", accent: "#FF4D1C", textColor: "#101014", tile: "#ECE8E3", muted: "#9A8F86", chip: "#17131B", chipText: "#FFFFFF" } },
  { id: "lime", name: "Lime", colors: { background: "#F3FAE3", accent: "#5F9E12", textColor: "#16230A", tile: "#E7EFDA", muted: "#869178", chip: "#14210B", chipText: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", accent: "#7C5CFF", textColor: "#241452", tile: "#E8E1F7", muted: "#9E96B4", chip: "#1B1140", chipText: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", accent: "#FF6A3C", textColor: "#FFFFFF", tile: "#1E2027", muted: "#6B7280", chip: "#FF6A3C", chipText: "#101014" } },
];

interface GridCfg {
  cols: number;
  rows: number;
}

const GRID: Record<Aspect, GridCfg> = {
  "1:1": { cols: 2, rows: 2 },
  "4:5": { cols: 2, rows: 2 },
  "9:16": { cols: 2, rows: 3 },
  "16:9": { cols: 3, rows: 2 },
};

/** A small "picture" glyph (frame + sun + mountains) for empty slots. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
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

/** A rounded image tile (cover-fit + masked) or a designed placeholder. */
function makeTile(
  tex: Texture | null,
  cw: number,
  ch: number,
  r: number,
  accent: string,
  tileC: string,
  muted: string,
  borderC: string,
): Container {
  const card = new Container();
  card.addChild(new Graphics().roundRect(-cw / 2, -ch / 2 + ch * 0.05, cw, ch, r).fill({ color: 0x000000, alpha: 0.1 }));
  card.addChild(new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, r).fill(tileC));
  if (tex) {
    const holder = new Container();
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(cw / tex.width, ch / tex.height);
    sprite.scale.set(cover);
    const maskG = new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, r).fill(0xffffff);
    holder.addChild(sprite, maskG);
    sprite.mask = maskG;
    card.addChild(holder);
  } else {
    const blobWrap = new Container();
    const blob = new Graphics().circle(cw * 0.3, -ch * 0.3, Math.min(cw, ch) * 0.34).fill({ color: accent, alpha: 0.16 });
    const blobMask = new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, r).fill(0xffffff);
    blobWrap.addChild(blob, blobMask);
    blob.mask = blobMask;
    card.addChild(blobWrap);
    const glyph = imageGlyph(Math.min(cw, ch) * 0.3, muted);
    card.addChild(glyph);
  }
  card.addChild(new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, r).stroke({ color: borderC, width: Math.max(1, cw * 0.005), alpha: 0.32 }));
  return card;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF4EE"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const tileC = pc("tile", "#ECE8E3");
  const muted = pc("muted", "#9A8F86");
  const chipC = pc("chip", "#17131B");
  const chipTextC = pc("chipText", "#FFFFFF");
  const title = str(values.title, "Our work");
  const showAccentDot = values.accentDot !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const cfg = GRID[ctx.aspect];
  const zone = safeZone(ctx.aspect);
  const cx0 = zone.left;
  const cy0 = zone.top;
  const cW = w - zone.left - zone.right;
  const cH = h - zone.top - zone.bottom;
  const timeline = new JimaTimeline();

  const gap = Math.min(w, h) * 0.022;
  const cols = cfg.cols;
  const rows = cfg.rows;
  const cellW = (cW - (cols - 1) * gap) / cols;
  const cellH = (cH - (rows - 1) * gap) / rows;
  const r = Math.min(cellW, cellH) * 0.06;
  const allImgs: (Texture | null)[] = [
    images.image1 ?? null,
    images.image2 ?? null,
    images.image3 ?? null,
    images.image4 ?? null,
    images.image5 ?? null,
    images.image6 ?? null,
  ];
  const count = cols * rows;

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = cx0 + col * (cellW + gap) + cellW / 2;
    const cy = cy0 + row * (cellH + gap) + cellH / 2;
    const tile = makeTile(allImgs[i] ?? null, cellW, cellH, r, accent, tileC, muted, textColor);
    const rise = cellH * 0.06;
    tile.position.set(cx, cy + rise);
    tile.scale.set(0);
    tile.alpha = 0;
    root.addChild(tile);
    const start = 0.45 + (row + col) * 0.12;
    timeline
      .to(tile, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(tile, { prop: "y", from: cy + rise, to: cy, start, duration: 0.7, ease: spring(0.5) })
      .to(tile, { prop: "scale.x", from: 0, to: 1, start, duration: 0.7, ease: spring(0.5) })
      .to(tile, { prop: "scale.y", from: 0, to: 1, start, duration: 0.7, ease: spring(0.5) });
  }

  // Optional title overlay chip near the bottom of the mosaic.
  if (title.length > 0) {
    const chipFont = Math.round(w * (ctx.aspect === "16:9" ? 0.036 : 0.044));
    const label = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: chipFont, color: chipTextC, anchor: { x: 0, y: 0.5 } },
      cW * 0.68,
    );
    const dotR = chipFont * 0.28;
    const padX = chipFont * 0.9;
    const gapDot = showAccentDot ? chipFont * 0.5 : 0;
    const innerW = (showAccentDot ? dotR * 2 : 0) + gapDot + label.width;
    const pillW = innerW + padX * 2;
    const pillH = chipFont * 1.95;
    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2 + pillH * 0.08, pillW, pillH, pillH / 2).fill({ color: 0x000000, alpha: 0.16 }));
    chip.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(chipC));
    if (showAccentDot) {
      chip.addChild(new Graphics().circle(-innerW / 2 + dotR, 0, dotR).fill(accent));
    }
    label.position.set(showAccentDot ? -innerW / 2 + dotR * 2 + gapDot : -innerW / 2, 0);
    chip.addChild(label);
    const chipCy = cy0 + cH - pillH * 0.7;
    chip.position.set(w / 2, chipCy);
    chip.scale.set(0);
    chip.alpha = 0;
    root.addChild(chip);
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start: 1.8, duration: 0.4, ease: outQuad })
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: 1.8, duration: 0.6, ease: spring(0.5) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: 1.8, duration: 0.6, ease: spring(0.5) });
  }

  return { timeline, duration: 4.0 };
}

export const photoGrid: TemplateDefinition = {
  id: "photo-grid",
  name: "Photo Grid",
  tagline: "A mosaic of photos pops into a tidy grid.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Our work", maxLength: 32, optional: true, shrinkToFit: true },
    { key: "image1", type: "image", label: "Image 1", default: "", optional: true },
    { key: "image2", type: "image", label: "Image 2", default: "", optional: true },
    { key: "image3", type: "image", label: "Image 3", default: "", optional: true },
    { key: "image4", type: "image", label: "Image 4", default: "", optional: true },
    { key: "image5", type: "image", label: "Image 5", default: "", optional: true, help: "Shown on wide (16:9) and tall (9:16) layouts." },
    { key: "image6", type: "image", label: "Image 6", default: "", optional: true, help: "Shown on wide (16:9) and tall (9:16) layouts." },
    { key: "accentDot", type: "toggle", label: "Accent dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

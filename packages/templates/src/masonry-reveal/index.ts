import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  safeRect,
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

const PALETTES: Palette[] = [
  { id: "sunwash", name: "Sunwash", colors: { background: "#FFF6EC", textColor: "#231A12", accent: "#FF7A3D", tile: "#F1E4D8", muted: "#B79C86", chip: "#1D140D", chipText: "#FFFFFF" } },
  { id: "seafoam", name: "Seafoam", colors: { background: "#EAFBF3", textColor: "#0B3B2E", accent: "#12B76A", tile: "#DCF3E9", muted: "#7FA995", chip: "#0B2E24", chipText: "#FFFFFF" } },
  { id: "orchid", name: "Orchid", colors: { background: "#F6EEFC", textColor: "#3B1259", accent: "#9D4EDD", tile: "#EBDFF7", muted: "#A78BC0", chip: "#2C0D45", chipText: "#FFFFFF" } },
  { id: "charcoal", name: "Charcoal", colors: { background: "#121214", textColor: "#F5F3EE", accent: "#FFD23F", tile: "#1E1F24", muted: "#6B6E76", chip: "#000000", chipText: "#FFFFFF" } },
];

interface MCfg {
  cols: number;
  rowFracs: number[][];
}

// Fixed masonry patterns (per column) — hand-tuned mixed-height ratios that
// each sum to 1.0 per column, so every column reaches the same total height.
const MASONRY: Record<Aspect, MCfg> = {
  "1:1": { cols: 2, rowFracs: [[0.36, 0.26, 0.38], [0.27, 0.4, 0.33]] },
  "4:5": { cols: 2, rowFracs: [[0.36, 0.26, 0.38], [0.27, 0.4, 0.33]] },
  "9:16": { cols: 2, rowFracs: [[0.36, 0.26, 0.38], [0.27, 0.4, 0.33]] },
  "16:9": { cols: 3, rowFracs: [[0.56, 0.44], [0.4, 0.6], [0.47, 0.53]] },
};

/** A small "picture" glyph (frame + sun + mountains) for an empty tile. */
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

/** One masonry tile: an image (cover-fit + masked) or a designed placeholder. */
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
  card.addChild(new Graphics().roundRect(-cw / 2, -ch / 2 + ch * 0.05, cw, ch, r).fill({ color: 0x000000, alpha: 0.12 }));
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
    const blob = new Graphics().circle(cw * 0.3, -ch * 0.3, Math.min(cw, ch) * 0.36).fill({ color: accent, alpha: 0.18 });
    const blobMask = new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, r).fill(0xffffff);
    blobWrap.addChild(blob, blobMask);
    blob.mask = blobMask;
    card.addChild(blobWrap);
    card.addChild(imageGlyph(Math.min(cw, ch) * 0.32, muted));
  }
  card.addChild(new Graphics().roundRect(-cw / 2, -ch / 2, cw, ch, r).stroke({ color: borderC, width: Math.max(1, cw * 0.006), alpha: 0.14 }));
  return card;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF6EC"));
  const textColor = str(values.textColor, pc("textColor", "#231A12"));
  const accent = str(values.accent, pc("accent", "#FF7A3D"));
  const tileC = pc("tile", "#F1E4D8");
  const muted = pc("muted", "#B79C86");
  const chipC = pc("chip", "#1D140D");
  const chipTextC = pc("chipText", "#FFFFFF");
  const caption = str(values.caption, "");
  const showCaption = values.showCaption !== false;
  const wantCaption = showCaption && caption.length > 0;

  const w = size.width;
  const h = size.height;
  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const safe = safeRect(ctx.aspect);
  const cfg = MASONRY[ctx.aspect];
  const capBandH = wantCaption ? Math.min(w, h) * 0.12 : 0;
  const gridH = safe.height - capBandH;
  const gap = Math.min(safe.width, gridH) * 0.026;
  const cols = cfg.cols;
  const colW = (safe.width - (cols - 1) * gap) / cols;
  const r = colW * 0.05;
  const timeline = new JimaTimeline();

  const allImgs: (Texture | null)[] = [
    images.image1 ?? null,
    images.image2 ?? null,
    images.image3 ?? null,
    images.image4 ?? null,
    images.image5 ?? null,
    images.image6 ?? null,
  ];

  let idx = 0;
  for (let c = 0; c < cols; c++) {
    const rowFracs = cfg.rowFracs[c]!;
    const rows = rowFracs.length;
    const totalGap = (rows - 1) * gap;
    const usableH = gridH - totalGap;
    const colX = safe.x + c * (colW + gap) + colW / 2;
    let cursor = safe.y;
    for (let rIdx = 0; rIdx < rows; rIdx++) {
      const cellH = usableH * rowFracs[rIdx]!;
      const cellY = cursor + cellH / 2;
      cursor += cellH + gap;

      const tile = makeTile(allImgs[idx] ?? null, colW, cellH, r, accent, tileC, muted, textColor);
      const rise = cellH * 0.08;
      tile.position.set(colX, cellY + rise);
      tile.scale.set(0);
      tile.alpha = 0;
      root.addChild(tile);
      const start = 0.3 + idx * 0.13;
      timeline
        .to(tile, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
        .to(tile, { prop: "y", from: cellY + rise, to: cellY, start, duration: 0.65, ease: spring(0.5) })
        .to(tile, { prop: "scale.x", from: 0, to: 1, start, duration: 0.65, ease: spring(0.5) })
        .to(tile, { prop: "scale.y", from: 0, to: 1, start, duration: 0.65, ease: spring(0.5) });
      idx++;
    }
  }

  if (wantCaption) {
    const barH = capBandH * 0.84;
    const barW = safe.width;
    const barCy = safe.y + gridH + capBandH / 2;
    const dotR = barH * 0.14;
    const padX = barH * 0.42;
    const capSize = Math.round(barH * 0.4);
    const capText = fitText(
      fonts,
      { text: caption, role: "display", weight: 700, size: capSize, color: chipTextC, anchor: { x: 0, y: 0.5 } },
      barW - padX * 2 - dotR * 3,
    );
    const bar = new Container();
    bar.addChild(new Graphics().roundRect(-barW / 2, -barH / 2 + barH * 0.08, barW, barH, barH * 0.22).fill({ color: 0x000000, alpha: 0.12 }));
    bar.addChild(new Graphics().roundRect(-barW / 2, -barH / 2, barW, barH, barH * 0.22).fill(chipC));
    bar.addChild(new Graphics().circle(-barW / 2 + padX + dotR, 0, dotR).fill(accent));
    capText.position.set(-barW / 2 + padX + dotR * 2 + barH * 0.16, 0);
    bar.addChild(capText);
    bar.position.set(safe.x + safe.width / 2, barCy);
    bar.alpha = 0;
    root.addChild(bar);
    const lastStart = 0.3 + (idx - 1) * 0.13;
    const barStart = lastStart + 0.55;
    timeline
      .to(bar, { prop: "alpha", from: 0, to: 1, start: barStart, duration: 0.4, ease: outQuad })
      .to(bar, { prop: "y", from: barCy + 18, to: barCy, start: barStart, duration: 0.5, ease: outQuint });
  }

  return { timeline, duration: 3.2 };
}

export const masonryReveal: TemplateDefinition = {
  id: "masonry-reveal",
  name: "Masonry Reveal",
  tagline: "A Pinterest-style grid pops in tile by tile.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.3,
  fontRoles: { caption: "display" },
  palettes: PALETTES,
  fields: [
    { key: "image1", type: "image", label: "Photo 1", default: "", optional: true },
    { key: "image2", type: "image", label: "Photo 2", default: "", optional: true },
    { key: "image3", type: "image", label: "Photo 3", default: "", optional: true },
    { key: "image4", type: "image", label: "Photo 4", default: "", optional: true },
    { key: "image5", type: "image", label: "Photo 5", default: "", optional: true },
    { key: "image6", type: "image", label: "Photo 6", default: "", optional: true },
    { key: "caption", type: "text", label: "Caption", default: "Fresh finds", maxLength: 34, optional: true, shrinkToFit: true },
    { key: "showCaption", type: "toggle", label: "Caption bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  safeZone,
  outQuad,
  outQuint,
  outExpo,
  spring,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { verticalScrimTexture } from "../shared/scrim";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const lerp = (a: number, b: number, u: number): number => a + (b - a) * u;

// textColor defaults to white in every palette: the caption always sits on a
// dark scrim over the (now full-frame) hero photo, never on `background`.
const PALETTES: Palette[] = [
  { id: "sunset", name: "Sunset", colors: { background: "#F4E9DB", accent: "#FF6A3C", textColor: "#FFFFFF", tile: "#ECE2D3", muted: "#B9A793" } },
  { id: "rosewood", name: "Rosewood", colors: { background: "#F6E7EC", accent: "#E85B7A", textColor: "#FFFFFF", tile: "#EFE1E6", muted: "#C7A9B2" } },
  { id: "harbor", name: "Harbor", colors: { background: "#E7EFF6", accent: "#2E7DF6", textColor: "#FFFFFF", tile: "#E2E9F0", muted: "#A6B4C0" } },
  { id: "noir", name: "Noir", colors: { background: "#16151A", accent: "#D8F34D", textColor: "#FFFFFF", tile: "#232229", muted: "#8A8690" } },
];

interface GridCfg {
  cols: number;
  rows: number;
}

const GRID: Record<Aspect, GridCfg> = {
  "1:1": { cols: 3, rows: 2 },
  "4:5": { cols: 3, rows: 2 },
  "9:16": { cols: 2, rows: 3 },
  "16:9": { cols: 3, rows: 2 },
};

/** A small "picture" glyph for empty tiles. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.055 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

/** A sharp-edged (contact-sheet style) tile: cover-fit photo, or a flat placeholder + glyph. */
function makeTile(tex: Texture | null, cw: number, ch: number, tileC: string, muted: string): Container {
  const card = new Container();
  const holder = new Container();
  const mask = new Graphics().rect(-cw / 2, -ch / 2, cw, ch).fill(0xffffff);
  if (tex) {
    const sprite = new Sprite(tex);
    sprite.anchor.set(0.5);
    const cover = Math.max(cw / tex.width, ch / tex.height);
    sprite.scale.set(cover);
    holder.addChild(sprite);
  } else {
    holder.addChild(new Graphics().rect(-cw / 2, -ch / 2, cw, ch).fill(tileC));
    const glyph = imageGlyph(Math.min(cw, ch) * 0.28, muted);
    holder.addChild(glyph);
  }
  card.addChild(holder, mask);
  holder.mask = mask;
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
  const bg = str(values.background, pc("background", "#F4E9DB"));
  const accent = str(values.accent, pc("accent", "#FF6A3C"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const tileC = pc("tile", "#ECE2D3");
  const muted = pc("muted", "#B9A793");
  const caption = str(values.caption, "Our favorite shot");
  const showCaption = values.showCaption !== false;
  const showAccentBar = values.accentBar !== false;

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const cfg = GRID[ctx.aspect];
  const zone = safeZone(ctx.aspect);
  const gridLeft = zone.left;
  const gridTop = zone.top;
  const gridW = w - zone.left - zone.right;
  const gridH = h - zone.top - zone.bottom;
  const gap = Math.min(w, h) * 0.012;
  const cols = cfg.cols;
  const rows = cfg.rows;
  const cellW = (gridW - (cols - 1) * gap) / cols;
  const cellH = (gridH - (rows - 1) * gap) / rows;
  const count = cols * rows; // always 6

  const timeline = new JimaTimeline();
  const images6: (Texture | null)[] = [
    images.image1 ?? null,
    images.image2 ?? null,
    images.image3 ?? null,
    images.image4 ?? null,
    images.image5 ?? null,
    images.image6 ?? null,
  ];

  const ENTRANCE_START = 0.05;
  const STAGGER = 0.08;
  const ZOOM_START = 1.5;
  const ZOOM_DUR = 0.8;

  // heroIndex 0 (top-left, "Image 1") is drawn as its own top layer so it can
  // zoom to fill the frame; the grid loop below skips that slot.
  const heroCell = { cx: gridLeft + cellW / 2, cy: gridTop + cellH / 2, w: cellW, h: cellH };
  const heroFull = { cx: w / 2, cy: h / 2, w, h };

  for (let i = 1; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = gridLeft + col * (cellW + gap) + cellW / 2;
    const cy = gridTop + row * (cellH + gap) + cellH / 2;
    const tile = makeTile(images6[i] ?? null, cellW, cellH, tileC, muted);
    tile.position.set(cx, cy);
    tile.scale.set(0.85);
    tile.alpha = 0;
    root.addChild(tile);

    const start = ENTRANCE_START + i * STAGGER;
    timeline
      .to(tile, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(tile, { prop: "scale.x", from: 0.85, to: 1, start, duration: 0.5, ease: spring(0.5) })
      .to(tile, { prop: "scale.y", from: 0.85, to: 1, start, duration: 0.5, ease: spring(0.5) });

    // Recede as the hero takes over the frame.
    const fadeDur = ZOOM_DUR * 0.6;
    timeline
      .to(tile, { prop: "alpha", from: 1, to: 0, start: ZOOM_START, duration: fadeDur, ease: outQuad })
      .to(tile, { prop: "scale.x", from: 1, to: 0.92, start: ZOOM_START, duration: fadeDur, ease: outQuad })
      .to(tile, { prop: "scale.y", from: 1, to: 0.92, start: ZOOM_START, duration: fadeDur, ease: outQuad });
  }

  // --- Hero tile: its own top layer, geometry driven by update() so it can
  // grow from its grid cell to the full frame without distorting the photo. ---
  const heroMask = new Graphics().rect(-0.5, -0.5, 1, 1).fill(0xffffff);
  const heroContent = new Container();
  heroContent.alpha = 0;
  heroContent.mask = heroMask;

  const heroTex = images.image1 ?? null;
  let heroSprite: Sprite | null = null;
  let heroPhBg: Graphics | null = null;
  let heroGlyph: Graphics | null = null;
  if (heroTex) {
    heroSprite = new Sprite(heroTex);
    heroSprite.anchor.set(0.5);
    heroContent.addChild(heroSprite);
  } else {
    heroPhBg = new Graphics().rect(-0.5, -0.5, 1, 1).fill(tileC);
    heroContent.addChild(heroPhBg);
    heroGlyph = imageGlyph(Math.min(cellW, cellH) * 0.28, muted);
    heroContent.addChild(heroGlyph);
  }
  root.addChild(heroContent, heroMask);

  const HERO_START = ENTRANCE_START;
  const HERO_POP_DUR = 0.5;
  timeline.to(heroContent, { prop: "alpha", from: 0, to: 1, start: HERO_START, duration: 0.4, ease: outQuad });

  // --- Caption (fades in over a bottom scrim once the zoom lands) ---
  const CAPTION_START = ZOOM_START + ZOOM_DUR + 0.2;
  if (showCaption && caption.length > 0) {
    const scrimH = h * 0.34;
    const scrim = new Sprite(verticalScrimTexture());
    scrim.tint = "#08080B";
    scrim.width = w;
    scrim.height = scrimH;
    scrim.position.set(0, h - scrimH);
    scrim.alpha = 0;
    root.addChild(scrim);

    const botSafe = ctx.aspect === "9:16" ? 400 : Math.round(Math.min(w, h) * 0.06);
    const capSize = Math.round(w * (ctx.aspect === "16:9" ? 0.038 : 0.048));
    const capY = h - botSafe - capSize * 0.7;
    const capText = fitText(
      fonts,
      { text: caption, role: "display", weight: 700, size: capSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.82,
    );
    capText.position.set(w / 2, capY);
    capText.alpha = 0;
    root.addChild(capText);

    timeline
      .to(scrim, { prop: "alpha", from: 0, to: 0.82, start: CAPTION_START, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "alpha", from: 0, to: 1, start: CAPTION_START + 0.1, duration: 0.5, ease: outQuad })
      .to(capText, { prop: "y", from: capY + 16, to: capY, start: CAPTION_START + 0.1, duration: 0.55, ease: outQuint });

    if (showAccentBar) {
      const barW = capSize * 1.5;
      const barH = Math.max(3, capSize * 0.09);
      const bar = new Graphics().roundRect(0, 0, barW, barH, barH / 2).fill(accent);
      bar.position.set(w / 2 - barW / 2, capY - capSize * 1.15);
      bar.scale.set(0, 1);
      root.addChild(bar);
      timeline.to(bar, { prop: "scale.x", from: 0, to: 1, start: CAPTION_START + 0.35, duration: 0.4, ease: outExpo });
    }
  }

  // Pure-in-t geometry: cell → full-frame, eased, plus a brief entrance "pop"
  // that only affects the pre-zoom hold (pop reaches 1 long before ZOOM_START).
  const popEase = makeOutBack(1.5);
  const update = (t: number): void => {
    const zoomU = clamp01((t - ZOOM_START) / ZOOM_DUR);
    const e = t <= ZOOM_START ? 0 : t >= ZOOM_START + ZOOM_DUR ? 1 : outQuint(zoomU);
    const ccx = lerp(heroCell.cx, heroFull.cx, e);
    const ccy = lerp(heroCell.cy, heroFull.cy, e);
    let cw = lerp(heroCell.w, heroFull.w, e);
    let ch = lerp(heroCell.h, heroFull.h, e);

    const popU = clamp01((t - HERO_START) / HERO_POP_DUR);
    const pop = t <= HERO_START ? 0.85 : t >= HERO_START + HERO_POP_DUR ? 1 : 0.85 + 0.15 * popEase(popU);
    cw *= pop;
    ch *= pop;

    heroMask.position.set(ccx, ccy);
    heroMask.scale.set(cw, ch);
    if (heroSprite && heroTex) {
      const cover = Math.max(cw / heroTex.width, ch / heroTex.height);
      heroSprite.scale.set(cover);
      heroSprite.position.set(ccx, ccy);
    } else if (heroPhBg) {
      heroPhBg.position.set(ccx, ccy);
      heroPhBg.scale.set(cw, ch);
      if (heroGlyph) {
        const grow = Math.sqrt((cw / heroCell.w) * (ch / heroCell.h));
        heroGlyph.position.set(ccx, ccy);
        heroGlyph.scale.set(grow);
      }
    }
  };

  return { timeline, duration: 4.2, update };
}

export const gridZoom: TemplateDefinition = {
  id: "grid-zoom",
  name: "Grid Zoom",
  tagline: "A tidy photo grid zooms into one hero shot.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.3,
  fontRoles: { caption: "display" },
  palettes: PALETTES,
  fields: [
    { key: "image1", type: "image", label: "Image 1 (hero)", default: "", optional: true, help: "This tile zooms up to fill the frame." },
    { key: "image2", type: "image", label: "Image 2", default: "", optional: true },
    { key: "image3", type: "image", label: "Image 3", default: "", optional: true },
    { key: "image4", type: "image", label: "Image 4", default: "", optional: true },
    { key: "image5", type: "image", label: "Image 5", default: "", optional: true },
    { key: "image6", type: "image", label: "Image 6", default: "", optional: true },
    { key: "caption", type: "text", label: "Caption", default: "Our favorite shot", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showCaption", type: "toggle", label: "Caption", default: true },
    { key: "accentBar", type: "toggle", label: "Accent underline", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Caption text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

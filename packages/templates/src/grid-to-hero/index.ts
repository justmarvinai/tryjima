import { Container, Graphics, Sprite, type Texture } from "pixi.js";
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

// The tiles are not stand-ins for the hero — each one already holds its own
// slice of it. They start as a tidy small grid, glide together and grow until
// the slices meet edge to edge, and the finished card takes over.
const PALETTES: Palette[] = [
  {
    id: "gallery",
    name: "Gallery",
    colors: {
      background: "#F5F3EF", textColor: "#17150F", accent: "#A04C24", cardColor: "#FFFFFF",
      muted: "#A69C8E", heroSky: "#E7D8BE", heroSun: "#E9A75C", heroMid: "#C08A55", heroInk: "#6E4B2E",
    },
  },
  {
    id: "cobalt",
    name: "Cobalt",
    colors: {
      background: "#EEF1F6", textColor: "#0E1622", accent: "#25539C", cardColor: "#FFFFFF",
      muted: "#8E9AAB", heroSky: "#D3E0EE", heroSun: "#8FB6DE", heroMid: "#6E8FBC", heroInk: "#33507C",
    },
  },
  {
    id: "fern",
    name: "Fern",
    colors: {
      background: "#F0F4EE", textColor: "#131E11", accent: "#3F7A3A", cardColor: "#FFFFFF",
      muted: "#93A38E", heroSky: "#DCE8D4", heroSun: "#B9D39E", heroMid: "#83A874", heroInk: "#3E6238",
    },
  },
  {
    id: "onyx",
    name: "Onyx",
    colors: {
      background: "#101114", textColor: "#F2F3F6", accent: "#E0A75C", cardColor: "#1B1D22",
      muted: "#787E88", heroSky: "#242830", heroSun: "#4B5464", heroMid: "#333945", heroInk: "#5D6879",
    },
  },
];

interface Cfg {
  cols: number;
  rows: number;
  heroWF: number;
  /** Hero height as a multiple of its width. */
  heroAR: number;
  titleF: number;
}
const CFG: Record<Aspect, Cfg> = {
  "16:9": { cols: 4, rows: 3, heroWF: 0.62, heroAR: 0.58, titleF: 0.058 },
  "1:1": { cols: 3, rows: 3, heroWF: 0.86, heroAR: 0.78, titleF: 0.058 },
  "4:5": { cols: 3, rows: 3, heroWF: 0.92, heroAR: 0.92, titleF: 0.055 },
  "9:16": { cols: 3, rows: 4, heroWF: 0.98, heroAR: 1, titleF: 0.05 },
};

// Spread grid: tiles at 70% of a cell, pitched at 86% of a cell — a tidy grid
// with even gutters that closes to nothing as the tiles converge.
const START_SCALE = 0.7;
const EXPAND = 0.86;

const ENTER_START = 0.1;
const ENTER_STEP = 0.055;
const ENTER_DUR = 0.7;
const CONVERGE = 1.45;
const CONVERGE_STEP = 0.035;
const CONVERGE_DUR = 1.15;
const HERO_IN = 2.8;
const TITLE_START = 2.95;
const DURATION = 5.0;

interface HeroColors {
  sky: string;
  sun: string;
  mid: string;
  ink: string;
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
        .roundRect(-w / 2 - o, -h / 2 - o + dy, w + o * 2, h + o * 2, r + o)
        .fill({ color: "#000000", alpha: 0.034 }),
    );
  }
  return c;
}

/** The hero picture, drawn once per slice in hero-local coordinates. */
function drawHero(g: Graphics, w: number, h: number, c: HeroColors): void {
  g.rect(-w / 2, -h / 2, w, h).fill(c.sky);
  g.circle(w * 0.22, -h * 0.24, Math.min(w, h) * 0.16).fill(c.sun);
  g.ellipse(-w * 0.3, h * 0.14, w * 0.52, h * 0.26).fill({ color: c.mid, alpha: 0.75 });
  g.poly([-w * 0.62, h * 0.5, -w * 0.16, -h * 0.08, w * 0.16, h * 0.5]).fill(c.mid);
  g.poly([-w * 0.08, h * 0.5, w * 0.3, h * 0.06, w * 0.66, h * 0.5]).fill(c.ink);
  g.rect(-w / 2, h * 0.36, w, h * 0.14).fill({ color: c.ink, alpha: 0.3 });
}

/** One slice of the hero, clipped to a cell and offset so it lines up. */
function makeSlice(
  cellW: number,
  cellH: number,
  radius: number,
  dx: number,
  dy: number,
  heroW: number,
  heroH: number,
  colors: HeroColors,
  tex: Texture | null,
): Container {
  const clip = new Container();
  const inner = new Container();
  inner.position.set(-dx, -dy);
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.scale.set(Math.max(heroW / tex.width, heroH / tex.height));
    inner.addChild(s);
  } else {
    const g = new Graphics();
    drawHero(g, heroW, heroH, colors);
    inner.addChild(g);
  }
  const mask = new Graphics().roundRect(-cellW / 2, -cellH / 2, cellW, cellH, radius).fill(0xffffff);
  clip.addChild(inner, mask);
  clip.mask = mask;
  return clip;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F3EF"));
  const textColor = str(values.textColor, pc("textColor", "#17150F"));
  const accent = str(values.accent, pc("accent", "#A04C24"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const muted = pc("muted", "#A69C8E");
  const heroColors: HeroColors = {
    sky: pc("heroSky", "#E7D8BE"),
    sun: pc("heroSun", "#E9A75C"),
    mid: pc("heroMid", "#C08A55"),
    ink: pc("heroInk", "#6E4B2E"),
  };

  const eyebrow = str(values.eyebrow, "Portfolio");
  const title = str(values.title, "Every piece finds its place");
  const subtitle = str(values.subtitle, "A year of work, resolved into one frame.");
  const showEyebrow = on(values.showEyebrow) && eyebrow.length > 0;
  const showShadow = on(values.showShadow);
  const showRule = on(values.showRule);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cfg = CFG[ctx.aspect];
  const safe = safeRect(ctx.aspect);
  const timeline = new JimaTimeline();

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  // --- Metrics ---
  const eyeSize = Math.round(minDim * 0.021);
  const titleSize0 = Math.round(minDim * cfg.titleF);
  const subSize0 = Math.round(minDim * 0.026);
  const gapHero = minDim * 0.045;
  const gapTitle = minDim * 0.022;
  const gapSub = minDim * 0.02;
  const ruleW = minDim * 0.06;
  const ruleH = Math.max(3, Math.round(minDim * 0.006));

  const textMaxW = safe.width * 0.92;
  const titleSize = fitSize(fonts, title, "display", 700, titleSize0, textMaxW);
  const subSize = fitSize(fonts, subtitle, "body", 500, subSize0, textMaxW);
  const hasSub = subtitle.length > 0;

  const textBlockH =
    (showEyebrow ? eyeSize * 1.2 + gapTitle : 0) +
    titleSize * 1.2 +
    (hasSub ? gapSub + subSize * 1.25 : 0) +
    (showRule ? minDim * 0.026 + ruleH : 0);

  let heroW = safe.width * cfg.heroWF;
  let heroH = heroW * cfg.heroAR;
  const maxHeroH = safe.height - textBlockH - gapHero;
  if (heroH > maxHeroH) {
    heroH = maxHeroH;
    heroW = Math.min(heroW, heroH / cfg.heroAR);
  }

  const blockTop = safe.y + (safe.height - (heroH + gapHero + textBlockH)) / 2;
  const heroCx = w / 2;
  const heroCy = blockTop + heroH / 2;
  const heroR = minDim * 0.024;

  const cols = cfg.cols;
  const rows = cfg.rows;
  const cellW = heroW / cols;
  const cellH = heroH / rows;
  const tileR = Math.min(cellW, cellH) * 0.11;

  // --- Slices: a tidy small grid that converges into the hero ---
  const stage = new Container();
  stage.position.set(heroCx, heroCy);
  root.addChild(stage);

  const tiles: Container[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const dx = (c - (cols - 1) / 2) * cellW;
      const dy = (r - (rows - 1) / 2) * cellH;
      const tile = makeSlice(cellW, cellH, tileR, dx, dy, heroW, heroH, heroColors, images.image ?? null);
      const spreadX = dx * EXPAND;
      const spreadY = dy * EXPAND;
      // Enter from a touch further out, so the grid itself settles inwards.
      const fromX = dx * EXPAND * 1.1;
      const fromY = dy * EXPAND * 1.1;
      tile.position.set(fromX, fromY);
      tile.scale.set(START_SCALE * 0.9);
      tile.alpha = 0;
      stage.addChild(tile);
      tiles.push(tile);

      const enterAt = ENTER_START + (r + c) * ENTER_STEP;
      const mergeAt = CONVERGE + (r + c) * CONVERGE_STEP;
      timeline
        .to(tile, { prop: "alpha", from: 0, to: 1, start: enterAt, duration: 0.5, ease: outQuad })
        .to(tile, { prop: "x", from: fromX, to: spreadX, start: enterAt, duration: ENTER_DUR, ease: outQuint })
        .to(tile, { prop: "y", from: fromY, to: spreadY, start: enterAt, duration: ENTER_DUR, ease: outQuint })
        .to(tile, { prop: "scale.x", from: START_SCALE * 0.9, to: START_SCALE, start: enterAt, duration: ENTER_DUR, ease: outQuint })
        .to(tile, { prop: "scale.y", from: START_SCALE * 0.9, to: START_SCALE, start: enterAt, duration: ENTER_DUR, ease: outQuint })
        // Converge: travel to the exact cell and grow until the gutters close.
        .to(tile, { prop: "x", from: spreadX, to: dx, start: mergeAt, duration: CONVERGE_DUR, ease: inOutCubic })
        .to(tile, { prop: "y", from: spreadY, to: dy, start: mergeAt, duration: CONVERGE_DUR, ease: inOutCubic })
        .to(tile, { prop: "scale.x", from: START_SCALE, to: 1, start: mergeAt, duration: CONVERGE_DUR, ease: inOutCubic })
        .to(tile, { prop: "scale.y", from: START_SCALE, to: 1, start: mergeAt, duration: CONVERGE_DUR, ease: inOutCubic })
        .to(tile, { prop: "alpha", from: 1, to: 0, start: HERO_IN + 0.18, duration: 0.3, ease: inOutQuad });
    }
  }

  // --- The finished hero card takes over exactly where the slices land ---
  const hero = new Container();
  hero.position.set(heroCx, heroCy);
  hero.alpha = 0;
  root.addChild(hero);
  if (showShadow) hero.addChild(softShadow(heroW, heroH, heroR, minDim * 0.014));
  hero.addChild(new Graphics().roundRect(-heroW / 2, -heroH / 2, heroW, heroH, heroR).fill(cardColor));
  hero.addChild(makeSlice(heroW, heroH, heroR, 0, 0, heroW, heroH, heroColors, images.image ?? null));
  timeline.to(hero, { prop: "alpha", from: 0, to: 1, start: HERO_IN, duration: 0.45, ease: inOutQuad });

  // --- Title block ---
  let cursorY = blockTop + heroH + gapHero;

  if (showEyebrow) {
    const eyeText = makeText(fonts, {
      text: eyebrow,
      role: "body",
      weight: 600,
      size: fitSize(fonts, eyebrow, "body", 600, eyeSize, textMaxW),
      color: accent,
      anchor: 0.5,
      letterSpacing: eyeSize * 0.16,
    });
    const eyeY = cursorY + eyeSize * 0.6;
    eyeText.position.set(heroCx, eyeY);
    eyeText.alpha = 0;
    root.addChild(eyeText);
    timeline
      .to(eyeText, { prop: "alpha", from: 0, to: 1, start: TITLE_START, duration: 0.45, ease: outQuad })
      .to(eyeText, { prop: "y", from: eyeY + minDim * 0.01, to: eyeY, start: TITLE_START, duration: 0.6, ease: outQuint });
    cursorY += eyeSize * 1.2 + gapTitle;
  }

  const titleY = cursorY + titleSize * 0.6;
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    letterSpacing: -titleSize * 0.014,
  });
  titleText.position.set(heroCx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: TITLE_START + 0.15, duration: 0.5, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + minDim * 0.018, to: titleY, start: TITLE_START + 0.15, duration: 0.75, ease: outQuint });
  cursorY += titleSize * 1.2;

  if (hasSub) {
    const subY = cursorY + gapSub + subSize * 0.6;
    const subText = makeText(fonts, {
      text: subtitle,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    subText.position.set(heroCx, subY);
    subText.alpha = 0;
    root.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.75, start: TITLE_START + 0.33, duration: 0.5, ease: outQuad })
      .to(subText, { prop: "y", from: subY + minDim * 0.014, to: subY, start: TITLE_START + 0.33, duration: 0.65, ease: outQuint });
    cursorY += gapSub + subSize * 1.25;
  }

  if (showRule) {
    const ruleY = cursorY + minDim * 0.026;
    const track = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill({ color: muted, alpha: 0.4 });
    track.position.set(heroCx - ruleW / 2, ruleY);
    track.alpha = 0;
    const fill = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    fill.position.set(heroCx - ruleW / 2, ruleY);
    fill.scale.x = 0;
    root.addChild(track, fill);
    timeline
      .to(track, { prop: "alpha", from: 0, to: 1, start: TITLE_START + 0.35, duration: 0.35, ease: outQuad })
      .to(fill, { prop: "scale.x", from: 0, to: 1, start: TITLE_START + 0.45, duration: 0.65, ease: outExpo });
  }

  return { timeline, duration: DURATION };
}

export const gridToHero: TemplateDefinition = {
  id: "grid-to-hero",
  name: "Grid to Hero",
  tagline: "A tidy grid of tiles glides together and resolves into one hero frame.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.6,
  fontRoles: { title: "display", subtitle: "body", eyebrow: "body" },
  palettes: PALETTES,
  fields: [
    { key: "eyebrow", type: "text", label: "Eyebrow", default: "Portfolio", maxLength: 20, shrinkToFit: true, optional: true },
    { key: "title", type: "text", label: "Title", default: "Every piece finds its place", maxLength: 34, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "A year of work, resolved into one frame.", maxLength: 48, shrinkToFit: true, optional: true },
    { key: "image", type: "image", label: "Hero image", default: "", optional: true, help: "Sliced across the tiles; a drawn scene stands in when empty." },
    { key: "showEyebrow", type: "toggle", label: "Eyebrow", default: true },
    { key: "showShadow", type: "toggle", label: "Hero shadow", default: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

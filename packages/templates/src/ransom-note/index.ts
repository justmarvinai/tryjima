import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  makeOutBack,
  steps,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type Rng,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutChars, type CharBox } from "../shared/words";

// Ransom Note — every letter of the headline is pasted on its own cut-paper
// tile (mismatched colors, rotations and sizes, like letters clipped from
// magazines). Tiles slap down one by one with a squash-and-settle; the subline
// types in below like a typewritten demand. The per-letter collage look is the
// point — this is not a stamp or sticker effect.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

// Each palette carries four tile/ink pairs (paper color + letter color on it)
// so every tile keeps strong letter contrast in every scheme. tile3 always
// matches the palette accent — the "bold tiles" the accent field recolors.
const PALETTES: Palette[] = [
  {
    id: "magazine-paper",
    name: "Magazine paper",
    colors: {
      background: "#F4EFE4",
      textColor: "#1C1712",
      accent: "#DF3B2C",
      tile1: "#FFFFFF",
      ink1: "#17171B",
      tile2: "#17171B",
      ink2: "#FFFFFF",
      tile3: "#DF3B2C",
      ink3: "#FFF6EE",
      tile4: "#F2BF3C",
      ink4: "#231803",
    },
  },
  {
    id: "newsprint",
    name: "Newsprint",
    colors: {
      background: "#FFFFFF",
      textColor: "#101014",
      accent: "#D61F26",
      tile1: "#EFEFEA",
      ink1: "#101014",
      tile2: "#101014",
      ink2: "#FFFFFF",
      tile3: "#D61F26",
      ink3: "#FFF3F0",
      tile4: "#2E5BD6",
      ink4: "#F0F4FF",
    },
  },
  {
    id: "kraft-parcel",
    name: "Kraft parcel",
    colors: {
      background: "#E7DBC4",
      textColor: "#2A2014",
      accent: "#B4432F",
      tile1: "#FFF8EA",
      ink1: "#241C10",
      tile2: "#241C10",
      ink2: "#FFF4DF",
      tile3: "#B4432F",
      ink3: "#FFF1E6",
      tile4: "#3E5E43",
      ink4: "#F0EEDC",
    },
  },
  {
    id: "zine-night",
    name: "Zine night",
    colors: {
      background: "#17141B",
      textColor: "#F5F1E8",
      accent: "#FF3D8A",
      tile1: "#F5F1E8",
      ink1: "#17141B",
      tile2: "#FFD34D",
      ink2: "#231803",
      tile3: "#FF3D8A",
      ink3: "#20050F",
      tile4: "#41C7B9",
      ink4: "#0B241F",
    },
  },
];

interface Layout {
  fontFrac: number; // of canvas width
  maxWidthFrac: number; // of safe-rect width
  centerFrac: number; // of safe-rect height
}

function layoutOf(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.07, maxWidthFrac: 0.84, centerFrac: 0.44 };
    case "9:16":
      return { fontFrac: 0.104, maxWidthFrac: 0.94, centerFrac: 0.44 };
    case "4:5":
      return { fontFrac: 0.096, maxWidthFrac: 0.9, centerFrac: 0.44 };
    case "1:1":
    default:
      return { fontFrac: 0.096, maxWidthFrac: 0.9, centerFrac: 0.44 };
  }
}

/** Deterministically flip letter case with the seeded RNG (magazine-cutout feel). */
function mixCase(text: string, rng: Rng): string {
  let out = "";
  for (const ch of text) {
    const isLetter = ch.toLowerCase() !== ch.toUpperCase();
    if (isLetter && rng.next() < 0.42) {
      out += ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase();
    } else {
      out += ch;
    }
  }
  return out;
}

// Tile geometry constants (em of the glyph font size).
const AVG_ADV_EM = 0.4; // average width a tile adds over its glyph (for fitting)
const WORD_GAP_EM = 0.34; // extra advance between words
const CHAR_GAP_EM = -0.05; // tiles kiss/barely overlap inside a word
const LINE_EM = 1.66;

// Everything random about one tile, in em units so a late rescale is exact.
interface TileParams {
  pairIdx: number;
  rot: number;
  padL: number;
  padR: number;
  padTop: number;
  padBot: number;
  jitterY: number;
  glyphScale: number;
  corner: number[];
  tapeRoll: number;
  tapeRot: number;
  tapeSide: number;
}

function drawParams(rng: Rng, prevPair: number): TileParams {
  let pairIdx = rng.int(0, 3);
  if (pairIdx === prevPair) pairIdx = (pairIdx + 1) % 4;
  const p: TileParams = {
    pairIdx,
    rot: rng.range(-0.13, 0.13),
    padL: rng.range(0.13, 0.26),
    padR: rng.range(0.13, 0.26),
    padTop: rng.range(0.1, 0.22),
    padBot: rng.range(0.1, 0.22),
    jitterY: rng.range(-0.055, 0.055),
    glyphScale: rng.range(0.9, 1.06),
    corner: [],
    tapeRoll: rng.next(),
    tapeRot: rng.range(-0.45, 0.45),
    tapeSide: rng.next() < 0.5 ? -1 : 1,
  };
  for (let i = 0; i < 8; i++) p.corner.push(rng.range(-0.045, 0.045));
  return p;
}

/** Shrink so the widest word (with average tile padding) fits maxWidth. */
function fitFont(fonts: FontRegistry, text: string, size0: number, maxWidth: number): number {
  const family = fonts.family("display");
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return size0;
  let size = size0;
  for (const word of words) {
    const mw = fonts.measure(word, { family, weight: 700, size: size0 });
    const expanded = mw + word.length * AVG_ADV_EM * size0;
    if (expanded > maxWidth * 0.98) {
      size = Math.min(size, Math.floor((size0 * maxWidth * 0.98) / expanded));
    }
  }
  return Math.max(16, size);
}

const TILE_START = 0.35;
const TILE_BUDGET = 1.5;
const TILE_DUR = 0.42;
const SUB_START = 2.35;
const SUB_BUDGET = 0.85;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4EFE4"));
  const textColor = str(values.textColor, pc("textColor", "#1C1712"));
  const accent = str(values.accent, pc("accent", "#DF3B2C"));
  const rawHeadline = str(values.headline, "Pay attention");
  const subline = typeof values.subline === "string" ? values.subline : "";
  const useMixCase = on(values.mixCase);
  const showTape = on(values.showTape);

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const L = layoutOf(ctx.aspect);
  const cx = w / 2;
  const family = fonts.family("display");

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // Case-mix first (consumes rng once per letter) so layout measures the
  // glyphs actually shown. All rng use is order-stable for given values.
  const headline = useMixCase ? mixCase(rawHeadline, rng) : rawHeadline;

  const maxW = zone.width * L.maxWidthFrac;
  const centerY = zone.y + zone.height * L.centerFrac;
  let fs = fitFont(fonts, headline, Math.round(w * L.fontFrac), maxW);

  // Wrap on glyph widths, anticipating how much the tiles will widen each line.
  const glyphSum = headline
    .split(/\s+/)
    .filter(Boolean)
    .reduce((acc, word) => acc + fonts.measure(word, { family, weight: 700, size: fs }), 0);
  const charCount = headline.replace(/\s+/g, "").length;
  const expandedSum = glyphSum + charCount * AVG_ADV_EM * fs;
  const wrapWidth = expandedSum > 0 ? maxW * (glyphSum / expandedSum) : maxW;

  const layoutOnce = (fontSize: number): CharBox[] =>
    layoutChars(headline, fonts, {
      role: "display",
      weight: 700,
      fontSize,
      lineHeight: Math.round(fontSize * LINE_EM),
      maxWidth: wrapWidth,
      align: "center",
      anchorX: cx,
      centerY,
      spaceWidthEm: 0.5,
    });
  let boxes = layoutOnce(fs);
  for (let guard = 0; guard < 2; guard++) {
    const lines = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
    if (lines <= 3) break;
    fs = Math.max(16, Math.floor(fs * 0.84));
    boxes = layoutOnce(fs);
  }
  if (boxes.length === 0) return { timeline, duration: DURATION };

  // Per-tile randomness, consumed in fixed char order (independent of toggles
  // and layout, so the collage stays identical when options flip).
  const params: TileParams[] = [];
  let prevPair = -1;
  for (let i = 0; i < boxes.length; i++) {
    const p = drawParams(rng, prevPair);
    prevPair = p.pairIdx;
    params.push(p);
  }

  // Re-lay each line with real tile advances (glyph + pads), centered on cx.
  // A word break is where the original kerning layout left a space-sized gap.
  const nLines = Math.max(...boxes.map((b) => b.line)) + 1;
  const lineIdxs = Array.from({ length: nLines }, (_, li) =>
    boxes.map((_b, i) => i).filter((i) => boxes[i]!.line === li),
  );
  // Tile width at the wrap font size; every term is linear in font size, so a
  // single late scale factor keeps the whole line layout exact.
  const tileWBase = (i: number): number => {
    const b = boxes[i]!;
    const p = params[i]!;
    return b.width * p.glyphScale + (p.padL + p.padR) * fs;
  };
  const isWordBreak = (a: number, b: number): boolean => {
    const A = boxes[a]!;
    const B = boxes[b]!;
    return B.cx - B.width / 2 - (A.cx + A.width / 2) > fs * 0.2;
  };
  const lineWidthBase = (idxs: number[]): number => {
    let width = 0;
    idxs.forEach((bi, k) => {
      width += tileWBase(bi);
      if (k > 0) width += (isWordBreak(idxs[k - 1]!, bi) ? WORD_GAP_EM : CHAR_GAP_EM) * fs;
    });
    return width;
  };

  const widest = Math.max(...lineIdxs.map((idxs) => lineWidthBase(idxs)));
  const scale = widest > maxW ? maxW / widest : 1;
  const FS = fs * scale;
  const lineH = FS * LINE_EM;
  const top = centerY - (nLines * lineH) / 2;

  const collage = new Container();
  collage.label = "collage";
  root.addChild(collage);

  // Tile/ink pairs; the accent color field recolors the boldest tile slot.
  const pairs: { tile: string; ink: string }[] = [
    { tile: pc("tile1", "#FFFFFF"), ink: pc("ink1", "#17171B") },
    { tile: pc("tile2", "#17171B"), ink: pc("ink2", "#FFFFFF") },
    { tile: accent, ink: pc("ink3", "#FFF6EE") },
    { tile: pc("tile4", "#F2BF3C"), ink: pc("ink4", "#231803") },
  ];

  const n = boxes.length;
  const perTile = n > 1 ? Math.min(0.085, TILE_BUDGET / (n - 1)) : 0;
  let maxCy = centerY;

  lineIdxs.forEach((idxs, li) => {
    const lineW = lineWidthBase(idxs) * scale;
    let cursor = cx - lineW / 2;
    const cy = top + li * lineH + lineH / 2;
    maxCy = Math.max(maxCy, cy);

    idxs.forEach((bi, k) => {
      const box = boxes[bi]!;
      const p = params[bi]!;
      if (k > 0) cursor += (isWordBreak(idxs[k - 1]!, bi) ? WORD_GAP_EM : CHAR_GAP_EM) * fs * scale;
      const tileWFinal = tileWBase(bi) * scale;
      const tileH = FS * 0.98 * p.glyphScale + (p.padTop + p.padBot) * FS;
      const tcx = cursor + tileWFinal / 2;
      const tcy = cy + p.jitterY * FS;
      cursor += tileWFinal;

      const pair = pairs[p.pairIdx] ?? pairs[0]!;
      const tile = new Container();
      tile.position.set(tcx, tcy);
      tile.rotation = p.rot;
      tile.alpha = 0;
      collage.addChild(tile);

      // Cut-paper quad with jittered corners (torn-scissors feel).
      const pts = [
        -tileWFinal / 2 + p.corner[0]! * FS, -tileH / 2 + p.corner[1]! * FS,
        tileWFinal / 2 + p.corner[2]! * FS, -tileH / 2 + p.corner[3]! * FS,
        tileWFinal / 2 + p.corner[4]! * FS, tileH / 2 + p.corner[5]! * FS,
        -tileWFinal / 2 + p.corner[6]! * FS, tileH / 2 + p.corner[7]! * FS,
      ];
      const shadowPts = pts.map((v, i) => (i % 2 === 0 ? v + FS * 0.05 : v + FS * 0.075));
      tile.addChild(new Graphics().poly(shadowPts).fill({ color: "#000000", alpha: 0.16 }));
      tile.addChild(new Graphics().poly(pts).fill(pair.tile));

      const letter = makeText(fonts, {
        text: box.char,
        role: "display",
        weight: 700,
        size: FS * p.glyphScale,
        color: pair.ink,
        anchor: 0.5,
      });
      letter.position.set((p.padL - p.padR) * FS * 0.4, (p.padTop - p.padBot) * FS * 0.3);
      tile.addChild(letter);

      if (showTape && p.tapeRoll < 0.38) {
        const tapeW = tileWFinal * 0.6;
        const tapeH = FS * 0.17;
        const tape = new Graphics()
          .roundRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH, tapeH * 0.2)
          .fill({ color: "#FFFCF2", alpha: 0.46 });
        tape.position.set(p.tapeSide * tileWFinal * 0.12, -tileH / 2 + p.corner[1]! * FS * 0.5);
        tape.rotation = p.tapeRot;
        tile.addChild(tape);
      }

      // Slap in: appears big, squashes down onto the page with a settle.
      const start = TILE_START + box.index * perTile;
      timeline
        .to(tile, { prop: "alpha", from: 0, to: 1, start, duration: 0.07, ease: outQuad })
        .to(tile, { prop: "scale.x", from: 1.8, to: 1, start, duration: TILE_DUR, ease: makeOutBack(1.2) })
        .to(tile, { prop: "scale.y", from: 1.8, to: 1, start, duration: TILE_DUR, ease: makeOutBack(1.2) })
        .to(tile, { prop: "rotation", from: p.rot * 2.8, to: p.rot, start, duration: TILE_DUR + 0.06, ease: makeOutBack(1.5) })
        .to(tile, { prop: "y", from: tcy - FS * 0.12, to: tcy, start, duration: 0.32, ease: outCubic });
    });
  });

  // --- Subline types in below the collage, letter by letter ---
  if (subline.length > 0) {
    const subSize = Math.max(15, Math.round(FS * 0.24));
    const subY = maxCy + FS * 1.06 + subSize * 0.8;
    const subBoxes = layoutChars(subline, fonts, {
      role: "body",
      weight: 600,
      fontSize: subSize,
      lineHeight: Math.round(subSize * 1.4),
      maxWidth: zone.width * 0.82,
      align: "center",
      anchorX: cx,
      centerY: subY,
    });
    const m = subBoxes.length;
    const perSub = m > 1 ? Math.min(0.05, SUB_BUDGET / (m - 1)) : 0;
    for (const sb of subBoxes) {
      const g = makeText(fonts, {
        text: sb.char,
        role: "body",
        weight: 600,
        size: subSize,
        color: textColor,
        anchor: 0.5,
        letterSpacing: 1,
      });
      g.position.set(sb.cx, sb.cy);
      g.alpha = 0;
      root.addChild(g);
      timeline.to(g, {
        prop: "alpha",
        from: 0,
        to: 0.92,
        start: SUB_START + sb.index * perSub,
        duration: 0.05,
        ease: steps(1, "end"),
      });
    }
  }

  // A last gentle group settle once everything is pasted down.
  timeline
    .to(collage, { prop: "rotation", from: 0, to: -0.006, start: 3.3, duration: 0.28, ease: outQuad })
    .to(collage, { prop: "rotation", from: -0.006, to: 0, start: 3.58, duration: 0.34, ease: outQuad });
  collage.pivot.set(cx, centerY);
  collage.position.set(cx, centerY);

  return { timeline, duration: DURATION };
}

export const ransomNote: TemplateDefinition = {
  id: "ransom-note",
  name: "Ransom Note",
  tagline: "Letters slap down on mismatched cut-paper tiles, like a magazine collage.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 4.0,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Pay attention", maxLength: 22, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "we cut this out for you", maxLength: 48, optional: true },
    { key: "mixCase", type: "toggle", label: "Mixed-case letters", default: true },
    { key: "showTape", type: "toggle", label: "Tape strips", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Subline text", default: "", optional: true },
    { key: "accent", type: "color", label: "Bold tiles", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

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
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

// A native share tray slides up. Only the full-frame `bg` rect (the dimmed
// backdrop) is tied to the background field; the sheet uses its own palette-only
// `sheetBg` so it survives as overlay content. App-tile fills are fixed,
// semantic decorations (like real multi-colour app icons) — glyphs are white.
const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#DDE1EA", sheetBg: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#050507", sheetBg: "#17181F", textColor: "#FFFFFF", accent: "#FF6A3D" } },
  { id: "sky", name: "Sky", colors: { background: "#CFDDEF", sheetBg: "#FFFFFF", textColor: "#0B2447", accent: "#2E7DF6" } },
  { id: "graphite", name: "Graphite", colors: { background: "#141519", sheetBg: "#25262D", textColor: "#FFFFFF", accent: "#4FC3F7" } },
];

const TILE_COLORS = ["#2E7DF6", "#22C55E", "#FF8A3D", "#7C5CFF", "#FF2E9E", "#0FB5BA"];
const GLYPH = "#FFFFFF";

/** A distinct, simple white app glyph per tile index (cycles through 6). */
function appGlyph(i: number, S: number): Container {
  const c = new Container();
  const kind = i % 6;
  if (kind === 1) {
    c.addChild(makeIcon("plane", S, { color: GLYPH }));
    return c;
  }
  if (kind === 3) {
    c.addChild(makeIcon("bookmark", S, { color: GLYPH }));
    return c;
  }
  if (kind === 4) {
    c.addChild(makeIcon("heart", S, { color: GLYPH }));
    return c;
  }
  const g = new Graphics();
  c.addChild(g);
  if (kind === 0) {
    // message bubble
    g.roundRect(-0.42 * S, -0.34 * S, 0.84 * S, 0.54 * S, 0.16 * S).fill(GLYPH);
    g.poly([-0.14 * S, 0.14 * S, 0.06 * S, 0.14 * S, -0.22 * S, 0.42 * S]).fill(GLYPH);
  } else if (kind === 2) {
    // link (two chain links)
    g.roundRect(-0.42 * S, -0.15 * S, 0.5 * S, 0.3 * S, 0.15 * S).stroke({ color: GLYPH, width: Math.max(3, 0.09 * S) });
    g.roundRect(-0.08 * S, -0.15 * S, 0.5 * S, 0.3 * S, 0.15 * S).stroke({ color: GLYPH, width: Math.max(3, 0.09 * S) });
  } else {
    // more (three dots)
    for (const dx of [-0.28, 0, 0.28]) g.circle(dx * S, 0, 0.09 * S).fill(GLYPH);
  }
  return c;
}

function appsOf(values: Values): string[] {
  return asList(values.apps, ["Messages", "Send", "Copy link", "Save"]).slice(0, 6);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#DDE1EA"));
  const sheetBg = pc("sheetBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));

  const title = str(values.title, "Share to");
  const showHandle = values.showHandle !== false;
  const apps = appsOf(values);
  const n = apps.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Sheet + tile geometry ---
  const sheetW = Math.min(safe.width, minDim * 1.05);
  const innerPad = Math.round(minDim * 0.05);
  const tileGap = Math.round(minDim * 0.03);
  const maxTile = minDim * 0.165;
  const tileSize = Math.min(maxTile, (sheetW - 2 * innerPad - (n - 1) * tileGap) / n);
  const glyphSize = tileSize * 0.5;
  const tileRadius = tileSize * 0.26;
  const labelFont = fitSize(fonts, "Copy link", "body", 600, Math.round(tileSize * 0.17), tileSize * 1.02);
  const labelH = labelFont * 1.15;
  const labelGap = tileSize * 0.14;

  const titleFont = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.04), sheetW - 2 * innerPad);
  const titleH = titleFont * 1.2;

  const handleH = Math.round(minDim * 0.011);
  const handleW = Math.round(minDim * 0.09);

  const topPad = Math.round(minDim * 0.032);
  const bottomPad = Math.round(minDim * 0.05);
  const gapHandleTitle = Math.round(minDim * 0.028);
  const gapTitleTiles = Math.round(minDim * 0.042);

  const sheetH =
    topPad +
    (showHandle ? handleH + gapHandleTitle : 0) +
    titleH +
    gapTitleTiles +
    tileSize +
    labelGap +
    labelH +
    bottomPad;

  const sheetBottom = safe.y + safe.height; // rests on the safe-zone floor (above 9:16 chrome)
  const restCy = sheetBottom - sheetH / 2;
  const sheetCx = w / 2;

  const sheet = new Container();
  sheet.position.set(sheetCx, restCy);
  root.addChild(sheet);

  // Soft shadow above the sheet's top edge so it reads over the backdrop.
  const se = Math.round(minDim * 0.02);
  sheet.addChild(
    new Graphics()
      .roundRect(-sheetW / 2 - se, -sheetH / 2 - se, sheetW + se * 2, sheetH + se * 2, minDim * 0.032 + se)
      .fill({ color: "#000000", alpha: 0.16 }),
  );
  sheet.addChild(new Graphics().roundRect(-sheetW / 2, -sheetH / 2, sheetW, sheetH, minDim * 0.032).fill(sheetBg));

  // Grab handle
  if (showHandle) {
    const handleY = -sheetH / 2 + topPad + handleH / 2;
    sheet.addChild(
      new Graphics().roundRect(-handleW / 2, handleY - handleH / 2, handleW, handleH, handleH / 2).fill({ color: textColor, alpha: 0.24 }),
    );
  }

  // Title (with a small accent share glyph)
  const titleCy = -sheetH / 2 + topPad + (showHandle ? handleH + gapHandleTitle : 0) + titleH / 2;
  const shareGlyphSize = titleFont * 1.02;
  const glyphGap = titleFont * 0.42;
  const shareGlyph = makeIcon("share", shareGlyphSize, { color: accent });
  shareGlyph.position.set(-sheetW / 2 + innerPad + shareGlyphSize / 2, titleCy);
  shareGlyph.alpha = 0;
  sheet.addChild(shareGlyph);
  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleFont,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  titleText.position.set(-sheetW / 2 + innerPad + shareGlyphSize + glyphGap, titleCy);
  titleText.alpha = 0;
  sheet.addChild(titleText);

  // App tiles row
  const tilesTop = titleCy + titleH / 2 + gapTitleTiles;
  const tileCy = tilesTop + tileSize / 2;
  const totalTilesW = n * tileSize + (n - 1) * tileGap;
  const rowLeft = -totalTilesW / 2;
  const labelCy = tileCy + tileSize / 2 + labelGap + labelH / 2;

  const TILES_START = 0.32;
  const TILE_STAGGER = 0.09;

  apps.forEach((appLabel, i) => {
    const tileCx = rowLeft + i * (tileSize + tileGap) + tileSize / 2;

    const cell = new Container();
    cell.position.set(tileCx, tileCy);
    cell.scale.set(0);
    cell.alpha = 0;
    sheet.addChild(cell);
    cell.addChild(
      new Graphics()
        .roundRect(-tileSize / 2, -tileSize / 2, tileSize, tileSize, tileRadius)
        .fill(TILE_COLORS[i % TILE_COLORS.length]!),
    );
    cell.addChild(appGlyph(i, glyphSize));

    const lblSize = fitSize(fonts, appLabel, "body", 600, labelFont, tileSize * 1.12);
    const lbl = makeText(fonts, { text: appLabel, role: "body", weight: 600, size: lblSize, color: textColor, anchor: 0.5, align: "center" });
    lbl.position.set(tileCx, labelCy);
    lbl.alpha = 0;
    sheet.addChild(lbl);

    const start = TILES_START + i * TILE_STAGGER;
    timeline
      .to(cell, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(cell, { prop: "scale.x", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.8) })
      .to(cell, { prop: "scale.y", from: 0, to: 1, start, duration: 0.55, ease: makeOutBack(1.8) })
      .to(lbl, { prop: "alpha", from: 0, to: 0.82, start: start + 0.12, duration: 0.35, ease: outQuad });
  });

  // Sheet slides up from below the frame; the title fades in as it settles.
  const startY = restCy + sheetH + minDim * 0.12;
  timeline
    .to(sheet, { prop: "y", from: startY, to: restCy, start: 0.04, duration: 0.62, ease: outExpo })
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.26, duration: 0.4, ease: outQuad })
    .to(shareGlyph, { prop: "alpha", from: 0, to: 1, start: 0.26, duration: 0.4, ease: outQuad });

  return { timeline, duration: 3.4 };
}

export const shareSheet: TemplateDefinition = {
  id: "share-sheet",
  name: "Share Sheet",
  tagline: "A native share tray slides up and the app tiles pop in one by one.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { title: "display", apps: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Share to", maxLength: 24, shrinkToFit: true },
    {
      key: "apps",
      type: "textlist",
      label: "App labels",
      default: ["Messages", "Send", "Copy link", "Save"],
      minItems: 3,
      maxItems: 6,
      maxLength: 14,
      help: "One label per line — each becomes a tile.",
    },
    { key: "showHandle", type: "toggle", label: "Grab handle", default: true },
    { key: "background", type: "color", label: "Backdrop", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

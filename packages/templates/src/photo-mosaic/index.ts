import { Container, Graphics, FillGradient } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
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

function fitSize(fonts: FontRegistry, text: string, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family("display"), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

/** Linear interpolate two #RRGGBB colors. */
function lerpHex(a: string, b: string, t: number): string {
  const pa = /^#?([0-9a-f]{6})$/i.exec(a.trim());
  const pb = /^#?([0-9a-f]{6})$/i.exec(b.trim());
  if (!pa || !pb) return a;
  const na = parseInt(pa[1]!, 16);
  const nb = parseInt(pb[1]!, 16);
  const mix = (sa: number, sb: number): number => Math.round(sa + (sb - sa) * t);
  const r = mix((na >> 16) & 255, (nb >> 16) & 255);
  const g = mix((na >> 8) & 255, (nb >> 8) & 255);
  const bl = mix(na & 255, nb & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

// Gradient tiles fly in and assemble into one image, then a caption slides up.
// Tile colors come from a bilinear blend of four palette corner colors; the
// fly-in order and offsets come from ctx.rng (deterministic).
const PALETTES: Palette[] = [
  { id: "sunset", name: "Sunset", colors: { background: "#F4F5F8", c1: "#FF8A5B", c2: "#FFC15E", c3: "#FF5FA2", c4: "#C13AE8", accent: "#FFFFFF", textColor: "#14151B" } },
  { id: "ocean", name: "Ocean", colors: { background: "#EAF2FB", c1: "#2E9BFF", c2: "#41E0C0", c3: "#3B6EF5", c4: "#7C5CFF", accent: "#FFFFFF", textColor: "#0F1B2A" } },
  { id: "forest", name: "Forest", colors: { background: "#EEF4EC", c1: "#8DD35F", c2: "#3FCF8E", c3: "#0E8F6E", c4: "#4FC3A1", accent: "#FFFFFF", textColor: "#08301F" } },
  { id: "graphite", name: "Graphite", colors: { background: "#0E0E14", c1: "#3A3F52", c2: "#5B6178", c3: "#23283A", c4: "#8288A6", accent: "#FFFFFF", textColor: "#F2F4F8" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F5F8"));
  const c1 = pc("c1", "#FF8A5B");
  const c2 = pc("c2", "#FFC15E");
  const c3 = pc("c3", "#FF5FA2");
  const c4 = pc("c4", "#C13AE8");
  const accent = str(values.accent, pc("accent", "#FFFFFF"));

  const caption = str(values.caption, "Every piece, in its place.");
  const showFrame = values.showFrame !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);

  // Photo area (fit inside the safe rect, leave a margin).
  const areaW = zone.width * 0.9;
  const areaH = zone.height * 0.86;
  const areaX = zone.x + (zone.width - areaW) / 2;
  const areaY = zone.y + (zone.height - areaH) / 2;
  const areaCx = areaX + areaW / 2;
  const areaCy = areaY + areaH / 2;

  // Shadow + optional frame border.
  root.addChild(new Graphics().roundRect(areaX, areaY + areaH * 0.02, areaW, areaH, minDim * 0.02).fill({ color: "#000000", alpha: 0.18 }));

  // Grid sized for roughly square cells.
  const ar = areaW / areaH;
  const cols = Math.max(3, Math.round(Math.sqrt(22 * ar)));
  const rows = Math.max(3, Math.round(22 / cols));
  const gapPx = Math.min(areaW, areaH) * 0.012;
  const cellW = areaW / cols;
  const cellH = areaH / rows;

  const tilesWrap = new Container();
  root.addChild(tilesWrap);

  const SPREAD = 1.2;
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      const u = cols > 1 ? rx / (cols - 1) : 0.5;
      const v = rows > 1 ? ry / (rows - 1) : 0.5;
      const top = lerpHex(c1, c2, u);
      const botC = lerpHex(c3, c4, u);
      const color = lerpHex(top, botC, v);

      const fx = areaX + rx * cellW + cellW / 2;
      const fy = areaY + ry * cellH + cellH / 2;
      const tile = new Container();
      tile.position.set(fx, fy);
      tile.alpha = 0;
      tile.scale.set(0.55);
      tile.rotation = rng.range(-0.5, 0.5);
      tilesWrap.addChild(tile);
      tile.addChild(new Graphics().roundRect(-(cellW - gapPx) / 2, -(cellH - gapPx) / 2, cellW - gapPx, cellH - gapPx, Math.min(cellW, cellH) * 0.1).fill(color));

      const dist = Math.hypot(fx - areaCx, fy - areaCy);
      const maxDist = Math.hypot(areaW / 2, areaH / 2);
      const offAng = rng.range(0, Math.PI * 2);
      const offMag = minDim * rng.range(0.3, 0.7);
      const fromX = fx + Math.cos(offAng) * offMag;
      const fromY = fy + Math.sin(offAng) * offMag;
      const start = 0.15 + (dist / maxDist) * 0.5 + rng.range(0, SPREAD - 0.5);

      timeline
        .to(tile, { prop: "x", from: fromX, to: fx, start, duration: 0.75, ease: outExpo })
        .to(tile, { prop: "y", from: fromY, to: fy, start, duration: 0.75, ease: outExpo })
        .to(tile, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
        .to(tile, { prop: "rotation", from: tile.rotation, to: 0, start, duration: 0.7, ease: outExpo })
        .to(tile, { prop: "scale.x", from: 0.55, to: 1, start, duration: 0.7, ease: makeOutBack(1.4) })
        .to(tile, { prop: "scale.y", from: 0.55, to: 1, start, duration: 0.7, ease: makeOutBack(1.4) });
    }
  }

  if (showFrame) {
    root.addChild(new Graphics().roundRect(areaX, areaY, areaW, areaH, minDim * 0.02).stroke({ color: accent, width: Math.max(3, minDim * 0.008), alpha: 0.95 }));
  }

  // Caption scrim + text (slides up after assembly).
  if (caption.length > 0) {
    const scrimH = areaH * 0.34;
    const scrim = new Container();
    scrim.position.set(areaCx, 0);
    scrim.alpha = 0;
    root.addChild(scrim);
    const grad = new FillGradient({
      type: "linear",
      start: { x: 0, y: 0 },
      end: { x: 0, y: 1 },
      colorStops: [
        { offset: 0, color: "rgba(0,0,0,0)" },
        { offset: 1, color: "rgba(0,0,0,0.9)" },
      ],
      textureSpace: "local",
    });
    scrim.addChild(new Graphics().roundRect(-areaW / 2, areaY + areaH - scrimH, areaW, scrimH, minDim * 0.02).fill(grad));
    const capSize = fitSize(fonts, caption, 700, Math.round(minDim * 0.04), areaW * 0.86);
    const capNode = makeText(fonts, { text: caption, role: "display", weight: 700, size: capSize, color: "#FFFFFF", anchor: { x: 0, y: 1 }, align: "left" });
    capNode.position.set(areaX + areaW * 0.06, areaY + areaH - areaH * 0.07);
    scrim.addChild(capNode);
    root.addChild(scrim);
    const capFrom = areaH * 0.06;
    timeline
      .to(scrim, { prop: "alpha", from: 0, to: 1, start: 1.75, duration: 0.5, ease: outQuad })
      .to(scrim, { prop: "y", from: capFrom, to: 0, start: 1.75, duration: 0.6, ease: outQuint });
  }

  return { timeline, duration: 4.0 };
}

export const photoMosaic: TemplateDefinition = {
  id: "photo-mosaic",
  name: "Photo Mosaic",
  tagline: "Gradient tiles fly in and assemble into one image, then a caption.",
  category: "photo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { caption: "display" },
  palettes: PALETTES,
  fields: [
    { key: "caption", type: "text", label: "Caption", default: "Every piece, in its place.", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showFrame", type: "toggle", label: "Frame border", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Frame", default: "", optional: true },
  ],
  build,
};

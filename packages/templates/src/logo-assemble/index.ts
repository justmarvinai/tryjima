import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outCubic,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

// Scattered shards fly in and lock into a clean initials tile — a mark that
// "assembles" itself. Deep mark tiles + white letters keep contrast bulletproof;
// the accent is a decorative ring, so recolor stays safe.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F4F6FA", textColor: "#0F1420", accent: "#3B4FD6", mark: "#3B4FD6", onMark: "#FFFFFF" } },
  { id: "cream", name: "Cream", colors: { background: "#FBF6EF", textColor: "#241A12", accent: "#C2410C", mark: "#C2410C", onMark: "#FFFFFF" } },
  { id: "blush", name: "Blush", colors: { background: "#FDEEF4", textColor: "#2A0E1C", accent: "#BE185D", mark: "#BE185D", onMark: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0C1018", textColor: "#F2F5FA", accent: "#6EA8FE", mark: "#6EA8FE", onMark: "#0C1018" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6FA"));
  const textColor = str(values.textColor, pc("textColor", "#0F1420"));
  const accent = str(values.accent, pc("accent", "#3B4FD6"));
  const mark = pc("mark", "#3B4FD6");
  const onMark = pc("onMark", "#FFFFFF");

  const initials = str(values.initials, "JM").slice(0, 3).toUpperCase();
  const brand = str(values.brand, "Jima Motion");
  const showParticles = values.showParticles !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const tile = Math.round(minDim * 0.32);
  const tileR = Math.round(tile * 0.22);
  const cy = zone.y + zone.height * 0.42;

  // --- Scattered shard grid that assembles into the tile ---
  if (showParticles) {
    const grid = 5;
    const cell = tile / grid;
    const shard = cell * 0.84;
    const spread = minDim * 0.55;
    let idx = 0;
    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        const tx = cx - tile / 2 + cell * (gx + 0.5);
        const ty = cy - tile / 2 + cell * (gy + 0.5);
        const g = new Graphics()
          .roundRect(-shard / 2, -shard / 2, shard, shard, shard * 0.24)
          .fill(mark);
        const sx = tx + rng.range(-spread, spread);
        const sy = ty + rng.range(-spread * 0.7, spread * 0.7);
        g.position.set(sx, sy);
        g.alpha = 0;
        g.rotation = rng.range(-1.2, 1.2);
        g.scale.set(0.5);
        root.addChild(g);
        const start = idx * 0.018;
        timeline
          .to(g, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
          .to(g, { prop: "x", from: sx, to: tx, start, duration: 0.72, ease: outExpo })
          .to(g, { prop: "y", from: sy, to: ty, start, duration: 0.72, ease: outExpo })
          .to(g, { prop: "rotation", from: g.rotation, to: 0, start, duration: 0.72, ease: outExpo })
          .to(g, { prop: "scale.x", from: 0.5, to: 1, start, duration: 0.6, ease: outCubic })
          .to(g, { prop: "scale.y", from: 0.5, to: 1, start, duration: 0.6, ease: outCubic })
          // fade the blocky shards once the clean tile takes over
          .to(g, { prop: "alpha", from: 1, to: 0, start: 0.98, duration: 0.28, ease: outQuad });
        idx++;
      }
    }
  }

  // --- Clean tile that locks in over the assembled shards ---
  const tileNode = new Container();
  tileNode.position.set(cx, cy);
  tileNode.scale.set(showParticles ? 0.9 : 0);
  tileNode.alpha = 0;
  root.addChild(tileNode);
  tileNode.addChild(new Graphics().roundRect(-tile / 2, -tile / 2, tile, tile, tileR).fill(mark));
  const initSize = fitSize(fonts, initials, "display", 700, Math.round(tile * 0.5), tile * 0.72);
  tileNode.addChild(
    makeText(fonts, { text: initials, role: "display", weight: 700, size: initSize, color: onMark, anchor: 0.5 }),
  );
  const lock = showParticles ? 0.95 : 0.25;
  timeline
    .to(tileNode, { prop: "alpha", from: 0, to: 1, start: lock, duration: 0.3, ease: outQuad })
    .to(tileNode, { prop: "scale.x", from: showParticles ? 0.9 : 0, to: 1, start: lock, duration: 0.55, ease: makeOutBack(1.7) })
    .to(tileNode, { prop: "scale.y", from: showParticles ? 0.9 : 0, to: 1, start: lock, duration: 0.55, ease: makeOutBack(1.7) });

  // Decorative accent ring pulse behind the tile.
  const ring = new Graphics().circle(0, 0, tile * 0.82).stroke({ color: accent, width: Math.max(3, tile * 0.02) });
  ring.position.set(cx, cy);
  ring.alpha = 0;
  ring.scale.set(0.6);
  root.addChild(ring);
  root.setChildIndex(ring, 1);
  timeline
    .to(ring, { prop: "alpha", from: 0, to: 0.6, start: lock + 0.05, duration: 0.4, ease: outQuad })
    .to(ring, { prop: "alpha", from: 0.6, to: 0, start: lock + 0.5, duration: 0.6, ease: outQuad })
    .to(ring, { prop: "scale.x", from: 0.6, to: 1.15, start: lock + 0.05, duration: 0.9, ease: outExpo })
    .to(ring, { prop: "scale.y", from: 0.6, to: 1.15, start: lock + 0.05, duration: 0.9, ease: outExpo });

  // --- Brand wordmark ---
  const brandSize = fitSize(fonts, brand, "display", 600, Math.round(minDim * 0.058), zone.width * 0.86);
  const brandY = cy + tile / 2 + brandSize * 1.1;
  const brandText = makeText(fonts, { text: brand, role: "display", weight: 600, size: brandSize, color: textColor, anchor: 0.5, letterSpacing: 0.5 });
  brandText.position.set(cx, brandY);
  brandText.alpha = 0;
  root.addChild(brandText);
  const brandStart = lock + 0.4;
  timeline
    .to(brandText, { prop: "alpha", from: 0, to: 1, start: brandStart, duration: 0.4, ease: outQuad })
    .to(brandText, { prop: "y", from: brandY + 16, to: brandY, start: brandStart, duration: 0.5, ease: outExpo });

  return { timeline, duration: 4.0 };
}

export const logoAssemble: TemplateDefinition = {
  id: "logo-assemble",
  name: "Logo Assemble",
  tagline: "Scattered shards fly in and lock into a clean initials mark.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { brand: "display" },
  palettes: PALETTES,
  fields: [
    { key: "initials", type: "text", label: "Initials", default: "JM", maxLength: 3, shrinkToFit: true },
    { key: "brand", type: "text", label: "Brand", default: "Jima Motion", maxLength: 28, shrinkToFit: true },
    { key: "showParticles", type: "toggle", label: "Assemble particles", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

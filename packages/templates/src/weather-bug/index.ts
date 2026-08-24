import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  spring,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

type Cond = "sun" | "partly" | "cloud" | "rain" | "storm";

function normalizeCond(v: string): Cond {
  if (v.startsWith("sun")) return "sun";
  if (v.startsWith("part")) return "partly";
  if (v.startsWith("rain")) return "rain";
  if (v.startsWith("storm") || v.startsWith("thunder")) return "storm";
  return "cloud";
}

// Weather glyph colors are fixed (semantic — sun is always warm, rain always
// blue) regardless of the chosen brand palette; purely decorative graphics.
const SUN_COLOR = "#FFB020";
const CLOUD_COLOR = "#98A5B3";
const RAIN_COLOR = "#4C8DFF";
const BOLT_COLOR = "#FFCC33";

function drawCloud(g: Graphics, cx: number, cy: number, s: number, color: string): void {
  g.circle(cx - s * 0.32, cy + s * 0.06, s * 0.32).fill(color);
  g.circle(cx + s * 0.06, cy - s * 0.14, s * 0.4).fill(color);
  g.circle(cx + s * 0.42, cy + s * 0.08, s * 0.28).fill(color);
  g.roundRect(cx - s * 0.5, cy + s * 0.02, s * 1.0, s * 0.34, s * 0.17).fill(color);
}

function drawSun(g: Graphics, cx: number, cy: number, s: number, color: string, rays: boolean): void {
  g.circle(cx, cy, s * 0.34).fill(color);
  if (!rays) return;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r0 = s * 0.46;
    const r1 = s * 0.63;
    g.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0)
      .lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1)
      .stroke({ color, width: Math.max(1.5, s * 0.045), cap: "round" });
  }
}

function drawRainDrops(g: Graphics, cx: number, cy: number, s: number, color: string): void {
  for (const ox of [-0.28, 0, 0.28]) {
    const x = cx + ox * s;
    g.moveTo(x, cy)
      .lineTo(x - s * 0.07, cy + s * 0.24)
      .stroke({ color, width: Math.max(1.5, s * 0.05), cap: "round" });
  }
}

function weatherGlyph(cond: Cond, s: number): Container {
  const c = new Container();
  const g = new Graphics();
  c.addChild(g);
  switch (cond) {
    case "sun":
      drawSun(g, 0, 0, s, SUN_COLOR, true);
      break;
    case "partly":
      drawSun(g, s * 0.16, -s * 0.16, s * 0.7, SUN_COLOR, false);
      drawCloud(g, -s * 0.05, s * 0.12, s * 0.86, CLOUD_COLOR);
      break;
    case "cloud":
      drawCloud(g, 0, 0, s, CLOUD_COLOR);
      break;
    case "rain":
      drawCloud(g, 0, -s * 0.16, s * 0.86, CLOUD_COLOR);
      drawRainDrops(g, 0, s * 0.28, s * 0.62, RAIN_COLOR);
      break;
    case "storm": {
      drawCloud(g, 0, -s * 0.18, s * 0.86, CLOUD_COLOR);
      const bolt = makeIcon("bolt", s * 0.4, { color: BOLT_COLOR });
      bolt.position.set(0, s * 0.2);
      c.addChild(bolt);
      break;
    }
  }
  return c;
}

// A compact corner weather "bug" for streams/vlogs — a condition glyph, a big
// temperature and a city label on a floating chip. Only the full-frame `bg`
// rect is tied to the background field (defaults to the transparent sentinel so
// it composites straight onto footage); the chip uses its own palette-only
// `chipBg` (with a soft shadow) so the readout survives once the canvas fill is
// gone.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { chipBg: "#FFFFFF", textColor: "#0B0B0F", accent: "#2E7DF6" } },
  { id: "midnight", name: "Midnight", colors: { chipBg: "#17171C", textColor: "#FFFFFF", accent: "#4FC3F7" } },
  { id: "mint", name: "Mint", colors: { chipBg: "#FFFFFF", textColor: "#0B1F16", accent: "#17A34A" } },
  { id: "sunset", name: "Sunset", colors: { chipBg: "#FFFFFF", textColor: "#3A1500", accent: "#FF7A32" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const chipBg = pc("chipBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0B0B0F"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));

  const city = str(values.city, "New York");
  const temp = str(values.temp, "72°");
  const cond = normalizeCond(str(values.condition, "sun").toLowerCase());
  const showGlyph = values.showGlyph !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const glyphSize = Math.round(minDim * 0.06);
  const haloR = glyphSize * 0.64;
  const glyphBoxW = showGlyph ? Math.round(haloR * 2) : 0;
  const padX = Math.round(minDim * 0.026);
  const padY = Math.round(minDim * 0.022);
  const gapGT = showGlyph ? Math.round(minDim * 0.02) : 0;
  const rowGap = Math.round(minDim * 0.004);

  const maxTextW = Math.max(90, w * 0.42);
  const tempSize = fitSize(fonts, temp, "display", 700, Math.round(minDim * 0.05), maxTextW);
  const citySize = city.length > 0 ? fitSize(fonts, city, "body", 600, Math.round(minDim * 0.024), maxTextW) : 0;

  const tempW = fonts.measure(temp, { family: fonts.family("display"), weight: 700, size: tempSize });
  const cityW = city.length > 0 ? fonts.measure(city, { family: fonts.family("body"), weight: 600, size: citySize }) : 0;
  const textBlockW = Math.max(tempW, cityW);

  const textRowsH = city.length > 0 ? tempSize + rowGap + citySize : tempSize;
  const contentH = Math.max(glyphBoxW, textRowsH);
  const chipW = padX * 2 + glyphBoxW + gapGT + textBlockW;
  const chipH = padY * 2 + contentH;
  const chipRadius = Math.round(chipH * 0.26);

  const margin = Math.round(minDim * 0.026);
  const chipCX = zone.left + margin + chipW / 2;
  const chipCY = zone.top + margin + chipH / 2;

  const chip = new Container();
  chip.position.set(chipCX, chipCY);
  chip.scale.set(0);
  root.addChild(chip);

  // Soft shadow so the chip reads over any footage.
  const e = Math.round(chipH * 0.04);
  const off = Math.round(chipH * 0.06);
  chip.addChild(
    new Graphics()
      .roundRect(-chipW / 2 - e, -chipH / 2 - e + off, chipW + e * 2, chipH + e * 2, chipRadius + e)
      .fill({ color: "#000000", alpha: 0.16 }),
  );
  chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipRadius).fill(chipBg));

  // --- Condition glyph (toggleable) with an accent-tinted halo. ---
  let glyphNode: Container | undefined;
  let halo: Graphics | undefined;
  if (showGlyph) {
    const glyphCX = -chipW / 2 + padX + glyphBoxW / 2;
    halo = new Graphics().circle(0, 0, haloR).fill({ color: accent, alpha: 0.16 });
    halo.position.set(glyphCX, 0);
    halo.alpha = 0;
    chip.addChild(halo);

    glyphNode = weatherGlyph(cond, glyphSize);
    glyphNode.position.set(glyphCX, 0);
    glyphNode.alpha = 0;
    glyphNode.scale.set(0.6);
    chip.addChild(glyphNode);
  }

  const textX = -chipW / 2 + padX + glyphBoxW + gapGT;
  const tempY = city.length > 0 ? -textRowsH / 2 + tempSize / 2 : 0;
  const cityY = city.length > 0 ? textRowsH / 2 - citySize / 2 : 0;

  const tempText = makeText(fonts, {
    text: temp,
    role: "display",
    weight: 700,
    size: tempSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  tempText.position.set(textX, tempY);
  chip.addChild(tempText);

  if (city.length > 0) {
    const cityText = makeText(fonts, {
      text: city,
      role: "body",
      weight: 600,
      size: citySize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    cityText.alpha = 0.72;
    cityText.position.set(textX, cityY);
    chip.addChild(cityText);
  }

  // --- Entrance: the chip springs in, then the glyph settles a beat later. ---
  timeline
    .to(chip, { prop: "scale.x", from: 0, to: 1, start: 0.12, duration: 0.5, ease: spring(0.46) })
    .to(chip, { prop: "scale.y", from: 0, to: 1, start: 0.12, duration: 0.5, ease: spring(0.46) });
  if (glyphNode && halo) {
    timeline
      .to(halo, { prop: "alpha", from: 0, to: 1, start: 0.24, duration: 0.4, ease: outQuad })
      .to(glyphNode, { prop: "alpha", from: 0, to: 1, start: 0.28, duration: 0.35, ease: outQuad })
      .to(glyphNode, { prop: "scale.x", from: 0.6, to: 1, start: 0.28, duration: 0.5, ease: spring(0.4) })
      .to(glyphNode, { prop: "scale.y", from: 0.6, to: 1, start: 0.28, duration: 0.5, ease: spring(0.4) });
  }

  // --- Live feel: a gentle continuous bob on the glyph (pure fn of t). ---
  const BOB_START = 0.7;
  const bobAmp = minDim * 0.006;
  const update = (t: number): void => {
    if (!glyphNode) return;
    const tau = Math.max(0, t - BOB_START);
    glyphNode.position.y = Math.sin(tau * 2.1) * bobAmp;
  };

  return { timeline, duration: 4.0, update };
}

export const weatherBug: TemplateDefinition = {
  id: "weather-bug",
  name: "Weather Bug",
  tagline: "A corner weather bug pops in with a condition glyph, temp, and city.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { temp: "display", city: "body" },
  palettes: PALETTES,
  fields: [
    { key: "city", type: "text", label: "City", default: "New York", maxLength: 24, shrinkToFit: true },
    { key: "temp", type: "text", label: "Temperature", default: "72°", maxLength: 6, shrinkToFit: true },
    {
      key: "condition",
      type: "select",
      label: "Condition",
      default: "sun",
      options: [
        { value: "sun", label: "Sunny" },
        { value: "partly", label: "Partly cloudy" },
        { value: "cloud", label: "Cloudy" },
        { value: "rain", label: "Rainy" },
        { value: "storm", label: "Stormy" },
      ],
    },
    { key: "showGlyph", type: "toggle", label: "Condition glyph", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

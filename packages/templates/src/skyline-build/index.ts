import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

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

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const n = h.length >= 6 ? h.slice(0, 6) : h.padEnd(6, h.slice(-1) || "0");
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}

function mixHex(a: string, b: string, u: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  let out = "#";
  for (let i = 0; i < 3; i++) {
    const v = Math.round(ca[i]! + (cb[i]! - ca[i]!) * clamp01(u));
    out += v.toString(16).padStart(2, "0");
  }
  return out;
}

// `buildingColor` is the tower silhouette (its own key, so recoloring the frame
// background never flattens the skyline); `windowColor` is the lit-window warm.
const PALETTES: Palette[] = [
  { id: "dusk-indigo", name: "Dusk indigo", colors: { background: "#101830", buildingColor: "#1F2A46", windowColor: "#FFD79A", textColor: "#F2F5FB", accent: "#FF9A57" } },
  { id: "paper-city", name: "Paper city", colors: { background: "#F4F1EA", buildingColor: "#2A3140", windowColor: "#FFCE73", textColor: "#1A2030", accent: "#C7522F" } },
  { id: "mint-morning", name: "Mint morning", colors: { background: "#E9F3EF", buildingColor: "#14342A", windowColor: "#FFE39A", textColor: "#0E241C", accent: "#0E8A5C" } },
  { id: "blush-dusk", name: "Blush dusk", colors: { background: "#F7EBE6", buildingColor: "#3A2430", windowColor: "#FFCFA0", textColor: "#2A141E", accent: "#D2603F" } },
];

const BUILD_START = 0.4;
const BUILD_STAGGER = 0.075;
const BUILD_DUR = 1.0;
const WINDOW_START = 2.25;
const WINDOW_GROUPS = 9;
const WINDOW_STAGGER = 0.09;
const DURATION = 4.5;

const buildingCount = (aspect: Aspect): number => (aspect === "16:9" ? 11 : 8);

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#101830"));
  const buildingColor = str(values.buildingColor, pc("buildingColor", "#1F2A46"));
  const buildingAlt = mixHex(buildingColor, bg, 0.2);
  const windowColor = pc("windowColor", "#FFD79A");
  const textColor = str(values.textColor, pc("textColor", "#F2F5FB"));
  const accent = str(values.accent, pc("accent", "#FF9A57"));

  const city = str(values.city, "New York");
  const subtitle = str(values.subtitle, "40.7128° N · 74.0060° W");
  const showWindows = values.showWindows !== false;
  const showGlow = values.showGlow !== false;
  const showRule = values.showRule !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Layout: skyline block + text block, centered together ---
  const citySize = fitSize(fonts, city, "display", 700, Math.round(minDim * 0.075), zone.width * 0.86);
  const subSize = fitSize(fonts, subtitle, "body", 500, Math.round(minDim * 0.024), zone.width * 0.8);
  const textBlockH = citySize * 1.2 + minDim * 0.02 + subSize * 1.6;
  const gap = minDim * 0.05;
  const maxH = Math.min(zone.height * 0.42, minDim * 0.45);
  const topY = zone.y + (zone.height - (maxH + gap + textBlockH)) / 2;
  const baselineY = topY + maxH;
  const ruleY = baselineY + gap * 0.4;
  const cityY = baselineY + gap + citySize * 0.62;
  const subY = cityY + citySize * 0.62 + minDim * 0.02 + subSize * 0.6;

  // --- Soft accent haze behind the towers ---
  if (showGlow) {
    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.tint = accent;
    glow.width = glow.height = maxH * 3.4;
    glow.position.set(cx, baselineY - maxH * 0.22);
    glow.alpha = 0;
    root.addChild(glow);
    timeline.to(glow, { prop: "alpha", from: 0, to: 0.2, start: 0.25, duration: 1.3, ease: outQuad });
  }

  // --- Everything above the baseline is clipped, so towers rise out of it ---
  const clip = new Container();
  root.addChild(clip);
  const clipMask = new Graphics().rect(0, 0, w, baselineY).fill("#FFFFFF");
  clip.addChild(clipMask);
  clip.mask = clipMask;

  const count = buildingCount(ctx.aspect);
  const gapW = zone.width * 0.006;
  const weights: number[] = [];
  const specs: { hFrac: number; cap: number; alt: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const r = rng.fork(i + 3);
    weights.push(r.range(0.72, 1.35));
    const centerBias = 1 - Math.abs((i + 0.5) / count - 0.5) * 2;
    specs.push({
      hFrac: clamp01(0.32 + 0.68 * Math.pow(centerBias, 0.6) * r.range(0.7, 1)),
      cap: r.next(),
      alt: r.next() < 0.45,
    });
  }
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const unit = (zone.width - (count - 1) * gapW) / weightSum;

  // Windows are grouped into a handful of Graphics so they light in soft waves
  // rather than all at once — cheap, and every wave is a single tween.
  const windowGroups: Graphics[] = [];
  if (showWindows) {
    for (let g = 0; g < WINDOW_GROUPS; g++) {
      const gg = new Graphics();
      gg.alpha = 0;
      windowGroups.push(gg);
    }
  }

  let cursor = zone.x;
  for (let i = 0; i < count; i++) {
    const spec = specs[i]!;
    const bw = weights[i]! * unit;
    const bx = cursor + bw / 2;
    cursor += bw + gapW;
    const bh = maxH * spec.hFrac;
    const hasSpire = spec.cap > 0.78 && spec.hFrac > 0.68;
    const hasSetback = !hasSpire && spec.cap > 0.42;
    const bodyH = hasSpire ? bh * 0.82 : hasSetback ? bh * 0.86 : bh;
    const color = spec.alt ? buildingAlt : buildingColor;

    const tower = new Container();
    tower.position.set(bx, baselineY);
    clip.addChild(tower);

    const g = new Graphics().rect(-bw / 2, -bodyH, bw, bodyH).fill(color);
    if (hasSetback) g.rect(-bw * 0.3, -bh, bw * 0.6, bh - bodyH).fill(color);
    if (hasSpire) {
      const crownH = (bh - bodyH) * 0.42;
      const sw = Math.max(2, bw * 0.07);
      g.rect(-bw * 0.17, -bodyH - crownH, bw * 0.34, crownH).fill(color);
      g.rect(-sw / 2, -bh, sw, bh - bodyH - crownH).fill(color);
    }
    tower.addChild(g);

    timeline.to(tower, {
      prop: "y",
      from: baselineY + bh,
      to: baselineY,
      start: BUILD_START + i * BUILD_STAGGER,
      duration: BUILD_DUR,
      ease: outExpo,
    });

    if (showWindows) {
      const cols = Math.max(1, Math.floor(bw / (minDim * 0.038)));
      const rows = Math.max(1, Math.floor(bodyH / (minDim * 0.058)));
      const cellW = bw / cols;
      const cellH = bodyH / rows;
      const ww = cellW * 0.4;
      const wh = cellH * 0.32;
      const rw = rng.fork(i + 91);
      for (let c = 0; c < cols; c++) {
        for (let rr = 0; rr < rows; rr++) {
          if (rw.next() > 0.58) continue;
          const gx = bx - bw / 2 + (c + 0.5) * cellW - ww / 2;
          const gy = baselineY - bodyH + (rr + 0.5) * cellH - wh / 2;
          const group = windowGroups[rw.int(0, WINDOW_GROUPS - 1)];
          if (group) group.roundRect(gx, gy, ww, wh, Math.min(ww, wh) * 0.25).fill(windowColor);
        }
      }
    }
  }

  windowGroups.forEach((g, i) => {
    clip.addChild(g);
    timeline.to(g, { prop: "alpha", from: 0, to: 0.92, start: WINDOW_START + i * WINDOW_STAGGER, duration: 0.55, ease: outQuad });
  });

  // --- Hairline under the skyline ---
  if (showRule) {
    const rh = Math.max(1.5, minDim * 0.0022);
    const rule = new Graphics().rect(-zone.width / 2, -rh / 2, zone.width, rh).fill({ color: textColor, alpha: 0.32 });
    rule.position.set(cx, ruleY);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.12, duration: 0.95, ease: outExpo });
  }

  // --- City name + coordinates settle beneath ---
  const cityText = makeText(fonts, { text: city, role: "display", weight: 700, size: citySize, color: textColor, anchor: 0.5, align: "center" });
  cityText.position.set(cx, cityY);
  cityText.alpha = 0;
  root.addChild(cityText);
  timeline
    .to(cityText, { prop: "alpha", from: 0, to: 1, start: 2.55, duration: 0.5, ease: outQuad })
    .to(cityText, { prop: "y", from: cityY - 14, to: cityY, start: 2.55, duration: 0.65, ease: outQuint });

  const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
  subText.position.set(cx, subY);
  subText.alpha = 0;
  root.addChild(subText);
  timeline
    .to(subText, { prop: "alpha", from: 0, to: 0.7, start: 2.85, duration: 0.5, ease: outQuad })
    .to(subText, { prop: "y", from: subY - 9, to: subY, start: 2.85, duration: 0.6, ease: outQuint });

  return { timeline, duration: DURATION };
}

export const skylineBuild: TemplateDefinition = {
  id: "skyline-build",
  name: "Skyline",
  tagline: "A city skyline rises tower by tower, then the windows light and the name lands.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.2,
  fontRoles: { city: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "city", type: "text", label: "City", default: "New York", maxLength: 22, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subline", default: "40.7128° N · 74.0060° W", maxLength: 34, shrinkToFit: true },
    { key: "showWindows", type: "toggle", label: "Lit windows", default: true },
    { key: "showGlow", type: "toggle", label: "Accent haze", default: true },
    { key: "showRule", type: "toggle", label: "Hairline", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "buildingColor", type: "color", label: "Buildings", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

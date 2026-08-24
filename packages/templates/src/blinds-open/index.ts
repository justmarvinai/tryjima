import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
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

const PALETTES: Palette[] = [
  { id: "ink-orange", name: "Ink on orange", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "midnight-lime", name: "Midnight lime", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "cream-cobalt", name: "Cream cobalt", colors: { background: "#FAF5EA", textColor: "#3A1D6E", accent: "#2E7DF6" } },
  { id: "grape-frost", name: "Grape frost", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF" } },
];

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.084 : aspect === "9:16" ? 0.106 : 0.096;
}

/** Lighten a #rrggbb color toward white by `amt` (0..1) — the slat's sheen edge. */
function lighten(hex: string, amt: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const mix = (c: number): number => Math.round(c + (255 - c) * amt);
  return `#${[mix(r), mix(g), mix(b)].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const SLAT_COUNT = 9;
const EACH = 0.055;
const SLAT_DUR = 0.55;
const START_BASE = 0.12;
const DUR = 3.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFFFFF"));
  const textColor = str(values.textColor, pcol("textColor", "#101014"));
  const accent = str(values.accent, pcol("accent", "#FF4D1C"));
  const title = str(values.title, "Opening Soon");
  const tagline = str(values.tagline, "");
  const showSlatsAccent = on(values.showSlatsAccent);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const cy = h / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Content, sitting behind the slats from frame 0 ---
  const content = new Container();
  content.label = "content";
  content.position.set(cx, cy);
  root.addChild(content);

  const titleSize0 = Math.round(w * titleFrac(ctx.aspect));
  const maxWidth = w * (ctx.aspect === "16:9" ? 0.6 : 0.8);
  const titleSize = fitSize(fonts, title, "display", 700, titleSize0, maxWidth);
  const hasTagline = tagline.length > 0;
  const tagSize = Math.round(titleSize * 0.28);
  const titleY = hasTagline ? -tagSize * 0.9 : 0;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(0, titleY);
  content.addChild(titleText);

  if (hasTagline) {
    const tagText = makeText(fonts, {
      text: tagline,
      role: "body",
      weight: 500,
      size: tagSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: 1,
    });
    tagText.position.set(0, titleY + titleSize * 0.62 + tagSize * 0.9);
    content.addChild(tagText);
  }

  // --- Slats: full-width bands tiling the frame, rotating open (scaleY -> 0)
  // from the middle row outward, each pivoting about its own vertical center. ---
  const rowH = h / SLAT_COUNT;
  const centerIndex = (SLAT_COUNT - 1) / 2;
  let lastEnd = 0;
  for (let i = 0; i < SLAT_COUNT; i++) {
    const rowCenterY = i * rowH + rowH / 2;
    const slat = new Graphics().rect(0, -rowH / 2, w, rowH).fill(accent);
    if (showSlatsAccent) {
      const edgeH = Math.max(2, rowH * 0.14);
      slat.rect(0, -rowH / 2, w, edgeH).fill(lighten(accent, 0.4));
    }
    slat.position.set(0, rowCenterY);
    slat.label = `slat-${i}`;
    root.addChild(slat);

    const delay = Math.abs(i - centerIndex) * EACH;
    const start = START_BASE + delay;
    const end = start + SLAT_DUR;
    lastEnd = Math.max(lastEnd, end);
    timeline.to(slat, { prop: "scale.y", from: 1, to: 0, start, duration: SLAT_DUR, ease: outCubic });
  }

  // A tiny settle bump on the content once every slat has cleared.
  const settleStart = lastEnd + 0.03;
  timeline
    .to(content, { prop: "scale.x", from: 1, to: 1.045, start: settleStart, duration: 0.12, ease: outQuad })
    .to(content, { prop: "scale.x", from: 1.045, to: 1, start: settleStart + 0.12, duration: 0.2, ease: outQuad })
    .to(content, { prop: "scale.y", from: 1, to: 1.045, start: settleStart, duration: 0.12, ease: outQuad })
    .to(content, { prop: "scale.y", from: 1.045, to: 1, start: settleStart + 0.12, duration: 0.2, ease: outQuad });

  return { timeline, duration: DUR };
}

export const blindsOpen: TemplateDefinition = {
  id: "blinds-open",
  name: "Blinds Open",
  tagline: "Venetian blind slats rotate open from the middle to reveal your title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { title: "display", tagline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Opening Soon", maxLength: 28, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "", maxLength: 44, optional: true },
    { key: "showSlatsAccent", type: "toggle", label: "Slat edge accent", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Slat color", default: "", optional: true },
  ],
  build,
};

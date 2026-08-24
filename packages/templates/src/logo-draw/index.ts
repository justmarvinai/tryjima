import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  outCubic,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "navy-gold", name: "Navy + gold", colors: { background: "#0E1B33", textColor: "#FFFFFF", accent: "#E8B84B" } },
  { id: "forest-cream", name: "Forest + cream", colors: { background: "#F5F2E8", textColor: "#1D2A1E", accent: "#3E7A54" } },
  { id: "plum-blush", name: "Plum + blush", colors: { background: "#FBEEF4", textColor: "#3A1533", accent: "#B0407F" } },
];

/** Greedy-wrap into <= maxLines lines, then shrink so the widest line fits. */
function wrapAndFit(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family(role);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(16, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

/** Vertices of a regular hexagon (flat [x0,y0,...x5,y5]), one vertex at `rotationDeg`. */
function hexPoints(r: number, rotationDeg: number): number[] {
  const pts: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (rotationDeg + i * 60) * DEG;
    pts.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return pts;
}

/** The leading sub-path of a closed polygon's perimeter, up to `progress` (0..1) of its length. */
function partialClosedPolyline(pts: number[], progress: number): number[] {
  const n = Math.floor(pts.length / 2);
  if (n < 2) return [];
  const edgeLens: number[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const x0 = pts[i * 2]!;
    const y0 = pts[i * 2 + 1]!;
    const j = (i + 1) % n;
    const x1 = pts[j * 2]!;
    const y1 = pts[j * 2 + 1]!;
    const len = Math.hypot(x1 - x0, y1 - y0);
    edgeLens.push(len);
    total += len;
  }
  const target = clamp01(progress) * total;
  const out: number[] = [pts[0]!, pts[1]!];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const x0 = pts[i * 2]!;
    const y0 = pts[i * 2 + 1]!;
    const j = (i + 1) % n;
    const x1 = pts[j * 2]!;
    const y1 = pts[j * 2 + 1]!;
    const len = edgeLens[i]!;
    if (acc + len <= target) {
      out.push(x1, y1);
      acc += len;
      continue;
    }
    const remain = target - acc;
    const u = len > 0 ? remain / len : 0;
    out.push(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u);
    break;
  }
  return out;
}

function fontFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.075;
    case "9:16":
      return 0.11;
    case "4:5":
      return 0.095;
    case "1:1":
      return 0.1;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));

  const initialsRaw = str(values.initials, "YB");
  const initials = (initialsRaw.trim().slice(0, 2) || "YB").toUpperCase();
  const brand = str(values.brand, "Your Brand");
  const tagline = str(values.tagline, "Motion, made simple.");
  const frameShape = str(values.frameShape, "circle") === "hexagon" ? "hexagon" : "circle";
  const showFrame = on(values.showFrame);

  const W = size.width;
  const H = size.height;
  const minDim = Math.min(W, H);
  const cx = W / 2;
  const cy = H * 0.4;
  const DUR = 3.6;

  // --- Background (full-frame, first child so transparent export can blank it) ---
  const bgRect = new Graphics().rect(-W / 2, -H / 2, W, H).fill(bg);
  bgRect.position.set(W / 2, H / 2);
  bgRect.label = "bg";
  bgRect.scale.set(1.02);
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  timeline
    .to(bgRect, { prop: "scale.x", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(bgRect, { prop: "scale.y", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad });

  const R = minDim * 0.2;
  const strokeW = Math.max(4, R * 0.05);

  // --- The frame: an outline that "draws on" (redrawn per frame — geometry can't tween) ---
  const frameHolder = new Container();
  frameHolder.position.set(cx, cy);
  root.addChild(frameHolder);
  const ring = new Graphics();
  frameHolder.addChild(ring);

  const hexPts = frameShape === "hexagon" ? hexPoints(R, -90) : [];

  const DRAW_START = 0.15;
  const DRAW_DUR = 0.6;

  if (showFrame) {
    // Landing pulse once the outline finishes drawing.
    timeline
      .to(frameHolder, { prop: "scale.x", from: 1, to: 1.05, start: DRAW_START + DRAW_DUR, duration: 0.14, ease: outQuad })
      .to(frameHolder, { prop: "scale.x", from: 1.05, to: 1, start: DRAW_START + DRAW_DUR + 0.14, duration: 0.22, ease: outQuad })
      .to(frameHolder, { prop: "scale.y", from: 1, to: 1.05, start: DRAW_START + DRAW_DUR, duration: 0.14, ease: outQuad })
      .to(frameHolder, { prop: "scale.y", from: 1.05, to: 1, start: DRAW_START + DRAW_DUR + 0.14, duration: 0.22, ease: outQuad });
  }

  // --- Monogram letters (fade + scale in, independent of the frame's own scale) ---
  const letterCount = initials.length;
  const letterSize = Math.round(R * (letterCount >= 2 ? 0.68 : 0.85));
  const markHolder = new Container();
  markHolder.position.set(cx, cy);
  markHolder.alpha = 0;
  markHolder.scale.set(0.5);
  root.addChild(markHolder);
  const lettersText = makeText(fonts, {
    text: initials,
    role: "display",
    weight: 700,
    size: letterSize,
    color: textColor,
    anchor: 0.5,
    letterSpacing: Math.round(letterSize * 0.02),
  });
  markHolder.addChild(lettersText);

  const letterStart = showFrame ? DRAW_START + DRAW_DUR - 0.05 : 0.2;
  timeline
    .to(markHolder, { prop: "alpha", from: 0, to: 1, start: letterStart, duration: 0.4, ease: outQuad })
    .to(markHolder, { prop: "scale.x", from: 0.5, to: 1, start: letterStart, duration: 0.5, ease: makeOutBack(1.8) })
    .to(markHolder, { prop: "scale.y", from: 0.5, to: 1, start: letterStart, duration: 0.5, ease: makeOutBack(1.8) });

  // --- Wordmark ---
  const wordmarkSize0 = Math.round(W * fontFrac(ctx.aspect));
  const maxWidth = W * (ctx.aspect === "16:9" ? 0.56 : 0.78);
  const { lines, size: wordmarkSize } = wrapAndFit(fonts, brand, "display", 700, wordmarkSize0, maxWidth, 2);
  const wordmarkLH = Math.round(wordmarkSize * 1.06);
  const wordmarkText = makeText(fonts, {
    text: lines.join("\n"),
    role: "display",
    weight: 700,
    size: wordmarkSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    lineHeight: wordmarkLH,
  });
  const wordmarkY = cy + R * 1.7;
  const wordmarkYFrom = wordmarkY + 16;
  wordmarkText.position.set(cx, wordmarkYFrom);
  wordmarkText.alpha = 0;
  root.addChild(wordmarkText);

  const wordmarkStart = letterStart + 0.45;
  timeline
    .to(wordmarkText, { prop: "alpha", from: 0, to: 1, start: wordmarkStart, duration: 0.45, ease: outQuad })
    .to(wordmarkText, { prop: "y", from: wordmarkYFrom, to: wordmarkY, start: wordmarkStart, duration: 0.5, ease: outQuint });

  // --- Tagline ---
  if (tagline.length > 0) {
    const tagMaxWidth = W * 0.86;
    let tagSize = Math.round(wordmarkSize * 0.28);
    const tagFamily = fonts.family("body");
    const tagWidth0 = fonts.measure(tagline, { family: tagFamily, weight: 500, size: tagSize, letterSpacing: 1 });
    if (tagWidth0 > tagMaxWidth) tagSize = Math.max(10, Math.floor(tagSize * (tagMaxWidth / tagWidth0)));
    const tagY = wordmarkY + (lines.length * wordmarkLH) / 2 + tagSize * 1.3;
    const tagYFrom = tagY + 12;
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
    tagText.position.set(cx, tagYFrom);
    tagText.alpha = 0;
    root.addChild(tagText);
    const tagStart = wordmarkStart + 0.35;
    timeline
      .to(tagText, { prop: "alpha", from: 0, to: 0.85, start: tagStart, duration: 0.45, ease: outQuad })
      .to(tagText, { prop: "y", from: tagYFrom, to: tagY, start: tagStart, duration: 0.5, ease: outQuint });
  }

  const update = (t: number): void => {
    if (!showFrame) return;
    const p = clamp01((t - DRAW_START) / DRAW_DUR);
    const eased = outCubic(p);
    ring.clear();
    if (eased <= 0.0015) return;
    if (frameShape === "hexagon") {
      const poly = partialClosedPolyline(hexPts, eased);
      if (poly.length >= 4) {
        ring.poly(poly, false).stroke({ color: accent, width: strokeW, cap: "round", join: "round" });
      }
    } else {
      const angle = -Math.PI / 2 + eased * Math.PI * 2;
      ring.arc(0, 0, R, -Math.PI / 2, angle).stroke({ color: accent, width: strokeW, cap: "round" });
    }
  };

  return { timeline, duration: DUR, update };
}

export const logoDraw: TemplateDefinition = {
  id: "logo-draw",
  name: "Logo Draw",
  tagline: "A monogram frame draws itself on, then the mark locks in.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.5,
  fontRoles: { initials: "display", brand: "display", tagline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "initials", type: "text", label: "Initials", default: "YB", maxLength: 3 },
    { key: "brand", type: "text", label: "Brand", default: "Your Brand", maxLength: 24, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "Motion, made simple.", maxLength: 40, optional: true },
    {
      key: "frameShape",
      type: "select",
      label: "Frame shape",
      default: "circle",
      options: [
        { value: "circle", label: "Circle" },
        { value: "hexagon", label: "Hexagon" },
      ],
    },
    { key: "showFrame", type: "toggle", label: "Draw-on frame", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

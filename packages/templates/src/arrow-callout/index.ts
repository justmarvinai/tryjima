import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outCubic,
  outQuad,
  spring,
  safeRect,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

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

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

// A hand-drawn annotation for footage: a marker ellipse scribbles itself around
// a fully transparent focus area (your subject shows through), then a wobbly
// curved arrow draws over to a label chip that pops in. Seeded rng offsets give
// every stroke a freehand jitter while staying deterministic. Unlike qr-callout
// / stat-callout (rigid card callouts), this is a loose marker scribble meant
// to sit on top of video. Only the full-frame `bg` rect is tied to the
// background field (defaults to the transparent sentinel); the label chip uses
// its own palette-only `chipBg` (with a soft shadow) so it reads over footage.
const PALETTES: Palette[] = [
  { id: "marker-red", name: "Marker red", colors: { accent: "#E5484D", chipBg: "#FFFFFF", textColor: "#0B0B0F" } },
  { id: "chalk", name: "Chalk", colors: { accent: "#FFFFFF", chipBg: "#17171C", textColor: "#FFFFFF" } },
  { id: "royal", name: "Royal", colors: { accent: "#1D4ED8", chipBg: "#FFFFFF", textColor: "#0B0B0F" } },
  { id: "lime-pop", name: "Lime pop", colors: { accent: "#A3E635", chipBg: "#101014", textColor: "#F4FFE0" } },
];

// Beat sheet (seconds): scribble draws, arrow draws, head + chip + ticks pop.
const SCRIB_S = 0.25;
const SCRIB_D = 1.05;
const ARROW_S = 1.4;
const ARROW_D = 0.5;
const HEAD_T = 1.88;
const CHIP_T = 1.95;
const TICK_T = 2.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const chipBg = pc("chipBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0B0B0F"));
  const accent = str(values.accent, pc("accent", "#E5484D"));

  const label = str(values.label, "Right here");
  const showTicks = values.showTicks !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const rect = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Focus ellipse (kept transparent inside) + chip placement. ---
  const minSafe = Math.min(rect.width, rect.height);
  const FPx = rect.x + rect.width * 0.34;
  const FPy = rect.y + rect.height * 0.36;
  const Rx = minSafe * 0.185;
  const Ry = Rx * 0.78;
  const strokeW = Math.max(6, Math.round(minDim * 0.0115));

  const textSize = fitSize(fonts, label, "display", 700, Math.round(minDim * 0.03), rect.width * 0.42);
  const textW = fonts.measure(label, { family: fonts.family("display"), weight: 700, size: textSize });
  const padX = Math.round(minDim * 0.022);
  const padY = Math.round(minDim * 0.016);
  const chipW = Math.round(textW + padX * 2);
  const chipH = Math.round(textSize + padY * 2);
  const chipCX = Math.min(rect.x + rect.width * 0.7, rect.x + rect.width - chipW / 2);
  const chipCY = rect.y + rect.height * 0.74;

  // --- Freehand scribble path (seeded wobble, precomputed at build). ---
  const phi1 = rng.range(0, Math.PI * 2);
  const phi2 = rng.range(0, Math.PI * 2);
  const amp1 = rng.range(0.03, 0.05);
  const amp2 = rng.range(0.02, 0.04);
  const theta0 = rng.range(-0.9, -0.3);
  const N = 72;
  const loops = 1.16;
  const scribPts: number[] = [];
  for (let i = 0; i <= N; i++) {
    const th = theta0 + (i / N) * Math.PI * 2 * loops;
    const wob = 1 + amp1 * Math.sin(2 * th + phi1) + amp2 * Math.sin(3 * th + phi2) + rng.range(-0.009, 0.009);
    scribPts.push(FPx + Math.cos(th) * Rx * wob, FPy + Math.sin(th) * Ry * wob);
  }

  // --- Curved arrow path from the scribble's edge to just above the chip. ---
  const Bx = chipCX - chipW * 0.3;
  const By = chipCY - chipH / 2 - minDim * 0.032;
  const alpha = Math.atan2(chipCY - FPy, chipCX - FPx);
  const Ax = FPx + Math.cos(alpha) * Rx * 1.14;
  const Ay = FPy + Math.sin(alpha) * Ry * 1.14;
  const dx = Bx - Ax;
  const dy = By - Ay;
  const dist = Math.hypot(dx, dy) || 1;
  let nx = -dy / dist;
  let ny = dx / dist;
  if (ny > 0) {
    nx = -nx;
    ny = -ny; // always bow the arrow upward, away from the chip
  }
  const Cx = (Ax + Bx) / 2 + nx * dist * 0.24;
  const Cy = (Ay + By) / 2 + ny * dist * 0.24;
  const phi3 = rng.range(0, Math.PI * 2);
  const M = 44;
  const arrowPts: number[] = [];
  for (let i = 0; i <= M; i++) {
    const u = i / M;
    const iu = 1 - u;
    const px = iu * iu * Ax + 2 * iu * u * Cx + u * u * Bx;
    const py = iu * iu * Ay + 2 * iu * u * Cy + u * u * By;
    const off = Math.sin(u * 3.2 + phi3) * minDim * 0.0035 + rng.range(-1, 1) * minDim * 0.0012;
    arrowPts.push(px + nx * off, py + ny * off);
  }
  const headAng = Math.atan2(
    arrowPts[M * 2 + 1]! - arrowPts[(M - 1) * 2 + 1]!,
    arrowPts[M * 2]! - arrowPts[(M - 1) * 2]!,
  );

  // --- Stroke layers (revealed by update), arrowhead, ticks, chip. ---
  const scribbleG = new Graphics();
  root.addChild(scribbleG);
  const arrowG = new Graphics();
  root.addChild(arrowG);

  const headC = new Container();
  headC.position.set(Bx, By);
  headC.rotation = headAng;
  headC.alpha = 0;
  headC.scale.set(0.5);
  const hl = minDim * 0.03;
  headC.addChild(
    new Graphics()
      .moveTo(-hl, -hl * 0.55)
      .lineTo(0, 0)
      .lineTo(-hl, hl * 0.55)
      .stroke({ color: accent, width: strokeW, cap: "round", join: "round" }),
  );
  root.addChild(headC);
  timeline
    .to(headC, { prop: "alpha", from: 0, to: 1, start: HEAD_T, duration: 0.12, ease: outQuad })
    .to(headC, { prop: "scale.x", from: 0.5, to: 1, start: HEAD_T, duration: 0.3, ease: makeOutBack(2.0) })
    .to(headC, { prop: "scale.y", from: 0.5, to: 1, start: HEAD_T, duration: 0.3, ease: makeOutBack(2.0) });

  if (showTicks) {
    const t0x = FPx + Math.cos(-0.85) * Rx * 1.33;
    const t0y = FPy + Math.sin(-0.85) * Ry * 1.33;
    const tickC = new Container();
    tickC.position.set(t0x, t0y);
    tickC.alpha = 0;
    tickC.scale.set(0.4);
    const tg = new Graphics();
    for (const a of [-0.55, -0.85, -1.15]) {
      tg.moveTo(FPx + Math.cos(a) * Rx * 1.26 - t0x, FPy + Math.sin(a) * Ry * 1.26 - t0y).lineTo(
        FPx + Math.cos(a) * Rx * 1.46 - t0x,
        FPy + Math.sin(a) * Ry * 1.46 - t0y,
      );
    }
    tg.stroke({ color: accent, width: strokeW * 0.8, cap: "round" });
    tickC.addChild(tg);
    root.addChild(tickC);
    timeline
      .to(tickC, { prop: "alpha", from: 0, to: 1, start: TICK_T, duration: 0.25, ease: outQuad })
      .to(tickC, { prop: "scale.x", from: 0.4, to: 1, start: TICK_T, duration: 0.4, ease: makeOutBack(2.2) })
      .to(tickC, { prop: "scale.y", from: 0.4, to: 1, start: TICK_T, duration: 0.4, ease: makeOutBack(2.2) });
  }

  const chip = new Container();
  chip.position.set(chipCX, chipCY);
  chip.scale.set(0);
  root.addChild(chip);
  const e = Math.round(chipH * 0.05);
  const off = Math.round(chipH * 0.08);
  const chipR = Math.round(chipH * 0.32);
  chip.addChild(
    new Graphics()
      .roundRect(-chipW / 2 - e, -chipH / 2 - e + off, chipW + e * 2, chipH + e * 2, chipR + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipR).fill(chipBg));
  chip.addChild(makeText(fonts, { text: label, role: "display", weight: 700, size: textSize, color: textColor, anchor: 0.5 }));
  timeline
    .to(chip, { prop: "scale.x", from: 0, to: 1, start: CHIP_T, duration: 0.55, ease: spring(0.45) })
    .to(chip, { prop: "scale.y", from: 0, to: 1, start: CHIP_T, duration: 0.55, ease: spring(0.45) });

  // --- Draw-on reveal: stroke a prefix of a precomputed polyline (pure of t). ---
  const drawPrefix = (g: Graphics, pts: number[], u: number, width: number): void => {
    g.clear();
    if (u <= 0) return;
    const segs = pts.length / 2 - 1;
    const f = u * segs;
    const k = Math.floor(f);
    const frac = f - k;
    g.moveTo(pts[0]!, pts[1]!);
    for (let i = 1; i <= k && i <= segs; i++) g.lineTo(pts[i * 2]!, pts[i * 2 + 1]!);
    if (k < segs) {
      const x0 = pts[k * 2]!;
      const y0 = pts[k * 2 + 1]!;
      const x1 = pts[(k + 1) * 2]!;
      const y1 = pts[(k + 1) * 2 + 1]!;
      g.lineTo(x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac);
    }
    g.stroke({ color: accent, width, cap: "round", join: "round" });
  };

  const update = (t: number): void => {
    drawPrefix(scribbleG, scribPts, outCubic(clamp01((t - SCRIB_S) / SCRIB_D)), strokeW);
    drawPrefix(arrowG, arrowPts, outCubic(clamp01((t - ARROW_S) / ARROW_D)), strokeW * 0.9);
  };

  return { timeline, duration: 4.0, update };
}

export const arrowCallout: TemplateDefinition = {
  id: "arrow-callout",
  name: "Arrow Callout",
  tagline: "A marker circle scribbles around your subject and an arrow points it out.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { label: "display" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Right here", maxLength: 24, shrinkToFit: true },
    { key: "showTicks", type: "toggle", label: "Emphasis ticks", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Marker", default: "", optional: true },
  ],
  build,
};

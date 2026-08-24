import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutCubic,
  inQuad,
  linear,
  outQuad,
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

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

interface Pt {
  x: number;
  y: number;
}

/**
 * Clip a convex polygon against the diagonal half-plane x + y <= limit
 * (keepBelow=true) or x + y >= limit (keepBelow=false). Sutherland–Hodgman.
 */
function clipDiag(poly: readonly Pt[], limit: number, keepBelow: boolean): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!;
    const b = poly[(i + 1) % poly.length]!;
    const da = keepBelow ? limit - (a.x + a.y) : a.x + a.y - limit;
    const db = keepBelow ? limit - (b.x + b.y) : b.x + b.y - limit;
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const u = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
    }
  }
  return out;
}

function flat(poly: readonly Pt[]): number[] {
  const out: number[] = [];
  for (const p of poly) out.push(p.x, p.y);
  return out;
}

/** Endpoints of the segment where the line x + y = k crosses the w x h rect. */
function diagEnds(k: number, w: number, h: number): [Pt, Pt] {
  const a: Pt = k <= w ? { x: k, y: 0 } : { x: w, y: k - w };
  const b: Pt = k <= h ? { x: 0, y: k } : { x: k - h, y: h };
  return [a, b];
}

// A paper page covers the frame, then peels away from the bottom-right corner:
// a white curled-back strip travels along the moving diagonal edge with a soft
// shadow cast ahead of it, revealing the title beneath. The page itself stays
// paper-light in every palette; the end frame is title-on-background (>= 4.5:1).
const PALETTES: Palette[] = [
  { id: "notebook", name: "Notebook", colors: { background: "#F4EFE6", textColor: "#262016", accent: "#D96A45", paper: "#FFFDF7" } },
  { id: "blueprint", name: "Blueprint", colors: { background: "#E9F0F8", textColor: "#122A44", accent: "#2E6FD8", paper: "#FBFDFF" } },
  { id: "botanical", name: "Botanical", colors: { background: "#EDF5EC", textColor: "#1C2E1F", accent: "#3F8E56", paper: "#FBFFF8" } },
  { id: "ink-night", name: "Ink night", colors: { background: "#191621", textColor: "#F6F2E9", accent: "#E8B84B", paper: "#F4EFE2" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.075 : aspect === "9:16" ? 0.1 : 0.09;
}

const PEEL_START = 0.35;
const PEEL_DUR = 1.5;
const P0 = 0.05; // initial dog-ear fold at the corner
const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4EFE6"));
  const textColor = str(values.textColor, pc("textColor", "#262016"));
  const accent = str(values.accent, pc("accent", "#D96A45"));
  const paper = str(values.paperColor, pc("paper", "#FFFDF7"));
  const title = str(values.title, "Chapter One");
  const subtitle = str(values.subtitle, "a fresh page");
  const showLines = on(values.showLines);
  const showFlutter = on(values.showFlutter);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const centerY = zone.y + zone.height * 0.46;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Title lockup (beneath the page, revealed by the peel) ---
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.6 : 0.84);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW);
  const hasSub = subtitle.length > 0;
  const ruleH = Math.max(4, Math.round(minDim * 0.006));
  const gap1 = titleSize * 0.3;
  const subSize = Math.round(titleSize * 0.28);
  const gap2 = subSize * 0.85;
  const totalH = titleSize + gap1 + ruleH + (hasSub ? gap2 + subSize : 0);
  const top = centerY - totalH / 2;

  const titleY = top + titleSize / 2;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.95, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 16, to: titleY, start: 0.95, duration: 0.5, ease: outQuint });

  const ruleY = top + titleSize + gap1 + ruleH / 2;
  const ruleW = minDim * 0.1;
  const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
  rule.position.set(cx, ruleY);
  rule.scale.set(0, 1);
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 1.25, duration: 0.4, ease: outQuint });

  if (hasSub) {
    const subY = top + totalH - subSize / 2;
    const subText = makeText(fonts, { text: subtitle, role: "body", weight: 500, size: subSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
    subText.position.set(cx, subY);
    subText.alpha = 0;
    root.addChild(subText);
    timeline
      .to(subText, { prop: "alpha", from: 0, to: 0.82, start: 1.5, duration: 0.4, ease: outQuad })
      .to(subText, { prop: "y", from: subY + 12, to: subY, start: 1.5, duration: 0.45, ease: outQuint });
  }

  // --- The peeling page (drawn per-frame; progress driven by the timeline) ---
  const peel = { p: P0 };
  timeline.to(peel, { prop: "p", from: P0, to: 1, start: PEEL_START, duration: PEEL_DUR, ease: inOutCubic });

  const peelG = new Graphics();
  root.addChild(peelG);

  const curlW = minDim * 0.055;
  const shW = minDim * 0.09;
  const fMax = w + h + curlW + shW + 4;
  const rectPoly: Pt[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const lineGapY = minDim * 0.085;
  const marginX = Math.round(w * 0.085);

  const update = (t: number): void => {
    peelG.clear();
    const front = peel.p * fMax;
    const c = w + h - front;
    if (c <= -(curlW + shW)) return; // page fully turned away

    // Small flutter on the curl width while the page is mid-turn.
    const mid = peel.p > P0 + 0.01 && peel.p < 0.97;
    const cw = curlW * (mid ? 1 + 0.12 * Math.sin(t * 21) : 1);

    // Soft shadow cast ahead of the curl onto the revealed content.
    const sh1 = clipDiag(clipDiag(rectPoly, c + cw + shW, true), c + cw, false);
    if (sh1.length >= 3) peelG.poly(flat(sh1)).fill({ color: "#000000", alpha: 0.08 });
    const sh2 = clipDiag(clipDiag(rectPoly, c + cw + shW * 0.45, true), c + cw, false);
    if (sh2.length >= 3) peelG.poly(flat(sh2)).fill({ color: "#000000", alpha: 0.1 });

    // The curled-back strip (page underside) riding the moving edge.
    const curl = clipDiag(clipDiag(rectPoly, c + cw, true), c, false);
    if (curl.length >= 3) {
      peelG.poly(flat(curl)).fill("#FFFFFF");
      const crease = clipDiag(clipDiag(rectPoly, c + cw * 0.4, true), c, false);
      if (crease.length >= 3) peelG.poly(flat(crease)).fill({ color: "#000000", alpha: 0.07 });
      if (c + cw > 0 && c + cw < w + h) {
        const [eA, eB] = diagEnds(c + cw, w, h);
        peelG.moveTo(eA.x, eA.y).lineTo(eB.x, eB.y).stroke({ color: "#000000", alpha: 0.14, width: 2 });
      }
    }

    // The page itself (still covering the region toward the top-left).
    const cover = clipDiag(rectPoly, c, true);
    if (cover.length >= 3) {
      peelG.poly(flat(cover)).fill(paper);
      if (c > 0 && c < w + h) {
        const [eA, eB] = diagEnds(c, w, h);
        peelG.moveTo(eA.x, eA.y).lineTo(eB.x, eB.y).stroke({ color: "#000000", alpha: 0.1, width: 2 });
      }
      if (showLines) {
        for (let y = lineGapY * 1.6; y < h; y += lineGapY) {
          const xEnd = Math.min(w, c - y);
          if (xEnd <= marginX * 0.35) continue;
          peelG.moveTo(0, y).lineTo(xEnd, y).stroke({ color: "#8FB3D9", alpha: 0.55, width: 2 });
        }
        const yEnd = Math.min(h, c - marginX);
        if (yEnd > 0) peelG.moveTo(marginX, 0).lineTo(marginX, yEnd).stroke({ color: accent, alpha: 0.45, width: 2.5 });
      }
    }
  };

  // --- Paper-flutter scraps shed along the turning edge (decorative) ---
  if (showFlutter) {
    for (let i = 0; i < 6; i++) {
      const rt = PEEL_START + PEEL_DUR * rng.range(0.3, 0.78);
      const pAt = P0 + (1 - P0) * inOutCubic((rt - PEEL_START) / PEEL_DUR);
      const k = w + h - pAt * fMax + curlW * 0.5;
      if (k <= 8 || k >= w + h - 8) continue;
      const [eA, eB] = diagEnds(k, w, h);
      const m = rng.range(0.18, 0.82);
      const sx = eA.x + (eB.x - eA.x) * m;
      const sy = eA.y + (eB.y - eA.y) * m;
      const s1 = rng.range(10, 22);
      const s2 = s1 * rng.range(0.5, 0.9);
      const scrap = new Graphics().roundRect(-s1 / 2, -s2 / 2, s1, s2, 2).fill(paper);
      scrap.position.set(sx, sy);
      const rot0 = rng.range(-0.8, 0.8);
      scrap.rotation = rot0;
      scrap.alpha = 0;
      root.addChild(scrap);
      const durS = rng.range(0.7, 1.0);
      timeline
        .to(scrap, { prop: "alpha", from: 0, to: 0.9, start: rt, duration: 0.12, ease: outQuad })
        .to(scrap, { prop: "alpha", from: 0.9, to: 0, start: rt + durS - 0.3, duration: 0.3, ease: outQuad })
        .to(scrap, { prop: "x", from: sx, to: sx + rng.range(50, 150), start: rt, duration: durS, ease: outQuad })
        .to(scrap, { prop: "y", from: sy, to: sy + rng.range(140, 300), start: rt, duration: durS, ease: inQuad })
        .to(scrap, { prop: "rotation", from: rot0, to: rot0 + rng.range(-2.4, 2.4), start: rt, duration: durS, ease: linear });
    }
  }

  return { timeline, duration: DURATION, update };
}

export const pageTurn: TemplateDefinition = {
  id: "page-turn",
  name: "Page Turn",
  tagline: "A paper page peels away from the corner to reveal your title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Chapter One", maxLength: 26, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "a fresh page", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showLines", type: "toggle", label: "Ruled lines", default: true },
    { key: "showFlutter", type: "toggle", label: "Paper flutter", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "paperColor", type: "color", label: "Page", default: "", optional: true },
  ],
  build,
};

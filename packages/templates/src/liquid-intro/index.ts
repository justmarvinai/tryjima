import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inOutCubic,
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
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const smooth = (u: number): number => u * u * (3 - 2 * u);

/**
 * Largest size <= size at which `text` fits maxWidth on one line. `tracking` is
 * letter-spacing as a fraction of the font size, so the shrink stays exact.
 */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  tracking = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    letterSpacing: size * tracking,
  });
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

const TITLE_TRACK = -0.012;
const SUB_TRACK = 0.1;

// An organic shape flows and folds, then settles into the calm rounded panel the
// title sits on. Text always lands on the blob colour, so contrast is fixed.
const PALETTES: Palette[] = [
  { id: "mist", name: "Mist", colors: { background: "#FFFFFF", blobColor: "#DBE7F8", textColor: "#10203A", accent: "#2E6BF0" } },
  { id: "sand", name: "Sand", colors: { background: "#FFFCF7", blobColor: "#F0DEC6", textColor: "#2B1B0C", accent: "#B35F1E" } },
  { id: "mint", name: "Mint", colors: { background: "#FFFFFF", blobColor: "#D9ECE1", textColor: "#0F2A1E", accent: "#137A59" } },
  { id: "ink", name: "Ink", colors: { background: "#07080B", blobColor: "#1B212B", textColor: "#F4F6FA", accent: "#8FE3C2" } },
];

function titleFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.072 : aspect === "9:16" ? 0.094 : 0.086;
}

interface Wave {
  /** Integer so the deformation closes exactly at theta = 2*PI. */
  freq: number;
  amp: number;
  phase: number;
  speed: number;
}

/**
 * Distance from the centre to a superellipse boundary at `theta`.
 * n = 2 is an ellipse; n ≈ 4 is the calm rounded panel we settle into.
 */
function superRadius(theta: number, a: number, b: number, n: number): number {
  const c = Math.abs(Math.cos(theta)) / a;
  const s = Math.abs(Math.sin(theta)) / b;
  return Math.pow(Math.pow(c, n) + Math.pow(s, n), -1 / n);
}

const SAMPLES = 72;

/** Redraw one closed, C1-continuous curve through the sampled boundary points. */
function drawBlob(
  g: Graphics,
  waves: readonly Wave[],
  t: number,
  damp: number,
  a: number,
  b: number,
  n: number,
  color: string,
  alpha: number,
): void {
  const xs = new Array<number>(SAMPLES);
  const ys = new Array<number>(SAMPLES);
  for (let i = 0; i < SAMPLES; i++) {
    const th = (i / SAMPLES) * Math.PI * 2;
    let k = 1;
    for (const wv of waves) {
      k += wv.amp * damp * Math.sin(wv.freq * th + wv.phase + t * wv.speed);
    }
    const r = superRadius(th, a, b, n) * k;
    xs[i] = Math.cos(th) * r;
    ys[i] = Math.sin(th) * r;
  }
  const midX = (i: number): number => ((xs[i] ?? 0) + (xs[(i + 1) % SAMPLES] ?? 0)) / 2;
  const midY = (i: number): number => ((ys[i] ?? 0) + (ys[(i + 1) % SAMPLES] ?? 0)) / 2;
  g.moveTo(midX(SAMPLES - 1), midY(SAMPLES - 1));
  for (let i = 0; i < SAMPLES; i++) {
    g.quadraticCurveTo(xs[i] ?? 0, ys[i] ?? 0, midX(i), midY(i));
  }
  g.closePath().fill({ color, alpha });
}

const MORPH_START = 0.35;
const MORPH_DUR = 1.5;
const CALM_START = 0.45;
const CALM_END = 2.7;
const TITLE_START = 1.72;
const DURATION = 4.8;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const blobColor = str(values.blobColor, pc("blobColor", "#DBE7F8"));
  const textColor = str(values.textColor, pc("textColor", "#10203A"));
  const accent = str(values.accent, pc("accent", "#2E6BF0"));
  const title = str(values.title, "Liquid");
  // Optional: an empty string from the Studio must stay empty, not fall back.
  const subtitle = str(values.subtitle, "");
  const showEcho = on(values.showEcho);
  const showRule = on(values.showRule);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);
  const cy = zone.y + zone.height * 0.5;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Type block first: the settled blob is sized generously around it -----
  const maxW = zone.width * (ctx.aspect === "16:9" ? 0.54 : 0.68);
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(w * titleFrac(ctx.aspect)), maxW, TITLE_TRACK);
  const hasSub = subtitle.length > 0;
  const subSize = fitSize(fonts, subtitle, "body", 500, Math.round(titleSize * 0.27), maxW * 0.92, SUB_TRACK);
  const ruleH = Math.max(2, minDim * 0.0045);
  // Clears the descenders of the centred title box (~0.6em below its centre).
  const ruleGap = titleSize * 0.44;
  const subGap = subSize * 0.95;
  const blockH = titleSize + (showRule ? ruleGap + ruleH : 0) + (hasSub ? subGap + subSize : 0);

  const titleW = fonts.measure(title, {
    family: fonts.family("display"),
    weight: 700,
    size: titleSize,
    letterSpacing: titleSize * TITLE_TRACK,
  });
  const subW = hasSub
    ? fonts.measure(subtitle, {
        family: fonts.family("body"),
        weight: 500,
        size: subSize,
        letterSpacing: subSize * SUB_TRACK,
      })
    : 0;

  // The padding also absorbs the last of the wobble, so the type never touches
  // the moving edge once it has faded up.
  const padX = minDim * 0.135;
  const padY = minDim * 0.12;
  const halfA = Math.min(
    zone.width * 0.5,
    Math.max(minDim * 0.3, Math.max(titleW, subW) / 2 + padX),
  );
  const halfB = Math.min(zone.height * 0.46, Math.max(minDim * 0.21, blockH / 2 + padY));
  const startR = Math.min(halfA, halfB) * 0.95;

  // --- The blob(s) ---------------------------------------------------------
  const blobC = new Container();
  blobC.label = "blob";
  blobC.position.set(cx, cy);
  blobC.scale.set(0.32);
  blobC.alpha = 0;
  root.addChild(blobC);

  const makeWaves = (salt: number, scale: number): Wave[] =>
    [2, 3, 5].map((freq, i) => {
      const r = rng.fork(salt + i);
      return {
        freq,
        amp: r.range(0.065, 0.105) * scale * (1 - i * 0.2),
        phase: r.range(0, Math.PI * 2),
        speed: r.range(0.5, 1.05) * (i % 2 === 0 ? 1 : -1),
      };
    });

  // The echo is offset rather than inflated, so it peeks out on one side like a
  // duotone misprint instead of ringing the whole shape.
  const echoG = new Graphics();
  const echoWaves = makeWaves(11, 1.15);
  if (showEcho) {
    echoG.position.set(minDim * 0.055, -minDim * 0.05);
    blobC.addChild(echoG);
  }

  const blobG = new Graphics();
  const blobWaves = makeWaves(3, 1);
  blobC.addChild(blobG);

  timeline
    .to(blobC, { prop: "alpha", from: 0, to: 1, start: 0.12, duration: 0.7, ease: outQuad })
    .to(blobC, { prop: "scale.x", from: 0.32, to: 1, start: 0.12, duration: 1.45, ease: inOutCubic })
    .to(blobC, { prop: "scale.y", from: 0.32, to: 1, start: 0.12, duration: 1.45, ease: inOutCubic });

  // --- Type on the settled shape ------------------------------------------
  let cursor = cy - blockH / 2;
  const titleY = cursor + titleSize / 2;
  cursor += titleSize;

  const titleText = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    letterSpacing: titleSize * TITLE_TRACK,
  });
  titleText.position.set(cx, titleY + minDim * 0.014);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: TITLE_START, duration: 0.62, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + minDim * 0.014, to: titleY, start: TITLE_START, duration: 0.9, ease: outQuint });

  if (showRule) {
    const ruleW = Math.min(halfA * 0.9, minDim * 0.11);
    const ruleY = cursor + ruleGap + ruleH / 2;
    cursor += ruleGap + ruleH;
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(cx, ruleY);
    rule.scale.x = 0;
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: TITLE_START + 0.53, duration: 0.7, ease: outQuint });
  }

  if (hasSub) {
    const subY = cursor + subGap + subSize / 2;
    const s = makeText(fonts, {
      text: subtitle,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: subSize * SUB_TRACK,
    });
    s.position.set(cx, subY + minDim * 0.01);
    s.alpha = 0;
    root.addChild(s);
    const subStart = TITLE_START + 0.32;
    timeline
      .to(s, { prop: "alpha", from: 0, to: 0.84, start: subStart, duration: 0.6, ease: outQuad })
      .to(s, { prop: "y", from: subY + minDim * 0.01, to: subY, start: subStart, duration: 0.8, ease: outQuint });
  }

  // --- Pure per-frame shape: morph from wobbling circle to calm panel ------
  const update = (t: number): void => {
    const m = smooth(clamp01((t - MORPH_START) / MORPH_DUR));
    const damp = 1 - smooth(clamp01((t - CALM_START) / (CALM_END - CALM_START)));
    const a = startR + (halfA - startR) * m;
    const b = startR + (halfB - startR) * m;
    const n = 2 + 2.2 * m;

    if (showEcho) {
      echoG.clear();
      drawBlob(echoG, echoWaves, t, damp, a * 0.98, b * 0.98, n, accent, 0.22);
    }
    blobG.clear();
    drawBlob(blobG, blobWaves, t, damp, a, b, n, blobColor, 1);
  };

  return { timeline, duration: DURATION, update };
}

export const liquidIntro: TemplateDefinition = {
  id: "liquid-intro",
  name: "Liquid",
  tagline: "An organic shape flows and settles into the calm panel behind your title.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.8,
  fontRoles: { title: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Liquid", maxLength: 24, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "slow and easy", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showEcho", type: "toggle", label: "Accent echo", default: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "blobColor", type: "color", label: "Shape", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

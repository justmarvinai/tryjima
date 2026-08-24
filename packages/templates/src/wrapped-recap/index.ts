import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outExpo,
  outQuint,
  spring,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makePill } from "../shared/ui";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size: size0,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

// block1–3 / onBlock are palette-only roles: each stat's full-bleed color band
// keeps >=4.5:1 with the single onBlock ink, whatever bg/text/accent become.
const PALETTES: Palette[] = [
  { id: "poster-cream", name: "Poster cream", colors: { background: "#FFF6E9", textColor: "#201305", accent: "#C42A52", onAccent: "#FFFFFF", block1: "#C42A52", block2: "#5B45D9", block3: "#0E7A43", onBlock: "#FFFFFF" } },
  { id: "gallery-white", name: "Gallery white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#234FBF", onAccent: "#FFFFFF", block1: "#A62957", block2: "#234FBF", block3: "#7A3AB8", onBlock: "#FFFFFF" } },
  { id: "noir-neon", name: "Noir neon", colors: { background: "#101014", textColor: "#F5F5F7", accent: "#FFB020", onAccent: "#16130A", block1: "#FFB020", block2: "#6EE7B7", block3: "#D8F34D", onBlock: "#16130A" } },
  { id: "sorbet", name: "Sorbet", colors: { background: "#FFEEF6", textColor: "#33081F", accent: "#C21473", onAccent: "#FFFFFF", block1: "#C21473", block2: "#7C3AED", block3: "#B3541E", onBlock: "#FFFFFF" } },
];

const DEFAULT_STATS = ["42,180 | minutes listened", "312 | posts loved", "58 | new friends"];

interface StatRow {
  value: string;
  label: string;
}

function parseStat(raw: string): StatRow {
  const bar = raw.indexOf("|");
  if (bar < 0) return { value: raw.trim(), label: "" };
  return { value: raw.slice(0, bar).trim(), label: raw.slice(bar + 1).trim() };
}

function yearFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.16;
    case "1:1":
      return 0.19;
    case "4:5":
      return 0.21;
    case "9:16":
      return 0.23;
  }
}

function bandFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.13 : aspect === "9:16" ? 0.155 : 0.145;
}

const BAND_START = 1.05;
const BAND_STEP = 0.7;
const PILL_AT = 3.3;
const DURATION = 4.5;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF6E9"));
  const textColor = str(values.textColor, pc("textColor", "#201305"));
  const accent = str(values.accent, pc("accent", "#C42A52"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const blockColors = [pc("block1", "#C42A52"), pc("block2", "#5B45D9"), pc("block3", "#0E7A43")];
  const onBlock = pc("onBlock", "#FFFFFF");

  const year = str(values.year, "2025");
  const kicker = str(values.kicker, "YEAR IN REVIEW");
  const handle = str(values.handle, "@maya.codes");
  const stats = asList(values.stats, DEFAULT_STATS).slice(0, 3).map(parseStat);
  const showSlab = on(values.showSlab);
  const showIndex = on(values.showIndex);
  const showHandle = on(values.showHandle);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Vertical stack: kicker, huge year, 3 full-bleed bands, handle pill ---
  const ks = Math.round(minDim * 0.028);
  const kickerSize = fitSize(fonts, kicker, "body", 600, ks, safe.width * 0.9, 3);
  const kickerH = kickerSize * 1.25;
  const gapK = minDim * 0.02;
  const yearSize = fitSize(fonts, year, "display", 700, Math.round(minDim * yearFrac(ctx.aspect)), safe.width * 0.92);
  const yearText = makeText(fonts, { text: year, role: "display", weight: 700, size: yearSize, color: textColor, anchor: 0.5 });
  const yearH = yearText.height;
  const slabH = Math.max(6, minDim * 0.016);
  const slabGap = minDim * 0.012;
  const slabBlock = showSlab ? slabGap + slabH : 0;
  const gapY = minDim * 0.045;
  const hb = minDim * bandFrac(ctx.aspect);
  const bandGap = minDim * 0.02;
  const pillH = minDim * 0.062;
  const gapH = minDim * 0.04;
  const n = stats.length;

  const totalH =
    kickerH + gapK + yearH + slabBlock + gapY + n * hb + (n - 1) * bandGap + (showHandle ? gapH + pillH : 0);
  const top = safe.y + Math.max(0, (safe.height - totalH) / 2);

  // --- Kicker ---
  const kickerCy = top + kickerH / 2;
  const kickerText = makeText(fonts, { text: kicker, role: "body", weight: 600, size: kickerSize, color: textColor, anchor: 0.5, letterSpacing: 3 });
  kickerText.position.set(cx, kickerCy);
  kickerText.alpha = 0;
  root.addChild(kickerText);
  timeline
    .to(kickerText, { prop: "alpha", from: 0, to: 1, start: 0.12, duration: 0.4, ease: outQuad })
    .to(kickerText, { prop: "y", from: kickerCy - 12, to: kickerCy, start: 0.12, duration: 0.5, ease: outExpo });

  // --- Huge year punch ---
  const yearCy = top + kickerH + gapK + yearH / 2;
  yearText.position.set(cx, yearCy);
  yearText.alpha = 0;
  yearText.scale.set(1.5);
  root.addChild(yearText);
  timeline
    .to(yearText, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.22, ease: outQuad })
    .to(yearText, { prop: "scale.x", from: 1.5, to: 1, start: 0.3, duration: 0.55, ease: outQuint })
    .to(yearText, { prop: "scale.y", from: 1.5, to: 1, start: 0.3, duration: 0.55, ease: outQuint });

  // Accent slab wiping in under the year (decorative).
  if (showSlab) {
    const slabW = Math.min(yearText.width * 1.04, safe.width * 0.92);
    const slab = new Graphics().roundRect(0, 0, slabW, slabH, slabH / 2).fill(accent);
    slab.position.set(cx - slabW / 2, yearCy + yearH / 2 + slabGap);
    slab.scale.set(0, 1);
    root.addChild(slab);
    timeline.to(slab, { prop: "scale.x", from: 0, to: 1, start: 0.62, duration: 0.5, ease: outExpo });
  }

  // Year pulses on each band beat — the recap's heartbeat.
  for (let i = 0; i < n; i++) {
    const at = BAND_START + i * BAND_STEP;
    timeline
      .to(yearText, { prop: "scale.x", from: 1, to: 1.025, start: at, duration: 0.12, ease: outQuad })
      .to(yearText, { prop: "scale.y", from: 1, to: 1.025, start: at, duration: 0.12, ease: outQuad })
      .to(yearText, { prop: "scale.x", from: 1.025, to: 1, start: at + 0.12, duration: 0.25, ease: outCubic })
      .to(yearText, { prop: "scale.y", from: 1.025, to: 1, start: at + 0.12, duration: 0.25, ease: outCubic });
  }

  // --- Full-bleed stat bands, one takeover at a time ---
  const bandsTop = top + kickerH + gapK + yearH + slabBlock + gapY;
  const insetX = safe.x + minDim * 0.02;
  const availW = safe.width - minDim * 0.04;

  stats.forEach((stat, i) => {
    const bandTop = bandsTop + i * (hb + bandGap);
    const bandC = new Container();
    bandC.position.set(0, bandTop);
    root.addChild(bandC);

    // Color block wipes in from alternating sides.
    const fromLeft = i % 2 === 0;
    const rectHolder = new Container();
    if (fromLeft) {
      rectHolder.addChild(new Graphics().rect(0, 0, w, hb).fill(blockColors[i]!));
      rectHolder.position.set(0, 0);
    } else {
      rectHolder.addChild(new Graphics().rect(-w, 0, w, hb).fill(blockColors[i]!));
      rectHolder.position.set(w, 0);
    }
    rectHolder.scale.set(0, 1);
    bandC.addChild(rectHolder);

    const at = BAND_START + i * BAND_STEP;
    timeline.to(rectHolder, { prop: "scale.x", from: 0, to: 1, start: at, duration: 0.5, ease: outExpo });

    // Ghost index number, right-aligned (decorative).
    if (showIndex) {
      const idx = makeText(fonts, { text: `0${i + 1}`, role: "display", weight: 700, size: Math.round(hb * 0.58), color: onBlock, anchor: { x: 1, y: 0.5 } });
      idx.position.set(insetX + availW, hb * 0.5);
      idx.alpha = 0;
      bandC.addChild(idx);
      timeline.to(idx, { prop: "alpha", from: 0, to: 0.4, start: at + 0.3, duration: 0.35, ease: outQuad });
    }

    // Small caps label.
    const labelUp = stat.label.toUpperCase();
    const labelSize = fitSize(fonts, labelUp, "body", 600, Math.round(hb * 0.15), availW * 0.6, 2);
    const labelText = makeText(fonts, { text: labelUp, role: "body", weight: 600, size: labelSize, color: onBlock, anchor: { x: 0, y: 0.5 }, letterSpacing: 2 });
    labelText.position.set(insetX + 24, hb * 0.25);
    labelText.alpha = 0;
    bandC.addChild(labelText);
    timeline
      .to(labelText, { prop: "alpha", from: 0, to: 0.92, start: at + 0.2, duration: 0.3, ease: outQuad })
      .to(labelText, { prop: "x", from: insetX + 24, to: insetX, start: at + 0.2, duration: 0.4, ease: outExpo });

    // Big value punches in.
    const valueMax = availW * (showIndex ? 0.72 : 0.94);
    const valueSize = fitSize(fonts, stat.value, "display", 700, Math.round(hb * 0.4), valueMax);
    const valueText = makeText(fonts, { text: stat.value, role: "display", weight: 700, size: valueSize, color: onBlock, anchor: { x: 0, y: 0.5 } });
    valueText.position.set(insetX + 34, hb * 0.64);
    valueText.alpha = 0;
    valueText.scale.set(1.3);
    bandC.addChild(valueText);
    timeline
      .to(valueText, { prop: "alpha", from: 0, to: 1, start: at + 0.28, duration: 0.25, ease: outQuad })
      .to(valueText, { prop: "scale.x", from: 1.3, to: 1, start: at + 0.28, duration: 0.5, ease: outQuint })
      .to(valueText, { prop: "scale.y", from: 1.3, to: 1, start: at + 0.28, duration: 0.5, ease: outQuint })
      .to(valueText, { prop: "x", from: insetX + 34, to: insetX, start: at + 0.28, duration: 0.5, ease: outExpo });
  });

  // --- Handle pill lockup ---
  if (showHandle) {
    const pillCy = bandsTop + n * hb + (n - 1) * bandGap + gapH + pillH / 2;
    const hSize = fitSize(fonts, handle, "body", 600, Math.round(pillH * 0.4), safe.width * 0.7);
    const hText = makeText(fonts, { text: handle, role: "body", weight: 600, size: hSize, color: onAccent, anchor: 0.5 });
    const pillW = hText.width + pillH * 1.1;
    const pill = new Container();
    pill.addChild(makePill(pillW, pillH, accent));
    pill.addChild(hText);
    pill.position.set(cx, pillCy + minDim * 0.03);
    pill.alpha = 0;
    pill.scale.set(0.7);
    root.addChild(pill);
    timeline
      .to(pill, { prop: "alpha", from: 0, to: 1, start: PILL_AT, duration: 0.25, ease: outQuad })
      .to(pill, { prop: "scale.x", from: 0.7, to: 1, start: PILL_AT, duration: 0.55, ease: spring(0.45) })
      .to(pill, { prop: "scale.y", from: 0.7, to: 1, start: PILL_AT, duration: 0.55, ease: spring(0.45) })
      .to(pill, { prop: "y", from: pillCy + minDim * 0.03, to: pillCy, start: PILL_AT, duration: 0.55, ease: outExpo });
  }

  return { timeline, duration: DURATION };
}

export const wrappedRecap: TemplateDefinition = {
  id: "wrapped-recap",
  name: "Year Recap",
  tagline: "A huge year slams in, then three loud stat bands take over one by one.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 4.0,
  fontRoles: { year: "display", stats: "display", kicker: "body", handle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "year", type: "text", label: "Year", default: "2025", maxLength: 8 },
    { key: "kicker", type: "text", label: "Kicker", default: "YEAR IN REVIEW", maxLength: 28, shrinkToFit: true },
    {
      key: "stats",
      type: "textlist",
      label: "Stats",
      default: DEFAULT_STATS,
      minItems: 3,
      maxItems: 3,
      maxLength: 36,
      help: 'One per line as "value | label", e.g. "42,180 | minutes listened".',
    },
    { key: "handle", type: "text", label: "Handle", default: "@maya.codes", maxLength: 24, shrinkToFit: true },
    { key: "showSlab", type: "toggle", label: "Year underline", default: true },
    { key: "showIndex", type: "toggle", label: "Band numbers", default: true },
    { key: "showHandle", type: "toggle", label: "Handle pill", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

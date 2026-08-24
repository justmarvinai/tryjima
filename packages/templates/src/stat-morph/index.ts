import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutCubic,
  inOutQuad,
  outExpo,
  outQuad,
  outQuint,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { layoutChars } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
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
  return w > maxWidth ? Math.max(12, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", muted: "#5B5B68" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#F2F6FF", textColor: "#0B1F4D", accent: "#2E7DF6", muted: "#4A5B80" } },
  { id: "sand", name: "Sand", colors: { background: "#F8F4ED", textColor: "#2A2118", accent: "#B45309", muted: "#6E6055" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0F1116", textColor: "#F5F3EE", accent: "#D8F34D", muted: "#98A0AE" } },
];

interface Stat {
  value: string;
  caption: string;
}

const DEFAULT_STATS = [
  "12,480|posts published",
  "3.4x|faster than last quarter",
  "92%|made on mobile",
];

function parseStat(raw: string, fallback: string): Stat {
  const parts = raw.split("|").map((s) => s.trim());
  const value = parts[0] ?? "";
  const caption = parts[1] ?? "";
  return { value: value.length ? value : fallback, caption };
}

function statsOf(values: Values): Stat[] {
  return asList(values.stats, DEFAULT_STATS)
    .slice(0, 4)
    .map((r, i) => parseStat(r, `${i + 1}`));
}

const IN_START = 0.35;
const STEP = 1.28;
const ROLL = 0.62;
const CHAR_EACH = 0.04;
const MAX_STAGGER = 0.2;
const HOLD = 1.15;

function computeDuration(values: Values): number {
  const n = Math.max(1, statsOf(values).length);
  return IN_START + (n - 1) * STEP + MAX_STAGGER + ROLL + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const mutedColor = str(values.mutedColor, pc("muted", "#5B5B68"));

  const eyebrowRaw = str(values.eyebrow, "The year in numbers");
  const showRail = values.showRail !== false;
  const showDot = values.accentDot !== false;

  const stats = statsOf(values);
  const n = stats.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const cx = zone.x + zone.width / 2;

  // --- Vertical rhythm: eyebrow · number band · caption · progress rail ---
  const eyebrowSize = Math.round(minDim * 0.026);
  const numberBase = Math.round(minDim * 0.23);
  const captionSize = Math.round(minDim * 0.036);
  const bandH = numberBase * 1.35;
  const railH = Math.max(3, minDim * 0.005);
  const railW = Math.min(zone.width * 0.4, minDim * 0.34);
  const gapEyebrow = minDim * 0.05;
  const gapCaption = minDim * 0.03;
  const gapRail = minDim * 0.06;

  const blockH =
    eyebrowSize * 1.3 + gapEyebrow + bandH + gapCaption + captionSize * 1.4 + gapRail + railH;
  const top = zone.y + Math.max(0, (zone.height - blockH) / 2);
  const eyebrowCy = top + eyebrowSize * 0.65;
  const numberCy = top + eyebrowSize * 1.3 + gapEyebrow + bandH / 2;
  const captionCy = numberCy + bandH / 2 + gapCaption + captionSize * 0.7;
  const railY = captionCy + captionSize * 0.7 + gapRail;

  // --- Eyebrow (with a small accent square leading it) ---
  if (eyebrowRaw.length > 0) {
    const eyeStr = eyebrowRaw.toUpperCase();
    const eyeSize = fitSize(fonts, eyeStr, "body", 600, eyebrowSize, zone.width * 0.8);
    const eyeC = new Container();
    eyeC.position.set(cx, eyebrowCy);
    eyeC.alpha = 0;
    root.addChild(eyeC);
    const eyeText = makeText(fonts, { text: eyeStr, role: "body", weight: 600, size: eyeSize, color: mutedColor, anchor: { x: 0, y: 0.5 }, letterSpacing: 2 });
    const dotSize = eyeSize * 0.42;
    const dotGap = eyeSize * 0.7;
    const lead = showDot ? dotSize + dotGap : 0;
    const groupW = eyeText.width + lead;
    const left = -groupW / 2;
    eyeText.position.set(left + lead, 0);
    eyeC.addChild(eyeText);
    if (showDot) {
      eyeC.addChild(
        new Graphics().roundRect(left, -dotSize / 2, dotSize, dotSize, dotSize * 0.3).fill(accent),
      );
    }
    timeline
      .to(eyeC, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
      .to(eyeC, { prop: "y", from: eyebrowCy - minDim * 0.012, to: eyebrowCy, start: 0.1, duration: 0.7, ease: outExpo });
  }

  // --- Number band: glyphs roll under a clip, odometer-style ---
  const clip = new Container();
  root.addChild(clip);
  const bandMask = new Graphics()
    .rect(zone.x - minDim * 0.06, numberCy - bandH / 2, zone.width + minDim * 0.12, bandH)
    .fill(0xffffff);
  root.addChild(bandMask);
  clip.mask = bandMask;

  const rollDist = bandH * 1.05;
  const numberMaxW = zone.width * 0.94;
  // One shared figure size for every stat — an odometer whose digits change
  // height between readings would read as a glitch, not a roll.
  const fSize = stats.reduce(
    (acc, s) => Math.min(acc, fitSize(fonts, s.value, "display", 700, numberBase, numberMaxW)),
    numberBase,
  );

  stats.forEach((s, k) => {
    const enterAt = IN_START + k * STEP;
    const exitAt = k < n - 1 ? IN_START + (k + 1) * STEP : null;

    const boxes = layoutChars(s.value, fonts, {
      role: "display",
      weight: 700,
      fontSize: fSize,
      lineHeight: fSize * 1.1,
      maxWidth: numberMaxW * 4,
      align: "center",
      anchorX: cx,
      centerY: numberCy,
    });
    const charEach = boxes.length > 1 ? Math.min(CHAR_EACH, MAX_STAGGER / (boxes.length - 1)) : 0;

    boxes.forEach((box, i) => {
      const glyph = makeText(fonts, { text: box.char, role: "display", weight: 700, size: fSize, color: textColor, anchor: 0.5 });
      glyph.position.set(box.cx, numberCy + rollDist);
      glyph.alpha = 0;
      clip.addChild(glyph);

      const inAt = enterAt + i * charEach;
      timeline
        .to(glyph, { prop: "y", from: numberCy + rollDist, to: numberCy, start: inAt, duration: ROLL, ease: outQuint })
        .to(glyph, { prop: "alpha", from: 0, to: 1, start: inAt, duration: ROLL * 0.6, ease: outQuad });

      if (exitAt !== null) {
        // The old reading clears the window before the new one lands, so the
        // roll never shows two figures stacked on top of each other.
        const outAt = exitAt + i * charEach;
        timeline
          .to(glyph, { prop: "y", from: numberCy, to: numberCy - rollDist, start: outAt, duration: ROLL * 0.75, ease: inOutQuad })
          .to(glyph, { prop: "alpha", from: 1, to: 0, start: outAt, duration: ROLL * 0.45, ease: outQuad });
      }
    });

    // --- Caption, crossfading in step with the roll ---
    if (s.caption.length > 0) {
      const cSize = fitSize(fonts, s.caption, "body", 500, captionSize, zone.width * 0.9);
      const cap = makeText(fonts, { text: s.caption, role: "body", weight: 500, size: cSize, color: mutedColor, anchor: 0.5, align: "center" });
      cap.position.set(cx, captionCy);
      cap.alpha = 0;
      root.addChild(cap);
      timeline
        .to(cap, { prop: "alpha", from: 0, to: 1, start: enterAt + 0.1, duration: 0.45, ease: outQuad })
        .to(cap, { prop: "y", from: captionCy + minDim * 0.012, to: captionCy, start: enterAt + 0.1, duration: 0.6, ease: outQuint });
      if (exitAt !== null) {
        timeline
          .to(cap, { prop: "alpha", from: 1, to: 0, start: exitAt, duration: 0.3, ease: inOutQuad })
          .to(cap, { prop: "y", from: captionCy, to: captionCy - minDim * 0.012, start: exitAt, duration: 0.45, ease: inOutQuad });
      }
    }
  });

  // --- Progress rail: one accent segment gliding between the figures ---
  if (showRail && n > 1) {
    const railX = cx - railW / 2;
    const rail = new Container();
    rail.position.set(0, railY);
    rail.alpha = 0;
    root.addChild(rail);
    rail.addChild(new Graphics().roundRect(railX, 0, railW, railH, railH / 2).fill({ color: textColor, alpha: 0.14 }));
    const segW = railW / n;
    const seg = new Graphics().roundRect(0, 0, segW, railH, railH / 2).fill(accent);
    seg.position.set(railX, 0);
    rail.addChild(seg);
    timeline.to(rail, { prop: "alpha", from: 0, to: 1, start: 0.5, duration: 0.5, ease: outQuad });
    for (let k = 1; k < n; k++) {
      timeline.to(seg, {
        prop: "x",
        from: railX + (k - 1) * segW,
        to: railX + k * segW,
        start: IN_START + k * STEP,
        duration: ROLL + 0.1,
        ease: inOutCubic,
      });
    }
  }

  return { timeline, duration: computeDuration(values) };
}

export const statMorph: TemplateDefinition = {
  id: "stat-morph",
  name: "Stat Morph",
  tagline: "One oversized figure rolls through three ways of telling the same story.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 4.3,
  estimateDuration: computeDuration,
  fontRoles: { eyebrow: "body", stats: "display" },
  palettes: PALETTES,
  fields: [
    { key: "eyebrow", type: "text", label: "Eyebrow", default: "The year in numbers", maxLength: 28, optional: true, shrinkToFit: true },
    {
      key: "stats",
      type: "textlist",
      label: "Figures (value | caption)",
      default: DEFAULT_STATS,
      minItems: 2,
      maxItems: 4,
      maxLength: 30,
      help: 'One per line as "value | caption", e.g. "92% | made on mobile". The last line is the one it holds on.',
    },
    { key: "showRail", type: "toggle", label: "Progress rail", default: true },
    { key: "accentDot", type: "toggle", label: "Accent marker", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Figure", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "mutedColor", type: "color", label: "Caption", default: "", optional: true },
  ],
  build,
};

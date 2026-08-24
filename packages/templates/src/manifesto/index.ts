import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inCubic,
  linear,
  outCubic,
  outQuad,
  outExpo,
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
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  trackingEm = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size: size0,
    letterSpacing: trackingEm * size0,
  });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

// One continuous, decelerating scroll — not a loop and not a stack of cards.
// Statements flow upward through a centre band that holds the only fully-opaque
// line; the pass eases in, cruises, then comes to rest on the closing line with
// the brand mark settling underneath.
const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#F7F6F3", textColor: "#16181C", accent: "#B4552D" } },
  { id: "ink", name: "Ink", colors: { background: "#0D0F14", textColor: "#F4F6FA", accent: "#8AA4FF" } },
  { id: "sage", name: "Sage", colors: { background: "#EEF3EE", textColor: "#13221A", accent: "#1F7A54" } },
  { id: "clay", name: "Clay", colors: { background: "#FBF1EA", textColor: "#2B1810", accent: "#B24A2B" } },
];

const DEFAULT_LINES = [
  "Start with the truth.",
  "Make fewer, better.",
  "Sweat the details.",
  "Move with intent.",
  "Then make it sing.",
];

// The pass is one glide in three tweens: ease in, cruise, ease to rest. Their
// distances are split so the velocities match at both seams (inCubic exits at
// 3·s/d, linear runs at s/d, outCubic enters at 3·s/d) — no visible gear change.
const RAMP_START = 0.15;
const RAMP_DUR = 0.6;
const CRUISE_START = 0.75;
const CRUISE_DUR = 1.8;
const SETTLE_START = 2.55;
const SETTLE_DUR = 1.1;
const SPAN = RAMP_DUR / 3 + CRUISE_DUR + SETTLE_DUR / 3;
const RAMP_SHARE = RAMP_DUR / 3 / SPAN;
const CRUISE_SHARE = CRUISE_DUR / SPAN;
const DURATION = 4.8;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F7F6F3"));
  const textColor = str(values.textColor, pc("textColor", "#16181C"));
  const accent = str(values.accent, pc("accent", "#B4552D"));

  const lines = asList(values.lines, DEFAULT_LINES).slice(0, 6);
  const brandName = str(values.brandName, "Northlight").toUpperCase();
  const showRule = values.showRule !== false;
  const showDot = values.showDot !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Type scale: every line shares the size the longest one can carry ---
  const maxLineW = zone.width * 0.86;
  const base = Math.round(minDim * 0.074);
  let lineSize = base;
  for (const line of lines) {
    lineSize = Math.min(lineSize, fitSize(fonts, line, "display", 600, base, maxLineW, -0.01));
  }

  const gap = lineSize * 1.95;
  const focusY = zone.y + zone.height * 0.52;
  const n = lines.length;

  // --- The scrolling strip ---
  const strip = new Container();
  const startY = focusY + gap * 0.9;
  const endY = focusY - (n - 1) * gap;
  const travel = startY - endY;
  const rampY = startY - travel * RAMP_SHARE;
  const cruiseY = rampY - travel * CRUISE_SHARE;
  strip.position.set(cx, startY);
  root.addChild(strip);
  timeline
    .to(strip, { prop: "y", from: startY, to: rampY, start: RAMP_START, duration: RAMP_DUR, ease: inCubic })
    .to(strip, { prop: "y", from: rampY, to: cruiseY, start: CRUISE_START, duration: CRUISE_DUR, ease: linear })
    .to(strip, { prop: "y", from: cruiseY, to: endY, start: SETTLE_START, duration: SETTLE_DUR, ease: outCubic });

  const lineNodes: Text[] = lines.map((line, i) => {
    const node = makeText(fonts, {
      text: line,
      role: "display",
      weight: 600,
      size: lineSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: -lineSize * 0.01,
    });
    node.position.set(0, i * gap);
    node.alpha = 0;
    strip.addChild(node);
    return node;
  });

  // --- Closing lockup: hairline + brand mark, both below the resting line ---
  const ruleH = Math.max(2, Math.round(minDim * 0.0022));
  const ruleY = focusY + lineSize * 1.2;
  if (showRule) {
    const ruleW = Math.min(zone.width * 0.24, lineSize * 2.4);
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(cx, ruleY);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 3.42, duration: 0.75, ease: outExpo });
  }

  if (brandName.length > 0) {
    const markSize = Math.round(minDim * 0.03);
    const markTracking = markSize * 0.2;
    const fitted = fitSize(fonts, brandName, "display", 700, markSize, zone.width * 0.7, 0.2);
    const nameW = fonts.measure(brandName, {
      family: fonts.family("display"),
      weight: 700,
      size: fitted,
      letterSpacing: markTracking,
    });
    const dotR = showDot ? fitted * 0.28 : 0;
    const dotGap = showDot ? fitted * 0.62 : 0;
    const totalW = dotR * 2 + dotGap + nameW;

    const markY = ruleY + lineSize * 0.95;
    const mark = new Container();
    mark.position.set(cx, markY);
    mark.alpha = 0;
    root.addChild(mark);

    if (showDot) {
      const dot = new Graphics().circle(-totalW / 2 + dotR, 0, dotR).fill(accent);
      mark.addChild(dot);
    }
    const nameText = makeText(fonts, {
      text: brandName,
      role: "display",
      weight: 700,
      size: fitted,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
      letterSpacing: markTracking,
    });
    nameText.position.set(-totalW / 2 + dotR * 2 + dotGap, 0);
    mark.addChild(nameText);

    timeline
      .to(mark, { prop: "alpha", from: 0, to: 1, start: 3.55, duration: 0.6, ease: outQuad })
      .to(mark, { prop: "y", from: markY + 18, to: markY, start: 3.55, duration: 0.8, ease: outExpo });
  }

  // Per-line opacity is a pure function of where the line sits relative to the
  // centre band, so the strip's single glide does all the timing work.
  const FULL = gap * 0.26;
  const OUT = gap * 1.18;
  const update = (_t: number): void => {
    const stripY = strip.position.y;
    lineNodes.forEach((node, i) => {
      const d = Math.abs(stripY + i * gap - focusY);
      let a = 1;
      if (d > FULL) {
        const u = clamp01((OUT - d) / (OUT - FULL));
        a = u * u * (3 - 2 * u);
      }
      node.alpha = a;
      const s = 0.93 + 0.07 * a;
      node.scale.set(s);
    });
  };

  return { timeline, duration: DURATION, update };
}

export const manifesto: TemplateDefinition = {
  id: "manifesto",
  name: "Manifesto",
  tagline: "Your brand statements scroll upward and come to rest on the last line.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 4.6,
  fontRoles: { lines: "display", brandName: "display" },
  palettes: PALETTES,
  fields: [
    {
      key: "lines",
      type: "textlist",
      label: "Statements",
      default: DEFAULT_LINES,
      minItems: 3,
      maxItems: 6,
      maxLength: 30,
      help: "One short line each. The last one is where the scroll comes to rest.",
    },
    { key: "brandName", type: "text", label: "Brand name", default: "Northlight", maxLength: 20, shrinkToFit: true },
    { key: "showRule", type: "toggle", label: "Hairline", default: true },
    { key: "showDot", type: "toggle", label: "Accent dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

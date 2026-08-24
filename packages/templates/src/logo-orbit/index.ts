import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  inOutCubic,
  safeRect,
  safeCenter,
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

// Attribute words orbit the brand mark on a tilted ellipse, fan out as they
// slow, and the path opens into a flat circle so they land evenly spaced — a
// lockup ring, not a carousel of products (orbit-showcase).
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#F5F6F8", textColor: "#14161B", accent: "#2559D6", chipBg: "#FFFFFF", onAccent: "#FFFFFF" } },
  { id: "ink", name: "Ink", colors: { background: "#0B0D12", textColor: "#F2F4F9", accent: "#6E8BFF", chipBg: "#161A22", onAccent: "#0B0D12" } },
  { id: "forest", name: "Forest", colors: { background: "#EEF4F0", textColor: "#0E211A", accent: "#157A5B", chipBg: "#FFFFFF", onAccent: "#FFFFFF" } },
  { id: "amber", name: "Amber", colors: { background: "#FFF8EE", textColor: "#291A08", accent: "#B25C10", chipBg: "#FFFFFF", onAccent: "#FFFFFF" } },
];

const DEFAULT_WORDS = ["Strategy", "Design", "Motion", "Story"];

const SPIN_START = 0.3;
const SPIN_DUR = 3.05;
const FLAT_START = 1.45;
const FLAT_DUR = 1.9;
const BASE_TURNS = 1.15;
const EXTRA_TURNS = 0.11;
const TAU = Math.PI * 2;
const DURATION = 4.7;

interface Satellite {
  holder: Container;
  chip: Container;
  rest: number;
  turns: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F6F8"));
  const textColor = str(values.textColor, pc("textColor", "#14161B"));
  const accent = str(values.accent, pc("accent", "#2559D6"));
  const chipBg = str(values.chipBg, pc("chipBg", "#FFFFFF"));
  const onAccent = pc("onAccent", "#FFFFFF");

  const brandName = str(values.brandName, "Northlight");
  const monogram = str(values.monogram, "N").slice(0, 2).toUpperCase();
  const words = asList(values.words, DEFAULT_WORDS)
    .slice(0, 4)
    .map((s) => s.toUpperCase());
  const showRing = values.showRing !== false;
  const showDots = values.showDots !== false;
  const filledMark = values.showMarkFill !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);
  const center = safeCenter(ctx.aspect);
  const n = words.length;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Ring + chip metrics (width-bound so the side chips stay in the safe rect) ---
  const R = Math.min(zone.width * 0.3, zone.height * 0.38);
  const chipBase = Math.round(minDim * 0.026);
  const padX = chipBase * 1.15;
  const dotR = showDots ? chipBase * 0.22 : 0;
  const dotGap = showDots ? chipBase * 0.42 : 0;
  const chipWmax = Math.min(2 * (center.x - zone.x - R) - minDim * 0.02, minDim * 0.36);
  const textBudget = Math.max(40, chipWmax - padX * 2 - dotR * 2 - dotGap);

  let chipFont = chipBase;
  for (const word of words) {
    chipFont = Math.min(chipFont, fitSize(fonts, word, "body", 600, chipBase, textBudget, 0.08));
  }
  const chipH = Math.round(chipFont * 2.5);

  const nameSize = fitSize(fonts, brandName, "display", 700, Math.round(minDim * 0.038), zone.width * 0.7);
  const nameGap = minDim * 0.045;
  const ringCy = center.y - (nameGap + nameSize) / 2;
  const nameY = ringCy + R + chipH / 2 + nameGap + nameSize * 0.5;

  const orbit = new Container();
  orbit.position.set(center.x, ringCy);
  root.addChild(orbit);

  // --- Orbit path (redrawn each frame: it opens from ellipse to circle) ---
  const ringG = showRing ? new Graphics() : null;
  if (ringG) {
    ringG.alpha = 0;
    orbit.addChild(ringG);
    timeline
      .to(ringG, { prop: "alpha", from: 0, to: 0.24, start: 0.25, duration: 0.9, ease: outQuad })
      .to(ringG, { prop: "alpha", from: 0.24, to: 0.4, start: 3.2, duration: 0.6, ease: outQuad });
  }
  const ringWidth = Math.max(1.5, minDim * 0.0018);

  // --- Satellites ---
  const sats: Satellite[] = words.map((word, i) => {
    const holder = new Container();
    holder.alpha = 0;
    orbit.addChild(holder);

    const chip = new Container();
    holder.addChild(chip);

    const label = makeText(fonts, {
      text: word,
      role: "body",
      weight: 600,
      size: chipFont,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
      letterSpacing: chipFont * 0.08,
    });
    const chipW = padX * 2 + dotR * 2 + dotGap + label.width;
    const radius = chipH / 2;

    const shadow = new Graphics()
      .roundRect(-chipW / 2, -chipH / 2 + chipH * 0.08, chipW, chipH, radius)
      .fill({ color: "#000000", alpha: 0.1 });
    chip.addChild(shadow);
    chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, radius).fill(chipBg));
    if (showDots) {
      chip.addChild(new Graphics().circle(-chipW / 2 + padX + dotR, 0, dotR).fill(accent));
    }
    label.position.set(-chipW / 2 + padX + dotR * 2 + dotGap, 0);
    chip.addChild(label);

    timeline.to(holder, { prop: "alpha", from: 0, to: 1, start: 0.35 + i * 0.12, duration: 0.55, ease: outQuad });

    return {
      holder,
      chip,
      rest: -Math.PI / 2 + (i / n) * TAU,
      turns: BASE_TURNS + i * EXTRA_TURNS,
    };
  });

  // --- Brand mark (drawn last so satellites pass behind it) ---
  const markR = R * 0.4;
  const mark = new Container();
  mark.position.set(0, 0);
  mark.alpha = 0;
  mark.scale.set(0.82);
  orbit.addChild(mark);
  if (filledMark) {
    mark.addChild(new Graphics().circle(0, 0, markR).fill(accent));
  } else {
    mark.addChild(
      new Graphics().circle(0, 0, markR).stroke({ color: accent, width: Math.max(2, markR * 0.06) }),
    );
  }
  const monoSize = fitSize(fonts, monogram, "display", 700, Math.round(markR * 0.82), markR * 1.15);
  const monoText = makeText(fonts, {
    text: monogram,
    role: "display",
    weight: 700,
    size: monoSize,
    color: filledMark ? onAccent : textColor,
    anchor: 0.5,
  });
  monoText.position.set(0, markR * 0.02);
  mark.addChild(monoText);
  timeline
    .to(mark, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.5, ease: outQuad })
    .to(mark, { prop: "scale.x", from: 0.82, to: 1, start: 0.05, duration: 0.95, ease: outExpo })
    .to(mark, { prop: "scale.y", from: 0.82, to: 1, start: 0.05, duration: 0.95, ease: outExpo });

  // --- Brand name under the ring ---
  const nameText = makeText(fonts, {
    text: brandName,
    role: "display",
    weight: 700,
    size: nameSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
  });
  nameText.position.set(center.x, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 3.3, duration: 0.55, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY + 16, to: nameY, start: 3.3, duration: 0.75, ease: outExpo });

  // Orbit angles, path shape and depth are all pure functions of t: the spin
  // decays to exactly the rest angles while the ellipse opens into a circle.
  const update = (t: number): void => {
    const e = outQuint(clamp01((t - SPIN_START) / SPIN_DUR));
    const flat = inOutCubic(clamp01((t - FLAT_START) / FLAT_DUR));
    const ry = R * (0.6 + 0.4 * flat);

    if (ringG) {
      ringG.clear();
      ringG.ellipse(0, 0, R, ry).stroke({ color: textColor, width: ringWidth });
    }

    for (const sat of sats) {
      const angle = sat.rest - (1 - e) * sat.turns * TAU;
      sat.holder.position.set(Math.cos(angle) * R, Math.sin(angle) * ry);
      const depth = (Math.sin(angle) + 1) / 2;
      const s = 1 + (0.88 + 0.24 * depth - 1) * (1 - flat);
      sat.chip.scale.set(s);
      sat.chip.alpha = 1 - (1 - (0.55 + 0.45 * depth)) * (1 - flat);
    }
  };

  return { timeline, duration: DURATION, update };
}

export const logoOrbit: TemplateDefinition = {
  id: "logo-orbit",
  name: "Logo Orbit",
  tagline: "Attribute words orbit your mark, then settle into an even ring.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 4.35,
  fontRoles: { brandName: "display", monogram: "display", words: "body" },
  palettes: PALETTES,
  fields: [
    { key: "brandName", type: "text", label: "Brand name", default: "Northlight", maxLength: 22, shrinkToFit: true },
    { key: "monogram", type: "text", label: "Monogram (1–2 letters)", default: "N", maxLength: 2, shrinkToFit: true },
    {
      key: "words",
      type: "textlist",
      label: "Orbiting words",
      default: DEFAULT_WORDS,
      minItems: 3,
      maxItems: 4,
      maxLength: 14,
      help: "One word each — they space out evenly around the mark.",
    },
    { key: "showRing", type: "toggle", label: "Orbit path", default: true },
    { key: "showDots", type: "toggle", label: "Chip dots", default: true },
    { key: "showMarkFill", type: "toggle", label: "Filled mark", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "chipBg", type: "color", label: "Chip surface", default: "", optional: true },
  ],
  build,
};

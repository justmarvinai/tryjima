import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  inOutQuad,
  inQuad,
  makeOutBack,
  safeRect,
  safeCenter,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { makePill } from "../shared/ui";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
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
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

// --- Deterministic hex mixing (pure) — award shading derives from the gold color.
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full.length === 6 ? full : "ffffff", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const toHex = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `#${toHex(ca.r + (cb.r - ca.r) * t)}${toHex(ca.g + (cb.g - ca.g) * t)}${toHex(ca.b + (cb.b - ca.b) * t)}`;
}

/** A 4-point sparkle star, centered at origin. */
function sparkleStar(s: number, color: string): Graphics {
  const k = 0.24;
  return new Graphics()
    .poly([0, -s, s * k, -s * k, s, 0, s * k, s * k, 0, s, -s * k, s * k, -s, 0, -s * k, -s * k])
    .fill(color);
}

// All three awards are drawn with their bottom edge at y = +0.235*s so they sit
// flush on the shelf line.

function drawTrophy(s: number, gold: string, goldDark: string, engrave: string): Container {
  const c = new Container();
  const g = new Graphics();
  // Handles (behind the bowl).
  g.circle(-0.3 * s, -0.26 * s, 0.105 * s).stroke({ color: gold, width: 0.05 * s });
  g.circle(0.3 * s, -0.26 * s, 0.105 * s).stroke({ color: gold, width: 0.05 * s });
  // Bowl.
  g.moveTo(-0.26 * s, -0.46 * s)
    .lineTo(0.26 * s, -0.46 * s)
    .quadraticCurveTo(0.24 * s, -0.1 * s, 0.06 * s, -0.04 * s)
    .lineTo(-0.06 * s, -0.04 * s)
    .quadraticCurveTo(-0.24 * s, -0.1 * s, -0.26 * s, -0.46 * s)
    .closePath()
    .fill(gold);
  // Rim, stem, base, plinth.
  g.roundRect(-0.29 * s, -0.485 * s, 0.58 * s, 0.07 * s, 0.03 * s).fill(gold);
  g.poly([-0.045 * s, -0.04 * s, 0.045 * s, -0.04 * s, 0.075 * s, 0.1 * s, -0.075 * s, 0.1 * s]).fill(goldDark);
  g.roundRect(-0.15 * s, 0.1 * s, 0.3 * s, 0.06 * s, 0.02 * s).fill(gold);
  g.roundRect(-0.2 * s, 0.16 * s, 0.4 * s, 0.075 * s, 0.025 * s).fill(goldDark);
  c.addChild(g);
  const star = makeIcon("star", 0.15 * s, { color: engrave });
  star.position.set(0, -0.29 * s);
  c.addChild(star);
  return c;
}

function drawMedal(s: number, gold: string, ribA: string, ribB: string, engrave: string): Container {
  const c = new Container();
  const g = new Graphics();
  // Ribbon V behind the disc.
  g.poly([-0.19 * s, -0.47 * s, -0.05 * s, -0.47 * s, 0.02 * s, -0.12 * s, -0.12 * s, -0.12 * s]).fill(ribA);
  g.poly([0.05 * s, -0.47 * s, 0.19 * s, -0.47 * s, 0.12 * s, -0.12 * s, -0.02 * s, -0.12 * s]).fill(ribB);
  // Disc + engraved rim.
  g.circle(0, -0.015 * s, 0.25 * s).fill(gold);
  g.circle(0, -0.015 * s, 0.19 * s).stroke({ color: engrave, width: Math.max(2, 0.02 * s) });
  c.addChild(g);
  const star = makeIcon("star", 0.2 * s, { color: engrave });
  star.position.set(0, -0.015 * s);
  c.addChild(star);
  return c;
}

function drawPlaque(s: number, body: string, gold: string): Container {
  const c = new Container();
  const g = new Graphics();
  g.roundRect(-0.26 * s, -0.36 * s, 0.52 * s, 0.595 * s, 0.05 * s).fill(body);
  g.roundRect(-0.205 * s, -0.305 * s, 0.41 * s, 0.485 * s, 0.035 * s).stroke({ color: gold, width: Math.max(2, 0.016 * s) });
  g.roundRect(-0.115 * s, 0.075 * s, 0.23 * s, 0.065 * s, 0.02 * s).fill(gold);
  c.addChild(g);
  const star = makeIcon("star", 0.24 * s, { color: gold });
  star.position.set(0, -0.1 * s);
  c.addChild(star);
  return c;
}

// A shelf of three awards (cup, medal, star plaque) landing in sequence under a
// traveling spotlight, each with a caption chip. Lockup + chips use textColor
// on background/chipBg (both ≥ 4.5:1); gold + accent are decorative.
const PALETTES: Palette[] = [
  { id: "gallery", name: "Gallery", colors: { background: "#F6F4EF", textColor: "#221B10", accent: "#9A5A1C", gold: "#C9971F", chipBg: "#FFFFFF" } },
  { id: "boardroom", name: "Boardroom", colors: { background: "#EFF2F6", textColor: "#14202E", accent: "#1E4FA3", gold: "#C9971F", chipBg: "#FFFFFF" } },
  { id: "award-night", name: "Award night", colors: { background: "#131019", textColor: "#F4F0E6", accent: "#8F7BFF", gold: "#E3B84F", chipBg: "#262033" } },
  { id: "champagne", name: "Champagne", colors: { background: "#F9F1E4", textColor: "#33240F", accent: "#A3541B", gold: "#C9931B", chipBg: "#FFFFFF" } },
];

const DEFAULT_CAPTIONS = ["Best of 2026", "Top Rated", "Editor's Pick"];
const LAND_TIMES = [0.6, 1.05, 1.5];
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6F4EF"));
  const textColor = str(values.textColor, pc("textColor", "#221B10"));
  const accent = str(values.accent, pc("accent", "#9A5A1C"));
  const gold = pc("gold", "#C9971F");
  const chipBg = pc("chipBg", "#FFFFFF");
  const goldDark = mixHex(gold, "#000000", 0.28);
  const engrave = mixHex(gold, "#000000", 0.55);
  const ribB = mixHex(accent, "#FFFFFF", 0.25);

  const captions = asList(values.captions, DEFAULT_CAPTIONS);
  const lockup = str(values.lockup, "Voted best three years running");
  const showSpotlight = values.showSpotlight !== false;
  const showSparkles = values.showSparkles !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const center = safeCenter(ctx.aspect);
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const s = Math.min(zone.width * 0.24, zone.height * 0.42, minDim * 0.3);
  const spacing = Math.min(s * 1.45, zone.width * 0.33);
  const shelfY = center.y + s * 0.12;
  const slots = [center.x - spacing, center.x, center.x + spacing];
  const rowW = spacing * 2 + s * 1.35;
  const lineH = Math.max(5, s * 0.032);
  const chipH = Math.max(30, Math.min(52, s * 0.155));
  const chipY = shelfY + lineH + chipH * 0.85;
  const lockupY = chipY + chipH * 1.85;

  // --- Spotlight sweep (behind the awards, fades out once all have landed) ---
  if (showSpotlight) {
    const glow = new Sprite(radialGlowTexture());
    glow.anchor.set(0.5);
    glow.width = s * 2.6;
    glow.height = s * 2.6;
    glow.tint = gold;
    glow.alpha = 0;
    glow.position.set(slots[0]! - s * 0.6, shelfY - s * 0.32);
    root.addChild(glow);
    timeline
      .to(glow, { prop: "alpha", from: 0, to: 0.34, start: 0.5, duration: 0.25, ease: outQuad })
      .to(glow, { prop: "alpha", from: 0.34, to: 0, start: 1.85, duration: 0.45, ease: outQuad })
      .to(glow, { prop: "x", from: slots[0]! - s * 0.6, to: slots[0]!, start: 0.5, duration: 0.25, ease: outQuad })
      .to(glow, { prop: "x", from: slots[0]!, to: slots[1]!, start: 0.95, duration: 0.35, ease: inOutQuad })
      .to(glow, { prop: "x", from: slots[1]!, to: slots[2]!, start: 1.4, duration: 0.35, ease: inOutQuad })
      .to(glow, { prop: "x", from: slots[2]!, to: slots[2]! + s * 0.4, start: 1.85, duration: 0.35, ease: inQuad });
  }

  // --- Shelf line ---
  const shelf = new Container();
  shelf.position.set(center.x, shelfY);
  shelf.addChild(new Graphics().roundRect(-rowW / 2, 0, rowW, lineH, lineH / 2).fill(textColor));
  shelf.scale.x = 0;
  root.addChild(shelf);
  timeline.to(shelf, { prop: "scale.x", from: 0, to: 1, start: 0.12, duration: 0.5, ease: outQuint });

  // --- Awards rise + land in sequence, with a squash on touchdown ---
  const arts = [
    drawTrophy(s, gold, goldDark, engrave),
    drawMedal(s, gold, accent, ribB, engrave),
    drawPlaque(s, accent, gold),
  ];
  arts.forEach((art, i) => {
    const award = new Container(); // origin at the shelf contact point
    award.position.set(slots[i]!, shelfY);
    award.alpha = 0;
    art.position.set(0, -0.235 * s);
    award.addChild(art);
    root.addChild(award);
    const t0 = LAND_TIMES[i]!;
    timeline
      .to(award, { prop: "alpha", from: 0, to: 1, start: t0, duration: 0.3, ease: outQuad })
      .to(award, { prop: "y", from: shelfY + s * 0.22, to: shelfY, start: t0, duration: 0.55, ease: makeOutBack(1.8) })
      .to(award, { prop: "scale.y", from: 1, to: 0.94, start: t0 + 0.45, duration: 0.1, ease: outQuad })
      .to(award, { prop: "scale.y", from: 0.94, to: 1, start: t0 + 0.55, duration: 0.3, ease: makeOutBack(2.2) });

    // Caption chip under the shelf.
    const caption = captions[i] ?? DEFAULT_CAPTIONS[i] ?? "—";
    const capSize = fitSize(fonts, caption, "body", 600, Math.round(chipH * 0.5), spacing * 0.92 - chipH);
    const capText = makeText(fonts, { text: caption, role: "body", weight: 600, size: capSize, color: textColor, anchor: 0.5 });
    const chip = new Container();
    chip.position.set(slots[i]!, chipY);
    chip.scale.set(0);
    chip.addChild(makePill(capText.width + chipH * 0.9, chipH, chipBg));
    chip.addChild(capText);
    root.addChild(chip);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: t0 + 0.42, duration: 0.45, ease: makeOutBack(1.9) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: t0 + 0.42, duration: 0.45, ease: makeOutBack(1.9) });

    // A tiny sparkle above each award once it has landed.
    if (showSparkles) {
      const sp = sparkleStar(s * 0.05, gold);
      sp.position.set(slots[i]! + (i % 2 === 0 ? 1 : -1) * s * 0.3, shelfY - s * (0.56 + 0.05 * i));
      sp.alpha = 0;
      sp.scale.set(0);
      root.addChild(sp);
      const ts = 2.1 + i * 0.12;
      timeline
        .to(sp, { prop: "alpha", from: 0, to: 0.9, start: ts, duration: 0.25, ease: outQuad })
        .to(sp, { prop: "scale.x", from: 0, to: 1, start: ts, duration: 0.45, ease: makeOutBack(2.4) })
        .to(sp, { prop: "scale.y", from: 0, to: 1, start: ts, duration: 0.45, ease: makeOutBack(2.4) });
    }
  });

  // --- Final lockup line ---
  const lockSize = fitSize(fonts, lockup, "display", 700, Math.round(minDim * 0.034), zone.width * 0.82);
  const lockText = makeText(fonts, { text: lockup, role: "display", weight: 700, size: lockSize, color: textColor, anchor: 0.5, align: "center" });
  lockText.position.set(center.x, lockupY);
  lockText.alpha = 0;
  root.addChild(lockText);
  timeline
    .to(lockText, { prop: "alpha", from: 0, to: 1, start: 2.35, duration: 0.45, ease: outQuad })
    .to(lockText, { prop: "y", from: lockupY + 12, to: lockupY, start: 2.35, duration: 0.5, ease: outQuint });

  return { timeline, duration: DURATION };
}

export const trophyShelf: TemplateDefinition = {
  id: "trophy-shelf",
  name: "Trophy Shelf",
  tagline: "Three awards land on a shelf under a spotlight, each with its own caption.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { lockup: "display" },
  palettes: PALETTES,
  fields: [
    {
      key: "captions",
      type: "textlist",
      label: "Award captions",
      default: DEFAULT_CAPTIONS,
      minItems: 3,
      maxItems: 3,
      maxLength: 18,
      help: "One caption per award, left to right.",
    },
    { key: "lockup", type: "text", label: "Lockup line", default: "Voted best three years running", maxLength: 44, shrinkToFit: true },
    { key: "showSpotlight", type: "toggle", label: "Spotlight sweep", default: true },
    { key: "showSparkles", type: "toggle", label: "Sparkles", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outExpo,
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

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

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

/** A 4-point compass star (heritage ornament), centered at origin. */
function compassStar(s: number, color: string): Graphics {
  const k = 0.26;
  return new Graphics()
    .poly([0, -s, s * k, -s * k, s, 0, s * k, s * k, 0, s, -s * k, s * k, -s, 0, -s * k, -s * k])
    .fill(color);
}

// A heritage crest built from type on a circle: the ring draws on, letterspaced
// capitals run around it, and a big serif monogram lands in the middle. Ring +
// circular text use textColor, the monogram + ornaments use the accent — both
// sit on the background, so both pairs are kept ≥ 4.5:1.
const PALETTES: Palette[] = [
  { id: "ivory", name: "Ivory", colors: { background: "#F6F1E7", textColor: "#241C10", accent: "#6D4E11" } },
  { id: "porcelain", name: "Porcelain", colors: { background: "#EEF2F7", textColor: "#101B2E", accent: "#1E3A8A" } },
  { id: "forest", name: "Forest", colors: { background: "#10241A", textColor: "#F2EDE0", accent: "#D8B45A" } },
  { id: "blush", name: "Blush", colors: { background: "#F7EDF0", textColor: "#33121F", accent: "#7C2247" } },
];

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const RING_START = 0.15;
const RING_DUR = 0.95;
const INNER_DELAY = 0.25;
const CHAR_START = 0.55;
const CHAR_SPREAD = 1.15;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6F1E7"));
  const textColor = str(values.textColor, pc("textColor", "#241C10"));
  const accent = str(values.accent, pc("accent", "#6D4E11"));

  const monogram = str(values.monogram, "JM").slice(0, 2).toUpperCase();
  const ringText = str(values.ringText, "ESTABLISHED MMXXVI • HERITAGE • QUALITY •").toUpperCase();
  const showInnerRing = values.showInnerRing !== false;
  const showOrnaments = values.showOrnaments !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const center = safeCenter(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const R = Math.min(zone.width, zone.height) * 0.36;
  const crest = new Container();
  crest.position.set(center.x, center.y);
  root.addChild(crest);
  timeline
    .to(crest, { prop: "scale.x", from: 0.96, to: 1, start: 0, duration: 1.4, ease: outExpo })
    .to(crest, { prop: "scale.y", from: 0.96, to: 1, start: 0, duration: 1.4, ease: outExpo });

  // --- Rings (drawn on via the pure update hook) ---
  const ringG = new Graphics();
  crest.addChild(ringG);
  const ringW = Math.max(3, R * 0.022);
  const innerW = Math.max(2, R * 0.011);

  // --- Circular text: one Text per character, placed and rotated on the arc ---
  const chars = ringText.split("");
  const n = chars.length;
  const rText = R * 0.845;
  const slotArc = (Math.PI * 2 * rText) / n;
  const charSize = Math.round(Math.min(R * 0.105, slotArc * 0.72));
  chars.forEach((chr, i) => {
    if (chr === " ") return; // spaces keep their slot but render nothing
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const holder = new Container();
    holder.position.set(Math.cos(a) * rText, Math.sin(a) * rText);
    holder.rotation = a + Math.PI / 2;
    holder.alpha = 0;
    holder.scale.set(0.3);
    crest.addChild(holder);
    holder.addChild(
      makeText(fonts, { text: chr, role: "serif", weight: 600, size: charSize, color: textColor, anchor: 0.5 }),
    );
    const start = CHAR_START + (i / Math.max(1, n)) * CHAR_SPREAD;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(holder, { prop: "scale.x", from: 0.3, to: 1, start, duration: 0.4, ease: makeOutBack(1.8) })
      .to(holder, { prop: "scale.y", from: 0.3, to: 1, start, duration: 0.4, ease: makeOutBack(1.8) });
  });

  // --- Monogram (big serif letters at the center) ---
  const monoSize = fitSize(fonts, monogram, "serif", 600, Math.round(R * 0.58), R * 0.74);
  const mono = makeText(fonts, {
    text: monogram,
    role: "serif",
    weight: 600,
    size: monoSize,
    color: accent,
    anchor: 0.5,
    letterSpacing: Math.round(R * 0.02),
  });
  mono.position.set(0, R * 0.01);
  mono.alpha = 0;
  mono.scale.set(0.5);
  crest.addChild(mono);
  timeline
    .to(mono, { prop: "alpha", from: 0, to: 1, start: 1.9, duration: 0.35, ease: outQuad })
    .to(mono, { prop: "scale.x", from: 0.5, to: 1, start: 1.9, duration: 0.6, ease: makeOutBack(1.6) })
    .to(mono, { prop: "scale.y", from: 0.5, to: 1, start: 1.9, duration: 0.6, ease: makeOutBack(1.6) });

  // --- Side ornaments: two compass stars flanking the monogram ---
  if (showOrnaments) {
    [-1, 1].forEach((dir, i) => {
      const orn = compassStar(R * 0.055, accent);
      orn.position.set(dir * R * 0.53, 0);
      orn.alpha = 0;
      orn.scale.set(0);
      crest.addChild(orn);
      const start = 2.5 + i * 0.12;
      timeline
        .to(orn, { prop: "alpha", from: 0, to: 1, start, duration: 0.2, ease: outQuad })
        .to(orn, { prop: "scale.x", from: 0, to: 1, start, duration: 0.45, ease: makeOutBack(2.2) })
        .to(orn, { prop: "scale.y", from: 0, to: 1, start, duration: 0.45, ease: makeOutBack(2.2) })
        .to(orn, { prop: "rotation", from: -0.5, to: 0, start, duration: 0.45, ease: outCubic });
    });
  }

  // Rings redraw as a pure function of t (stroke draw-on, clockwise from 12).
  const update = (t: number): void => {
    ringG.clear();
    const a0 = -Math.PI / 2;
    const p = outCubic(clamp01((t - RING_START) / RING_DUR));
    if (p > 0.002) {
      ringG.arc(0, 0, R, a0, a0 + p * Math.PI * 2).stroke({ color: textColor, width: ringW, cap: "round" });
    }
    if (showInnerRing) {
      const p2 = outCubic(clamp01((t - RING_START - INNER_DELAY) / RING_DUR));
      if (p2 > 0.002) {
        ringG
          .arc(0, 0, R * 0.7, a0, a0 + p2 * Math.PI * 2)
          .stroke({ color: textColor, width: innerW, cap: "round" });
      }
    }
  };

  return { timeline, duration: DURATION, update };
}

export const crestMonogram: TemplateDefinition = {
  id: "crest-monogram",
  name: "Crest Monogram",
  tagline: "A heritage crest: the ring draws on, your name circles it, the monogram lands.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.5,
  fontRoles: { monogram: "serif", ringText: "serif" },
  palettes: PALETTES,
  fields: [
    { key: "monogram", type: "text", label: "Monogram (1–2 letters)", default: "JM", maxLength: 2, shrinkToFit: true },
    {
      key: "ringText",
      type: "text",
      label: "Circular text",
      default: "ESTABLISHED MMXXVI • HERITAGE • QUALITY •",
      maxLength: 60,
      shrinkToFit: true,
      help: "Runs clockwise around the ring; letters space out evenly.",
    },
    { key: "showInnerRing", type: "toggle", label: "Inner ring", default: true },
    { key: "showOrnaments", type: "toggle", label: "Side ornaments", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Ring & text", default: "", optional: true },
    { key: "accent", type: "color", label: "Monogram", default: "", optional: true },
  ],
  build,
};

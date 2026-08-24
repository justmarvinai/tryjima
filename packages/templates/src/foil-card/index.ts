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

/** A 4-point sparkle star, centered at origin. */
function sparkleStar(s: number, color: string): Graphics {
  const k = 0.24;
  return new Graphics()
    .poly([0, -s, s * k, -s * k, s, 0, s * k, s * k, 0, s, -s * k, s * k, -s, 0, -s * k, -s * k])
    .fill(color);
}

// A collectible brand card that tilts in faux-3D while a diagonal foil band
// sweeps its face. Card text (initial, name, label) sits on cardBg at ≥ 4.5:1;
// the foil color is decorative (borders, shine, sparkles).
const PALETTES: Palette[] = [
  { id: "onyx-gold", name: "Onyx gold", colors: { background: "#F5F2EC", cardBg: "#16110B", onCard: "#F5E9CD", foil: "#D8B45A" } },
  { id: "silver-slate", name: "Silver slate", colors: { background: "#EEF1F5", cardBg: "#1A2330", onCard: "#EAF0F8", foil: "#A9BFD8" } },
  { id: "emerald-holo", name: "Emerald holo", colors: { background: "#EFF6F1", cardBg: "#0C2B1D", onCard: "#E9F5ED", foil: "#5BC98F" } },
  { id: "plum-rose", name: "Plum rose", colors: { background: "#F8F0F3", cardBg: "#340F20", onCard: "#F9E9F0", foil: "#E491B6" } },
];

const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const smooth = (a: number, b: number, x: number): number => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};

const SWEEP_IN_START = 0.5;
const SWEEP_IN_DUR = 0.8;
const WOB_START = 1.3; // wobble phase begins exactly where the entrance sweep parks
const WOB_PERIOD = 2.2;
const WOB_END = WOB_START + WOB_PERIOD; // one full cycle → tilt and shine settle
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F2EC"));
  const cardBg = pc("cardBg", "#16110B");
  const onCard = str(values.textColor, pc("onCard", "#F5E9CD"));
  const foil = str(values.accent, pc("foil", "#D8B45A"));

  const initial = str(values.initial, "A").slice(0, 2).toUpperCase();
  const name = str(values.name, "AURUM STUDIO").toUpperCase();
  const label = str(values.label, "COLLECTOR EDITION").toUpperCase();
  const showFoil = values.showFoil !== false;
  const showCorners = values.showCorners !== false;
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

  const cardH = Math.min(zone.height * 0.78, minDim * 0.72);
  const cardW = cardH * 0.72;
  const radius = cardH * 0.045;

  const cardIn = new Container(); // entrance (timeline-driven)
  cardIn.position.set(center.x, center.y);
  root.addChild(cardIn);
  const cardTilt = new Container(); // faux-3D wobble (update-driven)
  cardIn.addChild(cardTilt);

  // Soft shadow, body.
  cardTilt.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - 4, -cardH / 2 + cardH * 0.02, cardW + 8, cardH + 8, radius + 4)
      .fill({ color: "#000000", alpha: 0.16 }),
  );
  cardTilt.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill(cardBg));

  // --- Foil face layer (holo stripes + sweeping shine), clipped to the card ---
  const shineC = new Container();
  if (showFoil) {
    const face = new Container();
    cardTilt.addChild(face);
    const faceMask = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill("#FFFFFF");
    cardTilt.addChild(faceMask);
    face.mask = faceMask;

    // Static diagonal holo stripes so the settled frame still reads "foil".
    for (let i = 0; i < 3; i++) {
      const stripe = new Graphics()
        .rect(-cardW * 0.055, -cardH * 1.1, cardW * 0.11, cardH * 2.2)
        .fill({ color: foil, alpha: 0.09 });
      stripe.rotation = -0.55;
      stripe.position.set(-cardW * 0.34 + i * cardW * 0.34, 0);
      face.addChild(stripe);
    }

    // The sweeping shine band (position driven by the pure update hook).
    shineC.rotation = -0.55;
    shineC.addChild(
      new Graphics()
        .rect(-cardW * 0.155 - cardW * 0.07, -cardH * 1.3, cardW * 0.14, cardH * 2.6)
        .fill({ color: "#FFFFFF", alpha: 0.12 })
        .rect(-cardW * 0.09, -cardH * 1.3, cardW * 0.18, cardH * 2.6)
        .fill({ color: "#FFFFFF", alpha: 0.3 })
        .rect(cardW * 0.155 - cardW * 0.07, -cardH * 1.3, cardW * 0.14, cardH * 2.6)
        .fill({ color: foil, alpha: 0.16 }),
    );
    shineC.position.set(-cardW * 1.15, 0);
    face.addChild(shineC);
  }

  // --- Fine double border ---
  cardTilt.addChild(
    new Graphics()
      .roundRect(-cardW / 2 + cardH * 0.018, -cardH / 2 + cardH * 0.018, cardW - cardH * 0.036, cardH - cardH * 0.036, radius * 0.8)
      .stroke({ color: foil, width: Math.max(2.5, cardH * 0.006) }),
  );
  cardTilt.addChild(
    new Graphics()
      .roundRect(-cardW / 2 + cardH * 0.042, -cardH / 2 + cardH * 0.042, cardW - cardH * 0.084, cardH - cardH * 0.084, radius * 0.6)
      .stroke({ color: foil, width: Math.max(1.2, cardH * 0.0028), alpha: 0.7 }),
  );

  // --- Corner ornaments ---
  if (showCorners) {
    const inset = cardH * 0.075;
    const positions: Array<[number, number]> = [
      [-cardW / 2 + inset, -cardH / 2 + inset],
      [cardW / 2 - inset, -cardH / 2 + inset],
      [-cardW / 2 + inset, cardH / 2 - inset],
      [cardW / 2 - inset, cardH / 2 - inset],
    ];
    positions.forEach(([px, py], i) => {
      const orn = sparkleStar(cardH * 0.02, foil);
      orn.position.set(px, py);
      orn.alpha = 0.85;
      orn.scale.set(0);
      cardTilt.addChild(orn);
      const start = 0.9 + i * 0.07;
      timeline
        .to(orn, { prop: "scale.x", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(2) })
        .to(orn, { prop: "scale.y", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(2) });
    });
  }

  // --- Logo initial + divider + brand name + fine label ---
  const initSize = fitSize(fonts, initial, "serif", 600, Math.round(cardH * 0.3), cardW * 0.6);
  const initText = makeText(fonts, { text: initial, role: "serif", weight: 600, size: initSize, color: foil, anchor: 0.5 });
  initText.position.set(0, -cardH * 0.13);
  initText.alpha = 0;
  initText.scale.set(0.6);
  cardTilt.addChild(initText);
  timeline
    .to(initText, { prop: "alpha", from: 0, to: 1, start: 0.45, duration: 0.35, ease: outQuad })
    .to(initText, { prop: "scale.x", from: 0.6, to: 1, start: 0.45, duration: 0.55, ease: makeOutBack(1.7) })
    .to(initText, { prop: "scale.y", from: 0.6, to: 1, start: 0.45, duration: 0.55, ease: makeOutBack(1.7) });

  const divider = new Container();
  divider.position.set(0, cardH * 0.055);
  divider.scale.x = 0;
  const dLen = cardW * 0.36;
  const dH = Math.max(1.5, cardH * 0.004);
  const dDia = cardH * 0.012;
  divider.addChild(
    new Graphics()
      .rect(-dLen / 2, -dH / 2, dLen, dH)
      .fill({ color: foil, alpha: 0.9 })
      .poly([0, -dDia, dDia, 0, 0, dDia, -dDia, 0])
      .fill(foil),
  );
  cardTilt.addChild(divider);
  timeline.to(divider, { prop: "scale.x", from: 0, to: 1, start: 0.65, duration: 0.5, ease: outExpo });

  const nameSize = fitSize(fonts, name, "display", 700, Math.round(cardH * 0.052), cardW * 0.78);
  const nameText = makeText(fonts, {
    text: name,
    role: "display",
    weight: 700,
    size: nameSize,
    color: onCard,
    anchor: 0.5,
    letterSpacing: 3,
  });
  nameText.position.set(0, cardH * 0.135);
  nameText.alpha = 0;
  cardTilt.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0.7, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: cardH * 0.135 + 10, to: cardH * 0.135, start: 0.7, duration: 0.45, ease: outExpo });

  const labelSize = fitSize(fonts, label, "body", 600, Math.round(cardH * 0.028), cardW * 0.74);
  const labelText = makeText(fonts, {
    text: label,
    role: "body",
    weight: 600,
    size: labelSize,
    color: onCard,
    anchor: 0.5,
    letterSpacing: 4,
  });
  labelText.position.set(0, cardH * 0.215);
  labelText.alpha = 0;
  cardTilt.addChild(labelText);
  timeline.to(labelText, { prop: "alpha", from: 0, to: 0.78, start: 0.85, duration: 0.4, ease: outQuad });

  // --- Twinkling sparkles just off the card corners ---
  if (showSparkles) {
    const spots: Array<[number, number, number]> = [
      [cardW * 0.58, -cardH * 0.42, cardH * 0.028],
      [-cardW * 0.6, cardH * 0.34, cardH * 0.022],
    ];
    spots.forEach(([px, py, s], i) => {
      const sp = sparkleStar(s, foil);
      sp.position.set(px, py);
      sp.alpha = 0;
      sp.scale.set(0);
      cardIn.addChild(sp);
      const start = 1.2 + i * 0.35;
      timeline
        .to(sp, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
        .to(sp, { prop: "alpha", from: 1, to: 0.6, start: start + 0.5, duration: 0.5, ease: outQuad })
        .to(sp, { prop: "scale.x", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2.4) })
        .to(sp, { prop: "scale.y", from: 0, to: 1, start, duration: 0.5, ease: makeOutBack(2.4) })
        .to(sp, { prop: "rotation", from: -0.6, to: 0, start, duration: 0.6, ease: outCubic });
    });
  }

  // --- Entrance ---
  timeline
    .to(cardIn, { prop: "alpha", from: 0, to: 1, start: 0.12, duration: 0.4, ease: outQuad })
    .to(cardIn, { prop: "y", from: center.y + cardH * 0.06, to: center.y, start: 0.12, duration: 0.7, ease: outExpo })
    .to(cardIn, { prop: "scale.x", from: 0.94, to: 1, start: 0.12, duration: 0.7, ease: outExpo })
    .to(cardIn, { prop: "scale.y", from: 0.94, to: 1, start: 0.12, duration: 0.7, ease: outExpo });

  // Faux-3D tilt + foil sweep as a pure function of t. The entrance sweep hands
  // off to a single cosine cycle (continuous at WOB_START), and everything is
  // exactly settled from WOB_END on.
  const update = (t: number): void => {
    const tt = Math.min(t, WOB_END);
    let xn: number; // shine offset in card-widths
    let wob = 0; // tilt factor in [-1, 1]
    if (tt < WOB_START) {
      const p = outCubic(clamp01((tt - SWEEP_IN_START) / SWEEP_IN_DUR));
      xn = -1.15 + 2.3 * p;
    } else {
      const theta = ((tt - WOB_START) / WOB_PERIOD) * Math.PI * 2;
      xn = 1.15 * Math.cos(theta);
      const env = smooth(WOB_START, WOB_START + 0.6, tt) * (1 - smooth(WOB_END - 0.6, WOB_END, tt));
      wob = -Math.sin(theta) * env;
    }
    cardTilt.rotation = 0.042 * wob;
    cardTilt.skew.x = 0.06 * wob;
    cardTilt.skew.y = -0.02 * wob;
    if (showFoil) shineC.position.x = xn * cardW;
  };

  return { timeline, duration: DURATION, update };
}

export const foilCard: TemplateDefinition = {
  id: "foil-card",
  name: "Foil Card",
  tagline: "A collectible brand card tilts in 3D while a foil shine sweeps its face.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.9,
  fontRoles: { initial: "serif", name: "display" },
  palettes: PALETTES,
  fields: [
    { key: "initial", type: "text", label: "Logo initial", default: "A", maxLength: 2, shrinkToFit: true },
    { key: "name", type: "text", label: "Brand name", default: "AURUM STUDIO", maxLength: 22, shrinkToFit: true },
    { key: "label", type: "text", label: "Fine label", default: "COLLECTOR EDITION", maxLength: 26, shrinkToFit: true },
    { key: "showFoil", type: "toggle", label: "Foil shine", default: true },
    { key: "showCorners", type: "toggle", label: "Corner ornaments", default: true },
    { key: "showSparkles", type: "toggle", label: "Sparkles", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Card text", default: "", optional: true },
    { key: "accent", type: "color", label: "Foil", default: "", optional: true },
  ],
  build,
};

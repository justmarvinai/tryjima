import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  inOutCubic,
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
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

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
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

/** Compass angle (clockwise from north) → screen offset on a circle of radius r. */
const polarX = (a: number, r: number): number => Math.sin(a) * r;
const polarY = (a: number, r: number): number => -Math.cos(a) * r;

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

// `dialColor` is the instrument face — its own key so recoloring the frame
// background (or exporting with alpha) leaves the compass intact.
const PALETTES: Palette[] = [
  { id: "bone-navy", name: "Bone & navy", colors: { background: "#F5F2EC", dialColor: "#FFFFFF", textColor: "#131A24", accent: "#1F4FD8" } },
  { id: "charcoal-brass", name: "Charcoal & brass", colors: { background: "#14181D", dialColor: "#1C222A", textColor: "#F2F0EA", accent: "#D9A441" } },
  { id: "sea-glass", name: "Sea glass", colors: { background: "#E9F2F1", dialColor: "#FFFFFF", textColor: "#0F2622", accent: "#0E7C6B" } },
  { id: "dune", name: "Dune", colors: { background: "#FBF4E9", dialColor: "#FFFFFF", textColor: "#2A1D10", accent: "#C4622D" } },
];

const SPIN_START = 0.55;
const SPIN_DUR = 2.0;
const SETTLE_START = SPIN_START + SPIN_DUR;
const SETTLE_DUR = 0.7;
const TURNS = 2.25;
const OVERSHOOT = 0.13; // radians — a whisper past the mark, then it eases back
const DURATION = 4.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F2EC"));
  const dialColor = str(values.dialColor, pc("dialColor", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#131A24"));
  const accent = str(values.accent, pc("accent", "#1F4FD8"));

  const place = str(values.place, "Reykjavík");
  const distance = str(values.distance, "1,482 km · Northeast");
  const bearing = ((Math.round(num(values.bearing, 42)) % 360) + 360) % 360;
  const showTicks = values.showTicks !== false;
  const showCardinals = values.showCardinals !== false;
  const showBearing = values.showBearing !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Layout: dial above, name + distance beneath, the pair centered ---
  const placeSize = fitSize(fonts, place, "display", 700, Math.round(minDim * 0.068), zone.width * 0.86);
  const distSize = fitSize(fonts, distance, "body", 500, Math.round(minDim * 0.028), zone.width * 0.8);
  const textBlockH = placeSize * 1.15 + minDim * 0.022 + distSize * 1.5;
  const gapCT = minDim * 0.055;
  const availH = zone.height - textBlockH - gapCT;
  const r = Math.min(zone.width * 0.4, availH * 0.48, minDim * 0.34);
  const top = zone.y + (zone.height - (2 * r + gapCT + textBlockH)) / 2;
  const ccy = top + r;
  const placeY = top + 2 * r + gapCT + placeSize * 0.62;
  const distY = placeY + placeSize * 0.62 + minDim * 0.022 + distSize * 0.6;

  // --- The dial ---
  const dial = new Container();
  dial.position.set(cx, ccy);
  dial.alpha = 0;
  dial.scale.set(0.94);
  root.addChild(dial);
  timeline
    .to(dial, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.6, ease: outQuad })
    .to(dial, { prop: "scale.x", from: 0.94, to: 1, start: 0.05, duration: 0.95, ease: outExpo })
    .to(dial, { prop: "scale.y", from: 0.94, to: 1, start: 0.05, duration: 0.95, ease: outExpo });

  const hair = Math.max(1.2, r * 0.008);
  dial.addChild(
    new Graphics()
      .circle(0, 0, r)
      .fill(dialColor)
      .circle(0, 0, r)
      .stroke({ color: textColor, width: hair * 1.8, alpha: 0.22 }),
  );

  if (showTicks) {
    const ticks = new Graphics();
    for (let i = 0; i < 24; i++) {
      if (i % 6 === 0) continue; // the four cardinals carry letters instead
      const a = i * 15 * DEG;
      const major = i % 3 === 0;
      const r0 = r * 0.93;
      const r1 = r0 - (major ? r * 0.1 : r * 0.05);
      ticks
        .moveTo(polarX(a, r0), polarY(a, r0))
        .lineTo(polarX(a, r1), polarY(a, r1))
        .stroke({ color: textColor, width: major ? hair * 1.6 : hair, alpha: major ? 0.42 : 0.24, cap: "round" });
    }
    ticks.alpha = 0;
    dial.addChild(ticks);
    timeline.to(ticks, { prop: "alpha", from: 0, to: 1, start: 0.25, duration: 0.7, ease: outQuad });
  }

  if (showCardinals) {
    const letters: { c: string; a: number }[] = [
      { c: "N", a: 0 },
      { c: "E", a: 90 * DEG },
      { c: "S", a: 180 * DEG },
      { c: "W", a: 270 * DEG },
    ];
    letters.forEach((l, i) => {
      const isNorth = i === 0;
      const t = makeText(fonts, {
        text: l.c,
        role: "body",
        weight: isNorth ? 700 : 600,
        size: Math.max(10, Math.round(r * 0.15)),
        color: isNorth ? accent : textColor,
        anchor: 0.5,
      });
      t.position.set(polarX(l.a, r * 0.8), polarY(l.a, r * 0.8));
      t.alpha = 0;
      dial.addChild(t);
      timeline.to(t, { prop: "alpha", from: 0, to: isNorth ? 1 : 0.5, start: 0.32 + i * 0.08, duration: 0.5, ease: outQuad });
    });
  }

  // Faint hub ring, then the needle itself.
  dial.addChild(new Graphics().circle(0, 0, r * 0.24).stroke({ color: textColor, width: hair, alpha: 0.12 }));

  const target = bearing * DEG;
  const a1 = target + OVERSHOOT;
  const a0 = a1 - TAU * TURNS;

  const needle = new Container();
  needle.rotation = a0;
  needle.alpha = 0;
  dial.addChild(needle);
  needle.addChild(
    new Graphics()
      .poly([0, -r * 0.66, r * 0.05, 0, -r * 0.05, 0])
      .fill(accent)
      .poly([0, r * 0.4, r * 0.042, 0, -r * 0.042, 0])
      .fill({ color: textColor, alpha: 0.32 }),
  );
  needle.addChild(
    new Graphics()
      .circle(0, 0, r * 0.05)
      .fill(dialColor)
      .circle(0, 0, r * 0.05)
      .stroke({ color: textColor, width: hair * 1.4, alpha: 0.35 }),
  );
  timeline
    .to(needle, { prop: "alpha", from: 0, to: 1, start: 0.4, duration: 0.45, ease: outQuad })
    // One long decelerating sweep, then a small eased settle back onto the mark.
    .to(needle, { prop: "rotation", from: a0, to: a1, start: SPIN_START, duration: SPIN_DUR, ease: outQuint })
    .to(needle, { prop: "rotation", from: a1, to: target, start: SETTLE_START, duration: SETTLE_DUR, ease: inOutCubic });

  // --- Rolling degree readout on the face (pure function of t) ---
  let bearingText: Text | null = null;
  if (showBearing) {
    const t = makeText(fonts, {
      text: `${bearing}°`,
      role: "mono",
      weight: 700,
      size: Math.max(10, Math.round(r * 0.155)),
      color: textColor,
      anchor: 0.5,
      letterSpacing: 1,
    });
    t.position.set(0, r * 0.52);
    t.alpha = 0;
    dial.addChild(t);
    bearingText = t;
    timeline.to(t, { prop: "alpha", from: 0, to: 0.85, start: 0.62, duration: 0.5, ease: outQuad });
  }

  // --- Destination + distance settle beneath ---
  const placeText = makeText(fonts, { text: place, role: "display", weight: 700, size: placeSize, color: textColor, anchor: 0.5, align: "center" });
  placeText.position.set(cx, placeY);
  placeText.alpha = 0;
  root.addChild(placeText);
  timeline
    .to(placeText, { prop: "alpha", from: 0, to: 1, start: 2.9, duration: 0.5, ease: outQuad })
    .to(placeText, { prop: "y", from: placeY - 14, to: placeY, start: 2.9, duration: 0.65, ease: outQuint });

  const distText = makeText(fonts, { text: distance, role: "body", weight: 500, size: distSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 2 });
  distText.position.set(cx, distY);
  distText.alpha = 0;
  root.addChild(distText);
  timeline
    .to(distText, { prop: "alpha", from: 0, to: 0.72, start: 3.2, duration: 0.5, ease: outQuad })
    .to(distText, { prop: "y", from: distY - 9, to: distY, start: 3.2, duration: 0.6, ease: outQuint });

  /** Needle angle at time t — mirrors the two rotation tweens exactly. */
  const angleAt = (t: number): number => {
    if (t <= SPIN_START) return a0;
    if (t < SETTLE_START) return a0 + (a1 - a0) * outQuint((t - SPIN_START) / SPIN_DUR);
    return a1 + (target - a1) * inOutCubic(clamp01((t - SETTLE_START) / SETTLE_DUR));
  };

  const update = (t: number): void => {
    if (!bearingText) return;
    const deg = Math.round(((((angleAt(t) / DEG) % 360) + 360) % 360)) % 360;
    const label = `${deg}°`;
    if (bearingText.text !== label) bearingText.text = label;
  };

  return { timeline, duration: DURATION, update };
}

export const compassBearing: TemplateDefinition = {
  id: "compass-bearing",
  name: "Compass",
  tagline: "A compass needle sweeps around and settles on your bearing as the destination lands.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 4.2,
  fontRoles: { place: "display", distance: "body" },
  palettes: PALETTES,
  fields: [
    { key: "place", type: "text", label: "Destination", default: "Reykjavík", maxLength: 22, shrinkToFit: true },
    { key: "distance", type: "text", label: "Distance line", default: "1,482 km · Northeast", maxLength: 32, shrinkToFit: true },
    { key: "bearing", type: "slider", label: "Bearing", default: 42, min: 0, max: 359, step: 1, help: "Degrees clockwise from north — where the needle comes to rest." },
    { key: "showTicks", type: "toggle", label: "Tick ring", default: true },
    { key: "showCardinals", type: "toggle", label: "N/E/S/W letters", default: true },
    { key: "showBearing", type: "toggle", label: "Degree readout", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "dialColor", type: "color", label: "Dial face", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Needle", default: "", optional: true },
  ],
  build,
};

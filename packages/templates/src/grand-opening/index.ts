import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
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
const on = (v: unknown): boolean => v !== false;

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

// Name / date / kicker render in textColor on background (>= 4.5:1). The accent
// drives the ribbon + knot; scissors use textColor so they read over the ribbon.
const PALETTES: Palette[] = [
  { id: "festive-red", name: "Festive red", colors: { background: "#FBF1E8", textColor: "#34140C", accent: "#C22E2E" } },
  { id: "royal", name: "Royal", colors: { background: "#F0ECF8", textColor: "#241452", accent: "#6B3FA0" } },
  { id: "teal-pop", name: "Teal pop", colors: { background: "#E7F6F4", textColor: "#08302C", accent: "#0E9C86" } },
  { id: "midnight-gold", name: "Midnight gold", colors: { background: "#14161F", textColor: "#F6F0E2", accent: "#E0B23A" } },
];

function makeScissors(S: number, color: string): Graphics {
  const g = new Graphics();
  const lw = Math.max(2, 0.07 * S);
  g.moveTo(-0.28 * S, 0.22 * S).lineTo(0.62 * S, -0.14 * S).stroke({ color, width: lw, cap: "round" });
  g.moveTo(-0.28 * S, -0.22 * S).lineTo(0.62 * S, 0.14 * S).stroke({ color, width: lw, cap: "round" });
  g.circle(-0.36 * S, 0.28 * S, 0.14 * S).stroke({ color, width: lw });
  g.circle(-0.36 * S, -0.28 * S, 0.14 * S).stroke({ color, width: lw });
  g.circle(0.02 * S, 0, 0.055 * S).fill(color);
  return g;
}

const CUT = 1.5;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF1E8"));
  const textColor = str(values.textColor, pc("textColor", "#34140C"));
  const accent = str(values.accent, pc("accent", "#C22E2E"));

  const name = str(values.name, "Bloom & Vine");
  const date = str(values.date, "Opening June 1st");
  const showRibbon = on(values.showRibbon);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const maxW = zone.width * 0.9;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Kicker ---
  const kickerSize = fitSize(fonts, "GRAND OPENING", "body", 700, Math.round(minDim * 0.036), maxW);
  const kickerY = zone.y + kickerSize * 1.1;
  const kicker = makeText(fonts, { text: "GRAND OPENING", role: "body", weight: 700, size: kickerSize, color: textColor, anchor: 0.5, letterSpacing: 4 });
  kicker.position.set(cx, kickerY);
  kicker.alpha = 0;
  root.addChild(kicker);
  timeline
    .to(kicker, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.45, ease: outQuad })
    .to(kicker, { prop: "y", from: kickerY - 10, to: kickerY, start: 0.1, duration: 0.5, ease: outQuint });

  // --- Name + date (revealed behind the ribbon) ---
  const nameSize = fitSize(fonts, name, "display", 700, Math.round(minDim * 0.092), maxW);
  const dateSize = fitSize(fonts, date, "body", 500, Math.round(minDim * 0.036), maxW);
  const nameY = zone.y + zone.height * 0.5 - dateSize * 0.4;
  const dateY = nameY + nameSize * 0.62 + dateSize * 0.9;

  const nameStart = showRibbon ? CUT + 0.05 : 0.5;
  const dateStart = showRibbon ? CUT + 0.28 : 0.75;

  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  nameText.scale.set(0.7);
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: nameStart, duration: 0.35, ease: outQuad })
    .to(nameText, { prop: "scale.x", from: 0.7, to: 1, start: nameStart, duration: 0.6, ease: makeOutBack(2) })
    .to(nameText, { prop: "scale.y", from: 0.7, to: 1, start: nameStart, duration: 0.6, ease: makeOutBack(2) });

  const dateText = makeText(fonts, { text: date, role: "body", weight: 500, size: dateSize, color: textColor, anchor: 0.5, letterSpacing: 1 });
  dateText.position.set(cx, dateY + 10);
  dateText.alpha = 0;
  root.addChild(dateText);
  timeline
    .to(dateText, { prop: "alpha", from: 0, to: 0.85, start: dateStart, duration: 0.45, ease: outQuad })
    .to(dateText, { prop: "y", from: dateY + 10, to: dateY, start: dateStart, duration: 0.5, ease: outQuint });

  // --- Ribbon that stretches across, is cut, and springs apart ---
  if (showRibbon) {
    const ribbonY = nameY;
    const ribbonH = minDim * 0.055;
    const half = w * 0.54;

    const leftC = new Container();
    leftC.position.set(cx, ribbonY);
    leftC.scale.set(0, 1);
    root.addChild(leftC);
    leftC.addChild(new Graphics().roundRect(-half, -ribbonH / 2, half, ribbonH, ribbonH * 0.25).fill(accent));

    const rightC = new Container();
    rightC.position.set(cx, ribbonY);
    rightC.scale.set(0, 1);
    root.addChild(rightC);
    rightC.addChild(new Graphics().roundRect(0, -ribbonH / 2, half, ribbonH, ribbonH * 0.25).fill(accent));

    timeline
      .to(leftC, { prop: "scale.x", from: 0, to: 1, start: 0.25, duration: 0.6, ease: outExpo })
      .to(rightC, { prop: "scale.x", from: 0, to: 1, start: 0.25, duration: 0.6, ease: outExpo });

    // Center knot (a small bow).
    const knot = new Container();
    knot.position.set(cx, ribbonY);
    knot.scale.set(0);
    root.addChild(knot);
    const kw = ribbonH * 1.0;
    const bow = new Graphics();
    bow.poly([0, 0, -kw, -kw * 0.7, -kw, kw * 0.7]).fill(accent);
    bow.poly([0, 0, kw, -kw * 0.7, kw, kw * 0.7]).fill(accent);
    bow.circle(0, 0, ribbonH * 0.42).fill(accent);
    knot.addChild(bow);
    timeline
      .to(knot, { prop: "scale.x", from: 0, to: 1, start: 0.85, duration: 0.45, ease: makeOutBack(2.2) })
      .to(knot, { prop: "scale.y", from: 0, to: 1, start: 0.85, duration: 0.45, ease: makeOutBack(2.2) });

    // Scissors slide in, snip, fade.
    const scissorsSize = minDim * 0.11;
    const scissors = makeScissors(scissorsSize, textColor);
    scissors.position.set(w + scissorsSize, ribbonY);
    root.addChild(scissors);
    timeline
      .to(scissors, { prop: "x", from: w + scissorsSize, to: cx + scissorsSize * 0.5, start: 0.95, duration: 0.55, ease: outExpo })
      .to(scissors, { prop: "rotation", from: 0.18, to: -0.05, start: CUT - 0.1, duration: 0.18, ease: outQuad })
      .to(scissors, { prop: "rotation", from: -0.05, to: 0.1, start: CUT + 0.08, duration: 0.2, ease: outQuad })
      .to(scissors, { prop: "alpha", from: 1, to: 0, start: CUT + 0.2, duration: 0.3, ease: outQuad });

    // The cut — halves spring apart, knot collapses.
    timeline
      .to(leftC, { prop: "x", from: cx, to: cx - w * 0.85, start: CUT, duration: 0.65, ease: outExpo })
      .to(leftC, { prop: "rotation", from: 0, to: -0.12, start: CUT, duration: 0.65, ease: outExpo })
      .to(leftC, { prop: "alpha", from: 1, to: 0, start: CUT + 0.25, duration: 0.5, ease: outQuad })
      .to(rightC, { prop: "x", from: cx, to: cx + w * 0.85, start: CUT, duration: 0.65, ease: outExpo })
      .to(rightC, { prop: "rotation", from: 0, to: 0.12, start: CUT, duration: 0.65, ease: outExpo })
      .to(rightC, { prop: "alpha", from: 1, to: 0, start: CUT + 0.25, duration: 0.5, ease: outQuad })
      .to(knot, { prop: "scale.x", from: 1, to: 0, start: CUT, duration: 0.3, ease: outQuad })
      .to(knot, { prop: "scale.y", from: 1, to: 0, start: CUT, duration: 0.3, ease: outQuad });
  }

  return { timeline, duration: DURATION };
}

export const grandOpening: TemplateDefinition = {
  id: "grand-opening",
  name: "Grand Opening",
  tagline: "A ribbon stretches across, gets snipped, and springs apart to reveal the name.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { name: "display", date: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Bloom & Vine", maxLength: 28, shrinkToFit: true },
    { key: "date", type: "text", label: "Date / details", default: "Opening June 1st", maxLength: 32, shrinkToFit: true },
    { key: "showRibbon", type: "toggle", label: "Ribbon + scissors", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

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
  return w > maxWidth ? Math.max(11, Math.floor((size * maxWidth) / w)) : size;
}

const initialOf = (s: string): string => {
  const t = s.trim();
  return t.length > 0 ? t.charAt(0).toUpperCase() : "";
};

// Elegant, serif-leaning invitation palettes. Names / date / venue always render
// in textColor on background (each pairing is >= 4.5:1); the accent drives the
// decorative "&", the thin rule and the monogram ring only.
const PALETTES: Palette[] = [
  { id: "ivory-gold", name: "Ivory + gold", colors: { background: "#FBF6EC", textColor: "#2B2418", accent: "#8A6A12" } },
  { id: "blush", name: "Blush", colors: { background: "#FBEEF0", textColor: "#3E1E2A", accent: "#A5324F" } },
  { id: "sage", name: "Sage", colors: { background: "#EEF2E8", textColor: "#26311E", accent: "#456024" } },
  { id: "midnight", name: "Midnight", colors: { background: "#14202E", textColor: "#F1E9D6", accent: "#D6B24A" } },
];

const DURATION = 4.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF6EC"));
  const textColor = str(values.textColor, pc("textColor", "#2B2418"));
  const accent = str(values.accent, pc("accent", "#8A6A12"));

  const name1 = str(values.name1, "Olivia");
  const name2 = str(values.name2, "James");
  const date = str(values.date, "June 14, 2026");
  const venue = str(values.venue, "Rosewood Garden");
  const showMonogram = on(values.showMonogram);
  const showRule = on(values.showRule);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const maxTextW = zone.width * 0.9;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Metrics (measured first so the whole stack can be vertically centered) ---
  const monoR = minDim * 0.072;
  const monoH = showMonogram ? monoR * 2 : 0;
  const nameSize = fitSize(fonts, name1.length >= name2.length ? name1 : name2, "serif", 600, Math.round(minDim * 0.082), maxTextW);
  const ampSize = Math.round(minDim * 0.058);
  const ruleH = showRule ? Math.max(minDim * 0.05, 8) : 0;
  const dateSize = fitSize(fonts, date, "body", 500, Math.round(minDim * 0.033), maxTextW);
  const venueSize = fitSize(fonts, venue, "body", 500, Math.round(minDim * 0.028), maxTextW);

  const gapS = minDim * 0.024;
  const gapM = minDim * 0.035;
  const nameLH = Math.round(nameSize * 1.06);
  const ampLH = Math.round(ampSize * 1.0);

  const totalH =
    (showMonogram ? monoH + gapM : 0) +
    nameLH +
    gapS +
    ampLH +
    gapS +
    nameLH +
    (showRule ? gapM + ruleH + gapM : gapM) +
    dateSize +
    gapS +
    venueSize;

  let cursorY = zone.y + zone.height / 2 - totalH / 2;

  // --- Monogram ring (decorative) ---
  if (showMonogram) {
    const mono = new Container();
    mono.position.set(cx, cursorY + monoR);
    mono.scale.set(0);
    root.addChild(mono);
    mono.addChild(new Graphics().circle(0, 0, monoR).stroke({ color: accent, width: Math.max(2, monoR * 0.05) }));
    const monoLabel = `${initialOf(name1)}${initialOf(name2)}`;
    const monoFont = fitSize(fonts, monoLabel, "serif", 600, Math.round(monoR * 0.86), monoR * 1.25);
    mono.addChild(makeText(fonts, { text: monoLabel, role: "serif", weight: 600, size: monoFont, color: accent, anchor: 0.5, letterSpacing: 1 }));
    timeline
      .to(mono, { prop: "scale.x", from: 0, to: 1, start: 0.1, duration: 0.6, ease: makeOutBack(1.8) })
      .to(mono, { prop: "scale.y", from: 0, to: 1, start: 0.1, duration: 0.6, ease: makeOutBack(1.8) });
    cursorY += monoH + gapM;
  }

  // --- Name 1 ---
  const name1Y = cursorY + nameLH / 2;
  const name1Text = makeText(fonts, { text: name1, role: "serif", weight: 600, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  name1Text.position.set(cx, name1Y);
  name1Text.alpha = 0;
  root.addChild(name1Text);
  timeline
    .to(name1Text, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.5, ease: outQuad })
    .to(name1Text, { prop: "y", from: name1Y - 14, to: name1Y, start: 0.3, duration: 0.6, ease: outExpo });
  cursorY += nameLH + gapS;

  // --- Ampersand ---
  const ampY = cursorY + ampLH / 2;
  const ampText = makeText(fonts, { text: "&", role: "serif", weight: 500, size: ampSize, color: accent, anchor: 0.5 });
  ampText.position.set(cx, ampY);
  ampText.alpha = 0;
  ampText.scale.set(0.6);
  root.addChild(ampText);
  timeline
    .to(ampText, { prop: "alpha", from: 0, to: 1, start: 0.62, duration: 0.4, ease: outQuad })
    .to(ampText, { prop: "scale.x", from: 0.6, to: 1, start: 0.62, duration: 0.6, ease: makeOutBack(2.2) })
    .to(ampText, { prop: "scale.y", from: 0.6, to: 1, start: 0.62, duration: 0.6, ease: makeOutBack(2.2) });
  cursorY += ampLH + gapS;

  // --- Name 2 ---
  const name2Y = cursorY + nameLH / 2;
  const name2Text = makeText(fonts, { text: name2, role: "serif", weight: 600, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  name2Text.position.set(cx, name2Y);
  name2Text.alpha = 0;
  root.addChild(name2Text);
  timeline
    .to(name2Text, { prop: "alpha", from: 0, to: 1, start: 0.82, duration: 0.5, ease: outQuad })
    .to(name2Text, { prop: "y", from: name2Y - 14, to: name2Y, start: 0.82, duration: 0.6, ease: outExpo });
  cursorY += nameLH + (showRule ? gapM : gapM);

  // --- Thin decorative rule with a center diamond (draws out from the middle) ---
  if (showRule) {
    const ruleY = cursorY + ruleH / 2;
    const ruleW = Math.min(zone.width * 0.5, minDim * 0.42);
    const rule = new Container();
    rule.position.set(cx, ruleY);
    rule.scale.set(0, 1);
    root.addChild(rule);
    const lineW = Math.max(1.5, minDim * 0.004);
    const gapC = minDim * 0.03;
    const g = new Graphics();
    g.moveTo(-ruleW / 2, 0).lineTo(-gapC, 0).stroke({ color: accent, width: lineW, cap: "round" });
    g.moveTo(gapC, 0).lineTo(ruleW / 2, 0).stroke({ color: accent, width: lineW, cap: "round" });
    const dSize = minDim * 0.016;
    g.poly([0, -dSize, dSize, 0, 0, dSize, -dSize, 0]).fill(accent);
    rule.addChild(g);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 1.05, duration: 0.55, ease: outQuint });
    cursorY += ruleH + gapM;
  }

  // --- Date ---
  const dateY = cursorY + dateSize / 2;
  const dateText = makeText(fonts, { text: date, role: "body", weight: 500, size: dateSize, color: textColor, anchor: 0.5, letterSpacing: 1.5 });
  dateText.position.set(cx, dateY);
  dateText.alpha = 0;
  root.addChild(dateText);
  timeline
    .to(dateText, { prop: "alpha", from: 0, to: 1, start: 1.35, duration: 0.5, ease: outQuad })
    .to(dateText, { prop: "y", from: dateY + 10, to: dateY, start: 1.35, duration: 0.55, ease: outQuint });
  cursorY += dateSize + gapS;

  // --- Venue ---
  const venueY = cursorY + venueSize / 2;
  const venueText = makeText(fonts, { text: venue, role: "body", weight: 500, size: venueSize, color: textColor, anchor: 0.5, letterSpacing: 1 });
  venueText.position.set(cx, venueY);
  venueText.alpha = 0;
  root.addChild(venueText);
  timeline
    .to(venueText, { prop: "alpha", from: 0, to: 0.82, start: 1.5, duration: 0.5, ease: outQuad })
    .to(venueText, { prop: "y", from: venueY + 10, to: venueY, start: 1.5, duration: 0.55, ease: outQuint });

  return { timeline, duration: DURATION };
}

export const weddingInvite: TemplateDefinition = {
  id: "wedding-invite",
  name: "Wedding Invite",
  tagline: "Two names join under a monogram as a thin rule, date, and venue settle in.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { name1: "serif", name2: "serif", date: "body", venue: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name1", type: "text", label: "First name", default: "Olivia", maxLength: 22, shrinkToFit: true },
    { key: "name2", type: "text", label: "Second name", default: "James", maxLength: 22, shrinkToFit: true },
    { key: "date", type: "text", label: "Date", default: "June 14, 2026", maxLength: 28, shrinkToFit: true },
    { key: "venue", type: "text", label: "Venue", default: "Rosewood Garden", maxLength: 32, shrinkToFit: true },
    { key: "showMonogram", type: "toggle", label: "Monogram ring", default: true },
    { key: "showRule", type: "toggle", label: "Decorative rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  spring,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

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

// Kicker/place/country all render in textColor on background (>= 4.5:1); the
// accent drives the pin and the thin rule only.
const PALETTES: Palette[] = [
  { id: "sunset", name: "Sunset", colors: { background: "#FFF1E6", textColor: "#3A1600", accent: "#DD5F22" } },
  { id: "ocean", name: "Ocean", colors: { background: "#E9F2F8", textColor: "#0A2A3E", accent: "#1C74B8" } },
  { id: "sand", name: "Sand", colors: { background: "#F5EEE0", textColor: "#2E2410", accent: "#9C7422" } },
  { id: "night", name: "Night", colors: { background: "#101418", textColor: "#F2F4F6", accent: "#4FC3F7" } },
];

const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF1E6"));
  const textColor = str(values.textColor, pc("textColor", "#3A1600"));
  const accent = str(values.accent, pc("accent", "#DD5F22"));

  const place = str(values.place, "Lisbon");
  const country = str(values.country, "Portugal");
  const kickerRaw = str(values.kicker, "NEXT STOP");
  const showPin = on(values.showPin);
  const showRule = on(values.showRule);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);
  const maxW = zone.width * 0.92;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Metrics for a centered stack: [pin] kicker (rule) place country ---
  const pinSize = minDim * 0.12;
  const pinBlockH = showPin ? pinSize : 0;
  const kickerSize = fitSize(fonts, kickerRaw, "body", 700, Math.round(minDim * 0.036), maxW);
  const ruleH = showRule ? Math.max(minDim * 0.02, 6) : 0;
  const placeSize = fitSize(fonts, place, "display", 700, Math.round(minDim * 0.14), maxW);
  const countrySize = fitSize(fonts, country, "body", 500, Math.round(minDim * 0.044), maxW);

  const gapS = minDim * 0.022;
  const gapM = minDim * 0.035;
  const totalH =
    pinBlockH + (showPin ? gapM : 0) +
    kickerSize + (showRule ? gapS + ruleH : 0) + gapS +
    placeSize + gapS +
    countrySize;
  let cursorY = zone.y + zone.height / 2 - totalH / 2;

  // --- Pin drop ---
  if (showPin) {
    const pinTipY = cursorY + pinSize;
    const pinC = new Container();
    pinC.pivot.set(0, pinSize * 0.5);
    pinC.addChild(makeIcon("pin", pinSize, { color: accent, holeColor: bg }));
    pinC.position.set(cx, pinTipY);
    root.addChild(pinC);
    timeline
      .to(pinC, { prop: "y", from: pinTipY - h * 0.55, to: pinTipY, start: 0.3, duration: 0.7, ease: makeOutBack(1.9) })
      .to(pinC, { prop: "scale.y", from: 1, to: 0.84, start: 1.0, duration: 0.09, ease: outQuad })
      .to(pinC, { prop: "scale.y", from: 0.84, to: 1, start: 1.09, duration: 0.22, ease: outQuad })
      .to(pinC, { prop: "scale.x", from: 1, to: 1.14, start: 1.0, duration: 0.09, ease: outQuad })
      .to(pinC, { prop: "scale.x", from: 1.14, to: 1, start: 1.09, duration: 0.22, ease: outQuad });
    cursorY += pinBlockH + gapM;
  }

  const textStart = showPin ? 1.15 : 0.2;

  // --- Kicker ---
  const kickerY = cursorY + kickerSize / 2;
  const kicker = makeText(fonts, { text: kickerRaw, role: "body", weight: 700, size: kickerSize, color: textColor, anchor: 0.5, letterSpacing: 5 });
  kicker.position.set(cx, kickerY);
  kicker.alpha = 0;
  root.addChild(kicker);
  timeline
    .to(kicker, { prop: "alpha", from: 0, to: 1, start: textStart, duration: 0.4, ease: outQuad })
    .to(kicker, { prop: "y", from: kickerY - 8, to: kickerY, start: textStart, duration: 0.45, ease: outQuint });
  cursorY += kickerSize + gapS;

  // --- Optional rule ---
  if (showRule) {
    const ruleY = cursorY + ruleH / 2;
    const ruleW = Math.min(zone.width * 0.32, minDim * 0.28);
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH * 0.18, ruleW, Math.max(2, ruleH * 0.36), ruleH * 0.18).fill(accent);
    rule.position.set(cx, ruleY);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: textStart + 0.12, duration: 0.45, ease: outQuint });
    cursorY += ruleH + gapS;
  }

  // --- Place (hero) ---
  const placeY = cursorY + placeSize / 2;
  const placeText = makeText(fonts, { text: place, role: "display", weight: 700, size: placeSize, color: textColor, anchor: 0.5, align: "center" });
  placeText.position.set(cx, placeY);
  placeText.alpha = 0;
  placeText.scale.set(0.7);
  root.addChild(placeText);
  timeline
    .to(placeText, { prop: "alpha", from: 0, to: 1, start: textStart + 0.2, duration: 0.4, ease: outQuad })
    .to(placeText, { prop: "scale.x", from: 0.7, to: 1, start: textStart + 0.2, duration: 0.7, ease: spring(0.5) })
    .to(placeText, { prop: "scale.y", from: 0.7, to: 1, start: textStart + 0.2, duration: 0.7, ease: spring(0.5) });
  cursorY += placeSize + gapS;

  // --- Country ---
  const countryY = cursorY + countrySize / 2;
  const countryText = makeText(fonts, { text: country, role: "body", weight: 500, size: countrySize, color: textColor, anchor: 0.5, letterSpacing: 1 });
  countryText.position.set(cx, countryY + 10);
  countryText.alpha = 0;
  root.addChild(countryText);
  timeline
    .to(countryText, { prop: "alpha", from: 0, to: 0.85, start: textStart + 0.45, duration: 0.45, ease: outQuad })
    .to(countryText, { prop: "y", from: countryY + 10, to: countryY, start: textStart + 0.45, duration: 0.5, ease: outExpo });

  return { timeline, duration: DURATION };
}

export const destinationReveal: TemplateDefinition = {
  id: "destination-reveal",
  name: "Destination Reveal",
  tagline: "A pin drops in and a huge place name lands under a NEXT STOP kicker.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { place: "display", country: "body" },
  palettes: PALETTES,
  fields: [
    { key: "place", type: "text", label: "Place", default: "Lisbon", maxLength: 20, shrinkToFit: true },
    { key: "country", type: "text", label: "Country", default: "Portugal", maxLength: 24, shrinkToFit: true },
    { key: "kicker", type: "text", label: "Kicker", default: "NEXT STOP", maxLength: 18, shrinkToFit: true },
    { key: "showPin", type: "toggle", label: "Location pin", default: true },
    { key: "showRule", type: "toggle", label: "Divider rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

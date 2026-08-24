import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  makeOutBack,
  spring,
  safeZone,
  TRANSPARENT_BG,
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

/** Shrink a single-line size so `text` fits `maxWidth`. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// A tight map-pin callout — distinct from the full-scene `location-pin`
// template: a small pin drops into the upper-left area and a compact label
// card sits beside it, sized to sit over footage rather than fill the frame.
// Only the full-frame `bg` rect is tied to the background field (defaults to
// the transparent sentinel so it composites straight onto footage); the card
// uses its own palette-only `cardBg` so the label stays legible once the
// canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "paper-map", name: "Paper map", colors: { cardBg: "#FFFFFF", textColor: "#1E2530", accent: "#FF4D1C" } },
  { id: "night-map", name: "Night map", colors: { cardBg: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "sage-map", name: "Sage map", colors: { cardBg: "#FFFFFF", textColor: "#1B2A20", accent: "#17A34A" } },
  { id: "cobalt-map", name: "Cobalt map", colors: { cardBg: "#0B1F4D", textColor: "#FFFFFF", accent: "#66A9FF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#1E2530"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const place = str(values.place, "Golden Gate Bridge");
  const subtitle = str(values.subtitle, "San Francisco, CA");
  const showRing = values.showRing !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Landing point: anchored toward the upper-left, not dead center. ---
  const safeW = w - zone.left - zone.right;
  const safeH = h - zone.top - zone.bottom;
  const landX = zone.left + safeW * 0.16;
  const landY = zone.top + safeH * 0.24;
  const pinSize = minDim * 0.1;

  // --- Pulsing ring beneath the pin (toggleable) ---
  let ring: Graphics | undefined;
  if (showRing) {
    const ringBaseR = pinSize * 0.42;
    ring = new Graphics().circle(0, 0, ringBaseR).stroke({ color: accent, width: Math.max(2, pinSize * 0.035) });
    ring.position.set(landX, landY);
    ring.alpha = 0;
    root.addChild(ring);
  }

  // --- Pin (drops from above, bounces onto the spot) ---
  const pinC = new Container();
  pinC.pivot.set(0, pinSize * 0.5); // pivot at the pin's tip
  pinC.addChild(makeIcon("pin", pinSize, { color: accent, holeColor: cardBg }));
  pinC.position.set(landX, landY - h * 0.62);
  root.addChild(pinC);

  const dropStart = 0.15;
  const dropDur = 0.6;
  const pinLand = dropStart + dropDur;
  timeline
    .to(pinC, { prop: "y", from: landY - h * 0.62, to: landY, start: dropStart, duration: dropDur, ease: makeOutBack(2) })
    // impact squash about the tip
    .to(pinC, { prop: "scale.y", from: 1, to: 0.84, start: pinLand, duration: 0.08, ease: outQuad })
    .to(pinC, { prop: "scale.y", from: 0.84, to: 1, start: pinLand + 0.08, duration: 0.22, ease: outQuad })
    .to(pinC, { prop: "scale.x", from: 1, to: 1.14, start: pinLand, duration: 0.08, ease: outQuad })
    .to(pinC, { prop: "scale.x", from: 1.14, to: 1, start: pinLand + 0.08, duration: 0.22, ease: outQuad });

  // --- Label card: place name + optional subtitle, beside the pin's body. ---
  const cardLeftX = landX + pinSize * 0.55 + Math.round(pinSize * 0.4);
  const cardCenterYTarget = landY - pinSize * 0.62;

  const cardPadX = Math.round(minDim * 0.024);
  const cardPadY = Math.round(minDim * 0.018);
  const rowGap = Math.round(minDim * 0.006);

  const maxCardW = Math.max(140, w - zone.right - cardLeftX);
  const maxCardTextW = Math.max(80, maxCardW - cardPadX * 2);

  const placeSize = fitSize(fonts, place, "display", 700, Math.round(minDim * 0.038), maxCardTextW);
  const subSize = subtitle.length > 0 ? fitSize(fonts, subtitle, "body", 500, Math.round(minDim * 0.022), maxCardTextW) : 0;

  const placeW = fonts.measure(place, { family: fonts.family("display"), weight: 700, size: placeSize });
  const subW = subtitle.length > 0 ? fonts.measure(subtitle, { family: fonts.family("body"), weight: 500, size: subSize }) : 0;
  const textBlockW = Math.max(placeW, subW);
  const textRowsH = subtitle.length > 0 ? placeSize + rowGap + subSize : placeSize;

  const cardW = Math.min(maxCardW, cardPadX * 2 + textBlockW);
  const cardH = cardPadY * 2 + textRowsH;
  const cardRadius = Math.round(cardH * 0.24);
  const cardCenterX = cardLeftX + cardW / 2;

  const card = new Container();
  card.position.set(cardCenterX, cardCenterYTarget);
  card.scale.set(0.82);
  card.alpha = 0;
  root.addChild(card);

  const e = Math.round(cardH * 0.04);
  const off = Math.round(cardH * 0.07);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - e, -cardH / 2 - e + off, cardW + e * 2, cardH + e * 2, cardRadius + e)
      .fill({ color: "#000000", alpha: 0.16 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(cardBg));

  const leftEdge = -cardW / 2 + cardPadX;
  const placeY = subtitle.length > 0 ? -textRowsH / 2 + placeSize / 2 : 0;
  const subY = subtitle.length > 0 ? textRowsH / 2 - subSize / 2 : 0;

  const placeText = makeText(fonts, {
    text: place,
    role: "display",
    weight: 700,
    size: placeSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  placeText.position.set(leftEdge, placeY);
  card.addChild(placeText);

  if (subtitle.length > 0) {
    const subText = makeText(fonts, {
      text: subtitle,
      role: "body",
      weight: 500,
      size: subSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    subText.alpha = 0.72;
    subText.position.set(leftEdge, subY);
    card.addChild(subText);
  }

  const cardStart = pinLand + 0.1;
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: cardStart, duration: 0.35, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.82, to: 1, start: cardStart, duration: 0.45, ease: spring(0.45) })
    .to(card, { prop: "scale.y", from: 0.82, to: 1, start: cardStart, duration: 0.45, ease: spring(0.45) });

  // --- Pulsing ring update (guarded by showRing) ---
  const RING_PERIOD = 1.6;
  const update = (t: number): void => {
    if (!ring) return;
    if (t < pinLand) {
      ring.alpha = 0;
      return;
    }
    const u = ((t - pinLand) % RING_PERIOD) / RING_PERIOD;
    ring.scale.set(0.6 + 1.1 * outCubic(u));
    ring.alpha = 0.5 * (1 - u);
  };

  return { timeline, duration: 3.6, update };
}

export const locationTag: TemplateDefinition = {
  id: "location-tag",
  name: "Location Tag",
  tagline: "A map pin bounces in with a pulsing ring and a place-name card.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { place: "display", subtitle: "body" },
  palettes: PALETTES,
  fields: [
    { key: "place", type: "text", label: "Place", default: "Golden Gate Bridge", maxLength: 30, shrinkToFit: true },
    { key: "subtitle", type: "text", label: "Subtitle", default: "San Francisco, CA", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "showRing", type: "toggle", label: "Pulsing ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

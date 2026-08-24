import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
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
const DEG = Math.PI / 180;

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
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "sky-transit", name: "Sky transit", colors: { background: "#DCEBFB", cardColor: "#FFFFFF", textColor: "#0B2447", accent: "#2E7DF6" } },
  { id: "kraft-travel", name: "Kraft travel", colors: { background: "#EDE3D2", cardColor: "#FBF6EA", textColor: "#2A1B0E", accent: "#B5541F" } },
  { id: "noir-runway", name: "Noir runway", colors: { background: "#14131A", cardColor: "#201E29", textColor: "#F2EFE6", accent: "#D8F34D" } },
  { id: "blush-getaway", name: "Blush getaway", colors: { background: "#FBE9EE", cardColor: "#FFFFFF", textColor: "#3A0E1E", accent: "#C81361" } },
];

const A0 = 24 * DEG;
const OMEGA = 2 * Math.PI * 0.85;
const DAMPING = 1.15;
const BARCODE_START = 0.85;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#DCEBFB"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0B2447"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));
  const showBarcode = values.showBarcode !== false;

  const codeVal = str(values.code, "CDG").toUpperCase().slice(0, 4);
  const destVal = str(values.destination, "Paris");
  const flightVal = str(values.flightNo, "JM 204");

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const hangX = cx;
  const hangY = zone.y + minDim * 0.02;

  // --- Geometry: strap hangs from the pivot (0,0) down to the tag's top edge,
  // threading through a punched hole near the top of the tag body. ---
  const strapLen = minDim * 0.075;
  const strapW = minDim * 0.02;
  const holeInset = minDim * 0.05;
  const holeR = minDim * 0.017;
  const tagBodyTop = strapLen;
  const holeCy = tagBodyTop + holeInset;
  const tagW = minDim * 0.36;
  const tagH = minDim * 0.46;
  const tagRadius = minDim * 0.026;

  const pivotC = new Container();
  pivotC.position.set(hangX, hangY);
  pivotC.alpha = 0;
  root.addChild(pivotC);
  timeline
    .to(pivotC, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.3, ease: outQuad })
    .to(pivotC, { prop: "scale.x", from: 0.82, to: 1, start: 0.05, duration: 0.5, ease: makeOutBack(1.8) })
    .to(pivotC, { prop: "scale.y", from: 0.82, to: 1, start: 0.05, duration: 0.5, ease: makeOutBack(1.8) });

  // Soft shadow behind the tag.
  const shadowOffset = minDim * 0.012;
  const shadow = new Graphics().roundRect(-tagW / 2, tagBodyTop, tagW, tagH, tagRadius).fill({ color: 0x000000, alpha: 0.16 });
  shadow.position.set(shadowOffset, shadowOffset);
  pivotC.addChild(shadow);

  // Tag body.
  pivotC.addChild(new Graphics().roundRect(-tagW / 2, tagBodyTop, tagW, tagH, tagRadius).fill(cardColor));

  // Strap (renders over the tag's top edge, then the hole punches through both).
  const strap = new Graphics().roundRect(-strapW / 2, 0, strapW, holeCy + holeR, strapW / 2).fill(accent);
  pivotC.addChild(strap);

  const hole = new Graphics().circle(0, holeCy, holeR).fill(bg);
  pivotC.addChild(hole);
  const grommet = new Graphics().circle(0, holeCy, holeR).stroke({ color: textColor, width: Math.max(1.5, minDim * 0.003), alpha: 0.35 });
  pivotC.addChild(grommet);

  // --- Content ---
  const contentTop = holeCy + holeR * 1.8;
  const codeSize0 = Math.round(tagH * 0.16);
  const codeSize = fitSize(fonts, codeVal, "mono", 700, codeSize0, tagW * 0.76);
  const codeY = contentTop + codeSize * 0.62;
  const codeText = makeText(fonts, { text: codeVal, role: "mono", weight: 700, size: codeSize, color: textColor, anchor: 0.5 });
  codeText.position.set(0, codeY);
  codeText.alpha = 0;
  pivotC.addChild(codeText);
  timeline
    .to(codeText, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.35, ease: outQuad })
    .to(codeText, { prop: "scale.x", from: 0.85, to: 1, start: 0.3, duration: 0.45, ease: makeOutBack(1.8) })
    .to(codeText, { prop: "scale.y", from: 0.85, to: 1, start: 0.3, duration: 0.45, ease: makeOutBack(1.8) });

  const destSize0 = Math.round(tagH * 0.075);
  const destSize = fitSize(fonts, destVal, "display", 700, destSize0, tagW * 0.82);
  const destY = codeY + codeSize * 0.68;
  const destText = makeText(fonts, { text: destVal, role: "display", weight: 700, size: destSize, color: textColor, anchor: 0.5, align: "center" });
  destText.position.set(0, destY);
  destText.alpha = 0;
  pivotC.addChild(destText);
  timeline
    .to(destText, { prop: "alpha", from: 0, to: 1, start: 0.48, duration: 0.4, ease: outQuad })
    .to(destText, { prop: "y", from: destY + 10, to: destY, start: 0.48, duration: 0.42, ease: outExpo });

  if (flightVal.length > 0) {
    const flightUpper = flightVal.toUpperCase();
    const flightSize0 = Math.round(tagH * 0.042);
    const flightSize = fitSize(fonts, flightUpper, "body", 600, flightSize0, tagW * 0.78);
    const flightText = makeText(fonts, { text: flightUpper, role: "body", weight: 600, size: flightSize, color: textColor, anchor: 0.5, letterSpacing: 1.5 });
    const flightY = destY + destSize * 0.95;
    flightText.position.set(0, flightY);
    flightText.alpha = 0;
    pivotC.addChild(flightText);
    timeline.to(flightText, { prop: "alpha", from: 0, to: 0.85, start: 0.64, duration: 0.4, ease: outQuad });
  }

  // --- Barcode strip (optional) ---
  if (showBarcode) {
    const barcodeH = minDim * 0.045;
    const barcodeY = tagBodyTop + tagH - minDim * 0.075;
    const barAreaW = tagW * 0.74;
    const N = 26;
    const units: number[] = [];
    for (let i = 0; i < N; i++) units.push(rng.pick([1, 1, 2, 2, 3]));
    const gap = minDim * 0.0026;
    const unitSum = units.reduce((a, b) => a + b, 0);
    const baseUnitPx = (barAreaW - (N - 1) * gap) / unitSum;

    const barcodeG = new Graphics();
    let bx = -barAreaW / 2;
    for (let i = 0; i < N; i++) {
      const bw = units[i]! * baseUnitPx;
      barcodeG.rect(bx, 0, bw, barcodeH).fill(textColor);
      bx += bw + gap;
    }
    barcodeG.position.set(0, barcodeY);
    barcodeG.alpha = 0;
    barcodeG.scale.set(0, 1);
    barcodeG.label = "barcode";
    pivotC.addChild(barcodeG);
    timeline
      .to(barcodeG, { prop: "alpha", from: 0, to: 1, start: BARCODE_START, duration: 0.25, ease: outQuad })
      .to(barcodeG, { prop: "scale.x", from: 0, to: 1, start: BARCODE_START, duration: 0.45, ease: outExpo });
  }

  // Pendulum swing — a damped cosine, pure function of t (no wall clock).
  const update = (t: number): void => {
    pivotC.rotation = A0 * Math.cos(OMEGA * t) * Math.exp(-DAMPING * t);
  };

  return { timeline, duration: DURATION, update };
}

export const luggageTag: TemplateDefinition = {
  id: "luggage-tag",
  name: "Luggage Tag",
  tagline: "An airline tag swings in on its string and settles.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.1,
  fontRoles: { destination: "display" },
  palettes: PALETTES,
  fields: [
    { key: "code", type: "text", label: "Airport code", default: "CDG", maxLength: 4 },
    { key: "destination", type: "text", label: "Destination", default: "Paris", maxLength: 20, shrinkToFit: true },
    { key: "flightNo", type: "text", label: "Flight number", default: "JM 204", maxLength: 10, optional: true },
    { key: "showBarcode", type: "toggle", label: "Barcode strip", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

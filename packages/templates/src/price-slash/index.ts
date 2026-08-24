import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outBack,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", textColor: "#2A0F06", accent: "#C2380F", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#C2380F", onAccent: "#FFFFFF" } },
  { id: "lime-pop", name: "Lime pop", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", onAccent: "#101014" } },
  { id: "berry", name: "Berry", colors: { background: "#FFEEF6", textColor: "#3A0A28", accent: "#C21473", onAccent: "#FFFFFF" } },
];

/** Create text, shrinking one size if it would overflow `maxWidth` (crisp, never upscaled). */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const textColor = str(values.textColor, pc("textColor", "#2A0F06"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = str(values.onAccent, pc("onAccent", "#FFFFFF"));
  const oldPrice = str(values.oldPrice, "$99");
  const newPrice = str(values.newPrice, "$49");
  const label = str(values.label, "Today only");
  const showSlash = values.showSlash !== false;
  const hasLabel = label.length > 0;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Layout: kicker (optional) → old price → new price, vertically centered ---
  const kickerSize = Math.round(minDim * 0.042);
  const oldSize = Math.round(minDim * 0.09);
  const newSize = Math.round(minDim * 0.16);
  const kickerH = kickerSize * 1.3;
  const oldH = oldSize * 1.15;
  const newH = newSize * 1.15;
  const gapK = minDim * 0.045;
  const gapN = minDim * 0.06;
  const totalH = (hasLabel ? kickerH + gapK : 0) + oldH + gapN + newH;

  const top = h * 0.5 - totalH / 2;
  const kickerY = top + kickerH / 2;
  const oldY = top + (hasLabel ? kickerH + gapK : 0) + oldH / 2;
  const newY = oldY + oldH / 2 + gapN + newH / 2;

  // --- Kicker ---
  if (hasLabel) {
    const kick = fitText(
      fonts,
      { text: label.toUpperCase(), role: "body", weight: 600, size: kickerSize, color: accent, anchor: 0.5, align: "center", letterSpacing: 2 },
      w * 0.86,
    );
    kick.position.set(cx, kickerY);
    kick.alpha = 0;
    root.addChild(kick);
    timeline
      .to(kick, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad })
      .to(kick, { prop: "y", from: kickerY - 14, to: kickerY, start: 0.1, duration: 0.5, ease: outExpo });
  }

  // --- Old price (muted, appears first) ---
  const oldText = fitText(
    fonts,
    { text: oldPrice, role: "display", weight: 500, size: oldSize, color: textColor, anchor: 0.5, align: "center" },
    w * 0.7,
  );
  oldText.position.set(cx, oldY);
  oldText.alpha = 0;
  root.addChild(oldText);
  timeline
    .to(oldText, { prop: "alpha", from: 0, to: 0.62, start: 0.35, duration: 0.4, ease: outQuad })
    .to(oldText, { prop: "y", from: oldY + 14, to: oldY, start: 0.35, duration: 0.5, ease: outExpo });

  // --- Slash line strikes through the old price ---
  if (showSlash) {
    const strikeW = oldText.width * 1.2;
    const strikeH = Math.max(3, oldSize * 0.1);
    const strike = new Graphics().roundRect(0, -strikeH / 2, strikeW, strikeH, strikeH / 2).fill(accent);
    strike.position.set(cx - strikeW / 2, oldY);
    strike.rotation = -9 * DEG;
    strike.scale.set(0, 1);
    root.addChild(strike);
    timeline.to(strike, { prop: "scale.x", from: 0, to: 1, start: 0.85, duration: 0.32, ease: outExpo });
  }

  // --- New price pops in beside/below with an accent highlight ---
  const newSizeW = fonts.measure(newPrice, { family: fonts.family("display"), weight: 700, size: newSize });
  const hlW = Math.min(w * 0.92, newSizeW * 1.28);
  const hlH = newSize * 1.14;
  const highlight = new Graphics().roundRect(0, -hlH / 2, hlW, hlH, hlH * 0.22).fill(accent);
  highlight.position.set(cx - hlW / 2, newY);
  highlight.scale.set(0, 1);
  root.addChild(highlight);
  timeline.to(highlight, { prop: "scale.x", from: 0, to: 1, start: 1.2, duration: 0.4, ease: outExpo });

  const newText = fitText(
    fonts,
    { text: newPrice, role: "display", weight: 700, size: newSize, color: onAccent, anchor: 0.5, align: "center" },
    hlW * 0.94,
  );
  newText.position.set(cx, newY);
  newText.alpha = 0;
  newText.scale.set(0.7);
  root.addChild(newText);
  timeline
    .to(newText, { prop: "alpha", from: 0, to: 1, start: 1.4, duration: 0.3, ease: outQuad })
    .to(newText, { prop: "scale.x", from: 0.7, to: 1, start: 1.4, duration: 0.5, ease: outBack })
    .to(newText, { prop: "scale.y", from: 0.7, to: 1, start: 1.4, duration: 0.5, ease: outBack })
    // two subtle emphasis pulses, timed to settle well clear of the poster frame
    .to(newText, { prop: "scale.x", from: 1, to: 1.06, start: 2.0, duration: 0.3, ease: outQuad })
    .to(newText, { prop: "scale.x", from: 1.06, to: 1, start: 2.3, duration: 0.35, ease: outQuad })
    .to(newText, { prop: "scale.y", from: 1, to: 1.06, start: 2.0, duration: 0.3, ease: outQuad })
    .to(newText, { prop: "scale.y", from: 1.06, to: 1, start: 2.3, duration: 0.35, ease: outQuad })
    .to(newText, { prop: "scale.x", from: 1, to: 1.06, start: 3.2, duration: 0.3, ease: outQuad })
    .to(newText, { prop: "scale.x", from: 1.06, to: 1, start: 3.5, duration: 0.35, ease: outQuad })
    .to(newText, { prop: "scale.y", from: 1, to: 1.06, start: 3.2, duration: 0.3, ease: outQuad })
    .to(newText, { prop: "scale.y", from: 1.06, to: 1, start: 3.5, duration: 0.35, ease: outQuad });

  return { timeline, duration: 4.0 };
}

export const priceSlash: TemplateDefinition = {
  id: "price-slash",
  name: "Price Slash",
  tagline: "A slash strikes the old price as the new one pops with a highlight.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.8,
  palettes: PALETTES,
  fields: [
    { key: "oldPrice", type: "text", label: "Old price", default: "$99", maxLength: 12, shrinkToFit: true },
    { key: "newPrice", type: "text", label: "New price", default: "$49", maxLength: 12, shrinkToFit: true },
    { key: "label", type: "text", label: "Label", default: "Today only", maxLength: 26, optional: true },
    { key: "showSlash", type: "toggle", label: "Slash line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "onAccent", type: "color", label: "Price text", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  makeOutBack,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

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

// A vertical bookmark-style tab slides in from the right edge, with an
// optional horizontal callout extending from it — like a page tab with a
// note attached. Only the full-frame `bg` rect is tied to the background
// field (defaults to the transparent sentinel so it composites straight onto
// footage); the tab/callout share a palette-only `tabBg` surface so they read
// as one continuous shape and stay legible once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { tabBg: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "paper", name: "Paper", colors: { tabBg: "#FFFFFF", textColor: "#101014", accent: "#2E7DF6" } },
  { id: "forest", name: "Forest", colors: { tabBg: "#0F2A1E", textColor: "#EAF7ED", accent: "#2BB673" } },
  { id: "berry", name: "Berry", colors: { tabBg: "#2A0A1E", textColor: "#FFF3F8", accent: "#FF2E9E" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const tabBg = pc("tabBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const label = str(values.label, "New");
  const calloutTxt = str(values.callout, "Swipe up for details");
  const showCallout = values.showCallout !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Tab geometry: the label is authored horizontally, then rotated 90°, so
  // its natural (horizontal) width becomes the tab's vertical extent. ---
  const padAlong = Math.round(minDim * 0.03);
  const padAcross = Math.round(minDim * 0.024);
  const maxTabH = h * 0.34;

  const labelSize = fitSize(fonts, label, "display", 700, Math.round(minDim * 0.05), maxTabH - padAlong * 2);
  const labelLen = fonts.measure(label, { family: fonts.family("display"), weight: 700, size: labelSize });

  const tabH = labelLen + padAlong * 2;
  const tabW = Math.round(labelSize * 1.3) + padAcross * 2;
  const tabRadius = Math.round(tabW * 0.3);

  const restY = h / 2;
  const restX = w - zone.right - tabW / 2;
  const startX = w + tabW;

  const tabC = new Container();
  tabC.position.set(startX, restY);
  tabC.alpha = 0;
  root.addChild(tabC);

  // Soft shadow so the tab reads as a distinct surface over any footage.
  const e = Math.round(tabW * 0.05);
  const off = Math.round(tabW * 0.08);
  tabC.addChild(
    new Graphics()
      .roundRect(-tabW / 2 - e, -tabH / 2 - e + off, tabW + e * 2, tabH + e * 2, tabRadius + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  tabC.addChild(new Graphics().roundRect(-tabW / 2, -tabH / 2, tabW, tabH, tabRadius).fill(tabBg));

  const labelText = makeText(fonts, {
    text: label,
    role: "display",
    weight: 700,
    size: labelSize,
    color: textColor,
    anchor: 0.5,
  });
  labelText.rotation = -Math.PI / 2;
  tabC.addChild(labelText);

  // --- Entrance: the tab slides in from off-canvas with a bookmark-flop overshoot. ---
  const tabStart = 0.1;
  const tabDur = 0.55;
  const tabLand = tabStart + tabDur;
  timeline
    .to(tabC, { prop: "x", from: startX, to: restX, start: tabStart, duration: tabDur, ease: makeOutBack(1.55) })
    .to(tabC, { prop: "alpha", from: 0, to: 1, start: tabStart, duration: 0.3, ease: outQuad });

  // --- Callout (toggleable): a small horizontal note extends leftward from the
  // tab's own left edge, so it stays attached through the slide. ---
  if (showCallout) {
    const calloutH = tabW;
    const dotR = Math.round(calloutH * 0.13);
    const dotGap = Math.round(calloutH * 0.16);
    const padXCallout = Math.round(calloutH * 0.32);
    const maxCalloutW = Math.max(90, w - zone.left - zone.right - tabW);
    const innerMaxW = Math.max(50, maxCalloutW - padXCallout * 2 - dotR * 2 - dotGap);

    const calloutSize = fitSize(fonts, calloutTxt, "body", 600, Math.round(calloutH * 0.42), innerMaxW);
    const calloutTextW = fonts.measure(calloutTxt, { family: fonts.family("body"), weight: 600, size: calloutSize });
    const calloutW = Math.min(maxCalloutW, padXCallout * 2 + dotR * 2 + dotGap + calloutTextW);

    const calloutC = new Container();
    calloutC.position.set(-tabW / 2, 0); // local to the tab: its own left edge
    calloutC.scale.set(0, 1);
    calloutC.alpha = 0;
    tabC.addChild(calloutC);

    // Extend a little past the seam (same fill as the tab) so the join reads
    // seamless regardless of corner rounding on either shape.
    const overlap = Math.round(calloutH * 0.3);
    calloutC.addChild(new Graphics().roundRect(-calloutW, -calloutH / 2, calloutW + overlap, calloutH, calloutH / 2).fill(tabBg));

    const dotX = -calloutW + padXCallout + dotR;
    const dot = new Graphics().circle(0, 0, dotR).fill(accent);
    dot.position.set(dotX, 0);
    calloutC.addChild(dot);

    const calloutText = makeText(fonts, {
      text: calloutTxt,
      role: "body",
      weight: 600,
      size: calloutSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    calloutText.position.set(dotX + dotR + dotGap, 0);
    calloutC.addChild(calloutText);

    timeline
      .to(calloutC, { prop: "scale.x", from: 0, to: 1, start: tabLand, duration: 0.42, ease: outExpo })
      .to(calloutC, { prop: "alpha", from: 0, to: 1, start: tabLand, duration: 0.26, ease: outQuad });
  }

  return { timeline, duration: 4.0 };
}

export const sideLabel: TemplateDefinition = {
  id: "side-label",
  name: "Side Label",
  tagline: "A bookmark-style tab slides in from the edge with a note attached.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { label: "display", callout: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Tab label", default: "New", maxLength: 20, shrinkToFit: true },
    { key: "callout", type: "text", label: "Callout", default: "Swipe up for details", maxLength: 44, optional: true, shrinkToFit: true },
    { key: "showCallout", type: "toggle", label: "Callout note", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

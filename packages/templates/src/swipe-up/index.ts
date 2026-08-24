import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  inOutQuad,
  shrinkToFit,
  safeZone,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF4FF", textColor: "#0B2447", accent: "#2E7DF6" } },
  { id: "neon-night", name: "Neon night", colors: { background: "#0B0B14", textColor: "#FFFFFF", accent: "#2EE6D6" } },
];

/** A bold caret "^" pointing up, centered at the origin. */
function makeChevron(size: number, color: string): Graphics {
  const h = size * 0.58;
  return new Graphics()
    .poly([-size / 2, h / 2, 0, -h / 2, size / 2, h / 2], false)
    .stroke({ color, width: Math.max(2, size * 0.14), cap: "round", join: "round" });
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#101014"));
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const showChev = values.showChevrons !== false;
  const label = str(values.label, "Swipe up");

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeZone(ctx.aspect);
  const cx = size.width / 2;

  const familyBody = fonts.family("display");
  const measureLabel = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 700, size: sz });

  const pillW = Math.round(minDim * 0.12);
  const pillH = Math.round(minDim * 0.014);
  const labelFontBase = Math.round(minDim * 0.052);
  const labelFont = shrinkToFit(label, measureLabel, { maxWidth: size.width * 0.82, baseSize: labelFontBase, minSize: Math.round(labelFontBase * 0.55) });
  const chevSize = Math.round(minDim * 0.09);
  const chevH = chevSize * 0.58;
  const chevGap = Math.round(chevSize * 0.62);
  const chevStep = chevH + chevGap;

  const bottomMargin = Math.round(minDim * 0.035);
  const bottomY = size.height - safe.bottom - bottomMargin;
  const gap1 = Math.round(labelFontBase * 0.5);
  const gap2 = Math.round(labelFontBase * 0.55);

  const pillCenterY = bottomY - pillH / 2;
  const labelCenterY = pillCenterY - pillH / 2 - gap1 - labelFont * 0.55;
  const chev0CenterY = labelCenterY - labelFont * 0.55 - gap2 - chevH / 2;
  const chev1CenterY = chev0CenterY - chevStep;
  const chev2CenterY = chev1CenterY - chevStep;

  // Pill hint (a small drag-handle capsule) — pops in first.
  const pill = new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillH / 2).fill(accent);
  pill.position.set(cx, pillCenterY);
  pill.alpha = 0;
  pill.scale.set(0.6);
  root.addChild(pill);
  timeline
    .to(pill, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.3, ease: outQuad })
    .to(pill, { prop: "scale.x", from: 0.6, to: 1, start: 0.1, duration: 0.5, ease: makeOutBack(1.8) })
    .to(pill, { prop: "scale.y", from: 0.6, to: 1, start: 0.1, duration: 0.5, ease: makeOutBack(1.8) });

  // Label, fading up just after the pill.
  const labelText = makeText(fonts, { text: label, role: "display", weight: 700, size: labelFont, color: textColor, anchor: 0.5, align: "center" });
  labelText.position.set(cx, labelCenterY + 16);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.4, ease: outQuad })
    .to(labelText, { prop: "y", from: labelCenterY + 16, to: labelCenterY, start: 0.2, duration: 0.5, ease: outExpo });

  // Stacked chevrons: fade to a resting trail, then nudge upward in repeating,
  // staggered cycles for the rest of the hold — the "swipe up" flow.
  const NUDGE_BASE = 0.8;
  const NUDGE_PERIOD = 0.6;
  const NUDGE_CYCLES = 4;
  const NUDGE_DIST = minDim * 0.018;
  const NUDGE_UP = 0.16;
  const NUDGE_DOWN = 0.22;

  const addChevron = (baseY: number, baseAlpha: number, phase: number, inStart: number): void => {
    const node = makeChevron(chevSize, accent);
    node.position.set(cx, baseY);
    node.alpha = 0;
    root.addChild(node);
    timeline.to(node, { prop: "alpha", from: 0, to: baseAlpha, start: inStart, duration: 0.3, ease: outQuad });
    const peakAlpha = Math.min(1, baseAlpha + 0.3);
    for (let c = 0; c < NUDGE_CYCLES; c++) {
      const s = NUDGE_BASE + c * NUDGE_PERIOD + phase;
      timeline
        .to(node, { prop: "y", from: baseY, to: baseY - NUDGE_DIST, start: s, duration: NUDGE_UP, ease: outQuad })
        .to(node, { prop: "y", from: baseY - NUDGE_DIST, to: baseY, start: s + NUDGE_UP, duration: NUDGE_DOWN, ease: inOutQuad })
        .to(node, { prop: "alpha", from: baseAlpha, to: peakAlpha, start: s, duration: NUDGE_UP, ease: outQuad })
        .to(node, { prop: "alpha", from: peakAlpha, to: baseAlpha, start: s + NUDGE_UP, duration: NUDGE_DOWN, ease: inOutQuad });
    }
  };

  if (showChev) {
    addChevron(chev0CenterY, 1.0, 0, 0.32);
    addChevron(chev1CenterY, 0.6, 0.08, 0.38);
    addChevron(chev2CenterY, 0.32, 0.16, 0.44);
  }

  return { timeline, duration: 4.0 };
}

export const swipeUp: TemplateDefinition = {
  id: "swipe-up",
  name: "Swipe Up",
  tagline: "A swipe-up hint nudges with rising chevrons and a pill handle.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  // After the last chevron nudge settles (~3.14s) so the poster shows a clean
  // resting stack, not three chevrons frozen at different mid-nudge offsets.
  posterTime: 3.4,
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Swipe up", maxLength: 24, shrinkToFit: true },
    { key: "showChevrons", type: "toggle", label: "Chevrons", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6" } },
  { id: "moss", name: "Moss", colors: { background: "#F0F7EC", textColor: "#123318", accent: "#4CAF50" } },
  { id: "plum", name: "Plum", colors: { background: "#FBF0FA", textColor: "#3A0E42", accent: "#B23AC9" } },
];

// A 270° speedometer opening at the bottom (135°..405°, i.e. the long way
// around through the top) — the classic gauge shape.
const START_ANGLE = 0.75 * Math.PI;
const SWEEP = 1.5 * Math.PI;

interface Layout {
  cx: number;
  cy: number;
  R: number;
}

function layoutFor(aspect: Aspect, w: number, h: number): Layout {
  const minDim = Math.min(w, h);
  switch (aspect) {
    case "16:9":
      return { cx: w * 0.5, cy: h * 0.6, R: minDim * 0.33 };
    case "9:16":
      return { cx: w * 0.5, cy: h * 0.4, R: minDim * 0.35 };
    case "4:5":
      return { cx: w * 0.5, cy: h * 0.4, R: minDim * 0.33 };
    default:
      return { cx: w * 0.5, cy: h * 0.43, R: minDim * 0.34 }; // 1:1
  }
}

const COUNT_START = 0.4;
const COUNT_DUR = 1.75;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));

  const value = Math.max(0, num(values.value, 72));
  const maxValue = Math.max(1, num(values.maxValue, 100));
  const unit = str(values.unit, "%");
  const label = str(values.label, "Performance score");
  const showNeedle = values.showNeedle !== false;
  const showAccentRing = values.accentRing !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const L = layoutFor(ctx.aspect, w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const strokeW = Math.max(10, L.R * 0.16);

  // --- Decorative accent ring (purely ornamental, toggled) ---
  if (showAccentRing) {
    const ring = new Graphics().circle(0, 0, L.R * 1.16).stroke({ color: accent, width: Math.max(2, L.R * 0.02), alpha: 0.28 });
    ring.position.set(L.cx, L.cy);
    ring.alpha = 0;
    ring.scale.set(0.9);
    root.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.9, to: 1, start: 0.1, duration: 0.6, ease: outQuint })
      .to(ring, { prop: "scale.y", from: 0.9, to: 1, start: 0.1, duration: 0.6, ease: outQuint });
  }

  // --- Faint full track ---
  const track = new Graphics().arc(0, 0, L.R, START_ANGLE, START_ANGLE + SWEEP).stroke({ color: textColor, width: strokeW, alpha: 0.1, cap: "round" });
  track.position.set(L.cx, L.cy);
  track.alpha = 0;
  root.addChild(track);
  timeline.to(track, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad });

  // --- Min / max tick labels at the two open ends ---
  const tickSize = Math.round(minDim * 0.026);
  const tickR = L.R * 1.22;
  const maxAngle = START_ANGLE + SWEEP;
  const minTickX = L.cx + Math.cos(START_ANGLE) * tickR;
  const minTickY = L.cy + Math.sin(START_ANGLE) * tickR;
  const maxTickX = L.cx + Math.cos(maxAngle) * tickR;
  const maxTickY = L.cy + Math.sin(maxAngle) * tickR;

  const minLabelRaw = `0${unit}`;
  const minTickSize = fitSize(fonts, minLabelRaw, "body", 600, tickSize, L.R * 0.6);
  const minTick = makeText(fonts, { text: minLabelRaw, role: "body", weight: 600, size: minTickSize, color: textColor, anchor: { x: 0.5, y: 0 } });
  minTick.position.set(minTickX, minTickY);
  minTick.alpha = 0;
  root.addChild(minTick);

  const maxLabelRaw = `${groupThousands(maxValue)}${unit}`;
  const maxTickSize = fitSize(fonts, maxLabelRaw, "body", 600, tickSize, L.R * 0.6);
  const maxTick = makeText(fonts, { text: maxLabelRaw, role: "body", weight: 600, size: maxTickSize, color: textColor, anchor: { x: 0.5, y: 0 } });
  maxTick.position.set(maxTickX, maxTickY);
  maxTick.alpha = 0;
  root.addChild(maxTick);

  timeline
    .to(minTick, { prop: "alpha", from: 0, to: 0.65, start: 0.15, duration: 0.4, ease: outQuad })
    .to(maxTick, { prop: "alpha", from: 0, to: 0.65, start: 0.2, duration: 0.4, ease: outQuad });

  // --- Value arc (redrawn per frame — geometry can't be tweened directly) ---
  const ring = new Graphics();
  ring.position.set(L.cx, L.cy);
  root.addChild(ring);

  // --- Needle + hub, toggled ---
  let needle: Graphics | null = null;
  if (showNeedle) {
    const needleLen = L.R * 0.82;
    const hubR = Math.max(8, L.R * 0.09);
    needle = new Graphics().poly([needleLen, 0, -hubR * 0.65, -hubR * 0.55, -hubR * 0.65, hubR * 0.55]).fill(textColor);
    needle.position.set(L.cx, L.cy);
    needle.rotation = START_ANGLE;
    needle.alpha = 0;
    root.addChild(needle);
    timeline.to(needle, { prop: "alpha", from: 0, to: 0.92, start: 0.3, duration: 0.4, ease: outQuad });

    const hub = new Graphics().circle(0, 0, hubR).fill(textColor).stroke({ color: bg, width: Math.max(2, hubR * 0.3) });
    hub.position.set(L.cx, L.cy);
    hub.scale.set(0);
    root.addChild(hub);
    timeline
      .to(hub, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.5, ease: outQuint })
      .to(hub, { prop: "scale.y", from: 0, to: 1, start: 0.3, duration: 0.5, ease: outQuint });
  }

  // --- Big center number ---
  const numY = L.cy + L.R * 0.28;
  const finalDisplay = `${groupThousands(value)}${unit}`;
  const baseNumSize = Math.round(L.R * 0.5);
  const numSize = fitSize(fonts, finalDisplay, "display", 700, baseNumSize, L.R * 1.5);
  const numberText = makeText(fonts, { text: `0${unit}`, role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5, align: "center" });
  numberText.position.set(L.cx, numY);
  numberText.alpha = 0;
  root.addChild(numberText);
  timeline
    .to(numberText, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.4, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 0.85, to: 1, start: 0.2, duration: 0.5, ease: outQuint })
    .to(numberText, { prop: "scale.y", from: 0.85, to: 1, start: 0.2, duration: 0.5, ease: outQuint });
  // Landing beat once the count finishes.
  timeline
    .to(numberText, { prop: "scale.x", from: 1, to: 1.08, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 1.08, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.2, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1, to: 1.08, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1.08, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.2, ease: outQuad });

  // --- Caption label, below the number ---
  const labelSize = fitSize(fonts, label, "body", 600, Math.round(L.R * 0.19), L.R * 1.5);
  const labelY = numY + numSize * 0.62;
  const labelText = makeText(fonts, { text: label, role: "body", weight: 600, size: labelSize, color: textColor, anchor: 0.5, align: "center" });
  labelText.position.set(L.cx, labelY);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 0.85, start: 0.9, duration: 0.4, ease: outQuad })
    .to(labelText, { prop: "y", from: labelY + 10, to: labelY, start: 0.9, duration: 0.45, ease: outQuint });

  const finalFrac = clamp01(value / maxValue);
  const update = (t: number): void => {
    const p = outExpo(clamp01((t - COUNT_START) / COUNT_DUR));
    numberText.text = groupThousands(value * p) + unit;
    const frac = finalFrac * p;
    ring.clear();
    if (frac > 0.0008) {
      const endAngle = START_ANGLE + frac * SWEEP;
      ring.arc(0, 0, L.R, START_ANGLE, endAngle).stroke({ color: accent, width: strokeW, cap: "round" });
    }
    if (needle) needle.rotation = START_ANGLE + frac * SWEEP;
  };

  return { timeline, duration: 4.2, update };
}

export const gaugeMeter: TemplateDefinition = {
  id: "gauge-meter",
  name: "Gauge Meter",
  tagline: "A speedometer arc and needle sweep to a value that counts up.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { value: "display", label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "value", type: "slider", label: "Value", default: 72, min: 0, max: 999, step: 1 },
    { key: "maxValue", type: "slider", label: "Scale max", default: 100, min: 1, max: 999, step: 1 },
    { key: "unit", type: "text", label: "Unit", default: "%", maxLength: 6, optional: true },
    { key: "label", type: "text", label: "Label", default: "Performance score", maxLength: 32, shrinkToFit: true },
    { key: "showNeedle", type: "toggle", label: "Needle", default: true },
    { key: "accentRing", type: "toggle", label: "Accent ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

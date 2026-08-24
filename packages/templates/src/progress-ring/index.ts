import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  safeZone,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6" } },
  { id: "moss", name: "Moss", colors: { background: "#F0F7EC", textColor: "#123318", accent: "#4CAF50" } },
  { id: "plum", name: "Plum", colors: { background: "#FBF0FA", textColor: "#3A0E42", accent: "#B23AC9" } },
];

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const percent = Math.max(1, Math.min(100, Math.round(num(values.percent, 76))));
  const label = str(values.label, "Complete");
  const showTrack = values.showTrack !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const insets = safeZone(ctx.aspect);
  const cy = (insets.top + (h - insets.bottom)) / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const R = minDim * 0.32;
  const strokeW = Math.max(6, R * 0.16);

  // --- Faint full track ---
  if (showTrack) {
    const track = new Graphics().circle(cx, cy, R).stroke({ color: textColor, width: strokeW, alpha: 0.12 });
    track.alpha = 0;
    root.addChild(track);
    timeline.to(track, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad });
  }

  // --- Sweeping progress arc (redrawn per frame — geometry can't be tweened) ---
  const ring = new Graphics();
  ring.position.set(cx, cy);
  root.addChild(ring);

  const COUNT_START = 0.45;
  const COUNT_DUR = 1.7;

  // --- Big percent number, centered inside the ring ---
  const finalText = `${percent}%`;
  const baseNumSize = Math.round(R * 0.62);
  const numSize = fitSize(fonts, finalText, "display", 700, baseNumSize, R * 1.5);
  const numberText = makeText(fonts, { text: "0%", role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5, align: "center" });
  const numY = cy - R * 0.14;
  numberText.position.set(cx, numY);
  numberText.alpha = 0;
  root.addChild(numberText);
  timeline.to(numberText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad });
  // Landing beat once the count finishes.
  timeline
    .to(numberText, { prop: "scale.x", from: 1, to: 1.08, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 1.08, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.2, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1, to: 1.08, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1.08, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.2, ease: outQuad });

  // --- Label, below the number ---
  const labelSize = fitSize(fonts, label, "body", 600, Math.round(R * 0.2), R * 1.45);
  const labelY = numY + numSize * 0.62;
  const labelText = makeText(fonts, { text: label, role: "body", weight: 600, size: labelSize, color: textColor, anchor: 0.5, align: "center" });
  labelText.position.set(cx, labelY);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 0.85, start: 1.0, duration: 0.4, ease: outQuad })
    .to(labelText, { prop: "y", from: labelY + 10, to: labelY, start: 1.0, duration: 0.45, ease: outQuint });

  const update = (t: number): void => {
    const p = clamp01((t - COUNT_START) / COUNT_DUR);
    const eased = outExpo(p);
    const now = percent * eased;
    numberText.text = `${Math.round(now)}%`;
    ring.clear();
    if (eased > 0.001) {
      const angle = -Math.PI / 2 + eased * (percent / 100) * Math.PI * 2;
      ring.arc(0, 0, R, -Math.PI / 2, angle).stroke({ color: accent, width: strokeW, cap: "round" });
      const tipX = Math.cos(angle) * R;
      const tipY = Math.sin(angle) * R;
      ring.circle(tipX, tipY, strokeW * 0.55).fill(accent);
    }
  };

  return { timeline, duration: 4.0, update };
}

export const progressRing: TemplateDefinition = {
  id: "progress-ring",
  name: "Progress Ring",
  tagline: "A circular ring sweeps in as the percent counts up.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "percent", type: "slider", label: "Percent", default: 76, min: 1, max: 100, step: 1 },
    { key: "label", type: "text", label: "Label", default: "Complete", maxLength: 24, shrinkToFit: true },
    { key: "showTrack", type: "toggle", label: "Track ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

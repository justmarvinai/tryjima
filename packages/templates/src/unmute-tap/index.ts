import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
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

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor(size0 * (maxWidth / w))) : size0;
}

/** A muted-speaker glyph (box + cone + ✕), centered roughly on its cone. */
function mutedSpeaker(s: number, color: string): Graphics {
  const g = new Graphics();
  g.rect(-0.5 * s, -0.16 * s, 0.2 * s, 0.32 * s).fill(color);
  g.poly([-0.31 * s, -0.16 * s, 0.0, -0.4 * s, 0.0, 0.4 * s, -0.31 * s, 0.16 * s]).fill(color);
  const x0 = 0.15 * s;
  const x1 = 0.44 * s;
  const yy = 0.26 * s;
  const lw = Math.max(2, 0.078 * s);
  g.moveTo(x0, -yy).lineTo(x1, yy).moveTo(x1, -yy).lineTo(x0, yy).stroke({ color, width: lw, cap: "round" });
  return g;
}

// A centered "tap to unmute" prompt: a muted-speaker glyph + label sit in a
// soft-shadowed pill that pops in, with optional accent pulse rings breathing
// behind it. Only the full-frame `bg` rect is tied to the background field;
// the pill carries its own `pillBg` role so it stays legible over any canvas.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F6", pillBg: "#FFFFFF", textColor: "#12141A", accent: "#FF3B30" } },
  { id: "midnight", name: "Midnight", colors: { background: "#0B0B10", pillBg: "#1E1E26", textColor: "#FFFFFF", accent: "#7C5CFF" } },
  { id: "ocean", name: "Ocean", colors: { background: "#EAF2FF", pillBg: "#FFFFFF", textColor: "#0B2447", accent: "#2E7DF6" } },
  { id: "ink-glass", name: "Ink glass", colors: { background: "#14161C", pillBg: "#262A33", textColor: "#FFFFFF", accent: "#34D399" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const pillBg = pc("pillBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#12141A"));
  const accent = str(values.accent, pc("accent", "#FF3B30"));
  const label = str(values.label, "Tap to unmute");
  const showPulse = on(values.showPulse);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Pill geometry (content-width) ---
  const pillH = Math.round(minDim * 0.11);
  const iconS = pillH * 0.54;
  const padX = pillH * 0.46;
  const gapIL = pillH * 0.28;
  const labelSize0 = Math.round(pillH * 0.34);
  const labelSize = fitSize(fonts, label, "display", 700, labelSize0, minDim * 0.62);
  const labelW = fonts.measure(label, { family: fonts.family("display"), weight: 700, size: labelSize });
  const iconW = iconS * 0.95;
  const contentW = iconW + gapIL + labelW;
  const pillW = contentW + padX * 2;
  const pillR = pillH / 2;

  const pillCenterY = safe.y + safe.height / 2;

  // --- Pulse rings behind the pill ---
  if (showPulse) {
    const ring = new Graphics()
      .roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillR)
      .stroke({ color: accent, width: Math.max(2, pillH * 0.05) });
    ring.position.set(cx, pillCenterY);
    ring.alpha = 0;
    root.addChild(ring);
    const START = 0.5;
    const PERIOD = 0.9;
    const CYCLES = 3;
    for (let i = 0; i < CYCLES; i++) {
      const s0 = START + i * PERIOD;
      const d = PERIOD * 0.92;
      const fin = d * 0.16;
      timeline
        .to(ring, { prop: "alpha", from: 0, to: 0.55, start: s0, duration: fin, ease: outQuad })
        .to(ring, { prop: "alpha", from: 0.55, to: 0, start: s0 + fin, duration: d - fin, ease: outQuad })
        .to(ring, { prop: "scale.x", from: 1, to: 1.5, start: s0, duration: d, ease: outExpo })
        .to(ring, { prop: "scale.y", from: 1, to: 1.5, start: s0, duration: d, ease: outExpo });
    }
  }

  // --- Pill ---
  const pill = new Container();
  pill.position.set(cx, pillCenterY);
  pill.scale.set(0);
  root.addChild(pill);

  const e = Math.round(pillH * 0.05);
  const off = Math.round(pillH * 0.09);
  pill.addChild(
    new Graphics()
      .roundRect(-pillW / 2 - e, -pillH / 2 - e + off, pillW + e * 2, pillH + e * 2, pillR + e)
      .fill({ color: "#000000", alpha: 0.16 }),
  );
  pill.addChild(new Graphics().roundRect(-pillW / 2, -pillH / 2, pillW, pillH, pillR).fill(pillBg));

  const contentLeft = -contentW / 2;
  const glyph = mutedSpeaker(iconS, textColor);
  glyph.position.set(contentLeft + iconW / 2, 0);
  pill.addChild(glyph);

  const labelText = makeText(fonts, {
    text: label,
    role: "display",
    weight: 700,
    size: labelSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  labelText.position.set(contentLeft + iconW + gapIL, pillH * 0.02);
  pill.addChild(labelText);

  timeline
    .to(pill, { prop: "scale.x", from: 0, to: 1, start: 0.12, duration: 0.55, ease: spring(0.46) })
    .to(pill, { prop: "scale.y", from: 0, to: 1, start: 0.12, duration: 0.55, ease: spring(0.46) });

  return { timeline, duration: 3.8 };
}

export const unmuteTap: TemplateDefinition = {
  id: "unmute-tap",
  name: "Unmute Tap",
  tagline: "A tap-to-unmute pill pops in with a muted-speaker glyph and soft pulse rings.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.0,
  fontRoles: { label: "display" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Tap to unmute", maxLength: 24, shrinkToFit: true },
    { key: "showPulse", type: "toggle", label: "Pulse rings", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

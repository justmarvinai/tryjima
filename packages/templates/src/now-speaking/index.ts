import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
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

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

// An active-speaker indicator — an accent avatar dot, a name/role stack, and a
// live audio-level equalizer whose bars bounce (pure fn of t, sin at seeded
// phases). Only the full-frame `bg` rect is tied to the background field
// (defaults to the transparent sentinel so it composites straight onto
// footage); the chip uses its own palette-only `chipBg` (with a soft shadow) so
// the tag survives once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { chipBg: "#FFFFFF", textColor: "#0B0B0F", accent: "#17A34A" } },
  { id: "midnight", name: "Midnight", colors: { chipBg: "#17171C", textColor: "#FFFFFF", accent: "#33E2A0" } },
  { id: "sky", name: "Sky", colors: { chipBg: "#FFFFFF", textColor: "#0B2447", accent: "#2E7DF6" } },
  { id: "grape", name: "Grape", colors: { chipBg: "#221838", textColor: "#FFFFFF", accent: "#C08BFF" } },
];

const BAR_COUNT = 4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const chipBg = pc("chipBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#0B0B0F"));
  const accent = str(values.accent, pc("accent", "#17A34A"));
  const name = str(values.name, "Sam Rivera");
  const role = str(values.role, "Host");
  const showEq = values.showEq !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const dotR = Math.round(minDim * 0.03);
  const padX = Math.round(minDim * 0.026);
  const padY = Math.round(minDim * 0.02);
  const dotGap = Math.round(minDim * 0.022);
  const rowGap = Math.round(minDim * 0.004);

  const barW = showEq ? Math.max(3, Math.round(minDim * 0.008)) : 0;
  const barGap = Math.round(minDim * 0.008);
  const eqW = showEq ? BAR_COUNT * barW + (BAR_COUNT - 1) * barGap : 0;
  const eqGap = showEq ? Math.round(minDim * 0.022) : 0;
  const barMaxH = Math.round(dotR * 1.5);

  const dotBlockW = dotR * 2 + dotGap;
  const maxTextW = Math.max(90, w * 0.4);
  const nameSize = fitSize(fonts, name, "display", 700, Math.round(minDim * 0.032), maxTextW);
  const roleSize = role.length > 0 ? fitSize(fonts, role, "body", 500, Math.round(minDim * 0.021), maxTextW) : 0;

  const nameW = fonts.measure(name, { family: fonts.family("display"), weight: 700, size: nameSize });
  const roleW = role.length > 0 ? fonts.measure(role, { family: fonts.family("body"), weight: 500, size: roleSize }) : 0;
  const textBlockW = Math.max(nameW, roleW);

  const textRowsH = role.length > 0 ? nameSize + rowGap + roleSize : nameSize;
  const contentH = Math.max(dotR * 2, textRowsH, barMaxH);
  const chipW = padX * 2 + dotBlockW + textBlockW + eqGap + eqW;
  const chipH = padY * 2 + contentH;
  const chipRadius = Math.round(chipH * 0.3);

  const margin = Math.round(minDim * 0.026);
  const chipCX = zone.left + margin + chipW / 2;
  const chipCY = h - zone.bottom - margin - chipH / 2;

  const chip = new Container();
  chip.position.set(chipCX, chipCY);
  chip.scale.set(0);
  root.addChild(chip);

  const e = Math.round(chipH * 0.04);
  const shOff = Math.round(chipH * 0.06);
  chip.addChild(
    new Graphics()
      .roundRect(-chipW / 2 - e, -chipH / 2 - e + shOff, chipW + e * 2, chipH + e * 2, chipRadius + e)
      .fill({ color: "#000000", alpha: 0.16 }),
  );
  chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipRadius).fill(chipBg));

  // --- Avatar dot (accent) with a soft "active" ring that pulses. ---
  const dotCX = -chipW / 2 + padX + dotR;
  const ring = new Graphics().circle(0, 0, dotR + Math.max(2, dotR * 0.14)).stroke({ color: accent, width: Math.max(2, dotR * 0.14) });
  ring.position.set(dotCX, 0);
  ring.alpha = 0;
  chip.addChild(ring);
  const dot = new Graphics().circle(0, 0, dotR).fill(accent);
  dot.position.set(dotCX, 0);
  chip.addChild(dot);

  // --- Name / role text column. ---
  const textX = -chipW / 2 + padX + dotBlockW;
  const nameY = role.length > 0 ? -textRowsH / 2 + nameSize / 2 : 0;
  const roleY = role.length > 0 ? textRowsH / 2 - roleSize / 2 : 0;

  const nameText = makeText(fonts, { text: name, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  nameText.position.set(textX, nameY);
  chip.addChild(nameText);

  if (role.length > 0) {
    const roleText = makeText(fonts, { text: role, role: "body", weight: 500, size: roleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    roleText.alpha = 0.72;
    roleText.position.set(textX, roleY);
    chip.addChild(roleText);
  }

  // --- Equalizer bars (toggleable): seeded phases for an organic bounce. ---
  const bars: { g: Graphics; phase: number; speed: number }[] = [];
  if (showEq) {
    const eqLeft = chipW / 2 - padX - eqW;
    for (let i = 0; i < BAR_COUNT; i++) {
      const bx = eqLeft + i * (barW + barGap) + barW / 2;
      const bar = new Graphics().roundRect(-barW / 2, -barMaxH / 2, barW, barMaxH, barW / 2).fill(accent);
      bar.position.set(bx, 0);
      bar.scale.y = 0.35;
      chip.addChild(bar);
      bars.push({ g: bar, phase: rng.range(0, Math.PI * 2), speed: rng.range(3.0, 4.6) });
    }
  }

  // --- Entrance: the chip springs in. ---
  timeline
    .to(chip, { prop: "scale.x", from: 0, to: 1, start: 0.12, duration: 0.5, ease: spring(0.46) })
    .to(chip, { prop: "scale.y", from: 0, to: 1, start: 0.12, duration: 0.5, ease: spring(0.46) })
    .to(ring, { prop: "alpha", from: 0, to: 1, start: 0.4, duration: 0.4, ease: outQuad });

  const LIVE_START = 0.62;
  const RING_PERIOD = 1.4;
  const update = (t: number): void => {
    const tau = Math.max(0, t - LIVE_START);
    for (const b of bars) {
      b.g.scale.y = 0.35 + 0.65 * Math.abs(Math.sin(tau * b.speed + b.phase));
    }
    if (t >= LIVE_START) {
      const u = (tau % RING_PERIOD) / RING_PERIOD;
      ring.scale.set(1 + 0.22 * Math.sin(u * Math.PI));
      ring.alpha = 0.35 + 0.4 * Math.sin(u * Math.PI);
    }
  };

  return { timeline, duration: 4.2, update };
}

export const nowSpeaking: TemplateDefinition = {
  id: "now-speaking",
  name: "Now Speaking",
  tagline: "An active-speaker chip with an avatar dot and a bouncing equalizer.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { name: "display", role: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Name", default: "Sam Rivera", maxLength: 28, shrinkToFit: true },
    { key: "role", type: "text", label: "Role", default: "Host", maxLength: 28, optional: true, shrinkToFit: true },
    { key: "showEq", type: "toggle", label: "Equalizer", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

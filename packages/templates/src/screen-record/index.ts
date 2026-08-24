import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
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

/** mm:ss from seconds, zero-padded (deterministic — no Intl). */
function fmtTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  const p2 = (n: number): string => (n < 10 ? "0" + n : String(n));
  return `${p2(mm)}:${p2(ss)}`;
}

// A screen-recording overlay: a thin rounded border hugs the frame and a small
// REC chip (red dot + label + running mm:ss timer) sits top-left. The timer is a
// pure function of t via update(). Only the full-frame `bg` rect is tied to the
// background field; the chip carries its own `chipBg` role.
const PALETTES: Palette[] = [
  { id: "graphite", name: "Graphite", colors: { background: "#0E0F13", chipBg: "#1C1D24", textColor: "#FFFFFF", accent: "#FF3B30", border: "#FFFFFF" } },
  { id: "daylight", name: "Daylight", colors: { background: "#FFFFFF", chipBg: "#F1F2F6", textColor: "#101014", accent: "#E5484D", border: "#101014" } },
  { id: "slate", name: "Slate", colors: { background: "#1B2028", chipBg: "#2A313C", textColor: "#FFFFFF", accent: "#FF5A5A", border: "#FFFFFF" } },
  { id: "sand", name: "Sand", colors: { background: "#F6F1E7", chipBg: "#FFFFFF", textColor: "#201A12", accent: "#D5433F", border: "#201A12" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0E0F13"));
  const chipBg = pc("chipBg", "#1C1D24");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF3B30"));
  const borderColor = str(values.border, pc("border", "#FFFFFF"));
  const label = str(values.label, "REC");
  const showTimer = on(values.showTimer);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Thin recording border, hugging the frame ---
  const b = Math.round(minDim * 0.03);
  const bw = Math.max(2, Math.round(minDim * 0.006));
  const border = new Graphics()
    .roundRect(b, b, w - b * 2, h - b * 2, Math.round(minDim * 0.03))
    .stroke({ color: borderColor, width: bw });
  border.alpha = 0;
  root.addChild(border);
  timeline.to(border, { prop: "alpha", from: 0, to: 0.32, start: 0.1, duration: 0.5, ease: outQuad });
  // Subtle "recording" breathe on the border.
  const bStart = 0.7;
  const bPeriod = 1.1;
  for (let i = 0; i < 3; i++) {
    const s0 = bStart + i * bPeriod;
    timeline
      .to(border, { prop: "alpha", from: 0.32, to: 0.5, start: s0, duration: bPeriod * 0.5, ease: outQuad })
      .to(border, { prop: "alpha", from: 0.5, to: 0.32, start: s0 + bPeriod * 0.5, duration: bPeriod * 0.5, ease: outQuad });
  }

  // --- REC chip (top-left, inside the safe zone) ---
  const chipH = Math.round(minDim * 0.06);
  const dotR = chipH * 0.17;
  const padX = chipH * 0.42;
  const gapDL = chipH * 0.3;
  const gapLT = chipH * 0.34;
  const labelSize = fitSize(fonts, label, "display", 700, Math.round(chipH * 0.42), minDim * 0.2);
  const familyD = fonts.family("display");
  const labelW = fonts.measure(label, { family: familyD, weight: 700, size: labelSize });
  const timerSize = Math.round(chipH * 0.4);
  const timerSample = "00:00";
  const timerW = showTimer ? fonts.measure(timerSample, { family: fonts.family("mono"), weight: 700, size: timerSize }) : 0;

  const contentW = dotR * 2 + gapDL + labelW + (showTimer ? gapLT + timerW : 0);
  const chipW = contentW + padX * 2;
  const chipR = chipH / 2;

  const margin = Math.round(minDim * 0.012);
  const chip = new Container();
  chip.position.set(safe.x + margin + chipW / 2, safe.y + margin + chipH / 2);
  chip.scale.set(0);
  root.addChild(chip);

  chip.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipR).fill(chipBg));

  const contentLeft = -contentW / 2;
  const dot = new Graphics().circle(0, 0, dotR).fill(accent);
  dot.position.set(contentLeft + dotR, 0);
  chip.addChild(dot);

  const labelText = makeText(fonts, {
    text: label,
    role: "display",
    weight: 700,
    size: labelSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  labelText.position.set(contentLeft + dotR * 2 + gapDL, 0);
  chip.addChild(labelText);

  let timerNode: Text | null = null;
  if (showTimer) {
    const timerText = makeText(fonts, {
      text: fmtTime(0),
      role: "mono",
      weight: 700,
      size: timerSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    timerText.alpha = 0.85;
    timerText.position.set(contentLeft + dotR * 2 + gapDL + labelW + gapLT, 0);
    chip.addChild(timerText);
    timerNode = timerText;
  }

  timeline
    .to(chip, { prop: "scale.x", from: 0, to: 1, start: 0.18, duration: 0.5, ease: spring(0.5) })
    .to(chip, { prop: "scale.y", from: 0, to: 1, start: 0.18, duration: 0.5, ease: spring(0.5) });

  // Blinking record dot.
  const dStart = 0.7;
  const dPeriod = 0.8;
  for (let i = 0; i < 4; i++) {
    const s0 = dStart + i * dPeriod;
    timeline
      .to(dot, { prop: "alpha", from: 1, to: 0.28, start: s0, duration: dPeriod * 0.5, ease: outQuad })
      .to(dot, { prop: "alpha", from: 0.28, to: 1, start: s0 + dPeriod * 0.5, duration: dPeriod * 0.5, ease: outQuad });
  }

  const capturedTimer = timerNode;
  const update = capturedTimer
    ? (t: number): void => {
        capturedTimer.text = fmtTime(t);
      }
    : undefined;

  const duration = 4.4;
  return update ? { timeline, duration, update } : { timeline, duration };
}

export const screenRecord: TemplateDefinition = {
  id: "screen-record",
  name: "Screen Record",
  tagline: "A screen-recording border with a red REC chip and a running timer.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { label: "display" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "REC", maxLength: 10, shrinkToFit: true },
    { key: "showTimer", type: "toggle", label: "Timer", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Record color", default: "", optional: true },
    { key: "border", type: "color", label: "Border", default: "", optional: true },
  ],
  build,
};

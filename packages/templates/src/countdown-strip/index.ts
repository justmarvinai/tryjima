import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
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
const numOf = (v: unknown, d: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : d;

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

/** Total seconds -> "MM:SS", zero-padded, clamped at 00:00. */
function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = r < 10 ? `0${r}` : `${r}`;
  return `${mm}:${ss}`;
}

// A full-width bottom "starts in" strip with a live MM:SS countdown derived
// purely from t. Only the full-frame `bg` rect is tied to the background field
// (defaults to the transparent sentinel so it composites straight onto
// footage); the strip uses its own palette-only `stripBg` (with a soft shadow)
// so the readout survives once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { stripBg: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "paper", name: "Paper", colors: { stripBg: "#FFFFFF", textColor: "#101014", accent: "#2E5BD6" } },
  { id: "teal", name: "Teal", colors: { stripBg: "#FFFFFF", textColor: "#06231F", accent: "#0E9E8E" } },
  { id: "night", name: "Night", colors: { stripBg: "#131A2A", textColor: "#FFFFFF", accent: "#66A9FF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const stripBg = pc("stripBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const label = str(values.label, "Starts in");
  const seconds = Math.max(0, Math.round(numOf(values.seconds, 30)));
  const showRule = values.showRule !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Strip geometry (full safe width). ---
  const stripW = w - zone.left - zone.right;
  const stripH = Math.round(minDim * 0.08);
  const stripRadius = Math.round(minDim * 0.014);

  const margin = Math.round(minDim * 0.03);
  const stripCX = w / 2;
  const stripCY = h - zone.bottom - margin - stripH / 2;

  const strip = new Container();
  const slideOffset = stripH + minDim * 0.06;
  strip.position.set(stripCX, stripCY + slideOffset);
  strip.alpha = 0;
  root.addChild(strip);

  const e = Math.round(stripRadius * 0.5);
  const shOff = Math.round(stripRadius * 0.6);
  strip.addChild(
    new Graphics()
      .roundRect(-stripW / 2 - e, -stripH / 2 - e + shOff, stripW + e * 2, stripH + e * 2, stripRadius + e)
      .fill({ color: "#000000", alpha: 0.2 }),
  );
  strip.addChild(new Graphics().roundRect(-stripW / 2, -stripH / 2, stripW, stripH, stripRadius).fill(stripBg));

  // --- Thin accent rule along the top edge (toggleable). ---
  if (showRule) {
    const ruleH = Math.max(2, Math.round(minDim * 0.005));
    const ruleW = stripW * 0.9;
    strip.addChild(
      new Graphics().roundRect(-ruleW / 2, -stripH / 2 + ruleH, ruleW, ruleH, ruleH / 2).fill(accent),
    );
  }

  // --- Centered content row: label + clock, sized against the strip width. ---
  const clockSize = Math.round(stripH * 0.42);
  const labelSize0 = Math.round(stripH * 0.26);
  const gapLabelClock = Math.round(minDim * 0.02);
  const clockStr0 = fmtClock(seconds);
  const clockW = fonts.measure(clockStr0, { family: fonts.family("mono"), weight: 700, size: clockSize });

  const labelBudget = Math.max(60, stripW - clockW - gapLabelClock - Math.round(minDim * 0.06));
  const labelSize = label.length > 0 ? fitSize(fonts, label, "body", 600, labelSize0, labelBudget) : 0;
  const labelW = label.length > 0 ? fonts.measure(label, { family: fonts.family("body"), weight: 600, size: labelSize }) : 0;

  const rowW = labelW + (label.length > 0 ? gapLabelClock : 0) + clockW;
  let cursorX = -rowW / 2;

  if (label.length > 0) {
    const labelText = makeText(fonts, { text: label, role: "body", weight: 600, size: labelSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    labelText.alpha = 0.72;
    labelText.position.set(cursorX, 0);
    strip.addChild(labelText);
    cursorX += labelW + gapLabelClock;
  }

  const clockText: Text = makeText(fonts, { text: clockStr0, role: "mono", weight: 700, size: clockSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  clockText.position.set(cursorX, 0);
  strip.addChild(clockText);

  // --- Entrance: the strip slides up + fades in. ---
  const enterStart = 0.1;
  const enterDur = 0.55;
  const revealAt = enterStart + enterDur;
  timeline
    .to(strip, { prop: "position.y", from: stripCY + slideOffset, to: stripCY, start: enterStart, duration: enterDur, ease: outExpo })
    .to(strip, { prop: "alpha", from: 0, to: 1, start: enterStart, duration: 0.3, ease: outQuad });

  // --- Live countdown, derived purely from t (holds at 00:00). ---
  const update = (t: number): void => {
    const elapsed = Math.max(0, t - revealAt);
    clockText.text = fmtClock(seconds - elapsed);
  };

  return { timeline, duration: 4.6, update };
}

export const countdownStrip: TemplateDefinition = {
  id: "countdown-strip",
  name: "Countdown Strip",
  tagline: "A bottom strip counts down MM:SS live until the show starts.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { label: "body", seconds: "mono" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Starts in", maxLength: 24, optional: true, shrinkToFit: true },
    { key: "seconds", type: "slider", label: "Countdown (seconds)", default: 30, min: 5, max: 600, step: 5 },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  safeZone,
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
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "cobalt-sky", name: "Cobalt sky", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#1B1030", textColor: "#FFFFFF", accent: "#FF7CD1" } },
];

function fitSize(fonts: FontRegistry, text: string, role: FontRole, weight: number, size: number, maxWidth: number): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

interface StatNumber {
  prefix: string;
  suffix: string;
  value: number;
  decimals: number;
  isStatic: boolean;
  raw: string;
}

/** Parse a display string like "87%", "2.4M" or "$1,200" into an animatable number. */
function parseStatNumber(raw: string): StatNumber {
  const trimmed = raw.trim();
  const m = /^(\D*)(\d[\d,]*(?:\.\d+)?)(\D*)$/.exec(trimmed);
  if (!m) return { prefix: "", suffix: "", value: 0, decimals: 0, isStatic: true, raw: trimmed };
  const prefix = m[1] ?? "";
  const numPart = m[2] ?? "";
  const suffix = m[3] ?? "";
  const clean = numPart.replace(/,/g, "");
  const dot = clean.indexOf(".");
  const decimals = dot === -1 ? 0 : clean.length - dot - 1;
  const value = Number(clean);
  return { prefix, suffix, value: Number.isFinite(value) ? value : 0, decimals, isStatic: false, raw: trimmed };
}

/** Format the current (eased) progress of a parsed stat number for display. */
function formatStatNumber(n: StatNumber, p: number): string {
  if (n.isStatic) return n.raw;
  const fixed = (n.value * p).toFixed(n.decimals);
  const dot = fixed.indexOf(".");
  const intPart = dot === -1 ? fixed : fixed.slice(0, dot);
  const fracPart = dot === -1 ? "" : fixed.slice(dot + 1);
  const grouped = groupThousands(Number(intPart));
  return n.prefix + grouped + (fracPart ? "." + fracPart : "") + n.suffix;
}

function numFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.1 : aspect === "9:16" ? 0.13 : 0.12;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFFFFF"));
  const textColor = str(values.textColor, pcol("textColor", "#101014"));
  const accent = str(values.accent, pcol("accent", "#FF4D1C"));
  const numberRaw = str(values.number, "87%");
  const label = str(values.label, "of viewers keep watching");
  const showLine = values.showLine !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;

  const zone = safeZone(ctx.aspect);
  const safeTop = zone.top;
  const safeH = h - zone.top - zone.bottom;
  const numX = cx;
  const numY = safeTop + safeH * 0.36;
  const pointX = w * 0.28;
  const pointY = safeTop + safeH * 0.74;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const stat = parseStatNumber(numberRaw);
  const availW = w * 0.86;

  const numSizeRaw = Math.round(w * numFrac(ctx.aspect));
  const numSize = fitSize(fonts, formatStatNumber(stat, 1), "display", 700, numSizeRaw, availW);

  // --- Leader line + point (behind the number/label) ---
  const rings: { g: Graphics; start: number }[] = [];
  if (showLine) {
    const dotR = Math.max(6, minDim * 0.014);
    const lineEndX = numX - numSize * 0.9;
    const lineEndY = numY + numSize * 0.42;
    const dx = lineEndX - pointX;
    const dy = lineEndY - pointY;
    const len = Math.max(1, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const lineW = Math.max(3, minDim * 0.006);

    const lineG = new Graphics().rect(0, -lineW / 2, len, lineW).fill(accent);
    lineG.position.set(pointX, pointY);
    lineG.rotation = angle;
    lineG.scale.set(0, 1);
    lineG.label = "leader-line";
    root.addChild(lineG);

    const dot = new Graphics().circle(0, 0, dotR).fill(accent);
    dot.position.set(pointX, pointY);
    dot.scale.set(0);
    dot.label = "leader-dot";
    root.addChild(dot);

    timeline
      .to(dot, { prop: "scale.x", from: 0, to: 1, start: 0.05, duration: 0.35, ease: makeOutBack(2.2) })
      .to(dot, { prop: "scale.y", from: 0, to: 1, start: 0.05, duration: 0.35, ease: makeOutBack(2.2) })
      .to(lineG, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.45, ease: outExpo });

    // A quiet "live" pulse or two around the point during the hold.
    const ringW = Math.max(2, dotR * 0.35);
    for (const start of [2.1, 3.0]) {
      const g = new Graphics().circle(0, 0, dotR).stroke({ color: accent, width: ringW });
      g.position.set(pointX, pointY);
      g.visible = false;
      root.addChild(g);
      rings.push({ g, start });
    }
  }

  // --- Number (counts up, then pops) ---
  const numberText = makeText(fonts, {
    text: formatStatNumber(stat, 0),
    role: "display",
    weight: 700,
    size: numSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
  });
  numberText.position.set(numX, numY);
  numberText.alpha = 0;
  numberText.scale.set(0.7);
  root.addChild(numberText);

  const countStart = 0.55;
  const countDur = 0.85;
  timeline
    .to(numberText, { prop: "alpha", from: 0, to: 1, start: countStart, duration: 0.3, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 0.7, to: 1, start: countStart, duration: countDur, ease: outExpo })
    .to(numberText, { prop: "scale.y", from: 0.7, to: 1, start: countStart, duration: countDur, ease: outExpo })
    // Landing beat.
    .to(numberText, { prop: "scale.x", from: 1, to: 1.06, start: countStart + countDur, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 1.06, to: 1, start: countStart + countDur + 0.12, duration: 0.18, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1, to: 1.06, start: countStart + countDur, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1.06, to: 1, start: countStart + countDur + 0.12, duration: 0.18, ease: outQuad });

  // --- Label (fades under the number) ---
  const labelSizeRaw = Math.round(numSize * 0.28);
  const labelSize = fitSize(fonts, label, "body", 600, labelSizeRaw, availW);
  const labelText = makeText(fonts, {
    text: label,
    role: "body",
    weight: 600,
    size: labelSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
  });
  const labelY = numY + numSize * 0.62;
  labelText.position.set(numX, labelY + 14);
  labelText.alpha = 0;
  root.addChild(labelText);
  const labelStart = countStart + countDur + 0.05;
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 1, start: labelStart, duration: 0.4, ease: outQuad })
    .to(labelText, { prop: "y", from: labelY + 14, to: labelY, start: labelStart, duration: 0.5, ease: outQuint });

  const PULSE_LIFE = 0.8;
  const update = (t: number): void => {
    const p = clamp01((t - countStart) / countDur);
    numberText.text = formatStatNumber(stat, outExpo(p));
    for (const r of rings) {
      const tau = t - r.start;
      if (tau < 0 || tau > PULSE_LIFE) {
        r.g.visible = false;
        continue;
      }
      r.g.visible = true;
      const u = tau / PULSE_LIFE;
      const s = 1 + 1.6 * outQuad(u);
      r.g.scale.set(s);
      r.g.alpha = 0.55 * (1 - u);
    }
  };

  return { timeline, duration: 4.0, update };
}

export const statCallout: TemplateDefinition = {
  id: "stat-callout",
  name: "Stat Callout",
  tagline: "A big number and label connect to a point with a leader line.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { number: "display", label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "number", type: "text", label: "Number", default: "87%", maxLength: 12 },
    { key: "label", type: "text", label: "Label", default: "of viewers keep watching", maxLength: 48 },
    { key: "showLine", type: "toggle", label: "Leader line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutCubic,
  outExpo,
  outQuad,
  outQuint,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", muted: "#6B7280" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", muted: "#4A5B80" } },
  { id: "forest", name: "Forest", colors: { background: "#F1F6F2", textColor: "#10301F", accent: "#157F4C", muted: "#4C6B58" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", muted: "#9AA1AC" } },
];

interface Stage {
  label: string;
  value: number;
}

const DEFAULT_STAGES = ["Discovery|2", "Sign-up|3", "First hurdle|-1", "Support win|2", "Renewal|4"];

function parseStage(raw: string, fallback: string): Stage {
  const parts = raw.split("|").map((s) => s.trim());
  const label = parts[0] ?? "";
  return {
    label: label.length ? label : fallback,
    value: parseTargetNumber(parts[1] ?? "0"),
  };
}

function stagesOf(values: Values): Stage[] {
  return asList(values.stages, DEFAULT_STAGES)
    .slice(0, 6)
    .map((r, i) => parseStage(r, `Stage ${i + 1}`));
}

/** Catmull-Rom through evenly spaced values — a soft arc, not a zig-zag. */
function sampleCurve(vals: number[], u: number): number {
  const n = vals.length;
  if (n === 0) return 0;
  if (n === 1) return vals[0]!;
  const seg = u * (n - 1);
  let k = Math.floor(seg);
  if (k < 0) k = 0;
  if (k > n - 2) k = n - 2;
  const tt = seg - k;
  const p0 = vals[Math.max(0, k - 1)]!;
  const p1 = vals[k]!;
  const p2 = vals[k + 1]!;
  const p3 = vals[Math.min(n - 1, k + 2)]!;
  return (
    0.5 *
    (2 * p1 +
      (-p0 + p2) * tt +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * tt * tt +
      (-p0 + 3 * p1 - 3 * p2 + p3) * tt * tt * tt)
  );
}

/** u such that ease(u) ≈ target — so labels fire exactly as the dot arrives. */
function inverseEase(ease: (u: number) => number, target: number): number {
  if (target <= 0) return 0;
  if (target >= 1) return 1;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 26; i++) {
    const mid = (lo + hi) / 2;
    if (ease(mid) < target) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const SAMPLES = 240;
const CURVE_START = 0.8;
const CURVE_DUR = 1.9;
const LABEL_DUR = 0.65;
const HOLD = 0.95;
const DURATION = CURVE_START + CURVE_DUR + LABEL_DUR + HOLD;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const mutedColor = str(values.mutedColor, pc("muted", "#6B7280"));

  const title = str(values.title, "How the first month feels");
  const showBaseline = values.showBaseline !== false;
  const showMarks = values.showMarks !== false;
  const showArea = values.showArea !== false;
  const showAccentBar = values.accentBar !== false;

  const stages = stagesOf(values);
  const n = stages.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);

  // --- Title (+ accent underline) ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), zone.width);
  const titleY = zone.y + titleSize * 0.75;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  titleText.position.set(zone.x, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "x", from: zone.x - 18, to: zone.x, start: 0, duration: 0.65, ease: outQuint });

  let titleBottom = titleY + titleSize * 0.7;
  if (showAccentBar) {
    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(zone.x, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.28, duration: 0.55, ease: outExpo });
    titleBottom = titleY + titleSize * 0.9;
  }

  // --- Plot geometry: labels live outside the curve band, above peaks / below dips ---
  const nameSize = Math.round(minDim * 0.028);
  const labelPad = nameSize * 2.1;
  const plotTop = titleBottom + minDim * 0.055;
  const plotBottom = zone.y + zone.height - minDim * 0.02;
  const bandTop = plotTop + labelPad;
  const bandBottom = plotBottom - labelPad;
  const bandH = Math.max(minDim * 0.14, bandBottom - bandTop);
  const xL = zone.x + zone.width * 0.08;
  const xR = zone.x + zone.width * 0.92;

  let vMin = Math.min(...stages.map((s) => s.value));
  let vMax = Math.max(...stages.map((s) => s.value));
  if (vMax - vMin < 1e-6) {
    vMin -= 1;
    vMax += 1;
  }
  const pad = (vMax - vMin) * 0.16;
  vMin -= pad;
  vMax += pad;

  const yOf = (v: number): number => bandTop + bandH - ((v - vMin) / (vMax - vMin)) * bandH;
  const stageY = stages.map((s) => yOf(s.value));
  const stageX = stages.map((_, i) => (n === 1 ? (xL + xR) / 2 : xL + ((xR - xL) * i) / (n - 1)));

  // Sample the smooth arc once — the stroke, the area and the travelling dot all
  // read from the same table, so they can never drift apart.
  const xs: number[] = [];
  const ys: number[] = [];
  const yFloor = plotTop + nameSize * 0.5;
  const yCeil = plotBottom - nameSize * 0.5;
  for (let i = 0; i <= SAMPLES; i++) {
    const u = i / SAMPLES;
    xs.push(xL + (xR - xL) * u);
    const raw = sampleCurve(stageY, u);
    ys.push(raw < yFloor ? yFloor : raw > yCeil ? yCeil : raw);
  }

  // --- Baseline hairline ---
  if (showBaseline) {
    const base = new Container();
    base.position.set(xL, plotBottom);
    base.scale.set(0, 1);
    base.addChild(new Graphics().rect(0, -1, xR - xL, Math.max(2, minDim * 0.0022)).fill({ color: textColor, alpha: 0.14 }));
    root.addChild(base);
    timeline.to(base, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.65, ease: outExpo });
  }

  // --- The arc: soft area + stroke, revealed by one sweeping mask ---
  const curveHolder = new Container();
  root.addChild(curveHolder);
  const curveClip = new Container();
  curveHolder.addChild(curveClip);

  const strokeW = Math.max(4, minDim * 0.009);
  if (showArea) {
    const areaPts: number[] = [];
    for (let i = 0; i <= SAMPLES; i++) areaPts.push(xs[i]!, ys[i]!);
    areaPts.push(xR, plotBottom, xL, plotBottom);
    curveClip.addChild(new Graphics().poly(areaPts).fill({ color: accent, alpha: 0.1 }));
  }
  const line = new Graphics();
  for (let i = 0; i <= SAMPLES; i++) {
    if (i === 0) line.moveTo(xs[i]!, ys[i]!);
    else line.lineTo(xs[i]!, ys[i]!);
  }
  line.stroke({ color: accent, width: strokeW, cap: "round", join: "round" });
  curveClip.addChild(line);

  const sweep = new Graphics()
    .rect(0, 0, xR - xL + strokeW * 2, plotBottom - plotTop + strokeW * 2)
    .fill(0xffffff);
  sweep.position.set(xL - strokeW, plotTop - strokeW);
  sweep.scale.set(0, 1);
  curveHolder.addChild(sweep);
  curveClip.mask = sweep;
  timeline.to(sweep, { prop: "scale.x", from: 0, to: 1, start: CURVE_START, duration: CURVE_DUR, ease: inOutCubic });

  // --- Stage markers + labels, firing exactly as the dot reaches them ---
  const ringR = Math.max(7, minDim * 0.013);
  const ringW = Math.max(3, minDim * 0.0055);
  const labelMaxW = Math.min((zone.width / Math.max(1, n)) * 0.96, zone.width * 0.34);
  const midY = bandTop + bandH / 2;

  stages.forEach((s, i) => {
    const px = stageX[i]!;
    const py = stageY[i]!;
    const arriveU = inverseEase(inOutCubic, n === 1 ? 1 : i / (n - 1));
    const start = CURVE_START + CURVE_DUR * arriveU;

    const prev = stages[i - 1]?.value;
    const next = stages[i + 1]?.value;
    const isPeak = prev !== undefined && next !== undefined && s.value > prev && s.value > next;
    const isDip = prev !== undefined && next !== undefined && s.value < prev && s.value < next;
    const marked = showMarks && (isPeak || isDip);

    // A hairline dropping to the baseline quietly flags the peaks and dips.
    if (marked) {
      const drop = new Container();
      drop.position.set(px, py);
      drop.scale.set(1, 0);
      drop.addChild(
        new Graphics()
          .rect(-Math.max(1.5, minDim * 0.002) / 2, 0, Math.max(1.5, minDim * 0.002), Math.max(0, plotBottom - py))
          .fill({ color: textColor, alpha: 0.16 }),
      );
      root.addChild(drop);
      timeline.to(drop, { prop: "scale.y", from: 0, to: 1, start: start + 0.08, duration: 0.5, ease: outQuint });
    }

    const ring = new Container();
    ring.position.set(px, py);
    ring.alpha = 0;
    ring.scale.set(0.5);
    ring.addChild(new Graphics().circle(0, 0, ringR).fill(bg));
    ring.addChild(new Graphics().circle(0, 0, ringR).stroke({ color: accent, width: ringW }));
    if (marked) ring.addChild(new Graphics().circle(0, 0, ringR * 0.42).fill(accent));
    root.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 0.5, to: 1, start, duration: 0.55, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 0.5, to: 1, start, duration: 0.55, ease: outExpo });

    const above = py <= midY;
    const lSize = fitSize(fonts, s.label, "body", 600, nameSize, labelMaxW);
    const lbl = makeText(fonts, {
      text: s.label,
      role: "body",
      weight: 600,
      size: lSize,
      color: marked ? textColor : mutedColor,
      anchor: { x: 0.5, y: above ? 1 : 0 },
      align: "center",
    });
    const halfW = lbl.width / 2 + 2;
    // On a flank the arc would run straight through a label parked square above
    // the point, so nudge it up and to the side the curve is *not* heading —
    // proportional to the local slope, so peaks and dips stay perfectly centred.
    const c = Math.round((n === 1 ? 1 : i / (n - 1)) * SAMPLES);
    const a0 = Math.max(0, c - 6);
    const a1 = Math.min(SAMPLES, c + 6);
    const dx = xs[a1]! - xs[a0]!;
    const slope = dx === 0 ? 0 : (ys[a1]! - ys[a0]!) / dx;
    const clear = Math.min(nameSize * 1.7, Math.abs(slope) * halfW * 0.55);
    const shiftX = (above ? 1 : -1) * Math.sign(slope) * halfW * Math.min(1, Math.abs(slope) * 0.8);
    const rawY = above
      ? py - ringR - nameSize * 0.75 - clear
      : py + ringR + nameSize * 0.75 + clear;
    const lblY = above
      ? Math.max(zone.y + lSize * 1.15, rawY)
      : Math.min(zone.y + zone.height - lSize * 1.25, rawY);
    const lblX = Math.max(zone.x + halfW, Math.min(zone.x + zone.width - halfW, px + shiftX));
    lbl.position.set(lblX, lblY);
    lbl.alpha = 0;
    root.addChild(lbl);
    timeline
      .to(lbl, { prop: "alpha", from: 0, to: 1, start, duration: 0.45, ease: outQuad })
      .to(lbl, { prop: "y", from: lblY + (above ? 10 : -10), to: lblY, start, duration: LABEL_DUR, ease: outQuint });
  });

  // --- The traveller: a dot riding the arc, positioned purely from t ---
  const dotC = new Container();
  dotC.alpha = 0;
  dotC.scale.set(0.6);
  root.addChild(dotC);
  dotC.addChild(new Graphics().circle(0, 0, ringR * 1.9).fill({ color: accent, alpha: 0.14 }));
  dotC.addChild(new Graphics().circle(0, 0, ringR * 0.78).fill(accent).stroke({ color: bg, width: Math.max(2, ringR * 0.3) }));
  timeline
    .to(dotC, { prop: "alpha", from: 0, to: 1, start: CURVE_START, duration: 0.3, ease: outQuad })
    .to(dotC, { prop: "scale.x", from: 0.6, to: 1, start: CURVE_START, duration: 0.6, ease: outExpo })
    .to(dotC, { prop: "scale.y", from: 0.6, to: 1, start: CURVE_START, duration: 0.6, ease: outExpo });

  const update = (t: number): void => {
    const p = inOutCubic(clamp01((t - CURVE_START) / CURVE_DUR));
    const f = p * SAMPLES;
    const i0 = Math.min(SAMPLES, Math.max(0, Math.floor(f)));
    const i1 = Math.min(SAMPLES, i0 + 1);
    const k = f - i0;
    dotC.position.set(xs[i0]! + (xs[i1]! - xs[i0]!) * k, ys[i0]! + (ys[i1]! - ys[i0]!) * k);
  };

  return { timeline, duration: DURATION, update };
}

export const journeyMap: TemplateDefinition = {
  id: "journey-map",
  name: "Journey Map",
  tagline: "A sentiment arc rises and dips through your stages while a dot rides along it.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.7,
  fontRoles: { title: "display", stages: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "How the first month feels", maxLength: 36, optional: true, shrinkToFit: true },
    {
      key: "stages",
      type: "textlist",
      label: "Stages (name | feeling)",
      default: DEFAULT_STAGES,
      minItems: 4,
      maxItems: 6,
      maxLength: 20,
      help: 'One per line as "name | feeling", e.g. "First hurdle | -1". Higher numbers sit higher on the arc.',
    },
    { key: "showMarks", type: "toggle", label: "Mark peaks & dips", default: true },
    { key: "showArea", type: "toggle", label: "Shade under the arc", default: true },
    { key: "showBaseline", type: "toggle", label: "Baseline", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Arc", default: "", optional: true },
    { key: "mutedColor", type: "color", label: "Stage labels", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
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
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

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

// Bubble bodies are a light tint of their edge color (edge at 16% over the
// background), so the in-bubble label/value text — always `textColor` — keeps
// ≥ 4.5:1 on every palette, light and dark alike. The accent only colors the
// title underline (no text on it).
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", bubble: "#2E7DF6", bubble2: "#7C5CFF", bubble3: "#17A34A" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#FF4D1C", bubble: "#2E7DF6", bubble2: "#0EA5E9", bubble3: "#7C5CFF" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#F97316", bubble: "#17A34A", bubble2: "#2E7DF6", bubble3: "#0D9488" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", bubble: "#38C7FF", bubble2: "#FF8A5C", bubble3: "#33E2A0" } },
];

interface Bub {
  label: string;
  value: number;
  display: string;
}

const DEFAULT_BUBBLES = ["Video|82", "Carousel|64", "Stories|45", "Static|30", "Live|18"];

function parseBub(raw: string, fallback: string): Bub {
  const idx = raw.indexOf("|");
  const label = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const valPart = (idx >= 0 ? raw.slice(idx + 1) : "").trim();
  const value = Math.max(0, parseTargetNumber(valPart));
  return {
    label: label.length ? label : fallback,
    value,
    display: valPart.length ? valPart : String(Math.round(value)),
  };
}

function bubblesOf(values: Values): Bub[] {
  return asList(values.bubbles, DEFAULT_BUBBLES)
    .slice(0, 6)
    .map((r, i) => parseBub(r, `Item ${i + 1}`));
}

const BUB_START = 0.8;
const BUB_EACH = 0.16;
const BUB_DUR = 0.6;
const HOLD = 1.35;

function computeDuration(values: Values): number {
  return BUB_START + (bubblesOf(values).length - 1) * BUB_EACH + BUB_DUR + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const edges = [pc("bubble", "#2E7DF6"), pc("bubble2", "#7C5CFF"), pc("bubble3", "#17A34A")];

  const title = str(values.title, "Reach by format");
  const showValues = values.showValues !== false;
  const showFrame = values.showFrame !== false;
  const showAccentBar = values.accentBar !== false;

  const bubs = bubblesOf(values);
  const n = bubs.length;

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
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: zone.x - 18, to: zone.x, start: 0, duration: 0.5, ease: outQuint });

  let titleBottom = titleY + titleSize * 0.7;
  if (showAccentBar) {
    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(zone.x, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
    titleBottom = titleY + titleSize * 0.9;
  }

  // --- Plot field (a quiet frame, not a dense axis grid) ---
  const plotLeft = zone.x + minDim * 0.015;
  const plotRight = zone.x + zone.width - minDim * 0.015;
  const plotTop = titleBottom + minDim * 0.045;
  const plotBottom = zone.y + zone.height - minDim * 0.012;
  const plotW = Math.max(minDim * 0.2, plotRight - plotLeft);
  const plotH = Math.max(minDim * 0.2, plotBottom - plotTop);

  if (showFrame) {
    const thick = Math.max(2, minDim * 0.0035);
    const yAxis = new Container();
    yAxis.position.set(plotLeft, plotBottom);
    yAxis.scale.set(1, 0);
    yAxis.addChild(new Graphics().rect(-thick / 2, -plotH, thick, plotH).fill({ color: textColor, alpha: 0.28 }));
    root.addChild(yAxis);
    timeline.to(yAxis, { prop: "scale.y", from: 0, to: 1, start: 0.3, duration: 0.55, ease: outExpo });

    const xAxis = new Container();
    xAxis.position.set(plotLeft, plotBottom);
    xAxis.scale.set(0, 1);
    xAxis.addChild(new Graphics().rect(0, -thick / 2, plotW, thick).fill({ color: textColor, alpha: 0.28 }));
    root.addChild(xAxis);
    timeline.to(xAxis, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.55, ease: outExpo });

    // Three soft ticks per axis — just enough structure to read as a chart.
    const tickLen = minDim * 0.016;
    for (let k = 1; k <= 3; k++) {
      const tx = plotLeft + (plotW * k) / 4;
      const ty = plotBottom - (plotH * k) / 4;
      const tickX = new Graphics().rect(tx - thick / 2, plotBottom - tickLen, thick, tickLen).fill({ color: textColor, alpha: 0.22 });
      const tickY = new Graphics().rect(plotLeft, ty - thick / 2, tickLen, thick).fill({ color: textColor, alpha: 0.22 });
      tickX.alpha = 0;
      tickY.alpha = 0;
      root.addChild(tickX, tickY);
      timeline
        .to(tickX, { prop: "alpha", from: 0, to: 1, start: 0.55 + k * 0.05, duration: 0.35, ease: outQuad })
        .to(tickY, { prop: "alpha", from: 0, to: 1, start: 0.55 + k * 0.05, duration: 0.35, ease: outQuad });
    }
  }

  // --- Bubbles: index spreads them across the field, seeded jitter loosens the
  // lattice, radius maps to value. Labels live inside the bubble. ---
  const vMax = Math.max(1, ...bubs.map((b) => b.value));
  const cellW = plotW / n;
  const rMaxRaw = Math.min(minDim * 0.135, cellW * 0.62, plotH * 0.3);
  const rMin = Math.min(minDim * 0.062, rMaxRaw * 0.55);
  const rMax = Math.max(rMaxRaw, rMin * 1.25);
  const edgePad = minDim * 0.008;

  bubs.forEach((b, i) => {
    const jx = rng.range(-0.035, 0.035);
    const jy = rng.range(-0.07, 0.07);
    const fx = (i + 0.5) / n + jx;
    const fy = (i % 2 === 0 ? 0.64 : 0.33) + jy;
    const r = rMin + (b.value / vMax) * (rMax - rMin);
    const bx = clamp(plotLeft + fx * plotW, plotLeft + r + edgePad, plotRight - r - edgePad);
    const by = clamp(plotTop + fy * plotH, plotTop + r + edgePad, plotBottom - r - edgePad);
    const edge = edges[i % edges.length] ?? "#2E7DF6";

    const bub = new Container();
    bub.position.set(bx, by);
    bub.scale.set(0);
    root.addChild(bub);

    bub.addChild(
      new Graphics()
        .circle(0, 0, r)
        .fill({ color: edge, alpha: 0.16 })
        .circle(0, 0, r)
        .stroke({ color: edge, width: Math.max(2.5, r * 0.07) }),
    );

    const lblSize = fitSize(fonts, b.label, "body", 600, Math.max(11, Math.round(r * 0.3)), r * 1.55);
    const lbl = makeText(fonts, { text: b.label, role: "body", weight: 600, size: lblSize, color: textColor, anchor: 0.5 });
    lbl.position.set(0, showValues ? -r * 0.2 : 0);
    bub.addChild(lbl);

    if (showValues) {
      const valSize = fitSize(fonts, b.display, "display", 700, Math.max(12, Math.round(r * 0.42)), r * 1.35);
      const val = makeText(fonts, { text: b.display, role: "display", weight: 700, size: valSize, color: textColor, anchor: 0.5 });
      val.position.set(0, r * 0.26);
      bub.addChild(val);
    }

    const start = BUB_START + i * BUB_EACH;
    timeline
      .to(bub, { prop: "scale.x", from: 0, to: 1, start, duration: BUB_DUR, ease: makeOutBack(1.7) })
      .to(bub, { prop: "scale.y", from: 0, to: 1, start, duration: BUB_DUR, ease: makeOutBack(1.7) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const bubbleChart: TemplateDefinition = {
  id: "bubble-chart",
  name: "Bubble Chart",
  tagline: "Value-sized bubbles pop across a quiet axis frame, labels riding inside.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", bubbles: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Reach by format", maxLength: 34, shrinkToFit: true },
    {
      key: "bubbles",
      type: "textlist",
      label: "Bubbles (label | value)",
      default: DEFAULT_BUBBLES,
      minItems: 4,
      maxItems: 6,
      maxLength: 20,
      help: 'One per line as "label | value" — the value sets the bubble size.',
    },
    { key: "showValues", type: "toggle", label: "Value labels", default: true },
    { key: "showFrame", type: "toggle", label: "Axis frame", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

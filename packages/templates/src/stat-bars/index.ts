import type { Text } from "pixi.js";
import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

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

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6" } },
  { id: "mint", name: "Mint", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF" } },
];

interface Bar {
  label: string;
  value: number;
}

const DEFAULT_BARS = ["Mon:820", "Tue:1290", "Wed:2040", "Thu:1670"];

function resolveBars(values: Values): Bar[] {
  const raw = Array.isArray(values.bars)
    ? values.bars.filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];
  const items = (raw.length ? raw : DEFAULT_BARS).slice(0, 4);
  return items.map((it) => {
    const idx = it.indexOf(":");
    const label = (idx >= 0 ? it.slice(0, idx) : it).trim();
    const valPart = idx >= 0 ? it.slice(idx + 1) : it;
    return { label: label.length ? label : it.trim(), value: parseTargetNumber(valPart) };
  });
}

function computeDuration(values: Values): number {
  return 1.0 + resolveBars(values).length * 0.25 + 1.8;
}

function chartBand(aspect: Aspect, h: number): { titleY: number; top: number; bottom: number } {
  switch (aspect) {
    case "9:16":
      return { titleY: h * 0.16, top: h * 0.3, bottom: h * 0.72 };
    case "16:9":
      return { titleY: h * 0.12, top: h * 0.34, bottom: h * 0.9 };
    case "1:1":
      return { titleY: h * 0.12, top: h * 0.3, bottom: h * 0.9 };
    case "4:5":
      return { titleY: h * 0.11, top: h * 0.28, bottom: h * 0.9 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const showAccentBar = values.accentBar !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const bars = resolveBars(values);
  const n = bars.length;
  const maxVal = Math.max(1, ...bars.map((b) => b.value));
  let maxIdx = 0;
  for (let i = 1; i < n; i++) {
    if (bars[i]!.value > bars[maxIdx]!.value) maxIdx = i;
  }

  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  const marginX = w * 0.1;
  const chartW = w - marginX * 2;
  const band = chartBand(ctx.aspect, h);

  // --- Title + accent rule ---
  const titleRaw = str(values.title, "Followers this week");
  const titleSize = fitSize(fonts, titleRaw, "display", 700, Math.round(w * 0.055), chartW);
  const title = makeText(fonts, { text: titleRaw, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0 } });
  title.position.set(marginX, band.titleY);
  title.alpha = 0;
  root.addChild(title);
  timeline
    .to(title, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(title, { prop: "x", from: marginX - 18, to: marginX, start: 0, duration: 0.5, ease: outExpo });

  if (showAccentBar) {
    const ruleW = titleSize * 2.2;
    const rule = new Graphics().roundRect(0, 0, ruleW, Math.max(3, titleSize * 0.09), 3).fill(accent);
    rule.position.set(marginX, band.titleY + titleSize * 1.35);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
  }

  // --- Bars ---
  const chartH = band.bottom - band.top;
  const rowH = chartH / n;
  const barH = Math.min(rowH * 0.34, minDim * 0.07);
  const labelSize = Math.round(minDim * 0.036);
  const valueSize = Math.round(minDim * 0.044);
  const GROW = 0.85;

  const counters: { value: number; text: Text; start: number }[] = [];

  bars.forEach((b, i) => {
    const rowY = band.top + i * rowH;
    const lineY = rowY + rowH * 0.16;
    const barY = lineY + labelSize * 1.15;
    const isMax = i === maxIdx;
    const start = 1.0 + i * 0.25;

    const label = makeText(fonts, { text: b.label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: { x: 0, y: 0 } });
    label.position.set(marginX, lineY);
    label.alpha = 0;
    root.addChild(label);

    const valueT = makeText(fonts, { text: "0", role: "display", weight: 700, size: valueSize, color: isMax ? accent : textColor, anchor: { x: 1, y: 0 } });
    valueT.position.set(marginX + chartW, lineY);
    valueT.alpha = 0;
    root.addChild(valueT);

    const track = new Graphics().roundRect(0, 0, chartW, barH, barH / 2).fill({ color: textColor, alpha: 0.08 });
    track.position.set(marginX, barY);
    root.addChild(track);

    const targetW = Math.max(barH, chartW * (b.value / maxVal));
    const bar = new Graphics().roundRect(0, 0, targetW, barH, barH / 2).fill(isMax ? accent : { color: textColor, alpha: 0.28 });
    bar.position.set(marginX, barY);
    bar.scale.set(0, 1);
    root.addChild(bar);

    timeline
      .to(bar, { prop: "scale.x", from: 0, to: 1, start, duration: GROW, ease: outExpo })
      .to(label, { prop: "alpha", from: 0, to: 1, start: start - 0.15, duration: 0.4, ease: outQuad })
      .to(valueT, { prop: "alpha", from: 0, to: 1, start: start - 0.15, duration: 0.4, ease: outQuad });

    counters.push({ value: b.value, text: valueT, start });
  });

  const update = (t: number): void => {
    for (const c of counters) {
      const p = outExpo(clamp01((t - c.start) / GROW));
      c.text.text = groupThousands(c.value * p);
    }
  };

  return { timeline, duration: computeDuration(values), update };
}

export const statBars: TemplateDefinition = {
  id: "stat-bars",
  name: "Stat Bars",
  tagline: "A bar chart that grows and counts up bar by bar.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.2,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Followers this week", maxLength: 40, shrinkToFit: true },
    { key: "bars", type: "textlist", label: "Bars", default: DEFAULT_BARS, minItems: 2, maxItems: 4, maxLength: 24 },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

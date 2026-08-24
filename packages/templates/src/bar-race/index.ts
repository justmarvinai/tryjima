import { Graphics, type Text } from "pixi.js";
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

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", barColor: "#FF4D1C" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", barColor: "#2E7DF6" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", barColor: "#17A34A" } },
  { id: "sunset", name: "Sunset", colors: { background: "#FFF4EC", textColor: "#401D07", barColor: "#FF7A1A" } },
];

interface BarItem {
  label: string;
  value: number;
}

const DEFAULT_ITEMS = ["Design|82", "Code|64", "Ship|48"];

/** Parse "Label|value" — order is kept as given (this is a leaderboard reveal, not a sort). */
function resolveItems(values: Values): BarItem[] {
  const raw = Array.isArray(values.items)
    ? values.items.filter((s): s is string => typeof s === "string" && s.length > 0)
    : [];
  const items = (raw.length ? raw : DEFAULT_ITEMS).slice(0, 5);
  return items.map((it) => {
    const idx = it.indexOf("|");
    const label = (idx >= 0 ? it.slice(0, idx) : it).trim();
    const valPart = idx >= 0 ? it.slice(idx + 1) : "";
    return { label: label.length ? label : it.trim(), value: parseTargetNumber(valPart) };
  });
}

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

function chartBand(aspect: Aspect, h: number): { top: number; bottom: number } {
  switch (aspect) {
    case "9:16":
      return { top: h * 0.22, bottom: h * 0.76 };
    case "16:9":
      return { top: h * 0.16, bottom: h * 0.92 };
    case "1:1":
      return { top: h * 0.14, bottom: h * 0.92 };
    case "4:5":
      return { top: h * 0.13, bottom: h * 0.92 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const barColor = str(values.barColor, pc("barColor", "#FF4D1C"));
  const showValues = values.showValues !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const items = resolveItems(values);
  const n = items.length;
  const maxVal = Math.max(1, ...items.map((b) => b.value));

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const marginX = w * 0.1;
  const chartW = w - marginX * 2;
  const band = chartBand(ctx.aspect, h);
  const chartH = band.bottom - band.top;
  const rowH = chartH / n;
  const barH = Math.min(rowH * 0.34, minDim * 0.075);
  const labelSize = Math.round(minDim * 0.036);
  const valueSize = Math.round(minDim * 0.044);
  const GROW = 0.75;
  const START0 = 0.5;
  const EACH = 0.22;

  const counters: { value: number; text: Text; start: number }[] = [];

  items.forEach((it, i) => {
    const rowY = band.top + i * rowH;
    const lineY = rowY + rowH * 0.16;
    const barY = lineY + labelSize * 1.15;
    const start = START0 + i * EACH;
    const alpha = Math.max(0.32, 1 - i * 0.17);

    const labelFontSize = fitSize(fonts, it.label, "display", 700, labelSize, chartW * 0.5);
    const label = makeText(fonts, { text: it.label, role: "display", weight: 700, size: labelFontSize, color: textColor, anchor: { x: 0, y: 0 } });
    label.position.set(marginX, lineY);
    label.alpha = 0;
    root.addChild(label);

    let valueNode: Text | null = null;
    if (showValues) {
      valueNode = makeText(fonts, { text: "0", role: "display", weight: 700, size: valueSize, color: textColor, anchor: { x: 1, y: 0 } });
      valueNode.position.set(marginX + chartW, lineY);
      valueNode.alpha = 0;
      root.addChild(valueNode);
    }

    const track = new Graphics().roundRect(0, 0, chartW, barH, barH / 2).fill({ color: textColor, alpha: 0.08 });
    track.position.set(marginX, barY);
    root.addChild(track);

    const targetW = Math.max(barH, chartW * (it.value / maxVal));
    const bar = new Graphics().roundRect(0, 0, targetW, barH, barH / 2).fill({ color: barColor, alpha });
    bar.position.set(marginX, barY);
    bar.scale.set(0, 1);
    root.addChild(bar);

    timeline
      .to(bar, { prop: "scale.x", from: 0, to: 1, start, duration: GROW, ease: outExpo })
      .to(label, { prop: "alpha", from: 0, to: 1, start: start - 0.15, duration: 0.4, ease: outQuad });
    if (valueNode) {
      timeline.to(valueNode, { prop: "alpha", from: 0, to: 1, start: start - 0.15, duration: 0.4, ease: outQuad });
      counters.push({ value: it.value, text: valueNode, start: start + 0.1 });
    }
  });

  const update = (t: number): void => {
    for (const c of counters) {
      const p = outExpo(clamp01((t - c.start) / GROW));
      c.text.text = groupThousands(c.value * p);
    }
  };

  return { timeline, duration: 4.6, update };
}

export const barRace: TemplateDefinition = {
  id: "bar-race",
  name: "Bar Race",
  tagline: "Bars race left to right, counting up as they grow.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.4,
  palettes: PALETTES,
  fields: [
    { key: "items", type: "textlist", label: "Bars (Label|value)", default: DEFAULT_ITEMS, minItems: 2, maxItems: 5, maxLength: 28 },
    { key: "showValues", type: "toggle", label: "Show values", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "barColor", type: "color", label: "Bar color", default: "", optional: true },
  ],
  build,
};

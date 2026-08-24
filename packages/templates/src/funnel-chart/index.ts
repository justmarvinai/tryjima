import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

/** Create text; if it would overflow `maxWidth`, re-make one size smaller (crisp). */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

// Band fills stay a fixed categorical set (same values as donut-chart's, so
// the family reads consistently across the stat library); only
// background/text/accent are user-editable.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", seg2: "#2E7DF6", seg3: "#17A34A", seg4: "#7C5CFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", seg2: "#FF4D1C", seg3: "#17A34A", seg4: "#7C5CFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", seg2: "#38C7FF", seg3: "#FF8A5C", seg4: "#B389FF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", seg2: "#FF4D1C", seg3: "#17A34A", seg4: "#2E7DF6" } },
];

const DEFAULT_STAGES = ["Visitors:12000", "Signups:4200", "Trials:1800", "Customers:600"];

interface Stage {
  label: string;
  value: number;
}

function resolveStages(values: Values): Stage[] {
  const raw = asList(values.stages, DEFAULT_STAGES).slice(0, 4);
  const items = raw.length >= 3 ? raw : DEFAULT_STAGES;
  return items.map((it) => {
    const idx = it.indexOf(":");
    const label = (idx >= 0 ? it.slice(0, idx) : it).trim();
    const valPart = idx >= 0 ? it.slice(idx + 1) : it;
    return { label: label.length ? label : it.trim(), value: Math.max(0, parseTargetNumber(valPart)) };
  });
}

const FUNNEL_START = 0.4;
const STAGGER = 0.42;
const BAND_DUR = 0.6;
const ROW_COUNT_DUR = 0.75;
const TAIL = 0.35;
const HOLD = 1.2;

function computeDuration(values: Values): number {
  const n = resolveStages(values).length;
  return FUNNEL_START + Math.max(0, n - 1) * STAGGER + ROW_COUNT_DUR + TAIL + HOLD;
}

interface Band {
  titleY: number;
  top: number;
  bottom: number;
}

function bandFor(aspect: Aspect, h: number): Band {
  switch (aspect) {
    case "16:9":
      return { titleY: h * 0.13, top: h * 0.28, bottom: h * 0.92 };
    case "9:16":
      return { titleY: h * 0.13, top: h * 0.21, bottom: h * 0.74 };
    case "4:5":
      return { titleY: h * 0.09, top: h * 0.19, bottom: h * 0.9 };
    default:
      return { titleY: h * 0.1, top: h * 0.21, bottom: h * 0.9 }; // 1:1
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const bandColors = [accent, pc("seg2", "#2E7DF6"), pc("seg3", "#17A34A"), pc("seg4", "#7C5CFF")];

  const title = str(values.title, "");
  const showPercents = values.showPercents !== false;
  const showAccentBar = values.accentBar !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const stages = resolveStages(values);
  const n = stages.length;
  const maxV = Math.max(1, ...stages.map((s) => s.value));
  const firstV = Math.max(1, stages[0]!.value);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const band = bandFor(ctx.aspect, h);
  const marginX = w * 0.08;
  const funnelW = w * 0.4;
  const cx = marginX + funnelW / 2;
  const labelX = marginX + funnelW + w * 0.06;
  const labelW = Math.max(60, w - labelX - w * 0.05);

  // --- Title + accent underline ---
  if (title.length > 0) {
    const titleSize = Math.round(minDim * 0.05);
    const titleText = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0 } },
      w - marginX * 2,
    );
    titleText.position.set(marginX, band.titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "x", from: marginX - 16, to: marginX, start: 0, duration: 0.5, ease: outExpo });

    if (showAccentBar) {
      const ruleW = titleSize * 1.6;
      const ruleH = Math.max(3, titleSize * 0.09);
      const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
      rule.position.set(marginX, band.titleY + titleSize * 1.4);
      rule.scale.set(0, 1);
      root.addChild(rule);
      timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
    }
  }

  // --- Bands: 3-4 trapezoids narrowing downward, each its own Container so it
  // can grow into place from a point at its own top-center. ---
  const MIN_FRAC = 0.24;
  const widthFrac = (v: number): number => MIN_FRAC + (1 - MIN_FRAC) * clamp01(v / maxV);

  const top = band.top;
  const bottom = band.bottom;
  const gapFrac = 0.12;
  const rowH = (bottom - top) / n;
  const bandH = rowH * (1 - gapFrac);
  const rowTop = (i: number): number => top + i * rowH;
  const rowCY = (i: number): number => rowTop(i) + bandH / 2;

  const nameSize = Math.max(10, Math.round(rowH * 0.2));
  const valueSize = Math.max(12, Math.round(rowH * 0.32));
  const pctSize = Math.max(9, Math.round(rowH * 0.18));

  const counters: { value: number; pct: number; valueText: Text; pctText: Text | null; start: number }[] = [];

  stages.forEach((s, i) => {
    const topW = funnelW * widthFrac(s.value);
    const nextV = i < n - 1 ? stages[i + 1]!.value : s.value * 0.82;
    const botW = funnelW * widthFrac(nextV);
    const bandStart = FUNNEL_START + i * STAGGER;

    const holder = new Container();
    holder.position.set(cx, rowTop(i));
    holder.scale.set(0, 0);
    root.addChild(holder);
    const shape = new Graphics().poly([-topW / 2, 0, topW / 2, 0, botW / 2, bandH, -botW / 2, bandH]).fill(bandColors[i % bandColors.length]!);
    holder.addChild(shape);
    timeline
      .to(holder, { prop: "scale.x", from: 0, to: 1, start: bandStart, duration: BAND_DUR, ease: outExpo })
      .to(holder, { prop: "scale.y", from: 0, to: 1, start: bandStart, duration: BAND_DUR, ease: outExpo });

    const cy = rowCY(i);
    const nameText = fitText(
      fonts,
      { text: s.label, role: "body", weight: 600, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } },
      labelW,
    );
    nameText.alpha = 0;
    nameText.position.set(labelX, cy - bandH * 0.32);
    root.addChild(nameText);
    timeline
      .to(nameText, { prop: "alpha", from: 0, to: 0.82, start: bandStart + 0.1, duration: 0.35, ease: outQuad })
      .to(nameText, { prop: "x", from: labelX - 12, to: labelX, start: bandStart + 0.1, duration: 0.4, ease: outExpo });

    const valueText = makeText(fonts, { text: "0", role: "display", weight: 700, size: valueSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    valueText.alpha = 0;
    valueText.position.set(labelX, cy + bandH * 0.04);
    root.addChild(valueText);
    timeline.to(valueText, { prop: "alpha", from: 0, to: 1, start: bandStart + 0.15, duration: 0.4, ease: outQuad });

    let pctText: Text | null = null;
    if (showPercents) {
      pctText = makeText(fonts, { text: "0%", role: "body", weight: 600, size: pctSize, color: textColor, anchor: { x: 0, y: 0.5 } });
      pctText.alpha = 0;
      pctText.position.set(labelX, cy + bandH * 0.36);
      root.addChild(pctText);
      timeline.to(pctText, { prop: "alpha", from: 0, to: 0.68, start: bandStart + 0.2, duration: 0.4, ease: outQuad });
    }

    counters.push({ value: s.value, pct: Math.round((s.value / firstV) * 100), valueText, pctText, start: bandStart + 0.15 });
  });

  const update = (t: number): void => {
    for (const c of counters) {
      const p = outExpo(clamp01((t - c.start) / ROW_COUNT_DUR));
      c.valueText.text = groupThousands(c.value * p);
      if (c.pctText) c.pctText.text = `${Math.round(c.pct * p)}%`;
    }
  };

  return { timeline, duration: computeDuration(values), update };
}

export const funnelChart: TemplateDefinition = {
  id: "funnel-chart",
  name: "Funnel Chart",
  tagline: "A conversion funnel narrows stage by stage as values count up.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", value: "display", label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Signup funnel", maxLength: 32, optional: true, shrinkToFit: true },
    { key: "stages", type: "textlist", label: "Stages (stage:value)", default: DEFAULT_STAGES, minItems: 3, maxItems: 4, maxLength: 22 },
    { key: "showPercents", type: "toggle", label: "Percent of top", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

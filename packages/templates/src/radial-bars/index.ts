import { Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  makeOutBack,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

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

function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number): Text {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

// `ringB`/`ringC` are a fixed categorical pair (like donut-chart's seg2/seg3) —
// only background/textColor/accent are user-editable, matching the stat family.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", ringB: "#2E7DF6", ringC: "#17A34A" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", ringB: "#7C5CFF", ringC: "#17A34A" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FAF5EA", accent: "#D8F34D", ringB: "#38C7FF", ringC: "#FF8A5C" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", ringB: "#FF4D1C", ringC: "#2E7DF6" } },
];

const DEFAULT_RINGS = ["Design:82", "Development:64", "Marketing:47"];

interface RingItem {
  label: string;
  percent: number;
}

function resolveRings(values: Values): RingItem[] {
  const raw = asList(values.rings, DEFAULT_RINGS).slice(0, 3);
  const items = raw.length >= 3 ? raw : DEFAULT_RINGS;
  return items.map((it) => {
    const idx = it.indexOf(":");
    const label = (idx >= 0 ? it.slice(0, idx) : it).trim();
    const valPart = idx >= 0 ? it.slice(idx + 1) : "0";
    const pct = Math.max(0, Math.min(100, Math.round(Number(valPart.replace(/[^\d.]/g, "")) || 0)));
    return { label: label.length ? label : it.trim(), percent: pct };
  });
}

const RING_START = [0.4, 0.75, 1.1];
const RING_DUR = 1.3;
const LAST_END = (RING_START[2] ?? 1.1) + RING_DUR; // 2.4
const DURATION = 4.2;

interface RBLayout {
  cx: number;
  cy: number;
  titleY: number;
  legendX: number;
  legendTop: number;
  legendW: number;
  rowH: number;
}

function layoutFor(aspect: Aspect, w: number, h: number): RBLayout {
  const minDim = Math.min(w, h);
  if (aspect === "16:9") {
    const cy = h * 0.54;
    const rowH = minDim * 0.13;
    return { cx: w * 0.26, cy, titleY: h * 0.13, legendX: w * 0.52, legendTop: cy - (3 * rowH) / 2, legendW: w * 0.44, rowH };
  }
  let titleYF: number;
  let cyF: number;
  let legendTopF: number;
  let legendXF: number;
  let legendWF: number;
  switch (aspect) {
    case "4:5":
      titleYF = 0.085;
      cyF = 0.349;
      legendTopF = 0.586;
      legendXF = 0.31;
      legendWF = 0.62;
      break;
    case "9:16":
      titleYF = 0.14;
      cyF = 0.325;
      legendTopF = 0.492;
      legendXF = 0.32;
      legendWF = 0.64;
      break;
    default:
      titleYF = 0.1;
      cyF = 0.431;
      legendTopF = 0.728;
      legendXF = 0.3;
      legendWF = 0.6;
  }
  return {
    cx: w / 2,
    cy: h * cyF,
    titleY: h * titleYF,
    legendX: w / 2 - w * legendXF,
    legendTop: h * legendTopF,
    legendW: w * legendWF,
    rowH: minDim * 0.062,
  };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const ringColors = [accent, pc("ringB", "#2E7DF6"), pc("ringC", "#17A34A")];

  const title = str(values.title, "Skill breakdown");
  const showLegend = values.showLegend !== false;
  const showAccentBar = values.accentBar !== false;

  const rings = resolveRings(values);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  const L = layoutFor(ctx.aspect, w, h);
  const Router = minDim * 0.26;
  const thick = minDim * 0.044;
  const gapR = minDim * 0.02;
  const radii = [Router - thick / 2, Router - 1.5 * thick - gapR, Router - 2.5 * thick - 2 * gapR];

  // --- Title + accent underline ---
  if (title.length > 0) {
    const titleSize = Math.round(minDim * 0.05);
    const titleText = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.82,
    );
    titleText.position.set(w / 2, L.titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "y", from: L.titleY - 14, to: L.titleY, start: 0, duration: 0.5, ease: outQuint });

    if (showAccentBar) {
      const ruleW = titleSize * 1.5;
      const ruleH = Math.max(3, titleSize * 0.09);
      const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
      rule.position.set(w / 2 - ruleW / 2, L.titleY + titleSize * 0.82);
      rule.scale.set(0, 1);
      root.addChild(rule);
      timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
    }
  }

  // --- Faint tracks behind the sweeping rings (unconditional, structural) ---
  for (const r of radii) {
    const track = new Graphics().circle(0, 0, r).stroke({ color: textColor, width: thick, alpha: 0.09 });
    track.position.set(L.cx, L.cy);
    root.addChild(track);
  }

  // --- Sweeping rings: redrawn per frame (arc angle isn't a tweenable prop) ---
  const ringsG = new Graphics();
  ringsG.position.set(L.cx, L.cy);
  root.addChild(ringsG);

  const ringDefs = rings.map((r, i) => ({
    percent: r.percent,
    radius: radii[i] ?? radii[radii.length - 1]!,
    color: ringColors[i % ringColors.length]!,
    start: RING_START[i] ?? RING_START[RING_START.length - 1]!,
  }));

  // Settle pulse once every ring has finished sweeping.
  timeline
    .to(ringsG, { prop: "scale.x", from: 1, to: 1.035, start: LAST_END, duration: 0.16, ease: outQuad })
    .to(ringsG, { prop: "scale.x", from: 1.035, to: 1, start: LAST_END + 0.16, duration: 0.26, ease: outQuad })
    .to(ringsG, { prop: "scale.y", from: 1, to: 1.035, start: LAST_END, duration: 0.16, ease: outQuad })
    .to(ringsG, { prop: "scale.y", from: 1.035, to: 1, start: LAST_END + 0.16, duration: 0.26, ease: outQuad });

  // --- Legend: swatch + label + live counting percent, staggered per ring ---
  const legendTexts: { el: Text; ring: (typeof ringDefs)[number] }[] = [];
  if (showLegend) {
    const legendFont = Math.round(minDim * 0.032);
    const pctFont = Math.round(legendFont * 1.02);
    ringDefs.forEach((r, i) => {
      const item = rings[i];
      if (!item) return;
      const rowCY = L.legendTop + (i + 0.5) * L.rowH;
      const swatchR = Math.max(6, L.rowH * 0.19);
      const swatchX = L.legendX + swatchR;
      const start = r.start;

      const swatch = new Graphics().roundRect(-swatchR, -swatchR, swatchR * 2, swatchR * 2, swatchR * 0.4).fill(r.color);
      swatch.position.set(swatchX, rowCY);
      swatch.scale.set(0);
      root.addChild(swatch);
      timeline
        .to(swatch, { prop: "scale.x", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(1.8) })
        .to(swatch, { prop: "scale.y", from: 0, to: 1, start, duration: 0.4, ease: makeOutBack(1.8) });

      const pctText = makeText(fonts, { text: "0%", role: "display", weight: 700, size: pctFont, color: textColor, anchor: { x: 1, y: 0.5 } });
      pctText.position.set(L.legendX + L.legendW, rowCY);
      pctText.alpha = 0;
      root.addChild(pctText);
      timeline.to(pctText, { prop: "alpha", from: 0, to: 1, start: start + 0.1, duration: 0.35, ease: outQuad });
      legendTexts.push({ el: pctText, ring: r });

      const labelX = swatchX + swatchR + legendFont * 0.55;
      const labelMaxW = Math.max(20, L.legendW - swatchR * 2 - legendFont * 0.55 - pctFont * 2.6);
      const labelText = fitText(
        fonts,
        { text: item.label, role: "body", weight: 600, size: legendFont, color: textColor, anchor: { x: 0, y: 0.5 } },
        labelMaxW,
      );
      labelText.position.set(labelX, rowCY);
      labelText.alpha = 0;
      root.addChild(labelText);
      timeline
        .to(labelText, { prop: "alpha", from: 0, to: 1, start: start + 0.05, duration: 0.35, ease: outQuad })
        .to(labelText, { prop: "x", from: labelX - 10, to: labelX, start: start + 0.05, duration: 0.4, ease: outQuint });
    });
  }

  const update = (t: number): void => {
    ringsG.clear();
    for (const r of ringDefs) {
      const p = outExpo(clamp01((t - r.start) / RING_DUR));
      if (p <= 0.001 || r.percent <= 0) continue;
      const angle = -Math.PI / 2 + p * (r.percent / 100) * Math.PI * 2;
      ringsG.arc(0, 0, r.radius, -Math.PI / 2, angle).stroke({ color: r.color, width: thick, cap: "round" });
      const tipX = Math.cos(angle) * r.radius;
      const tipY = Math.sin(angle) * r.radius;
      ringsG.circle(tipX, tipY, thick * 0.5).fill(r.color);
    }
    for (const lt of legendTexts) {
      const p = outExpo(clamp01((t - lt.ring.start) / RING_DUR));
      lt.el.text = `${Math.round(lt.ring.percent * p)}%`;
    }
  };

  return { timeline, duration: DURATION, update };
}

export const radialBars: TemplateDefinition = {
  id: "radial-bars",
  name: "Radial Bars",
  tagline: "Three nested rings sweep in as their percentages count up.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { title: "display", legend: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Skill breakdown", maxLength: 32, optional: true, shrinkToFit: true },
    { key: "rings", type: "textlist", label: "Rings (label:percent)", default: DEFAULT_RINGS, minItems: 3, maxItems: 3, maxLength: 24 },
    { key: "showLegend", type: "toggle", label: "Legend", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

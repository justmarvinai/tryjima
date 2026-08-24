import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
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

const DEG = Math.PI / 180;
const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const a = v.filter((x): x is string => typeof x === "string" && x.length > 0);
    if (a.length) return a;
  }
  return fb;
};

/** Create text; if it would overflow `maxWidth`, re-make one size smaller (crisp). */
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

// Circle fills are deep, saturated hues verified to keep the (fixed) onCircle
// text ≥4.5:1 even after alpha-blending toward the background (so the
// "solo lobe" area of each circle stays readable regardless of overlap).
// Only background/text/accent (circle A) are user-editable.
const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#A6300E", circleB: "#2A5AD6", circleC: "#0E5C36", onCircle: "#FFFFFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2A5AD6", circleB: "#A6300E", circleC: "#6D3BEA", onCircle: "#FFFFFF" } },
  { id: "berry", name: "Berry", colors: { background: "#FFEEF6", textColor: "#3A0A28", accent: "#C21473", circleB: "#1E3A78", circleC: "#0E5C36", onCircle: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#38C7FF", circleB: "#D8F34D", circleC: "#FF8A5C", onCircle: "#101014" } },
];

const DEFAULT_CIRCLES = ["Design", "Code"];

function resolveLabels(values: Values): string[] {
  const raw = asList(values.circles, DEFAULT_CIRCLES).slice(0, 3);
  return raw.length >= 2 ? raw : DEFAULT_CIRCLES;
}

const CIRCLE_START = 0.35;
const CIRCLE_STAGGER = 0.16;
const CIRCLE_DUR = 0.6;
const OVERLAP_GAP = 0.15;
const OVERLAP_DUR = 0.55;
const HOLD = 1.15;

function computeDuration(values: Values): number {
  const n = resolveLabels(values).length;
  return CIRCLE_START + Math.max(0, n - 1) * CIRCLE_STAGGER + CIRCLE_DUR + OVERLAP_GAP + OVERLAP_DUR + HOLD;
}

interface CenterLayout {
  cx: number;
  cy: number;
  titleY: number;
}

function centerFor(aspect: Aspect, w: number, h: number): CenterLayout {
  switch (aspect) {
    case "16:9":
      return { cx: w * 0.5, cy: h * 0.58, titleY: h * 0.14 };
    case "9:16":
      return { cx: w * 0.5, cy: h * 0.42, titleY: h * 0.14 };
    case "4:5":
      return { cx: w * 0.5, cy: h * 0.45, titleY: h * 0.1 };
    default:
      return { cx: w * 0.5, cy: h * 0.47, titleY: h * 0.11 }; // 1:1
  }
}

/** Angles for each circle's center, evenly arranged so (cx,cy) is always the shared middle. */
function circleAngles(n: number): number[] {
  if (n >= 3) return [0, 1, 2].map((k) => (-90 + k * 120) * DEG);
  return [180 * DEG, 0 * DEG];
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#A6300E"));
  const circleB = pc("circleB", "#2A5AD6");
  const circleC = pc("circleC", "#0E5C36");
  const onCircle = pc("onCircle", "#FFFFFF");
  const circleColors = [accent, circleB, circleC];

  const title = str(values.title, "");
  const overlapLabel = str(values.overlapLabel, "Both");
  const showOverlapLabel = values.showOverlapLabel !== false;
  const showAccentBar = values.accentBar !== false;

  const labels = resolveLabels(values);
  const n = labels.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const Lc = centerFor(ctx.aspect, w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  // --- Title + accent underline ---
  if (title.length > 0) {
    const titleSize = Math.round(minDim * 0.05);
    const titleText = fitText(
      fonts,
      { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
      w * 0.84,
    );
    titleText.position.set(w / 2, Lc.titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
      .to(titleText, { prop: "y", from: Lc.titleY - 14, to: Lc.titleY, start: 0, duration: 0.5, ease: outExpo });

    if (showAccentBar) {
      const ruleW = titleSize * 1.6;
      const ruleH = Math.max(3, titleSize * 0.09);
      const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
      rule.position.set(w / 2 - ruleW / 2, Lc.titleY + titleSize * 0.85);
      rule.scale.set(0, 1);
      root.addChild(rule);
      timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
    }
  }

  const R = n === 3 ? minDim * 0.155 : minDim * 0.185;
  const d = n === 3 ? R * 0.62 : R * 0.58;
  const angles = circleAngles(n);

  // --- Circles: scale in with a soft overshoot, alpha < 1 so overlapping
  // lobes visibly blend where they intersect. ---
  const circleNodes = angles.map((angle, i) => {
    const ccx = Lc.cx + Math.cos(angle) * d;
    const ccy = Lc.cy + Math.sin(angle) * d;
    const g = new Graphics().circle(0, 0, R).fill({ color: circleColors[i % circleColors.length]!, alpha: 0.9 });
    g.position.set(ccx, ccy);
    g.scale.set(0);
    root.addChild(g);
    const start = CIRCLE_START + i * CIRCLE_STAGGER;
    timeline
      .to(g, { prop: "scale.x", from: 0, to: 1, start, duration: CIRCLE_DUR, ease: makeOutBack(1.3) })
      .to(g, { prop: "scale.y", from: 0, to: 1, start, duration: CIRCLE_DUR, ease: makeOutBack(1.3) });
    return { angle, start };
  });

  // --- Lobe labels, pushed outward from each circle's own center so they sit
  // in that circle's solo region (never in the blended overlap). ---
  const labelFont = Math.round(minDim * 0.03);
  const labelMaxW = R * 1.5;
  circleNodes.forEach((cn, i) => {
    const lx = Lc.cx + Math.cos(cn.angle) * (d + R * 0.42);
    const ly = Lc.cy + Math.sin(cn.angle) * (d + R * 0.42);
    const txt = fitText(
      fonts,
      { text: labels[i] ?? "", role: "display", weight: 700, size: labelFont, color: onCircle, anchor: 0.5, align: "center" },
      labelMaxW,
    );
    txt.position.set(lx, ly);
    txt.alpha = 0;
    txt.scale.set(0.7);
    root.addChild(txt);
    const start = cn.start + 0.3;
    timeline
      .to(txt, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(txt, { prop: "scale.x", from: 0.7, to: 1, start, duration: 0.45, ease: makeOutBack(1.6) })
      .to(txt, { prop: "scale.y", from: 0.7, to: 1, start, duration: 0.45, ease: makeOutBack(1.6) });
  });

  // --- Overlap badge: an emphasized, delayed pop landing on top of everything.
  // Its own background-colored chip guarantees text contrast independent of
  // whatever the blended circles look like underneath. ---
  const lastCircleStart = CIRCLE_START + Math.max(0, n - 1) * CIRCLE_STAGGER;
  const OVERLAP_START = lastCircleStart + CIRCLE_DUR + OVERLAP_GAP;
  if (showOverlapLabel && overlapLabel.length > 0) {
    const badgeFont = Math.round(minDim * 0.028);
    const badgeText = fitText(
      fonts,
      { text: overlapLabel, role: "display", weight: 700, size: badgeFont, color: textColor, anchor: 0.5, align: "center" },
      R * 1.1,
    );
    const padX = badgeFont * 0.9;
    const padY = badgeFont * 0.55;
    const badgeW = badgeText.width + padX * 2;
    const badgeH = badgeText.height + padY * 2;

    const badge = new Container();
    const chip = new Graphics()
      .roundRect(-badgeW / 2, -badgeH / 2, badgeW, badgeH, badgeH / 2)
      .fill({ color: bg, alpha: 0.96 })
      .stroke({ color: textColor, width: Math.max(1.5, minDim * 0.0025), alpha: 0.18 });
    badge.addChild(chip);
    badgeText.position.set(0, 0);
    badge.addChild(badgeText);
    badge.position.set(Lc.cx, Lc.cy);
    badge.scale.set(0);
    root.addChild(badge);
    timeline
      .to(badge, { prop: "scale.x", from: 0, to: 1, start: OVERLAP_START, duration: OVERLAP_DUR, ease: makeOutBack(2.1) })
      .to(badge, { prop: "scale.y", from: 0, to: 1, start: OVERLAP_START, duration: OVERLAP_DUR, ease: makeOutBack(2.1) });
  }

  return { timeline, duration: computeDuration(values) };
}

export const vennDiagram: TemplateDefinition = {
  id: "venn-diagram",
  name: "Venn Diagram",
  tagline: "Two or three circles overlap and blend as the shared idea lands.",
  category: "comparison",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.1,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", lobe: "display", overlap: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Where they overlap", maxLength: 32, optional: true, shrinkToFit: true },
    { key: "circles", type: "textlist", label: "Circles (labels)", default: DEFAULT_CIRCLES, minItems: 2, maxItems: 3, maxLength: 18 },
    { key: "overlapLabel", type: "text", label: "Overlap label", default: "Both", maxLength: 20, optional: true },
    { key: "showOverlapLabel", type: "toggle", label: "Overlap label", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

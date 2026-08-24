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
import { parseTargetNumber } from "../shared/format";

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
function fitText(fonts: FontRegistry, opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(8, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

// A solid pie is one continuous wheel, so — unlike the donut-chart's ring —
// segment fills stay a fixed categorical set; only background/text/accent are
// user-editable (accent doubles as slice 1's color).
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", seg2: "#2E7DF6", seg3: "#17A34A", seg4: "#7C5CFF", seg5: "#FFC94D" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", seg2: "#FF4D1C", seg3: "#17A34A", seg4: "#7C5CFF", seg5: "#00B8D9" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", seg2: "#38C7FF", seg3: "#FF8A5C", seg4: "#B389FF", seg5: "#FF6FA5" } },
  { id: "grape", name: "Grape", colors: { background: "#F4EFFF", textColor: "#241052", accent: "#7C5CFF", seg2: "#FF4D1C", seg3: "#17A34A", seg4: "#2E7DF6", seg5: "#FFC94D" } },
];

const DEFAULT_SLICES = ["Product:42", "Services:28", "Licensing:18", "Other:12"];

interface Slice {
  label: string;
  value: number;
}

function resolveSlices(values: Values): Slice[] {
  const raw = asList(values.slices, DEFAULT_SLICES).slice(0, 5);
  const items = raw.length >= 3 ? raw : DEFAULT_SLICES;
  return items.map((it) => {
    const idx = it.indexOf(":");
    const label = (idx >= 0 ? it.slice(0, idx) : it).trim();
    const valPart = idx >= 0 ? it.slice(idx + 1) : it;
    return { label: label.length ? label : it.trim(), value: Math.max(0, parseTargetNumber(valPart)) };
  });
}

const SEG_START = 0.5;
const SEG_EACH = 0.32;
const SEG_DUR = 0.55;
const LABEL_TAIL = 0.4;
const HOLD = 1.1;

function sweepSpan(n: number): number {
  return Math.max(0, n - 1) * SEG_EACH + SEG_DUR;
}
function computeDuration(values: Values): number {
  return SEG_START + sweepSpan(resolveSlices(values).length) + LABEL_TAIL + HOLD;
}

interface Layout {
  cx: number;
  cy: number;
  R: number;
  titleY: number;
}

function layoutFor(aspect: Aspect, w: number, h: number): Layout {
  const minDim = Math.min(w, h);
  switch (aspect) {
    case "16:9":
      return { cx: w * 0.5, cy: h * 0.58, R: minDim * 0.27, titleY: h * 0.13 };
    case "9:16":
      return { cx: w * 0.5, cy: h * 0.42, R: minDim * 0.24, titleY: h * 0.15 };
    case "4:5":
      return { cx: w * 0.5, cy: h * 0.44, R: minDim * 0.25, titleY: h * 0.1 };
    default:
      return { cx: w * 0.5, cy: h * 0.47, R: minDim * 0.27, titleY: h * 0.12 }; // 1:1
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const segColors = [accent, pc("seg2", "#2E7DF6"), pc("seg3", "#17A34A"), pc("seg4", "#7C5CFF"), pc("seg5", "#FFC94D")];

  const title = str(values.title, "");
  const showLabels = values.showLabels !== false;
  const showAccentBar = values.accentBar !== false;

  const slices = resolveSlices(values);
  const total = Math.max(1, slices.reduce((a, b) => a + b.value, 0));

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const L = layoutFor(ctx.aspect, w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);
  const timeline = new JimaTimeline();

  // --- Title + accent underline ---
  if (title.length > 0) {
    const titleSize = Math.round(minDim * 0.052);
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
      .to(titleText, { prop: "y", from: L.titleY - 14, to: L.titleY, start: 0, duration: 0.5, ease: outExpo });

    if (showAccentBar) {
      const ruleW = titleSize * 1.6;
      const ruleH = Math.max(3, titleSize * 0.09);
      const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
      rule.position.set(w / 2 - ruleW / 2, L.titleY + titleSize * 0.85);
      rule.scale.set(0, 1);
      root.addChild(rule);
      timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
    }
  }

  // --- Wedges: one Graphics per slice (own object so each can pop on landing).
  // Redrawn every frame in update() since a partial arc's span isn't a plain
  // tweenable prop (same technique as donut-chart/progress-ring, extended to a
  // filled wedge instead of a stroked ring). ---
  let cursor = -Math.PI / 2;
  const wedges = slices.map((s, i) => {
    const span = (s.value / total) * Math.PI * 2;
    const a0 = cursor;
    cursor += span;
    const start = SEG_START + i * SEG_EACH;
    const pct = Math.round((s.value / total) * 100);
    const mid = a0 + span / 2;
    const g = new Graphics();
    g.position.set(L.cx, L.cy);
    root.addChild(g);
    // Landing micro-pop once this wedge finishes sweeping in.
    timeline
      .to(g, { prop: "scale.x", from: 1, to: 1.035, start: start + SEG_DUR, duration: 0.14, ease: outQuad })
      .to(g, { prop: "scale.x", from: 1.035, to: 1, start: start + SEG_DUR + 0.14, duration: 0.22, ease: outQuad })
      .to(g, { prop: "scale.y", from: 1, to: 1.035, start: start + SEG_DUR, duration: 0.14, ease: outQuad })
      .to(g, { prop: "scale.y", from: 1.035, to: 1, start: start + SEG_DUR + 0.14, duration: 0.22, ease: outQuad });
    return { g, a0, span, start, pct, mid, color: segColors[i % segColors.length]!, label: s.label };
  });

  // --- Radial % + name labels, beside the pie on the page background (never
  // on the wedge fill itself) so contrast is guaranteed regardless of slice
  // color or palette. A slice's mid-angle is data-driven (any value split can
  // put it exactly horizontal or vertical), so both the max width and the
  // vertical position are clamped per-wedge from the actual anchor point out
  // to the edge — never a flat fraction — so long names/values can never spill
  // off-canvas or collide with the title. ---
  if (showLabels) {
    const labelR = L.R * 1.3;
    const edgeMarginX = w * 0.04;
    const labelSafeTop = title.length > 0 ? L.titleY + minDim * 0.1 : minDim * 0.04;
    const labelSafeBottom = h - minDim * 0.04;
    wedges.forEach((wd) => {
      const dirX = Math.cos(wd.mid);
      const dirY = Math.sin(wd.mid);
      const ax = dirX > 0.2 ? 0 : dirX < -0.2 ? 1 : 0.5;

      const tick = new Graphics()
        .moveTo(L.cx + dirX * L.R * 1.03, L.cy + dirY * L.R * 1.03)
        .lineTo(L.cx + dirX * L.R * 1.18, L.cy + dirY * L.R * 1.18)
        .stroke({ color: textColor, width: Math.max(1.5, minDim * 0.0025), alpha: 0.3 });
      tick.alpha = 0;
      root.addChild(tick);

      const gx = Math.min(w - edgeMarginX, Math.max(edgeMarginX, L.cx + dirX * labelR));
      const gy = Math.min(labelSafeBottom, Math.max(labelSafeTop, L.cy + dirY * labelR));
      const labelMaxW =
        ax === 0
          ? Math.max(50, w - edgeMarginX - gx)
          : ax === 1
            ? Math.max(50, gx - edgeMarginX)
            : Math.max(50, Math.min(gx - edgeMarginX, w - edgeMarginX - gx) * 2);

      const group = new Container();
      group.position.set(gx, gy);
      group.scale.set(0.7);
      group.alpha = 0;
      root.addChild(group);

      const pctSize = Math.round(minDim * 0.038);
      const pctText = makeText(fonts, { text: `${wd.pct}%`, role: "display", weight: 700, size: pctSize, color: textColor, anchor: { x: ax, y: 1 } });
      pctText.position.set(0, -2);
      group.addChild(pctText);

      const nameSize = Math.round(minDim * 0.022);
      const nameText = fitText(
        fonts,
        { text: wd.label, role: "body", weight: 600, size: nameSize, color: textColor, anchor: { x: ax, y: 0 } },
        labelMaxW,
      );
      nameText.alpha = 0.78;
      nameText.position.set(0, 2);
      group.addChild(nameText);

      const popStart = wd.start + SEG_DUR * 0.55;
      timeline
        .to(tick, { prop: "alpha", from: 0, to: 1, start: popStart, duration: 0.3, ease: outQuad })
        .to(group, { prop: "alpha", from: 0, to: 1, start: popStart, duration: 0.32, ease: outQuad })
        .to(group, { prop: "scale.x", from: 0.7, to: 1, start: popStart, duration: 0.4, ease: makeOutBack(1.8) })
        .to(group, { prop: "scale.y", from: 0.7, to: 1, start: popStart, duration: 0.4, ease: makeOutBack(1.8) });
    });
  }

  const update = (t: number): void => {
    for (const wd of wedges) {
      const p = outExpo(clamp01((t - wd.start) / SEG_DUR));
      wd.g.clear();
      if (p <= 0.001 || wd.span <= 0) continue;
      const a1 = wd.a0 + p * wd.span;
      wd.g.moveTo(0, 0).arc(0, 0, L.R, wd.a0, a1).closePath().fill(wd.color);
    }
  };

  return { timeline, duration: computeDuration(values), update };
}

export const pieChart: TemplateDefinition = {
  id: "pie-chart",
  name: "Pie Chart",
  tagline: "A solid pie sweeps in slice by slice as each share is labeled.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.5,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", percent: "display", label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Market share", maxLength: 32, optional: true, shrinkToFit: true },
    { key: "slices", type: "textlist", label: "Slices (label:value)", default: DEFAULT_SLICES, minItems: 3, maxItems: 5, maxLength: 20 },
    { key: "showLabels", type: "toggle", label: "Slice labels", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

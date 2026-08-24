import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type BuiltTemplate,
  type FontRegistry,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
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

const DEFAULT_STEPS = ["Pick a template", "Add your text", "Export & post"];
const PER_STEP = 0.6;

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFFFFF", textColor: "#151016", accent: "#FF4D1C", onAccent: "#FFFFFF" } },
  { id: "grape", name: "Grape", colors: { background: "#F4F1FF", textColor: "#241452", accent: "#7C5CFF", onAccent: "#FFFFFF" } },
  { id: "ocean", name: "Ocean", colors: { background: "#EEF4FF", textColor: "#0B1F4D", accent: "#2E7DF6", onAccent: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#FAF5EA", accent: "#D8F34D", onAccent: "#101014" } },
];

function computeDuration(values: Values): number {
  const steps = asList(values.steps, DEFAULT_STEPS).slice(0, 4);
  return 1.0 + steps.length * PER_STEP + 1.2;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const aspect = ctx.aspect;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#151016"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const title = str(values.title, "How it works");
  const steps = asList(values.steps, DEFAULT_STEPS).slice(0, 4);
  const n = steps.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  const horizontal = aspect === "16:9" || aspect === "1:1";

  // --- Title (centered) + accent rule ---
  const titleY = h * (aspect === "16:9" ? 0.15 : aspect === "1:1" ? 0.13 : aspect === "9:16" ? 0.14 : 0.11);
  const titleSize = Math.round(minDim * (horizontal ? 0.052 : 0.058));
  const titleText = fitText(
    fonts,
    { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" },
    w - w * 0.16,
  );
  titleText.position.set(w / 2, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 16, to: titleY, start: 0.0, duration: 0.55, ease: outExpo });

  const showAccentBar = values.accentBar !== false;
  if (showAccentBar) {
    const ruleW = minDim * 0.13;
    const ruleTh = Math.max(3, minDim * 0.01);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleTh, ruleTh / 2).fill(accent);
    rule.pivot.set(ruleW / 2, ruleTh / 2);
    rule.position.set(w / 2, titleY + titleSize * 0.92);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
  }

  // --- Per-step geometry ---
  const cxs: number[] = [];
  const cys: number[] = [];
  let R: number;
  let numSize: number;
  let labelSize: number;
  let cellSpan: number; // distance between consecutive centers
  let marginX: number;

  if (horizontal) {
    marginX = w * 0.08;
    const availW = w - marginX * 2;
    cellSpan = availW / n;
    const rowY = h * (aspect === "16:9" ? 0.5 : 0.52);
    R = Math.min(cellSpan * 0.22, minDim * 0.11);
    numSize = Math.round(R * 0.92);
    labelSize = Math.round(minDim * (aspect === "16:9" ? 0.03 : 0.034));
    for (let i = 0; i < n; i++) {
      cxs.push(marginX + (i + 0.5) * cellSpan);
      cys.push(rowY);
    }
  } else {
    marginX = w * 0.09;
    const bandTop = aspect === "9:16" ? 360 : h * 0.28;
    const bandBot = aspect === "9:16" ? h - 430 : h * 0.9;
    cellSpan = (bandBot - bandTop) / n;
    R = Math.min(cellSpan * 0.26, w * 0.1);
    const circleX = marginX + R;
    numSize = Math.round(R * 0.92);
    labelSize = Math.round(w * (aspect === "9:16" ? 0.046 : 0.05));
    for (let i = 0; i < n; i++) {
      cxs.push(circleX);
      cys.push(bandTop + (i + 0.5) * cellSpan);
    }
  }

  const stepStart = (i: number): number => 0.8 + i * PER_STEP;
  const connTh = Math.max(3, minDim * 0.009);
  const chS = R * 0.32;
  const showConnector = values.connector !== false;

  // --- Connectors (drawn behind circles) ---
  if (showConnector) {
    for (let i = 0; i < n - 1; i++) {
      const x0 = cxs[i]!;
      const y0 = cys[i]!;
      const x1 = cxs[i + 1]!;
      const y1 = cys[i + 1]!;
      const connStart = stepStart(i) + 0.34;

      const line = new Graphics();
      if (horizontal) {
        const len = x1 - x0 - 2 * R;
        line.roundRect(0, -connTh / 2, len, connTh, connTh / 2).fill({ color: accent, alpha: 0.5 });
        line.position.set(x0 + R, y0);
      } else {
        const len = y1 - y0 - 2 * R;
        line.roundRect(-connTh / 2, 0, connTh, len, connTh / 2).fill({ color: accent, alpha: 0.5 });
        line.position.set(x0, y0 + R);
      }
      line.scale.set(horizontal ? 0 : 1, horizontal ? 1 : 0);
      root.addChild(line);
      timeline.to(line, {
        prop: horizontal ? "scale.x" : "scale.y",
        from: 0,
        to: 1,
        start: connStart,
        duration: 0.34,
        ease: outExpo,
      });

      // Chevron arrowhead near the next step.
      const chev = new Graphics();
      if (horizontal) {
        chev
          .poly([-chS, -chS, 0, 0, -chS, chS], false)
          .stroke({ color: accent, width: Math.max(2, connTh * 0.9), cap: "round", join: "round" });
        chev.position.set(x1 - R, y0);
      } else {
        chev
          .poly([-chS, -chS, 0, 0, chS, -chS], false)
          .stroke({ color: accent, width: Math.max(2, connTh * 0.9), cap: "round", join: "round" });
        chev.position.set(x0, y1 - R);
      }
      chev.alpha = 0;
      root.addChild(chev);
      timeline.to(chev, { prop: "alpha", from: 0, to: 1, start: connStart + 0.22, duration: 0.2, ease: outQuad });
    }
  }

  // --- Step circles + numbers + labels ---
  for (let i = 0; i < n; i++) {
    const cxp = cxs[i]!;
    const cyp = cys[i]!;
    const S = stepStart(i);

    const circle = new Container();
    circle.position.set(cxp, cyp);
    circle.addChild(new Graphics().circle(0, 0, R).fill(accent));
    circle.addChild(
      makeText(fonts, { text: String(i + 1), role: "display", weight: 700, size: numSize, color: onAccent, anchor: 0.5 }),
    );
    circle.scale.set(0);
    circle.alpha = 0;
    root.addChild(circle);
    timeline
      .to(circle, { prop: "alpha", from: 0, to: 1, start: S, duration: 0.3, ease: outQuad })
      .to(circle, { prop: "scale.x", from: 0, to: 1, start: S, duration: 0.62, ease: spring(0.5) })
      .to(circle, { prop: "scale.y", from: 0, to: 1, start: S, duration: 0.62, ease: spring(0.5) });

    const step = steps[i]!;
    if (horizontal) {
      const labelY = cyp + R + minDim * 0.05;
      const label = fitText(
        fonts,
        { text: step, role: "body", weight: 600, size: labelSize, color: textColor, anchor: { x: 0.5, y: 0 }, align: "center" },
        cellSpan * 0.9,
      );
      label.position.set(cxp, labelY);
      label.alpha = 0;
      root.addChild(label);
      timeline
        .to(label, { prop: "alpha", from: 0, to: 1, start: S + 0.18, duration: 0.35, ease: outQuad })
        .to(label, { prop: "y", from: labelY + 16, to: labelY, start: S + 0.18, duration: 0.5, ease: outExpo });
    } else {
      const labelX = cxp + R + minDim * 0.04;
      const label = fitText(
        fonts,
        { text: step, role: "body", weight: 600, size: labelSize, color: textColor, anchor: { x: 0, y: 0.5 } },
        w - marginX - labelX,
      );
      label.position.set(labelX, cyp);
      label.alpha = 0;
      root.addChild(label);
      timeline
        .to(label, { prop: "alpha", from: 0, to: 1, start: S + 0.18, duration: 0.35, ease: outQuad })
        .to(label, { prop: "x", from: labelX + 16, to: labelX, start: S + 0.18, duration: 0.5, ease: outExpo });
    }
  }

  return { timeline, duration: computeDuration(values) };
}

export const stepFlow: TemplateDefinition = {
  id: "step-flow",
  name: "Step Flow",
  tagline: "A numbered process builds step by step with connectors.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "How it works", maxLength: 40, shrinkToFit: true },
    { key: "steps", type: "textlist", label: "Steps", default: DEFAULT_STEPS, minItems: 2, maxItems: 4, maxLength: 28 },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "connector", type: "toggle", label: "Connector line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

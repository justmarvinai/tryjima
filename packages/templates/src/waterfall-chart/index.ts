import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
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
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

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
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

// Up/down bar fills carry no text, so they stay semantic (green rise / red drop)
// and are user-editable; background/textColor keep ≥ 4.5:1 in every palette.
const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#2E7DF6", upColor: "#17A34A", downColor: "#E5484D", grid: "#E7E9EF" } },
  { id: "slate", name: "Slate", colors: { background: "#F3F5F8", textColor: "#16202B", accent: "#2E7DF6", upColor: "#148F5B", downColor: "#D64550", grid: "#DDE2EA" } },
  { id: "mint", name: "Mint", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#0E7C4E", upColor: "#17A34A", downColor: "#E5484D", grid: "#D2EEDD" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", upColor: "#33E2A0", downColor: "#FF6B6B", grid: "#26262E" } },
];

interface Step {
  label: string;
  value: number;
  display: string;
}

const DEFAULT_STEPS = ["Start|120", "Sales|+60", "Refunds|-25", "Fees|-15", "Growth|+40"];

function parseStep(raw: string): Step {
  const idx = raw.indexOf("|");
  const label = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const valPart = (idx >= 0 ? raw.slice(idx + 1) : "").trim();
  const value = parseTargetNumber(valPart);
  const signed = value > 0 ? `+${groupThousands(value)}` : value < 0 ? `-${groupThousands(-value)}` : groupThousands(0);
  return { label: label.length ? label : "—", value, display: signed };
}

function stepsOf(values: Values): Step[] {
  return asList(values.steps, DEFAULT_STEPS).slice(0, 6).map(parseStep);
}

const BARS_START = 0.7;
const BAR_EACH = 0.2;
const BAR_GROW = 0.6;
const HOLD = 0.9;

function computeDuration(values: Values): number {
  const n = stepsOf(values).length;
  const totalStart = BARS_START + n * BAR_EACH + 0.1;
  return totalStart + BAR_GROW + HOLD;
}

function bandTop(aspect: string): number {
  switch (aspect) {
    case "16:9":
      return 0.2;
    case "9:16":
      return 0.16;
    default:
      return 0.17;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#2E7DF6"));
  const upColor = str(values.upColor, pc("upColor", "#17A34A"));
  const downColor = str(values.downColor, pc("downColor", "#E5484D"));

  const title = str(values.title, "Revenue bridge");
  const showConnectors = values.showConnectors !== false;
  const showAccentBar = values.accentBar !== false;

  const steps = stepsOf(values);
  const n = steps.length;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const marginX = w * 0.08;
  const plotLeft = marginX;
  const plotW = w - marginX * 2;

  // --- Cumulative levels (before/after each step) + auto total ---
  let running = 0;
  const origins: number[] = [];
  const posts: number[] = [];
  for (const s of steps) {
    origins.push(running);
    running += s.value;
    posts.push(running);
  }
  const finalTotal = running;
  const allLevels = [0, finalTotal, ...origins, ...posts];
  let vMin = Math.min(...allLevels);
  let vMax = Math.max(...allLevels);
  if (vMax - vMin < 1e-6) {
    vMax = vMin + 1;
  }
  const pad = (vMax - vMin) * 0.14;
  vMin -= pad;
  vMax += pad;

  // --- Title (+ accent underline) ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), plotW);
  const titleY = size.height * 0.09;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  titleText.position.set(plotLeft, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: plotLeft - 16, to: plotLeft, start: 0, duration: 0.5, ease: outQuint });

  if (showAccentBar) {
    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(plotLeft, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
  }

  // --- Plot geometry ---
  const catLabelH = minDim * 0.06;
  const plotTop = h * bandTop(ctx.aspect);
  const plotBottom = h - h * 0.06 - catLabelH;
  const plotH = plotBottom - plotTop;
  const mapY = (v: number): number => plotBottom - ((v - vMin) / (vMax - vMin)) * plotH;

  const colCount = n + 1;
  const colW = plotW / colCount;
  const barW = Math.min(colW * 0.62, minDim * 0.1);
  const barX = (i: number): number => plotLeft + colW * (i + 0.5);
  const valueFont = Math.round(Math.min(barW * 0.42, minDim * 0.032));
  const catFont0 = Math.round(minDim * 0.03);

  // --- Zero baseline ---
  const zeroY = mapY(0);
  const baseline = new Graphics().roundRect(0, 0, plotW, Math.max(2, minDim * 0.004), 2).fill({ color: textColor, alpha: 0.32 });
  baseline.position.set(plotLeft, zeroY);
  baseline.scale.set(0, 1);
  root.addChild(baseline);
  timeline.to(baseline, { prop: "scale.x", from: 0, to: 1, start: 0.35, duration: 0.5, ease: outExpo });

  const zeroLabel = makeText(fonts, { text: "0", role: "body", weight: 600, size: Math.round(minDim * 0.026), color: textColor, anchor: { x: 1, y: 0.5 } });
  zeroLabel.position.set(plotLeft - minDim * 0.014, zeroY);
  zeroLabel.alpha = 0;
  root.addChild(zeroLabel);
  timeline.to(zeroLabel, { prop: "alpha", from: 0, to: 0.7, start: 0.5, duration: 0.4, ease: outQuad });

  // --- Connectors between consecutive step bars ---
  if (showConnectors) {
    for (let i = 0; i < n - 1; i++) {
      const level = posts[i] ?? 0;
      const y = mapY(level);
      const x0 = barX(i) + barW / 2;
      const x1 = barX(i + 1) - barW / 2;
      const conn = new Graphics().roundRect(0, -1.5, x1 - x0, 3, 1.5).fill({ color: textColor, alpha: 0.25 });
      conn.position.set(x0, y);
      conn.alpha = 0;
      root.addChild(conn);
      timeline.to(conn, { prop: "alpha", from: 0, to: 1, start: BARS_START + (i + 1) * BAR_EACH, duration: 0.35, ease: outQuad });
    }
  }

  // --- Bars ---
  const makeBar = (i: number, originV: number, targetV: number, color: string, display: string, label: string, start: number): void => {
    const x = barX(i);
    const yOrigin = mapY(originV);
    const yTarget = mapY(targetV);
    const up = targetV >= originV;
    const height = Math.abs(yTarget - yOrigin);

    const barC = new Container();
    barC.position.set(x, yOrigin);
    barC.scale.set(1, 0);
    root.addChild(barC);
    const r = Math.min(barW * 0.16, 8);
    if (up) {
      barC.addChild(new Graphics().roundRect(-barW / 2, -height, barW, height, r).fill(color));
    } else {
      barC.addChild(new Graphics().roundRect(-barW / 2, 0, barW, height, r).fill(color));
    }
    timeline.to(barC, { prop: "scale.y", from: 0, to: 1, start, duration: BAR_GROW, ease: outExpo });

    // Value label at the moving end.
    const vSize = fitSize(fonts, display, "display", 700, valueFont, colW * 0.96);
    const vText = makeText(fonts, { text: display, role: "display", weight: 700, size: vSize, color: textColor, anchor: 0.5 });
    const vGap = minDim * 0.022 + vSize * 0.5;
    vText.position.set(x, up ? yTarget - vGap : yTarget + vGap);
    vText.alpha = 0;
    root.addChild(vText);
    timeline.to(vText, { prop: "alpha", from: 0, to: 1, start: start + BAR_GROW * 0.55, duration: 0.35, ease: outQuad });

    // Category label under baseline row.
    const cSize = fitSize(fonts, label, "body", 600, catFont0, colW * 0.94);
    const cText = makeText(fonts, { text: label, role: "body", weight: 600, size: cSize, color: textColor, anchor: { x: 0.5, y: 0 }, align: "center" });
    cText.position.set(x, plotBottom + minDim * 0.02);
    cText.alpha = 0;
    root.addChild(cText);
    timeline.to(cText, { prop: "alpha", from: 0, to: 0.85, start: start + 0.05, duration: 0.35, ease: outQuad });
  };

  steps.forEach((s, i) => {
    makeBar(i, origins[i] ?? 0, posts[i] ?? 0, s.value >= 0 ? upColor : downColor, s.display, s.label, BARS_START + i * BAR_EACH);
  });

  // --- Total bar (absolute, from zero) ---
  const totalStart = BARS_START + n * BAR_EACH + 0.1;
  const totalDisp = groupThousands(finalTotal);
  makeBar(n, 0, finalTotal, accent, totalDisp, "Total", totalStart);

  return { timeline, duration: computeDuration(values) };
}

export const waterfallChart: TemplateDefinition = {
  id: "waterfall-chart",
  name: "Waterfall Chart",
  tagline: "Floating step bars rise and fall from a start to a running total.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", steps: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Revenue bridge", maxLength: 32, optional: true, shrinkToFit: true },
    {
      key: "steps",
      type: "textlist",
      label: "Steps (label | +/- value)",
      default: DEFAULT_STEPS,
      minItems: 3,
      maxItems: 6,
      maxLength: 22,
      help: 'One per line as "label | +value" or "label | -value". A Total bar is added automatically.',
    },
    { key: "showConnectors", type: "toggle", label: "Connector lines", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent (total)", default: "", optional: true },
    { key: "upColor", type: "color", label: "Rise color", default: "", optional: true },
    { key: "downColor", type: "color", label: "Drop color", default: "", optional: true },
  ],
  build,
};

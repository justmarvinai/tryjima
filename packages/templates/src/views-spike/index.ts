import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { groupThousands, parseTargetNumber } from "../shared/format";

// Views Spike — the analytics screenshot everyone posts: a flat line that
// suddenly goes vertical, a counter racing up with it, and a marker on the day
// it happened. The "this one went off" post.
//
// `line-graph` (explainers) plots a series you supply. This is the opposite
// shape by construction — a long quiet floor and one exponential wall — and the
// counter is tied to the curve, so the number and the line agree frame for
// frame.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "analytics", name: "Analytics", colors: { background: "#0E1117", textColor: "#F2F4F8", accent: "#22C55E" } },
  { id: "hot", name: "Hot", colors: { background: "#160E10", textColor: "#FBF1F2", accent: "#F43F5E" } },
  { id: "electric", name: "Electric", colors: { background: "#0C111E", textColor: "#EEF1FB", accent: "#6366F1" } },
  { id: "paper", name: "Paper", colors: { background: "#F6F5F1", textColor: "#15171C", accent: "#0F9D6E" } },
];

interface Layout {
  chartWFrac: number;
  chartHFrac: number;
  numberFrac: number;
  topFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { chartWFrac: 0.66, chartHFrac: 0.4, numberFrac: 0.115, topFrac: 0.2 };
    case "9:16":
      return { chartWFrac: 0.84, chartHFrac: 0.3, numberFrac: 0.15, topFrac: 0.26 };
    case "4:5":
      return { chartWFrac: 0.82, chartHFrac: 0.34, numberFrac: 0.14, topFrac: 0.24 };
    case "1:1":
    default:
      return { chartWFrac: 0.8, chartHFrac: 0.36, numberFrac: 0.14, topFrac: 0.22 };
  }
}

const DRAW_AT = 0.4;
const DRAW_DUR = 1.9;
const DURATION = 5.0;

/** The curve: a long flat floor, then a knee, then near-vertical. */
function curve(u: number, knee: number): number {
  if (u <= knee) return 0.06 * (u / knee);
  const k = (u - knee) / (1 - knee);
  return 0.06 + 0.94 * Math.pow(k, 2.6);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0E1117"));
  const textColor = str(values.textColor, pc("textColor", "#F2F4F8"));
  const accent = str(values.accent, pc("accent", "#22C55E"));
  const label = str(values.label, "Views").trim();
  const target = str(values.target, "1.2M");
  const markerLabel = str(values.marker, "").trim();
  const knee = Math.max(0.3, Math.min(0.85, num(values.knee, 0.62)));
  const showGrid = on(values.showGrid);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const chartW = size.width * L.chartWFrac;
  const chartH = size.height * L.chartHFrac;
  const left = cx - chartW / 2;
  const bottom = size.height * L.topFrac + size.height * 0.34 + chartH;

  const timeline = new JimaTimeline();

  // --- Grid ---
  if (showGrid) {
    const g = new Graphics();
    for (let i = 0; i <= 4; i++) {
      const y = bottom - (chartH * i) / 4;
      g.rect(left, y - 1, chartW, Math.max(1, size.width * 0.0009));
    }
    g.fill({ color: textColor, alpha: 0.1 });
    root.addChild(g);
  }

  // --- The line, revealed by a clip travelling across the plot ---
  const steps = 140;
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    pts.push(left + chartW * u, bottom - chartH * curve(u, knee));
  }
  const lineLayer = new Container();
  root.addChild(lineLayer);

  // Fill under the curve, so the spike has mass.
  const areaPts = pts.slice();
  areaPts.push(left + chartW, bottom, left, bottom);
  lineLayer.addChild(new Graphics().poly(areaPts).fill({ color: accent, alpha: 0.16 }));
  lineLayer.addChild(
    new Graphics().poly(pts, false).stroke({ color: accent, width: Math.max(3, size.width * 0.005), cap: "round", join: "round" }),
  );

  const clip = new Graphics().rect(left, bottom - chartH * 1.3, chartW, chartH * 1.4).fill("#FFFFFF");
  clip.pivot.set(left, 0);
  clip.position.set(left, 0);
  root.addChild(clip);
  lineLayer.mask = clip;
  clip.scale.x = 0;
  timeline.to(clip, { prop: "scale.x", from: 0, to: 1, start: DRAW_AT, duration: DRAW_DUR, ease: (u) => u });

  // --- The head dot rides the curve ---
  const head = new Graphics().circle(0, 0, Math.max(6, size.width * 0.011)).fill(accent);
  const halo = new Graphics().circle(0, 0, Math.max(12, size.width * 0.024)).fill({ color: accent, alpha: 0.22 });
  const headHolder = new Container();
  headHolder.addChild(halo, head);
  headHolder.alpha = 0;
  root.addChild(headHolder);
  timeline.to(headHolder, { prop: "alpha", from: 0, to: 1, start: DRAW_AT, duration: 0.3, ease: outQuad });

  // --- The counter ---
  const targetValue = parseTargetNumber(target);
  const numberSize = Math.round(size.width * L.numberFrac);
  const numY = size.height * L.topFrac;
  const counter = makeText(fonts, {
    text: "0",
    role: "display",
    weight: 800,
    size: numberSize,
    color: textColor,
    anchor: 0.5,
  });
  counter.position.set(cx, numY);
  root.addChild(counter);

  if (label.length > 0) {
    const lab = makeText(fonts, {
      text: label.toUpperCase(),
      role: "body",
      weight: 800,
      size: Math.round(numberSize * 0.22),
      color: accent,
      anchor: 0.5,
      letterSpacing: numberSize * 0.03,
    });
    const ly = numY - numberSize * 0.78;
    lab.position.set(cx, ly);
    lab.alpha = 0;
    root.addChild(lab);
    timeline
      .to(lab, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
      .to(lab, { prop: "y", from: ly + numberSize * 0.12, to: ly, start: 0.15, duration: 0.7, ease: outExpo });
  }

  // --- Marker on the spike ---
  let marker: Container | null = null;
  if (markerLabel.length > 0) {
    marker = new Container();
    const mSize = Math.round(size.width * 0.024);
    const t = makeText(fonts, {
      text: markerLabel,
      role: "body",
      weight: 800,
      size: mSize,
      color: bg,
      anchor: 0.5,
    });
    const w = t.width + mSize * 1.3;
    const h = mSize * 2;
    marker.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(accent), t);
    marker.position.set(left + chartW * knee, bottom - chartH * curve(knee, knee) - h * 1.5);
    marker.alpha = 0;
    root.addChild(marker);
    const at = DRAW_AT + DRAW_DUR * knee;
    timeline
      .to(marker, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad })
      .to(marker, { prop: "y", from: marker.y + h * 0.6, to: marker.y, start: at, duration: 0.6, ease: outQuint });
  }

  // The counter and the head both read off the same curve, so they can never
  // disagree — the number *is* the line's height.
  const update = (t: number): void => {
    const u = Math.max(0, Math.min(1, (t - DRAW_AT) / DRAW_DUR));
    const v = curve(u, knee);
    counter.text = groupThousands(Math.round(targetValue * v));
    headHolder.position.set(left + chartW * u, bottom - chartH * v);
  };
  update(0);

  return { timeline, duration: DURATION, update };
}

export const viewsSpike: TemplateDefinition = {
  id: "views-spike",
  name: "Views Spike",
  tagline: "A flat line goes vertical and the counter races up with it — the one that went off.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { counter: "display", label: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Metric", default: "Views", maxLength: 20, optional: true },
    { key: "target", type: "text", label: "Final number", default: "1.2M", maxLength: 12 },
    { key: "marker", type: "text", label: "Marker", default: "posted this", maxLength: 20, optional: true },
    { key: "knee", type: "slider", label: "When it takes off", default: 0.62, min: 0.3, max: 0.85, step: 0.02 },
    { key: "showGrid", type: "toggle", label: "Grid lines", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Number", default: "", optional: true },
    { key: "accent", type: "color", label: "Line", default: "", optional: true },
  ],
  build,
};

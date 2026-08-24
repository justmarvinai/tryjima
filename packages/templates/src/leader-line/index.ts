import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  linear,
  outBack,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Leader Line — the technical-annotation callout: a dot lands on a detail, a
// line runs out from it, turns a right angle, and ends under a label parked at
// the frame edge. Up to three of them, each on its own delay.
//
// `arrow-callout` fires one arrow at one thing. This is the drawing-office
// version: multiple labels, all reading from the same margin, so a viewer's eye
// scans one column instead of hunting around the frame.
//
// The elbow is drawn in two legs that grow in sequence, because a leader that
// appears whole reads as a graphic, and one that draws reads as a pointer.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "spec", name: "Spec", colors: { background: "#0E1218", textColor: "#EEF3F8", accent: "#5AA9FF" } },
  { id: "ink", name: "Ink", colors: { background: "#141518", textColor: "#F5F5F6", accent: "#FBBF24" } },
  { id: "paper", name: "Paper", colors: { background: "#F5F4F0", textColor: "#14161A", accent: "#DC2626" } },
  { id: "mint", name: "Mint", colors: { background: "#0C1A16", textColor: "#E9F7F1", accent: "#34D399" } },
];

interface Layout {
  labelFrac: number;
  marginFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { labelFrac: 0.026, marginFrac: 0.72 };
    case "9:16":
      return { labelFrac: 0.036, marginFrac: 0.6 };
    case "4:5":
      return { labelFrac: 0.033, marginFrac: 0.64 };
    case "1:1":
    default:
      return { labelFrac: 0.032, marginFrac: 0.66 };
  }
}

const FIRST_AT = 0.35;
const PER_CALLOUT = 0.42;
const DURATION = 5.0;

// Each callout is "Label | x | y" — the anchor lives with the text so a user
// never has to keep two parallel lists in sync.
function parse(row: string): { label: string; x: number; y: number } | null {
  const parts = row.split("|").map((s) => s.trim());
  if (!parts[0]) return null;
  const x = Number(parts[1]);
  const y = Number(parts[2]);
  return {
    label: parts[0],
    x: Number.isFinite(x) ? Math.max(0.04, Math.min(0.96, x)) : 0.4,
    y: Number.isFinite(y) ? Math.max(0.06, Math.min(0.94, y)) : 0.5,
  };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0E1218"));
  const textColor = str(values.textColor, pc("textColor", "#EEF3F8"));
  const accent = str(values.accent, pc("accent", "#5AA9FF"));
  const rows = (Array.isArray(values.callouts) ? (values.callouts as unknown[]) : [])
    .map((v) => parse(String(v ?? "")))
    .filter((v): v is { label: string; x: number; y: number } => v !== null)
    .slice(0, 3);
  const side = str(values.side, "right");
  const marginFrac = num(values.margin, 0);
  const showNumbers = on(values.showNumbers);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const labelSize = Math.round(size.width * L.labelFrac);
  const stroke = Math.max(2, size.width * 0.0022);
  const right = side === "right";
  const dir = right ? 1 : -1;
  const margin = size.width * (marginFrac > 0 ? marginFrac : right ? L.marginFrac : 1 - L.marginFrac);
  const dotR = Math.max(5, size.width * 0.0075);

  const timeline = new JimaTimeline();

  rows.forEach((row, i) => {
    const ax = size.width * row.x;
    const ay = size.height * row.y;
    const at = FIRST_AT + i * PER_CALLOUT;

    // --- Anchor dot ---
    const dot = new Graphics().circle(0, 0, dotR).fill(accent);
    dot.position.set(ax, ay);
    dot.scale.set(0);
    root.addChild(dot);
    timeline
      .to(dot, { prop: "scale.x", from: 0, to: 1, start: at, duration: 0.4, ease: outBack })
      .to(dot, { prop: "scale.y", from: 0, to: 1, start: at, duration: 0.4, ease: outBack });

    // --- Leg 1: a short diagonal away from the anchor ---
    const rise = labelSize * 0.9 * (row.y > 0.55 ? -1 : 1);
    const l1x = ax + dir * labelSize * 1.1;
    const l1y = ay + rise;
    const leg1 = new Graphics()
      .poly([ax, ay, l1x, l1y], false)
      .stroke({ color: accent, width: stroke, cap: "round" });
    leg1.pivot.set(ax, ay);
    leg1.position.set(ax, ay);
    leg1.scale.set(0);
    root.addChild(leg1);
    timeline
      .to(leg1, { prop: "scale.x", from: 0, to: 1, start: at + 0.12, duration: 0.28, ease: linear })
      .to(leg1, { prop: "scale.y", from: 0, to: 1, start: at + 0.12, duration: 0.28, ease: linear });

    // --- Leg 2: the horizontal run to the margin ---
    const leg2 = new Graphics()
      .poly([0, 0, margin - l1x, 0], false)
      .stroke({ color: accent, width: stroke, cap: "round" });
    leg2.position.set(l1x, l1y);
    leg2.scale.x = 0;
    root.addChild(leg2);
    timeline.to(leg2, { prop: "scale.x", from: 0, to: 1, start: at + 0.34, duration: 0.32, ease: outExpo });

    // --- Label, sitting on the end of the run ---
    const holder = new Container();
    holder.position.set(margin + dir * labelSize * 0.4, l1y);
    root.addChild(holder);

    if (showNumbers) {
      const n = makeText(fonts, {
        text: String(i + 1),
        role: "body",
        weight: 800,
        size: labelSize * 0.6,
        color: bg,
        anchor: 0.5,
      });
      const badge = new Graphics().circle(0, 0, labelSize * 0.52).fill(accent);
      const nh = new Container();
      nh.addChild(badge, n);
      nh.position.set(right ? 0 : 0, -labelSize * 0.02);
      holder.addChild(nh);
    }

    const t = makeText(fonts, {
      text: row.label,
      role: "display",
      weight: 700,
      size: labelSize,
      color: textColor,
      anchor: { x: right ? 0 : 1, y: 0.5 },
    });
    t.position.set(dir * (showNumbers ? labelSize * 0.95 : 0), 0);
    const room = right ? size.width * 0.97 - (margin + labelSize * 1.4) : margin - size.width * 0.03 - labelSize * 1.4;
    if (t.width > room && room > labelSize) t.scale.set(Math.max(0.5, room / t.width));
    holder.addChild(t);

    holder.alpha = 0;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start: at + 0.5, duration: 0.32, ease: outQuad })
      .to(holder, {
        prop: "x",
        from: margin + dir * labelSize * 0.1,
        to: margin + dir * labelSize * 0.4,
        start: at + 0.5,
        duration: 0.6,
        ease: outExpo,
      });
  });

  return { timeline, duration: DURATION };
}

export const leaderLine: TemplateDefinition = {
  id: "leader-line",
  name: "Leader Lines",
  tagline: "Dots land on details, lines run out to a margin, and the labels read as one column.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { labels: "display" },
  palettes: PALETTES,
  fields: [
    {
      key: "callouts",
      type: "textlist",
      label: "Callouts — Label | across | down",
      default: ["Hand-stitched | 0.32 | 0.32", "Brass hardware | 0.28 | 0.55", "Full-grain leather | 0.4 | 0.75"],
      minItems: 1,
      maxItems: 3,
      maxLength: 44,
      help: "Across and down are 0–1 positions in the frame.",
    },
    {
      key: "side",
      type: "select",
      label: "Labels on",
      default: "right",
      options: [
        { value: "right", label: "Right" },
        { value: "left", label: "Left" },
      ],
    },
    { key: "margin", type: "slider", label: "Margin", default: 0, min: 0, max: 0.95, step: 0.01, help: "0 uses the default for this aspect." },
    { key: "showNumbers", type: "toggle", label: "Number badges", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Labels", default: "", optional: true },
    { key: "accent", type: "color", label: "Lines", default: "", optional: true },
  ],
  estimateDuration: () => DURATION,
  build,
};

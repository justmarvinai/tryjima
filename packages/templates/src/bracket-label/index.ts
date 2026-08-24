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

// Bracket Label — a square brace draws itself down one side of the frame,
// gathering a span of the footage, and names it. The annotation for "all of
// this", where an arrow (one point) and a circle (one blob) both fail.
//
// The brace draws in three strokes in the order a hand would: the long spine
// first, then both arms, then the tick out to the label.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "blueprint", name: "Blueprint", colors: { background: "#0C1420", textColor: "#E8F1FB", accent: "#5AA9FF" } },
  { id: "ink", name: "Ink", colors: { background: "#131418", textColor: "#F5F5F6", accent: "#FBBF24" } },
  { id: "paper", name: "Paper", colors: { background: "#F5F4F0", textColor: "#14161A", accent: "#DC2626" } },
  { id: "sage", name: "Sage", colors: { background: "#0F1A15", textColor: "#EAF6F0", accent: "#4ADE80" } },
];

interface Layout {
  labelFrac: number;
  insetFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { labelFrac: 0.03, insetFrac: 0.1 };
    case "9:16":
      return { labelFrac: 0.042, insetFrac: 0.1 };
    case "4:5":
      return { labelFrac: 0.038, insetFrac: 0.1 };
    case "1:1":
    default:
      return { labelFrac: 0.038, insetFrac: 0.1 };
  }
}

const SPINE_AT = 0.3;
const ARMS_AT = 0.72;
const LABEL_AT = 1.0;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0C1420"));
  const textColor = str(values.textColor, pc("textColor", "#E8F1FB"));
  const accent = str(values.accent, pc("accent", "#5AA9FF"));
  const label = str(values.label, "All of this").trim();
  const note = str(values.note, "").trim();
  const side = str(values.side, "left");
  const from = num(values.from, 0.22);
  const to = num(values.to, 0.72);
  const showNote = on(values.showNote);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const labelSize = Math.round(size.width * L.labelFrac);
  const stroke = Math.max(3, size.width * 0.0032);
  const left = side === "left";
  const dir = left ? 1 : -1;
  const x = left ? size.width * L.insetFrac : size.width * (1 - L.insetFrac);
  const y0 = size.height * Math.min(from, to);
  const y1 = size.height * Math.max(from, to);
  const arm = size.width * 0.038;

  const timeline = new JimaTimeline();

  // --- Spine: grows from the middle out, which reads as one confident stroke
  // rather than two halves. ---
  const spine = new Graphics().rect(-stroke / 2, -(y1 - y0) / 2, stroke, y1 - y0).fill(accent);
  spine.position.set(x, (y0 + y1) / 2);
  spine.scale.y = 0;
  root.addChild(spine);
  timeline.to(spine, { prop: "scale.y", from: 0, to: 1, start: SPINE_AT, duration: 0.55, ease: outExpo });

  // --- Arms at both ends, turning inward toward the content ---
  for (const yy of [y0, y1]) {
    const a = new Graphics()
      .rect(0, -stroke / 2, arm, stroke)
      .fill(accent);
    a.position.set(x, yy);
    a.scale.x = 0;
    if (!left) a.scale.x = 0;
    root.addChild(a);
    a.pivot.set(0, 0);
    a.rotation = left ? 0 : Math.PI;
    timeline.to(a, { prop: "scale.x", from: 0, to: 1, start: ARMS_AT, duration: 0.4, ease: outExpo });
  }

  // --- Tick from the spine's midpoint out to the label ---
  const midY = (y0 + y1) / 2;
  const tickLen = size.width * 0.05;
  const tick = new Graphics().rect(0, -stroke / 2, tickLen, stroke).fill(accent);
  tick.position.set(x, midY);
  // Into the frame, alongside the arms — a tick pointing at the frame edge
  // would take the label straight off it.
  tick.rotation = left ? 0 : Math.PI;
  tick.scale.x = 0;
  root.addChild(tick);
  timeline.to(tick, { prop: "scale.x", from: 0, to: 1, start: LABEL_AT - 0.15, duration: 0.35, ease: outExpo });

  // --- Label, stacked beside the tick and reading away from the frame edge ---
  const holder = new Container();
  const labelX = x + dir * (tickLen + labelSize * 0.5);
  holder.position.set(labelX, midY);
  root.addChild(holder);

  const t = makeText(fonts, {
    text: label,
    role: "display",
    weight: 800,
    size: labelSize,
    color: textColor,
    anchor: { x: left ? 0 : 1, y: 0.5 },
  });
  t.y = showNote && note ? -labelSize * 0.45 : 0;
  holder.addChild(t);

  if (showNote && note.length > 0) {
    const n = makeText(fonts, {
      text: note,
      role: "body",
      weight: 500,
      size: labelSize * 0.62,
      color: textColor,
      anchor: { x: left ? 0 : 1, y: 0.5 },
    });
    n.alpha = 0.66;
    n.y = labelSize * 0.55;
    holder.addChild(n);
  }

  holder.alpha = 0;
  timeline
    .to(holder, { prop: "alpha", from: 0, to: 1, start: LABEL_AT, duration: 0.4, ease: outQuad })
    .to(holder, { prop: "x", from: labelX - dir * labelSize * 0.5, to: labelX, start: LABEL_AT, duration: 0.75, ease: outQuint });

  return { timeline, duration: DURATION };
}

export const bracketLabel: TemplateDefinition = {
  id: "bracket-label",
  name: "Bracket Label",
  tagline: "A brace draws down the frame, gathers a span of it, and names it.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { label: "display", note: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "All of this", maxLength: 26 },
    { key: "note", type: "text", label: "Note", default: "is now automatic", maxLength: 34, optional: true },
    { key: "showNote", type: "toggle", label: "Show note", default: true },
    {
      key: "side",
      type: "select",
      label: "Side",
      default: "left",
      options: [
        { value: "left", label: "Left" },
        { value: "right", label: "Right" },
      ],
    },
    { key: "from", type: "slider", label: "Span top", default: 0.22, min: 0.06, max: 0.9, step: 0.02 },
    { key: "to", type: "slider", label: "Span bottom", default: 0.72, min: 0.1, max: 0.94, step: 0.02 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Brace", default: "", optional: true },
  ],
  build,
};

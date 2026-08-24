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

// Circle Highlight — a hand-drawn ring is scribbled around a point on the
// footage and a label flicks out from it. The "look here" annotation everyone
// draws in a review, as motion.
//
// `arrow-callout` points at a thing; this encircles it, which is what you want
// when the thing has area. The ring is drawn as an ellipse that over-runs
// itself by about a quarter turn — a real circled-by-hand shape never closes
// neatly — with a slight wobble so it does not look like a vector primitive.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "marker", name: "Marker", colors: { background: "#14151A", textColor: "#F6F6F8", accent: "#F43F5E" } },
  { id: "highlighter", name: "Highlighter", colors: { background: "#141310", textColor: "#FAF8EF", accent: "#FACC15" } },
  { id: "paper", name: "Paper", colors: { background: "#F6F5F1", textColor: "#15161A", accent: "#DC2626" } },
  { id: "mint", name: "Mint", colors: { background: "#0C1A16", textColor: "#E9F7F2", accent: "#34D399" } },
];

interface Layout {
  radiusFrac: number;
  labelFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { radiusFrac: 0.16, labelFrac: 0.032 };
    case "9:16":
      return { radiusFrac: 0.26, labelFrac: 0.042 };
    case "4:5":
      return { radiusFrac: 0.24, labelFrac: 0.04 };
    case "1:1":
    default:
      return { radiusFrac: 0.24, labelFrac: 0.04 };
  }
}

const DRAW_AT = 0.35;
const DRAW_DUR = 0.85;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#14151A"));
  const textColor = str(values.textColor, pc("textColor", "#F6F6F8"));
  const accent = str(values.accent, pc("accent", "#F43F5E"));
  const label = str(values.label, "This bit").trim();
  const note = str(values.note, "").trim();
  const px = num(values.x, 0.42);
  const py = num(values.y, 0.46);
  const scale = num(values.size, 1);
  const showLabel = on(values.showLabel);
  const showTick = on(values.showTick);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width * Math.max(0.1, Math.min(0.9, px));
  const cy = size.height * Math.max(0.12, Math.min(0.88, py));
  const rx = Math.min(size.width, size.height) * L.radiusFrac * scale;
  const ry = rx * 0.78;
  const stroke = Math.max(4, size.width * 0.0055);

  const timeline = new JimaTimeline();

  // --- The ring: 1.24 turns, with a seeded wobble on the radius ---
  const turns = 1.24;
  const steps = 190;
  const start = -Math.PI * 0.62;
  const wob1 = rng.range(0, Math.PI * 2);
  const wob2 = rng.range(0, Math.PI * 2);
  const tilt = rng.range(-0.14, 0.14);
  const pts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + Math.PI * 2 * turns * (i / steps);
    // A hand pulls tighter at the start of the stroke and drifts wide at the end.
    const drift = 1 + 0.045 * (i / steps);
    const wob = 1 + 0.035 * Math.sin(a * 3 + wob1) + 0.022 * Math.sin(a * 5.3 + wob2);
    const x = Math.cos(a) * rx * wob * drift;
    const y = Math.sin(a) * ry * wob * drift;
    pts.push(cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt));
  }

  // Drawn by revealing successive segments, so the ink genuinely travels rather
  // than the whole ring fading up.
  const ring = new Container();
  root.addChild(ring);
  const segs = 26;
  const perSeg = DRAW_DUR / segs;
  for (let s = 0; s < segs; s++) {
    const i0 = Math.floor((steps * s) / segs);
    const i1 = Math.min(steps, Math.floor((steps * (s + 1)) / segs) + 1);
    const slice = pts.slice(i0 * 2, i1 * 2);
    const g = new Graphics()
      .poly(slice, false)
      .stroke({ color: accent, width: stroke, cap: "round", join: "round" });
    g.alpha = 0;
    ring.addChild(g);
    timeline.to(g, { prop: "alpha", from: 0, to: 1, start: DRAW_AT + perSeg * s, duration: perSeg * 1.6, ease: linear });
  }

  // --- Tick mark at the closing end, the flick of the pen ---
  if (showTick) {
    const lastA = start + Math.PI * 2 * turns;
    const lx = cx + Math.cos(lastA) * rx * 1.05;
    const ly = cy + Math.sin(lastA) * ry * 1.05;
    const tick = new Graphics()
      .poly([0, 0, rx * 0.22, -ry * 0.12], false)
      .stroke({ color: accent, width: stroke * 0.9, cap: "round" });
    tick.position.set(lx, ly);
    tick.alpha = 0;
    root.addChild(tick);
    timeline
      .to(tick, { prop: "alpha", from: 0, to: 1, start: DRAW_AT + DRAW_DUR, duration: 0.12, ease: outQuad })
      .to(tick, { prop: "scale.x", from: 0.2, to: 1, start: DRAW_AT + DRAW_DUR, duration: 0.28, ease: outExpo })
      .to(tick, { prop: "scale.y", from: 0.2, to: 1, start: DRAW_AT + DRAW_DUR, duration: 0.28, ease: outExpo });
  }

  // --- Label on a short leader, flicking out up-right of the ring ---
  if (showLabel && label.length > 0) {
    const labelSize = Math.round(size.width * L.labelFrac);
    const right = cx < size.width * 0.55;
    const dir = right ? 1 : -1;
    const anchorX = cx + dir * rx * 0.92;
    const anchorY = cy - ry * 0.86;
    const leadLen = rx * 0.55;

    const holder = new Container();
    holder.position.set(anchorX, anchorY);
    root.addChild(holder);

    const lead = new Graphics()
      .poly([0, 0, dir * leadLen * 0.55, -leadLen * 0.5, dir * leadLen, -leadLen * 0.5], false)
      .stroke({ color: accent, width: Math.max(2, stroke * 0.55), cap: "round", join: "round" });
    holder.addChild(lead);
    lead.scale.set(0);
    timeline
      .to(lead, { prop: "scale.x", from: 0, to: 1, start: DRAW_AT + DRAW_DUR * 0.85, duration: 0.4, ease: outExpo })
      .to(lead, { prop: "scale.y", from: 0, to: 1, start: DRAW_AT + DRAW_DUR * 0.85, duration: 0.4, ease: outExpo });

    const text = makeText(fonts, {
      text: label,
      role: "display",
      weight: 800,
      size: labelSize,
      color: bg,
      anchor: { x: right ? 0 : 1, y: 0.5 },
    });
    const noteText = note
      ? makeText(fonts, {
          text: note,
          role: "body",
          weight: 500,
          size: Math.round(labelSize * 0.6),
          color: bg,
          anchor: { x: right ? 0 : 1, y: 0.5 },
        })
      : null;
    const padX = labelSize * 0.62;
    const padY = labelSize * 0.42;
    const w = Math.max(text.width, noteText?.width ?? 0) + padX * 2;
    const h = labelSize * (noteText ? 2.5 : 1.5) + padY * 0.4;
    const chipX = dir * leadLen + (right ? 0 : 0);
    // The chip is the paper colour, not the ink: a solid accent block next to
    // an accent ring flattens into one shape and stops reading as annotation.
    const chip = new Graphics()
      .roundRect(right ? 0 : -w, -h / 2, w, h, labelSize * 0.32)
      .fill(textColor);
    const chipHolder = new Container();
    chipHolder.position.set(chipX, -leadLen * 0.5);
    chipHolder.addChild(chip);
    text.position.set(right ? padX : -padX, noteText ? -labelSize * 0.42 : 0);
    chipHolder.addChild(text);
    if (noteText) {
      noteText.alpha = 0.82;
      noteText.position.set(right ? padX : -padX, labelSize * 0.5);
      chipHolder.addChild(noteText);
    }
    holder.addChild(chipHolder);

    chipHolder.alpha = 0;
    timeline
      .to(chipHolder, { prop: "alpha", from: 0, to: 1, start: DRAW_AT + DRAW_DUR + 0.1, duration: 0.28, ease: outQuad })
      .to(chipHolder, { prop: "scale.x", from: 0.6, to: 1, start: DRAW_AT + DRAW_DUR + 0.1, duration: 0.5, ease: outBack })
      .to(chipHolder, { prop: "scale.y", from: 0.6, to: 1, start: DRAW_AT + DRAW_DUR + 0.1, duration: 0.5, ease: outBack });
  }

  return { timeline, duration: DURATION };
}

export const circleHighlight: TemplateDefinition = {
  id: "circle-highlight",
  name: "Circle Highlight",
  tagline: "A hand-drawn ring is scribbled around the thing you mean, and a label flicks out.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { label: "display", note: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "This bit", maxLength: 22 },
    { key: "note", type: "text", label: "Note", default: "matters most", maxLength: 26, optional: true },
    { key: "x", type: "slider", label: "Position across", default: 0.42, min: 0.1, max: 0.9, step: 0.02 },
    { key: "y", type: "slider", label: "Position down", default: 0.46, min: 0.12, max: 0.88, step: 0.02 },
    { key: "size", type: "slider", label: "Ring size", default: 1, min: 0.5, max: 1.6, step: 0.05 },
    { key: "showLabel", type: "toggle", label: "Label", default: true },
    { key: "showTick", type: "toggle", label: "Pen flick", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Label chip", default: "", optional: true },
    { key: "accent", type: "color", label: "Ink", default: "", optional: true },
  ],
  build,
};

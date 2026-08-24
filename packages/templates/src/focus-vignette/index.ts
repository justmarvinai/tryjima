import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutQuint,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Focus Spot — everything but one spot dims, so the eye has nowhere else to go,
// and a caption names what you are looking at. The classic "watch this" grade.
//
// `soft-scrim` lays a gradient across an edge to make text legible. This is the
// opposite instrument: a hole in a full-frame dim, closing onto a point. The
// falloff is built from many concentric rings at low alpha rather than one hard
// circle, because a stencil-edged hole reads as a bug, not a light.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  // Mid-tones, not near-black: the whole template is a dim, and you cannot see
  // a dim applied to something already at zero.
  { id: "cinema", name: "Cinema", colors: { background: "#3A3E46", textColor: "#F7F7F9", accent: "#F5C542" } },
  { id: "cool", name: "Cool", colors: { background: "#2F4356", textColor: "#EDF4FB", accent: "#7DD3FC" } },
  { id: "warm", name: "Warm", colors: { background: "#4A3A2C", textColor: "#FBF3E9", accent: "#FDBA74" } },
  { id: "rose", name: "Rose", colors: { background: "#4A2F3B", textColor: "#FCEFF4", accent: "#FDA4AF" } },
];

interface Layout {
  radiusFrac: number;
  labelFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { radiusFrac: 0.2, labelFrac: 0.03 };
    case "9:16":
      return { radiusFrac: 0.3, labelFrac: 0.04 };
    case "4:5":
      return { radiusFrac: 0.28, labelFrac: 0.038 };
    case "1:1":
    default:
      return { radiusFrac: 0.28, labelFrac: 0.038 };
  }
}

const CLOSE_AT = 0.3;
const CLOSE_DUR = 1.1;
const DURATION = 4.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#3A3E46"));
  const textColor = str(values.textColor, pc("textColor", "#F5F5F7"));
  const accent = str(values.accent, pc("accent", "#F5C542"));
  const label = str(values.label, "Right here").trim();
  const note = str(values.note, "").trim();
  const px = num(values.x, 0.5);
  const py = num(values.y, 0.44);
  const spot = num(values.spot, 1);
  const strength = num(values.dim, 0.72);
  const showRing = on(values.showRing);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width * Math.max(0.12, Math.min(0.88, px));
  const cy = size.height * Math.max(0.14, Math.min(0.86, py));
  const rFinal = Math.min(size.width, size.height) * L.radiusFrac * spot;
  const rStart = Math.hypot(size.width, size.height) * 0.62;

  const timeline = new JimaTimeline();

  // The dim is a stack of rings: each covers from its own radius outward, so
  // summing them gives a smooth ramp from clear at the centre to fully dim
  // well outside. One `.circle` cut-out would have a stencil-hard edge.
  const dim = new Container();
  root.addChild(dim);
  const rings = 14;
  // Alpha composites multiplicatively, so `strength / rings` would land well
  // short of the requested dim. This is the per-layer alpha whose stack is
  // exactly `strength`.
  const perRing = 1 - Math.pow(1 - Math.min(0.95, strength), 1 / rings);
  // Each layer is an annulus with a unit inner radius, drawn as a very thick
  // stroke — Pixi's Graphics has no even-odd hole, but a stroked circle *is* a
  // ring, and its inner edge is exactly the radius. So the object's scale is
  // its hole radius, and spacing the holes apart produces the falloff.
  const K = 600;
  for (let i = 0; i < rings; i++) {
    const spread = 1 + (i / rings) * 0.95;
    const g = new Graphics()
      .circle(0, 0, 1 + K / 2)
      .stroke({ color: "#000000", width: K, alpha: perRing });
    g.position.set(cx, cy);
    dim.addChild(g);
    for (const prop of ["scale.x", "scale.y"]) {
      timeline.to(g, {
        prop,
        from: rStart * spread,
        to: rFinal * spread,
        start: CLOSE_AT,
        duration: CLOSE_DUR,
        ease: inOutQuint,
      });
    }
  }

  // A thin ring on the light's edge. Drawn at its final radius rather than
  // scaled into place — scaling a stroked circle scales the stroke with it.
  if (showRing) {
    const ring = new Graphics()
      .circle(0, 0, rFinal * 1.04)
      .stroke({ color: accent, width: Math.max(2, size.width * 0.0022), alpha: 0.8 });
    ring.position.set(cx, cy);
    ring.alpha = 0;
    root.addChild(ring);
    timeline
      .to(ring, { prop: "alpha", from: 0, to: 0.55, start: CLOSE_AT + CLOSE_DUR * 0.55, duration: 0.5, ease: outQuad })
      .to(ring, { prop: "scale.x", from: 1.18, to: 1, start: CLOSE_AT + CLOSE_DUR * 0.55, duration: 0.7, ease: outExpo })
      .to(ring, { prop: "scale.y", from: 1.18, to: 1, start: CLOSE_AT + CLOSE_DUR * 0.55, duration: 0.7, ease: outExpo });
  }

  // --- Caption, placed under the spot (or above it near the bottom edge) ---
  if (label.length > 0) {
    const labelSize = Math.round(size.width * L.labelFrac);
    const below = cy + rFinal < size.height * 0.76;
    const y = below ? cy + rFinal * 1.24 : cy - rFinal * 1.24;
    const holder = new Container();
    holder.position.set(cx, y);
    root.addChild(holder);

    const t = makeText(fonts, {
      text: label,
      role: "display",
      weight: 800,
      size: labelSize,
      color: textColor,
      anchor: 0.5,
    });
    holder.addChild(t);

    if (note.length > 0) {
      const n = makeText(fonts, {
        text: note,
        role: "body",
        weight: 500,
        size: Math.round(labelSize * 0.62),
        color: textColor,
        anchor: 0.5,
      });
      n.alpha = 0.72;
      n.y = labelSize * 0.92;
      holder.addChild(n);
    }

    const barW = labelSize * 1.6;
    const bar = new Graphics()
      .rect(-barW / 2, -Math.max(2, labelSize * 0.04), barW, Math.max(3, labelSize * 0.08))
      .fill(accent);
    bar.y = -labelSize * 0.95;
    bar.scale.x = 0;
    holder.addChild(bar);

    holder.alpha = 0;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start: CLOSE_AT + CLOSE_DUR * 0.7, duration: 0.45, ease: outQuad })
      .to(holder, {
        prop: "y",
        from: y + labelSize * 0.5 * (below ? 1 : -1),
        to: y,
        start: CLOSE_AT + CLOSE_DUR * 0.7,
        duration: 0.8,
        ease: outExpo,
      })
      .to(bar, { prop: "scale.x", from: 0, to: 1, start: CLOSE_AT + CLOSE_DUR * 0.85, duration: 0.55, ease: outExpo });
  }

  return { timeline, duration: DURATION };
}

export const focusVignette: TemplateDefinition = {
  id: "focus-vignette",
  name: "Focus Spot",
  tagline: "Everything but one spot dims down, and a caption names what you're looking at.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { label: "display", note: "body" },
  palettes: PALETTES,
  fields: [
    { key: "label", type: "text", label: "Label", default: "Right here", maxLength: 26 },
    { key: "note", type: "text", label: "Note", default: "the bit that changed everything", maxLength: 44, optional: true },
    { key: "x", type: "slider", label: "Spot across", default: 0.5, min: 0.12, max: 0.88, step: 0.02 },
    { key: "y", type: "slider", label: "Spot down", default: 0.44, min: 0.14, max: 0.86, step: 0.02 },
    { key: "spot", type: "slider", label: "Spot size", default: 1, min: 0.5, max: 1.7, step: 0.05 },
    { key: "dim", type: "slider", label: "Dim strength", default: 0.72, min: 0.3, max: 0.92, step: 0.02 },
    { key: "showRing", type: "toggle", label: "Edge ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

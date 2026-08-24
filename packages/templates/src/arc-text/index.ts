import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outBack,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Arc Headline — the headline is set along a circular arc, each glyph rotated
// to stand on the curve, and revealed by sweeping outward from the centre of
// the arc. Nothing else in the library sets type on a path: every other
// headline template lays glyphs on a straight baseline.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "cream", name: "Cream", colors: { background: "#F7F3EA", textColor: "#1A1712", accent: "#C2410C" } },
  { id: "ink", name: "Ink", colors: { background: "#12141A", textColor: "#F5F3EE", accent: "#F0B429" } },
  { id: "sage", name: "Sage", colors: { background: "#E7EEE7", textColor: "#16211A", accent: "#2F6B4F" } },
  { id: "plum", name: "Plum", colors: { background: "#F2E9F3", textColor: "#231323", accent: "#7C2D6B" } },
];

interface Layout {
  fontFrac: number;
  radiusFrac: number;
  centerFrac: number;
  subFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.062, radiusFrac: 0.42, centerFrac: 0.86, subFrac: 0.026 };
    case "9:16":
      return { fontFrac: 0.086, radiusFrac: 0.38, centerFrac: 0.62, subFrac: 0.034 };
    case "4:5":
      return { fontFrac: 0.078, radiusFrac: 0.4, centerFrac: 0.7, subFrac: 0.031 };
    case "1:1":
    default:
      return { fontFrac: 0.075, radiusFrac: 0.4, centerFrac: 0.72, subFrac: 0.03 };
  }
}

const SWEEP_START = 0.35;
const PER_CHAR = 0.045;
const CHAR_DUR = 0.6;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F7F3EA"));
  const textColor = str(values.textColor, pc("textColor", "#1A1712"));
  const accent = str(values.accent, pc("accent", "#C2410C"));
  const headline = str(values.headline, "Good things ahead").toUpperCase();
  const subline = str(values.subline, "").trim();
  const curve = num(values.curve, 1);
  const showArc = on(values.showArc);
  const showDot = on(values.showDot);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  // The arc's centre sits below the frame; the type rides its upper edge.
  const centerY = size.height * L.centerFrac;
  const radius = Math.min(size.width, size.height) * L.radiusFrac * (2 - Math.min(curve, 1.4) * 0.5);
  const fontSize = Math.round(size.width * L.fontFrac);

  const timeline = new JimaTimeline();
  const chars = [...headline];
  const style = { family: fonts.family("display"), weight: 700, size: fontSize };
  const widths = chars.map((c) => (c === " " ? fontSize * 0.34 : fonts.measure(c, style)));
  const tracking = fontSize * 0.06;
  const total = widths.reduce((a, w) => a + w + tracking, 0) - tracking;

  // Angle subtended by the whole string at this radius. Longer strings simply
  // wrap further around the circle rather than shrinking, which is the point of
  // setting type on an arc.
  const totalAngle = total / radius;
  let cursorAngle = -totalAngle / 2;

  const arcLayer = new Container();
  root.addChild(arcLayer);

  const glyphs: Container[] = [];
  for (let i = 0; i < chars.length; i++) {
    const w = widths[i]!;
    const mid = cursorAngle + (w + tracking) / 2 / radius;
    cursorAngle += (w + tracking) / radius;
    if (chars[i] === " ") continue;

    const holder = new Container();
    holder.position.set(cx + Math.sin(mid) * radius, centerY - Math.cos(mid) * radius);
    holder.rotation = mid;
    const t = makeText(fonts, {
      text: chars[i]!,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
    });
    holder.addChild(t);
    arcLayer.addChild(holder);
    glyphs.push(holder);
  }

  // Reveal outward from the middle of the arc in both directions, so the
  // headline blooms along the curve rather than reading left-to-right.
  const mid = (glyphs.length - 1) / 2;
  glyphs.forEach((g, i) => {
    const delay = SWEEP_START + Math.abs(i - mid) * PER_CHAR;
    const outward = 1 - Math.min(radius * 0.055, fontSize * 0.9) / radius;
    g.alpha = 0;
    timeline
      .to(g, { prop: "alpha", from: 0, to: 1, start: delay, duration: CHAR_DUR * 0.55, ease: outQuad })
      .to(g, { prop: "scale.x", from: 0.82, to: 1, start: delay, duration: CHAR_DUR, ease: outBack })
      .to(g, { prop: "scale.y", from: 0.82, to: 1, start: delay, duration: CHAR_DUR, ease: outBack })
      .to(g, {
        prop: "y",
        from: centerY - Math.cos(g.rotation) * radius * outward,
        to: g.y,
        start: delay,
        duration: CHAR_DUR,
        ease: outQuint,
      });
  });

  // A hairline that traces the same circle, drawn as a stroked polyline so it
  // sits exactly under the glyph baselines.
  if (showArc) {
    const pad = totalAngle * 0.06;
    const a0 = -totalAngle / 2 - pad;
    const a1 = totalAngle / 2 + pad;
    const r = radius - fontSize * 0.62;
    const pts: number[] = [];
    const steps = 80;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      pts.push(cx + Math.sin(a) * r, centerY - Math.cos(a) * r);
    }
    const arc = new Graphics()
      .poly(pts, false)
      .stroke({ color: accent, width: Math.max(2, size.width * 0.0022), cap: "round" });
    root.addChildAt(arc, 1);
    arc.alpha = 0;
    // Grow from the centre out by scaling about the arc's own centre point.
    arc.pivot.set(cx, centerY);
    arc.position.set(cx, centerY);
    timeline
      .to(arc, { prop: "alpha", from: 0, to: 0.9, start: 0.15, duration: 0.4, ease: outQuad })
      .to(arc, { prop: "scale.x", from: 0.2, to: 1, start: 0.15, duration: 1.1, ease: outExpo })
      .to(arc, { prop: "scale.y", from: 0.2, to: 1, start: 0.15, duration: 1.1, ease: outExpo });
  }

  // A dot at the apex, where the arc's crown sits.
  if (showDot) {
    const dotR = Math.max(4, fontSize * 0.09);
    const dot = new Graphics().circle(0, 0, dotR).fill(accent);
    dot.position.set(cx, centerY - radius - fontSize * 0.95);
    dot.scale.set(0);
    root.addChild(dot);
    timeline.to(dot, { prop: "scale.x", from: 0, to: 1, start: 1.5, duration: 0.5, ease: outBack });
    timeline.to(dot, { prop: "scale.y", from: 0, to: 1, start: 1.5, duration: 0.5, ease: outBack });
  }

  if (subline.length > 0) {
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: Math.round(size.width * L.subFrac),
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: size.width * 0.0022,
    });
    const subY = centerY - radius + fontSize * 1.5;
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.75, start: 1.75, duration: 0.6, ease: outQuad })
      .to(sub, { prop: "y", from: subY + fontSize * 0.3, to: subY, start: 1.75, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const arcText: TemplateDefinition = {
  id: "arc-text",
  name: "Arc Headline",
  tagline: "Type set along a curve, blooming outward from the centre of the arc.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Good things ahead", maxLength: 34, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Est. 2019", maxLength: 40, optional: true },
    { key: "curve", type: "slider", label: "Curve", default: 1, min: 0.4, max: 1.4, step: 0.1 },
    { key: "showArc", type: "toggle", label: "Arc rule", default: true },
    { key: "showDot", type: "toggle", label: "Crown dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  shrinkToFit,
  inOutQuad,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

// Liquid Headline — the headline is revealed by a single organic mask whose top
// edge is a flowing, undulating curve. The mask rises through the block while
// also drifting sideways by about one wavelength, so the crests visibly travel
// across the letters: the type looks like it is soaking upward out of liquid.
// Distinct from `mask-wipe` / `box-wipe` (straight-edged wipes with a hard
// leading line) and from `ink-reveal` (a blot that covers, then clears): here
// nothing ever covers the stage, and the reveal edge is a curve, never a line.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "porcelain", name: "Porcelain", colors: { background: "#F6F5F2", textColor: "#15171B", accent: "#1F5F4B" } },
  { id: "ink", name: "Ink", colors: { background: "#101318", textColor: "#F4F3EF", accent: "#5FD3AE" } },
  { id: "clay", name: "Clay", colors: { background: "#EFE8E1", textColor: "#241E1A", accent: "#9E3F21" } },
  { id: "harbor", name: "Harbor", colors: { background: "#E9EEF3", textColor: "#131C25", accent: "#2554D4" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerFrac: number;
  blockHFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.076, maxWidthFrac: 0.7, centerFrac: 0.44, blockHFrac: 0.44 };
    case "9:16":
      return { fontFrac: 0.098, maxWidthFrac: 0.82, centerFrac: 0.44, blockHFrac: 0.4 };
    case "4:5":
      return { fontFrac: 0.092, maxWidthFrac: 0.8, centerFrac: 0.44, blockHFrac: 0.42 };
    case "1:1":
    default:
      return { fontFrac: 0.094, maxWidthFrac: 0.8, centerFrac: 0.45, blockHFrac: 0.44 };
  }
}

const SWEEP_START = 0.45;
const SWEEP_DUR = 1.3;
const RULE_START = 1.7;
const SUB_START = 2.05;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F6F5F2"));
  const textColor = str(values.textColor, pc("textColor", "#15171B"));
  const accent = str(values.accent, pc("accent", "#1F5F4B"));
  const headline = str(values.headline, "Ideas take shape");
  const subline = str(values.subline, "").trim();
  const showSurface = on(values.showSurface);
  const showRule = on(values.showRule);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  // --- Headline, fit so long (German) strings never overflow the block ---
  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.14);
  const relayout = () =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 700,
      fontSize,
      lineHeight,
      maxWidth,
      align: "center",
      anchorX: cx,
      centerY,
    });
  let boxes = relayout();
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lineCount * lineHeight > maxBlockH; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.14);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: DURATION };

  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const topY = Math.min(...boxes.map((b) => b.cy)) - fontSize * 0.7;
  const botY = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.62;

  const headlineLayer = new Container();
  headlineLayer.label = "headline";
  root.addChild(headlineLayer);
  for (const box of boxes) {
    const t = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
      letterSpacing: -fontSize * 0.012,
    });
    t.position.set(box.cx, box.cy);
    headlineLayer.addChild(t);
  }

  // --- The flowing edge: three summed sines with seeded phases, so every
  // project gets its own (stable) wave shape. Sampled once into a polygon; the
  // motion comes from moving that polygon, which keeps the whole reveal a pure
  // function of t with no per-frame geometry rebuild. ---
  const span = Math.max(right - left, size.width * 0.4) + fontSize * 2;
  const lam1 = span / 2.1;
  const lam2 = span / 5.3;
  const lam3 = span / 1.25;
  const amp1 = fontSize * 0.2;
  const amp2 = fontSize * 0.075;
  const amp3 = fontSize * 0.105;
  const maxAmp = amp1 + amp2 + amp3;
  const ph1 = rng.range(0, Math.PI * 2);
  const ph2 = rng.range(0, Math.PI * 2);
  const ph3 = rng.range(0, Math.PI * 2);
  const waveY = (x: number): number =>
    -amp1 * Math.sin((Math.PI * 2 * x) / lam1 + ph1) -
    amp2 * Math.sin((Math.PI * 2 * x) / lam2 + ph2) -
    amp3 * Math.sin((Math.PI * 2 * x) / lam3 + ph3);

  // Sideways drift of roughly one long wavelength: what makes the edge read as
  // flowing rather than as a rigid shape sliding up.
  const drift = lam1 * 0.85;
  const halfW = span / 2 + drift + fontSize * 1.2;
  const depth = size.height * 1.6;
  const samples = 168;
  const edge: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = -halfW + (halfW * 2 * i) / samples;
    edge.push(x, waveY(x));
  }
  const body = edge.slice();
  body.push(halfW, depth, -halfW, depth);

  // Only the wave's own depth (plus a hair) pads each end of the travel, so
  // almost the whole sweep is spent actually crossing the letterforms.
  const clearance = maxAmp + fontSize * 0.08;
  const startY = botY + clearance;
  const endY = topY - clearance;

  const mask = new Graphics().poly(body).fill("#FFFFFF");
  mask.position.set(cx - drift, startY);
  root.addChild(mask);
  headlineLayer.mask = mask;
  timeline
    .to(mask, { prop: "y", from: startY, to: endY, start: SWEEP_START, duration: SWEEP_DUR, ease: inOutQuad })
    .to(mask, { prop: "x", from: cx - drift, to: cx, start: SWEEP_START, duration: SWEEP_DUR, ease: inOutQuad });

  // --- The surface line: a hairline riding exactly on the reveal edge, like
  // the meniscus of the rising liquid. Toggleable. ---
  if (showSurface) {
    const surface = new Graphics()
      .poly(edge, false)
      .stroke({ color: accent, width: Math.max(2, fontSize * 0.035), cap: "round", join: "round" });
    surface.position.set(cx - drift, startY);
    surface.alpha = 0;
    root.addChild(surface);
    timeline
      .to(surface, { prop: "y", from: startY, to: endY, start: SWEEP_START, duration: SWEEP_DUR, ease: inOutQuad })
      .to(surface, { prop: "x", from: cx - drift, to: cx, start: SWEEP_START, duration: SWEEP_DUR, ease: inOutQuad })
      .to(surface, { prop: "alpha", from: 0, to: 0.5, start: SWEEP_START, duration: 0.28, ease: outQuad })
      .to(surface, { prop: "alpha", from: 0.5, to: 0, start: SWEEP_START + SWEEP_DUR * 0.78, duration: 0.55, ease: outQuad });
  }

  // --- A hairline rule opens from the centre once the text has surfaced ---
  const ruleY = botY + fontSize * 0.46;
  const ruleH = Math.max(2, Math.round(size.width * 0.0016));
  if (showRule) {
    const ruleW = Math.min(right - left, maxWidth);
    const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(cx, ruleY);
    rule.scale.x = 0;
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: RULE_START, duration: 0.75, ease: outExpo });
  }

  // --- Subline settles in last, well clear of the rule ---
  if (subline.length > 0) {
    const family = fonts.family("body");
    const base = Math.round(fontSize * 0.29);
    const subSize = shrinkToFit(
      subline,
      (s, sz) => fonts.measure(s, { family, weight: 400, size: sz }),
      { maxWidth, baseSize: base, minSize: Math.round(base * 0.55) },
    );
    const subY = ruleY + fontSize * 0.62;
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 400,
      size: subSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.72, start: SUB_START, duration: 0.75, ease: outQuad })
      .to(sub, { prop: "y", from: subY + fontSize * 0.16, to: subY, start: SUB_START, duration: 0.85, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const liquidHeadline: TemplateDefinition = {
  id: "liquid-headline",
  name: "Liquid Headline",
  tagline: "A flowing, wave-edged mask rises through the headline like ink soaking upward.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Ideas take shape", maxLength: 48, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Smooth by design", maxLength: 70, optional: true },
    { key: "showSurface", type: "toggle", label: "Surface line", default: true },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

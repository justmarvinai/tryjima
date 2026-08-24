import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  luminance,
  makeText,
  outExpo,
  outQuad,
  outQuint,
  parseHex,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

// Chroma Split — the headline arrives as three offset colour channels that
// slide together into register, the way a mis-aligned print run resolves. The
// fringes are additive-ish (screen blend) so where all three overlap you get
// the true text colour, and the last hundred milliseconds of convergence do
// almost all of the visual work.
//
// Distinct from `blur-focus` (a defocus), `glitch-intro` (torn slices) and
// `shadow-pop` (one offset twin): here there are three coloured copies moving
// on different vectors, and the payoff is registration, not sharpening.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "print", name: "Print", colors: { background: "#F5F4F0", textColor: "#111214", accent: "#E11D48" } },
  { id: "night", name: "Night", colors: { background: "#0C0D12", textColor: "#F2F2F4", accent: "#22D3EE" } },
  { id: "riso", name: "Riso", colors: { background: "#FBF3E4", textColor: "#1A1A1A", accent: "#F2542D" } },
  { id: "cyan", name: "Cyan", colors: { background: "#0A1620", textColor: "#EAF6FF", accent: "#38BDF8" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.092, maxWidthFrac: 0.76, centerFrac: 0.47 };
    case "9:16":
      return { fontFrac: 0.122, maxWidthFrac: 0.86, centerFrac: 0.46 };
    case "4:5":
      return { fontFrac: 0.112, maxWidthFrac: 0.84, centerFrac: 0.47 };
    case "1:1":
    default:
      return { fontFrac: 0.115, maxWidthFrac: 0.84, centerFrac: 0.47 };
  }
}

// Each channel comes in on its own vector, in units of the offset amount.
const VECTORS: { dx: number; dy: number }[] = [
  { dx: -1, dy: -0.35 },
  { dx: 0.85, dy: 0.5 },
  { dx: 0.35, dy: -0.9 },
];

// Which primaries, and which blend, depends entirely on the paper. Screen on a
// white background is white — the fringes would be invisible — so light
// backgrounds get subtractive CMY over `multiply` (ink on paper, which is what
// mis-registration actually looks like) and dark ones get additive RGB over
// `screen` (mis-converged phosphors).
const SUBTRACTIVE = ["#00AEEF", "#EC008C", "#FFF200"];
const ADDITIVE = ["#FF2D55", "#00E5C0", "#2D6BFF"];

const SETTLE_START = 0.25;
const SETTLE_DUR = 1.5;
const DURATION = 3.8;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F5F4F0"));
  const textColor = str(values.textColor, pc("textColor", "#111214"));
  const accent = str(values.accent, pc("accent", "#E11D48"));
  const headline = str(values.headline, "Back in register");
  const subline = str(values.subline, "").trim();
  const spread = num(values.spread, 1);
  const showRule = on(values.showRule);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerFrac;
  const maxWidth = size.width * L.maxWidthFrac;

  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.08);
  const relayout = () =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 800,
      fontSize,
      lineHeight,
      maxWidth,
      align: "center",
      anchorX: cx,
      centerY,
    });
  let boxes = relayout();
  let lines = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lines * lineHeight > size.height * 0.5; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.08);
    boxes = relayout();
    lines = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: DURATION };

  const offset = fontSize * 0.34 * spread;

  const rgb = parseHex(bg);
  const lightPaper = rgb ? luminance(rgb) > 0.4 : true;
  const inks = lightPaper ? SUBTRACTIVE : ADDITIVE;
  const blend = lightPaper ? "multiply" : "screen";

  // Fringe channels first, then the true-colour copy on top.
  for (let i = 0; i < VECTORS.length; i++) {
    const ch = VECTORS[i]!;
    const layer = new Container();
    layer.blendMode = blend;
    layer.alpha = 0;
    root.addChild(layer);
    for (const box of boxes) {
      const t = makeText(fonts, {
        text: box.text,
        role: "display",
        weight: 800,
        size: fontSize,
        color: inks[i]!,
        anchor: 0.5,
        letterSpacing: -fontSize * 0.012,
      });
      t.position.set(box.cx, box.cy);
      layer.addChild(t);
    }
    layer.position.set(ch.dx * offset, ch.dy * offset);
    timeline
      .to(layer, { prop: "x", from: ch.dx * offset, to: 0, start: SETTLE_START, duration: SETTLE_DUR, ease: outExpo })
      .to(layer, { prop: "y", from: ch.dy * offset, to: 0, start: SETTLE_START, duration: SETTLE_DUR, ease: outExpo })
      .to(layer, { prop: "alpha", from: 0, to: 0.85, start: SETTLE_START, duration: 0.3, ease: outQuad })
      // They fade out exactly as they land, handing off to the crisp copy.
      .to(layer, { prop: "alpha", from: 0.85, to: 0, start: SETTLE_START + SETTLE_DUR * 0.62, duration: SETTLE_DUR * 0.42, ease: outQuad });
  }

  const crisp = new Container();
  crisp.alpha = 0;
  root.addChild(crisp);
  for (const box of boxes) {
    const t = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 800,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
      letterSpacing: -fontSize * 0.012,
    });
    t.position.set(box.cx, box.cy);
    crisp.addChild(t);
  }
  timeline.to(crisp, {
    prop: "alpha",
    from: 0,
    to: 1,
    start: SETTLE_START + SETTLE_DUR * 0.55,
    duration: SETTLE_DUR * 0.5,
    ease: outQuad,
  });

  const bottom = Math.max(...boxes.map((b) => b.cy)) + lineHeight * 0.6;

  if (showRule) {
    const ruleW = Math.min(maxWidth, Math.max(...boxes.map((b) => b.cx + b.width / 2)) - Math.min(...boxes.map((b) => b.cx - b.width / 2)));
    const ruleH = Math.max(3, Math.round(size.width * 0.0032));
    const rule = new Graphics().rect(-ruleW / 2, -ruleH / 2, ruleW, ruleH).fill(accent);
    rule.position.set(cx, bottom + fontSize * 0.38);
    rule.scale.x = 0;
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: SETTLE_START + SETTLE_DUR * 0.8, duration: 0.7, ease: outExpo });
  }

  if (subline.length > 0) {
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: Math.round(fontSize * 0.24),
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: size.width * 0.0016,
    });
    const subY = bottom + fontSize * 0.82;
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.72, start: 1.95, duration: 0.6, ease: outQuad })
      .to(sub, { prop: "y", from: subY + fontSize * 0.14, to: subY, start: 1.95, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const chromaSplit: TemplateDefinition = {
  id: "chroma-split",
  name: "Chroma Split",
  tagline: "Three offset colour channels slide into register, like a print run finding focus.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Back in register", maxLength: 44, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Sharp where it counts", maxLength: 60, optional: true },
    { key: "spread", type: "slider", label: "Fringe spread", default: 1, min: 0.4, max: 2, step: 0.1 },
    { key: "showRule", type: "toggle", label: "Accent rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

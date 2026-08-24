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
import { layoutWords } from "../shared/words";

// Split Tone — every letterform is cut horizontally through its middle, the top
// half in one colour arriving from above and the bottom half in another
// arriving from below. They meet on the cut line and the word becomes one
// two-tone piece of lettering.
//
// The halves are genuine: the same words are drawn twice and each copy is
// masked to its own half of the line box, so the split falls *through* the
// glyphs at exactly the same height on every letter.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "punch", name: "Punch", colors: { background: "#FFF7ED", textColor: "#17151A", accent: "#F4511E" } },
  { id: "ink", name: "Ink", colors: { background: "#0E0F13", textColor: "#F5F4F1", accent: "#FACC15" } },
  { id: "mint", name: "Mint", colors: { background: "#ECF7F1", textColor: "#0E241B", accent: "#0F9D6E" } },
  { id: "violet", name: "Violet", colors: { background: "#F2EEFB", textColor: "#1B1330", accent: "#6D3BE4" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.115, maxWidthFrac: 0.76, centerFrac: 0.47 };
    case "9:16":
      return { fontFrac: 0.15, maxWidthFrac: 0.86, centerFrac: 0.46 };
    case "4:5":
      return { fontFrac: 0.14, maxWidthFrac: 0.84, centerFrac: 0.47 };
    case "1:1":
    default:
      return { fontFrac: 0.142, maxWidthFrac: 0.84, centerFrac: 0.47 };
  }
}

const MEET_START = 0.3;
const MEET_DUR = 1.0;
const PER_WORD = 0.11;
const DURATION = 3.9;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF7ED"));
  const textColor = str(values.textColor, pc("textColor", "#17151A"));
  const accent = str(values.accent, pc("accent", "#F4511E"));
  const headline = str(values.headline, "Two halves").toUpperCase();
  const subline = str(values.subline, "").trim();
  const cutAt = num(values.cutAt, 0.5);
  const showCut = on(values.showCut);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerFrac;
  const maxWidth = size.width * L.maxWidthFrac;

  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.02);
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
    lineHeight = Math.round(fontSize * 1.02);
    boxes = relayout();
    lines = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: DURATION };

  // A Pixi Text box centres on its *line* box, so glyphs sit slightly above the
  // geometric middle. The cut is placed against the cap height, not the box.
  const capMid = -fontSize * 0.06;
  const travel = fontSize * 0.85;

  boxes.forEach((box, i) => {
    const cut = box.cy + capMid + (cutAt - 0.5) * fontSize * 0.7;
    const at = MEET_START + i * PER_WORD;

    for (const half of [0, 1] as const) {
      const layer = new Container();
      root.addChild(layer);
      const t = makeText(fonts, {
        text: box.text,
        role: "display",
        weight: 800,
        size: fontSize,
        color: half === 0 ? textColor : accent,
        anchor: 0.5,
        letterSpacing: -fontSize * 0.012,
      });
      t.position.set(box.cx, box.cy);
      layer.addChild(t);

      const stripTop = half === 0 ? box.cy - lineHeight : cut;
      const stripH = half === 0 ? cut - (box.cy - lineHeight) : box.cy + lineHeight - cut;
      const strip = new Graphics().rect(0, stripTop, size.width, stripH).fill("#FFFFFF");
      root.addChild(strip);
      layer.mask = strip;

      const from = half === 0 ? -travel : travel;
      layer.alpha = 0;
      timeline
        .to(layer, { prop: "y", from, to: 0, start: at, duration: MEET_DUR, ease: outExpo })
        .to(layer, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad });
    }
  });

  // The cut line itself, drawn across the widest line of the block.
  if (showCut) {
    const first = boxes.filter((b) => b.line === 0);
    const l = Math.min(...first.map((b) => b.cx - b.width / 2));
    const r = Math.max(...first.map((b) => b.cx + b.width / 2));
    const cut = first[0]!.cy + capMid + (cutAt - 0.5) * fontSize * 0.7;
    const w = Math.max(2, Math.round(size.width * 0.0022));
    const rule = new Graphics().rect(-(r - l) / 2 - fontSize * 0.2, -w / 2, r - l + fontSize * 0.4, w).fill(accent);
    rule.position.set((l + r) / 2, cut);
    rule.scale.x = 0;
    rule.alpha = 0.75;
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: MEET_START + MEET_DUR * 0.55, duration: 0.7, ease: outExpo });
  }

  const bottom = Math.max(...boxes.map((b) => b.cy)) + lineHeight * 0.6;
  if (subline.length > 0) {
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: Math.round(fontSize * 0.2),
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: size.width * 0.0016,
    });
    const subY = bottom + fontSize * 0.42;
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.74, start: MEET_START + MEET_DUR + 0.4, duration: 0.6, ease: outQuad })
      .to(sub, { prop: "y", from: subY + fontSize * 0.12, to: subY, start: MEET_START + MEET_DUR + 0.4, duration: 0.8, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const halfToneType: TemplateDefinition = {
  id: "half-tone-type",
  name: "Split Tone",
  tagline: "Every letter is cut through the middle — two colours arrive and meet on the line.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Two halves", maxLength: 32, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "One whole idea", maxLength: 60, optional: true },
    { key: "cutAt", type: "slider", label: "Cut height", default: 0.5, min: 0.25, max: 0.75, step: 0.05 },
    { key: "showCut", type: "toggle", label: "Cut line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Top half", default: "", optional: true },
    { key: "accent", type: "color", label: "Bottom half", default: "", optional: true },
  ],
  build,
};

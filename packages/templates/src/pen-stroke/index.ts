import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  linear,
  outExpo,
  outQuad,
  outQuint,
  shrinkToFit,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Penned — an editorial serif headline draws itself left to right as if written,
// with a nib travelling along the leading edge and a swash flourish underneath.
// The reveal edge is a slanted parallelogram rather than a vertical bar, so
// letters uncover along the pen's angle instead of being guillotined.
//
// `logo-draw` and `signature-sign` draw brand *marks*; `mask-wipe` uncovers with
// a straight edge and no hand. This is a headline with a visible writing hand.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ivory", name: "Ivory", colors: { background: "#FBF7EF", textColor: "#241D14", accent: "#9A6A3A" } },
  { id: "ink", name: "Ink", colors: { background: "#12130F", textColor: "#F6F3E9", accent: "#D8B26A" } },
  { id: "blush", name: "Blush", colors: { background: "#FDF1F0", textColor: "#3A1B21", accent: "#C2607A" } },
  { id: "sea", name: "Sea", colors: { background: "#EDF4F4", textColor: "#0F2226", accent: "#2A7D74" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.115, maxWidthFrac: 0.72, centerFrac: 0.47 };
    case "9:16":
      return { fontFrac: 0.15, maxWidthFrac: 0.84, centerFrac: 0.46 };
    case "4:5":
      return { fontFrac: 0.14, maxWidthFrac: 0.82, centerFrac: 0.47 };
    case "1:1":
    default:
      return { fontFrac: 0.142, maxWidthFrac: 0.82, centerFrac: 0.47 };
  }
}

const WRITE_START = 0.3;
const WRITE_DUR = 1.7;
const DURATION = 4.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FBF7EF"));
  const textColor = str(values.textColor, pc("textColor", "#241D14"));
  const accent = str(values.accent, pc("accent", "#9A6A3A"));
  const headline = str(values.headline, "with love");
  const kicker = str(values.kicker, "").trim();
  const subline = str(values.subline, "").trim();
  const showNib = on(values.showNib);
  const showSwash = on(values.showSwash);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerFrac;
  const maxWidth = size.width * L.maxWidthFrac;

  const family = fonts.family("serif");
  const base = Math.round(size.width * L.fontFrac);
  const fontSize = shrinkToFit(headline, (s, sz) => fonts.measure(s, { family, weight: 400, size: sz }), {
    maxWidth,
    baseSize: base,
    minSize: Math.round(base * 0.42),
  });
  const width = fonts.measure(headline, { family, weight: 400, size: fontSize });
  const left = cx - width / 2;

  const timeline = new JimaTimeline();

  const scriptLayer = new Container();
  root.addChild(scriptLayer);
  const word = makeText(fonts, {
    text: headline,
    role: "serif",
    weight: 400,
    size: fontSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  word.position.set(left, centerY);
  scriptLayer.addChild(word);

  // The reveal edge is a parallelogram slanted with the script's rise, so the
  // pen appears to travel along the stroke rather than a vertical bar wiping.
  const slant = fontSize * 0.34;
  const h = fontSize * 2.4;
  const top = centerY - h / 2;
  const revealW = width + fontSize * 0.9;
  const clip = new Graphics()
    .poly([-revealW - slant, top, -slant, top, 0, top + h, -revealW, top + h])
    .fill("#FFFFFF");
  clip.position.set(left, 0);
  root.addChild(clip);
  scriptLayer.mask = clip;
  timeline.to(clip, {
    prop: "x",
    from: left,
    to: left + revealW + slant,
    start: WRITE_START,
    duration: WRITE_DUR,
    // Linear so the "pen" holds a constant speed — an eased hand looks hesitant.
    ease: linear,
  });

  // The nib rides the leading edge of that same clip.
  if (showNib) {
    const nibW = Math.max(3, fontSize * 0.045);
    const nib = new Graphics()
      .poly([slant / 2, -fontSize * 0.62, -slant / 2, fontSize * 0.62])
      .stroke({ color: accent, width: nibW, cap: "round" });
    nib.position.set(left, centerY);
    nib.alpha = 0;
    root.addChild(nib);
    timeline
      .to(nib, { prop: "x", from: left, to: left + revealW, start: WRITE_START, duration: WRITE_DUR, ease: linear })
      .to(nib, { prop: "alpha", from: 0, to: 0.9, start: WRITE_START, duration: 0.18, ease: outQuad })
      .to(nib, { prop: "alpha", from: 0.9, to: 0, start: WRITE_START + WRITE_DUR * 0.86, duration: WRITE_DUR * 0.2, ease: outQuad });
  }

  // A swash that sweeps under the word once the hand lifts.
  const swashY = centerY + fontSize * 0.62;
  if (showSwash) {
    const pts: number[] = [];
    const steps = 60;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const x = left - fontSize * 0.15 + (width + fontSize * 0.3) * u;
      // A shallow sine with a rising tail, the shape a flourish actually makes.
      const y = swashY + Math.sin(u * Math.PI) * fontSize * 0.16 - u * u * fontSize * 0.2;
      pts.push(x, y);
    }
    const swash = new Graphics()
      .poly(pts, false)
      .stroke({ color: accent, width: Math.max(2, fontSize * 0.035), cap: "round", join: "round" });
    swash.pivot.set(left, swashY);
    swash.position.set(left, swashY);
    swash.scale.x = 0;
    root.addChild(swash);
    timeline.to(swash, {
      prop: "scale.x",
      from: 0,
      to: 1,
      start: WRITE_START + WRITE_DUR * 0.82,
      duration: 0.85,
      ease: outExpo,
    });
  }

  if (kicker.length > 0) {
    const k = makeText(fonts, {
      text: kicker.toUpperCase(),
      role: "body",
      weight: 700,
      size: Math.round(size.width * 0.017),
      color: accent,
      anchor: 0.5,
      letterSpacing: size.width * 0.005,
    });
    const kY = centerY - fontSize * 0.95;
    k.position.set(cx, kY);
    k.alpha = 0;
    root.addChild(k);
    timeline
      .to(k, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.45, ease: outQuad })
      .to(k, { prop: "y", from: kY + fontSize * 0.14, to: kY, start: 0.1, duration: 0.75, ease: outExpo });
  }

  if (subline.length > 0) {
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 400,
      size: Math.round(size.width * 0.024),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const subY = swashY + fontSize * 0.62;
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.72, start: WRITE_START + WRITE_DUR + 0.35, duration: 0.65, ease: outQuad })
      .to(sub, { prop: "y", from: subY + fontSize * 0.12, to: subY, start: WRITE_START + WRITE_DUR + 0.35, duration: 0.85, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const penStroke: TemplateDefinition = {
  id: "pen-stroke",
  name: "Penned",
  tagline: "A serif headline is written on by a travelling nib, then finished with a swash.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { headline: "serif", kicker: "body", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "with love", maxLength: 26, shrinkToFit: true },
    { key: "kicker", type: "text", label: "Kicker", default: "Handmade", maxLength: 24, optional: true },
    { key: "subline", type: "text", label: "Subline", default: "Small batch, every week", maxLength: 60, optional: true },
    { key: "showNib", type: "toggle", label: "Pen nib", default: true },
    { key: "showSwash", type: "toggle", label: "Swash", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

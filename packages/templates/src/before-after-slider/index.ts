import { Container, Graphics, Sprite, type Texture } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  safeZone,
  outQuad,
  inOutCubic,
  spring,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const PALETTES: Palette[] = [
  { id: "studio", name: "Studio", colors: { background: "#0A0A0F", accent: "#FF4D1C", before: "#CFCAC2", beforeGlyph: "#938C82", afterGlyph: "#FFFFFF", chip: "#16151B", chipText: "#FFFFFF", muted: "#9A94A0" } },
  { id: "cool", name: "Cool", colors: { background: "#061024", accent: "#2E7DF6", before: "#C4CDD8", beforeGlyph: "#8A96A4", afterGlyph: "#FFFFFF", chip: "#0E1526", chipText: "#FFFFFF", muted: "#8894A6" } },
  { id: "lime", name: "Lime", colors: { background: "#0C1206", accent: "#7BB026", before: "#CDD2C4", beforeGlyph: "#8E9584", afterGlyph: "#FFFFFF", chip: "#16210B", chipText: "#FFFFFF", muted: "#93A07E" } },
  { id: "grape", name: "Grape", colors: { background: "#140A24", accent: "#7C5CFF", before: "#CBC6D6", beforeGlyph: "#8E88A0", afterGlyph: "#FFFFFF", chip: "#1B1140", chipText: "#FFFFFF", muted: "#948CB0" } },
];

const TARGET = 0.5; // divider settles at center → classic before | after hold.

/** A framed-landscape glyph, centered at origin. */
function imageGlyph(s: number, color: string): Graphics {
  const g = new Graphics();
  g.roundRect(-0.5 * s, -0.42 * s, s, 0.84 * s, 0.12 * s).stroke({ color, width: Math.max(2, 0.05 * s) });
  g.circle(-0.18 * s, -0.14 * s, 0.1 * s).fill(color);
  g.poly([-0.44 * s, 0.34 * s, -0.12 * s, -0.04 * s, 0.06 * s, 0.14 * s, 0.28 * s, -0.12 * s, 0.46 * s, 0.34 * s]).fill(color);
  return g;
}

/** A full-frame photo (cover-fit) or a designed color placeholder with a glyph. */
function fullFrame(tex: Texture | null, w: number, h: number, fill: string, glyphColor: string): Container {
  const c = new Container();
  if (tex) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const cover = Math.max(w / tex.width, h / tex.height);
    s.scale.set(cover);
    s.position.set(w / 2, h / 2);
    c.addChild(s);
  } else {
    c.addChild(new Graphics().rect(0, 0, w, h).fill(fill));
    const g = imageGlyph(Math.min(w, h) * 0.16, glyphColor);
    g.position.set(w / 2, h / 2);
    c.addChild(g);
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, images } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0A0A0F"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const beforeC = pc("before", "#CFCAC2");
  const beforeGlyph = pc("beforeGlyph", "#938C82");
  const afterGlyph = pc("afterGlyph", "#FFFFFF");
  const chipC = pc("chip", "#16151B");
  const chipTextC = str(values.textColor, pc("chipText", "#FFFFFF"));
  const muted = pc("muted", "#9A94A0");
  const beforeLabel = str(values.beforeLabel, "Before");
  const afterLabel = str(values.afterLabel, "After");
  const showAccentDot = values.accentDot !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  root.addChild(new Graphics().rect(0, 0, w, h).fill(bg));
  const timeline = new JimaTimeline();

  const beforeTex = images.beforeImage ?? null;
  const afterTex = images.afterImage ?? null;

  // BEFORE fills the whole frame (bottom layer).
  const beforeC0 = fullFrame(beforeTex, w, h, beforeC, beforeGlyph);
  beforeC0.pivot.set(w / 2, h / 2);
  beforeC0.position.set(w / 2, h / 2);
  beforeC0.alpha = 0;
  beforeC0.scale.set(1.04);
  root.addChild(beforeC0);
  timeline
    .to(beforeC0, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.5, ease: outQuad })
    .to(beforeC0, { prop: "scale.x", from: 1.04, to: 1, start: 0.15, duration: 0.9, ease: outQuad })
    .to(beforeC0, { prop: "scale.y", from: 1.04, to: 1, start: 0.15, duration: 0.9, ease: outQuad });

  // AFTER fills the frame too, revealed left→center by a growing mask.
  const afterC0 = fullFrame(afterTex, w, h, accent, afterGlyph);
  root.addChild(afterC0);
  const revealMask = new Graphics().rect(0, 0, w, h).fill(0xffffff);
  revealMask.pivot.set(0, 0);
  revealMask.position.set(0, 0);
  revealMask.scale.set(0, 1);
  root.addChild(revealMask);
  afterC0.mask = revealMask;
  timeline.to(revealMask, { prop: "scale.x", from: 0, to: TARGET, start: 1.0, duration: 2.0, ease: inOutCubic });

  // Divider (vertical line + round grip with ‹ › arrows) tracks the mask edge.
  const gripY = (zone_top(ctx) + (h - zone_bottom(ctx))) / 2;
  const lineW = Math.max(3, minDim * 0.006);
  const gripR = minDim * 0.052;

  const div = new Container();
  div.addChild(new Graphics().rect(-lineW, 0, lineW * 2, h).fill({ color: 0x000000, alpha: 0.12 }));
  div.addChild(new Graphics().rect(-lineW / 2, 0, lineW, h).fill("#FFFFFF"));

  const grip = new Container();
  grip.position.set(0, gripY);
  grip.addChild(new Graphics().circle(0, gripR * 0.09, gripR).fill({ color: 0x000000, alpha: 0.2 }));
  grip.addChild(new Graphics().circle(0, 0, gripR).fill("#FFFFFF"));
  const cw = gripR * 0.32;
  const th = Math.max(2, gripR * 0.13);
  const lx = -gripR * 0.2;
  const rx = gripR * 0.2;
  grip.addChild(new Graphics().poly([lx + cw * 0.5, -cw, lx - cw * 0.5, 0, lx + cw * 0.5, cw], false).stroke({ color: "#3A3A42", width: th, cap: "round", join: "round" }));
  grip.addChild(new Graphics().poly([rx - cw * 0.5, -cw, rx + cw * 0.5, 0, rx - cw * 0.5, cw], false).stroke({ color: "#3A3A42", width: th, cap: "round", join: "round" }));
  grip.scale.set(0);
  div.addChild(grip);

  div.position.set(0, 0);
  div.alpha = 0;
  root.addChild(div);
  timeline
    .to(div, { prop: "alpha", from: 0, to: 1, start: 1.0, duration: 0.3, ease: outQuad })
    .to(div, { prop: "x", from: 0, to: TARGET * w, start: 1.0, duration: 2.0, ease: inOutCubic })
    .to(grip, { prop: "scale.x", from: 0, to: 1, start: 1.05, duration: 0.6, ease: spring(0.5) })
    .to(grip, { prop: "scale.y", from: 0, to: 1, start: 1.05, duration: 0.6, ease: spring(0.5) });

  // Corner label chips: AFTER (top-left, accent dot) / BEFORE (top-right, muted dot).
  const chipFont = Math.round(minDim * 0.03);
  const inset = minDim * 0.06;
  const chipTop = zone_top(ctx) + chipFont * 1.1;

  const makeChip = (text: string, dotColor: string): { node: Container; width: number } => {
    const t = makeText(fonts, { text, role: "display", weight: 700, size: chipFont, color: chipTextC, anchor: { x: 0, y: 0.5 }, letterSpacing: 1.5 });
    const dotR = chipFont * 0.26;
    const padX = chipFont * 0.8;
    const gapD = showAccentDot ? chipFont * 0.45 : 0;
    const innerW = (showAccentDot ? dotR * 2 : 0) + gapD + t.width;
    const pw = innerW + padX * 2;
    const ph = chipFont * 1.85;
    const c = new Container();
    c.addChild(new Graphics().roundRect(-pw / 2, -ph / 2 + ph * 0.08, pw, ph, ph / 2).fill({ color: 0x000000, alpha: 0.24 }));
    c.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill(chipC));
    if (showAccentDot) {
      c.addChild(new Graphics().circle(-innerW / 2 + dotR, 0, dotR).fill(dotColor));
    }
    t.position.set(showAccentDot ? -innerW / 2 + dotR * 2 + gapD : -innerW / 2, 0);
    c.addChild(t);
    return { node: c, width: pw };
  };

  const after = makeChip(afterLabel, accent);
  after.node.position.set(inset + after.width / 2, chipTop);
  after.node.scale.set(0);
  root.addChild(after.node);
  timeline
    .to(after.node, { prop: "scale.x", from: 0, to: 1, start: 1.3, duration: 0.5, ease: spring(0.5) })
    .to(after.node, { prop: "scale.y", from: 0, to: 1, start: 1.3, duration: 0.5, ease: spring(0.5) });

  const before = makeChip(beforeLabel, muted);
  before.node.position.set(w - inset - before.width / 2, chipTop);
  before.node.scale.set(0);
  root.addChild(before.node);
  timeline
    .to(before.node, { prop: "scale.x", from: 0, to: 1, start: 0.55, duration: 0.5, ease: spring(0.5) })
    .to(before.node, { prop: "scale.y", from: 0, to: 1, start: 0.55, duration: 0.5, ease: spring(0.5) });

  return { timeline, duration: 4.0 };
}

function zone_top(ctx: TemplateContext): number {
  return safeZone(ctx.aspect).top;
}
function zone_bottom(ctx: TemplateContext): number {
  return safeZone(ctx.aspect).bottom;
}

export const beforeAfterSlider: TemplateDefinition = {
  id: "before-after-slider",
  name: "Before / After Slider",
  tagline: "A divider sweeps across to reveal the after over the before.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "beforeImage", type: "image", label: "Before image", default: "", optional: true },
    { key: "afterImage", type: "image", label: "After image", default: "", optional: true },
    { key: "beforeLabel", type: "text", label: "Before label", default: "Before", maxLength: 16 },
    { key: "afterLabel", type: "text", label: "After label", default: "After", maxLength: 16 },
    { key: "accentDot", type: "toggle", label: "Accent dot", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

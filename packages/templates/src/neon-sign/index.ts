import { Container, Graphics, Sprite } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  linear,
  type Aspect,
  type BuiltTemplate,
  type MakeTextOptions,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { radialGlowTexture } from "../shared/glow";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "midnight-pink", name: "Midnight pink", colors: { background: "#0B0B12", accent: "#FF2E9E" } },
  { id: "noir-cyan", name: "Noir cyan", colors: { background: "#0A0E12", accent: "#38E1FF" } },
  { id: "blackout-lime", name: "Blackout lime", colors: { background: "#0A0F0A", accent: "#CFFF3D" } },
  { id: "velvet-violet", name: "Velvet violet", colors: { background: "#120812", accent: "#B84DFF" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
}
function layoutFor(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.1, maxWidthFrac: 0.78 };
    case "9:16":
      return { fontFrac: 0.13, maxWidthFrac: 0.82 };
    case "4:5":
      return { fontFrac: 0.12, maxWidthFrac: 0.82 };
    case "1:1":
    default:
      return { fontFrac: 0.115, maxWidthFrac: 0.8 };
  }
}

/** Shrink-to-fit: re-make one size smaller if the text would overflow maxWidth. */
function fitText(fonts: TemplateContext["fonts"], opts: MakeTextOptions, maxWidth: number) {
  const t = makeText(fonts, opts);
  if (maxWidth > 0 && t.width > maxWidth) {
    const shrunk = Math.max(10, Math.floor(opts.size * (maxWidth / t.width)));
    if (shrunk < opts.size) return makeText(fonts, { ...opts, size: shrunk });
  }
  return t;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#0B0B12"));
  const accent = str(values.accent, pcol("accent", "#FF2E9E"));
  const text = str(values.text, "GOOD VIBES");
  const showGlow = on(values.showGlow);

  const w = size.width;
  const h = size.height;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layoutFor(ctx.aspect);
  const fontSize = Math.round(w * L.fontFrac);
  const cx = w / 2;
  const cy = h * 0.5;

  // The whole neon sign (glow + glass) flickers on as one unit.
  const sign = new Container();
  sign.label = "sign";
  sign.position.set(cx, cy);
  root.addChild(sign);

  const label = fitText(
    fonts,
    { text, role: "display", weight: 700, size: fontSize, color: accent, anchor: 0.5, align: "center" },
    w * L.maxWidthFrac,
  );

  if (showGlow) {
    const glowW = Math.max(label.width, fontSize) * 1.5;
    const glowH = (label.height || fontSize) * 2.6;
    const outerGlow = new Sprite(radialGlowTexture());
    outerGlow.anchor.set(0.5);
    outerGlow.tint = accent;
    outerGlow.width = glowW;
    outerGlow.height = glowH;
    outerGlow.alpha = 0.5;
    sign.addChild(outerGlow);

    const innerGlow = new Sprite(radialGlowTexture());
    innerGlow.anchor.set(0.5);
    innerGlow.tint = accent;
    innerGlow.width = glowW * 0.55;
    innerGlow.height = glowH * 0.6;
    innerGlow.alpha = 0.8;
    sign.addChild(innerGlow);
  }
  sign.addChild(label);

  // Flicker: a few quick, staggered alpha steps before settling to a full,
  // steady "on" state (a designed hold — no motion continues after this).
  sign.alpha = 0;
  const timeline = new JimaTimeline();
  const steps: [start: number, duration: number, toAlpha: number][] = [
    [0.1, 0.05, 1],
    [0.2, 0.04, 0.15],
    [0.3, 0.05, 1],
    [0.42, 0.05, 0.5],
    [0.52, 0.05, 1],
    [0.68, 0.04, 0.65],
  ];
  let prevAlpha = 0;
  let prevEnd = 0;
  for (const [start, duration, toAlpha] of steps) {
    timeline.to(sign, { prop: "alpha", from: prevAlpha, to: toAlpha, start, duration, ease: linear });
    prevAlpha = toAlpha;
    prevEnd = start + duration;
  }
  timeline.to(sign, { prop: "alpha", from: prevAlpha, to: 1, start: prevEnd + 0.02, duration: 0.4, ease: outQuad });

  return { timeline, duration: 4.0 };
}

export const neonSign: TemplateDefinition = {
  id: "neon-sign",
  name: "Neon Sign",
  tagline: "A title flickers on like a neon tube, glowing softly once lit.",
  category: "intro",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { text: "display" },
  palettes: PALETTES,
  fields: [
    { key: "text", type: "text", label: "Text", default: "GOOD VIBES", maxLength: 28, shrinkToFit: true },
    { key: "showGlow", type: "toggle", label: "Glow", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "accent", type: "color", label: "Neon color", default: "", optional: true },
  ],
  build,
};

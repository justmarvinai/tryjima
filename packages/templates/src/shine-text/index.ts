import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outCubic,
  outExpo,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);

// --- Deterministic hex helpers (pure) — build a bright shine tint of the accent.
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.slice(0, 3).split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full.length === 6 ? full : "ffffff", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const toHex = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `#${toHex(ca.r + (cb.r - ca.r) * t)}${toHex(ca.g + (cb.g - ca.g) * t)}${toHex(ca.b + (cb.b - ca.b) * t)}`;
}

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

interface L {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.082, maxWidthFrac: 0.78, centerYFrac: 0.5 };
    case "9:16":
      return { fontFrac: 0.11, maxWidthFrac: 0.84, centerYFrac: 0.45 };
    case "4:5":
      return { fontFrac: 0.1, maxWidthFrac: 0.84, centerYFrac: 0.46 };
    case "1:1":
    default:
      return { fontFrac: 0.098, maxWidthFrac: 0.84, centerYFrac: 0.47 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Make it shine");

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));
  const L = layout(ctx.aspect);
  const fontSize = Math.round(size.width * L.fontFrac);
  const lineHeight = Math.round(fontSize * 1.14);

  const boxes = layoutWords(headline, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth: size.width * L.maxWidthFrac,
    align: "center",
    anchorX: size.width / 2,
    centerY: size.height * L.centerYFrac,
  });

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: 3.6 };

  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const topY = Math.min(...boxes.map((b) => b.cy)) - fontSize * 0.7;
  const botY = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.7;
  const blockCy = (topY + botY) / 2;

  const baseLayer = new Container();
  const shineLayer = new Container();
  root.addChild(baseLayer);
  root.addChild(shineLayer);

  // A bright tint of the accent reads as a highlight glint on the letters.
  const shineColor = mixHex(accent, "#FFFFFF", 0.5);

  boxes.forEach((b, i) => {
    // Base copy — fades and gently scales in.
    const base = makeText(fonts, { text: b.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    base.position.set(b.cx, b.cy);
    base.alpha = 0;
    base.scale.set(0.9);
    baseLayer.addChild(base);
    const start = 0.3 + i * 0.06;
    timeline
      .to(base, { prop: "alpha", from: 0, to: 1, start, duration: 0.5, ease: outCubic })
      .to(base, { prop: "scale.x", from: 0.9, to: 1, start, duration: 0.7, ease: outExpo })
      .to(base, { prop: "scale.y", from: 0.9, to: 1, start, duration: 0.7, ease: outExpo });

    // Bright copy — same layout, revealed only through the moving band.
    const shine = makeText(fonts, { text: b.text, role: "display", weight: 700, size: fontSize, color: shineColor, anchor: 0.5 });
    shine.position.set(b.cx, b.cy);
    shineLayer.addChild(shine);
  });

  // Narrow, slightly diagonal band that sweeps left -> right across the letters once.
  const bandW = fontSize * 1.2;
  const bandH = botY - topY + fontSize * 4;
  const band = new Graphics().rect(-bandW / 2, -bandH / 2, bandW, bandH).fill("#FFFFFF");
  band.rotation = -0.16;
  const startX = left - bandW;
  const endX = right + bandW;
  band.position.set(startX, blockCy);
  root.addChild(band);
  shineLayer.mask = band;

  const shineStart = 1.2;
  const shineDur = 0.9;
  timeline.to(band, { prop: "x", from: startX, to: endX, start: shineStart, duration: shineDur, ease: outCubic });

  return { timeline, duration: Math.max(3.6, shineStart + shineDur + 1.3) };
}

export const shineText: TemplateDefinition = {
  id: "shine-text",
  name: "Shine Text",
  tagline: "A bright glint sweeps across your headline once.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Make it shine", maxLength: 44, shrinkToFit: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

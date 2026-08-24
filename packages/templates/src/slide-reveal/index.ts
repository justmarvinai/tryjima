import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuint,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const asLines = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

const PALETTES: Palette[] = [
  { id: "editorial-ink", name: "Editorial ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream-burgundy", name: "Cream + burgundy", colors: { background: "#F6EFE6", textColor: "#4A1020", accent: "#9E2B3A" } },
  { id: "paper-cobalt", name: "Paper + cobalt", colors: { background: "#F0F3FA", textColor: "#0E1D3D", accent: "#2E5BD6" } },
  { id: "mist-forest", name: "Mist + forest", colors: { background: "#EEF4EF", textColor: "#0E2A1C", accent: "#1C7A4A" } },
];

function fontFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.078 : aspect === "9:16" ? 0.1 : 0.092;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string) => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const alignment = str(values.alignment, "left") === "center" ? "center" : "left";
  const fontRole = (str(values.fontRole, "display") as FontRole) === "serif" ? "serif" : "display";
  const lines = asLines(values.lines, ["Design is", "how it", "moves."]).slice(0, 4);
  const attribution = str(values.attribution, "");
  const showAccentBar = values.accentBar !== false;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const fontSize = Math.round(size.width * fontFrac(ctx.aspect));
  const lineHeight = Math.round(fontSize * 1.16);
  const blockH = lines.length * lineHeight;
  const marginX = size.width * (alignment === "left" ? 0.1 : 0.5);
  const maxWidth = size.width * 0.8;
  const top = size.height * 0.46 - blockH / 2;
  const timeline = new JimaTimeline();

  // Accent bar: wipes in, then thins to a rule above the block.
  const barW = maxWidth * 0.5;
  const barX = alignment === "left" ? marginX : marginX - barW / 2;
  if (showAccentBar) {
    const bar = new Graphics().rect(0, 0, barW, Math.round(fontSize * 0.28)).fill(accent);
    bar.position.set(barX, top - fontSize * 0.55);
    bar.pivot.set(0, 0);
    bar.scale.set(0, 1);
    root.addChild(bar);
    timeline
      .to(bar, { prop: "scale.x", from: 0, to: 1, start: 0.0, duration: 0.4, ease: outExpo })
      .to(bar, { prop: "scale.y", from: 1, to: 0.16, start: 0.42, duration: 0.24, ease: outQuad });
  }

  // Lines: each rises into view under a clip mask.
  const wordNodes: Text[] = [];
  lines.forEach((line, i) => {
    const lineY = top + i * lineHeight;
    const holder = new Container();
    holder.position.set(0, lineY);
    root.addChild(holder);

    const maskG = new Graphics().rect(barX - 4, 0, maxWidth + 8, lineHeight).fill(0xffffff);
    holder.addChild(maskG);

    const t = makeText(fonts, {
      text: line,
      role: fontRole,
      weight: 600,
      size: fontSize,
      color: textColor,
      anchor: alignment === "left" ? { x: 0, y: 0 } : { x: 0.5, y: 0 },
    });
    t.position.set(alignment === "left" ? barX : marginX, lineHeight);
    t.mask = maskG;
    holder.addChild(t);
    wordNodes.push(t);

    const start = 0.4 + i * 0.32;
    timeline.to(t, { prop: "y", from: lineHeight, to: fontSize * 0.06, start, duration: 0.55, ease: outQuint });
  });

  if (attribution.length > 0) {
    const attr = makeText(fonts, {
      text: attribution,
      role: "body",
      weight: 500,
      size: Math.round(fontSize * 0.3),
      color: accent,
      anchor: alignment === "left" ? { x: 0, y: 0.5 } : { x: 0.5, y: 0.5 },
    });
    const ay = top + blockH + fontSize * 0.5;
    attr.position.set(alignment === "left" ? barX : marginX, ay);
    attr.alpha = 0;
    root.addChild(attr);
    const attrStart = 0.4 + lines.length * 0.32 + 0.2;
    timeline
      .to(attr, { prop: "alpha", from: 0, to: 1, start: attrStart, duration: 0.5, ease: outQuad })
      .to(attr, { prop: "x", from: (alignment === "left" ? barX : marginX) - 14, to: alignment === "left" ? barX : marginX, start: attrStart, duration: 0.5, ease: outQuint });
  }

  return { timeline, duration: 4.5 };
}

export const slideReveal: TemplateDefinition = {
  id: "slide-reveal",
  name: "Slide & Reveal",
  tagline: "Elegant line-by-line mask reveal.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "lines", type: "textlist", label: "Lines", default: ["Design is", "how it", "moves."], minItems: 1, maxItems: 4, maxLength: 40 },
    { key: "attribution", type: "text", label: "Attribution", default: "", maxLength: 40, optional: true },
    { key: "alignment", type: "select", label: "Alignment", default: "left", options: [{ value: "left", label: "Left" }, { value: "center", label: "Center" }] },
    { key: "fontRole", type: "select", label: "Font", default: "display", options: [{ value: "display", label: "Sans" }, { value: "serif", label: "Serif" }] },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

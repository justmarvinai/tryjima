import { Graphics } from "pixi.js";
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

// Type Specimen — the sheet a foundry posts: one enormous character, the full
// alphabet stepping across beneath it, and a paragraph set at reading size, all
// labelled with the family and its weights. For anyone who ships a typeface,
// picks one for a client, or wants to show their brand's voice.
//
// It is the one template that puts the *typeface itself* on stage, so it draws
// everything in the chosen role and lets the shapes do the work.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#F4F3EF", textColor: "#131316", accent: "#D6453B" } },
  { id: "ink", name: "Ink", colors: { background: "#0F1013", textColor: "#F5F4F1", accent: "#E4B33C" } },
  { id: "blue", name: "Blue", colors: { background: "#EBEFF7", textColor: "#101728", accent: "#2554D4" } },
  { id: "moss", name: "Moss", colors: { background: "#EFF2EA", textColor: "#151B12", accent: "#5C6B2F" } },
];

interface Layout {
  glyphFrac: number;
  alphaFrac: number;
  bodyFrac: number;
  topFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { glyphFrac: 0.3, alphaFrac: 0.024, bodyFrac: 0.02, topFrac: 0.16 };
    case "9:16":
      return { glyphFrac: 0.56, alphaFrac: 0.032, bodyFrac: 0.028, topFrac: 0.18 };
    case "4:5":
      return { glyphFrac: 0.5, alphaFrac: 0.03, bodyFrac: 0.026, topFrac: 0.16 };
    case "1:1":
    default:
      return { glyphFrac: 0.46, alphaFrac: 0.029, bodyFrac: 0.025, topFrac: 0.16 };
  }
}

const GLYPH_AT = 0.3;
const ALPHA_AT = 0.85;
const BODY_AT = 1.6;
const DURATION = 5.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F3EF"));
  const textColor = str(values.textColor, pc("textColor", "#131316"));
  const accent = str(values.accent, pc("accent", "#D6453B"));
  const family = str(values.family, "Your headline face");
  const glyph = str(values.glyph, "Aa").slice(0, 3);
  const alphabet = str(values.alphabet, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  const specimen = str(values.specimen, "The quick brown fox jumps over the lazy dog, and sets it in one line.");
  const weights = str(values.weights, "").trim();
  const useSerif = on(values.useSerif);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const role = useSerif ? ("serif" as const) : ("display" as const);
  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const colW = size.width * 0.84;
  const left = cx - colW / 2;
  const top = size.height * L.topFrac;

  const timeline = new JimaTimeline();

  // --- Family name and weights, as a header rule ---
  const nameSize = Math.round(size.width * 0.026);
  const n = makeText(fonts, {
    text: family,
    role: "body",
    weight: 800,
    size: nameSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
    letterSpacing: nameSize * 0.04,
  });
  n.position.set(left, top);
  n.alpha = 0;
  root.addChild(n);
  timeline
    .to(n, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.4, ease: outQuad })
    .to(n, { prop: "x", from: left - nameSize, to: left, start: 0.15, duration: 0.75, ease: outExpo });

  if (weights.length > 0) {
    const w = makeText(fonts, {
      text: weights,
      role: "body",
      weight: 500,
      size: nameSize * 0.86,
      color: accent,
      anchor: { x: 1, y: 0.5 },
    });
    w.position.set(left + colW, top);
    w.alpha = 0;
    root.addChild(w);
    timeline.to(w, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.45, ease: outQuad });
  }

  const ruleH = Math.max(2, size.width * 0.0018);
  const rule = new Graphics().rect(left, top + nameSize, colW, ruleH).fill(textColor);
  rule.alpha = 0.3;
  rule.pivot.set(left, 0);
  rule.position.set(left, 0);
  rule.scale.x = 0;
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.8, ease: outExpo });

  // --- The big glyph ---
  const glyphSize = Math.round(size.width * L.glyphFrac);
  const glyphY = top + nameSize * 2 + glyphSize * 0.52;
  const g = makeText(fonts, {
    text: glyph,
    role,
    weight: 700,
    size: glyphSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  if (g.width > colW) g.scale.set(colW / g.width);
  g.position.set(left, glyphY);
  g.alpha = 0;
  root.addChild(g);
  timeline
    .to(g, { prop: "alpha", from: 0, to: 1, start: GLYPH_AT, duration: 0.45, ease: outQuad })
    .to(g, { prop: "y", from: glyphY + glyphSize * 0.14, to: glyphY, start: GLYPH_AT, duration: 1.0, ease: outExpo })
    .to(g, { prop: "scale.x", from: 0.94, to: g.scale.x, start: GLYPH_AT, duration: 1.0, ease: outExpo });

  // The counter of the glyph picked out in the accent — a specimen sheet always
  // shows one detail large.
  const dotR = glyphSize * 0.06;
  const dot = new Graphics().circle(0, 0, dotR).fill(accent);
  dot.position.set(left + g.width + dotR * 1.6, glyphY - glyphSize * 0.26);
  dot.scale.set(0);
  root.addChild(dot);
  timeline
    .to(dot, { prop: "scale.x", from: 0, to: 1, start: GLYPH_AT + 0.5, duration: 0.5, ease: outExpo })
    .to(dot, { prop: "scale.y", from: 0, to: 1, start: GLYPH_AT + 0.5, duration: 0.5, ease: outExpo });

  // --- The alphabet, stepping across letter by letter ---
  const alphaSize = Math.round(size.width * L.alphaFrac);
  const alphaY = glyphY + glyphSize * 0.62;
  const chars = [...alphabet.replace(/\s+/g, "")];
  const style = { family: fonts.family(role), weight: 500, size: alphaSize };
  const totalW = chars.reduce((a, c) => a + fonts.measure(c, style) + alphaSize * 0.12, 0);
  const scale = totalW > colW ? colW / totalW : 1;
  let x = left;
  chars.forEach((ch, i) => {
    const t = makeText(fonts, { text: ch, role, weight: 500, size: alphaSize * scale, color: textColor, anchor: { x: 0, y: 0.5 } });
    t.position.set(x, alphaY);
    t.alpha = 0;
    root.addChild(t);
    x += (fonts.measure(ch, style) + alphaSize * 0.12) * scale;
    timeline.to(t, { prop: "alpha", from: 0, to: 0.9, start: ALPHA_AT + i * 0.018, duration: 0.28, ease: outQuad });
  });

  // --- The specimen paragraph, wrapped at reading size ---
  const bodySize = Math.round(size.width * L.bodyFrac);
  const measure = (s: string) => fonts.measure(s, { family: fonts.family(role), weight: 400, size: bodySize });
  const lines: string[] = [];
  let cur = "";
  for (const w of specimen.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= colW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const bodyTop = alphaY + alphaSize * 2.2;
  lines.slice(0, 4).forEach((line, i) => {
    const t = makeText(fonts, { text: line, role, weight: 400, size: bodySize, color: textColor, anchor: { x: 0, y: 0.5 } });
    const y = bodyTop + bodySize * 1.55 * (i + 0.5);
    t.position.set(left, y);
    t.alpha = 0;
    root.addChild(t);
    const at = BODY_AT + i * 0.12;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 0.8, start: at, duration: 0.45, ease: outQuad })
      .to(t, { prop: "y", from: y + bodySize * 0.3, to: y, start: at, duration: 0.8, ease: outQuint });
  });

  return { timeline, duration: DURATION };
}

export const typeSpecimen: TemplateDefinition = {
  id: "type-specimen",
  name: "Type Specimen",
  tagline: "One huge glyph, the alphabet stepping across, and a paragraph at reading size.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.8,
  fontRoles: { specimen: "display" },
  palettes: PALETTES,
  fields: [
    { key: "family", type: "text", label: "Family name", default: "Your headline face", maxLength: 34 },
    { key: "weights", type: "text", label: "Weights", default: "Regular · Medium · Bold", maxLength: 34, optional: true },
    { key: "glyph", type: "text", label: "Hero glyph", default: "Aa", maxLength: 3 },
    { key: "alphabet", type: "text", label: "Alphabet", default: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", maxLength: 40 },
    {
      key: "specimen",
      type: "text",
      label: "Specimen text",
      default: "The quick brown fox jumps over the lazy dog, and sets it in one line.",
      maxLength: 200,
    },
    { key: "useSerif", type: "toggle", label: "Set in the serif", default: false },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Type", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

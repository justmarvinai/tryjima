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

// Translation Bar — two captions stacked: the line as spoken, and the line
// translated, with a small language tag on each. It is what every travel,
// interview and dubbed clip needs and what a single subtitle bar cannot do —
// `subtitle-bar` and `karaoke-caption` both carry one language.
//
// The translated line arrives a beat after the original, which is how a viewer
// reads it: hear it, then understand it.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "night", name: "Night", colors: { background: "#0F1014", textColor: "#F5F5F7", accent: "#60A5FA" } },
  { id: "warm", name: "Warm", colors: { background: "#17120E", textColor: "#FAF3E9", accent: "#FBBF24" } },
  { id: "paper", name: "Paper", colors: { background: "#F5F4F0", textColor: "#131418", accent: "#2563EB" } },
  { id: "sea", name: "Sea", colors: { background: "#08191E", textColor: "#E9F6F8", accent: "#2DD4BF" } },
];

interface Layout {
  widthFrac: number;
  bottomFrac: number;
  primaryFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { widthFrac: 0.7, bottomFrac: 0.11, primaryFrac: 0.038 };
    case "9:16":
      return { widthFrac: 0.88, bottomFrac: 0.17, primaryFrac: 0.05 };
    case "4:5":
      return { widthFrac: 0.86, bottomFrac: 0.13, primaryFrac: 0.046 };
    case "1:1":
    default:
      return { widthFrac: 0.86, bottomFrac: 0.12, primaryFrac: 0.046 };
  }
}

const IN_AT = 0.3;
const SECOND_AT = 0.85;
const DURATION = 5.0;

/** Wrap to at most two lines, shrinking rather than growing the bar. */
function fitLines(
  text: string,
  measure: (s: string, size: number) => number,
  size: number,
  maxWidth: number,
): { lines: string[]; size: number } {
  let s = size;
  for (let guard = 0; guard < 14; guard++) {
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (measure(next, s) <= maxWidth || cur === "") cur = next;
      else {
        lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length <= 2) return { lines, size: s };
    s = Math.round(s * 0.93);
  }
  return { lines: [text], size: s };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0F1014"));
  const textColor = str(values.textColor, pc("textColor", "#F5F5F7"));
  const accent = str(values.accent, pc("accent", "#60A5FA"));
  const original = str(values.original, "No sé cómo lo hicimos");
  const translated = str(values.translated, "I don't know how we did it");
  const fromTag = str(values.fromTag, "ES").trim().toUpperCase();
  const toTag = str(values.toTag, "EN").trim().toUpperCase();
  const showTags = on(values.showTags);
  const showBar = on(values.showBar);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const barW = size.width * L.widthFrac;
  const primarySize = Math.round(size.width * L.primaryFrac);
  const secondarySize = Math.round(primarySize * 0.76);
  const tagSize = Math.round(primarySize * 0.42);
  const padX = primarySize * 0.9;
  const padY = primarySize * 0.72;
  const tagCol = showTags ? tagSize * 3.1 : 0;
  const textW = barW - padX * 2 - tagCol;

  const measureBody = (s: string, sz: number) => fonts.measure(s, { family: fonts.family("body"), weight: 600, size: sz });
  const top = fitLines(original, measureBody, primarySize, textW);
  const bottom = fitLines(translated, measureBody, secondarySize, textW);

  const lineGapTop = top.size * 1.24;
  const lineGapBot = bottom.size * 1.26;
  const topH = top.lines.length * lineGapTop;
  const botH = bottom.lines.length * lineGapBot;
  const divGap = primarySize * 0.52;
  const barH = padY * 2 + topH + divGap + botH;
  const barY = size.height - size.height * L.bottomFrac - barH;

  const timeline = new JimaTimeline();
  const group = new Container();
  group.position.set(cx, barY + barH / 2);
  root.addChild(group);

  if (showBar) {
    group.addChild(
      new Graphics()
        .roundRect(-barW / 2, -barH / 2, barW, barH, primarySize * 0.4)
        .fill({ color: bg, alpha: 0.86 })
        .stroke({ color: textColor, width: Math.max(1, size.width * 0.001), alpha: 0.16 }),
    );
  }

  const textLeft = -barW / 2 + padX + tagCol;

  const addTag = (label: string, y: number, filled: boolean): Container => {
    const t = makeText(fonts, {
      text: label,
      role: "body",
      weight: 800,
      size: tagSize,
      color: filled ? bg : accent,
      anchor: 0.5,
      letterSpacing: tagSize * 0.06,
    });
    const w = tagSize * 2.35;
    const h = tagSize * 1.6;
    const chip = new Graphics()
      .roundRect(-w / 2, -h / 2, w, h, h * 0.3)
      .fill(filled ? accent : { color: accent, alpha: 0.12 })
      .stroke({ color: accent, width: Math.max(1, tagSize * 0.08), alpha: filled ? 0 : 0.7 });
    const holder = new Container();
    holder.addChild(chip, t);
    holder.position.set(-barW / 2 + padX + w / 2, y);
    group.addChild(holder);
    return holder;
  };

  // --- Original ---
  const topStart = -barH / 2 + padY;
  const topGroup = new Container();
  group.addChild(topGroup);
  top.lines.forEach((line, i) => {
    const t = makeText(fonts, {
      text: line,
      role: "body",
      weight: 600,
      size: top.size,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    t.position.set(textLeft, topStart + lineGapTop * (i + 0.5));
    topGroup.addChild(t);
  });
  topGroup.alpha = 0;
  timeline
    .to(topGroup, { prop: "alpha", from: 0, to: 1, start: IN_AT, duration: 0.4, ease: outQuad })
    .to(topGroup, { prop: "x", from: -primarySize * 0.3, to: 0, start: IN_AT, duration: 0.75, ease: outExpo });
  if (showTags && fromTag) {
    const tag = addTag(fromTag, topStart + lineGapTop * 0.5, false);
    tag.alpha = 0;
    timeline.to(tag, { prop: "alpha", from: 0, to: 1, start: IN_AT + 0.08, duration: 0.4, ease: outQuad });
  }

  // --- Divider ---
  const divY = topStart + topH + divGap * 0.5;
  const div = new Graphics()
    .rect(-(barW - padX * 2) / 2, -Math.max(1, size.width * 0.0008), barW - padX * 2, Math.max(2, size.width * 0.0016))
    .fill(textColor);
  div.position.set(0, divY);
  div.alpha = 0.16;
  div.scale.x = 0;
  group.addChild(div);
  timeline.to(div, { prop: "scale.x", from: 0, to: 1, start: SECOND_AT - 0.2, duration: 0.6, ease: outExpo });

  // --- Translation ---
  const botStart = topStart + topH + divGap;
  const botGroup = new Container();
  group.addChild(botGroup);
  bottom.lines.forEach((line, i) => {
    const t = makeText(fonts, {
      text: line,
      role: "body",
      weight: 500,
      size: bottom.size,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    t.alpha = 0.82;
    t.position.set(textLeft, botStart + lineGapBot * (i + 0.5));
    botGroup.addChild(t);
  });
  botGroup.alpha = 0;
  timeline
    .to(botGroup, { prop: "alpha", from: 0, to: 1, start: SECOND_AT, duration: 0.45, ease: outQuad })
    .to(botGroup, { prop: "y", from: bottom.size * 0.3, to: 0, start: SECOND_AT, duration: 0.8, ease: outQuint });
  if (showTags && toTag) {
    const tag = addTag(toTag, botStart + lineGapBot * 0.5, true);
    tag.alpha = 0;
    timeline.to(tag, { prop: "alpha", from: 0, to: 1, start: SECOND_AT + 0.08, duration: 0.4, ease: outQuad });
  }

  group.alpha = 0;
  timeline
    .to(group, { prop: "alpha", from: 0, to: 1, start: IN_AT - 0.05, duration: 0.35, ease: outQuad })
    .to(group, { prop: "y", from: barY + barH / 2 + barH * 0.3, to: barY + barH / 2, start: IN_AT - 0.05, duration: 0.8, ease: outExpo });

  return { timeline, duration: DURATION };
}

export const translationBar: TemplateDefinition = {
  id: "translation-bar",
  name: "Translation Bar",
  tagline: "The line as spoken, then the translation a beat later — with language tags.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { original: "body", translated: "body" },
  palettes: PALETTES,
  fields: [
    { key: "original", type: "text", label: "Original line", default: "No sé cómo lo hicimos", maxLength: 90 },
    { key: "translated", type: "text", label: "Translation", default: "I don't know how we did it", maxLength: 90 },
    { key: "fromTag", type: "text", label: "From", default: "ES", maxLength: 5, optional: true },
    { key: "toTag", type: "text", label: "To", default: "EN", maxLength: 5, optional: true },
    { key: "showTags", type: "toggle", label: "Language tags", default: true },
    { key: "showBar", type: "toggle", label: "Bar behind", default: true },
    { key: "background", type: "color", label: "Bar", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Tags", default: "", optional: true },
  ],
  build,
};

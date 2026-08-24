import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  type Aspect,
  type BuiltTemplate,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night-lime", name: "Night lime", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "violet-cream", name: "Violet on cream", colors: { background: "#FAF5EA", textColor: "#3A1D6E", accent: "#7C5CFF" } },
  { id: "ocean", name: "Ocean", colors: { background: "#0B2447", textColor: "#FFFFFF", accent: "#57C4E5" } },
];

/** Greedy-wrap into ≤ maxLines lines, then shrink so the widest line fits. */
function wrapAndFit(
  fonts: TemplateContext["fonts"],
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
  maxLines: number,
): { lines: string[]; size: number } {
  const family = fonts.family(role);
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [""], size: size0 };
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (!cur || measure(next, size0) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur) lines.push(cur);
  let packed = lines;
  if (packed.length > maxLines) {
    packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
  }
  let size = size0;
  for (let guard = 0; guard < 8; guard++) {
    const widest = Math.max(...packed.map((l) => measure(l, size)));
    if (widest <= maxWidth || widest === 0) break;
    size = Math.max(16, Math.floor(size * (maxWidth / widest)));
  }
  return { lines: packed, size };
}

function fontFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.11;
    case "9:16":
      return 0.16;
    case "4:5":
      return 0.145;
    case "1:1":
      return 0.15;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pcol = (key: string, d: string): string => palette.colors[key] ?? d;
  const bg = str(values.background, pcol("background", "#FFFFFF"));
  const textColor = str(values.textColor, pcol("textColor", "#101014"));
  const accent = str(values.accent, pcol("accent", "#FF4D1C"));
  const brand = str(values.brand, "Your Brand");
  const tagline = str(values.tagline, "Motion, made simple.");
  const showTagline = on(values.showTagline);

  const W = size.width;
  const H = size.height;
  const cx = W / 2;
  const cy = H * 0.44;
  const DUR = 4.0;

  // --- Background ---
  const bgRect = new Graphics().rect(-W / 2, -H / 2, W, H).fill(bg);
  bgRect.position.set(W / 2, H / 2);
  bgRect.label = "bg";
  bgRect.scale.set(1.02);
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  timeline
    .to(bgRect, { prop: "scale.x", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(bgRect, { prop: "scale.y", from: 1.02, to: 1, start: 0, duration: 0.4, ease: outQuad });

  // --- Brand wordmark (revealed through a growing circular mask) ---
  const fontSize0 = Math.round(W * fontFrac(ctx.aspect));
  const maxWidth = W * (ctx.aspect === "16:9" ? 0.56 : 0.76);
  const { lines, size: fontSize } = wrapAndFit(fonts, brand, "display", 700, fontSize0, maxWidth, 2);
  const lineHeight = Math.round(fontSize * 1.06);

  const brandText = makeText(fonts, {
    text: lines.join("\n"),
    role: "display",
    weight: 700,
    size: fontSize,
    color: textColor,
    anchor: 0.5,
    align: "center",
    lineHeight,
  });
  brandText.position.set(0, 0);

  const blockW = brandText.width;
  const blockH = brandText.height;
  const R = Math.hypot(blockW / 2, blockH / 2) * 1.22;

  // The expanding accent shape — sits behind the text and grows to "wipe it
  // on"; the text is only visible where the same-sized mask has opened.
  const disc = new Graphics().circle(0, 0, R).fill(accent);
  disc.position.set(cx, cy);
  disc.scale.set(0);
  root.addChild(disc);

  const mask = new Graphics().circle(0, 0, R).fill("#FFFFFF");
  mask.position.set(cx, cy);
  mask.scale.set(0);
  root.addChild(mask);

  const content = new Container();
  content.label = "content";
  content.position.set(cx, cy);
  content.addChild(brandText);
  content.mask = mask;
  root.addChild(content);

  const revealStart = 0.15;
  const revealDur = 0.6;
  timeline
    .to(disc, { prop: "scale.x", from: 0, to: 1, start: revealStart, duration: revealDur, ease: outExpo })
    .to(disc, { prop: "scale.y", from: 0, to: 1, start: revealStart, duration: revealDur, ease: outExpo })
    .to(mask, { prop: "scale.x", from: 0, to: 1, start: revealStart, duration: revealDur, ease: outExpo })
    .to(mask, { prop: "scale.y", from: 0, to: 1, start: revealStart, duration: revealDur, ease: outExpo });

  // The accent shape then fades away, leaving the wordmark plain on the
  // background (guaranteed end-frame contrast from the palette itself).
  const fadeStart = revealStart + revealDur + 0.12;
  const fadeDur = 0.4;
  timeline.to(disc, { prop: "alpha", from: 1, to: 0, start: fadeStart, duration: fadeDur, ease: outQuad });

  // --- Tagline (fades under, once the reveal has settled) ---
  if (showTagline && tagline.length > 0) {
    const tagSize = Math.round(fontSize * 0.26);
    const tagY = cy + blockH / 2 + tagSize * 1.4;
    const tagYFrom = tagY + 14;
    const tagText = makeText(fonts, {
      text: tagline,
      role: "body",
      weight: 500,
      size: tagSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
      letterSpacing: 1,
    });
    tagText.position.set(cx, tagYFrom);
    tagText.alpha = 0;
    root.addChild(tagText);
    const tagStart = fadeStart + fadeDur * 0.4;
    timeline
      .to(tagText, { prop: "alpha", from: 0, to: 1, start: tagStart, duration: 0.5, ease: outQuad })
      .to(tagText, { prop: "y", from: tagYFrom, to: tagY, start: tagStart, duration: 0.55, ease: outQuint });
  }

  return { timeline, duration: DUR };
}

export const logoRevealMask: TemplateDefinition = {
  id: "logo-reveal-mask",
  name: "Logo Reveal",
  tagline: "A brand name wipes on through an expanding accent shape.",
  category: "brand",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { brand: "display", tagline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "brand", type: "text", label: "Brand", default: "Your Brand", maxLength: 24, shrinkToFit: true },
    { key: "tagline", type: "text", label: "Tagline", default: "Motion, made simple.", maxLength: 40, optional: true },
    { key: "showTagline", type: "toggle", label: "Show tagline", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

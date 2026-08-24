import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  makeOutBack,
  safeZone,
  TRANSPARENT_BG,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const DEFAULT_PHRASE = "You are not going to believe this";
const WORD_START = 0.4;
const STAGGER = 0.25;
const POP_DUR = 0.4;
const HOLD = 1.2;

function wordCountOf(values: Values): number {
  const phrase = str(values.phrase, DEFAULT_PHRASE);
  return Math.max(1, phrase.split(/\s+/).filter(Boolean).length);
}

/** Same word count as `layoutWords` (it never drops a word, only wraps lines),
 * so this estimate always matches the timeline actually built. */
function computeDuration(values: Values): number {
  const n = wordCountOf(values);
  return WORD_START + (n - 1) * STAGGER + POP_DUR + HOLD;
}

function maxWidthFrac(aspect: Aspect): number {
  return aspect === "16:9" ? 0.7 : aspect === "9:16" ? 0.86 : 0.82;
}

// A karaoke-style caption: each word pops into its own floating chip, in
// turn, with a brief accent flash as it's "spoken" — centered in the lower
// third. Only the full-frame `bg` rect is tied to the background field
// (defaults to the transparent sentinel so it composites straight onto
// footage); each word's own palette-only `chipBg` surface is the permanent
// legibility surface — the highlight is a brief, toggleable extra on top of
// it, not a replacement for it.
const PALETTES: Palette[] = [
  { id: "midnight", name: "Midnight", colors: { chipBg: "#101014", textColor: "#FFFFFF", accent: "#FFC738" } },
  { id: "paper", name: "Paper", colors: { chipBg: "#FFFFFF", textColor: "#101014", accent: "#2E5BD6" } },
  { id: "violet-night", name: "Violet night", colors: { chipBg: "#241443", textColor: "#F4EEFF", accent: "#FF7CD1" } },
  { id: "forest", name: "Forest", colors: { chipBg: "#0F2A1E", textColor: "#EAF7ED", accent: "#7BE0A6" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const chipBg = pc("chipBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FFC738"));
  const phrase = str(values.phrase, DEFAULT_PHRASE);
  const showHighlight = values.showHighlight !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Fit to <=2 lines (shrink font, then re-wrap) — German-safe. ---
  const maxW = w * maxWidthFrac(ctx.aspect);
  const minFontSize = Math.round(minDim * 0.028);
  let fontSize = Math.round(minDim * 0.056);
  let lineHeight = Math.round(fontSize * 1.5);
  const layout = (fs: number, lh: number, cy: number) =>
    layoutWords(phrase, fonts, { role: "display", weight: 700, fontSize: fs, lineHeight: lh, maxWidth: maxW, align: "center", anchorX: w / 2, centerY: cy });

  let boxes = layout(fontSize, lineHeight, 0);
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let g = 0; g < 10 && lineCount > 2 && fontSize > minFontSize; g++) {
    fontSize = Math.max(minFontSize, Math.round(fontSize * 0.92));
    lineHeight = Math.round(fontSize * 1.5);
    boxes = layout(fontSize, lineHeight, 0);
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  // --- Position the block in the lower third (bottom-anchored; grows upward). ---
  const marginBottom = Math.round(minDim * 0.09);
  const blockH = lineCount * lineHeight;
  const blockBottomY = h - zone.bottom - marginBottom;
  const centerY = blockBottomY - blockH / 2;
  const finalBoxes = layout(fontSize, lineHeight, centerY);

  const padX = Math.round(fontSize * 0.36);
  const padY = Math.round(fontSize * 0.26);

  finalBoxes.forEach((box, i) => {
    const chipW = box.width + padX * 2;
    const chipH = fontSize + padY * 2;
    const start = WORD_START + i * STAGGER;

    const wordC = new Container();
    wordC.position.set(box.cx, box.cy);
    wordC.scale.set(0.5);
    wordC.alpha = 0;
    root.addChild(wordC);

    wordC.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(chipBg));

    const wordText: Text = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
    });
    wordC.addChild(wordText);

    timeline
      .to(wordC, { prop: "alpha", from: 0, to: 1, start, duration: 0.16, ease: outQuad })
      .to(wordC, { prop: "scale.x", from: 0.5, to: 1, start, duration: POP_DUR, ease: makeOutBack(2.4) })
      .to(wordC, { prop: "scale.y", from: 0.5, to: 1, start, duration: POP_DUR, ease: makeOutBack(2.4) });

    // --- Brief accent flash (toggleable): a glow ring pops with the word,
    // then fades — the chip itself (above) stays as the permanent surface. ---
    if (showHighlight) {
      const glowW = chipW + fontSize * 0.22;
      const glowH = chipH + fontSize * 0.22;
      const glow = new Graphics()
        .roundRect(-glowW / 2, -glowH / 2, glowW, glowH, glowH / 2)
        .stroke({ color: accent, width: Math.max(2, fontSize * 0.07) });
      glow.scale.set(0.5);
      glow.alpha = 0;
      wordC.addChild(glow);
      timeline
        .to(glow, { prop: "alpha", from: 0, to: 0.95, start, duration: 0.12, ease: outQuad })
        .to(glow, { prop: "scale.x", from: 0.5, to: 1, start, duration: 0.22, ease: makeOutBack(3) })
        .to(glow, { prop: "scale.y", from: 0.5, to: 1, start, duration: 0.22, ease: makeOutBack(3) })
        .to(glow, { prop: "alpha", from: 0.95, to: 0, start: start + 0.2, duration: 0.35, ease: outQuad });
    }
  });

  const duration = computeDuration(values);
  return { timeline, duration };
}

export const captionPop: TemplateDefinition = {
  id: "caption-pop",
  name: "Caption Pop",
  tagline: "A karaoke-style caption pops word by word with a brief accent flash.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.5,
  estimateDuration: computeDuration,
  fontRoles: { phrase: "display" },
  palettes: PALETTES,
  fields: [
    { key: "phrase", type: "text", label: "Phrase", default: DEFAULT_PHRASE, maxLength: 60, shrinkToFit: true },
    { key: "showHighlight", type: "toggle", label: "Accent flash", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

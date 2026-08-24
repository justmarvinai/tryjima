import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outCubic,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords, type WordBox } from "../shared/words";

// A sentence rises in, then a rotated highlighter "tape" block pops in behind
// ONE emphasized word — landing with a springy overshoot — and that word's
// color shifts the instant the tape lands. Distinct from `marker-highlight`
// (a marker swipes under a whole PHRASE, sweeping in from the left, text
// color unchanged) and `kinetic-type` (a straight, un-rotated pill wipes in
// behind a word with no overshoot and no color transition): here the tape is
// visibly a rotated, slightly-overshooting prop, and the word genuinely
// crossfades color as it lands, rather than being colored that way from frame
// one.

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const on = (v: unknown): boolean => v !== false;
const strip = (s: string): string => s.replace(/^["'“”().,!?;:—–-]+|["'“”().,!?;:—–-]+$/g, "");

// Every palette pairs a dark ink on a light page with a DEEP tape tone (or the
// inverse on a dark page) so the emphasized word's shifted color clears
// 4.5:1 against the tape specifically, not just against the page background.
const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#B0134A", emphasisOn: "#FFFFFF" } },
  { id: "cream-teal", name: "Cream + teal", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#0E6656", emphasisOn: "#FFFFFF" } },
  { id: "blush-plum", name: "Blush + plum", colors: { background: "#FFF0F3", textColor: "#2A0A14", accent: "#5C1A4A", emphasisOn: "#FFFFFF" } },
  { id: "night-lime", name: "Night + lime", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", emphasisOn: "#101014" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
  blockHFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.084, maxWidthFrac: 0.74, centerYFrac: 0.5, blockHFrac: 0.6 };
    case "9:16":
      return { fontFrac: 0.108, maxWidthFrac: 0.84, centerYFrac: 0.45, blockHFrac: 0.5 };
    case "4:5":
      return { fontFrac: 0.1, maxWidthFrac: 0.84, centerYFrac: 0.46, blockHFrac: 0.56 };
    case "1:1":
    default:
      return { fontFrac: 0.098, maxWidthFrac: 0.84, centerYFrac: 0.47, blockHFrac: 0.56 };
  }
}

const DURATION = 3.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#B0134A"));
  const emphasisOn = pc("emphasisOn", "#FFFFFF");
  const text = str(values.text, "This part really matters");
  const emphasisRaw = str(values.emphasis, "part");
  const showTape = on(values.showTape);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.16);
  const relayout = () =>
    layoutWords(text, fonts, {
      role: "display",
      weight: 700,
      fontSize,
      lineHeight,
      maxWidth,
      align: "center",
      anchorX: cx,
      centerY,
    });
  let boxes = relayout();
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lineCount * lineHeight > maxBlockH; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.16);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: DURATION };

  // Which word is emphasized: match `emphasis` (punctuation-stripped, case-
  // insensitive), else fall back to the second word, else the only word.
  const emphKey = strip(emphasisRaw).toLowerCase();
  let emphIndex = emphKey.length > 0 ? boxes.findIndex((b) => strip(b.text).toLowerCase() === emphKey) : -1;
  if (emphIndex < 0) emphIndex = Math.min(1, boxes.length - 1);
  const emphBox: WordBox = boxes[emphIndex]!;

  const content = new Container();
  root.addChild(content);

  const n = boxes.length;
  const stagger = n > 1 ? Math.min(0.14, 1.0 / n) : 0.14;
  const wordStart = 0.3;
  let sentenceDone = wordStart;

  let emphNormal: Text | null = null;
  let emphOn: Text | null = null;

  boxes.forEach((box, i) => {
    const start = wordStart + i * stagger;
    sentenceDone = Math.max(sentenceDone, start + 0.5);

    const base = makeText(fonts, { text: box.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    base.position.set(box.cx, box.cy);
    base.alpha = 0;
    content.addChild(base);
    timeline
      .to(base, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outCubic })
      .to(base, { prop: "y", from: box.cy + fontSize * 0.35, to: box.cy, start, duration: 0.55, ease: outExpo });

    if (i === emphIndex) {
      emphNormal = base;
      // A second, differently-colored copy of the SAME word — gated behind
      // showTape (rule: guard decorative-accent node creation, not just its
      // tweens) — crossfades in once the tape lands, so the word appears to
      // genuinely change color rather than being pre-colored from frame one.
      if (showTape) {
        const onTop = makeText(fonts, { text: box.text, role: "display", weight: 700, size: fontSize, color: emphasisOn, anchor: 0.5 });
        onTop.position.set(box.cx, box.cy);
        onTop.alpha = 0;
        content.addChild(onTop);
        timeline.to(onTop, { prop: "y", from: box.cy + fontSize * 0.35, to: box.cy, start, duration: 0.55, ease: outExpo });
        emphOn = onTop;
      }
    }
  });

  // --- The tape: a rotated, slightly-translucent block slaps down behind the
  // emphasized word with a springy overshoot; the word's color crossfades in
  // sync with the tape landing. ---
  if (showTape) {
    const tapeStart = sentenceDone + 0.15;
    const tapeDur = 0.46;
    const tapeW = emphBox.width + fontSize * 0.44;
    const tapeH = fontSize * 1.05;
    const tape = new Graphics().roundRect(-tapeW / 2, -tapeH / 2, tapeW, tapeH, tapeH * 0.22).fill({ color: accent, alpha: 0.94 });
    tape.rotation = -1.5 * DEG;
    tape.position.set(emphBox.cx, emphBox.cy);
    tape.scale.x = 0;
    content.addChildAt(tape, 0); // behind every word, incl. the emphasized one
    timeline.to(tape, { prop: "scale.x", from: 0, to: 1, start: tapeStart, duration: tapeDur, ease: makeOutBack(2.1) });

    if (emphNormal && emphOn) {
      const crossStart = tapeStart + tapeDur * 0.55;
      const normalNode = emphNormal;
      const onNode = emphOn;
      timeline
        .to(onNode, { prop: "alpha", from: 0, to: 1, start: crossStart, duration: 0.2, ease: outQuad })
        .to(normalNode, { prop: "alpha", from: 1, to: 0, start: crossStart, duration: 0.2, ease: outQuad });
    }
  }

  return { timeline, duration: DURATION };
}

export const tapeHighlight: TemplateDefinition = {
  id: "tape-highlight",
  name: "Tape Highlight",
  tagline: "A highlighter tape slaps down behind one word as its color shifts.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { text: "display" },
  palettes: PALETTES,
  fields: [
    { key: "text", type: "text", label: "Text", default: "This part really matters", maxLength: 60, shrinkToFit: true },
    { key: "emphasis", type: "text", label: "Emphasis word", default: "part", maxLength: 24, optional: true },
    { key: "showTape", type: "toggle", label: "Highlighter tape", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Tape color", default: "", optional: true },
  ],
  build,
};

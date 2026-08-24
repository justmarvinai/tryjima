import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outCubic,
  outExpo,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

// Each word unfolds upward from a fixed baseline: anchored at its own bottom
// edge (anchor {x:0.5,y:1}), scaleY runs 0 -> overshoot -> 1 via makeOutBack,
// while its POSITION never moves. That "grows from a fixed line" mechanic is
// what sets this apart from `flip-words` (which drops the whole glyph in from
// above on a clean, non-overshooting outExpo squash) — here nothing moves but
// the unfolding itself, and the motion springs past 1 before settling.

const str = (v: unknown, fallback: string): string => (typeof v === "string" && v.length > 0 ? v : fallback);
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
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
      return { fontFrac: 0.09, maxWidthFrac: 0.76, centerYFrac: 0.48, blockHFrac: 0.6 };
    case "9:16":
      return { fontFrac: 0.112, maxWidthFrac: 0.84, centerYFrac: 0.45, blockHFrac: 0.52 };
    case "4:5":
      return { fontFrac: 0.102, maxWidthFrac: 0.84, centerYFrac: 0.46, blockHFrac: 0.58 };
    case "1:1":
    default:
      return { fontFrac: 0.1, maxWidthFrac: 0.84, centerYFrac: 0.47, blockHFrac: 0.58 };
  }
}

const WORD_DUR = 0.62;
const POP = makeOutBack(1.8);
const DURATION_FLOOR = 3.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const headline = str(values.headline, "Watch this unfold");
  const subline = str(values.subline, "");
  const showBaseline = on(values.showBaseline);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.3);
  const relayout = () =>
    layoutWords(headline, fonts, {
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
    lineHeight = Math.round(fontSize * 1.3);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: DURATION_FLOOR };

  const content = new Container();
  root.addChild(content);

  // Group words by line so each line gets its own baseline rule + stagger.
  const lineIndices = [...new Set(boxes.map((b) => b.line))].sort((a, b) => a - b);
  const lineCursor = new Map<number, number>();

  let maxEnd = 0;
  lineIndices.forEach((li, lineOrder) => {
    const lineBoxes = boxes.filter((b) => b.line === li);
    const baseline = lineBoxes[0]!.cy + fontSize / 2;
    const lx0 = Math.min(...lineBoxes.map((b) => b.cx - b.width / 2));
    const lx1 = Math.max(...lineBoxes.map((b) => b.cx + b.width / 2));
    const ruleStart = 0.15 + lineOrder * 0.12;

    // A thin "ground line" draws in first, establishing the fixed baseline the
    // words will sprout from — decorative, so it is gated by its own toggle.
    if (showBaseline) {
      const ruleH = Math.max(2, Math.round(fontSize * 0.045));
      const ruleW = lx1 - lx0 + fontSize * 0.2;
      const rule = new Graphics().roundRect(-ruleW / 2, 0, ruleW, ruleH, ruleH / 2).fill(accent);
      rule.position.set((lx0 + lx1) / 2, baseline + fontSize * 0.14);
      rule.scale.x = 0;
      content.addChild(rule);
      timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: ruleStart, duration: 0.32, ease: outExpo });
    }

    const wordStartBase = ruleStart + 0.16;
    lineBoxes.forEach((box) => {
      const col = lineCursor.get(li) ?? 0;
      lineCursor.set(li, col + 1);
      const start = wordStartBase + col * 0.09;

      // Anchored at its own bottom edge and pinned there for good — only
      // scale.y ever moves, so the glyph reads as unfolding out of the line.
      const t = makeText(fonts, {
        text: box.text,
        role: "display",
        weight: 700,
        size: fontSize,
        color: textColor,
        anchor: { x: 0.5, y: 1 },
      });
      t.position.set(box.cx, baseline);
      t.alpha = 0;
      t.scale.set(1, 0);
      content.addChild(t);

      timeline
        .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.22, ease: outCubic })
        .to(t, { prop: "scale.y", from: 0, to: 1, start, duration: WORD_DUR, ease: POP });
      maxEnd = Math.max(maxEnd, start + WORD_DUR);
    });
  });

  // --- Optional subline settles in once every word has landed ---
  let end = maxEnd;
  if (subline.length > 0) {
    const bottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.9;
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 500,
      size: Math.round(fontSize * 0.26),
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    sub.position.set(cx, bottom);
    sub.alpha = 0;
    content.addChild(sub);
    const subStart = maxEnd + 0.05;
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.85, start: subStart, duration: 0.6, ease: outCubic })
      .to(sub, { prop: "y", from: bottom + fontSize * 0.2, to: bottom, start: subStart, duration: 0.7, ease: outQuint });
    end = subStart + 0.7;
  }

  return { timeline, duration: Math.max(DURATION_FLOOR, end + 1.2) };
}

export const stretchIn: TemplateDefinition = {
  id: "stretch-in",
  name: "Stretch In",
  tagline: "Each word unfolds upward from its baseline with a springy overshoot.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.4,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Watch this unfold", maxLength: 44, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Smooth, springy, done", maxLength: 70, optional: true },
    { key: "showBaseline", type: "toggle", label: "Baseline rule", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

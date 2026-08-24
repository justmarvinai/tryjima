import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outBack,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

// Strip surrounding punctuation so "move" matches "move," / "move." etc.
const strip = (s: string): string =>
  s.replace(/^["'“”().,!?;:—–-]+|["'“”().,!?;:—–-]+$/g, "");

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", onAccent: "#101014" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", onAccent: "#101014" } },
  { id: "violet-cream", name: "Violet on cream", colors: { background: "#FAF5EA", textColor: "#3A1D6E", accent: "#7C5CFF", onAccent: "#FFFFFF" } },
  { id: "berry", name: "Berry", colors: { background: "#1A0A14", textColor: "#FFFFFF", accent: "#FF2E9E", onAccent: "#1A0A14" } },
];

interface AspectLayout {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
  blockHFrac: number;
}

function aspectLayout(aspect: Aspect): AspectLayout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.092, maxWidthFrac: 0.74, centerYFrac: 0.5, blockHFrac: 0.72 };
    case "1:1":
      return { fontFrac: 0.12, maxWidthFrac: 0.84, centerYFrac: 0.48, blockHFrac: 0.68 };
    case "4:5":
      return { fontFrac: 0.115, maxWidthFrac: 0.84, centerYFrac: 0.47, blockHFrac: 0.68 };
    case "9:16":
      return { fontFrac: 0.115, maxWidthFrac: 0.82, centerYFrac: 0.45, blockHFrac: 0.6 };
  }
}

const DURATION = 3.8;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#101014");
  const text = str(values.text, "Make every post move");
  const emph = strip(str(values.emphasisWord, "")).toLowerCase();

  const L = aspectLayout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  // --- Background ---
  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  // --- Fit the headline block vertically (shrink font if it would overflow) ---
  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.02);
  let boxes = layoutWords(text, fonts, {
    role: "display",
    weight: 700,
    fontSize,
    lineHeight,
    maxWidth,
    align: "center",
    anchorX: cx,
    centerY,
  });
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lineCount * lineHeight > maxBlockH; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.02);
    boxes = layoutWords(text, fonts, {
      role: "display",
      weight: 700,
      fontSize,
      lineHeight,
      maxWidth,
      align: "center",
      anchorX: cx,
      centerY,
    });
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  // Content container breathes about the block center at the end.
  const content = new Container();
  content.position.set(cx, centerY);
  content.pivot.set(cx, centerY);
  root.addChild(content);

  const timeline = new JimaTimeline();

  // Adaptive stagger so even a long headline finishes entering by ~3.3s.
  const n = boxes.length;
  const wordStart = 0.3;
  const stagger = n > 1 ? Math.min(0.16, (3.3 - wordStart - 0.5) / (n - 1)) : 0.16;

  boxes.forEach((box, i) => {
    const start = wordStart + i * stagger;
    const isEmph = emph.length > 0 && strip(box.text).toLowerCase() === emph;

    // Accent highlight box behind an emphasised word (wipes in just before it).
    if (isEmph) {
      const bw = box.width + fontSize * 0.28;
      const bh = fontSize * 1.06;
      const hl = new Graphics().roundRect(-bw / 2, -bh / 2, bw, bh, bh * 0.22).fill(accent);
      hl.position.set(box.cx, box.cy);
      hl.scale.x = 0;
      content.addChild(hl);
      timeline.to(hl, { prop: "scale.x", from: 0, to: 1, start: Math.max(0, start - 0.18), duration: 0.42, ease: outExpo });
    }

    const t = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 700,
      size: fontSize,
      color: isEmph ? onAccent : textColor,
      anchor: 0.5,
    });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    content.addChild(t);

    timeline.to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad });
    if (i % 2 === 0) {
      // Scale-pop.
      timeline
        .to(t, { prop: "scale.x", from: 0.5, to: 1, start, duration: 0.5, ease: outBack })
        .to(t, { prop: "scale.y", from: 0.5, to: 1, start, duration: 0.5, ease: outBack });
    } else {
      // Slide-up.
      const off = fontSize * 0.5;
      timeline.to(t, { prop: "y", from: box.cy + off, to: box.cy, start, duration: 0.5, ease: outExpo });
    }
  });

  // Whole-block breathe once everything is in.
  timeline
    .to(content, { prop: "scale.x", from: 1, to: 1.02, start: 1.7, duration: 0.6, ease: outQuad })
    .to(content, { prop: "scale.y", from: 1, to: 1.02, start: 1.7, duration: 0.6, ease: outQuad })
    .to(content, { prop: "scale.x", from: 1.02, to: 1, start: 2.4, duration: 0.8, ease: outQuad })
    .to(content, { prop: "scale.y", from: 1.02, to: 1, start: 2.4, duration: 0.8, ease: outQuad });

  return { timeline, duration: DURATION };
}

export const kineticType: TemplateDefinition = {
  id: "kinetic-type",
  name: "Kinetic Type",
  tagline: "Bold word-by-word kinetic type with a highlighted keyword.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { text: "display" },
  palettes: PALETTES,
  fields: [
    { key: "text", type: "text", label: "Text", default: "Make every post move", maxLength: 90, shrinkToFit: true },
    { key: "emphasisWord", type: "text", label: "Emphasis word", default: "move", maxLength: 20, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

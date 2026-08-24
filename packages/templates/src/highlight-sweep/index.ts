import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outBack,
  inOutCubic,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

// A "highlighter" accent only reads well over a light backdrop with dark ink —
// the marker bar sweeps in BEHIND the payoff line, so the text sits on top of
// it at the end frame. Every palette here keeps light bg + dark text + a
// bright/pastel highlight so that pairing clears 4.5:1 either way.
const PALETTES: Palette[] = [
  { id: "lime", name: "Lime marker", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#D8F34D" } },
  { id: "amber", name: "Amber marker", colors: { background: "#FAF5EA", textColor: "#1A1206", accent: "#FFD23F" } },
  { id: "sky", name: "Sky marker", colors: { background: "#FFFFFF", textColor: "#0A1522", accent: "#8FD9FF" } },
  { id: "blush", name: "Blush marker", colors: { background: "#FFF0F3", textColor: "#2A0A14", accent: "#FFB3CB" } },
];

interface Layout {
  align: "left" | "center";
  fontFrac: number;
  maxWidthFrac: number;
  anchorXFrac: number;
  centerYFrac: number;
  blockHFrac: number;
}

function aspectLayout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { align: "left", fontFrac: 0.078, maxWidthFrac: 0.64, anchorXFrac: 0.08, centerYFrac: 0.46, blockHFrac: 0.62 };
    case "1:1":
      return { align: "center", fontFrac: 0.092, maxWidthFrac: 0.82, anchorXFrac: 0.5, centerYFrac: 0.46, blockHFrac: 0.62 };
    case "4:5":
      return { align: "center", fontFrac: 0.096, maxWidthFrac: 0.82, anchorXFrac: 0.5, centerYFrac: 0.45, blockHFrac: 0.6 };
    case "9:16":
      return { align: "center", fontFrac: 0.1, maxWidthFrac: 0.84, anchorXFrac: 0.5, centerYFrac: 0.44, blockHFrac: 0.52 };
  }
}

const DUR = 4.5;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#D8F34D"));
  const headline = str(values.headline, "Great ideas deserve a big entrance");
  const showHighlight = on(values.showHighlight);

  const L = aspectLayout(ctx.aspect);
  const anchorX = L.align === "left" ? size.width * L.anchorXFrac : size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  // Shrink-to-fit: wrap, then shrink the font until the block fits the
  // vertical band (German text runs ~30% longer than English).
  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.14);
  const relayout = () =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 700,
      fontSize,
      lineHeight,
      maxWidth,
      align: L.align,
      anchorX,
      centerY,
    });
  let boxes = relayout();
  let lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  for (let guard = 0; guard < 8 && lineCount * lineHeight > maxBlockH; guard++) {
    fontSize = Math.round(fontSize * 0.9);
    lineHeight = Math.round(fontSize * 1.14);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const hlLayer = new Container();
  const textLayer = new Container();
  hlLayer.label = "highlight";
  textLayer.label = "headline";
  root.addChild(hlLayer);
  root.addChild(textLayer);

  const timeline = new JimaTimeline();
  const lastLine = lineCount - 1;
  const wordsDone = 0.3 + Math.max(0, lineCount - 1) * 0.34 + 0.5;
  const hlStart = wordsDone + 0.2;
  const popStart = hlStart + 0.45;

  const lineCursor = new Map<number, number>();
  boxes.forEach((box) => {
    const col = lineCursor.get(box.line) ?? 0;
    lineCursor.set(box.line, col + 1);
    const start = 0.3 + box.line * 0.34 + col * 0.05;
    const isLast = box.line === lastLine;

    const t = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
    });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    textLayer.addChild(t);
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.42, ease: outQuad })
      .to(t, { prop: "y", from: box.cy + fontSize * 0.4, to: box.cy, start, duration: 0.55, ease: outExpo });

    // The emphasized (last) line gets a small pop as the highlight lands.
    if (isLast && showHighlight) {
      timeline
        .to(t, { prop: "scale.x", from: 1, to: 1.06, start: popStart, duration: 0.2, ease: outBack })
        .to(t, { prop: "scale.y", from: 1, to: 1.06, start: popStart, duration: 0.2, ease: outBack })
        .to(t, { prop: "scale.x", from: 1.06, to: 1, start: popStart + 0.2, duration: 0.36, ease: inOutCubic })
        .to(t, { prop: "scale.y", from: 1.06, to: 1, start: popStart + 0.2, duration: 0.36, ease: inOutCubic });
    }
  });

  // Marker-style highlight bar, sweeping left -> right BEHIND the last line.
  if (showHighlight) {
    const lastBoxes = boxes.filter((b) => b.line === lastLine);
    if (lastBoxes.length > 0) {
      const minX = Math.min(...lastBoxes.map((b) => b.cx - b.width / 2)) - fontSize * 0.14;
      const maxX = Math.max(...lastBoxes.map((b) => b.cx + b.width / 2)) + fontSize * 0.14;
      const cyLast = lastBoxes[0]!.cy;
      const hlH = lineHeight * 0.86;
      const hlW = maxX - minX;
      const bar = new Graphics().roundRect(0, -hlH / 2, hlW, hlH, hlH * 0.18).fill(accent);
      bar.position.set(minX, cyLast); // pivot at the left edge -> sweeps rightward
      bar.scale.x = 0;
      hlLayer.addChild(bar);
      timeline.to(bar, { prop: "scale.x", from: 0, to: 1, start: hlStart, duration: 0.55, ease: outExpo });
    }
  }

  return { timeline, duration: DUR };
}

export const highlightSweep: TemplateDefinition = {
  id: "highlight-sweep",
  name: "Highlight Sweep",
  tagline: "A headline rises in, then a marker highlight sweeps under the payoff line.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { headline: "display" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Great ideas deserve a big entrance", maxLength: 70, shrinkToFit: true },
    { key: "showHighlight", type: "toggle", label: "Highlight sweep", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Highlight", default: "", optional: true },
  ],
  build,
};

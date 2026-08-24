import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const DEG = Math.PI / 180;

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const strip = (s: string): string =>
  s.replace(/^["'“”().,!?;:—–-]+|["'“”().,!?;:—–-]+$/g, "");

// Dark text sits on light accent highlights (kept ≥ 4.5:1 on every palette).
const PALETTES: Palette[] = [
  { id: "lime", name: "Lime marker", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#D8F34D" } },
  { id: "amber", name: "Amber marker", colors: { background: "#FAF5EA", textColor: "#1A1206", accent: "#FFD23F" } },
  { id: "ember", name: "Ember marker", colors: { background: "#FFF3EE", textColor: "#1A0A06", accent: "#FF4D1C" } },
  { id: "sky", name: "Sky marker", colors: { background: "#FFFFFF", textColor: "#0A1522", accent: "#8FD9FF" } },
];

interface AspectLayout {
  align: "left" | "center";
  fontFrac: number;
  maxWidthFrac: number;
  anchorXFrac: number;
  centerYFrac: number;
  blockHFrac: number;
}

function aspectLayout(aspect: Aspect): AspectLayout {
  switch (aspect) {
    case "16:9":
      return { align: "left", fontFrac: 0.072, maxWidthFrac: 0.62, anchorXFrac: 0.08, centerYFrac: 0.46, blockHFrac: 0.66 };
    case "1:1":
      return { align: "center", fontFrac: 0.088, maxWidthFrac: 0.84, anchorXFrac: 0.5, centerYFrac: 0.46, blockHFrac: 0.66 };
    case "4:5":
      return { align: "left", fontFrac: 0.088, maxWidthFrac: 0.82, anchorXFrac: 0.09, centerYFrac: 0.46, blockHFrac: 0.66 };
    case "9:16":
      return { align: "left", fontFrac: 0.092, maxWidthFrac: 0.84, anchorXFrac: 0.08, centerYFrac: 0.45, blockHFrac: 0.58 };
  }
}

const DURATION = 4.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#D8F34D"));
  const text = str(values.text, "Great posts start with great motion");
  const highlight = str(values.highlightText, "");

  const L = aspectLayout(ctx.aspect);
  const cx = size.width / 2;
  const anchorX = L.align === "left" ? size.width * L.anchorXFrac : cx;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  // --- Editorial statement, weight 700, fit into 2–4-ish lines ---
  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.12);
  const relayout = () =>
    layoutWords(text, fonts, {
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
    lineHeight = Math.round(fontSize * 1.12);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  // Highlight sits behind the text.
  const hlLayer = new Container();
  const textLayer = new Container();
  root.addChild(hlLayer);
  root.addChild(textLayer);

  const timeline = new JimaTimeline();

  // --- Find the contiguous run of words matching the highlight phrase ---
  const tokens = highlight
    .toLowerCase()
    .split(/\s+/)
    .map(strip)
    .filter(Boolean);
  const normBoxes = boxes.map((b) => strip(b.text).toLowerCase());
  let runStart = -1;
  if (tokens.length > 0) {
    for (let i = 0; i + tokens.length <= boxes.length; i++) {
      let ok = true;
      for (let j = 0; j < tokens.length; j++) {
        if (normBoxes[i + j] !== tokens[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        runStart = i;
        break;
      }
    }
  }
  const runEnd = runStart >= 0 ? runStart + tokens.length : -1;
  const isRun = (i: number): boolean => runStart >= 0 && i >= runStart && i < runEnd;

  const numLines = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  const wordsDone = 0.3 + Math.max(0, numLines - 1) * 0.35 + 0.5;
  const hlStart = wordsDone + 0.2;
  const popStart = hlStart + 0.45;

  // --- Words fade + rise, line by line ---
  const lineCursor = new Map<number, number>();
  boxes.forEach((box, i) => {
    const col = lineCursor.get(box.line) ?? 0;
    lineCursor.set(box.line, col + 1);
    const start = 0.3 + box.line * 0.35 + col * 0.05;
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
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(t, { prop: "y", from: box.cy + fontSize * 0.35, to: box.cy, start, duration: 0.55, ease: outExpo });

    // Highlighted words get a small emphasis pop as the marker lands.
    if (isRun(i)) {
      timeline
        .to(t, { prop: "scale.x", from: 1, to: 1.05, start: popStart, duration: 0.18, ease: outQuad })
        .to(t, { prop: "scale.y", from: 1, to: 1.05, start: popStart, duration: 0.18, ease: outQuad })
        .to(t, { prop: "scale.x", from: 1.05, to: 1, start: popStart + 0.18, duration: 0.34, ease: outQuad })
        .to(t, { prop: "scale.y", from: 1.05, to: 1, start: popStart + 0.18, duration: 0.34, ease: outQuad });
    }
  });

  // --- Marker highlight swipe(s) behind the matched phrase (one per line) ---
  if (runStart >= 0) {
    const runBoxes = boxes.slice(runStart, runEnd);
    const byLine = new Map<number, typeof boxes>();
    for (const b of runBoxes) {
      const arr = byLine.get(b.line) ?? [];
      arr.push(b);
      byLine.set(b.line, arr);
    }
    const hlHeight = lineHeight * 0.9;
    let li = 0;
    for (const lineBoxes of byLine.values()) {
      const minX = Math.min(...lineBoxes.map((b) => b.cx - b.width / 2)) - fontSize * 0.12;
      const maxX = Math.max(...lineBoxes.map((b) => b.cx + b.width / 2)) + fontSize * 0.12;
      const cyL = lineBoxes[0]!.cy;
      const w = maxX - minX;
      const g = new Graphics().roundRect(0, -hlHeight / 2, w, hlHeight, hlHeight * 0.16).fill(accent);
      g.position.set(minX, cyL); // pivot at left-centre → swipes rightward
      g.rotation = -1.5 * DEG;
      g.scale.x = 0;
      hlLayer.addChild(g);
      timeline.to(g, { prop: "scale.x", from: 0, to: 1, start: hlStart + li * 0.12, duration: 0.55, ease: outExpo });
      li++;
    }
  }

  return { timeline, duration: DURATION };
}

export const markerHighlight: TemplateDefinition = {
  id: "marker-highlight",
  name: "Marker Highlight",
  tagline: "An editorial line with a hand-drawn marker swipe on the key phrase.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.8,
  fontRoles: { text: "display" },
  palettes: PALETTES,
  fields: [
    { key: "text", type: "text", label: "Text", default: "Great posts start with great motion", maxLength: 110, shrinkToFit: true },
    { key: "highlightText", type: "text", label: "Highlight phrase", default: "great motion", maxLength: 40, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Highlight", default: "", optional: true },
  ],
  build,
};

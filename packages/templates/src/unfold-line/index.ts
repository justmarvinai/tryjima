import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  shrinkToFit,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

// Unfold — a hairline rule draws itself across the empty frame first, and only
// then does the headline unfold upward out of that line (scale.y from 0 about
// the rule, which never moves), followed by a caption fading in beneath it.
// The opposite order to `underline-grow`, where the text arrives first and a bar
// grows under it: here the line is the origin the type is made of.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "bone", name: "Bone", colors: { background: "#F8F7F4", textColor: "#16181B", accent: "#B0432E" } },
  { id: "slate", name: "Slate", colors: { background: "#15171B", textColor: "#F4F3EF", accent: "#7FD3C0" } },
  { id: "sand", name: "Sand", colors: { background: "#F0E9DE", textColor: "#23201A", accent: "#8C5A24" } },
  { id: "indigo-mist", name: "Indigo mist", colors: { background: "#E8EBF2", textColor: "#121724", accent: "#2A4CC4" } },
];

interface Layout {
  fontFrac: number;
  maxWidthFrac: number;
  centerFrac: number;
  blockHFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.078, maxWidthFrac: 0.7, centerFrac: 0.44, blockHFrac: 0.42 };
    case "9:16":
      return { fontFrac: 0.098, maxWidthFrac: 0.82, centerFrac: 0.45, blockHFrac: 0.38 };
    case "4:5":
      return { fontFrac: 0.092, maxWidthFrac: 0.8, centerFrac: 0.44, blockHFrac: 0.4 };
    case "1:1":
    default:
      return { fontFrac: 0.094, maxWidthFrac: 0.8, centerFrac: 0.44, blockHFrac: 0.42 };
  }
}

const RULE_START = 0.35;
const RULE_DUR = 0.8;
const UNFOLD_START = 0.9;
const UNFOLD_DUR = 1.05;
const EDGE_START = 1.35;
const SUB_START = 1.9;
const DURATION = 4.3;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F8F7F4"));
  const textColor = str(values.textColor, pc("textColor", "#16181B"));
  const accent = str(values.accent, pc("accent", "#B0432E"));
  const headline = str(values.headline, "Everything starts as a line");
  const subline = str(values.subline, "").trim();
  const showTicks = on(values.showTicks);
  const showEdgeLine = on(values.showEdgeLine);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.14);
  const relayout = () =>
    layoutWords(headline, fonts, {
      role: "display",
      weight: 600,
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
    lineHeight = Math.round(fontSize * 1.14);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: DURATION };

  const blockLeft = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const blockRight = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const blockCx = (blockLeft + blockRight) / 2;
  const creaseY = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.62;

  // --- The crease: drawn first, from the centre outward, and never moved again ---
  const ruleW = Math.min(Math.max(blockRight - blockLeft, size.width * 0.3) + fontSize * 0.3, maxWidth);
  const ruleH = Math.max(2, Math.round(size.width * 0.0022));
  const rule = new Graphics().roundRect(-ruleW / 2, -ruleH / 2, ruleW, ruleH, ruleH / 2).fill(accent);
  rule.position.set(cx, creaseY);
  rule.scale.x = 0;
  root.addChild(rule);
  timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: RULE_START, duration: RULE_DUR, ease: outExpo });

  // --- The headline unfolds upward out of the crease ---
  const fold = new Container();
  fold.label = "headline";
  fold.pivot.set(blockCx, creaseY);
  fold.position.set(blockCx, creaseY);
  fold.scale.set(0.985, 0);
  fold.alpha = 0;
  root.addChild(fold);

  for (const box of boxes) {
    const t = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 600,
      size: fontSize,
      color: textColor,
      anchor: 0.5,
      letterSpacing: -fontSize * 0.01,
    });
    t.position.set(box.cx, box.cy);
    fold.addChild(t);
  }

  timeline
    .to(fold, { prop: "scale.y", from: 0, to: 1, start: UNFOLD_START, duration: UNFOLD_DUR, ease: outQuint })
    .to(fold, { prop: "scale.x", from: 0.985, to: 1, start: UNFOLD_START, duration: UNFOLD_DUR, ease: outQuint })
    .to(fold, { prop: "alpha", from: 0, to: 1, start: UNFOLD_START, duration: 0.4, ease: outQuad });

  // --- Tick marks pin the crease down at both ends ---
  if (showTicks) {
    const tickH = Math.max(6, Math.round(fontSize * 0.22));
    for (const dir of [-1, 1]) {
      const tick = new Graphics()
        .roundRect(-ruleH / 2, -tickH / 2, ruleH, tickH, ruleH / 2)
        .fill(accent);
      tick.position.set(cx + (dir * ruleW) / 2, creaseY);
      tick.alpha = 0;
      tick.scale.y = 0.3;
      root.addChild(tick);
      timeline
        .to(tick, { prop: "alpha", from: 0, to: 1, start: RULE_START + RULE_DUR * 0.75, duration: 0.4, ease: outQuad })
        .to(tick, { prop: "scale.y", from: 0.3, to: 1, start: RULE_START + RULE_DUR * 0.75, duration: 0.65, ease: outExpo });
    }
  }

  // --- A second, quieter hairline just under the crease: the page edge ---
  const edgeY = creaseY + fontSize * 0.18;
  if (showEdgeLine) {
    const edgeW = ruleW * 0.52;
    const edgeH = Math.max(1, Math.round(size.width * 0.0012));
    const edge = new Graphics().roundRect(-edgeW / 2, -edgeH / 2, edgeW, edgeH, edgeH / 2).fill(textColor);
    edge.position.set(cx, edgeY);
    edge.alpha = 0;
    edge.scale.x = 0;
    root.addChild(edge);
    timeline
      .to(edge, { prop: "alpha", from: 0, to: 0.28, start: EDGE_START, duration: 0.45, ease: outQuad })
      .to(edge, { prop: "scale.x", from: 0, to: 1, start: EDGE_START, duration: 0.75, ease: outExpo });
  }

  // --- Caption fades in under the fold ---
  if (subline.length > 0) {
    const family = fonts.family("body");
    const base = Math.round(fontSize * 0.28);
    const subSize = shrinkToFit(
      subline,
      (s, sz) => fonts.measure(s, { family, weight: 400, size: sz }),
      { maxWidth, baseSize: base, minSize: Math.round(base * 0.55) },
    );
    const subY = edgeY + fontSize * 0.6;
    const sub = makeText(fonts, {
      text: subline,
      role: "body",
      weight: 400,
      size: subSize,
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    sub.position.set(cx, subY);
    sub.alpha = 0;
    root.addChild(sub);
    timeline
      .to(sub, { prop: "alpha", from: 0, to: 0.72, start: SUB_START, duration: 0.75, ease: outQuad })
      .to(sub, { prop: "y", from: subY + fontSize * 0.14, to: subY, start: SUB_START, duration: 0.85, ease: outQuint });
  }

  return { timeline, duration: DURATION };
}

export const unfoldLine: TemplateDefinition = {
  id: "unfold-line",
  name: "Unfold",
  tagline: "A hairline draws across, then the headline unfolds upward out of it.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.5,
  fontRoles: { headline: "display", subline: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Everything starts as a line", maxLength: 52, shrinkToFit: true },
    { key: "subline", type: "text", label: "Subline", default: "Then it unfolds", maxLength: 70, optional: true },
    { key: "showTicks", type: "toggle", label: "End ticks", default: true },
    { key: "showEdgeLine", type: "toggle", label: "Second hairline", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

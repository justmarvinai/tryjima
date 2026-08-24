import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outCubic,
  outExpo,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

// --- Deterministic hex helpers (pure) — blend accentA -> accentB per word.
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full.length === 6 ? full : "000000", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const toHex = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `#${toHex(ca.r + (cb.r - ca.r) * t)}${toHex(ca.g + (cb.g - ca.g) * t)}${toHex(ca.b + (cb.b - ca.b) * t)}`;
}

// Every accentA/accentB pair here clears 4.5:1 against its own background at
// every blend stop (0%, 25%, 50%, 75%, 100%) — verified, not eyeballed.
const PALETTES: Palette[] = [
  { id: "sunset", name: "Sunset", colors: { background: "#FFFFFF", textColor: "#101014", accentA: "#C4340B", accentB: "#3423A6" } },
  { id: "night-aurora", name: "Night aurora", colors: { background: "#101014", textColor: "#FFFFFF", accentA: "#22D3EE", accentB: "#A855F7" } },
  { id: "citrus", name: "Citrus", colors: { background: "#FAF5EA", textColor: "#1A1512", accentA: "#A83E00", accentB: "#B0134A" } },
  { id: "deep-ocean", name: "Deep ocean", colors: { background: "#08111F", textColor: "#EAF2FF", accentA: "#38BDF8", accentB: "#34D399" } },
];

interface L {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
  blockHFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.082, maxWidthFrac: 0.78, centerYFrac: 0.48, blockHFrac: 0.58 };
    case "9:16":
      return { fontFrac: 0.1, maxWidthFrac: 0.86, centerYFrac: 0.44, blockHFrac: 0.5 };
    case "4:5":
      return { fontFrac: 0.096, maxWidthFrac: 0.84, centerYFrac: 0.45, blockHFrac: 0.58 };
    case "1:1":
    default:
      return { fontFrac: 0.096, maxWidthFrac: 0.84, centerYFrac: 0.46, blockHFrac: 0.56 };
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accentA = str(values.accentA, pc("accentA", "#C4340B"));
  const accentB = str(values.accentB, pc("accentB", "#3423A6"));
  const headline = str(values.headline, "Add some color");
  const showUnderline = values.showUnderline !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  // Fit the headline vertically — shrink if it wraps to too many lines.
  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.14);
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
    lineHeight = Math.round(fontSize * 1.14);
    boxes = relayout();
    lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  }

  const timeline = new JimaTimeline();
  if (boxes.length === 0) return { timeline, duration: 4.5 };

  const left = Math.min(...boxes.map((b) => b.cx - b.width / 2));
  const right = Math.max(...boxes.map((b) => b.cx + b.width / 2));
  const top = Math.min(...boxes.map((b) => b.cy)) - fontSize * 0.75;
  const bottom = Math.max(...boxes.map((b) => b.cy)) + fontSize * 0.75;
  const spanX = Math.max(1, right - left);

  const baseLayer = new Container();
  const gradLayer = new Container();
  root.addChild(baseLayer);
  root.addChild(gradLayer);

  // --- Base copy (neutral textColor): words rise in first, per spec ---
  const numWords = boxes.length;
  boxes.forEach((b, i) => {
    const base = makeText(fonts, { text: b.text, role: "display", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
    base.position.set(b.cx, b.cy + fontSize * 0.3);
    base.alpha = 0;
    baseLayer.addChild(base);
    const start = 0.25 + i * 0.05;
    timeline
      .to(base, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(base, { prop: "y", from: b.cy + fontSize * 0.3, to: b.cy, start, duration: 0.55, ease: outExpo });

    // --- Gradient copy: same word, tinted by its horizontal position ---
    const frac = (b.cx - left) / spanX;
    const color = mixHex(accentA, accentB, Math.min(1, Math.max(0, frac)));
    const grad = makeText(fonts, { text: b.text, role: "display", weight: 700, size: fontSize, color, anchor: 0.5 });
    grad.position.set(b.cx, b.cy);
    gradLayer.addChild(grad);
  });
  const wordsDone = 0.25 + Math.max(0, numWords - 1) * 0.05 + 0.55;

  // The gradient layer sits on top of the base layer, revealed left -> right by
  // a growing mask — the accent gradient "sweeps across the letters" once and
  // then stays (the base neutral copy is fully occluded once the mask completes).
  const pad = fontSize * 0.4;
  const maskW = spanX + pad * 2;
  const maskH = bottom - top + pad * 2;
  const sweepMask = new Graphics().rect(0, 0, maskW, maskH).fill("#FFFFFF");
  sweepMask.position.set(left - pad, top - pad);
  sweepMask.scale.set(0, 1);
  root.addChild(sweepMask);
  gradLayer.mask = sweepMask;

  const gradientStart = wordsDone + 0.15;
  const gradientDur = 0.9;
  timeline.to(sweepMask, { prop: "scale.x", from: 0, to: 1, start: gradientStart, duration: gradientDur, ease: outCubic });

  // --- Optional accent underline under the last line ---
  let settleEnd = gradientStart + gradientDur;
  if (showUnderline) {
    const lastLine = Math.max(...boxes.map((b) => b.line));
    const lastLineBoxes = boxes.filter((b) => b.line === lastLine);
    const ulX0 = Math.min(...lastLineBoxes.map((b) => b.cx - b.width / 2));
    const ulX1 = Math.max(...lastLineBoxes.map((b) => b.cx + b.width / 2));
    const ulY = Math.max(...lastLineBoxes.map((b) => b.cy)) + fontSize * 0.62;
    const ulH = Math.max(4, Math.round(fontSize * 0.08));
    const underline = new Graphics().roundRect(0, 0, ulX1 - ulX0, ulH, ulH / 2).fill(mixHex(accentA, accentB, 0.5));
    underline.position.set(ulX0, ulY);
    underline.scale.set(0, 1);
    root.addChild(underline);
    const underlineStart = gradientStart + gradientDur - 0.15;
    const underlineDur = 0.45;
    timeline.to(underline, { prop: "scale.x", from: 0, to: 1, start: underlineStart, duration: underlineDur, ease: outExpo });
    settleEnd = Math.max(settleEnd, underlineStart + underlineDur);
  }

  const duration = Math.max(4.5, settleEnd + 2.0);
  return { timeline, duration };
}

export const gradientText: TemplateDefinition = {
  id: "gradient-text",
  name: "Gradient Text",
  tagline: "Words rise in, then an accent gradient sweeps across the headline.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { headline: "display" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "text", label: "Headline", default: "Add some color", maxLength: 50, shrinkToFit: true },
    { key: "showUnderline", type: "toggle", label: "Underline", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accentA", type: "color", label: "Gradient start", default: "", optional: true },
    { key: "accentB", type: "color", label: "Gradient end", default: "", optional: true },
  ],
  build,
};

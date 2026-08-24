import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outCubic,
  outExpo,
  outBack,
  inOutCubic,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords, type WordBox } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

// Strip surrounding punctuation so "motion" matches "motion." / "motion," etc.
const strip = (s: string): string =>
  s.replace(/^["'“”().,!?;:—–-]+|["'“”().,!?;:—–-]+$/g, "");

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

function parseHex(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
  const parsed = h.length >= 6 ? parseInt(h.slice(0, 6), 16) : NaN;
  const n = Number.isNaN(parsed) ? 0 : parsed;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function toHex2(n: number): string {
  const v = Number.isFinite(n) ? Math.max(0, Math.min(255, Math.round(n))) : 0;
  return v.toString(16).padStart(2, "0");
}
/** Blend `a` toward `b` by `amt` (0..1). Pure — used to mute the non-keyword tone. */
function mix(a: string, b: string, amt: number): string {
  const pa = parseHex(a);
  const pb = parseHex(b);
  const r = pa[0] + (pb[0] - pa[0]) * amt;
  const g = pa[1] + (pb[1] - pa[1]) * amt;
  const bl = pa[2] + (pb[2] - pa[2]) * amt;
  return `#${toHex2(r)}${toHex2(g)}${toHex2(bl)}`;
}

interface L {
  fontFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
  blockHFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { fontFrac: 0.084, maxWidthFrac: 0.74, centerYFrac: 0.5, blockHFrac: 0.62 };
    case "9:16":
      return { fontFrac: 0.108, maxWidthFrac: 0.82, centerYFrac: 0.45, blockHFrac: 0.5 };
    case "4:5":
      return { fontFrac: 0.1, maxWidthFrac: 0.84, centerYFrac: 0.46, blockHFrac: 0.58 };
    case "1:1":
    default:
      return { fontFrac: 0.1, maxWidthFrac: 0.84, centerYFrac: 0.47, blockHFrac: 0.58 };
  }
}

const POP_START = 1.5;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const text = str(values.text, "Your posts deserve better motion");
  const emphRaw = str(values.emphasis, "better motion");
  const mutedColor = mix(textColor, bg, 0.25);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const centerY = size.height * L.centerYFrac;
  const maxWidth = size.width * L.maxWidthFrac;
  const maxBlockH = size.height * L.blockHFrac;

  // Fit the sentence vertically — shrink the font if it would overflow.
  let fontSize = Math.round(size.width * L.fontFrac);
  let lineHeight = Math.round(fontSize * 1.14);
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
    lineHeight = Math.round(fontSize * 1.14);
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

  // Which words are the keyword? Prefer a consecutive run matching the whole
  // phrase; fall back to any word appearing in the phrase.
  const emphTokens = emphRaw.split(/\s+/).map((w) => strip(w).toLowerCase()).filter(Boolean);
  const wordKeys = boxes.map((b) => strip(b.text).toLowerCase());
  const emph = new Set<number>();
  if (emphTokens.length > 0) {
    let matched = false;
    for (let i = 0; i + emphTokens.length <= wordKeys.length; i++) {
      let ok = true;
      for (let j = 0; j < emphTokens.length; j++) {
        if (wordKeys[i + j] !== emphTokens[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        for (let j = 0; j < emphTokens.length; j++) emph.add(i + j);
        matched = true;
      }
    }
    if (!matched) {
      const tokenSet = new Set(emphTokens);
      wordKeys.forEach((k, i) => {
        if (tokenSet.has(k)) emph.add(i);
      });
    }
  }

  const content = new Container();
  root.addChild(content);
  const timeline = new JimaTimeline();

  const emphByLine = new Map<number, WordBox[]>();

  boxes.forEach((box, i) => {
    const isEmph = emph.has(i);
    const t = makeText(fonts, {
      text: box.text,
      role: "display",
      weight: 700,
      size: fontSize,
      color: isEmph ? accent : mutedColor,
      anchor: 0.5,
    });
    t.position.set(box.cx, box.cy);
    t.alpha = 0;
    content.addChild(t);

    // The whole sentence fades in softly; muted words then stay put.
    const fadeStart = 0.25 + i * 0.06;
    timeline.to(t, { prop: "alpha", from: 0, to: 1, start: fadeStart, duration: 0.5, ease: outCubic });

    if (isEmph) {
      // Delayed pop: 1 -> 1.16 (outBack overshoot) -> 1 (settle).
      timeline
        .to(t, { prop: "scale.x", from: 1, to: 1.16, start: POP_START, duration: 0.34, ease: outBack })
        .to(t, { prop: "scale.y", from: 1, to: 1.16, start: POP_START, duration: 0.34, ease: outBack })
        .to(t, { prop: "scale.x", from: 1.16, to: 1, start: POP_START + 0.34, duration: 0.5, ease: inOutCubic })
        .to(t, { prop: "scale.y", from: 1.16, to: 1, start: POP_START + 0.34, duration: 0.5, ease: inOutCubic });
      const arr = emphByLine.get(box.line) ?? [];
      arr.push(box);
      emphByLine.set(box.line, arr);
    }
  });

  // A short accent underline sweeps in beneath the keyword (per line it spans).
  const showAccentBar = values.accentBar !== false;
  if (showAccentBar) {
    emphByLine.forEach((lineBoxes) => {
      const left = Math.min(...lineBoxes.map((b) => b.cx - b.width / 2));
      const right = Math.max(...lineBoxes.map((b) => b.cx + b.width / 2));
      const cyLine = lineBoxes[0]!.cy;
      const uy = cyLine + fontSize * 0.6;
      const uw = right - left;
      const uh = Math.max(3, fontSize * 0.07);
      const u = new Graphics().roundRect(0, 0, uw, uh, uh / 2).fill(accent);
      u.position.set(left, uy);
      u.scale.set(0, 1);
      content.addChild(u);
      timeline.to(u, { prop: "scale.x", from: 0, to: 1, start: POP_START - 0.1, duration: 0.6, ease: outExpo });
    });
  }

  return { timeline, duration: 3.6 };
}

export const emphasisLine: TemplateDefinition = {
  id: "emphasis-line",
  name: "Emphasis Line",
  tagline: "A calm sentence, then one keyword pops in accent.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.6,
  palettes: PALETTES,
  fields: [
    { key: "text", type: "text", label: "Text", default: "Your posts deserve better motion", maxLength: 80, shrinkToFit: true },
    { key: "emphasis", type: "text", label: "Emphasis", default: "better motion", maxLength: 30 },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

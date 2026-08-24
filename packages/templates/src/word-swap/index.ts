import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const DEFAULT_WORDS = ["bold", "loud", "yours"];
const PER = 1.1;

const asWords = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length >= 2) return arr.slice(0, 5);
  }
  return fallback;
};

function computeDuration(values: Values): number {
  return asWords(values.words, DEFAULT_WORDS).length * PER;
}

const PALETTES: Palette[] = [
  { id: "ink-ember", name: "Ink & ember", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", onAccent: "#101014" } },
  { id: "midnight-lime", name: "Midnight lime", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D", onAccent: "#101014" } },
  { id: "violet", name: "Violet", colors: { background: "#FAF5EA", textColor: "#2A1A5E", accent: "#6A44E8", onAccent: "#FFFFFF" } },
  { id: "berry", name: "Berry", colors: { background: "#1A0A14", textColor: "#FFFFFF", accent: "#FF2E9E", onAccent: "#1A0A14" } },
];

function fontFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.088;
    case "9:16":
      return 0.1;
    case "4:5":
      return 0.1;
    case "1:1":
      return 0.104;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const onAccent = pc("onAccent", "#101014");
  const pfx = str(values.prefix, "Make it ").replace(/\s+$/, "");
  const sfx = str(values.suffix, ".").replace(/^\s+/, "");
  const words = asWords(values.words, DEFAULT_WORDS);
  const n = words.length;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const cx = size.width / 2;
  const cy = size.height / 2;
  const family = fonts.family("display");
  const weight = 700;
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });

  // --- Size so the widest assembly (prefix + widest pill + suffix) fits ---
  let sizePx = Math.round(size.width * fontFrac(ctx.aspect));
  const gapFrac = 0.14;
  const padFrac = 0.5;
  {
    const pw = pfx.length ? measure(pfx, sizePx) : 0;
    const sw = sfx.length ? measure(sfx, sizePx) : 0;
    const gap = sizePx * gapFrac;
    const pad = sizePx * padFrac;
    const maxHalf = Math.max(...words.map((w) => measure(w, sizePx) / 2 + pad));
    const widest = pw + (pfx.length ? gap : 0) + 2 * maxHalf + (sfx.length ? gap : 0) + sw;
    const target = size.width * 0.9;
    if (widest > target) sizePx = Math.max(24, Math.floor((sizePx * target) / widest));
  }

  const gap = sizePx * gapFrac;
  const pad = sizePx * padFrac;
  const pillH = Math.round(sizePx * 1.5);
  const roll = pillH * 0.62;
  const pw = pfx.length ? measure(pfx, sizePx) : 0;
  const sw = sfx.length ? measure(sfx, sizePx) : 0;
  const halfs = words.map((w) => measure(w, sizePx) / 2 + pad);
  const maxHalf = Math.max(...halfs);

  // --- Fixed prefix / suffix (repositioned each frame around the pill) ---
  const pfxText = pfx.length
    ? makeText(fonts, { text: pfx, role: "display", weight, size: sizePx, color: textColor, anchor: { x: 1, y: 0.5 } })
    : null;
  const sfxText = sfx.length
    ? makeText(fonts, { text: sfx, role: "display", weight, size: sizePx, color: textColor, anchor: { x: 0, y: 0.5 } })
    : null;
  if (pfxText) root.addChild(pfxText);
  if (sfxText) root.addChild(sfxText);

  // --- Pill: bg (redrawn to fit each word) + words rolling under a clip mask ---
  const pillLayer = new Container();
  pillLayer.position.set(cx, cy);
  root.addChild(pillLayer);
  const pillBg = new Graphics();
  pillLayer.addChild(pillBg);
  const wordsClip = new Container();
  pillLayer.addChild(wordsClip);
  const maskG = new Graphics().roundRect(-maxHalf, -pillH / 2, maxHalf * 2, pillH, pillH / 2).fill(0xffffff);
  pillLayer.addChild(maskG);
  wordsClip.mask = maskG;
  const wordTexts = words.map((w) => {
    const t = makeText(fonts, { text: w, role: "display", weight, size: sizePx, color: onAccent, anchor: 0.5 });
    t.position.set(0, 0);
    t.alpha = 0;
    wordsClip.addChild(t);
    return t;
  });

  const D = n * PER;
  const TR = Math.min(0.46, PER * 0.42); // roll transition length
  const settleEnd = PER - TR;

  // Everything here is a pure function of t — deterministic, seamless at t≈0≈D.
  const update = (t: number): void => {
    const tc = t <= 0 ? 0 : t >= D ? D - 1e-4 : t;
    let k = Math.floor(tc / PER);
    if (k > n - 1) k = n - 1;
    const localT = tc - k * PER;
    const idxB = (k + 1) % n;

    let curHalf = halfs[k]!;
    let transitioning = false;
    let u = 0;
    if (localT >= settleEnd) {
      transitioning = true;
      u = outQuint((localT - settleEnd) / TR);
      curHalf = halfs[k]! + (halfs[idxB]! - halfs[k]!) * u;
    }

    for (let i = 0; i < n; i++) {
      const wt = wordTexts[i]!;
      if (!transitioning) {
        wt.alpha = i === k ? 1 : 0;
        wt.position.y = i === k ? 0 : roll;
      } else if (i === k) {
        wt.alpha = 1 - u; // outgoing rolls up and fades
        wt.position.y = -roll * u;
      } else if (i === idxB) {
        wt.alpha = u; // incoming rolls up from below
        wt.position.y = roll * (1 - u);
      } else {
        wt.alpha = 0;
        wt.position.y = roll;
      }
    }

    pillBg.clear().roundRect(-curHalf, -pillH / 2, curHalf * 2, pillH, pillH / 2).fill(accent);

    const gapL = pfxText ? gap : 0;
    const gapR = sfxText ? gap : 0;
    const totalW = pw + gapL + 2 * curHalf + gapR + sw;
    const pillCx = cx - totalW / 2 + pw + gapL + curHalf;
    pillLayer.position.x = pillCx;
    if (pfxText) pfxText.position.set(pillCx - curHalf - gapL, cy);
    if (sfxText) sfxText.position.set(pillCx + curHalf + gapR, cy);
  };

  return { timeline: new JimaTimeline(), duration: D, update };
}

export const wordSwap: TemplateDefinition = {
  id: "word-swap",
  name: "Word Swap",
  tagline: "A phrase whose last word rolls through your list, on loop.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: true,
  posterTime: 1.5,
  fontRoles: { prefix: "display", words: "display", suffix: "display" },
  palettes: PALETTES,
  estimateDuration: computeDuration,
  fields: [
    { key: "prefix", type: "text", label: "Prefix", default: "Make it ", maxLength: 24 },
    { key: "words", type: "textlist", label: "Words", default: DEFAULT_WORDS, minItems: 2, maxItems: 5, maxLength: 16 },
    { key: "suffix", type: "text", label: "Suffix", default: ".", maxLength: 8, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

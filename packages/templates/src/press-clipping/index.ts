import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  safeRect,
  safeCenter,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type Rng,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Largest size <= size0 at which `text` fits maxWidth (crisp, single-line). */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(11, Math.floor((size0 * maxWidth) / w)) : size0;
}

// --- Deterministic hex mixing (pure) — paper shades derive from the palette.
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = Number.parseInt(full.length === 6 ? full : "ffffff", 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
const toHex = (n: number): string => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `#${toHex(ca.r + (cb.r - ca.r) * t)}${toHex(ca.g + (cb.g - ca.g) * t)}${toHex(ca.b + (cb.b - ca.b) * t)}`;
}

/**
 * An irregular torn-paper outline: jittered points along all four edges of a
 * w×h rect centered at the origin. Jitter comes from the seeded rng only.
 */
function tornPoly(w: number, h: number, rng: Rng, step: number, jitter: number): number[] {
  const pts: number[] = [];
  const hw = w / 2;
  const hh = h / 2;
  const nx = Math.max(3, Math.round(w / step));
  const ny = Math.max(3, Math.round(h / step));
  const jit = (edge: boolean): number => (edge ? rng.range(-jitter * 0.4, jitter * 0.4) : rng.range(-jitter, jitter));
  for (let i = 0; i <= nx; i++) {
    pts.push(-hw + (w * i) / nx, -hh + jit(i === 0 || i === nx)); // top, left → right
  }
  for (let i = 1; i <= ny; i++) {
    pts.push(hw + jit(i === ny), -hh + (h * i) / ny); // right, top → bottom
  }
  for (let i = 1; i <= nx; i++) {
    pts.push(hw - (w * i) / nx, hh + jit(i === nx)); // bottom, right → left
  }
  for (let i = 1; i < ny; i++) {
    pts.push(-hw + jit(false), hh - (h * i) / ny); // left, bottom → top
  }
  return pts;
}

// A torn newspaper clipping drops in, gets taped down, and a big serif quote
// staggers in under the masthead. Ink (textColor) sits on the paper at ≥ 4.5:1
// in every palette; the background is just the desk behind the clipping.
const PALETTES: Palette[] = [
  { id: "newsprint", name: "Newsprint", colors: { background: "#E7E1D5", paper: "#FBF7EE", textColor: "#26211A", accent: "#C8A94E" } },
  { id: "slate-desk", name: "Slate desk", colors: { background: "#313947", paper: "#F6F3EA", textColor: "#221E18", accent: "#97A9BF" } },
  { id: "teal-press", name: "Teal press", colors: { background: "#0E3532", paper: "#F9F5EA", textColor: "#201C15", accent: "#D8B45A" } },
  { id: "blush-press", name: "Blush press", colors: { background: "#F1E1DB", paper: "#FFFDF6", textColor: "#2A2119", accent: "#D98A79" } },
];

const QUOTE_START = 1.45;
const WORD_STAGGER = 0.075;
const DURATION = 4.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#E7E1D5"));
  const paper = pc("paper", "#FBF7EE");
  const ink = str(values.textColor, pc("textColor", "#26211A"));
  const accent = str(values.accent, pc("accent", "#C8A94E"));
  const paperEdge = mixHex(paper, "#000000", 0.12);
  const fadedInk = mixHex(ink, paper, 0.72);

  const masthead = str(values.masthead, "THE DAILY — JULY 2026").toUpperCase();
  const quote = str(values.quote, "The most delightful tool we have tried all year");
  const attribution = str(values.attribution, "Alex Morgan, Editor at large");
  const showTape = values.showTape !== false;
  const showColumns = values.showColumns !== false;

  const w = size.width;
  const h = size.height;
  const zone = safeRect(ctx.aspect);
  const center = safeCenter(ctx.aspect);
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const cardW = Math.min(zone.width * 0.88, minDim * 0.84);
  const cardH = Math.min(cardW * 0.82, zone.height * 0.8);
  const pad = cardW * 0.09;
  const contentW = cardW - pad * 2;

  const card = new Container();
  card.position.set(center.x, center.y);
  root.addChild(card);

  // Torn layers: soft shadow, darker torn under-edge, then the paper itself.
  // Each layer tears differently (three separate rng-jittered outlines).
  const step = Math.max(22, cardW * 0.034);
  const jitter = Math.max(5, cardW * 0.009);
  const shadow = new Graphics().poly(tornPoly(cardW, cardH, rng, step, jitter)).fill({ color: "#000000", alpha: 0.14 });
  shadow.position.set(cardW * 0.012, cardH * 0.022);
  card.addChild(shadow);
  const under = new Graphics().poly(tornPoly(cardW, cardH, rng, step, jitter * 1.3)).fill(paperEdge);
  under.position.set(0, cardH * 0.006);
  card.addChild(under);
  card.addChild(new Graphics().poly(tornPoly(cardW, cardH, rng, step, jitter)).fill(paper));

  // --- Masthead: rule, title, thin rule (classic front-page furniture) ---
  const ruleY = -cardH / 2 + pad * 0.78;
  const mastSize = fitSize(fonts, masthead, "serif", 600, Math.round(cardW * 0.031), contentW * 0.92);
  const mastY = ruleY + pad * 0.42;
  const ruleBY = mastY + pad * 0.4;
  const ruleA = new Container();
  ruleA.position.set(0, ruleY);
  ruleA.scale.x = 0;
  ruleA.addChild(new Graphics().rect(-contentW / 2, -1.5, contentW, 3).fill(ink));
  card.addChild(ruleA);
  const ruleB = new Container();
  ruleB.position.set(0, ruleBY);
  ruleB.scale.x = 0;
  ruleB.addChild(new Graphics().rect(-contentW / 2, -0.75, contentW, 1.5).fill({ color: ink, alpha: 0.65 }));
  card.addChild(ruleB);
  const mastText = makeText(fonts, {
    text: masthead,
    role: "serif",
    weight: 600,
    size: mastSize,
    color: ink,
    anchor: 0.5,
    letterSpacing: 2,
  });
  mastText.position.set(0, mastY);
  mastText.alpha = 0;
  card.addChild(mastText);
  timeline
    .to(ruleA, { prop: "scale.x", from: 0, to: 1, start: 1.0, duration: 0.45, ease: outExpo })
    .to(ruleB, { prop: "scale.x", from: 0, to: 1, start: 1.1, duration: 0.45, ease: outExpo })
    .to(mastText, { prop: "alpha", from: 0, to: 1, start: 1.2, duration: 0.4, ease: outQuad });

  // --- The quote, staggering in word by word (auto-shrunk to ≤ 3 lines) ---
  const quoted = `“${quote}”`;
  const quoteCy = -cardH * 0.055;
  const layoutQuote = (fontSize: number) =>
    layoutWords(quoted, fonts, {
      role: "serif",
      weight: 600,
      fontSize,
      lineHeight: Math.round(fontSize * 1.26),
      maxWidth: contentW,
      align: "center",
      anchorX: 0,
      centerY: quoteCy,
    });
  let quoteSize = Math.round(cardW * 0.062);
  let boxes = layoutQuote(quoteSize);
  // Re-wrapping is not linear in font size, so shrink iteratively (bounded).
  for (let pass = 0; pass < 3 && quoteSize > 14; pass++) {
    const lineCount = boxes.length ? boxes[boxes.length - 1]!.line + 1 : 1;
    if (lineCount <= 3) break;
    quoteSize = Math.max(14, Math.floor((quoteSize * 3) / lineCount));
    boxes = layoutQuote(quoteSize);
  }
  boxes.forEach((b, i) => {
    const word = makeText(fonts, { text: b.text, role: "serif", weight: 600, size: quoteSize, color: ink, anchor: 0.5 });
    word.position.set(b.cx, b.cy);
    word.alpha = 0;
    card.addChild(word);
    const start = QUOTE_START + i * WORD_STAGGER;
    timeline
      .to(word, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(word, { prop: "y", from: b.cy + 14, to: b.cy, start, duration: 0.45, ease: outQuint });
  });

  // --- Fake body columns with a center rule (newsprint texture) ---
  if (showColumns) {
    const cols = new Container();
    cols.alpha = 0;
    card.addChild(cols);
    const colTop = cardH * 0.14;
    const colBottom = cardH / 2 - pad * 1.05;
    const colGap = pad * 0.7;
    const colW = (contentW - colGap) / 2;
    const rowH = Math.max(3, cardW * 0.008);
    const pitch = rowH + Math.max(6, cardW * 0.017);
    const rows = Math.max(2, Math.floor((colBottom - colTop) / pitch));
    for (let c = 0; c < 2; c++) {
      const left = -contentW / 2 + c * (colW + colGap);
      for (let r = 0; r < rows; r++) {
        const frac = r === rows - 1 ? rng.range(0.4, 0.6) : rng.range(0.72, 1);
        cols.addChild(
          new Graphics().roundRect(left, colTop + r * pitch, colW * frac, rowH, rowH / 2).fill(fadedInk),
        );
      }
    }
    const midX = -contentW / 2 + colW + colGap / 2;
    cols.addChild(
      new Graphics()
        .rect(midX - 0.75, colTop, 1.5, colBottom - colTop)
        .fill({ color: ink, alpha: 0.35 }),
    );
    timeline.to(cols, { prop: "alpha", from: 0, to: 1, start: 2.25, duration: 0.5, ease: outQuad });
  }

  // --- Attribution ---
  const attr = `— ${attribution}`;
  const attrSize = fitSize(fonts, attr, "body", 600, Math.round(cardW * 0.026), contentW);
  const attrY = cardH / 2 - pad * 0.62;
  const attrText = makeText(fonts, { text: attr, role: "body", weight: 600, size: attrSize, color: ink, anchor: 0.5 });
  attrText.position.set(0, attrY);
  attrText.alpha = 0;
  card.addChild(attrText);
  timeline
    .to(attrText, { prop: "alpha", from: 0, to: 0.85, start: 2.6, duration: 0.45, ease: outQuad })
    .to(attrText, { prop: "y", from: attrY + 10, to: attrY, start: 2.6, duration: 0.45, ease: outQuint });

  // --- Tape strip across the top edge ---
  if (showTape) {
    const tw = cardW * 0.3;
    const th = cardW * 0.062;
    const tape = new Container();
    tape.position.set(0, -cardH / 2 + th * 0.12);
    tape.rotation = 0.05;
    tape.scale.set(0);
    tape.addChild(new Graphics().rect(-tw / 2, -th / 2, tw, th).fill({ color: accent, alpha: 0.8 }));
    tape.addChild(new Graphics().rect(-tw / 2, -th * 0.16, tw, th * 0.32).fill({ color: "#FFFFFF", alpha: 0.22 }));
    card.addChild(tape);
    timeline
      .to(tape, { prop: "scale.x", from: 0, to: 1, start: 0.95, duration: 0.4, ease: makeOutBack(2) })
      .to(tape, { prop: "scale.y", from: 0, to: 1, start: 0.95, duration: 0.4, ease: makeOutBack(2) });
  }

  // --- Drop-in: falls from above, over-rotates a touch, settles slightly askew ---
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.25, ease: outQuad })
    .to(card, { prop: "y", from: center.y - cardH * 1.05, to: center.y, start: 0.15, duration: 0.7, ease: makeOutBack(1.1) })
    .to(card, { prop: "rotation", from: -0.16, to: -0.035, start: 0.15, duration: 0.75, ease: makeOutBack(1.3) });
  card.alpha = 0;

  return { timeline, duration: DURATION };
}

export const pressClipping: TemplateDefinition = {
  id: "press-clipping",
  name: "Press Clipping",
  tagline: "A torn newspaper clipping drops onto the desk, taped down with your quote.",
  category: "testimonial",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { quote: "serif", masthead: "serif" },
  palettes: PALETTES,
  fields: [
    { key: "masthead", type: "text", label: "Masthead", default: "THE DAILY — JULY 2026", maxLength: 32, shrinkToFit: true },
    { key: "quote", type: "textarea", label: "Quote", default: "The most delightful tool we have tried all year", maxLength: 110, shrinkToFit: true },
    { key: "attribution", type: "text", label: "Attribution", default: "Alex Morgan, Editor at large", maxLength: 36, shrinkToFit: true },
    { key: "showTape", type: "toggle", label: "Tape strip", default: true },
    { key: "showColumns", type: "toggle", label: "Column texture", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Ink", default: "", optional: true },
    { key: "accent", type: "color", label: "Tape", default: "", optional: true },
  ],
  build,
};

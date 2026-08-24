import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  spring,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { layoutWords } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const clampInt = (n: number, lo: number, hi: number): number =>
  n < lo ? lo : n > hi ? hi : Math.round(n);

const CARD_BG = "#FFFFFF";
const STAR_OFF = "#D8DCE2";

const DEFAULT_REVIEWS = [
  "Saves me hours every week | @sam | 5",
  "My posts finally look pro | @alex | 5",
  "Can't believe it's free | @mia | 5",
];

const PALETTES: Palette[] = [
  { id: "ember", name: "Ember", colors: { background: "#FFF3EE", textColor: "#2A0F06", accent: "#FF4D1C", muted: "#7A6A62" } },
  { id: "grape", name: "Grape", colors: { background: "#F3EEFF", textColor: "#241452", accent: "#7C5CFF", muted: "#6B6088" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF2FB", accent: "#2E5BD6", textColor: "#0F1B2A", muted: "#52607A" } },
  { id: "lime-ink", name: "Lime ink", colors: { background: "#101014", accent: "#84CC16", textColor: "#FFFFFF", muted: "#A7ADB8" } },
];

interface Review {
  quote: string;
  name: string;
  rating: number;
}

function parseReview(raw: string): Review {
  const parts = raw.split("|").map((s) => s.trim());
  const quote = parts[0] ?? "";
  const name = parts[1] ?? "";
  const ratingRaw = parts[2] ?? "";
  const parsed = Number.parseInt(ratingRaw, 10);
  const rating = Number.isFinite(parsed) ? clampInt(parsed, 1, 5) : 5;
  return { quote, name, rating };
}

function reviewList(values: Values): Review[] {
  return asItems(values.reviews, DEFAULT_REVIEWS).slice(0, 3).map(parseReview);
}

function computeDuration(values: Values): number {
  return 1.0 + reviewList(values).length * 0.5 + 1.4;
}

interface QuoteBlock {
  nodes: Text[];
  height: number;
}

/**
 * Lay a quote out as centered, word-wrapped per-word Text nodes (via layoutWords,
 * which never truncates), shrinking the size until the block fits maxHeight. Nodes
 * are centered on x=0 and y=0; the caller offsets them into the card.
 */
function layoutQuote(
  fonts: FontRegistry,
  text: string,
  size: number,
  color: string,
  maxWidth: number,
  maxHeight: number,
): QuoteBlock {
  let s = size;
  for (let i = 0; i < 8; i++) {
    const lineHeight = Math.round(s * 1.22);
    const boxes = layoutWords(text, fonts, {
      role: "display",
      weight: 600,
      fontSize: s,
      lineHeight,
      maxWidth,
      align: "center",
      anchorX: 0,
      centerY: 0,
    });
    const lineCount = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
    const height = lineCount * lineHeight;
    if (height <= maxHeight || s <= 12) {
      // Group words back into per-line strings so spaces render natively (plain
      // makeText, no wordWrap → no single-line texture truncation).
      const lineWords: string[][] = [];
      for (const b of boxes) (lineWords[b.line] ??= []).push(b.text);
      const nodes: Text[] = [];
      const top = -height / 2 + lineHeight / 2;
      lineWords.forEach((words, li) => {
        const t = makeText(fonts, { text: words.join(" "), role: "display", weight: 600, size: s, color, anchor: 0.5, align: "center" });
        t.position.set(0, top + li * lineHeight);
        nodes.push(t);
      });
      return { nodes, height };
    }
    s = Math.max(12, Math.floor(s * 0.9));
  }
  return { nodes: [], height: 0 };
}

/** A left-to-right row of `rating` filled stars + remaining empty ones. */
function starRow(rating: number, starSize: number, accent: string): Container {
  const c = new Container();
  const gap = starSize * 1.22;
  const total = 5;
  const startX = -((total - 1) * gap) / 2;
  for (let i = 0; i < total; i++) {
    const star = makeIcon("star", starSize, { color: i < rating ? accent : STAR_OFF });
    star.position.set(startX + i * gap, 0);
    c.addChild(star);
  }
  return c;
}

interface Slot {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFF3EE"));
  const textColor = str(values.textColor, pc("textColor", "#2A0F06"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const muted = pc("muted", "#7A6A62");
  const heading = str(values.heading, "What people say");
  const reviews = reviewList(values);
  const n = reviews.length;

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const row = ctx.aspect === "16:9";
  const timeline = new JimaTimeline();

  // Safe band (9:16 reserves platform chrome; others ~6% margin).
  const topSafe = ctx.aspect === "9:16" ? 220 : Math.round(Math.min(w, h) * 0.06);
  const botSafe = ctx.aspect === "9:16" ? 400 : Math.round(Math.min(w, h) * 0.06);

  // Heading.
  const headSize = Math.round(w * (row ? 0.05 : ctx.aspect === "9:16" ? 0.066 : 0.062));
  const headY = topSafe + headSize * 0.9;
  const headText = makeText(fonts, { text: heading, role: "display", weight: 700, size: headSize, color: textColor, anchor: 0.5, align: "center" });
  if (headText.width > w * 0.86) headText.scale.set((w * 0.86) / headText.width);
  headText.position.set(cx, headY);
  headText.alpha = 0;
  root.addChild(headText);
  timeline
    .to(headText, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.5, ease: outQuad })
    .to(headText, { prop: "y", from: headY - 18, to: headY, start: 0.1, duration: 0.6, ease: outExpo });

  // Card band.
  const bandTop = headY + headSize * 0.9;
  const bandBottom = h - botSafe;
  const bandH = bandBottom - bandTop;

  const slots: Slot[] = [];
  if (row) {
    const availW = w * 0.9;
    const cellW = availW / n;
    const originX = cx - availW / 2;
    const cardW = cellW * 0.9;
    const cardH = Math.min(bandH * 0.9, cardW * 1.15);
    const cy = bandTop + bandH / 2;
    for (let i = 0; i < n; i++) slots.push({ cx: originX + cellW * (i + 0.5), cy, w: cardW, h: cardH });
  } else {
    const cellH = bandH / n;
    const cardW = w * (ctx.aspect === "9:16" ? 0.84 : 0.8);
    const cardH = cellH * 0.86;
    for (let i = 0; i < n; i++) slots.push({ cx, cy: bandTop + cellH * (i + 0.5), w: cardW, h: cardH });
  }

  reviews.forEach((review, i) => {
    const slot = slots[i];
    if (!slot) return;
    const { w: cardW, h: cardH } = slot;
    const card = new Container();
    const r = Math.min(cardW, cardH) * 0.14;
    const padX = cardW * 0.08;
    const innerW = cardW - padX * 2;

    // Shadow + body.
    card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.05, cardW, cardH, r).fill({ color: "#000000", alpha: 0.07 }));
    card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, r).fill(CARD_BG).stroke({ color: "#000000", alpha: 0.05, width: 1 }));

    const starSize = Math.min(cardH * 0.13, cardW * 0.09);
    const nameSize = Math.round(Math.min(cardH * 0.11, cardW * 0.075));
    const quoteMaxW = innerW;
    const quoteMaxH = cardH - starSize * 1.6 - nameSize * 2.4 - cardH * 0.12;
    const quoteSize = Math.round(Math.min(cardH * 0.16, cardW * 0.11));
    const quote = layoutQuote(fonts, review.quote, quoteSize, textColor, quoteMaxW, Math.max(quoteSize * 1.3, quoteMaxH));

    // Vertically center: stars, quote, name stacked with gaps.
    const gap = cardH * 0.06;
    const totalH = starSize + gap + quote.height + gap + nameSize;
    let cursorY = -totalH / 2;

    const stars = starRow(review.rating, starSize, accent);
    stars.position.set(0, cursorY + starSize / 2);
    card.addChild(stars);
    cursorY += starSize + gap;

    const quoteCY = cursorY + quote.height / 2;
    for (const node of quote.nodes) {
      node.y += quoteCY;
      card.addChild(node);
    }
    cursorY += quote.height + gap;

    if (review.name.length > 0) {
      const nameText = makeText(fonts, { text: review.name, role: "body", weight: 600, size: nameSize, color: muted, anchor: 0.5, align: "center" });
      if (nameText.width > innerW) nameText.scale.set(innerW / nameText.width);
      nameText.position.set(0, cursorY + nameSize / 2);
      card.addChild(nameText);
    }

    card.position.set(slot.cx, slot.cy);
    card.alpha = 0;
    card.scale.set(0.8);
    root.addChild(card);
    const start = 1.0 + i * 0.5;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.4, ease: outQuad })
      .to(card, { prop: "scale.x", from: 0.8, to: 1, start, duration: 0.7, ease: spring(0.5) })
      .to(card, { prop: "scale.y", from: 0.8, to: 1, start, duration: 0.7, ease: spring(0.5) })
      .to(card, { prop: "y", from: slot.cy + cardH * 0.12, to: slot.cy, start, duration: 0.7, ease: spring(0.5) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const testimonialWall: TemplateDefinition = {
  id: "testimonial-wall",
  name: "Testimonial Wall",
  tagline: "A wall of star-rated reviews pops into place.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.0,
  estimateDuration: computeDuration,
  palettes: PALETTES,
  fields: [
    { key: "heading", type: "text", label: "Heading", default: "What people say", maxLength: 32, shrinkToFit: true },
    { key: "reviews", type: "textlist", label: "Reviews", default: DEFAULT_REVIEWS, minItems: 2, maxItems: 3, maxLength: 60, help: "One per line as \"quote | name | rating\" (rating 1–5)." },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

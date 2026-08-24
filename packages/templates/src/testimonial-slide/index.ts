import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outExpo,
  outQuad,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const clampInt = (n: number, lo: number, hi: number): number => (n < lo ? lo : n > hi ? hi : Math.round(n));

// Reused wholesale from review-stars (already-vetted role set, incl. the
// unfilled-star "empty" tone).
const PALETTES: Palette[] = [
  { id: "paper-ink", name: "Paper + ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", empty: "#D8D8DE" } },
  { id: "sunrise", name: "Sunrise", colors: { background: "#FFF8EE", textColor: "#2A2016", accent: "#F5A623", empty: "#E6DCCB" } },
  { id: "porcelain", name: "Porcelain", colors: { background: "#F1F4F9", textColor: "#16233A", accent: "#2E5BD6", empty: "#CBD3E0" } },
  { id: "ink", name: "Ink", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF6A3C", empty: "#33343C" } },
];

interface QuoteBlock {
  lines: string[];
  size: number;
  lineHeight: number;
  height: number;
}

/** Greedy left-align wrap, packed to ≤ maxLines, shrinking until both the
 * widest line and the total block height fit their budgets. Deterministic. */
function fitQuote(
  fonts: FontRegistry,
  text: string,
  size0: number,
  maxWidth: number,
  maxHeight: number,
  maxLines: number,
): QuoteBlock {
  const family = fonts.family("display");
  let size = size0;
  for (let iter = 0; iter < 8; iter++) {
    const measure = (s: string): number => fonts.measure(s, { family, weight: 600, size });
    const words = text.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let cur = "";
    for (const word of words) {
      const next = cur ? `${cur} ${word}` : word;
      if (!cur || measure(next) <= maxWidth) cur = next;
      else {
        lines.push(cur);
        cur = word;
      }
    }
    if (cur) lines.push(cur);
    let packed = lines.length ? lines : [""];
    if (packed.length > maxLines) {
      packed = [...packed.slice(0, maxLines - 1), packed.slice(maxLines - 1).join(" ")];
    }
    const lineHeight = Math.round(size * 1.26);
    const widest = Math.max(...packed.map((l) => measure(l)));
    const height = packed.length * lineHeight;
    if ((widest <= maxWidth && height <= maxHeight) || size <= 15) {
      return { lines: packed, size, lineHeight, height };
    }
    size = Math.max(15, Math.floor(size * 0.91));
  }
  const lineHeight = Math.round(size * 1.26);
  return { lines: [text], size, lineHeight, height: lineHeight };
}

/** A left-to-right row of `rating` filled stars + remaining empty ones. */
function starRow(rating: number, starSize: number, accent: string, empty: string): Container {
  const c = new Container();
  const gap = starSize * 1.3;
  for (let i = 0; i < 5; i++) {
    const star = makeIcon("star", starSize, { color: i < rating ? accent : empty });
    star.position.set(gap / 2 + i * gap, 0);
    c.addChild(star);
  }
  return c;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const empty = pc("empty", "#D8D8DE");

  const quote = str(values.quote, "Set up in minutes — the animations look genuinely professional.");
  const author = str(values.author, "Alex P.");
  const rating = clampInt(num(values.rating, 5), 1, 5);
  const showStars = values.showStars !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const rect = safeRect(ctx.aspect);
  const contentW = rect.width;

  // --- Layout: avatar dot + name, then stars, then the quote — stacked and
  // left-aligned so the whole thing reads as one block sliding in.
  const avatarR = minDim * 0.044;
  const nameSize = Math.round(minDim * 0.05);
  const starsSize = Math.round(minDim * 0.046);
  const quoteSize0 = Math.round(minDim * 0.06);

  const row1H = Math.max(avatarR * 2, nameSize * 1.15);
  const gap1 = minDim * 0.045;
  const row2H = starsSize * 1.3;
  const gap2 = minDim * 0.04;

  const quoteMaxH = Math.max(quoteSize0 * 1.3, rect.height * 0.62);
  const qb = fitQuote(fonts, quote, quoteSize0, contentW, quoteMaxH, 3);

  const totalH = row1H + gap1 + (showStars ? row2H + gap2 : 0) + qb.height;
  let cursorY = rect.y + (rect.height - totalH) / 2;

  const row1Y = cursorY;
  cursorY += row1H + gap1;
  let row2Y = 0;
  if (showStars) {
    row2Y = cursorY;
    cursorY += row2H + gap2;
  }
  const row3Y = cursorY;

  // Deterministic slide direction (seeded — stable per render, varies by seed).
  const dir = rng.next() < 0.5 ? -1 : 1;
  const slideDist = w * 0.4;

  // --- Row 1: avatar dot + name ---
  const row1 = new Container();
  const row1FinalX = rect.x;
  row1.position.set(row1FinalX + dir * slideDist, row1Y + row1H / 2);
  row1.alpha = 0;
  root.addChild(row1);

  const dot = new Graphics().circle(0, 0, avatarR).fill(accent);
  dot.position.set(avatarR, 0);
  row1.addChild(dot);
  const nameText = makeText(fonts, { text: author, role: "display", weight: 700, size: nameSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  const nameX = avatarR * 2 + nameSize * 0.5;
  nameText.position.set(nameX, 0);
  if (nameText.width > contentW - nameX) nameText.scale.set(Math.max(0.4, (contentW - nameX) / nameText.width));
  row1.addChild(nameText);

  const ROW1_START = 0.1;
  timeline
    .to(row1, { prop: "alpha", from: 0, to: 1, start: ROW1_START, duration: 0.4, ease: outQuad })
    .to(row1, { prop: "x", from: row1FinalX + dir * slideDist, to: row1FinalX, start: ROW1_START, duration: 0.6, ease: outExpo });

  // --- Row 2: stars (optional) ---
  let stars: Container | null = null;
  const ROW2_START = 0.22;
  if (showStars) {
    stars = starRow(rating, starsSize, accent, empty);
    const row2FinalX = rect.x;
    stars.position.set(row2FinalX + dir * slideDist, row2Y + row2H / 2);
    stars.alpha = 0;
    root.addChild(stars);
    timeline
      .to(stars, { prop: "alpha", from: 0, to: 1, start: ROW2_START, duration: 0.4, ease: outQuad })
      .to(stars, { prop: "x", from: row2FinalX + dir * slideDist, to: row2FinalX, start: ROW2_START, duration: 0.6, ease: outExpo });
  }

  // --- Row 3: the quote ---
  const quoteText = makeText(fonts, {
    text: qb.lines.join("\n"),
    role: "display",
    weight: 600,
    size: qb.size,
    color: textColor,
    anchor: { x: 0, y: 0 },
    lineHeight: qb.lineHeight,
  });
  const row3FinalX = rect.x;
  quoteText.position.set(row3FinalX + dir * slideDist, row3Y);
  quoteText.alpha = 0;
  root.addChild(quoteText);

  const ROW3_START = 0.34;
  timeline
    .to(quoteText, { prop: "alpha", from: 0, to: 1, start: ROW3_START, duration: 0.45, ease: outQuad })
    .to(quoteText, { prop: "x", from: row3FinalX + dir * slideDist, to: row3FinalX, start: ROW3_START, duration: 0.65, ease: outExpo })
    // A slow, subtle idle drift once settled — keeps the long hold alive.
    .to(quoteText, { prop: "y", from: row3Y, to: row3Y - minDim * 0.006, start: 1.6, duration: 1.3, ease: outQuad })
    .to(quoteText, { prop: "y", from: row3Y - minDim * 0.006, to: row3Y, start: 2.9, duration: 1.3, ease: outQuad });

  return { timeline, duration: 4.5 };
}

export const testimonialSlide: TemplateDefinition = {
  id: "testimonial-slide",
  name: "Testimonial Slide",
  tagline: "A testimonial slides in from the side, stars and all.",
  category: "testimonial",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "quote", type: "textarea", label: "Quote", default: "Set up in minutes — the animations look genuinely professional.", maxLength: 140, maxLines: 3 },
    { key: "author", type: "text", label: "Author", default: "Alex P.", maxLength: 28 },
    { key: "rating", type: "slider", label: "Rating", default: 5, min: 1, max: 5, step: 1 },
    { key: "showStars", type: "toggle", label: "Star rating", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

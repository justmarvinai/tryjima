import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outExpo,
  outQuad,
  outQuint,
  spring,
  safeCenter,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Aspect,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

// Reused wholesale from product-hero (already-vetted background/card/text/accent
// role combinations), so end-frame contrast holds across every palette here too.
const PALETTES: Palette[] = [
  { id: "studio-white", name: "Studio white", colors: { background: "#F4F2EC", cardColor: "#FFFFFF", accent: "#FF4D1C", textColor: "#14140F" } },
  { id: "electric-violet", name: "Electric violet", colors: { background: "#F1ECFB", cardColor: "#FFFFFF", accent: "#6D3BEA", textColor: "#180F2E" } },
  { id: "splash-blue", name: "Splash blue", colors: { background: "#E9F1FC", cardColor: "#FFFFFF", accent: "#1E6FE0", textColor: "#0B1A2E" } },
  { id: "ink-lime", name: "Ink lime", colors: { background: "#15171C", cardColor: "#21252C", accent: "#C7F24A", textColor: "#FFFFFF" } },
];

function cardWFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.42;
    case "1:1":
      return 0.68;
    case "4:5":
      return 0.76;
    case "9:16":
      return 0.82;
  }
}

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
    const lineHeight = Math.round(size * 1.28);
    const widest = Math.max(...packed.map((l) => measure(l)));
    const height = packed.length * lineHeight;
    if ((widest <= maxWidth && height <= maxHeight) || size <= 15) {
      return { lines: packed, size, lineHeight, height };
    }
    size = Math.max(15, Math.floor(size * 0.91));
  }
  const lineHeight = Math.round(size * 1.28);
  return { lines: [text], size, lineHeight, height: lineHeight };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F2EC"));
  const cardColor = str(values.cardColor, pc("cardColor", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#14140F"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));

  const quote = str(values.quote, "Our posts finally look like we hired a motion designer. And it's free.");
  const author = str(values.author, "— Happy Customer");
  const showMark = values.showMark !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const rect = safeRect(ctx.aspect);
  const cardW = Math.min(rect.width, w * cardWFrac(ctx.aspect));
  const maxCardH = rect.height;

  const padX = cardW * 0.09;
  const padY = cardW * 0.085;
  const innerW = cardW - padX * 2;

  const markSize = Math.round(cardW * 0.2);
  const markBlockH = showMark ? markSize * 1.0 : 0;
  const gapMarkQuote = showMark ? cardW * 0.035 : 0;

  const authorSize = Math.round(cardW * 0.05);
  const dotR = authorSize * 0.42;
  const authorRowH = authorSize * 1.3;
  const gapQuoteAuthor = cardW * 0.06;

  const quoteSize0 = Math.round(cardW * 0.066);
  const maxQuoteH = Math.max(quoteSize0 * 1.3, maxCardH - padY * 2 - markBlockH - gapMarkQuote - authorRowH - gapQuoteAuthor);
  const qb = fitQuote(fonts, quote, quoteSize0, innerW, maxQuoteH, 4);

  const contentH = markBlockH + gapMarkQuote + qb.height + gapQuoteAuthor + authorRowH;
  const cardH = Math.min(maxCardH, contentH + padY * 2);

  const center = safeCenter(ctx.aspect);
  const cardCX = center.x;
  const cardCY = center.y;
  const cardR = Math.min(cardW, cardH) * 0.06;

  // --- Card (slides up + springs into place) ---
  const card = new Container();
  const shadow = new Graphics().roundRect(-cardW / 2, -cardH / 2 + cardH * 0.035, cardW, cardH, cardR).fill({ color: "#000000", alpha: 0.14 });
  card.addChild(shadow);
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardColor));

  const dropY = minDim * 0.06;
  card.position.set(cardCX, cardCY + dropY);
  card.scale.set(0.88);
  card.alpha = 0;
  root.addChild(card);

  const CARD_START = 0.1;
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: CARD_START, duration: 0.35, ease: outQuad })
    .to(card, { prop: "y", from: cardCY + dropY, to: cardCY, start: CARD_START, duration: 0.75, ease: outQuint })
    .to(card, { prop: "scale.x", from: 0.88, to: 1, start: CARD_START, duration: 0.75, ease: spring(0.55) })
    .to(card, { prop: "scale.y", from: 0.88, to: 1, start: CARD_START, duration: 0.75, ease: spring(0.55) });

  let cursorY = -cardH / 2 + padY;

  // --- Big quotation mark ---
  if (showMark) {
    const mark = makeText(fonts, { text: "“", role: "serif", weight: 600, size: markSize, color: accent, anchor: 0.5 });
    mark.position.set(-cardW / 2 + padX + markSize * 0.3, cursorY + markSize * 0.36);
    mark.scale.set(0);
    mark.rotation = -10 * (Math.PI / 180);
    card.addChild(mark);
    const markStart = CARD_START + 0.4;
    timeline
      .to(mark, { prop: "scale.x", from: 0, to: 1, start: markStart, duration: 0.45, ease: makeOutBack(1.8) })
      .to(mark, { prop: "scale.y", from: 0, to: 1, start: markStart, duration: 0.45, ease: makeOutBack(1.8) })
      .to(mark, { prop: "rotation", from: -10 * (Math.PI / 180), to: 0, start: markStart, duration: 0.45, ease: outExpo });
    cursorY += markBlockH + gapMarkQuote;
  }

  // --- Quote lines ---
  const quoteNodes: Text[] = [];
  const quoteTop = cursorY;
  const quoteStart0 = CARD_START + (showMark ? 0.65 : 0.3);
  qb.lines.forEach((line, i) => {
    const t = makeText(fonts, { text: line, role: "display", weight: 600, size: qb.size, color: textColor, anchor: { x: 0, y: 0 } });
    const ly = quoteTop + i * qb.lineHeight;
    t.position.set(-cardW / 2 + padX, ly);
    t.alpha = 0;
    card.addChild(t);
    quoteNodes.push(t);
    const start = quoteStart0 + i * 0.1;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.35, ease: outQuad })
      .to(t, { prop: "y", from: ly + 10, to: ly, start, duration: 0.4, ease: outQuint });
  });
  cursorY = quoteTop + qb.height + gapQuoteAuthor;

  // --- Author row: a small avatar dot + the author line ---
  const authorRow = new Container();
  authorRow.position.set(0, cursorY + authorRowH / 2);
  authorRow.alpha = 0;
  card.addChild(authorRow);

  const dotX = -cardW / 2 + padX + dotR;
  const dot = new Graphics().circle(0, 0, dotR).fill(accent);
  dot.position.set(dotX, 0);
  dot.scale.set(0);
  authorRow.addChild(dot);

  const authorText = makeText(fonts, { text: author, role: "body", weight: 600, size: authorSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  const authorX = dotX + dotR + authorSize * 0.6;
  authorText.position.set(authorX, 0);
  if (authorText.width > innerW - (authorX - (-cardW / 2 + padX))) {
    authorText.scale.set((innerW - (authorX - (-cardW / 2 + padX))) / authorText.width);
  }
  authorRow.addChild(authorText);

  const lastQuoteStart = quoteStart0 + (qb.lines.length - 1) * 0.1;
  const authorStart = lastQuoteStart + 0.35;
  timeline
    .to(authorRow, { prop: "alpha", from: 0, to: 1, start: authorStart, duration: 0.4, ease: outQuad })
    .to(dot, { prop: "scale.x", from: 0, to: 1, start: authorStart + 0.05, duration: 0.4, ease: makeOutBack(2) })
    .to(dot, { prop: "scale.y", from: 0, to: 1, start: authorStart + 0.05, duration: 0.4, ease: makeOutBack(2) });

  return { timeline, duration: 4.5 };
}

export const quoteCards: TemplateDefinition = {
  id: "quote-cards",
  name: "Quote Cards",
  tagline: "A testimonial card springs in with a big quotation mark.",
  category: "testimonial",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.0,
  palettes: PALETTES,
  fields: [
    { key: "quote", type: "textarea", label: "Quote", default: "Our posts finally look like we hired a motion designer. And it's free.", maxLength: 160, maxLines: 4 },
    { key: "author", type: "text", label: "Author", default: "— Happy Customer", maxLength: 36 },
    { key: "showMark", type: "toggle", label: "Quotation mark", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "cardColor", type: "color", label: "Card", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

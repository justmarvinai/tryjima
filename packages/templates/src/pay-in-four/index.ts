import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outBack,
  outExpo,
  outQuad,
  outQuint,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Pay in 4 — the instalment breakdown: the full price splits into equal
// payments that walk out along a dated track, with the first one marked "today".
// The single most persuasive thing a small shop can put on a price.
//
// `price-card` states a number and `value-stack` adds things up. This one takes
// one number apart, and the split is the animation: the price literally divides.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "mint", name: "Mint", colors: { background: "#F3F7F4", textColor: "#111C16", accent: "#0F9D6E" } },
  { id: "ink", name: "Ink", colors: { background: "#101216", textColor: "#F4F5F7", accent: "#4ADE80" } },
  { id: "lilac", name: "Lilac", colors: { background: "#F4F1FB", textColor: "#191330", accent: "#6D3BE4" } },
  { id: "coral", name: "Coral", colors: { background: "#FFF4F0", textColor: "#1D1310", accent: "#E8503A" } },
];

interface Layout {
  priceFrac: number;
  chipFrac: number;
  topFrac: number;
  widthFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { priceFrac: 0.1, chipFrac: 0.026, topFrac: 0.24, widthFrac: 0.66 };
    case "9:16":
      return { priceFrac: 0.15, chipFrac: 0.036, topFrac: 0.26, widthFrac: 0.84 };
    case "4:5":
      return { priceFrac: 0.14, chipFrac: 0.034, topFrac: 0.24, widthFrac: 0.82 };
    case "1:1":
    default:
      return { priceFrac: 0.14, chipFrac: 0.034, topFrac: 0.24, widthFrac: 0.8 };
  }
}

const PRICE_AT = 0.3;
const SPLIT_AT = 1.05;
const PER_CHIP = 0.16;
const DURATION = 5.0;

/** Currency symbol + numeric part, so the maths can be done on the number. */
function splitPrice(s: string): { symbol: string; value: number; suffix: string } {
  const m = /^([^\d.,-]*)\s*([\d.,]+)\s*(.*)$/.exec(s.trim());
  if (!m) return { symbol: "", value: 0, suffix: s };
  const raw = (m[2] ?? "0").replace(/\.(?=\d{3}\b)/g, "").replace(",", ".");
  return { symbol: m[1] ?? "", value: Number(raw) || 0, suffix: m[3] ?? "" };
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3F7F4"));
  const textColor = str(values.textColor, pc("textColor", "#111C16"));
  const accent = str(values.accent, pc("accent", "#0F9D6E"));
  const product = str(values.product, "The weekender bag");
  const price = str(values.price, "€196");
  const parts = Math.round(Math.max(2, Math.min(6, num(values.parts, 4))));
  const cadence = str(values.cadence, "every 2 weeks").trim();
  const footnote = str(values.footnote, "").trim();
  const showTrack = on(values.showTrack);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const priceSize = Math.round(size.width * L.priceFrac);
  const chipSize = Math.round(size.width * L.chipFrac);
  const colW = size.width * L.widthFrac;
  const top = size.height * L.topFrac;

  const { symbol, value, suffix } = splitPrice(price);
  const each = value / parts;
  const fmt = (n: number) =>
    `${symbol}${(Math.round(n * 100) / 100).toFixed(each % 1 === 0 && value % parts === 0 ? 0 : 2)}${suffix}`;

  const timeline = new JimaTimeline();

  // --- Product name ---
  const nameSize = Math.round(priceSize * 0.3);
  const n = makeText(fonts, { text: product, role: "body", weight: 600, size: nameSize, color: textColor, anchor: 0.5 });
  n.alpha = 0;
  n.position.set(cx, top - priceSize * 0.62);
  root.addChild(n);
  timeline
    .to(n, { prop: "alpha", from: 0, to: 0.7, start: 0.15, duration: 0.4, ease: outQuad })
    .to(n, { prop: "y", from: top - priceSize * 0.5, to: top - priceSize * 0.62, start: 0.15, duration: 0.7, ease: outExpo });

  // --- The full price, which then shrinks aside as the split happens ---
  const full = makeText(fonts, {
    text: price,
    role: "display",
    weight: 800,
    size: priceSize,
    color: textColor,
    anchor: 0.5,
  });
  full.position.set(cx, top);
  full.alpha = 0;
  root.addChild(full);
  timeline
    .to(full, { prop: "alpha", from: 0, to: 1, start: PRICE_AT, duration: 0.35, ease: outQuad })
    .to(full, { prop: "scale.x", from: 1.25, to: 1, start: PRICE_AT, duration: 0.6, ease: outBack })
    .to(full, { prop: "scale.y", from: 1.25, to: 1, start: PRICE_AT, duration: 0.6, ease: outBack })
    // Then it steps back and dims — it is now context, not the offer.
    .to(full, { prop: "scale.x", from: 1, to: 0.46, start: SPLIT_AT, duration: 0.7, ease: outExpo })
    .to(full, { prop: "scale.y", from: 1, to: 0.46, start: SPLIT_AT, duration: 0.7, ease: outExpo })
    .to(full, { prop: "alpha", from: 1, to: 0.45, start: SPLIT_AT, duration: 0.6, ease: outQuad })
    .to(full, { prop: "y", from: top, to: top - priceSize * 0.16, start: SPLIT_AT, duration: 0.7, ease: outExpo });

  // --- The instalment: one big number, the headline of the offer ---
  const eachY = top + priceSize * 0.72;
  const eachText = makeText(fonts, {
    text: fmt(each),
    role: "display",
    weight: 800,
    size: priceSize * 1.1,
    color: accent,
    anchor: 0.5,
  });
  eachText.position.set(cx, eachY);
  eachText.alpha = 0;
  root.addChild(eachText);
  timeline
    .to(eachText, { prop: "alpha", from: 0, to: 1, start: SPLIT_AT + 0.1, duration: 0.35, ease: outQuad })
    .to(eachText, { prop: "y", from: eachY + priceSize * 0.3, to: eachY, start: SPLIT_AT + 0.1, duration: 0.75, ease: outExpo })
    .to(eachText, { prop: "scale.x", from: 0.8, to: 1, start: SPLIT_AT + 0.1, duration: 0.7, ease: outBack })
    .to(eachText, { prop: "scale.y", from: 0.8, to: 1, start: SPLIT_AT + 0.1, duration: 0.7, ease: outBack });

  const capLabel = `${parts} payments · ${cadence}`;
  const cap = makeText(fonts, {
    text: capLabel,
    role: "body",
    weight: 700,
    size: chipSize * 0.95,
    color: textColor,
    anchor: 0.5,
  });
  const capY = eachY + priceSize * 0.72;
  cap.alpha = 0;
  cap.position.set(cx, capY);
  root.addChild(cap);
  timeline
    .to(cap, { prop: "alpha", from: 0, to: 0.72, start: SPLIT_AT + 0.35, duration: 0.45, ease: outQuad })
    .to(cap, { prop: "y", from: capY + chipSize * 0.5, to: capY, start: SPLIT_AT + 0.35, duration: 0.75, ease: outQuint });

  // --- The dated track of payments ---
  const trackY = capY + chipSize * 3.0;
  const gap = colW / parts;
  const dotR = Math.max(6, chipSize * 0.28);

  if (showTrack) {
    const line = new Graphics()
      .rect(0, -Math.max(1, chipSize * 0.05), colW - gap, Math.max(2, chipSize * 0.1))
      .fill({ color: textColor, alpha: 0.18 });
    line.position.set(cx - colW / 2 + gap / 2, trackY);
    line.scale.x = 0;
    root.addChild(line);
    timeline.to(line, { prop: "scale.x", from: 0, to: 1, start: SPLIT_AT + 0.4, duration: 0.7, ease: outExpo });
  }

  for (let i = 0; i < parts; i++) {
    const x = cx - colW / 2 + gap * (i + 0.5);
    const stop = new Container();
    stop.position.set(x, trackY);
    root.addChild(stop);

    stop.addChild(new Graphics().circle(0, 0, dotR).fill(i === 0 ? accent : textColor));
    if (i > 0) stop.addChild(new Graphics().circle(0, 0, dotR * 0.45).fill(bg));

    const amount = makeText(fonts, {
      text: fmt(each),
      role: "display",
      weight: 800,
      size: chipSize,
      color: textColor,
      anchor: 0.5,
    });
    amount.y = -dotR * 2.4;
    stop.addChild(amount);

    const when = makeText(fonts, {
      text: i === 0 ? "today" : `wk ${i * 2}`,
      role: "body",
      weight: 600,
      size: chipSize * 0.72,
      color: i === 0 ? accent : textColor,
      anchor: 0.5,
    });
    when.alpha = i === 0 ? 1 : 0.55;
    when.y = dotR * 2.4;
    stop.addChild(when);

    const at = SPLIT_AT + 0.55 + i * PER_CHIP;
    stop.alpha = 0;
    timeline
      .to(stop, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.32, ease: outQuad })
      .to(stop, { prop: "scale.x", from: 0.6, to: 1, start: at, duration: 0.55, ease: outBack })
      .to(stop, { prop: "scale.y", from: 0.6, to: 1, start: at, duration: 0.55, ease: outBack });
  }

  if (footnote.length > 0) {
    const f = makeText(fonts, {
      text: footnote,
      role: "body",
      weight: 500,
      size: chipSize * 0.68,
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    const fy = trackY + chipSize * 3.6;
    f.alpha = 0;
    f.position.set(cx, fy);
    root.addChild(f);
    timeline.to(f, { prop: "alpha", from: 0, to: 0.5, start: SPLIT_AT + 1.0, duration: 0.5, ease: outQuad });
  }

  return { timeline, duration: DURATION };
}

export const payInFour: TemplateDefinition = {
  id: "pay-in-four",
  name: "Pay in 4",
  tagline: "The price divides into equal instalments and walks out along a dated track.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { price: "display", caption: "body" },
  palettes: PALETTES,
  fields: [
    { key: "product", type: "text", label: "Product", default: "The weekender bag", maxLength: 40 },
    { key: "price", type: "text", label: "Full price", default: "€196", maxLength: 14 },
    { key: "parts", type: "slider", label: "Payments", default: 4, min: 2, max: 6, step: 1 },
    { key: "cadence", type: "text", label: "Cadence", default: "every 2 weeks", maxLength: 24 },
    { key: "footnote", type: "text", label: "Small print", default: "No interest, no fees", maxLength: 50, optional: true },
    { key: "showTrack", type: "toggle", label: "Payment track", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

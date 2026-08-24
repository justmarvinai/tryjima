import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outBack,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Product Pin — the shoppable-video tag: a pulsing dot lands on the item in
// frame, then a price card unfurls sideways from it. Two beats, because the
// viewer needs to see *where* before they read *what*.
//
// The pulse is a pair of expanding rings on a 1.6s cycle driven from `update`,
// so it keeps breathing for as long as the clip runs instead of playing once.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "clean", name: "Clean", colors: { background: "#15161A", textColor: "#FFFFFF", accent: "#111318" } },
  { id: "punch", name: "Punch", colors: { background: "#151013", textColor: "#FFFFFF", accent: "#E11D48" } },
  { id: "mint", name: "Mint", colors: { background: "#0E1714", textColor: "#0B1F18", accent: "#34D399" } },
  { id: "paper", name: "Paper", colors: { background: "#F5F4F1", textColor: "#FFFFFF", accent: "#111318" } },
];

interface Layout {
  cardFrac: number;
  labelFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { cardFrac: 0.26, labelFrac: 0.026 };
    case "9:16":
      return { cardFrac: 0.52, labelFrac: 0.036 };
    case "4:5":
      return { cardFrac: 0.46, labelFrac: 0.033 };
    case "1:1":
    default:
      return { cardFrac: 0.44, labelFrac: 0.033 };
  }
}

const DOT_AT = 0.3;
const CARD_AT = 0.85;
const DURATION = 4.8;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#15161A"));
  const card = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#111318"));
  const name = str(values.name, "Linen shirt");
  const price = str(values.price, "€68");
  const note = str(values.note, "").trim();
  const px = num(values.x, 0.38);
  const py = num(values.y, 0.5);
  const showPulse = on(values.showPulse);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width * Math.max(0.08, Math.min(0.92, px));
  const cy = size.height * Math.max(0.1, Math.min(0.9, py));
  const dotR = Math.max(8, size.width * 0.013);
  const labelSize = Math.round(size.width * L.labelFrac);

  const timeline = new JimaTimeline();

  // --- Pulse rings (behind the dot) ---
  const rings: Graphics[] = [];
  if (showPulse) {
    for (let i = 0; i < 2; i++) {
      const g = new Graphics().circle(0, 0, dotR).stroke({ color: card, width: Math.max(2, dotR * 0.22) });
      g.position.set(cx, cy);
      root.addChild(g);
      rings.push(g);
    }
  }

  // --- The dot ---
  const dot = new Container();
  dot.position.set(cx, cy);
  root.addChild(dot);
  dot.addChild(new Graphics().circle(0, 0, dotR).fill(card));
  dot.addChild(new Graphics().circle(0, 0, dotR * 0.42).fill(accent));
  dot.scale.set(0);
  timeline
    .to(dot, { prop: "scale.x", from: 0, to: 1, start: DOT_AT, duration: 0.5, ease: outBack })
    .to(dot, { prop: "scale.y", from: 0, to: 1, start: DOT_AT, duration: 0.5, ease: outBack });

  // --- Price card, unfurling away from the nearer edge ---
  const right = cx < size.width * 0.55;
  const dir = right ? 1 : -1;
  const cardW = size.width * L.cardFrac;
  const padX = labelSize * 0.85;
  const padY = labelSize * 0.7;
  const cardH = padY * 2 + labelSize * (note ? 2.5 : 1.55);

  const holder = new Container();
  holder.position.set(cx + dir * dotR * 1.9, cy);
  root.addChild(holder);

  const body = new Graphics()
    .roundRect(right ? 0 : -cardW, -cardH / 2, cardW, cardH, labelSize * 0.5)
    .fill(card);
  holder.addChild(body);

  const textX = right ? padX : -cardW + padX;
  const nameText = makeText(fonts, {
    text: name,
    role: "display",
    weight: 700,
    size: labelSize,
    color: accent,
    anchor: { x: 0, y: 0.5 },
  });
  const priceText = makeText(fonts, {
    text: price,
    role: "display",
    weight: 800,
    size: labelSize * 1.05,
    color: accent,
    anchor: { x: 1, y: 0.5 },
  });
  const nameMax = cardW - padX * 2 - priceText.width - labelSize * 0.5;
  if (nameText.width > nameMax) nameText.scale.set(Math.max(0.55, nameMax / nameText.width));
  nameText.position.set(textX, note ? -labelSize * 0.42 : 0);
  priceText.position.set(right ? cardW - padX : -padX, note ? -labelSize * 0.42 : 0);
  holder.addChild(nameText, priceText);

  if (note.length > 0) {
    const n = makeText(fonts, {
      text: note,
      role: "body",
      weight: 500,
      size: labelSize * 0.66,
      color: accent,
      anchor: { x: 0, y: 0.5 },
    });
    n.alpha = 0.62;
    n.position.set(textX, labelSize * 0.62);
    holder.addChild(n);
  }

  // A clip anchored at the dot so the card genuinely grows out of it.
  const clip = new Graphics()
    .rect(right ? 0 : -cardW, -cardH, cardW, cardH * 2)
    .fill("#FFFFFF");
  holder.addChild(clip);
  holder.mask = clip;
  clip.scale.x = 0;
  timeline
    .to(clip, { prop: "scale.x", from: 0, to: 1, start: CARD_AT, duration: 0.55, ease: outExpo })
    .to(holder, { prop: "alpha", from: 0, to: 1, start: CARD_AT, duration: 0.15, ease: outQuad });
  holder.alpha = 0;

  // The rings keep breathing — a shoppable tag that pulses once looks broken.
  const update = (t: number): void => {
    for (let i = 0; i < rings.length; i++) {
      const u = ((t - DOT_AT - i * 0.8) / 1.6) % 1;
      const g = rings[i]!;
      if (t < DOT_AT || u < 0) {
        g.alpha = 0;
        continue;
      }
      const e = 1 - Math.pow(1 - u, 3);
      g.scale.set(1 + e * 3.1);
      g.alpha = 0.5 * (1 - u);
    }
  };
  update(0);

  return { timeline, duration: DURATION, update };
}

export const productPin: TemplateDefinition = {
  id: "product-pin",
  name: "Product Pin",
  tagline: "A pulsing tag lands on the item, then a price card unfurls out of it.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: true,
  posterTime: 2.4,
  fontRoles: { name: "display", note: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Product", default: "Linen shirt", maxLength: 28, shrinkToFit: true },
    { key: "price", type: "text", label: "Price", default: "€68", maxLength: 12 },
    { key: "note", type: "text", label: "Note", default: "Tap to shop", maxLength: 28, optional: true },
    { key: "x", type: "slider", label: "Pin across", default: 0.38, min: 0.08, max: 0.92, step: 0.02 },
    { key: "y", type: "slider", label: "Pin down", default: 0.5, min: 0.1, max: 0.9, step: 0.02 },
    { key: "showPulse", type: "toggle", label: "Pulse rings", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Card", default: "", optional: true },
    { key: "accent", type: "color", label: "Type", default: "", optional: true },
  ],
  build,
};

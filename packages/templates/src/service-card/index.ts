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
import { makeIcon } from "../shared/icons";

// Service Package — what a freelancer or studio actually sells: the package
// name, what's in it, what it costs, and how long it takes. Inclusions tick in
// one by one, which is the beat that makes the price feel earned.
//
// `pricing-tiers` (showcase) compares three columns; this is one offer, at the
// size a phone can read, and it carries a turnaround line no tier table has.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#111318", textColor: "#F4F5F7", accent: "#8B5CF6" } },
  { id: "paper", name: "Paper", colors: { background: "#F6F5F1", textColor: "#15161A", accent: "#2F7D5B" } },
  { id: "sand", name: "Sand", colors: { background: "#F8F1E7", textColor: "#1F180F", accent: "#B45309" } },
  { id: "navy", name: "Navy", colors: { background: "#0E1424", textColor: "#EDF1F9", accent: "#60A5FA" } },
];

interface Layout {
  cardFrac: number;
  nameFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { cardFrac: 0.42, nameFrac: 0.036, centerFrac: 0.5 };
    case "9:16":
      return { cardFrac: 0.86, nameFrac: 0.05, centerFrac: 0.48 };
    case "4:5":
      return { cardFrac: 0.82, nameFrac: 0.046, centerFrac: 0.49 };
    case "1:1":
    default:
      return { cardFrac: 0.8, nameFrac: 0.045, centerFrac: 0.49 };
  }
}

const CARD_AT = 0.25;
const FIRST_AT = 1.0;
const PER_ITEM = 0.19;
const DURATION = 5.4;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#111318"));
  const textColor = str(values.textColor, pc("textColor", "#F4F5F7"));
  const accent = str(values.accent, pc("accent", "#8B5CF6"));
  const name = str(values.name, "Brand starter");
  const price = str(values.price, "from €1,400");
  const turnaround = str(values.turnaround, "").trim();
  const items = (Array.isArray(values.includes) ? (values.includes as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 6);
  const cta = str(values.cta, "").trim();
  const showRibbon = on(values.showRibbon);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cardW = size.width * L.cardFrac;
  const nameSize = Math.round(size.width * L.nameFrac);
  const itemSize = Math.round(nameSize * 0.55);
  const padX = nameSize * 0.85;
  const padY = nameSize * 0.9;
  const rowH = itemSize * 2.2;

  const headBlock = nameSize * 2.5 + (turnaround ? itemSize * 1.6 : 0);
  const ctaBlock = cta ? itemSize * 3.4 : 0;
  const cardH = padY * 2 + headBlock + items.length * rowH + itemSize * 0.8 + ctaBlock;
  const cy = size.height * L.centerFrac;

  const timeline = new JimaTimeline();
  const card = new Container();
  card.position.set(cx, cy);
  root.addChild(card);

  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2, -cardH / 2, cardW, cardH, nameSize * 0.55)
      .fill({ color: textColor, alpha: 0.05 })
      .stroke({ color: textColor, width: Math.max(1, size.width * 0.0012), alpha: 0.16 }),
  );

  const left = -cardW / 2 + padX;
  const top = -cardH / 2 + padY;

  // --- A corner ribbon, because a package post wants a flag ---
  if (showRibbon) {
    const rSize = itemSize * 0.72;
    const label = makeText(fonts, {
      text: "MOST BOOKED",
      role: "body",
      weight: 800,
      size: rSize,
      color: bg,
      anchor: 0.5,
      letterSpacing: rSize * 0.1,
    });
    const w = label.width + rSize * 1.8;
    const h = rSize * 2.1;
    const holder = new Container();
    holder.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(accent), label);
    holder.position.set(cardW / 2 - w / 2 - padX * 0.4, -cardH / 2);
    holder.scale.set(0);
    card.addChild(holder);
    timeline
      .to(holder, { prop: "scale.x", from: 0, to: 1, start: CARD_AT + 0.35, duration: 0.5, ease: outBack })
      .to(holder, { prop: "scale.y", from: 0, to: 1, start: CARD_AT + 0.35, duration: 0.5, ease: outBack });
  }

  // --- Name & price ---
  const nameText = makeText(fonts, {
    text: name,
    role: "display",
    weight: 800,
    size: nameSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  if (nameText.width > cardW - padX * 2) nameText.scale.set((cardW - padX * 2) / nameText.width);
  nameText.position.set(left, top + nameSize * 0.5);
  nameText.alpha = 0;
  card.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: CARD_AT + 0.2, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "x", from: left - nameSize * 0.3, to: left, start: CARD_AT + 0.2, duration: 0.7, ease: outExpo });

  const priceText = makeText(fonts, {
    text: price,
    role: "display",
    weight: 800,
    size: nameSize * 0.78,
    color: accent,
    anchor: { x: 0, y: 0.5 },
  });
  priceText.position.set(left, top + nameSize * 1.55);
  priceText.alpha = 0;
  card.addChild(priceText);
  timeline
    .to(priceText, { prop: "alpha", from: 0, to: 1, start: CARD_AT + 0.35, duration: 0.4, ease: outQuad })
    .to(priceText, { prop: "y", from: top + nameSize * 1.8, to: top + nameSize * 1.55, start: CARD_AT + 0.35, duration: 0.7, ease: outExpo });

  if (turnaround.length > 0) {
    const tt = makeText(fonts, {
      text: turnaround,
      role: "body",
      weight: 600,
      size: itemSize * 0.92,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    tt.alpha = 0;
    tt.position.set(left, top + nameSize * 2.35);
    card.addChild(tt);
    timeline.to(tt, { prop: "alpha", from: 0, to: 0.6, start: CARD_AT + 0.5, duration: 0.45, ease: outQuad });
  }

  // --- Inclusions ---
  const listTop = top + headBlock + itemSize * 0.4;
  items.forEach((label, i) => {
    const y = listTop + rowH * (i + 0.5);
    const row = new Container();
    row.position.set(left, y);
    card.addChild(row);

    const tick = makeIcon("check", itemSize * 1.1, { color: accent });
    tick.position.set(itemSize * 0.6, 0);
    row.addChild(tick);

    const t = makeText(fonts, {
      text: label,
      role: "body",
      weight: 500,
      size: itemSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    t.alpha = 0.9;
    t.position.set(itemSize * 1.7, 0);
    row.addChild(t);

    const at = FIRST_AT + i * PER_ITEM;
    row.alpha = 0;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad })
      .to(row, { prop: "x", from: left - itemSize * 0.7, to: left, start: at, duration: 0.65, ease: outExpo });
    timeline
      .to(tick, { prop: "scale.x", from: 0.3, to: 1, start: at + 0.05, duration: 0.45, ease: outBack })
      .to(tick, { prop: "scale.y", from: 0.3, to: 1, start: at + 0.05, duration: 0.45, ease: outBack });
  });

  // --- CTA ---
  if (cta.length > 0) {
    const label = makeText(fonts, { text: cta, role: "display", weight: 800, size: itemSize * 1.05, color: bg, anchor: 0.5 });
    const w = Math.min(cardW - padX * 2, label.width + itemSize * 3);
    const h = itemSize * 2.7;
    const holder = new Container();
    holder.addChild(new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(accent), label);
    const y = cardH / 2 - padY - h / 2;
    holder.position.set(0, y);
    holder.alpha = 0;
    card.addChild(holder);
    const at = FIRST_AT + items.length * PER_ITEM + 0.2;
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.32, ease: outQuad })
      .to(holder, { prop: "y", from: y + itemSize * 0.6, to: y, start: at, duration: 0.7, ease: outQuint })
      .to(holder, { prop: "scale.x", from: 0.86, to: 1, start: at, duration: 0.6, ease: outBack })
      .to(holder, { prop: "scale.y", from: 0.86, to: 1, start: at, duration: 0.6, ease: outBack });
  }

  card.alpha = 0;
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: CARD_AT, duration: 0.4, ease: outQuad })
    .to(card, { prop: "y", from: cy + cardH * 0.1, to: cy, start: CARD_AT, duration: 0.9, ease: outExpo })
    .to(card, { prop: "scale.x", from: 0.94, to: 1, start: CARD_AT, duration: 0.85, ease: outExpo })
    .to(card, { prop: "scale.y", from: 0.94, to: 1, start: CARD_AT, duration: 0.85, ease: outExpo });

  return { timeline, duration: DURATION };
}

export const serviceCard: TemplateDefinition = {
  id: "service-card",
  name: "Service Package",
  tagline: "One offer, priced — what's included ticks in line by line, then the CTA.",
  category: "promo",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.8,
  fontRoles: { name: "display", includes: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Package", default: "Brand starter", maxLength: 30, shrinkToFit: true },
    { key: "price", type: "text", label: "Price", default: "from €1,400", maxLength: 22 },
    { key: "turnaround", type: "text", label: "Turnaround", default: "2–3 weeks · 2 revisions", maxLength: 40, optional: true },
    {
      key: "includes",
      type: "textlist",
      label: "Included",
      default: ["Logo & wordmark", "Colour and type system", "Social templates", "One-page brand guide"],
      minItems: 1,
      maxItems: 6,
      maxLength: 36,
    },
    { key: "cta", type: "text", label: "Button", default: "Enquire in bio", maxLength: 26, optional: true },
    { key: "showRibbon", type: "toggle", label: "Ribbon", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

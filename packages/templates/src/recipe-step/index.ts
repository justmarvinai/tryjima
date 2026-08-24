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

// Recipe Step — the overlay that belongs on every cooking, craft and how-to
// clip: a big step number, what you are doing, and the quantities for this step
// stacked beside it. Drop it over the footage of the actual step.
//
// `step-flow` (explainers) shows all the steps at once as a diagram. This is
// one step, over video, sized to be read on a phone while something fries.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "kitchen", name: "Kitchen", colors: { background: "#141210", textColor: "#FBF6EE", accent: "#E4772E" } },
  { id: "fresh", name: "Fresh", colors: { background: "#0F1A14", textColor: "#EEF7F1", accent: "#43C07C" } },
  { id: "paper", name: "Paper", colors: { background: "#FAF7F1", textColor: "#1A1712", accent: "#C2410C" } },
  { id: "berry", name: "Berry", colors: { background: "#1B0F16", textColor: "#FDF0F5", accent: "#DB2777" } },
];

interface Layout {
  cardWFrac: number;
  sideFrac: number;
  bottomFrac: number;
  titleFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { cardWFrac: 0.4, sideFrac: 0.06, bottomFrac: 0.1, titleFrac: 0.035 };
    case "9:16":
      return { cardWFrac: 0.84, sideFrac: 0.08, bottomFrac: 0.16, titleFrac: 0.05 };
    case "4:5":
      return { cardWFrac: 0.8, sideFrac: 0.08, bottomFrac: 0.12, titleFrac: 0.046 };
    case "1:1":
    default:
      return { cardWFrac: 0.66, sideFrac: 0.07, bottomFrac: 0.11, titleFrac: 0.044 };
  }
}

const IN_AT = 0.25;
const ITEM_AT = 0.85;
const PER_ITEM = 0.16;
const DURATION = 5.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#141210"));
  const textColor = str(values.textColor, pc("textColor", "#FBF6EE"));
  const accent = str(values.accent, pc("accent", "#E4772E"));
  const stepNo = Math.round(num(values.step, 2));
  const title = str(values.title, "Fold in the butter");
  const items = (Array.isArray(values.items) ? (values.items as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 5);
  const timer = str(values.timer, "").trim();
  const showCard = on(values.showCard);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cardW = size.width * L.cardWFrac;
  const titleSize = Math.round(size.width * L.titleFrac);
  const itemSize = Math.round(titleSize * 0.62);
  const numSize = Math.round(titleSize * 1.85);
  const padX = titleSize * 0.72;
  const padY = titleSize * 0.6;
  const rowH = itemSize * 1.62;

  const bodyH = titleSize * 1.35 + (items.length ? rowH * items.length + titleSize * 0.35 : 0);
  const cardH = bodyH + padY * 2;
  const left = size.width * L.sideFrac;
  const cardTop = size.height - size.height * L.bottomFrac - cardH;

  const timeline = new JimaTimeline();
  const group = new Container();
  group.position.set(left, cardTop);
  root.addChild(group);

  if (showCard) {
    const r = titleSize * 0.42;
    group.addChild(
      new Graphics()
        .roundRect(0, 0, cardW, cardH, r)
        .fill({ color: bg, alpha: 0.82 })
        .stroke({ color: textColor, width: Math.max(1, size.width * 0.0011), alpha: 0.18 }),
    );
  }

  // --- Step badge: a filled disc with the number, dropped in with a bounce ---
  const badgeR = numSize * 0.52;
  const badge = new Container();
  badge.position.set(padX + badgeR * 0.1, -badgeR * 0.32);
  const disc = new Graphics().circle(0, 0, badgeR).fill(accent);
  const numText = makeText(fonts, {
    text: String(Math.max(1, Math.min(99, stepNo))),
    role: "display",
    weight: 800,
    size: numSize * 0.72,
    color: bg,
    anchor: 0.5,
  });
  numText.y = -numSize * 0.02;
  badge.addChild(disc, numText);
  group.addChild(badge);
  badge.scale.set(0);
  timeline
    .to(badge, { prop: "scale.x", from: 0, to: 1, start: IN_AT + 0.1, duration: 0.55, ease: outBack })
    .to(badge, { prop: "scale.y", from: 0, to: 1, start: IN_AT + 0.1, duration: 0.55, ease: outBack });

  // --- Title ---
  const titleX = padX + badgeR * 2.2;
  const t = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  const maxTitleW = cardW - titleX - padX;
  if (t.width > maxTitleW) t.scale.set(maxTitleW / t.width);
  t.position.set(titleX, padY + titleSize * 0.5);
  t.alpha = 0;
  group.addChild(t);
  timeline
    .to(t, { prop: "alpha", from: 0, to: 1, start: IN_AT + 0.22, duration: 0.45, ease: outQuad })
    .to(t, { prop: "x", from: titleX - titleSize * 0.35, to: titleX, start: IN_AT + 0.22, duration: 0.75, ease: outExpo });

  // --- Quantities: a dot, the amount in accent, then the ingredient ---
  items.forEach((line, i) => {
    const y = padY + titleSize * 1.35 + rowH * (i + 0.5);
    const row = new Container();
    row.position.set(titleX, y);
    group.addChild(row);

    const dot = new Graphics().circle(0, 0, itemSize * 0.16).fill(accent);
    dot.x = -itemSize * 0.5;
    row.addChild(dot);

    // "200 g flour" — the leading quantity is set in the accent so the amounts
    // scan down the column without reading the whole line.
    const m = /^([\d.,/¼-¾]+\s*\S*)\s+(.*)$/.exec(line);
    const qty = m ? m[1]! : "";
    const rest = m ? m[2]! : line;
    let x = 0;
    if (qty) {
      const q = makeText(fonts, {
        text: qty,
        role: "body",
        weight: 800,
        size: itemSize,
        color: accent,
        anchor: { x: 0, y: 0.5 },
      });
      q.position.set(0, 0);
      row.addChild(q);
      x = q.width + itemSize * 0.32;
    }
    const r = makeText(fonts, {
      text: rest,
      role: "body",
      weight: 500,
      size: itemSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    r.alpha = 0.88;
    r.position.set(x, 0);
    row.addChild(r);

    const at = ITEM_AT + i * PER_ITEM;
    row.alpha = 0;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.4, ease: outQuad })
      .to(row, { prop: "x", from: titleX - itemSize * 0.6, to: titleX, start: at, duration: 0.7, ease: outExpo });
  });

  // --- Timer pill, top-right of the card ---
  if (timer.length > 0) {
    const tSize = Math.round(itemSize * 0.92);
    const label = makeText(fonts, {
      text: timer,
      role: "body",
      weight: 800,
      size: tSize,
      color: bg,
      anchor: 0.5,
    });
    const w = label.width + tSize * 1.2;
    const h = tSize * 1.85;
    const pill = new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(textColor);
    const holder = new Container();
    holder.addChild(pill, label);
    holder.position.set(cardW - padX - w / 2, padY + titleSize * 0.5);
    holder.alpha = 0;
    group.addChild(holder);
    timeline
      .to(holder, { prop: "alpha", from: 0, to: 1, start: IN_AT + 0.5, duration: 0.4, ease: outQuad })
      .to(holder, {
        prop: "y",
        from: padY + titleSize * 0.5 - tSize * 0.4,
        to: padY + titleSize * 0.5,
        start: IN_AT + 0.5,
        duration: 0.7,
        ease: outQuint,
      });
  }

  group.alpha = 0;
  timeline
    .to(group, { prop: "alpha", from: 0, to: 1, start: IN_AT, duration: 0.4, ease: outQuad })
    .to(group, { prop: "y", from: cardTop + cardH * 0.2, to: cardTop, start: IN_AT, duration: 0.8, ease: outExpo });

  return { timeline, duration: DURATION };
}

export const recipeStep: TemplateDefinition = {
  id: "recipe-step",
  name: "Recipe Step",
  tagline: "Step number, what you're doing, and the quantities — over the footage of the step.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { title: "display", items: "body" },
  palettes: PALETTES,
  fields: [
    { key: "step", type: "slider", label: "Step number", default: 2, min: 1, max: 20, step: 1 },
    { key: "title", type: "text", label: "What to do", default: "Fold in the butter", maxLength: 40, shrinkToFit: true },
    {
      key: "items",
      type: "textlist",
      label: "Quantities",
      default: ["120 g butter", "2 tbsp sugar", "1 tsp vanilla"],
      minItems: 0,
      maxItems: 5,
      maxLength: 30,
    },
    { key: "timer", type: "text", label: "Timer", default: "4 min", maxLength: 12, optional: true },
    { key: "showCard", type: "toggle", label: "Card behind", default: true },
    { key: "background", type: "color", label: "Card", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

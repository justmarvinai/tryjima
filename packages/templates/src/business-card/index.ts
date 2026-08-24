import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  inOutQuint,
  outExpo,
  outQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Business Card — the card flips from its front (the mark) to its back (the
// details), the way you turn one over in your hand. The identity-post format
// for a rebrand, a new role, or a print run.
//
// The flip is a real edge-on turn: the card squeezes to nothing on x at the
// halfway point and the two faces swap there, which is the only way to fake a
// Y-axis rotation in 2D without it reading as a crossfade.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#EDEDEA", textColor: "#131417", accent: "#E0483C" } },
  { id: "night", name: "Night", colors: { background: "#101216", textColor: "#F4F4F6", accent: "#F2B33D" } },
  { id: "sage", name: "Sage", colors: { background: "#E9F0EA", textColor: "#111E16", accent: "#2F7D5B" } },
  { id: "navy", name: "Navy", colors: { background: "#E9EDF6", textColor: "#101728", accent: "#2554D4" } },
];

interface Layout {
  cardFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { cardFrac: 0.4, centerFrac: 0.48 };
    case "9:16":
      return { cardFrac: 0.8, centerFrac: 0.46 };
    case "4:5":
      return { cardFrac: 0.74, centerFrac: 0.47 };
    case "1:1":
    default:
      return { cardFrac: 0.7, centerFrac: 0.47 };
  }
}

const IN_AT = 0.3;
const FLIP_AT = 1.35;
const FLIP_DUR = 0.8;
const DURATION = 5.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EDEDEA"));
  const textColor = str(values.textColor, pc("textColor", "#131417"));
  const accent = str(values.accent, pc("accent", "#E0483C"));
  const mark = str(values.mark, "FIKA");
  const name = str(values.name, "Marta Vidal");
  const role = str(values.role, "Creative director");
  const details = (Array.isArray(values.details) ? (values.details as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 4);
  const showShadow = on(values.showShadow);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cy = size.height * L.centerFrac;
  const W = Math.min(size.width * L.cardFrac, size.height * 0.6);
  const H = W * 0.58; // 85×55mm, near enough
  const r = W * 0.03;
  const unit = W * 0.055;

  const timeline = new JimaTimeline();
  const card = new Container();
  card.position.set(cx, cy);
  root.addChild(card);

  if (showShadow) {
    for (let i = 7; i >= 1; i--) {
      const f = i / 7;
      card.addChild(
        new Graphics()
          .roundRect(-W / 2 - W * 0.012 * f, -H / 2 + H * 0.05, W + W * 0.024 * f, H, r)
          .fill({ color: "#000000", alpha: 0.035 }),
      );
    }
  }

  // --- Front: the mark on the accent ---
  const front = new Container();
  card.addChild(front);
  front.addChild(new Graphics().roundRect(-W / 2, -H / 2, W, H, r).fill(accent));
  const markText = makeText(fonts, {
    text: mark.toUpperCase(),
    role: "display",
    weight: 800,
    size: unit * 2.6,
    color: bg,
    anchor: 0.5,
    letterSpacing: unit * 0.28,
  });
  if (markText.width > W * 0.7) markText.scale.set((W * 0.7) / markText.width);
  front.addChild(markText);
  front.addChild(
    new Graphics()
      .rect(-W * 0.09, H * 0.16, W * 0.18, Math.max(2, unit * 0.14))
      .fill({ color: bg, alpha: 0.6 }),
  );

  // --- Back: name, role, contact lines ---
  const back = new Container();
  card.addChild(back);
  back.addChild(
    new Graphics()
      .roundRect(-W / 2, -H / 2, W, H, r)
      .fill(bg)
      .stroke({ color: textColor, width: Math.max(1, W * 0.002), alpha: 0.12 }),
  );
  const padX = W * 0.09;
  const n = makeText(fonts, {
    text: name,
    role: "display",
    weight: 800,
    size: unit * 1.3,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  n.position.set(-W / 2 + padX, -H * 0.24);
  back.addChild(n);
  const rl = makeText(fonts, {
    text: role,
    role: "body",
    weight: 600,
    size: unit * 0.86,
    color: accent,
    anchor: { x: 0, y: 0.5 },
  });
  rl.position.set(-W / 2 + padX, -H * 0.08);
  back.addChild(rl);

  details.slice(0, 4).forEach((line, i) => {
    const d = makeText(fonts, {
      text: line,
      role: "body",
      weight: 500,
      size: unit * 0.76,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    d.alpha = 0.66;
    d.position.set(-W / 2 + padX, H * 0.1 + unit * 1.05 * i);
    back.addChild(d);
  });
  // A small accent square in the far corner, so the back is not just a list.
  back.addChild(new Graphics().rect(W / 2 - padX - unit, -H / 2 + padX, unit, unit).fill(accent));

  back.scale.x = 0;
  front.scale.x = 1;

  // The turn: front squeezes to zero, back opens from zero, swapping exactly at
  // the halfway point where the card is edge-on.
  timeline
    .to(front, { prop: "scale.x", from: 1, to: 0, start: FLIP_AT, duration: FLIP_DUR / 2, ease: inOutQuint })
    .to(back, { prop: "scale.x", from: 0, to: 1, start: FLIP_AT + FLIP_DUR / 2, duration: FLIP_DUR / 2, ease: inOutQuint })
    // A small tilt through the turn sells the axis.
    .to(card, { prop: "rotation", from: 0, to: -0.045, start: FLIP_AT, duration: FLIP_DUR / 2, ease: inOutQuint })
    .to(card, { prop: "rotation", from: -0.045, to: 0, start: FLIP_AT + FLIP_DUR / 2, duration: FLIP_DUR / 2, ease: inOutQuint });

  card.alpha = 0;
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: IN_AT, duration: 0.4, ease: outQuad })
    .to(card, { prop: "y", from: cy + H * 0.2, to: cy, start: IN_AT, duration: 0.9, ease: outExpo })
    .to(card, { prop: "scale.y", from: 0.9, to: 1, start: IN_AT, duration: 0.85, ease: outExpo });

  return { timeline, duration: DURATION };
}

export const businessCard: TemplateDefinition = {
  id: "business-card",
  name: "Business Card",
  tagline: "The card turns edge-on and flips from the mark to the details, like in your hand.",
  category: "showcase",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { mark: "display", details: "body" },
  palettes: PALETTES,
  fields: [
    { key: "mark", type: "text", label: "Mark / wordmark", default: "FIKA", maxLength: 14 },
    { key: "name", type: "text", label: "Name", default: "Marta Vidal", maxLength: 26 },
    { key: "role", type: "text", label: "Role", default: "Creative director", maxLength: 30 },
    {
      key: "details",
      type: "textlist",
      label: "Contact lines",
      default: ["marta@fika.studio", "+351 912 000 000", "fika.studio"],
      minItems: 0,
      maxItems: 4,
      maxLength: 30,
    },
    { key: "showShadow", type: "toggle", label: "Drop shadow", default: true },
    { key: "background", type: "color", label: "Background & back", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Front", default: "", optional: true },
  ],
  build,
};

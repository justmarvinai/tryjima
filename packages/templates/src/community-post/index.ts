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
import { avatar } from "../shared/ui";

// Community Post — a text-only post card with a reaction row that fills in
// after it lands: the emoji counts tick up one bar at a time. The format for
// announcements that do not need a picture.
//
// `pinned-post` pins someone else's; `quote-reel` sets a quotation. This is
// your own account speaking, with the reaction bar as the proof it landed.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#EFEEEA", textColor: "#15161A", accent: "#E0483C" } },
  { id: "ink", name: "Ink", colors: { background: "#101115", textColor: "#F4F4F6", accent: "#60A5FA" } },
  { id: "mint", name: "Mint", colors: { background: "#E9F4EE", textColor: "#0F1F17", accent: "#0F9D6E" } },
  { id: "butter", name: "Butter", colors: { background: "#FBF3E2", textColor: "#1D1809", accent: "#D97706" } },
];

interface Layout {
  cardFrac: number;
  bodyFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { cardFrac: 0.52, bodyFrac: 0.032, centerFrac: 0.5 };
    case "9:16":
      return { cardFrac: 0.88, bodyFrac: 0.046, centerFrac: 0.48 };
    case "4:5":
      return { cardFrac: 0.86, bodyFrac: 0.042, centerFrac: 0.49 };
    case "1:1":
    default:
      return { cardFrac: 0.84, bodyFrac: 0.042, centerFrac: 0.49 };
  }
}

const IN_AT = 0.3;
const REACT_AT = 1.1;
const DURATION = 5.0;

const EMOJI = ["👍", "🎉", "❤️", "😮"];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EFEEEA"));
  const textColor = str(values.textColor, pc("textColor", "#15161A"));
  const accent = str(values.accent, pc("accent", "#E0483C"));
  const name = str(values.name, "Fika Studio");
  const handle = str(values.handle, "@fika.studio");
  const body = str(values.body, "We're opening five workshop spots for October. Comment a 🌱 and we'll DM you.");
  const counts = (Array.isArray(values.reactions) ? (values.reactions as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 4);
  const showReactions = on(values.showReactions);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cardW = size.width * L.cardFrac;
  const bodySize = Math.round(size.width * L.bodyFrac);
  const nameSize = Math.round(bodySize * 0.82);
  const padX = bodySize * 1.0;
  const padY = bodySize * 0.95;

  const measure = (s: string) => fonts.measure(s, { family: fonts.family("body"), weight: 500, size: bodySize });
  const lines: string[] = [];
  let cur = "";
  for (const w of body.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= cardW - padX * 2 || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);

  const headerH = nameSize * 3.4;
  const lineH = bodySize * 1.36;
  const reactH = showReactions && counts.length ? bodySize * 3.0 : 0;
  const cardH = headerH + lines.length * lineH + padY * 1.2 + reactH;
  const cy = size.height * L.centerFrac;

  const timeline = new JimaTimeline();
  const card = new Container();
  card.position.set(cx, cy);
  root.addChild(card);

  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2, -cardH / 2, cardW, cardH, bodySize * 0.65)
      .fill({ color: textColor, alpha: 0.05 })
      .stroke({ color: textColor, width: Math.max(1, size.width * 0.0012), alpha: 0.14 }),
  );

  const left = -cardW / 2 + padX;
  const top = -cardH / 2 + padY;

  // --- Header ---
  const av = avatar(fonts, {
    radius: nameSize * 1.05,
    bg: accent,
    initial: name.slice(0, 1).toUpperCase(),
    textColor: bg,
  });
  av.position.set(left + nameSize * 1.05, top + nameSize * 0.85);
  card.addChild(av);

  const nameText = makeText(fonts, {
    text: name,
    role: "display",
    weight: 800,
    size: nameSize,
    color: textColor,
    anchor: { x: 0, y: 1 },
  });
  nameText.position.set(left + nameSize * 2.6, top + nameSize * 0.9);
  card.addChild(nameText);

  const handleText = makeText(fonts, {
    text: handle,
    role: "body",
    weight: 500,
    size: nameSize * 0.78,
    color: textColor,
    anchor: { x: 0, y: 0 },
  });
  handleText.alpha = 0.5;
  handleText.position.set(left + nameSize * 2.6, top + nameSize * 1.0);
  card.addChild(handleText);

  // --- Body ---
  lines.forEach((line, i) => {
    const t = makeText(fonts, {
      text: line,
      role: "body",
      weight: 500,
      size: bodySize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    t.position.set(left, top + headerH + lineH * (i + 0.5) - padY * 0.3);
    t.alpha = 0;
    card.addChild(t);
    const at = IN_AT + 0.3 + i * 0.1;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 0.92, start: at, duration: 0.4, ease: outQuad })
      .to(t, { prop: "x", from: left - bodySize * 0.25, to: left, start: at, duration: 0.7, ease: outExpo });
  });

  // --- Reaction chips, popping in with their counts ---
  if (showReactions && counts.length) {
    const y = top + headerH + lines.length * lineH + bodySize * 0.9;
    let x = left;
    counts.forEach((count, i) => {
      const chipSize = Math.round(bodySize * 0.8);
      const label = makeText(fonts, {
        text: `${EMOJI[i] ?? "👍"}  ${count}`,
        role: "body",
        weight: 700,
        size: chipSize,
        color: textColor,
        anchor: { x: 0, y: 0.5 },
      });
      const w = label.width + chipSize * 1.5;
      const h = chipSize * 2.1;
      const chip = new Container();
      chip.addChild(
        new Graphics()
          .roundRect(0, -h / 2, w, h, h / 2)
          .fill({ color: textColor, alpha: 0.07 })
          .stroke({ color: textColor, width: Math.max(1, size.width * 0.001), alpha: 0.16 }),
      );
      label.x = chipSize * 0.75;
      chip.addChild(label);
      chip.position.set(x, y);
      card.addChild(chip);
      x += w + chipSize * 0.5;

      const at = REACT_AT + i * 0.18;
      chip.alpha = 0;
      timeline
        .to(chip, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad })
        .to(chip, { prop: "y", from: y + chipSize * 0.7, to: y, start: at, duration: 0.55, ease: outExpo })
        .to(chip, { prop: "scale.x", from: 0.7, to: 1, start: at, duration: 0.55, ease: outBack })
        .to(chip, { prop: "scale.y", from: 0.7, to: 1, start: at, duration: 0.55, ease: outBack });
    });
  }

  card.alpha = 0;
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: IN_AT, duration: 0.4, ease: outQuad })
    .to(card, { prop: "y", from: cy + cardH * 0.14, to: cy, start: IN_AT, duration: 0.85, ease: outExpo })
    .to(card, { prop: "scale.x", from: 0.94, to: 1, start: IN_AT, duration: 0.8, ease: outExpo })
    .to(card, { prop: "scale.y", from: 0.94, to: 1, start: IN_AT, duration: 0.8, ease: outExpo });

  return { timeline, duration: DURATION };
}

export const communityPost: TemplateDefinition = {
  id: "community-post",
  name: "Community Post",
  tagline: "A text-only post card, with the reaction chips filling in after it lands.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { name: "display", body: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "Account", default: "Fika Studio", maxLength: 26 },
    { key: "handle", type: "text", label: "Handle", default: "@fika.studio", maxLength: 26 },
    {
      key: "body",
      type: "text",
      label: "Post",
      default: "We're opening five workshop spots for October. Comment a 🌱 and we'll DM you.",
      maxLength: 200,
    },
    {
      key: "reactions",
      type: "textlist",
      label: "Reaction counts",
      default: ["312", "84", "57"],
      minItems: 0,
      maxItems: 4,
      maxLength: 8,
    },
    { key: "showReactions", type: "toggle", label: "Reaction chips", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Avatar", default: "", optional: true },
  ],
  build,
};

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
import { avatar } from "../shared/ui";

// Super Chat — a paid highlighted message lands in a live chat and pins itself
// above the scroll, the amount on its own coloured header. The moment every
// streamer clips.
//
// `stream-chat` scrolls anonymous lines past; this is the opposite — the chat
// keeps moving underneath while one message is lifted out of it and held.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "gold", name: "Gold", colors: { background: "#131418", textColor: "#F5F5F7", accent: "#F5A623" } },
  { id: "magenta", name: "Magenta", colors: { background: "#150F16", textColor: "#F8F2F8", accent: "#D6249F" } },
  { id: "teal", name: "Teal", colors: { background: "#0C1719", textColor: "#EAF7F7", accent: "#14B8A6" } },
  { id: "paper", name: "Paper", colors: { background: "#F5F4F1", textColor: "#15161A", accent: "#E11D48" } },
];

interface Layout {
  cardFrac: number;
  nameFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { cardFrac: 0.42, nameFrac: 0.026, centerFrac: 0.44 };
    case "9:16":
      return { cardFrac: 0.86, nameFrac: 0.038, centerFrac: 0.44 };
    case "4:5":
      return { cardFrac: 0.84, nameFrac: 0.035, centerFrac: 0.44 };
    case "1:1":
    default:
      return { cardFrac: 0.82, nameFrac: 0.034, centerFrac: 0.44 };
  }
}

const CHAT_AT = 0.15;
const LAND_AT = 0.75;
const DURATION = 5.0;

const FILLER = ["nice one", "letsgo 🔥", "hi from Berlin", "wait what", "🎉🎉🎉", "same tbh", "first!", "gg"];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#131418"));
  const textColor = str(values.textColor, pc("textColor", "#F5F5F7"));
  const accent = str(values.accent, pc("accent", "#F5A623"));
  const name = str(values.name, "marta_builds");
  const amount = str(values.amount, "€20.00");
  const message = str(values.message, "This channel got me my first client. Thank you!");
  const showChat = on(values.showChat);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cardW = size.width * L.cardFrac;
  const nameSize = Math.round(size.width * L.nameFrac);
  const msgSize = Math.round(nameSize * 1.05);
  const padX = nameSize * 0.85;
  const padY = nameSize * 0.7;
  const headerH = nameSize * 3.1;

  const timeline = new JimaTimeline();

  // --- Background chat, still scrolling under the pinned message ---
  if (showChat) {
    const rowH = nameSize * 1.9;
    const chatTop = size.height * L.centerFrac + size.height * 0.16;
    for (let i = 0; i < 6; i++) {
      const row = new Container();
      const y = chatTop + rowH * i;
      row.position.set(cx - cardW / 2, y);
      root.addChild(row);
      const av = avatar(fonts, {
        radius: nameSize * 0.58,
        bg: `hsl(${Math.round(rng.range(0, 360))}, 55%, 55%)`,
        initial: String.fromCharCode(65 + Math.floor(rng.range(0, 26))),
        textColor: bg,
      });
      av.position.set(nameSize * 0.6, 0);
      row.addChild(av);
      const t = makeText(fonts, {
        text: FILLER[Math.floor(rng.range(0, FILLER.length))] ?? "nice",
        role: "body",
        weight: 500,
        size: nameSize * 0.86,
        color: textColor,
        anchor: { x: 0, y: 0.5 },
      });
      t.alpha = 0.42;
      t.position.set(nameSize * 1.5, 0);
      row.addChild(t);
      // Every row creeps upward, so the feed is alive behind the pin.
      timeline.to(row, { prop: "y", from: y + rowH * 0.9, to: y - rowH * 0.5, start: CHAT_AT, duration: DURATION, ease: (u) => u });
      row.alpha = 0;
      timeline.to(row, { prop: "alpha", from: 0, to: 1, start: CHAT_AT + i * 0.06, duration: 0.4, ease: outQuad });
    }
  }

  // --- The paid message ---
  const words = message.split(/\s+/).filter(Boolean);
  const msgW = cardW - padX * 2;
  const measure = (s: string) => fonts.measure(s, { family: fonts.family("body"), weight: 500, size: msgSize });
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= msgW || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  const bodyH = lines.length * msgSize * 1.32 + padY * 1.6;
  const cardH = headerH + bodyH;
  const cy = size.height * L.centerFrac;

  const card = new Container();
  card.position.set(cx, cy);
  root.addChild(card);

  const radius = nameSize * 0.6;
  // Header in the accent, body a touch darker — the platform convention that
  // tells you at a glance how much was paid.
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill(accent));
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2, -cardH / 2 + headerH, cardW, cardH - headerH, radius)
      .fill({ color: "#000000", alpha: 0.22 }),
  );

  const av = avatar(fonts, {
    radius: nameSize,
    bg,
    initial: name.slice(0, 1).toUpperCase(),
    textColor: accent,
  });
  av.position.set(-cardW / 2 + padX + nameSize, -cardH / 2 + headerH / 2);
  card.addChild(av);

  const nameText = makeText(fonts, {
    text: name,
    role: "display",
    weight: 800,
    size: nameSize,
    color: bg,
    anchor: { x: 0, y: 1 },
  });
  nameText.position.set(-cardW / 2 + padX + nameSize * 2.4, -cardH / 2 + headerH / 2 + nameSize * 0.06);
  card.addChild(nameText);

  const amt = makeText(fonts, {
    text: amount,
    role: "display",
    weight: 800,
    size: nameSize * 1.15,
    color: bg,
    anchor: { x: 0, y: 0 },
  });
  amt.position.set(-cardW / 2 + padX + nameSize * 2.4, -cardH / 2 + headerH / 2 + nameSize * 0.22);
  card.addChild(amt);

  lines.forEach((line, i) => {
    const t = makeText(fonts, {
      text: line,
      role: "body",
      weight: 500,
      size: msgSize,
      color: bg,
      anchor: { x: 0, y: 0.5 },
    });
    t.position.set(-cardW / 2 + padX, -cardH / 2 + headerH + padY * 0.8 + msgSize * 1.32 * (i + 0.5));
    t.alpha = 0;
    card.addChild(t);
    timeline.to(t, { prop: "alpha", from: 0, to: 0.94, start: LAND_AT + 0.3 + i * 0.08, duration: 0.4, ease: outQuad });
  });

  // Lands hard from below, overshoots, then a small settle — a paid message
  // should physically interrupt the feed.
  card.alpha = 0;
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: LAND_AT, duration: 0.2, ease: outQuad })
    .to(card, { prop: "y", from: cy + size.height * 0.16, to: cy, start: LAND_AT, duration: 0.7, ease: outExpo })
    .to(card, { prop: "scale.x", from: 0.86, to: 1, start: LAND_AT, duration: 0.65, ease: outBack })
    .to(card, { prop: "scale.y", from: 0.86, to: 1, start: LAND_AT, duration: 0.65, ease: outBack });

  // A pinned tag riding above the card.
  const pinSize = Math.round(nameSize * 0.62);
  const pin = makeText(fonts, {
    text: "PINNED",
    role: "body",
    weight: 800,
    size: pinSize,
    color: bg,
    anchor: 0.5,
    letterSpacing: pinSize * 0.12,
  });
  const pw = pin.width + pinSize * 1.5;
  const ph = pinSize * 2;
  const pinHolder = new Container();
  pinHolder.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill(textColor), pin);
  pinHolder.position.set(cx, cy - cardH / 2 - ph);
  pinHolder.scale.set(0);
  root.addChild(pinHolder);
  timeline
    .to(pinHolder, { prop: "scale.x", from: 0, to: 1, start: LAND_AT + 0.45, duration: 0.5, ease: outBack })
    .to(pinHolder, { prop: "scale.y", from: 0, to: 1, start: LAND_AT + 0.45, duration: 0.5, ease: outBack })
    .to(pinHolder, { prop: "y", from: cy - cardH / 2 - ph * 0.6, to: cy - cardH / 2 - ph, start: LAND_AT + 0.45, duration: 0.7, ease: outQuint });

  return { timeline, duration: DURATION };
}

export const superChat: TemplateDefinition = {
  id: "super-chat",
  name: "Super Chat",
  tagline: "A paid message lands in the live chat and pins itself above the scroll.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.4,
  fontRoles: { name: "display", message: "body" },
  palettes: PALETTES,
  fields: [
    { key: "name", type: "text", label: "From", default: "marta_builds", maxLength: 26 },
    { key: "amount", type: "text", label: "Amount", default: "€20.00", maxLength: 12 },
    {
      key: "message",
      type: "text",
      label: "Message",
      default: "This channel got me my first client. Thank you!",
      maxLength: 120,
    },
    { key: "showChat", type: "toggle", label: "Chat behind", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Chat text", default: "", optional: true },
    { key: "accent", type: "color", label: "Tier colour", default: "", optional: true },
  ],
  build,
};

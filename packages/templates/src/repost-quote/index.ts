import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
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

// Quote Repost — your line lands first, then the post you are quoting slides in
// beneath it inside its own nested card. The two-voice format: comment on top,
// source below, exactly as the platforms stack it.
//
// `share-repost` reposts without adding anything and `comment-thread` is a
// conversation between equals. This one has a hierarchy — your take is the
// headline and the quoted post is evidence — and the nesting is what shows it.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#101115", textColor: "#F4F4F6", accent: "#60A5FA" } },
  { id: "paper", name: "Paper", colors: { background: "#F5F4F0", textColor: "#15161A", accent: "#2563EB" } },
  { id: "forest", name: "Forest", colors: { background: "#0D1815", textColor: "#EAF7F1", accent: "#34D399" } },
  { id: "plum", name: "Plum", colors: { background: "#15101C", textColor: "#F2EEF9", accent: "#C084FC" } },
];

interface Layout {
  cardFrac: number;
  bodyFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { cardFrac: 0.5, bodyFrac: 0.03, centerFrac: 0.5 };
    case "9:16":
      return { cardFrac: 0.88, bodyFrac: 0.044, centerFrac: 0.48 };
    case "4:5":
      return { cardFrac: 0.86, bodyFrac: 0.04, centerFrac: 0.49 };
    case "1:1":
    default:
      return { cardFrac: 0.84, bodyFrac: 0.04, centerFrac: 0.49 };
  }
}

const MINE_AT = 0.3;
const QUOTED_AT = 1.05;
const DURATION = 5.2;

function wrapTo(text: string, measure: (s: string) => number, maxWidth: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(/\s+/).filter(Boolean)) {
    const next = cur ? `${cur} ${w}` : w;
    if (measure(next) <= maxWidth || !cur) cur = next;
    else {
      out.push(cur);
      cur = w;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#101115"));
  const textColor = str(values.textColor, pc("textColor", "#F4F4F6"));
  const accent = str(values.accent, pc("accent", "#60A5FA"));
  const myName = str(values.myName, "Fika Studio");
  const myHandle = str(values.myHandle, "@fika.studio");
  const myTake = str(values.myTake, "This is the whole job, honestly.");
  const theirName = str(values.theirName, "Marta Vidal");
  const theirHandle = str(values.theirHandle, "@marta.builds");
  const theirPost = str(values.theirPost, "Pick one thing. Do it every week for a year. That's the strategy.");
  const showStats = on(values.showStats);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cardW = size.width * L.cardFrac;
  const bodySize = Math.round(size.width * L.bodyFrac);
  const quoteSize = Math.round(bodySize * 0.86);
  const nameSize = Math.round(bodySize * 0.8);
  const padX = bodySize * 1.0;
  const padY = bodySize * 0.9;
  const innerPad = bodySize * 0.75;
  const innerW = cardW - padX * 2;

  const mineLines = wrapTo(
    myTake,
    (s) => fonts.measure(s, { family: fonts.family("display"), weight: 700, size: bodySize }),
    innerW,
  );
  const quotedLines = wrapTo(
    theirPost,
    (s) => fonts.measure(s, { family: fonts.family("body"), weight: 500, size: quoteSize }),
    innerW - innerPad * 2,
  );

  const headerH = nameSize * 3.2;
  const mineH = mineLines.length * bodySize * 1.32;
  const innerHeaderH = nameSize * 2.4;
  const innerH = innerHeaderH + quotedLines.length * quoteSize * 1.34 + innerPad * 1.6;
  const statsH = showStats ? bodySize * 2.1 : 0;
  const cardH = padY * 2 + headerH + mineH + bodySize * 0.7 + innerH + statsH;
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

  // --- Your header ---
  const av = avatar(fonts, { radius: nameSize * 1.05, bg: accent, initial: myName.slice(0, 1).toUpperCase(), textColor: bg });
  av.position.set(left + nameSize * 1.05, top + nameSize * 0.9);
  card.addChild(av);
  const n1 = makeText(fonts, { text: myName, role: "display", weight: 800, size: nameSize, color: textColor, anchor: { x: 0, y: 1 } });
  n1.position.set(left + nameSize * 2.6, top + nameSize * 0.95);
  const h1 = makeText(fonts, { text: myHandle, role: "body", weight: 500, size: nameSize * 0.78, color: textColor, anchor: { x: 0, y: 0 } });
  h1.alpha = 0.5;
  h1.position.set(left + nameSize * 2.6, top + nameSize * 1.05);
  card.addChild(n1, h1);

  // --- Your take ---
  const mineTop = top + headerH;
  mineLines.forEach((line, i) => {
    const t = makeText(fonts, {
      text: line,
      role: "display",
      weight: 700,
      size: bodySize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    t.position.set(left, mineTop + bodySize * 1.32 * (i + 0.5));
    t.alpha = 0;
    card.addChild(t);
    const at = MINE_AT + 0.25 + i * 0.09;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.4, ease: outQuad })
      .to(t, { prop: "x", from: left - bodySize * 0.25, to: left, start: at, duration: 0.7, ease: outExpo });
  });

  // --- The quoted post, in its own bordered card ---
  const innerTop = mineTop + mineH + bodySize * 0.7;
  const inner = new Container();
  inner.position.set(0, innerTop);
  card.addChild(inner);
  inner.addChild(
    new Graphics()
      .roundRect(left, 0, innerW, innerH, bodySize * 0.5)
      .fill({ color: textColor, alpha: 0.04 })
      .stroke({ color: textColor, width: Math.max(1, size.width * 0.0011), alpha: 0.22 }),
  );

  const iav = avatar(fonts, {
    radius: nameSize * 0.72,
    bg: textColor,
    initial: theirName.slice(0, 1).toUpperCase(),
    textColor: bg,
  });
  iav.position.set(left + innerPad + nameSize * 0.72, innerPad + nameSize * 0.72);
  inner.addChild(iav);
  const n2 = makeText(fonts, { text: theirName, role: "display", weight: 700, size: nameSize * 0.86, color: textColor, anchor: { x: 0, y: 0.5 } });
  n2.position.set(left + innerPad + nameSize * 1.85, innerPad + nameSize * 0.72);
  const h2 = makeText(fonts, { text: theirHandle, role: "body", weight: 500, size: nameSize * 0.74, color: textColor, anchor: { x: 0, y: 0.5 } });
  h2.alpha = 0.45;
  h2.position.set(n2.x + n2.width + nameSize * 0.4, innerPad + nameSize * 0.72);
  inner.addChild(n2, h2);

  quotedLines.forEach((line, i) => {
    const t = makeText(fonts, {
      text: line,
      role: "body",
      weight: 500,
      size: quoteSize,
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    t.alpha = 0.86;
    t.position.set(left + innerPad, innerHeaderH + quoteSize * 1.34 * (i + 0.5));
    inner.addChild(t);
  });

  inner.alpha = 0;
  timeline
    .to(inner, { prop: "alpha", from: 0, to: 1, start: QUOTED_AT, duration: 0.4, ease: outQuad })
    .to(inner, { prop: "y", from: innerTop + innerH * 0.28, to: innerTop, start: QUOTED_AT, duration: 0.85, ease: outExpo });

  // --- Stats row ---
  if (showStats) {
    const y = innerTop + innerH + bodySize * 1.0;
    const stats = ["1.2K reposts", "8.4K likes"];
    let x = left;
    stats.forEach((s, i) => {
      const t = makeText(fonts, {
        text: s,
        role: "body",
        weight: 600,
        size: bodySize * 0.72,
        color: textColor,
        anchor: { x: 0, y: 0.5 },
      });
      t.alpha = 0;
      t.position.set(x, y);
      card.addChild(t);
      x += t.width + bodySize * 1.1;
      timeline.to(t, { prop: "alpha", from: 0, to: 0.5, start: QUOTED_AT + 0.5 + i * 0.12, duration: 0.45, ease: outQuad });
    });
  }

  card.alpha = 0;
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: MINE_AT, duration: 0.4, ease: outQuad })
    .to(card, { prop: "y", from: cy + cardH * 0.1, to: cy, start: MINE_AT, duration: 0.9, ease: outQuint });

  return { timeline, duration: DURATION };
}

export const repostQuote: TemplateDefinition = {
  id: "repost-quote",
  name: "Quote Repost",
  tagline: "Your take lands first, then the post you're quoting slides in beneath it.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { myTake: "display", theirPost: "body" },
  palettes: PALETTES,
  fields: [
    { key: "myName", type: "text", label: "Your name", default: "Fika Studio", maxLength: 24 },
    { key: "myHandle", type: "text", label: "Your handle", default: "@fika.studio", maxLength: 24 },
    { key: "myTake", type: "text", label: "Your take", default: "This is the whole job, honestly.", maxLength: 120 },
    { key: "theirName", type: "text", label: "Quoted name", default: "Marta Vidal", maxLength: 24 },
    { key: "theirHandle", type: "text", label: "Quoted handle", default: "@marta.builds", maxLength: 24 },
    {
      key: "theirPost",
      type: "text",
      label: "Quoted post",
      default: "Pick one thing. Do it every week for a year. That's the strategy.",
      maxLength: 180,
    },
    { key: "showStats", type: "toggle", label: "Stats row", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Your avatar", default: "", optional: true },
  ],
  build,
};

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

// Waveform Bar — the audiogram overlay: a bar of levels dancing under a title
// and a speaker name, for cutting podcast and voice-note clips to video. It is
// the one thing the overlay set never had, and it was on the post-v1 backlog
// from the start.
//
// The levels are *not* real audio (the engine renders offline and has no
// signal to read) and they are not random either — determinism forbids it.
// Each bar is a sum of three seeded sines at incommensurate rates, which reads
// like speech: bursts, dips, and no visible loop inside the clip.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const num = (v: unknown, fallback: number): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);

const PALETTES: Palette[] = [
  { id: "studio", name: "Studio", colors: { background: "#12131A", textColor: "#F4F4F6", accent: "#8B5CF6" } },
  { id: "warm", name: "Warm", colors: { background: "#1B1410", textColor: "#FCF3E8", accent: "#F59E0B" } },
  { id: "paper", name: "Paper", colors: { background: "#F6F5F1", textColor: "#15161A", accent: "#DC2626" } },
  { id: "teal", name: "Teal", colors: { background: "#0C1B1D", textColor: "#EAF7F6", accent: "#2DD4BF" } },
];

interface Layout {
  barsFrac: number;
  cardHFrac: number;
  bottomFrac: number;
  titleFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { barsFrac: 0.52, cardHFrac: 0.24, bottomFrac: 0.1, titleFrac: 0.036 };
    case "9:16":
      return { barsFrac: 0.8, cardHFrac: 0.17, bottomFrac: 0.16, titleFrac: 0.048 };
    case "4:5":
      return { barsFrac: 0.76, cardHFrac: 0.19, bottomFrac: 0.12, titleFrac: 0.044 };
    case "1:1":
    default:
      return { barsFrac: 0.72, cardHFrac: 0.2, bottomFrac: 0.11, titleFrac: 0.044 };
  }
}

const IN_AT = 0.25;
const DURATION = 5.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#12131A"));
  const textColor = str(values.textColor, pc("textColor", "#F4F4F6"));
  const accent = str(values.accent, pc("accent", "#8B5CF6"));
  const title = str(values.title, "How we grew to 100k");
  const speaker = str(values.speaker, "").trim();
  const badge = str(values.badge, "").trim();
  const barCount = Math.round(num(values.bars, 28));
  const showCard = on(values.showCard);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cardW = size.width * (ctx.aspect === "16:9" ? 0.6 : 0.86);
  const cardH = size.height * L.cardHFrac;
  const cardY = size.height - size.height * L.bottomFrac - cardH;

  const timeline = new JimaTimeline();
  const group = new Container();
  group.position.set(cx, cardY + cardH / 2);
  root.addChild(group);

  const radius = Math.min(cardW, cardH) * 0.16;
  if (showCard) {
    const card = new Graphics()
      .roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius)
      .fill({ color: textColor, alpha: 0.07 })
      .stroke({ color: textColor, width: Math.max(1, size.width * 0.0012), alpha: 0.16 });
    group.addChild(card);
  }

  // --- The levels ---
  const bars = Math.max(8, Math.min(56, barCount));
  const barsW = cardW * (showCard ? 0.86 : 1) * L.barsFrac + cardW * 0.14;
  const usable = Math.min(barsW, cardW * 0.88);
  const gap = usable / bars;
  const barW = gap * 0.52;
  const maxH = cardH * 0.34;
  // Below the title's baseline: at full level the bars were touching it.
  const barsY = cardH * 0.08;

  // Three rates per bar, seeded once. Incommensurate so the pattern never
  // repeats inside a clip and no bar is ever in phase with its neighbour.
  const phases: { a: number; b: number; c: number; ra: number; rb: number; rc: number }[] = [];
  const barGfx: Graphics[] = [];
  for (let i = 0; i < bars; i++) {
    phases.push({
      a: rng.range(0, Math.PI * 2),
      b: rng.range(0, Math.PI * 2),
      c: rng.range(0, Math.PI * 2),
      ra: 3.1 + rng.range(0, 1.7),
      rb: 6.7 + rng.range(0, 2.9),
      rc: 1.3 + rng.range(0, 0.8),
    });
    const g = new Graphics().roundRect(-barW / 2, -0.5, barW, 1, barW / 2).fill(i % 4 === 0 ? accent : textColor);
    g.position.set(-usable / 2 + gap * (i + 0.5), barsY);
    g.alpha = i % 4 === 0 ? 1 : 0.72;
    group.addChild(g);
    barGfx.push(g);
  }

  // --- Text ---
  const titleSize = Math.round(size.width * L.titleFrac);
  const titleY = -cardH / 2 + cardH * 0.2;
  const t = makeText(fonts, {
    text: title,
    role: "display",
    weight: 700,
    size: titleSize,
    color: textColor,
    anchor: { x: 0, y: 0.5 },
  });
  // Shrink rather than wrap: an overlay that grows a line changes height and
  // starts covering the footage it was placed to avoid.
  const maxTitleW = cardW * 0.78;
  if (t.width > maxTitleW) t.scale.set(maxTitleW / t.width);
  t.position.set(-cardW * 0.42, titleY);
  group.addChild(t);

  if (badge.length > 0) {
    const bSize = Math.round(titleSize * 0.5);
    const label = makeText(fonts, {
      text: badge.toUpperCase(),
      role: "body",
      weight: 800,
      size: bSize,
      color: bg,
      anchor: 0.5,
      letterSpacing: bSize * 0.09,
    });
    const w = label.width + bSize * 1.1;
    const h = bSize * 1.9;
    const pill = new Graphics().roundRect(-w / 2, -h / 2, w, h, h / 2).fill(accent);
    const holder = new Container();
    holder.addChild(pill, label);
    holder.position.set(cardW * 0.42 - w / 2, titleY);
    group.addChild(holder);
    holder.scale.set(0);
    timeline
      .to(holder, { prop: "scale.x", from: 0, to: 1, start: IN_AT + 0.35, duration: 0.5, ease: outBack })
      .to(holder, { prop: "scale.y", from: 0, to: 1, start: IN_AT + 0.35, duration: 0.5, ease: outBack });
  }

  if (speaker.length > 0) {
    const s = makeText(fonts, {
      text: speaker,
      role: "body",
      weight: 500,
      size: Math.round(titleSize * 0.56),
      color: textColor,
      anchor: { x: 0, y: 0.5 },
    });
    s.alpha = 0.68;
    s.position.set(-cardW * 0.42, cardH / 2 - cardH * 0.17);
    group.addChild(s);
    timeline.to(s, { prop: "alpha", from: 0, to: 0.68, start: IN_AT + 0.3, duration: 0.5, ease: outQuad });
  }

  // The whole overlay rises in once.
  group.alpha = 0;
  timeline
    .to(group, { prop: "alpha", from: 0, to: 1, start: IN_AT, duration: 0.45, ease: outQuad })
    .to(group, {
      prop: "y",
      from: cardY + cardH / 2 + cardH * 0.45,
      to: cardY + cardH / 2,
      start: IN_AT,
      duration: 0.85,
      ease: outExpo,
    });

  // Bars are driven from `update` — a level per frame is a signal, not a tween.
  const update = (time: number): void => {
    // Ramp in with the card so they do not pop at full height.
    const ramp = Math.max(0, Math.min(1, (time - IN_AT - 0.15) / 0.5));
    for (let i = 0; i < bars; i++) {
      const p = phases[i]!;
      const v =
        0.5 +
        0.28 * Math.sin(time * p.ra + p.a) +
        0.16 * Math.sin(time * p.rb + p.b) +
        0.12 * Math.sin(time * p.rc + p.c);
      const level = Math.max(0.06, Math.min(1, v));
      const h = maxH * level * ramp;
      const g = barGfx[i]!;
      g.height = Math.max(barW * 0.9, h);
      g.y = barsY;
    }
  };
  update(0);

  return { timeline, duration: DURATION, update };
}

export const waveformBar: TemplateDefinition = {
  id: "waveform-bar",
  name: "Waveform Bar",
  tagline: "An audiogram overlay — levels dance under the episode title, ready for a podcast clip.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: true,
  posterTime: 3.0,
  fontRoles: { title: "display", speaker: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "How we grew to 100k", maxLength: 52, shrinkToFit: true },
    { key: "speaker", type: "text", label: "Speaker", default: "Ana Ruiz · Episode 42", maxLength: 44, optional: true },
    { key: "badge", type: "text", label: "Badge", default: "Listen", maxLength: 14, optional: true },
    { key: "bars", type: "slider", label: "Bars", default: 28, min: 8, max: 56, step: 2 },
    { key: "showCard", type: "toggle", label: "Card behind", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text & bars", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

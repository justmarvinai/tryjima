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

// Thread — numbered cards advance one at a time, "1/5" in the corner and a
// segmented progress bar filling across the top. The carousel-as-video format:
// one point per beat, so a viewer can pause on any of them.
//
// `swipe-carousel` slides images sideways with dots; `tips-stack` piles all its
// lines up at once. Here each card *replaces* the last, which is what makes it
// a thread rather than a list.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;

const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#14151A", textColor: "#F5F5F7", accent: "#60A5FA" } },
  { id: "paper", name: "Paper", colors: { background: "#F7F6F2", textColor: "#15161A", accent: "#E0483C" } },
  { id: "forest", name: "Forest", colors: { background: "#0E1A15", textColor: "#EBF7F1", accent: "#34D399" } },
  { id: "plum", name: "Plum", colors: { background: "#180F1C", textColor: "#F5EFF8", accent: "#C084FC" } },
];

interface Layout {
  bodyFrac: number;
  widthFrac: number;
  centerFrac: number;
}

function layout(aspect: Aspect): Layout {
  switch (aspect) {
    case "16:9":
      return { bodyFrac: 0.052, widthFrac: 0.62, centerFrac: 0.5 };
    case "9:16":
      return { bodyFrac: 0.072, widthFrac: 0.82, centerFrac: 0.48 };
    case "4:5":
      return { bodyFrac: 0.066, widthFrac: 0.8, centerFrac: 0.49 };
    case "1:1":
    default:
      return { bodyFrac: 0.066, widthFrac: 0.8, centerFrac: 0.49 };
  }
}

const FIRST_AT = 0.35;
const PER_CARD = 1.15;
const HOLD_TAIL = 1.1;

function durationFor(count: number): number {
  return Math.min(14, FIRST_AT + Math.max(1, count) * PER_CARD + HOLD_TAIL);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#14151A"));
  const textColor = str(values.textColor, pc("textColor", "#F5F5F7"));
  const accent = str(values.accent, pc("accent", "#60A5FA"));
  const cards = (Array.isArray(values.cards) ? (values.cards as unknown[]) : [])
    .map((v) => String(v ?? "").trim())
    .filter((s) => s.length > 0)
    .slice(0, 8);
  const kicker = str(values.kicker, "").trim();
  const showProgress = on(values.showProgress);

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const cy = size.height * L.centerFrac;
  const bodySize = Math.round(size.width * L.bodyFrac);
  const maxW = size.width * L.widthFrac;
  const n = Math.max(1, cards.length);
  const duration = durationFor(n);

  const timeline = new JimaTimeline();

  // --- Segmented progress across the top ---
  const segs: Graphics[] = [];
  if (showProgress) {
    const barY = size.height * 0.11;
    const barW = maxW;
    const gap = barW * 0.014;
    const segW = (barW - gap * (n - 1)) / n;
    const segH = Math.max(4, size.width * 0.006);
    for (let i = 0; i < n; i++) {
      const x = cx - barW / 2 + (segW + gap) * i;
      root.addChild(
        new Graphics().roundRect(x, barY, segW, segH, segH / 2).fill({ color: textColor, alpha: 0.18 }),
      );
      const fill = new Graphics().roundRect(0, 0, segW, segH, segH / 2).fill(accent);
      fill.position.set(x, barY);
      fill.scale.x = 0;
      root.addChild(fill);
      segs.push(fill);
      timeline.to(fill, {
        prop: "scale.x",
        from: 0,
        to: 1,
        start: FIRST_AT + i * PER_CARD,
        duration: PER_CARD * 0.85,
        ease: (u) => u,
      });
    }
  }

  if (kicker.length > 0) {
    const kSize = Math.round(bodySize * 0.34);
    const k = makeText(fonts, {
      text: kicker.toUpperCase(),
      role: "body",
      weight: 800,
      size: kSize,
      color: accent,
      anchor: 0.5,
      letterSpacing: kSize * 0.14,
    });
    const ky = size.height * 0.17;
    k.position.set(cx, ky);
    k.alpha = 0;
    root.addChild(k);
    timeline
      .to(k, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.4, ease: outQuad })
      .to(k, { prop: "y", from: ky + kSize * 0.6, to: ky, start: 0.1, duration: 0.7, ease: outExpo });
  }

  const measure = (s: string, sz: number) =>
    fonts.measure(s, { family: fonts.family("display"), weight: 700, size: sz });

  cards.forEach((text, i) => {
    const at = FIRST_AT + i * PER_CARD;
    const card = new Container();
    card.position.set(cx, cy);
    root.addChild(card);

    // --- The counter, big and faint behind the line ---
    const idx = makeText(fonts, {
      text: `${i + 1}/${n}`,
      role: "display",
      weight: 800,
      size: bodySize * 0.52,
      color: accent,
      anchor: 0.5,
    });
    idx.position.set(0, -bodySize * 1.75);
    card.addChild(idx);

    // --- The line, wrapped and shrunk to fit ---
    let sz = bodySize;
    let lines: string[] = [];
    for (let guard = 0; guard < 12; guard++) {
      const words = text.split(/\s+/).filter(Boolean);
      lines = [];
      let cur = "";
      for (const w of words) {
        const next = cur ? `${cur} ${w}` : w;
        if (measure(next, sz) <= maxW || !cur) cur = next;
        else {
          lines.push(cur);
          cur = w;
        }
      }
      if (cur) lines.push(cur);
      if (lines.length <= 4) break;
      sz = Math.round(sz * 0.92);
    }
    const lineH = sz * 1.22;
    lines.forEach((line, li) => {
      const t = makeText(fonts, {
        text: line,
        role: "display",
        weight: 700,
        size: sz,
        color: textColor,
        anchor: 0.5,
      });
      t.position.set(0, (li - (lines.length - 1) / 2) * lineH);
      card.addChild(t);
    });

    // Each card comes up from below and the previous one leaves upward, so the
    // thread reads as a scroll rather than a crossfade.
    card.alpha = 0;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start: at, duration: 0.3, ease: outQuad })
      .to(card, { prop: "y", from: cy + bodySize * 1.5, to: cy, start: at, duration: 0.7, ease: outExpo });
    if (i < n - 1) {
      const out = at + PER_CARD - 0.24;
      timeline
        .to(card, { prop: "alpha", from: 1, to: 0, start: out, duration: 0.28, ease: outQuad })
        .to(card, { prop: "y", from: cy, to: cy - bodySize * 1.4, start: out, duration: 0.5, ease: inOutQuint });
    }
  });

  return { timeline, duration };
}

export const threadNumbers: TemplateDefinition = {
  id: "thread-numbers",
  name: "Thread",
  tagline: "Numbered cards advance one at a time, with a segmented bar tracking the thread.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { cards: "display", kicker: "body" },
  palettes: PALETTES,
  fields: [
    { key: "kicker", type: "text", label: "Kicker", default: "A thread", maxLength: 24, optional: true },
    {
      key: "cards",
      type: "textlist",
      label: "Points",
      default: [
        "Post at the same time every day",
        "Answer every comment in the first hour",
        "Reuse what already worked",
        "Stop chasing every trend",
      ],
      minItems: 1,
      maxItems: 8,
      maxLength: 90,
    },
    { key: "showProgress", type: "toggle", label: "Progress bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  estimateDuration: (v) => durationFor(Array.isArray(v.cards) ? (v.cards as unknown[]).length : 4),
  build,
};

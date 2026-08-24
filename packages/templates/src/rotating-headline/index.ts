import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  shrinkToFit,
  outQuad,
  outExpo,
  inQuad,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const DEFAULT_PHRASES = ["simple", "fast", "yours"];

const asPhrases = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length >= 2) return arr.slice(0, 5);
  }
  return fallback;
};

/** Respects an explicit empty string (hide the lead) vs. unset (default). */
const resolveLead = (values: Values): string => {
  const raw = typeof values.lead === "string" ? values.lead : "We make it";
  return raw.trim();
};

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#D8F34D" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#FF4D1C" } },
  { id: "violet", name: "Violet", colors: { background: "#F3EEFF", textColor: "#2A1A5E", accent: "#7C5CFF" } },
];

interface L {
  leadFrac: number;
  phraseFrac: number;
  maxWidthFrac: number;
  centerYFrac: number;
}

function layout(aspect: Aspect): L {
  switch (aspect) {
    case "16:9":
      return { leadFrac: 0.05, phraseFrac: 0.112, maxWidthFrac: 0.8, centerYFrac: 0.5 };
    case "9:16":
      return { leadFrac: 0.058, phraseFrac: 0.122, maxWidthFrac: 0.86, centerYFrac: 0.44 };
    case "4:5":
      return { leadFrac: 0.055, phraseFrac: 0.116, maxWidthFrac: 0.84, centerYFrac: 0.45 };
    case "1:1":
    default:
      return { leadFrac: 0.056, phraseFrac: 0.118, maxWidthFrac: 0.84, centerYFrac: 0.46 };
  }
}

// Per-phrase cycle: rise in, hold, fall out (next phrase starts a little before
// this one fully clears, for a snappy — not dead-air — swap).
const RISE = 0.38;
const HOLD = 0.85;
const FALL = 0.32;

function computeDuration(values: Values): number {
  const phrases = asPhrases(values.phrases, DEFAULT_PHRASES);
  const n = phrases.length;
  const hasLead = resolveLead(values).length > 0;
  const firstStart = hasLead ? 0.45 : 0.25;
  const advance = RISE + HOLD + FALL * 0.55;
  const lastRiseStart = firstStart + advance * (n - 1);
  return Math.max(3.6, lastRiseStart + RISE + 1.35);
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const lead = resolveLead(values);
  const hasLead = lead.length > 0;
  const phrases = asPhrases(values.phrases, DEFAULT_PHRASES);
  const showBar = values.showBar !== false;
  const n = phrases.length;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const L = layout(ctx.aspect);
  const cx = size.width / 2;
  const family = fonts.family("display");
  const weight = 700;
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const maxWidth = size.width * L.maxWidthFrac;

  const leadBase = Math.round(size.width * L.leadFrac);
  const leadSize = hasLead
    ? shrinkToFit(lead, measure, { maxWidth, baseSize: leadBase, minSize: Math.round(leadBase * 0.5) })
    : 0;

  // All phrases share one size — the smallest that fits each of them — so
  // swaps never jump in scale.
  const phraseBase = Math.round(size.width * L.phraseFrac);
  const phraseSize = Math.min(
    ...phrases.map((p) => shrinkToFit(p, measure, { maxWidth, baseSize: phraseBase, minSize: Math.round(phraseBase * 0.4) })),
  );

  const content = new Container();
  content.label = "content";
  root.addChild(content);

  const leadLH = leadSize * 1.16;
  const phraseLH = phraseSize * 1.2;
  const gap = phraseSize * 0.24;
  const blockH = (hasLead ? leadLH + gap : 0) + phraseLH;
  const centerY = size.height * L.centerYFrac;
  const top = centerY - blockH / 2;
  const leadCY = top + leadLH / 2;
  const phraseCY = hasLead ? top + leadLH + gap + phraseLH / 2 : centerY;

  const timeline = new JimaTimeline();

  const LEAD_START = 0.2;
  if (hasLead) {
    const leadText = makeText(fonts, { text: lead, role: "display", weight, size: leadSize, color: textColor, anchor: 0.5, align: "center" });
    leadText.position.set(cx, leadCY + 22);
    leadText.alpha = 0;
    content.addChild(leadText);
    timeline
      .to(leadText, { prop: "alpha", from: 0, to: 1, start: LEAD_START, duration: 0.4, ease: outQuad })
      .to(leadText, { prop: "y", from: leadCY + 22, to: leadCY, start: LEAD_START, duration: 0.55, ease: outExpo });
  }

  const riseDist = phraseSize * 0.55;
  const fallDist = phraseSize * 0.5;
  const barH = Math.max(4, Math.round(phraseSize * 0.09));

  // Every phrase lives at the SAME (cx, phraseCY) — only one is visible at a
  // time via its own alpha/y tweens, driven purely by the timeline.
  let riseStart = hasLead ? LEAD_START + 0.25 : 0.25;
  phrases.forEach((p, i) => {
    const isLast = i === n - 1;
    const txt = makeText(fonts, { text: p, role: "display", weight, size: phraseSize, color: textColor, anchor: 0.5, align: "center" });
    txt.position.set(cx, phraseCY + riseDist);
    txt.alpha = 0;
    content.addChild(txt);

    timeline
      .to(txt, { prop: "alpha", from: 0, to: 1, start: riseStart, duration: RISE * 0.85, ease: outQuad })
      .to(txt, { prop: "y", from: phraseCY + riseDist, to: phraseCY, start: riseStart, duration: RISE, ease: outExpo });

    let bar: Graphics | null = null;
    if (showBar) {
      const pw = measure(p, phraseSize);
      const barW = Math.max(phraseSize * 0.5, pw * 0.86);
      bar = new Graphics().roundRect(-barW / 2, 0, barW, barH, barH / 2).fill(accent);
      bar.position.set(cx, phraseCY + phraseSize * 0.62);
      bar.alpha = 0;
      bar.scale.set(0.6, 1);
      content.addChild(bar);
      timeline
        .to(bar, { prop: "alpha", from: 0, to: 1, start: riseStart + 0.05, duration: 0.3, ease: outQuad })
        .to(bar, { prop: "scale.x", from: 0.6, to: 1, start: riseStart + 0.05, duration: 0.4, ease: outExpo });
    }

    if (!isLast) {
      const fallStart = riseStart + RISE + HOLD;
      timeline
        .to(txt, { prop: "alpha", from: 1, to: 0, start: fallStart, duration: FALL, ease: outQuad })
        .to(txt, { prop: "y", from: phraseCY, to: phraseCY + fallDist, start: fallStart, duration: FALL, ease: inQuad });
      if (bar) {
        timeline.to(bar, { prop: "alpha", from: 1, to: 0, start: fallStart, duration: FALL * 0.85, ease: outQuad });
      }
      riseStart = fallStart + FALL * 0.55;
    }
    // The last phrase only rises and holds — no fall-out tween is added.
  });

  return { timeline, duration: computeDuration(values) };
}

export const rotatingHeadline: TemplateDefinition = {
  id: "rotating-headline",
  name: "Rotating Headline",
  tagline: "A lead-in word, then a series of phrases rise, hold, and drop away.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 4.2,
  estimateDuration: computeDuration,
  fontRoles: { lead: "display", phrases: "display" },
  palettes: PALETTES,
  fields: [
    { key: "lead", type: "text", label: "Lead-in", default: "We make it", maxLength: 30, optional: true },
    { key: "phrases", type: "textlist", label: "Phrases", default: DEFAULT_PHRASES, minItems: 2, maxItems: 5, maxLength: 22 },
    { key: "showBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

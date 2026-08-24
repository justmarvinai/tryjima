import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function relLum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length >= 6 ? h.slice(0, 6) : h.padEnd(6, h.slice(-1) || "0");
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const contrastRatio = (a: string, b: string): number => {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
const readableOn = (bg: string): string =>
  contrastRatio("#FFFFFF", bg) >= contrastRatio("#111318", bg) * 0.9 ? "#FFFFFF" : "#111318";

// cardBg is a palette-only surface role (survives recolor). name/topic sit in
// textColor on cardBg (>= 4.5:1); avatar initials use auto ink on the accent.
const PALETTES: Palette[] = [
  { id: "paper", name: "Paper", colors: { background: "#F1F3F7", cardBg: "#FFFFFF", textColor: "#14161C", accent: "#4C63D2" } },
  { id: "ink", name: "Ink", colors: { background: "#101219", cardBg: "#1D212C", textColor: "#F4F6FA", accent: "#6C7BFF" } },
  { id: "warm", name: "Warm", colors: { background: "#FBF1E9", cardBg: "#FFFFFF", textColor: "#2A1B10", accent: "#DA5F2E" } },
  { id: "mint", name: "Mint", colors: { background: "#EAF6EF", cardBg: "#FFFFFF", textColor: "#0E2A1E", accent: "#12925C" } },
];

const DEFAULT_SPEAKERS = [
  "Dr. Amara Okoye|Keynote: The Next Web",
  "Leo Marchetti|Design at Scale",
  "Priya Nandakumar|Shipping with AI",
  "Sam Rivera|Building Community",
];

const TITLE_IN = 0.0;
const ROWS_START = 0.5;
const ROW_STAGGER = 0.28;
const CARD_DUR = 0.55;
const HOLD = 1.2;

interface Speaker {
  name: string;
  topic: string;
}

function parseSpeaker(raw: string): Speaker {
  const parts = raw.split("|").map((s) => s.trim());
  return { name: parts[0] && parts[0].length > 0 ? parts[0] : "—", topic: parts[1] ?? "" };
}

function speakersOf(values: Values): Speaker[] {
  return asList(values.speakers, DEFAULT_SPEAKERS).slice(0, 4).map(parseSpeaker);
}

function initialsOf(name: string): string {
  const words = name.replace(/^(dr|mr|mrs|ms)\.?\s+/i, "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0]!.charAt(0).toUpperCase();
  return (words[0]!.charAt(0) + words[words.length - 1]!.charAt(0)).toUpperCase();
}

function computeDuration(values: Values): number {
  const n = Math.max(1, speakersOf(values).length);
  return ROWS_START + (n - 1) * ROW_STAGGER + CARD_DUR + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F1F3F7"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#14161C"));
  const accent = str(values.accent, pc("accent", "#4C63D2"));
  const avatarInk = readableOn(accent);

  const title = str(values.title, "Speaker Lineup");
  const speakers = speakersOf(values);
  const n = speakers.length;
  const showAccentBar = on(values.accentBar);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Title ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.058), zone.width * 0.92);
  const titleY = zone.y + titleSize * 0.72;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  titleText.position.set(zone.x, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: TITLE_IN, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: zone.x - 20, to: zone.x, start: TITLE_IN, duration: 0.5, ease: outQuint });

  let rowsTop = titleY + titleSize * 0.78 + minDim * 0.03;
  if (showAccentBar) {
    const ruleW = titleSize * 1.7;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(zone.x, titleY + titleSize * 0.66);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.28, duration: 0.4, ease: outQuint });
    rowsTop += ruleH + minDim * 0.02;
  }

  // --- Speaker cards (vertical stack) ---
  const rowsBottom = zone.y + zone.height;
  const areaH = rowsBottom - rowsTop;
  const cardGap = minDim * 0.022;
  const cardH = (areaH - (n - 1) * cardGap) / n;
  const cardW = zone.width;
  const radius = Math.min(cardH * 0.28, minDim * 0.04);

  const avatarR = cardH * 0.32;
  const padL = cardH * 0.26;
  const textX = padL + avatarR * 2 + cardH * 0.24;
  const textMaxW = cardW - textX - cardH * 0.24;
  const nameSize = Math.min(Math.round(cardH * 0.3), Math.round(minDim * 0.04));
  const topicSize = Math.min(Math.round(cardH * 0.22), Math.round(minDim * 0.03));

  speakers.forEach((sp, i) => {
    const top = rowsTop + i * (cardH + cardGap);
    const ccy = top + cardH / 2;
    const card = new Container();
    card.position.set(zone.x + cardW / 2, ccy);
    card.scale.set(0);
    card.alpha = 0;
    root.addChild(card);

    // Soft shadow + surface.
    card.addChild(
      new Graphics()
        .roundRect(-cardW / 2, -cardH / 2 + cardH * 0.05, cardW, cardH, radius)
        .fill({ color: "#000000", alpha: 0.08 }),
    );
    card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill(cardBg));

    // Avatar with initials.
    const avX = -cardW / 2 + padL + avatarR;
    card.addChild(new Graphics().circle(avX, 0, avatarR).fill(accent));
    const initials = initialsOf(sp.name);
    card.addChild(
      makeText(fonts, {
        text: initials,
        role: "display",
        weight: 700,
        size: fitSize(fonts, initials, "display", 700, Math.round(avatarR * 0.9), avatarR * 1.3),
        color: avatarInk,
        anchor: 0.5,
      }),
    ).position.set(avX, 0);

    const nx = -cardW / 2 + textX;
    const hasTopic = sp.topic.length > 0;
    const nameY = hasTopic ? -cardH * 0.14 : 0;
    card.addChild(
      makeText(fonts, {
        text: sp.name,
        role: "display",
        weight: 700,
        size: fitSize(fonts, sp.name, "display", 700, nameSize, textMaxW),
        color: textColor,
        anchor: { x: 0, y: 0.5 },
      }),
    ).position.set(nx, nameY);

    if (hasTopic) {
      const topicText = makeText(fonts, {
        text: sp.topic,
        role: "body",
        weight: 500,
        size: fitSize(fonts, sp.topic, "body", 500, topicSize, textMaxW),
        color: textColor,
        anchor: { x: 0, y: 0.5 },
      });
      topicText.alpha = 0.72;
      topicText.position.set(nx, cardH * 0.2);
      card.addChild(topicText);
    }

    const start = ROWS_START + i * ROW_STAGGER;
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(card, { prop: "scale.x", from: 0.5, to: 1, start, duration: CARD_DUR, ease: makeOutBack(1.8) })
      .to(card, { prop: "scale.y", from: 0.5, to: 1, start, duration: CARD_DUR, ease: makeOutBack(1.8) });
  });

  return { timeline, duration: computeDuration(values) };
}

export const speakerLineup: TemplateDefinition = {
  id: "speaker-lineup",
  name: "Speaker Lineup",
  tagline: "Speaker cards pop in one by one beneath the event title.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.8,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", speakers: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Speaker Lineup", maxLength: 28, shrinkToFit: true },
    {
      key: "speakers",
      type: "textlist",
      label: "Speakers",
      default: DEFAULT_SPEAKERS,
      minItems: 3,
      maxItems: 4,
      maxLength: 40,
      help: 'One per line as "Name|Topic".',
    },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

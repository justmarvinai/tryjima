import { Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outCubic,
  outExpo,
  inOutCubic,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

const DEFAULT_MESSAGES = ["Design it.", "Animate it.", "Ship it — free."];
const PER = 1.6; // seconds per message

const asList = (v: unknown, fb: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length >= 2) return arr.slice(0, 5);
  }
  return fb;
};

function computeDuration(values: Values): number {
  return asList(values.messages, DEFAULT_MESSAGES).length * PER;
}

// Label uses the accent as text, so each accent clears 4.5:1 on its background
// (deep ember on light grounds, bright ember on the night ground).
const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#C4340B" } },
  { id: "cream", name: "Cream", colors: { background: "#FAF5EA", textColor: "#1A1512", accent: "#B83609" } },
  { id: "night", name: "Night", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C" } },
  { id: "ocean", name: "Ocean", colors: { background: "#E9F1F5", textColor: "#0B2A38", accent: "#0F5F7C" } },
];

function fontFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.084;
    case "9:16":
      return 0.108;
    case "4:5":
      return 0.1;
    case "1:1":
    default:
      return 0.1;
  }
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#C4340B"));
  const messages = asList(values.messages, DEFAULT_MESSAGES);
  const n = messages.length;
  // Optional label: respect an explicit empty string (hide) vs. unset (default).
  const labelRaw = typeof values.label === "string" ? values.label : "Jima";
  const label = labelRaw.trim();

  root.addChild(new Graphics().rect(0, 0, size.width, size.height).fill(bg));
  const cx = size.width / 2;
  const cy = size.height / 2;

  // --- Fit every phrase to one shared, non-overflowing size ---
  const family = fonts.family("display");
  const weight = 700;
  const measure = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  let sizePx = Math.round(size.width * fontFrac(ctx.aspect));
  const target = size.width * 0.82;
  const widest = Math.max(...messages.map((m) => measure(m, sizePx)));
  if (widest > target) sizePx = Math.max(20, Math.floor((sizePx * target) / widest));

  const timeline = new JimaTimeline();
  const drift = sizePx * 0.55;

  // --- Optional fixed label above (static → identical on every loop frame) ---
  if (label.length > 0) {
    const lSize = Math.max(11, Math.round(size.width * 0.03));
    const lt = makeText(fonts, {
      text: label.toUpperCase(),
      role: "body",
      weight: 600,
      size: lSize,
      color: accent,
      anchor: 0.5,
      align: "center",
      letterSpacing: lSize * 0.18,
    });
    lt.position.set(cx, cy - sizePx * 0.98);
    root.addChild(lt);
  }

  // --- Phrases stacked at centre; each holds at C_i = i*PER and crossfades at
  //     each midpoint M_i = (i+0.5)*PER — outgoing drifts up + fades, incoming
  //     rises + fades. Message 0 is held at t=0 and returns to be held at
  //     t=n*PER, so the first and last frames match exactly (seamless loop). ---
  const texts = messages.map((m) => {
    const t = makeText(fonts, {
      text: m,
      role: "display",
      weight,
      size: sizePx,
      color: textColor,
      anchor: 0.5,
      align: "center",
    });
    t.position.set(cx, cy);
    t.alpha = 0;
    root.addChild(t);
    return t;
  });

  const fadeIn = (idx: number, start: number): void => {
    const tx = texts[idx]!;
    timeline
      .to(tx, { prop: "alpha", from: 0, to: 1, start, duration: 0.55, ease: outCubic })
      .to(tx, { prop: "y", from: cy + drift, to: cy, start, duration: 0.6, ease: outExpo });
  };

  for (let i = 0; i < n; i++) {
    const midOut = (i + 0.5) * PER; // message i hands off here
    const tx = texts[i]!;
    // Fade out (drifts up and away).
    timeline
      .to(tx, { prop: "alpha", from: 1, to: 0, start: midOut - 0.3, duration: 0.5, ease: outCubic })
      .to(tx, { prop: "y", from: cy, to: cy - drift, start: midOut - 0.3, duration: 0.55, ease: inOutCubic });
    // Fade in at the previous midpoint (skip message 0 — it starts already held).
    if (i >= 1) fadeIn(i, midOut - PER - 0.2);
  }
  // Message 0 returns during the final midpoint so it lands fully held at n*PER.
  fadeIn(0, (n - 0.5) * PER - 0.2);

  return { timeline, duration: n * PER };
}

export const messageRotator: TemplateDefinition = {
  id: "message-rotator",
  name: "Message Rotator",
  tagline: "One centred line crossfades through your list, on a seamless loop.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: true,
  posterTime: 1.6,
  fontRoles: { messages: "display", label: "body" },
  palettes: PALETTES,
  estimateDuration: computeDuration,
  fields: [
    { key: "messages", type: "textlist", label: "Messages", default: DEFAULT_MESSAGES, minItems: 2, maxItems: 5, maxLength: 40 },
    { key: "label", type: "text", label: "Label", default: "Jima", maxLength: 24, optional: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

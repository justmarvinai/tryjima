import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  makeOutBack,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
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
  return w > maxWidth ? Math.max(12, Math.floor((size * maxWidth) / w)) : size;
}

const PALETTES: Palette[] = [
  { id: "ink-white", name: "Ink on white", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C" } },
  { id: "velvet-night", name: "Velvet night", colors: { background: "#141221", textColor: "#F5F1E6", accent: "#D8F34D" } },
  { id: "blush-invite", name: "Blush invite", colors: { background: "#FFF1F3", textColor: "#3A0E16", accent: "#C81361" } },
  { id: "teal-formal", name: "Teal formal", colors: { background: "#EAF5F2", textColor: "#0B2A24", accent: "#0C7A63" } },
];

const RING_DOTS = 16;
const COUNT_START = 0.35;
const COUNT_DUR = 0.9;
const RING_START = COUNT_START + COUNT_DUR + 0.15;
const RING_STAGGER = 0.035;
const DURATION = 3.6;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));

  const eventName = str(values.eventName, "Jima Live");
  const dateVal = str(values.date, "SAT 12 SEP · 6 PM");
  const daysLabel = str(values.daysLabel, "DAYS TO GO").toUpperCase();
  const showRing = values.showRing !== false;

  const totalDays = Math.max(1, Math.round(num(values.totalDays, 21)));
  const daysToGoInput = Math.max(0, Math.round(num(values.daysToGo, 7)));
  const daysToGo = Math.min(daysToGoInput, totalDays);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);
  const heroCy = zone.y + zone.height / 2;
  const maxTextW = zone.width * 0.86;
  const R = minDim * 0.27;

  // --- Event name (kicker, above the ring) ---
  const nameY = heroCy - R * 1.45;
  const nameSize0 = Math.round(minDim * 0.052);
  const nameSize = fitSize(fonts, eventName, "display", 700, nameSize0, maxTextW);
  const nameText = makeText(fonts, { text: eventName, role: "display", weight: 700, size: nameSize, color: textColor, anchor: 0.5, align: "center" });
  nameText.position.set(cx, nameY);
  nameText.alpha = 0;
  root.addChild(nameText);
  timeline
    .to(nameText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(nameText, { prop: "y", from: nameY - 16, to: nameY, start: 0, duration: 0.5, ease: outExpo });

  // --- Big day count (hero, rolls down from a decoy and settles) ---
  const numY = heroCy - R * 0.14;
  const decoyOffset = rng.int(5, 9);
  const decoyStart = daysToGo + decoyOffset;
  const numSize0 = Math.round(R * 0.62);
  const numSize = fitSize(fonts, String(decoyStart), "display", 700, numSize0, R * 1.55);
  const numberText = makeText(fonts, { text: String(decoyStart), role: "display", weight: 700, size: numSize, color: textColor, anchor: 0.5 });
  numberText.position.set(cx, numY);
  numberText.alpha = 0;
  root.addChild(numberText);
  timeline
    .to(numberText, { prop: "alpha", from: 0, to: 1, start: 0.15, duration: 0.35, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 0.82, to: 1, start: 0.15, duration: 0.4, ease: outQuint })
    .to(numberText, { prop: "scale.y", from: 0.82, to: 1, start: 0.15, duration: 0.4, ease: outQuint })
    // Landing beat once the countdown roll settles.
    .to(numberText, { prop: "scale.x", from: 1, to: 1.1, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.x", from: 1.1, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.22, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1, to: 1.1, start: COUNT_START + COUNT_DUR, duration: 0.12, ease: outQuad })
    .to(numberText, { prop: "scale.y", from: 1.1, to: 1, start: COUNT_START + COUNT_DUR + 0.12, duration: 0.22, ease: outQuad });

  // --- "DAYS TO GO" caption ---
  const labelSize0 = Math.round(R * 0.19);
  const labelSize = fitSize(fonts, daysLabel, "body", 600, labelSize0, R * 1.7);
  const labelY = numY + numSize * 0.62;
  const labelText = makeText(fonts, { text: daysLabel, role: "body", weight: 600, size: labelSize, color: textColor, anchor: 0.5, letterSpacing: 2 });
  labelText.position.set(cx, labelY);
  labelText.alpha = 0;
  root.addChild(labelText);
  timeline
    .to(labelText, { prop: "alpha", from: 0, to: 0.88, start: 0.4, duration: 0.4, ease: outQuad })
    .to(labelText, { prop: "y", from: labelY + 10, to: labelY, start: 0.4, duration: 0.45, ease: outQuint });

  // --- Date (below the ring) ---
  const dateY = heroCy + R * 1.35;
  const dateSize0 = Math.round(minDim * 0.032);
  const dateSize = fitSize(fonts, dateVal, "body", 600, dateSize0, maxTextW);
  const dateText = makeText(fonts, { text: dateVal, role: "body", weight: 600, size: dateSize, color: textColor, anchor: 0.5, align: "center", letterSpacing: 1 });
  dateText.position.set(cx, dateY);
  dateText.alpha = 0;
  root.addChild(dateText);
  timeline
    .to(dateText, { prop: "alpha", from: 0, to: 0.85, start: 0.55, duration: 0.4, ease: outQuad })
    .to(dateText, { prop: "y", from: dateY + 10, to: dateY, start: 0.55, duration: 0.45, ease: outQuint });

  // --- Ring of dots showing days elapsed (optional; a "ring" built of pips) ---
  if (showRing) {
    const elapsedFrac = clamp01((totalDays - daysToGo) / totalDays);
    const litCount = Math.round(elapsedFrac * RING_DOTS);
    const dotR = minDim * 0.011;
    const dotsHolder = new Container();
    dotsHolder.label = "ring";
    dotsHolder.position.set(cx, heroCy);
    root.addChild(dotsHolder);
    for (let i = 0; i < RING_DOTS; i++) {
      const angle = -Math.PI / 2 + (i / RING_DOTS) * Math.PI * 2;
      const lit = i < litCount;
      const dot = new Graphics().circle(0, 0, lit ? dotR : dotR * 0.7).fill(lit ? accent : { color: textColor, alpha: 0.18 });
      dot.position.set(Math.cos(angle) * R, Math.sin(angle) * R);
      dot.scale.set(0);
      dotsHolder.addChild(dot);
      const start = RING_START + i * RING_STAGGER;
      timeline
        .to(dot, { prop: "scale.x", from: 0, to: 1, start, duration: 0.45, ease: lit ? makeOutBack(2.2) : outQuad })
        .to(dot, { prop: "scale.y", from: 0, to: 1, start, duration: 0.45, ease: lit ? makeOutBack(2.2) : outQuad });
    }
  }

  // Countdown roll — a pure function of t (no wall clock): decoyStart -> daysToGo.
  const update = (t: number): void => {
    const u = clamp01((t - COUNT_START) / COUNT_DUR);
    const eased = outExpo(u);
    const val = Math.round(decoyStart - (decoyStart - daysToGo) * eased);
    if (numberText.text !== String(val)) numberText.text = String(val);
  };

  return { timeline, duration: DURATION, update };
}

export const eventCountdown: TemplateDefinition = {
  id: "event-countdown",
  name: "Event Countdown",
  tagline: "A big day-count settles inside a ring that fills as the date nears.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { eventName: "display" },
  palettes: PALETTES,
  fields: [
    { key: "eventName", type: "text", label: "Event name", default: "Jima Live", maxLength: 28, shrinkToFit: true },
    { key: "date", type: "text", label: "Date", default: "SAT 12 SEP · 6 PM", maxLength: 28 },
    { key: "daysLabel", type: "text", label: "Caption", default: "DAYS TO GO", maxLength: 16 },
    { key: "daysToGo", type: "slider", label: "Days to go", default: 7, min: 0, max: 60, step: 1 },
    {
      key: "totalDays",
      type: "slider",
      label: "Countdown length (days)",
      default: 21,
      min: 1,
      max: 90,
      step: 1,
      help: "Fills the ring as the date approaches.",
    },
    { key: "showRing", type: "toggle", label: "Progress ring", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

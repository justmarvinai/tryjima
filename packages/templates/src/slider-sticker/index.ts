import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outCubic,
  spring,
  makeOutBack,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number => (typeof v === "number" ? v : fallback);
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const EMOJI_CHOICES = ["😍", "🔥", "😂", "👍", "💯", "😱"];

// `accent` here only ever fills non-text graphics (track/knob ring/trail), so
// it isn't constrained by the text-contrast rule — textColor/cardBg (always a
// light/dark pair) carries every real text element.
const PALETTES: Palette[] = [
  { id: "cloud", name: "Cloud", colors: { background: "#EEF1F6", cardBg: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", track: "#EFEFF2" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", cardBg: "#1C1C22", textColor: "#FFFFFF", accent: "#7C5CFF", track: "#33333C" } },
  { id: "mint", name: "Mint", colors: { background: "#E7F7EF", cardBg: "#FFFFFF", textColor: "#08221A", accent: "#0EA36B", track: "#DCF3E7" } },
  { id: "blush", name: "Blush", colors: { background: "#FCEDF3", cardBg: "#FFFFFF", textColor: "#3A0A28", accent: "#FF2E9E", track: "#FBD9EA" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EEF1F6"));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const track = pc("track", "#EFEFF2");

  const question = str(values.question, "How excited are you?");
  const emojiRaw = str(values.emoji, "😍");
  const emoji = EMOJI_CHOICES.includes(emojiRaw) ? emojiRaw : "😍";
  const value = Math.max(0, Math.min(100, Math.round(num(values.value, 80))));
  const showTrail = values.showTrail !== false;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  const familyDisplay = fonts.family("display");
  const measureDisplay = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });

  // --- Card sizing ---
  const cardW = Math.min(safe.width * 0.88, minDim * 0.82);
  const cardPadX = Math.round(cardW * 0.08);
  const cardPadY = Math.round(cardW * 0.09);
  const availW = cardW - cardPadX * 2;

  const qBase = Math.round(minDim * 0.05);
  const qSize = shrinkToFit(question, measureDisplay, { maxWidth: availW, baseSize: qBase, minSize: Math.round(qBase * 0.55) });

  const pctBase = Math.round(minDim * 0.1);
  const pctSize = shrinkToFit("100%", measureDisplay, { maxWidth: availW * 0.55, baseSize: pctBase, minSize: Math.round(pctBase * 0.6) });

  const knobR = Math.round(cardW * 0.105);
  const trackH = Math.max(6, Math.round(knobR * 0.4));

  // --- Vertical rhythm ---
  const qH = qSize * 1.25;
  const pctH = pctSize * 1.05;
  const rowH = knobR * 2.3;
  const gap1 = Math.round(qSize * 0.55);
  const gap2 = Math.round(pctSize * 0.3);
  const innerH = qH + gap1 + pctH + gap2 + rowH;
  const cardH = innerH + cardPadY * 2;
  const cardR = cardH * 0.1;
  const cardCy = safe.y + safe.height / 2;

  // --- Card (pops in) ---
  const card = new Container();
  card.label = "card";
  card.position.set(cx, cardCy);
  card.alpha = 0;
  card.scale.set(0.8);
  root.addChild(card);
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.3, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.8, to: 1, start: 0.05, duration: 0.6, ease: makeOutBack(1.6) })
    .to(card, { prop: "scale.y", from: 0.8, to: 1, start: 0.05, duration: 0.6, ease: makeOutBack(1.6) });

  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardBg));

  let cursor = -innerH / 2;
  const qCy = cursor + qH / 2;
  cursor += qH + gap1;
  const pctCy = cursor + pctH / 2;
  cursor += pctH + gap2;
  const rowCy = cursor + rowH / 2;

  // --- Question ---
  const qNode = makeText(fonts, { text: question, role: "display", weight: 700, size: qSize, color: textColor, anchor: 0.5, align: "center" });
  qNode.position.set(0, qCy);
  qNode.alpha = 0;
  card.addChild(qNode);
  timeline
    .to(qNode, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.35, ease: outQuad })
    .to(qNode, { prop: "y", from: qCy + 14, to: qCy, start: 0.3, duration: 0.5, ease: outExpo });

  // --- Percentage readout ---
  const pctNode = makeText(fonts, { text: "0%", role: "display", weight: 700, size: pctSize, color: textColor, anchor: 0.5, align: "center" });
  pctNode.position.set(0, pctCy);
  pctNode.alpha = 0;
  card.addChild(pctNode);
  timeline.to(pctNode, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.3, ease: outQuad });

  // --- Track + fill ---
  const travelW = Math.max(knobR, availW - knobR * 2.3);
  const trackLeftX = -travelW / 2;
  const knobTargetX = trackLeftX + travelW * (value / 100);

  const trackVisLeft = trackLeftX - knobR * 0.5;
  const trackVisRight = travelW / 2 + knobR * 0.5;
  const trackVisW = trackVisRight - trackVisLeft;

  const trackBg = new Graphics().roundRect(0, 0, trackVisW, trackH, trackH / 2).fill(track);
  trackBg.position.set(trackVisLeft, rowCy - trackH / 2);
  trackBg.alpha = 0;
  card.addChild(trackBg);
  timeline.to(trackBg, { prop: "alpha", from: 0, to: 1, start: 0.55, duration: 0.35, ease: outQuad });

  const fillFrac = (knobTargetX - trackVisLeft) / trackVisW;
  const fill = new Graphics().roundRect(0, 0, trackVisW, trackH, trackH / 2).fill(accent);
  fill.position.set(trackVisLeft, rowCy - trackH / 2);
  fill.scale.set(0, 1);
  card.addChild(fill);

  // --- Knob (slides in, springy settle) ---
  const SLIDE_START = 0.95;
  const SLIDE_DUR = 0.85;
  const slideEase = spring(0.4);

  const knob = new Container();
  knob.label = "knob";
  const knobDisc = new Graphics().circle(0, 0, knobR).fill(cardBg);
  const knobRing = new Graphics().circle(0, 0, knobR).stroke({ color: accent, width: Math.max(2, knobR * 0.1) });
  const emojiNode = makeText(fonts, { text: emoji, role: "display", weight: 500, size: Math.round(knobR * 1.35), anchor: 0.5 });
  knob.addChild(knobDisc, knobRing, emojiNode);
  knob.position.set(trackLeftX, rowCy);
  knob.alpha = 0;
  knob.scale.set(0.5);
  card.addChild(knob);

  timeline
    .to(knob, { prop: "alpha", from: 0, to: 1, start: 0.72, duration: 0.3, ease: outQuad })
    .to(knob, { prop: "scale.x", from: 0.5, to: 1, start: 0.72, duration: 0.4, ease: makeOutBack(2) })
    .to(knob, { prop: "scale.y", from: 0.5, to: 1, start: 0.72, duration: 0.4, ease: makeOutBack(2) })
    .to(knob, { prop: "x", from: trackLeftX, to: knobTargetX, start: SLIDE_START, duration: SLIDE_DUR, ease: slideEase })
    .to(fill, { prop: "scale.x", from: 0, to: fillFrac, start: SLIDE_START, duration: SLIDE_DUR, ease: slideEase });

  // Small confirmation beat once it lands.
  const SLIDE_END = SLIDE_START + SLIDE_DUR;
  timeline
    .to(knob, { prop: "scale.x", from: 1, to: 1.1, start: SLIDE_END, duration: 0.12, ease: outQuad })
    .to(knob, { prop: "scale.x", from: 1.1, to: 1, start: SLIDE_END + 0.12, duration: 0.24, ease: outQuad })
    .to(knob, { prop: "scale.y", from: 1, to: 1.1, start: SLIDE_END, duration: 0.12, ease: outQuad })
    .to(knob, { prop: "scale.y", from: 1.1, to: 1, start: SLIDE_END + 0.12, duration: 0.24, ease: outQuad });

  // A pure replica of the knob's x(t) — used only to place the trail echoes,
  // never read back from the timeline (mirrors milestone-counter's sparkles).
  const knobXAt = (tt: number): number => {
    const u = clamp01((tt - SLIDE_START) / SLIDE_DUR);
    return trackLeftX + (knobTargetX - trackLeftX) * slideEase(u);
  };

  // --- Trail: a few faint echoes chasing the knob while it slides ---
  const echoes: { g: Graphics; delay: number }[] = [];
  if (showTrail) {
    const ECHO_N = 4;
    for (let i = 0; i < ECHO_N; i++) {
      const rFrac = 0.3 - i * 0.055;
      const g = new Graphics().circle(0, 0, knobR * rFrac).fill(accent);
      g.position.set(trackLeftX, rowCy);
      g.visible = false;
      card.addChild(g);
      echoes.push({ g, delay: (i + 1) * 0.05 });
    }
  }

  const PCT_END = SLIDE_END - 0.1;
  const update = (t: number): void => {
    const u = t <= SLIDE_START ? 0 : t >= PCT_END ? 1 : (t - SLIDE_START) / (PCT_END - SLIDE_START);
    pctNode.text = `${Math.round(value * outCubic(u))}%`;

    if (showTrail) {
      const fadeStart = SLIDE_END + 0.05;
      const fadeDur = 0.3;
      const globalFade = t <= fadeStart ? 1 : clamp01(1 - (t - fadeStart) / fadeDur);
      for (const e of echoes) {
        const visible = t >= SLIDE_START - 0.02 && globalFade > 0;
        e.g.visible = visible;
        if (!visible) continue;
        e.g.x = knobXAt(t - e.delay);
        e.g.alpha = 0.3 * globalFade;
      }
    }
  };

  return { timeline, duration: 3.9, update };
}

export const sliderSticker: TemplateDefinition = {
  id: "slider-sticker",
  name: "Slider Sticker",
  tagline: "An emoji-slider sticker glides to its value with a springy settle.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { question: "display" },
  palettes: PALETTES,
  fields: [
    { key: "question", type: "text", label: "Question", default: "How excited are you?", maxLength: 40, shrinkToFit: true },
    {
      key: "emoji",
      type: "select",
      label: "Emoji",
      default: "😍",
      options: [
        { value: "😍", label: "😍 Excited" },
        { value: "🔥", label: "🔥 Fire" },
        { value: "😂", label: "😂 Funny" },
        { value: "👍", label: "👍 Nice" },
        { value: "💯", label: "💯 Perfect" },
        { value: "😱", label: "😱 Wow" },
      ],
    },
    { key: "value", type: "slider", label: "Value", default: 80, min: 0, max: 100, step: 1 },
    { key: "showTrail", type: "toggle", label: "Motion trail", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

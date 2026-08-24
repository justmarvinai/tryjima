import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  spring,
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
const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// Instagram-ish gradients rendered as flat, punchy solids (no runtime gradients —
// keeps rendering deterministic and cheap). `chipBg`/`track`/`muted` are
// palette-only roles (not exposed as fields) that keep the sticker chips'
// internal contrast correct regardless of the user's accent/background choice.
const PALETTES: Palette[] = [
  { id: "classic", name: "Classic", colors: { background: "#4457E8", textColor: "#12163A", accent: "#4457E8", chipBg: "#FFFFFF", track: "#ECEFFB", muted: "#C7CDF2" } },
  { id: "sunset", name: "Sunset", colors: { background: "#FF5B72", textColor: "#3A0A12", accent: "#FF5B72", chipBg: "#FFFFFF", track: "#FFEEF0", muted: "#FFD2D8" } },
  { id: "midnight", name: "Midnight", colors: { background: "#14151F", textColor: "#FFFFFF", accent: "#7C5CFF", chipBg: "#22232F", track: "#2C2D3A", muted: "#3D3E4C" } },
  { id: "mint-pop", name: "Mint Pop", colors: { background: "#12B886", textColor: "#04231A", accent: "#12B886", chipBg: "#FFFFFF", track: "#EAFBF5", muted: "#CDF2E5" } },
];

interface ChipRefs {
  c: Container;
  fill: Graphics;
  thumb: Graphics;
  pct: Text;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#4457E8"));
  const textColor = str(values.textColor, pc("textColor", "#12163A"));
  const accent = str(values.accent, pc("accent", "#4457E8"));
  const chipBg = pc("chipBg", "#FFFFFF");
  const trackColor = pc("track", "#ECEFFB");
  const mutedColor = pc("muted", "#C7CDF2");

  const question = str(values.question, "Which do you like more?");
  const optionA = str(values.optionA, "Yes");
  const optionB = str(values.optionB, "No");
  const resultA = Math.round(clamp(num(values.result, 68), 0, 100));
  const resultB = 100 - resultA;
  const winnerIsA = resultA >= 50;
  const fracA = resultA / 100;
  const fracB = resultB / 100;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;

  const familyDisplay = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });

  // --- Question pill (content-width, like the real sticker) ---
  const clusterW = Math.min(safe.width * 0.94, minDim * 0.8);
  const qBase = Math.round(minDim * 0.05);
  const qPadX = Math.round(minDim * 0.05);
  const qPadY = Math.round(minDim * 0.032);
  const qSize = shrinkToFit(question, measure, { maxWidth: clusterW - qPadX * 2, baseSize: qBase, minSize: Math.round(qBase * 0.55) });
  const qWidth = Math.min(measure(question, qSize) + qPadX * 2, clusterW);
  const qHeight = qSize + qPadY * 2;

  // --- Option chips (fixed cluster width; label shrinks to leave room for %) ---
  const chipFontBase = Math.round(minDim * 0.042);
  const chipH = Math.round(minDim * 0.145);
  const chipPadX = Math.round(minDim * 0.045);
  const chipRadius = Math.round(chipH * 0.28);
  const chipW = clusterW;
  const trackW = chipW - chipPadX * 2;
  const trackH = Math.round(chipH * 0.15);
  const thumbR = Math.round(trackH * 0.9);
  const rowTextY = -chipH * 0.2;
  const rowTrackY = chipH * 0.28;
  const pctReserve = measure("100%", chipFontBase) + chipFontBase * 0.5;
  const labelMaxW = chipW - chipPadX * 2 - pctReserve;
  const fitLabel = (text: string): number =>
    shrinkToFit(text, measure, { maxWidth: labelMaxW, baseSize: chipFontBase, minSize: Math.round(chipFontBase * 0.55) });

  function makeChip(label: string, labelSize: number, fillColor: string, thumbColor: string): ChipRefs {
    const c = new Container();
    c.addChild(new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipRadius).fill(chipBg));

    const labelText = makeText(fonts, { text: label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    labelText.position.set(-chipW / 2 + chipPadX, rowTextY);
    c.addChild(labelText);

    const pctText = makeText(fonts, { text: "0%", role: "display", weight: 700, size: chipFontBase, color: textColor, anchor: { x: 1, y: 0.5 } });
    pctText.position.set(chipW / 2 - chipPadX, rowTextY);
    c.addChild(pctText);

    const trackBg = new Graphics().roundRect(-trackW / 2, -trackH / 2, trackW, trackH, trackH / 2).fill(trackColor);
    trackBg.position.set(0, rowTrackY);
    c.addChild(trackBg);

    // Fill sweeps from the track's left edge via scale.x (kinetic-headline's
    // underline idiom); the thumb sits on the leading edge and visually caps it.
    const fill = new Graphics().roundRect(0, 0, trackW, trackH, trackH / 2).fill(fillColor);
    fill.position.set(-trackW / 2, rowTrackY - trackH / 2);
    fill.scale.set(0, 1);
    c.addChild(fill);

    const thumb = new Graphics().circle(0, 0, thumbR).fill(thumbColor);
    thumb.position.set(-trackW / 2, rowTrackY);
    c.addChild(thumb);

    return { c, fill, thumb, pct: pctText };
  }

  const chipA = makeChip(optionA, fitLabel(optionA), winnerIsA ? accent : mutedColor, winnerIsA ? accent : mutedColor);
  const chipB = makeChip(optionB, fitLabel(optionB), winnerIsA ? mutedColor : accent, winnerIsA ? mutedColor : accent);
  const winner = winnerIsA ? chipA : chipB;

  // Winning-chip ring, revealed once the result lands.
  const ringPad = Math.max(3, Math.round(chipH * 0.045));
  const ring = new Graphics()
    .roundRect(-chipW / 2 - ringPad, -chipH / 2 - ringPad, chipW + ringPad * 2, chipH + ringPad * 2, chipRadius + ringPad)
    .stroke({ color: accent, width: Math.max(2, Math.round(chipH * 0.025)) });
  ring.alpha = 0;
  winner.c.addChild(ring);

  // --- Vertical stack: question, then the two chips, centered in the safe area ---
  const gapQA = Math.round(minDim * 0.045);
  const gapAB = Math.round(minDim * 0.03);
  const totalH = qHeight + gapQA + chipH + gapAB + chipH;
  const top = safe.y + safe.height / 2 - totalH / 2;
  const qCenterY = top + qHeight / 2;
  const chipACenterY = top + qHeight + gapQA + chipH / 2;
  const chipBCenterY = top + qHeight + gapQA + chipH + gapAB + chipH / 2;

  // Question pill entrance.
  const qPill = new Container();
  qPill.addChild(new Graphics().roundRect(-qWidth / 2, -qHeight / 2, qWidth, qHeight, qHeight / 2).fill(chipBg));
  qPill.addChild(makeText(fonts, { text: question, role: "display", weight: 700, size: qSize, color: textColor, anchor: 0.5, align: "center" }));
  qPill.position.set(cx, qCenterY + 40);
  qPill.alpha = 0;
  qPill.scale.set(0.7);
  root.addChild(qPill);
  timeline
    .to(qPill, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.3, ease: outQuad })
    .to(qPill, { prop: "scale.x", from: 0.7, to: 1, start: 0.1, duration: 0.55, ease: spring(0.45) })
    .to(qPill, { prop: "scale.y", from: 0.7, to: 1, start: 0.1, duration: 0.55, ease: spring(0.45) })
    .to(qPill, { prop: "y", from: qCenterY + 40, to: qCenterY, start: 0.1, duration: 0.55, ease: outExpo });

  // Option chip entrances (A then B).
  const rowEntrance = (row: ChipRefs, centerY: number, start: number): void => {
    row.c.position.set(cx, centerY + 44);
    row.c.alpha = 0;
    row.c.scale.set(0.85);
    root.addChild(row.c);
    timeline
      .to(row.c, { prop: "alpha", from: 0, to: 1, start, duration: 0.3, ease: outQuad })
      .to(row.c, { prop: "scale.x", from: 0.85, to: 1, start, duration: 0.55, ease: spring(0.42) })
      .to(row.c, { prop: "scale.y", from: 0.85, to: 1, start, duration: 0.55, ease: spring(0.42) })
      .to(row.c, { prop: "y", from: centerY + 44, to: centerY, start, duration: 0.55, ease: outExpo });
  };
  rowEntrance(chipA, chipACenterY, 0.35);
  rowEntrance(chipB, chipBCenterY, 0.5);

  // Slider fill + thumb slide to the result once both chips have landed.
  const SLIDE_START = 1.1;
  const SLIDE_DUR = 0.9;
  timeline
    .to(chipA.fill, { prop: "scale.x", from: 0, to: fracA, start: SLIDE_START, duration: SLIDE_DUR, ease: outExpo })
    .to(chipA.thumb, { prop: "x", from: -trackW / 2, to: -trackW / 2 + trackW * fracA, start: SLIDE_START, duration: SLIDE_DUR, ease: makeOutBack(1.3) })
    .to(chipB.fill, { prop: "scale.x", from: 0, to: fracB, start: SLIDE_START, duration: SLIDE_DUR, ease: outExpo })
    .to(chipB.thumb, { prop: "x", from: -trackW / 2, to: -trackW / 2 + trackW * fracB, start: SLIDE_START, duration: SLIDE_DUR, ease: makeOutBack(1.3) });

  // Winner emphasis: ring fades in + a small confirmation pulse.
  const WIN_AT = SLIDE_START + SLIDE_DUR;
  timeline.to(ring, { prop: "alpha", from: 0, to: 1, start: WIN_AT, duration: 0.3, ease: outQuad });
  timeline
    .to(winner.c, { prop: "scale.x", from: 1, to: 1.045, start: WIN_AT, duration: 0.16, ease: outQuad })
    .to(winner.c, { prop: "scale.y", from: 1, to: 1.045, start: WIN_AT, duration: 0.16, ease: outQuad })
    .to(winner.c, { prop: "scale.x", from: 1.045, to: 1, start: WIN_AT + 0.16, duration: 0.28, ease: outQuad })
    .to(winner.c, { prop: "scale.y", from: 1.045, to: 1, start: WIN_AT + 0.16, duration: 0.28, ease: outQuad });

  // Live percentage count-up, synced to the slider slide.
  const update = (t: number): void => {
    const u = t <= SLIDE_START ? 0 : t >= WIN_AT ? 1 : (t - SLIDE_START) / SLIDE_DUR;
    const eased = 1 - Math.pow(1 - u, 3);
    chipA.pct.text = `${Math.round(resultA * eased)}%`;
    chipB.pct.text = `${Math.round(resultB * eased)}%`;
  };

  return { timeline, duration: 4.2, update };
}

export const storyPoll: TemplateDefinition = {
  id: "story-poll",
  name: "Story Poll",
  tagline: "A poll sticker settles: chips pop in and the result slides to a winner.",
  category: "social",
  aspects: ["9:16", "1:1", "4:5", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 3.2,
  palettes: PALETTES,
  fields: [
    { key: "question", type: "text", label: "Question", default: "Which do you like more?", maxLength: 40, shrinkToFit: true },
    { key: "optionA", type: "text", label: "Option A", default: "Yes", maxLength: 20 },
    { key: "optionB", type: "text", label: "Option B", default: "No", maxLength: 20 },
    { key: "result", type: "slider", label: "Result (% to option A)", default: 68, min: 0, max: 100, step: 1 },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
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
  return w > maxWidth ? Math.max(9, Math.floor((size * maxWidth) / w)) : size;
}

// The 100-dot grid is decorative color (muted `dot` base, accent when counted);
// all reading text — kicker, big percent, caption — is textColor on background,
// ≥ 4.5:1 in every palette.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", dot: "#E4E7EC", card: "#F6F5F2" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#2E7DF6", dot: "#D5E0F5", card: "#FFFFFF" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#17A34A", dot: "#D3EBDD", card: "#FFFFFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", dot: "#26262E", card: "#1A1A21" } },
];

const GRID = 10; // 10 × 10 = one dot per percent point
const DOTS_START = 0.35;
const WAVE_EACH = 0.04;
const JITTER = 0.06;
const POP_DUR = 0.35;
const FLIP_START = 1.6;
const FLIP_SPAN = 0.9;
const DURATION = 4.1;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const dotColor = str(values.dotColor, pc("dot", "#E4E7EC"));
  const cardColor = pc("card", "#F6F5F2");

  const pct = Math.round(Math.max(1, Math.min(100, num(values.percent, 68))));
  const kicker = str(values.kicker, "");
  const caption = str(values.caption, "of teams post weekly");
  const showCard = values.gridCard !== false;
  const dimRest = values.dimUnfilled !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const wide = ctx.aspect === "16:9";

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);

  // --- Layout: grid beside the readout (wide) or stacked above it (tall) ---
  const gridSide = wide
    ? Math.min(zone.height * 0.92, zone.width * 0.42)
    : Math.min(zone.width * 0.86, zone.height * 0.55);
  const cell = gridSide / GRID;
  const dotR = cell * 0.32;
  const cardPad = showCard ? cell * 0.5 : 0;

  // Text sizes are needed up front so the tall layout can center the whole
  // grid + readout stack inside the safe zone.
  const display = `${pct}%`;
  const blockMaxW = wide ? zone.width * 0.42 : zone.width * 0.9;
  const numSize = fitSize(fonts, display, "display", 700, Math.round(minDim * (wide ? 0.17 : 0.145)), blockMaxW);
  const kickerUpper = kicker.toUpperCase();
  const kSize = kicker.length > 0 ? fitSize(fonts, kickerUpper, "body", 600, Math.round(minDim * 0.026), blockMaxW) : 0;
  const capSize = fitSize(fonts, caption, "body", 600, Math.round(minDim * 0.034), blockMaxW);

  const stackGap = minDim * 0.05;
  const tallTextH = (kicker.length > 0 ? kSize + minDim * 0.024 : 0) + numSize * 1.18 + capSize * 0.7;
  const tallContentH = gridSide + cardPad + stackGap + tallTextH;
  const tallShift = Math.min(minDim * 0.13, Math.max(0, (zone.height - minDim * 0.012 - tallContentH) / 2));

  const gridCx = wide ? zone.x + zone.width * 0.26 : zone.x + zone.width / 2;
  const gridTop = wide ? zone.y + zone.height / 2 - gridSide / 2 : zone.y + minDim * 0.012 + tallShift;
  const gridLeft = gridCx - gridSide / 2;

  // --- Optional card behind the grid ---
  if (showCard) {
    const pad = cardPad;
    const card = new Graphics().roundRect(-gridSide / 2 - pad, -gridSide / 2 - pad, gridSide + pad * 2, gridSide + pad * 2, cell * 0.7).fill(cardColor);
    card.position.set(gridCx, gridTop + gridSide / 2);
    card.alpha = 0;
    card.scale.set(0.92);
    root.addChild(card);
    timeline
      .to(card, { prop: "alpha", from: 0, to: 1, start: 0.1, duration: 0.45, ease: outQuad })
      .to(card, { prop: "scale.x", from: 0.92, to: 1, start: 0.1, duration: 0.55, ease: outQuint })
      .to(card, { prop: "scale.y", from: 0.92, to: 1, start: 0.1, duration: 0.55, ease: outQuint });
  }

  // --- 100 dots pop in a jittered diagonal wave; the first `pct` (row-major)
  // then flip to accent in a left-to-right sweep the count-up follows. ---
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const idx = r * GRID + c;
      const dc = new Container();
      dc.position.set(gridLeft + (c + 0.5) * cell, gridTop + (r + 0.5) * cell);
      dc.scale.set(0);
      root.addChild(dc);

      dc.addChild(new Graphics().circle(0, 0, dotR).fill(dotColor));
      const over = new Graphics().circle(0, 0, dotR).fill(accent);
      over.alpha = 0;
      dc.addChild(over);

      const popAt = DOTS_START + (r + c) * WAVE_EACH + rng.range(0, JITTER);
      timeline
        .to(dc, { prop: "scale.x", from: 0, to: 1, start: popAt, duration: POP_DUR, ease: makeOutBack(1.8) })
        .to(dc, { prop: "scale.y", from: 0, to: 1, start: popAt, duration: POP_DUR, ease: makeOutBack(1.8) });

      if (idx < pct) {
        const fs = FLIP_START + (idx / pct) * FLIP_SPAN;
        timeline
          .to(over, { prop: "alpha", from: 0, to: 1, start: fs, duration: 0.16, ease: outQuad })
          .to(dc, { prop: "scale.x", from: 1, to: 1.25, start: fs, duration: 0.12, ease: outQuad })
          .to(dc, { prop: "scale.y", from: 1, to: 1.25, start: fs, duration: 0.12, ease: outQuad })
          .to(dc, { prop: "scale.x", from: 1.25, to: 1, start: fs + 0.12, duration: 0.22, ease: makeOutBack(2) })
          .to(dc, { prop: "scale.y", from: 1.25, to: 1, start: fs + 0.12, duration: 0.22, ease: makeOutBack(2) });
      } else if (dimRest) {
        timeline.to(dc, { prop: "alpha", from: 1, to: 0.42, start: FLIP_START + FLIP_SPAN, duration: 0.45, ease: outQuad });
      }
    }
  }

  // --- Readout: kicker, counting percent, caption ---
  const blockX = wide ? zone.x + zone.width * 0.56 : zone.x + zone.width / 2;
  const anchor = wide ? { x: 0, y: 0.5 } : { x: 0.5, y: 0.5 };

  const stackTop = gridTop + gridSide + cardPad + stackGap;
  const numberY = wide
    ? zone.y + zone.height * 0.5
    : stackTop + (kicker.length > 0 ? kSize + minDim * 0.024 : 0) + numSize * 0.52;

  if (kicker.length > 0) {
    const kickerText = makeText(fonts, { text: kickerUpper, role: "body", weight: 600, size: kSize, color: textColor, anchor, letterSpacing: 2 });
    kickerText.position.set(blockX, wide ? numberY - numSize * 0.72 : stackTop + kSize * 0.5);
    kickerText.alpha = 0;
    root.addChild(kickerText);
    timeline.to(kickerText, { prop: "alpha", from: 0, to: 0.7, start: 0.35, duration: 0.4, ease: outQuad });
  }

  const pctText = makeText(fonts, { text: "0%", role: "display", weight: 700, size: numSize, color: textColor, anchor });
  pctText.position.set(blockX, numberY);
  pctText.alpha = 0;
  root.addChild(pctText);
  const flipEnd = FLIP_START + FLIP_SPAN;
  timeline
    .to(pctText, { prop: "alpha", from: 0, to: 1, start: 0.45, duration: 0.45, ease: outQuad })
    .to(pctText, { prop: "scale.x", from: 1, to: 1.07, start: flipEnd, duration: 0.15, ease: outQuad })
    .to(pctText, { prop: "scale.x", from: 1.07, to: 1, start: flipEnd + 0.15, duration: 0.25, ease: outQuad })
    .to(pctText, { prop: "scale.y", from: 1, to: 1.07, start: flipEnd, duration: 0.15, ease: outQuad })
    .to(pctText, { prop: "scale.y", from: 1.07, to: 1, start: flipEnd + 0.15, duration: 0.25, ease: outQuad });

  const capText = makeText(fonts, { text: caption, role: "body", weight: 600, size: capSize, color: textColor, anchor });
  capText.position.set(blockX, numberY + numSize * 0.66);
  capText.alpha = 0;
  root.addChild(capText);
  timeline.to(capText, { prop: "alpha", from: 0, to: 0.9, start: 0.6, duration: 0.45, ease: outQuad });

  // Count-up rides the same linear sweep the dot flips use, so the number and
  // the accent wave always agree.
  const update = (t: number): void => {
    const p = clamp01((t - FLIP_START) / FLIP_SPAN);
    pctText.text = `${Math.round(p * pct)}%`;
  };

  return { timeline, duration: DURATION, update };
}

export const dotStats: TemplateDefinition = {
  id: "dot-stats",
  name: "Dot Stats",
  tagline: "A hundred dots pop in, then exactly your percent flip to accent and count up.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.3,
  fontRoles: { caption: "body", kicker: "body" },
  palettes: PALETTES,
  fields: [
    { key: "percent", type: "slider", label: "Percent", default: 68, min: 1, max: 100, step: 1 },
    { key: "caption", type: "text", label: "Caption", default: "of teams post weekly", maxLength: 44, shrinkToFit: true },
    { key: "kicker", type: "text", label: "Kicker", default: "Posting habits", maxLength: 24, optional: true, shrinkToFit: true },
    { key: "gridCard", type: "toggle", label: "Grid card", default: true },
    { key: "dimUnfilled", type: "toggle", label: "Dim the rest", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "dotColor", type: "color", label: "Base dots", default: "", optional: true },
  ],
  build,
};

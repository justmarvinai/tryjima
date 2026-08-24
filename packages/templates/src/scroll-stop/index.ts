import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  wrapText,
  outQuad,
  outExpo,
  inOutCubic,
  safeRect,
  type Aspect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

// Scroll Stop — a pattern-interrupt hook, framed as a social card. The card
// settles first, then the oversized claim scales up from 0.9 on a long expo
// while its lines stagger in beneath it; a small "keep watching" cue drifts on a
// slow, pure sine at the foot of the card. Confident, not shouty.

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const on = (v: unknown): boolean => v !== false;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 1;
  const n = parseInt(m[1]!, 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
const inkOn = (hex: string): string => (luminance(hex) < 0.56 ? "#FFFFFF" : "#14161B");

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  if (text.length === 0 || maxWidth <= 0) return size0;
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor((size0 * maxWidth) / w)) : size0;
}

const PALETTES: Palette[] = [
  { id: "porcelain", name: "Porcelain", colors: { background: "#EFEEEB", cardColor: "#FFFFFF", textColor: "#16181D", accent: "#1F6F5C" } },
  { id: "mist", name: "Mist", colors: { background: "#E4E9F1", cardColor: "#FFFFFF", textColor: "#101722", accent: "#2A55A5" } },
  { id: "sand", name: "Sand", colors: { background: "#EFE7DA", cardColor: "#FFFFFF", textColor: "#241D15", accent: "#9C4D1C" } },
  { id: "ink", name: "Ink", colors: { background: "#08090C", cardColor: "#171A21", textColor: "#F3F5F8", accent: "#86D3B6" } },
];

/** Card proportion per aspect — a feed card that frames well tall and wide. */
function cardRatio(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.92;
    case "1:1":
      return 1.0;
    case "4:5":
      return 1.18;
    case "9:16":
      return 1.2;
  }
}

const CARD_AT = 0.0;
const BLOCK_AT = 0.18;
const LINE_AT = 0.24;
const LINE_STAGGER = 0.09;
const CHIP_AT = 0.55;
const MARK_AT = 1.35;
const CUE_AT = 1.75;
const CUE_RISE = 0.9;
const CUE_SETTLE = CUE_AT + CUE_RISE;
const DRIFT_PERIOD = 1.3;
const DURATION = 4.6; // (DURATION - CUE_SETTLE) / DRIFT_PERIOD = 1.5 → cue rests neutral

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#EFEEEB"));
  const cardColor = str(values.cardColor, pc("cardColor", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#16181D"));
  const accent = str(values.accent, pc("accent", "#1F6F5C"));

  const headline = str(values.headline, "What makes people stop scrolling?");
  const handle = str(values.handle, "@northlight");
  const cue = str(values.cue, "Keep watching");
  const showChip = on(values.showHandle) && handle.length > 0;
  const showCue = on(values.showCue) && cue.length > 0;
  const showMark = on(values.showMark);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- The card ---
  const cardW = Math.min(safe.width, minDim * 1.0);
  const cardH = Math.min(safe.height, cardW * cardRatio(ctx.aspect));
  const cardCy = safe.y + safe.height / 2;
  const cardR = cardW * 0.055;
  const pad = cardW * 0.075;

  const card = new Container();
  card.position.set(cx, cardCy);
  card.alpha = 0;
  root.addChild(card);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2, -cardH / 2 + cardH * 0.012, cardW, cardH, cardR)
      .fill({ color: "#000000", alpha: 0.1 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardR).fill(cardColor));
  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: CARD_AT, duration: 0.5, ease: outQuad })
    .to(card, { prop: "y", from: cardCy + cardH * 0.022, to: cardCy, start: CARD_AT, duration: 1.05, ease: outExpo });

  // --- Handle chip (top-left) ---
  const chipH = showChip ? cardW * 0.075 : 0;
  if (showChip) {
    const chip = new Container();
    const dotR = chipH * 0.44;
    const chipCy = -cardH / 2 + pad + chipH / 2;
    chip.addChild(new Graphics().circle(0, 0, dotR).fill(accent));
    chip.addChild(
      makeText(fonts, {
        text: handle.replace(/^@+/, "").charAt(0).toUpperCase() || "?",
        role: "display",
        weight: 700,
        size: Math.round(dotR * 0.95),
        color: inkOn(accent),
        anchor: 0.5,
      }),
    );
    const hSize = fitSize(fonts, handle, "body", 600, Math.round(chipH * 0.46), cardW - pad * 2 - dotR * 2.4);
    const hText = makeText(fonts, { text: handle, role: "body", weight: 600, size: hSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    hText.position.set(dotR * 1.5, 0);
    hText.alpha = 0.72;
    chip.addChild(hText);
    chip.position.set(-cardW / 2 + pad + dotR, chipCy);
    chip.alpha = 0;
    card.addChild(chip);
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start: CHIP_AT, duration: 0.6, ease: outQuad })
      .to(chip, { prop: "x", from: -cardW / 2 + pad + dotR - cardW * 0.02, to: -cardW / 2 + pad + dotR, start: CHIP_AT, duration: 0.95, ease: outExpo });
  }

  // --- Cue metrics (reserved before the headline is centered) ---
  const cueH = showCue ? cardW * 0.085 : 0;

  // --- Oversized claim ---
  const textMaxW = cardW - pad * 2;
  const familyDisplay = fonts.family("display");
  const measure = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });
  const markGap = cardW * 0.06;
  const markH = Math.max(3, cardW * 0.014);
  const markW = cardW * 0.17;
  const markBlock = showMark ? markGap + markH : 0;

  const regionTop = -cardH / 2 + pad + chipH + (showChip ? cardW * 0.05 : 0);
  const regionBot = cardH / 2 - pad - cueH - (showCue ? cardW * 0.05 : 0);
  const regionH = regionBot - regionTop;

  // Largest size (≤ 4 lines) whose whole block still clears the chip and the cue
  // — a deterministic downward scan, so long/German copy never crowds them.
  const minSize = Math.round(cardW * 0.048);
  let fontSize = Math.round(cardW * 0.125);
  let lines = wrapText(headline, measure, fontSize, textMaxW);
  while (fontSize > minSize) {
    lines = wrapText(headline, measure, fontSize, textMaxW);
    if (lines.length <= 4 && lines.length * Math.round(fontSize * 1.12) + markBlock <= regionH * 0.88) break;
    fontSize -= 1;
  }
  const lineH = Math.round(fontSize * 1.12);
  const blockH = lines.length * lineH + markBlock;
  const blockCy = regionTop + regionH / 2;

  const block = new Container();
  block.position.set(0, blockCy);
  block.scale.set(0.9);
  card.addChild(block);
  timeline
    .to(block, { prop: "scale.x", from: 0.9, to: 1, start: BLOCK_AT, duration: 1.15, ease: outExpo })
    .to(block, { prop: "scale.y", from: 0.9, to: 1, start: BLOCK_AT, duration: 1.15, ease: outExpo });

  const textX = -cardW / 2 + pad;
  lines.forEach((ln, i) => {
    const baseY = -blockH / 2 + i * lineH;
    const t = makeText(fonts, {
      text: ln,
      role: "display",
      weight: 700,
      size: fontSize,
      color: textColor,
      anchor: { x: 0, y: 0 },
      letterSpacing: -fontSize * 0.018,
    });
    t.position.set(textX, baseY);
    t.alpha = 0;
    block.addChild(t);
    const start = LINE_AT + i * LINE_STAGGER;
    timeline
      .to(t, { prop: "alpha", from: 0, to: 1, start, duration: 0.6, ease: outQuad })
      .to(t, { prop: "y", from: baseY + lineH * 0.22, to: baseY, start, duration: 1.0, ease: outExpo });
  });

  if (showMark) {
    const markY = -blockH / 2 + lines.length * lineH + markGap;
    const mark = new Graphics().roundRect(0, 0, markW, markH, markH / 2).fill(accent);
    mark.position.set(textX, markY);
    mark.scale.x = 0;
    block.addChild(mark);
    timeline.to(mark, { prop: "scale.x", from: 0, to: 1, start: MARK_AT, duration: 0.9, ease: inOutCubic });
  }

  // --- "Keep watching" cue, drifting on a slow sine ---
  let cueInner: Container | null = null;
  let driftAmp = 0;
  if (showCue) {
    const cueCy = cardH / 2 - pad - cueH / 2;
    const cueWrap = new Container();
    cueWrap.position.set(0, cueCy);
    cueWrap.alpha = 0;
    card.addChild(cueWrap);

    cueInner = new Container();
    cueWrap.addChild(cueInner);

    const cSize = fitSize(fonts, cue, "body", 600, Math.round(cueH * 0.4), cardW * 0.6);
    const cText = makeText(fonts, { text: cue, role: "body", weight: 600, size: cSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    cText.alpha = 0.72;
    const chevS = cueH * 0.22;
    const chev = new Graphics()
      .moveTo(-chevS, -chevS * 0.45)
      .lineTo(0, chevS * 0.45)
      .lineTo(chevS, -chevS * 0.45)
      .stroke({ color: accent, width: Math.max(2, chevS * 0.28), cap: "round", join: "round" });

    const innerW = chevS * 2 + cueH * 0.34 + cText.width;
    const pillW = innerW + cueH * 0.9;
    const pill = new Graphics().roundRect(-pillW / 2, -cueH / 2, pillW, cueH, cueH / 2).fill({ color: textColor, alpha: 0.06 });
    cueInner.addChild(pill);
    chev.position.set(-innerW / 2 + chevS, 0);
    cueInner.addChild(chev);
    cText.position.set(-innerW / 2 + chevS * 2 + cueH * 0.34, 0);
    cueInner.addChild(cText);

    driftAmp = cardW * 0.016;
    timeline
      .to(cueWrap, { prop: "alpha", from: 0, to: 1, start: CUE_AT, duration: 0.65, ease: outQuad })
      .to(cueWrap, { prop: "y", from: cueCy + cardW * 0.045, to: cueCy, start: CUE_AT, duration: CUE_RISE, ease: outExpo });
  }

  const inner = cueInner;
  const update =
    inner === null
      ? undefined
      : (t: number): void => {
          const ramp = clamp01((t - CUE_SETTLE) / 0.45);
          const phase = Math.max(0, t - CUE_SETTLE) / DRIFT_PERIOD;
          inner.y = Math.sin(phase * Math.PI * 2) * driftAmp * ramp;
        };

  return update ? { timeline, duration: DURATION, update } : { timeline, duration: DURATION };
}

export const scrollStop: TemplateDefinition = {
  id: "scroll-stop",
  name: "Scroll Stop",
  tagline: "An oversized claim scales gently into a feed card while a keep-watching cue drifts.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { headline: "display", handle: "body", cue: "body" },
  palettes: PALETTES,
  fields: [
    { key: "headline", type: "textarea", label: "Hook", default: "What makes people stop scrolling?", maxLength: 90, maxLines: 4 },
    { key: "handle", type: "text", label: "Handle", default: "@northlight", maxLength: 22, shrinkToFit: true },
    { key: "cue", type: "text", label: "Cue", default: "Keep watching", maxLength: 24, shrinkToFit: true },
    { key: "showHandle", type: "toggle", label: "Handle chip", default: true },
    { key: "showMark", type: "toggle", label: "Accent mark", default: true },
    { key: "showCue", type: "toggle", label: "Keep-watching cue", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "cardColor", type: "color", label: "Card", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

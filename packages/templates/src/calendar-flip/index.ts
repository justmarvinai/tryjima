import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outQuint,
  outExpo,
  inQuad,
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
const DEG = Math.PI / 180;

function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size: number,
  maxWidth: number,
  letterSpacing = 0,
): number {
  if (text.length === 0 || maxWidth <= 0) return size;
  const w = fonts.measure(text, {
    family: fonts.family(role),
    weight,
    size,
    ...(letterSpacing ? { letterSpacing } : {}),
  });
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

// onAccent is a palette-only role (header-strip text) — not user-exposed.
const PALETTES: Palette[] = [
  { id: "paper-red", name: "Paper red", colors: { background: "#F3EEE3", cardColor: "#FFFFFF", textColor: "#1E1B16", accent: "#B82E1A", onAccent: "#FFFFFF" } },
  { id: "ink-mono", name: "Ink mono", colors: { background: "#121214", cardColor: "#1D1D22", textColor: "#F5F3EC", accent: "#D8F34D", onAccent: "#14150A" } },
  { id: "blush-plan", name: "Blush planner", colors: { background: "#FFF1F3", cardColor: "#FFFFFF", textColor: "#2B0E16", accent: "#C81361", onAccent: "#FFFFFF" } },
  { id: "slate-teal", name: "Slate teal", colors: { background: "#EAF2F1", cardColor: "#FFFFFF", textColor: "#14211F", accent: "#0C645A", onAccent: "#FFFFFF" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F3EEE3"));
  const cardColor = pc("cardColor", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#1E1B16"));
  const accent = str(values.accent, pc("accent", "#B82E1A"));
  const onAccent = pc("onAccent", "#FFFFFF");
  const showHeader = values.showHeader !== false;

  const titleVal = str(values.title, "Team Offsite");
  const monthVal = str(values.month, "SEPTEMBER").toUpperCase();
  const dayVal = str(values.day, "12");
  const weekdayVal = str(values.weekday, "SATURDAY").toUpperCase();

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // minDim is 1080 for every aspect (each ratio pins one side to 1080), so the
  // card's own size can be a fixed fraction of it; only its position needs to
  // adapt per aspect (via safeRect).
  const cardW = minDim * 0.58;
  const cardH = minDim * 0.64;
  const radius = cardW * 0.045;
  const rect = safeRect(ctx.aspect);
  const cardTop = rect.y + rect.height * 0.04;
  const cardCx = w / 2;
  const cardCy = cardTop + cardH / 2;

  const headerH = showHeader ? cardH * 0.19 : 0;

  const cardGroup = new Container();
  cardGroup.position.set(cardCx, cardCy);
  cardGroup.scale.set(0.92);
  cardGroup.alpha = 0;
  root.addChild(cardGroup);
  timeline
    .to(cardGroup, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.3, ease: outQuad })
    .to(cardGroup, { prop: "scale.x", from: 0.92, to: 1, start: 0, duration: 0.35, ease: outQuad })
    .to(cardGroup, { prop: "scale.y", from: 0.92, to: 1, start: 0, duration: 0.35, ease: outQuad });

  // Card body.
  cardGroup.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, radius).fill(cardColor));

  // --- Header chrome (month strip + hanger rings) ---
  if (showHeader) {
    const ringR = cardW * 0.022;
    const ring1 = new Graphics().circle(-cardW * 0.22, -cardH / 2, ringR).fill(accent);
    const ring2 = new Graphics().circle(cardW * 0.22, -cardH / 2, ringR).fill(accent);
    ring1.scale.set(0);
    ring2.scale.set(0);
    cardGroup.addChild(ring1, ring2);

    const header = new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, headerH, radius).fill(accent);
    header.pivot.set(0, -headerH / 2);
    header.position.set(0, -cardH / 2);
    header.scale.set(1, 0);
    cardGroup.addChild(header);

    const monthSize = fitSize(fonts, monthVal, "body", 700, Math.round(headerH * 0.42), cardW * 0.86, 2);
    const monthText = makeText(fonts, { text: monthVal, role: "body", weight: 700, size: monthSize, color: onAccent, anchor: 0.5, letterSpacing: 2 });
    monthText.position.set(0, -cardH / 2 + headerH / 2);
    monthText.alpha = 0;
    cardGroup.addChild(monthText);

    timeline
      .to(header, { prop: "scale.y", from: 0, to: 1, start: 0.12, duration: 0.4, ease: makeOutBack(1.5) })
      .to(ring1, { prop: "scale.x", from: 0, to: 1, start: 0.15, duration: 0.35, ease: makeOutBack(2.2) })
      .to(ring1, { prop: "scale.y", from: 0, to: 1, start: 0.15, duration: 0.35, ease: makeOutBack(2.2) })
      .to(ring2, { prop: "scale.x", from: 0, to: 1, start: 0.2, duration: 0.35, ease: makeOutBack(2.2) })
      .to(ring2, { prop: "scale.y", from: 0, to: 1, start: 0.2, duration: 0.35, ease: makeOutBack(2.2) })
      .to(monthText, { prop: "alpha", from: 0, to: 1, start: 0.28, duration: 0.35, ease: outQuad });
  }

  // --- Weekday caption ---
  let weekdayBlockH = cardH * 0.04;
  if (weekdayVal.length > 0) {
    const wkSize = fitSize(fonts, weekdayVal, "body", 600, Math.round(cardH * 0.05), cardW * 0.8, 2);
    const wkY = -cardH / 2 + headerH + cardH * 0.09;
    const wk = makeText(fonts, { text: weekdayVal, role: "body", weight: 600, size: wkSize, color: accent, anchor: 0.5, letterSpacing: 2 });
    wk.position.set(0, wkY);
    wk.alpha = 0;
    cardGroup.addChild(wk);
    timeline
      .to(wk, { prop: "alpha", from: 0, to: 1, start: 0.3, duration: 0.35, ease: outQuad })
      .to(wk, { prop: "y", from: wkY - 8, to: wkY, start: 0.3, duration: 0.4, ease: outQuint });
    weekdayBlockH = cardH * 0.15;
  }

  // --- The flipping day number (single node — swapped via discrete .set() at
  // the instant scale hits 0, so no per-frame update() is needed) ---
  const digitAreaTop = -cardH / 2 + headerH + weekdayBlockH;
  const digitAreaBottom = cardH / 2 - cardH * 0.07;
  const digitCenterY = (digitAreaTop + digitAreaBottom) / 2;
  const digitSize = fitSize(fonts, dayVal.length > 0 ? dayVal : "0", "display", 700, Math.round((digitAreaBottom - digitAreaTop) * 0.82), cardW * 0.62);

  const decoy0 = String(rng.int(1, 28));
  const decoy1 = String(rng.int(1, 28));
  const decoy2 = String(rng.int(1, 28));
  const states = [decoy0, decoy1, decoy2, dayVal];

  const digitText = makeText(fonts, { text: states[0]!, role: "display", weight: 700, size: digitSize, color: textColor, anchor: 0.5 });
  digitText.position.set(0, digitCenterY);
  cardGroup.addChild(digitText);

  const flipsStart = 0.35;
  const cycleDur = 0.22;
  const wiggle = [5, -5, 4]; // degrees, per flip — fixed, deterministic

  for (let i = 0; i < 3; i++) {
    const t0 = flipsStart + i * cycleDur;
    const half = cycleDur / 2;
    const isFinal = i === 2;
    const angle = wiggle[i]! * DEG;

    // Down (collapse away).
    timeline
      .to(digitText, { prop: "scale.x", from: 1, to: 0, start: t0, duration: half, ease: inQuad })
      .to(digitText, { prop: "scale.y", from: 1, to: 0, start: t0, duration: half, ease: inQuad })
      .to(digitText, { prop: "rotation", from: 0, to: angle, start: t0, duration: half, ease: inQuad });

    // Swap the glyph at the exact instant it is invisible (scale 0).
    timeline.set(digitText, "text", states[i + 1]!, t0 + half);

    if (!isFinal) {
      // Up (settle back to rest).
      timeline
        .to(digitText, { prop: "scale.x", from: 0, to: 1, start: t0 + half, duration: half, ease: outQuad })
        .to(digitText, { prop: "scale.y", from: 0, to: 1, start: t0 + half, duration: half, ease: outQuad })
        .to(digitText, { prop: "rotation", from: angle, to: 0, start: t0 + half, duration: half, ease: outQuad });
    } else {
      // Landing on the real date — scale in with emphasis (overshoot, then settle).
      const popDur = half * 1.45;
      const settleDur = half * 1.3;
      timeline
        .to(digitText, { prop: "scale.x", from: 0, to: 1.25, start: t0 + half, duration: popDur, ease: makeOutBack(1.8) })
        .to(digitText, { prop: "scale.y", from: 0, to: 1.25, start: t0 + half, duration: popDur, ease: makeOutBack(1.8) })
        .to(digitText, { prop: "rotation", from: angle, to: 0, start: t0 + half, duration: popDur, ease: outQuad })
        .to(digitText, { prop: "scale.x", from: 1.25, to: 1, start: t0 + half + popDur, duration: settleDur, ease: outQuad })
        .to(digitText, { prop: "scale.y", from: 1.25, to: 1, start: t0 + half + popDur, duration: settleDur, ease: outQuad });
    }
  }

  // --- Event title, below the card ---
  const titleY = cardTop + cardH + cardH * 0.12;
  const titleSize = fitSize(fonts, titleVal, "display", 700, Math.round(minDim * 0.042), rect.width * 0.85);
  const titleText = makeText(fonts, { text: titleVal, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cardCx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);

  const titleStart = 1.3;
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: titleStart, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY + 16, to: titleY, start: titleStart, duration: 0.5, ease: outExpo });

  return { timeline, duration: 3.2 };
}

export const calendarFlip: TemplateDefinition = {
  id: "calendar-flip",
  name: "Calendar Flip",
  tagline: "Calendar pages flip through quick decoys and land on the date.",
  category: "event",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.2,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Event title", default: "Team Offsite", maxLength: 32, shrinkToFit: true },
    { key: "month", type: "text", label: "Month", default: "SEPTEMBER", maxLength: 16 },
    { key: "day", type: "text", label: "Day", default: "12", maxLength: 3 },
    { key: "weekday", type: "text", label: "Weekday", default: "SATURDAY", maxLength: 12, optional: true },
    { key: "showHeader", type: "toggle", label: "Month header", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outCubic,
  spring,
  safeRect,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

/** Largest size <= size0 at which `text` fits `maxWidth` (crisp, single-line). */
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
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

interface Opt {
  label: string;
  pct: number;
}

/** Parse "Label | 58" — forgiving of missing/odd parts. */
function parseOpt(raw: string, fallbackLabel: string): Opt {
  const parts = raw.split("|");
  const label = (parts[0] ?? "").trim() || fallbackLabel;
  const pctNum = Number((parts[1] ?? "").trim().replace(/[^\d.-]/g, ""));
  const pct = Number.isFinite(pctNum) ? Math.max(0, Math.min(100, Math.round(pctNum))) : 50;
  return { label, pct };
}

// A live on-screen poll — two option rows whose percent bars grow (pure fn of
// t), with the leader highlighted in the accent. Only the full-frame `bg` rect
// is tied to the background field (defaults to the transparent sentinel so it
// composites straight onto footage); the card uses its own palette-only
// `cardBg` (with a soft shadow) so the poll survives once the canvas fill is
// gone.
const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { cardBg: "#FFFFFF", textColor: "#101014", accent: "#17C964", track: "#EDEFF2", otherFill: "#C7C9D1" } },
  { id: "dark", name: "Dark", colors: { cardBg: "#1B1B22", textColor: "#FFFFFF", accent: "#33E2A0", track: "#2A2A32", otherFill: "#3A3A44" } },
  { id: "sky", name: "Sky", colors: { cardBg: "#FFFFFF", textColor: "#0B2447", accent: "#2E7DF6", track: "#E1EAF6", otherFill: "#B4C6E0" } },
  { id: "grape", name: "Grape", colors: { cardBg: "#221838", textColor: "#FFFFFF", accent: "#B084F5", track: "#2E2247", otherFill: "#443364" } },
];

const ROW_START0 = 0.35;
const ROW_STAGGER = 0.14;
const ROW_DUR = 0.5;
const FILL_START = 1.2;
const FILL_DUR = 1.0;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const cardBg = pc("cardBg", "#FFFFFF");
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#17C964"));
  const track = pc("track", "#EDEFF2");
  const otherFill = pc("otherFill", "#C7C9D1");

  const question = str(values.question, "Which do you prefer?");
  const optA = parseOpt(str(values.optionA, "Yes | 58"), "Option A");
  const optB = parseOpt(str(values.optionB, "No | 42"), "Option B");
  const opts: Opt[] = [optA, optB];
  const highlightLeader = values.highlightLeader !== false;
  const leaderIdx = optA.pct >= optB.pct ? 0 : 1;

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);
  const safe = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Card sizing ---
  const cardW = Math.min(safe.width * 0.92, minDim * 0.9);
  const padX = Math.round(cardW * 0.075);
  const padY = Math.round(cardW * 0.075);
  const innerW = cardW - padX * 2;

  const hasQuestion = question.length > 0;
  const qSize = hasQuestion ? fitSize(fonts, question, "display", 700, Math.round(minDim * 0.042), innerW) : 0;
  const qH = hasQuestion ? qSize * 1.25 : 0;
  const qGap = hasQuestion ? Math.round(minDim * 0.03) : 0;

  const rowFont = Math.round(minDim * 0.036);
  const trackH = Math.round(minDim * 0.03);
  const rowLineH = rowFont * 1.2;
  const rowVGap = Math.round(rowFont * 0.4);
  const rowH = rowLineH + rowVGap + trackH;
  const rowGap = Math.round(minDim * 0.028);

  const rowsH = opts.length * rowH + (opts.length - 1) * rowGap;
  const innerH = qH + qGap + rowsH;
  const cardH = innerH + padY * 2;
  const cardRadius = Math.round(minDim * 0.024);
  const cardCY = safe.y + safe.height / 2;

  const card = new Container();
  card.position.set(cx, cardCY);
  card.alpha = 0;
  card.scale.set(0.9);
  root.addChild(card);

  const e = Math.round(cardRadius * 0.3);
  const shOff = Math.round(cardRadius * 0.5);
  card.addChild(
    new Graphics()
      .roundRect(-cardW / 2 - e, -cardH / 2 - e + shOff, cardW + e * 2, cardH + e * 2, cardRadius + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  card.addChild(new Graphics().roundRect(-cardW / 2, -cardH / 2, cardW, cardH, cardRadius).fill(cardBg));

  timeline
    .to(card, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.3, ease: outQuad })
    .to(card, { prop: "scale.x", from: 0.9, to: 1, start: 0.05, duration: 0.55, ease: spring(0.5) })
    .to(card, { prop: "scale.y", from: 0.9, to: 1, start: 0.05, duration: 0.55, ease: spring(0.5) });

  const innerTop = -innerH / 2;

  if (hasQuestion) {
    const qText = makeText(fonts, { text: question, role: "display", weight: 700, size: qSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    qText.position.set(-innerW / 2, innerTop + qH / 2);
    qText.alpha = 0;
    card.addChild(qText);
    timeline
      .to(qText, { prop: "alpha", from: 0, to: 1, start: 0.18, duration: 0.4, ease: outQuad })
      .to(qText, { prop: "x", from: -innerW / 2 - 16, to: -innerW / 2, start: 0.18, duration: 0.5, ease: outExpo });
  }

  const rowsTop = innerTop + qH + qGap;
  const pctReserve = fonts.measure("100%", { family: fonts.family("display"), weight: 700, size: rowFont });
  const labelMaxW = innerW - pctReserve - rowFont * 0.4;

  const pctTexts: { text: Text; pct: number }[] = [];
  const fills: { g: Graphics; pct: number }[] = [];

  opts.forEach((opt, i) => {
    const isLeader = highlightLeader && i === leaderIdx;
    const rowCY = rowsTop + i * (rowH + rowGap) + rowH / 2;
    const lineCY = -rowH / 2 + rowLineH / 2;
    const trackCY = rowH / 2 - trackH / 2;

    const row = new Container();
    row.position.set(0, rowCY);
    row.alpha = 0;
    card.addChild(row);

    const labelSize = fitSize(fonts, opt.label, "display", 700, rowFont, labelMaxW);
    const label = makeText(fonts, { text: opt.label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    label.position.set(-innerW / 2, lineCY);
    row.addChild(label);

    const pctText = makeText(fonts, { text: "0%", role: "display", weight: 700, size: rowFont, color: textColor, anchor: { x: 1, y: 0.5 } });
    pctText.position.set(innerW / 2, lineCY);
    row.addChild(pctText);
    pctTexts.push({ text: pctText, pct: opt.pct });

    const trackBg = new Graphics().roundRect(0, 0, innerW, trackH, trackH / 2).fill(track);
    trackBg.position.set(-innerW / 2, trackCY);
    row.addChild(trackBg);

    const fill = new Graphics().roundRect(0, 0, innerW, trackH, trackH / 2).fill(isLeader ? accent : otherFill);
    fill.position.set(-innerW / 2, trackCY);
    fill.scale.set(0, 1);
    row.addChild(fill);
    fills.push({ g: fill, pct: opt.pct });

    const start = ROW_START0 + i * ROW_STAGGER;
    timeline
      .to(row, { prop: "alpha", from: 0, to: 1, start, duration: 0.32, ease: outQuad })
      .to(row, { prop: "y", from: rowCY + 24, to: rowCY, start, duration: ROW_DUR, ease: outExpo });

    // Leader gets a gentle emphasis pop once its bar finishes filling.
    if (isLeader) {
      const settle = FILL_START + FILL_DUR;
      timeline
        .to(row, { prop: "scale.x", from: 1, to: 1.03, start: settle, duration: 0.14, ease: outQuad })
        .to(row, { prop: "scale.y", from: 1, to: 1.03, start: settle, duration: 0.14, ease: outQuad })
        .to(row, { prop: "scale.x", from: 1.03, to: 1, start: settle + 0.14, duration: 0.24, ease: outQuad })
        .to(row, { prop: "scale.y", from: 1.03, to: 1, start: settle + 0.14, duration: 0.24, ease: outQuad });
    }
  });

  const update = (t: number): void => {
    const eased = outCubic(clamp01((t - FILL_START) / FILL_DUR));
    for (const p of pctTexts) p.text.text = `${Math.round(p.pct * eased)}%`;
    for (const f of fills) f.g.scale.x = eased * (f.pct / 100);
  };

  return { timeline, duration: 4.0, update };
}

export const pollBar: TemplateDefinition = {
  id: "poll-bar",
  name: "Poll Bar",
  tagline: "A live two-option poll whose bars grow and crown a leader.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.6,
  fontRoles: { question: "display", optionA: "display", optionB: "display" },
  palettes: PALETTES,
  fields: [
    { key: "question", type: "text", label: "Question", default: "Which do you prefer?", maxLength: 40, optional: true, shrinkToFit: true },
    { key: "optionA", type: "text", label: "Option A (label | %)", default: "Yes | 58", maxLength: 28, shrinkToFit: true },
    { key: "optionB", type: "text", label: "Option B (label | %)", default: "No | 42", maxLength: 28, shrinkToFit: true },
    { key: "highlightLeader", type: "toggle", label: "Highlight leader", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

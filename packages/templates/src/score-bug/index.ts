import type { Text } from "pixi.js";
import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  makeOutBack,
  safeZone,
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
const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

/** Shrink a single-line size so `text` fits `maxWidth`. */
function fitSize(
  fonts: FontRegistry,
  text: string,
  role: FontRole,
  weight: number,
  size0: number,
  maxWidth: number,
): number {
  const w = fonts.measure(text, { family: fonts.family(role), weight, size: size0 });
  return w > maxWidth ? Math.max(10, Math.floor(size0 * (maxWidth / w))) : size0;
}

/** "8:45" / "08:45" -> total seconds; falls back to `fallback` when unparsable. */
function parseClock(raw: string, fallback: number): number {
  const m = /^(\d{1,2}):([0-5]\d)$/.exec(raw.trim());
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Total seconds -> "M:SS" (no leading zero on minutes), clamped at 0:00. */
function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? "0" : ""}${r}`;
}

// A sports score bug anchored top-left — two team chips assemble piece by
// piece into a compact bar, capped off by a small period + game-clock readout
// that counts down (derived purely from t). Only the full-frame `bg` rect is
// tied to the background field (defaults to the transparent sentinel so it
// composites straight onto footage); the bar uses its own palette-only
// `barBg` so it stays a legible HUD once the canvas fill is gone.
const PALETTES: Palette[] = [
  { id: "broadcast-navy", name: "Broadcast navy", colors: { barBg: "#101014", textColor: "#FFFFFF", accent: "#FF4D1C", teamA: "#E4572E", teamB: "#2E86DE" } },
  { id: "paper-live", name: "Paper live", colors: { barBg: "#FFFFFF", textColor: "#101014", accent: "#2E5BD6", teamA: "#D1495B", teamB: "#1B998B" } },
  { id: "midnight-court", name: "Midnight court", colors: { barBg: "#0B0B12", textColor: "#FFFFFF", accent: "#FFD23F", teamA: "#EF476F", teamB: "#06D6A0" } },
  { id: "turf-green", name: "Turf green", colors: { barBg: "#0F2A1E", textColor: "#EAF7ED", accent: "#FFD166", teamA: "#EF476F", teamB: "#118AB2" } },
];

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const barBg = pc("barBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const teamAColor = str(values.teamAColor, pc("teamA", "#E4572E"));
  const teamBColor = str(values.teamBColor, pc("teamB", "#2E86DE"));
  const teamAAbbr = str(values.teamAAbbr, "NYK").toUpperCase().slice(0, 4);
  const teamBAbbr = str(values.teamBAbbr, "BOS").toUpperCase().slice(0, 4);
  const teamAScore = Math.max(0, Math.round(num(values.teamAScore, 82)));
  const teamBScore = Math.max(0, Math.round(num(values.teamBScore, 79)));
  const period = str(values.period, "Q3");
  const showClock = values.showClock !== false;
  const clockStartSeconds = parseClock(str(values.clockStart, "8:45"), 525);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Geometry ---
  const rowH = Math.round(minDim * 0.06);
  const padX = Math.round(rowH * 0.4);
  const padY = Math.round(rowH * 0.26);
  const gapTight = Math.round(rowH * 0.2);
  const gapBlock = Math.round(rowH * 0.34);
  const swatchSize = Math.round(rowH * 0.56);
  const swatchRadius = Math.round(swatchSize * 0.28);
  const abbrSize0 = Math.round(rowH * 0.4);
  const scoreSize0 = Math.round(rowH * 0.68);
  const dividerW = Math.max(2, Math.round(rowH * 0.05));
  const dividerH = Math.round(rowH * 0.72);
  const periodSize = Math.round(rowH * 0.3);
  const clockSize = Math.round(rowH * 0.4);

  const maxAbbrW = minDim * 0.1;
  const maxScoreW = minDim * 0.11;
  const abbrSize = Math.min(
    fitSize(fonts, teamAAbbr, "display", 700, abbrSize0, maxAbbrW),
    fitSize(fonts, teamBAbbr, "display", 700, abbrSize0, maxAbbrW),
  );
  const scoreAText = String(teamAScore);
  const scoreBText = String(teamBScore);
  const scoreSize = Math.min(
    fitSize(fonts, scoreAText, "display", 700, scoreSize0, maxScoreW),
    fitSize(fonts, scoreBText, "display", 700, scoreSize0, maxScoreW),
  );

  const abbrAW = fonts.measure(teamAAbbr, { family: fonts.family("display"), weight: 700, size: abbrSize });
  const abbrBW = fonts.measure(teamBAbbr, { family: fonts.family("display"), weight: 700, size: abbrSize });
  const scoreAW = fonts.measure(scoreAText, { family: fonts.family("display"), weight: 700, size: scoreSize });
  const scoreBW = fonts.measure(scoreBText, { family: fonts.family("display"), weight: 700, size: scoreSize });

  const periodTxt = period.length > 0 ? period.toUpperCase() : "";
  const periodW = periodTxt.length > 0 ? fonts.measure(periodTxt, { family: fonts.family("body"), weight: 700, size: periodSize }) : 0;
  const clockPreview = fmtClock(clockStartSeconds);
  const clockW = fonts.measure(clockPreview, { family: fonts.family("display"), weight: 700, size: clockSize });
  const periodClockGap = Math.round(gapTight * 0.7);

  // Walk the content left-to-right in local (left-edge-relative) space so the
  // bar's total width falls out of the same arithmetic used to place pieces
  // — no separate formula to keep in sync.
  let cursor = 0;
  const swatchAX = cursor + swatchSize / 2;
  cursor += swatchSize + gapTight;
  const abbrAX = cursor;
  cursor += abbrAW + gapTight;
  const scoreAX = cursor;
  cursor += scoreAW + gapBlock;
  const div1X = cursor + dividerW / 2;
  cursor += dividerW + gapBlock;
  const swatchBX = cursor + swatchSize / 2;
  cursor += swatchSize + gapTight;
  const abbrBX = cursor;
  cursor += abbrBW + gapTight;
  const scoreBX = cursor;
  cursor += scoreBW;

  let div2X = 0;
  let periodX = 0;
  let clockX = 0;
  if (showClock) {
    cursor += gapBlock;
    div2X = cursor + dividerW / 2;
    cursor += dividerW + gapBlock;
    if (periodTxt.length > 0) {
      periodX = cursor;
      cursor += periodW + periodClockGap;
    }
    clockX = cursor;
    cursor += clockW;
  }

  const barW = padX * 2 + cursor;
  const barH = padY * 2 + rowH;
  const barRadius = Math.round(barH * 0.22);
  const leftEdge = -barW / 2 + padX;

  const marginTop = Math.round(minDim * 0.026);
  const barCx = zone.left + barW / 2;
  const barCy = zone.top + marginTop + barH / 2;

  const bar = new Container();
  bar.position.set(barCx, barCy);
  bar.alpha = 0;
  bar.scale.set(0.85);
  root.addChild(bar);

  // Soft shadow so the bug reads as a distinct HUD over any footage.
  const e = Math.round(barH * 0.05);
  const off = Math.round(barH * 0.08);
  bar.addChild(
    new Graphics()
      .roundRect(-barW / 2 - e, -barH / 2 - e + off, barW + e * 2, barH + e * 2, barRadius + e)
      .fill({ color: "#000000", alpha: 0.18 }),
  );
  bar.addChild(new Graphics().roundRect(-barW / 2, -barH / 2, barW, barH, barRadius).fill(barBg));

  const makeSwatch = (localX: number, color: string): Container => {
    const c = new Container();
    c.addChild(new Graphics().roundRect(-swatchSize / 2, -swatchSize / 2, swatchSize, swatchSize, swatchRadius).fill(color));
    c.addChild(new Graphics().roundRect(-swatchSize / 2, -swatchSize / 2, swatchSize, swatchSize, swatchRadius).stroke({ color: accent, width: Math.max(1.5, swatchSize * 0.08), alpha: 0.85 }));
    c.position.set(leftEdge + localX, 0);
    c.scale.set(0);
    bar.addChild(c);
    return c;
  };
  const makeLabel = (localX: number, text: string, fsize: number, weight: number, color: string): Text => {
    const t = makeText(fonts, { text, role: "display", weight, size: fsize, color, anchor: { x: 0, y: 0.5 } });
    t.position.set(leftEdge + localX, 0);
    t.alpha = 0;
    bar.addChild(t);
    return t;
  };
  const makeDivider = (localX: number): Graphics => {
    const g = new Graphics().roundRect(-dividerW / 2, -dividerH / 2, dividerW, dividerH, dividerW / 2).fill(accent);
    g.position.set(leftEdge + localX, 0);
    g.alpha = 0.85;
    g.scale.set(1, 0);
    bar.addChild(g);
    return g;
  };

  // --- Assemble piece by piece: swatch A, abbr A, score A, divider, swatch B,
  // abbr B, score B, [divider, period, clock]. ---
  const swatchA = makeSwatch(swatchAX, teamAColor);
  const abbrA = makeLabel(abbrAX, teamAAbbr, abbrSize, 700, textColor);
  const scoreA = makeLabel(scoreAX, scoreAText, scoreSize, 700, textColor);
  const divider1 = makeDivider(div1X);
  const swatchB = makeSwatch(swatchBX, teamBColor);
  const abbrB = makeLabel(abbrBX, teamBAbbr, abbrSize, 700, textColor);
  const scoreB = makeLabel(scoreBX, scoreBText, scoreSize, 700, textColor);

  let clockLabel: Text | undefined;
  let clockRevealAt = 0;
  if (showClock) {
    const divider2 = makeDivider(div2X);
    const periodLabel = periodTxt.length > 0 ? makeLabel(periodX, periodTxt, periodSize, 700, textColor) : undefined;
    clockLabel = makeLabel(clockX, clockPreview, clockSize, 700, textColor);

    const div2Start = 0.74;
    const clockStart = 0.82;
    clockRevealAt = clockStart;
    timeline.to(divider2, { prop: "scale.y", from: 0, to: 1, start: div2Start, duration: 0.3, ease: outExpo });
    if (periodLabel) {
      timeline.to(periodLabel, { prop: "alpha", from: 0, to: 0.75, start: clockStart, duration: 0.32, ease: outQuad });
    }
    timeline.to(clockLabel, { prop: "alpha", from: 0, to: 1, start: clockStart, duration: 0.32, ease: outQuad });
  }

  timeline
    .to(bar, { prop: "alpha", from: 0, to: 1, start: 0.0, duration: 0.22, ease: outQuad })
    .to(bar, { prop: "scale.x", from: 0.85, to: 1, start: 0.0, duration: 0.4, ease: outExpo })
    .to(bar, { prop: "scale.y", from: 0.85, to: 1, start: 0.0, duration: 0.4, ease: outExpo })
    .to(swatchA, { prop: "scale.x", from: 0, to: 1, start: 0.12, duration: 0.35, ease: makeOutBack(2) })
    .to(swatchA, { prop: "scale.y", from: 0, to: 1, start: 0.12, duration: 0.35, ease: makeOutBack(2) })
    .to(abbrA, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.3, ease: outQuad })
    .to(scoreA, { prop: "alpha", from: 0, to: 1, start: 0.28, duration: 0.3, ease: outQuad })
    .to(divider1, { prop: "scale.y", from: 0, to: 1, start: 0.38, duration: 0.3, ease: outExpo })
    .to(swatchB, { prop: "scale.x", from: 0, to: 1, start: 0.46, duration: 0.35, ease: makeOutBack(2) })
    .to(swatchB, { prop: "scale.y", from: 0, to: 1, start: 0.46, duration: 0.35, ease: makeOutBack(2) })
    .to(abbrB, { prop: "alpha", from: 0, to: 1, start: 0.54, duration: 0.3, ease: outQuad })
    .to(scoreB, { prop: "alpha", from: 0, to: 1, start: 0.62, duration: 0.3, ease: outQuad });

  const CLOCK_RATE = 6; // in-fiction seconds per real second — a livelier readout during the short hold
  const update = (t: number): void => {
    if (!clockLabel) return;
    const elapsed = Math.max(0, t - clockRevealAt) * CLOCK_RATE;
    clockLabel.text = fmtClock(clockStartSeconds - elapsed);
  };

  return { timeline, duration: 4.2, update };
}

export const scoreBug: TemplateDefinition = {
  id: "score-bug",
  name: "Score Bug",
  tagline: "A sports score bug assembles piece by piece with a ticking game clock.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 2.9,
  fontRoles: { teamAAbbr: "display", teamBAbbr: "display", period: "body", clockStart: "display" },
  palettes: PALETTES,
  fields: [
    { key: "teamAAbbr", type: "text", label: "Team A abbreviation", default: "NYK", maxLength: 4 },
    { key: "teamAScore", type: "slider", label: "Team A score", default: 82, min: 0, max: 199, step: 1 },
    { key: "teamBAbbr", type: "text", label: "Team B abbreviation", default: "BOS", maxLength: 4 },
    { key: "teamBScore", type: "slider", label: "Team B score", default: 79, min: 0, max: 199, step: 1 },
    { key: "period", type: "text", label: "Period", default: "Q3", maxLength: 10, optional: true, shrinkToFit: true },
    { key: "clockStart", type: "text", label: "Clock start (M:SS)", default: "8:45", maxLength: 5, help: "Counts down from here while the clip plays." },
    { key: "showClock", type: "toggle", label: "Clock + period", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
    { key: "teamAColor", type: "color", label: "Team A color", default: "", optional: true },
    { key: "teamBColor", type: "color", label: "Team B color", default: "", optional: true },
  ],
  build,
};

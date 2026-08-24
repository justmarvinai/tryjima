import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outCubic,
  makeOutBack,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { makeIcon } from "../shared/icons";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asItems = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

// A fixed, palette-independent icon color for the winner's check badge —
// verified dark enough to clear 4.5:1 against every accent below.
const CHECK_ICON = "#101014";

const DEFAULT_OPTIONS = ["Cats | 64", "Dogs | 36"];

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#17C964", track: "#EFEFF2", otherFill: "#C7C9D1" } },
  { id: "dark", name: "Dark", colors: { background: "#101014", textColor: "#FFFFFF", accent: "#33E2A0", track: "#242429", otherFill: "#3A3A42" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF3FF", textColor: "#0B2447", accent: "#2E7DF6", track: "#DCE9FB", otherFill: "#AFC7E8" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#150F24", textColor: "#FFFFFF", accent: "#B084F5", track: "#241934", otherFill: "#392A52" } },
];

interface OptionResult {
  label: string;
  pct: number;
}

/** Parse "Label | percent" — forgiving of missing/odd parts. */
function parseOption(raw: string, fallbackLabel: string): OptionResult {
  const parts = raw.split("|");
  const label = (parts[0] ?? "").trim() || fallbackLabel;
  const pctNum = Number((parts[1] ?? "").trim().replace(/[^\d.-]/g, ""));
  const pct = Number.isFinite(pctNum) ? Math.max(0, Math.min(100, Math.round(pctNum))) : 50;
  return { label, pct };
}

function optionsOf(values: Values): OptionResult[] {
  const raw = asItems(values.options, DEFAULT_OPTIONS).slice(0, 3);
  return raw.map((r, i) => parseOption(r, `Option ${String.fromCharCode(65 + i)}`));
}

/** Split a "2,481 votes" style string into its counting number + trailing label. */
function splitVotes(raw: string): { n: number; suffix: string } {
  const m = /^([\d,]+)\s*(.*)$/.exec(raw.trim());
  if (!m) return { n: 0, suffix: raw.trim() };
  const n = Number((m[1] ?? "0").replace(/,/g, ""));
  return { n: Number.isFinite(n) ? n : 0, suffix: (m[2] ?? "").trim() };
}

const ROW_START0 = 0.32;
const ROW_STAGGER = 0.15;
const ROW_DUR = 0.5;
const FILL_GAP = 0.25;
const FILL_DUR = 0.9;
const CHECK_DUR = 0.4;
const HOLD = 0.65;

function timingFor(n: number): { fillStart: number; fillEnd: number; duration: number } {
  const lastRowStart = ROW_START0 + (n - 1) * ROW_STAGGER;
  const fillStart = lastRowStart + ROW_DUR + FILL_GAP;
  const fillEnd = fillStart + FILL_DUR;
  return { fillStart, fillEnd, duration: fillEnd + CHECK_DUR + HOLD };
}

function computeDuration(values: Values): number {
  return timingFor(optionsOf(values).length).duration;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#17C964"));
  const track = pc("track", "#EFEFF2");
  const otherFill = pc("otherFill", "#C7C9D1");

  const question = str(values.question, "Cats or dogs?");
  const votesRaw = str(values.votes, "2,481 votes");
  const showCheck = values.showCheck !== false;
  const opts = optionsOf(values);
  const n = opts.length;
  const winnerIdx = opts.reduce((best, o, i, arr) => (o.pct > arr[best]!.pct ? i : best), 0);

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const minDim = Math.min(size.width, size.height);
  const safe = safeRect(ctx.aspect);
  const cx = size.width / 2;

  const familyDisplay = fonts.family("display");
  const measureDisplay = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });
  const familyBody = fonts.family("body");
  const measureBody = (s: string, sz: number): number => fonts.measure(s, { family: familyBody, weight: 600, size: sz });

  const clusterW = Math.min(safe.width * 0.92, minDim * 0.84);

  // --- Header: question + vote count (both optional) ---
  const qSize0 = Math.round(minDim * 0.05);
  const qSize = question.length > 0 ? shrinkToFit(question, measureDisplay, { maxWidth: clusterW, baseSize: qSize0, minSize: Math.round(qSize0 * 0.55) }) : 0;
  const qBlockH = question.length > 0 ? qSize * 1.3 : 0;

  const votesInfo = splitVotes(votesRaw);
  const voteSize0 = Math.round(minDim * 0.03);
  const voteSize = votesRaw.length > 0 ? shrinkToFit(votesRaw, measureBody, { maxWidth: clusterW, baseSize: voteSize0, minSize: Math.round(voteSize0 * 0.6) }) : 0;
  const voteBlockH = votesRaw.length > 0 ? voteSize * 1.3 : 0;
  const headerGap = minDim * 0.018;
  const rowsGapTop = minDim * 0.055;
  const hasHeader = qBlockH > 0 || voteBlockH > 0;

  // --- Rows ---
  const rowFontBase = Math.round(minDim * (n >= 3 ? 0.038 : 0.044));
  const trackH = Math.round(minDim * (n >= 3 ? 0.03 : 0.036));
  const rowVGap = Math.round(rowFontBase * 0.42);
  const rowGap = Math.round(minDim * 0.032);
  const lineH = Math.round(rowFontBase * 1.2);
  const rowH = lineH + rowVGap + trackH;

  const headerH = qBlockH + (qBlockH > 0 && voteBlockH > 0 ? headerGap : 0) + voteBlockH;
  const rowsBlockH = n * rowH + (n - 1) * rowGap;
  const totalH = headerH + (hasHeader ? rowsGapTop : 0) + rowsBlockH;
  const top = safe.y + Math.max(0, safe.height - totalH) / 2;

  let cursor = top;
  let qCenterY = 0;
  let voteCenterY = 0;
  if (qBlockH > 0) {
    qCenterY = cursor + qBlockH / 2;
    cursor += qBlockH;
    if (voteBlockH > 0) cursor += headerGap;
  }
  if (voteBlockH > 0) {
    voteCenterY = cursor + voteBlockH / 2;
    cursor += voteBlockH;
  }
  if (hasHeader) cursor += rowsGapTop;
  const rowsTop = cursor;
  const rowCenterY = (i: number): number => rowsTop + i * (rowH + rowGap) + rowH / 2;

  if (qBlockH > 0) {
    const qText = makeText(fonts, { text: question, role: "display", weight: 700, size: qSize, color: textColor, anchor: 0.5, align: "center" });
    qText.position.set(cx, qCenterY + 30);
    qText.alpha = 0;
    root.addChild(qText);
    timeline
      .to(qText, { prop: "alpha", from: 0, to: 1, start: 0.05, duration: 0.4, ease: outQuad })
      .to(qText, { prop: "y", from: qCenterY + 30, to: qCenterY, start: 0.05, duration: 0.5, ease: outExpo });
  }

  let votesText: Text | null = null;
  if (voteBlockH > 0) {
    votesText = makeText(fonts, { text: votesRaw, role: "body", weight: 600, size: voteSize, color: textColor, anchor: 0.5, align: "center" });
    votesText.position.set(cx, voteCenterY + 20);
    votesText.alpha = 0;
    root.addChild(votesText);
    timeline
      .to(votesText, { prop: "alpha", from: 0, to: 0.68, start: 0.2, duration: 0.4, ease: outQuad })
      .to(votesText, { prop: "y", from: voteCenterY + 20, to: voteCenterY, start: 0.2, duration: 0.5, ease: outExpo });
  }

  const { fillStart, fillEnd, duration } = timingFor(n);
  const pctReserve = measureDisplay("100%", rowFontBase);
  const badgeD = rowFontBase * 0.8;
  const badgeGap = rowFontBase * 0.26;
  const rightReserve = pctReserve + badgeGap + badgeD;
  const labelMaxW = clusterW - rightReserve - rowFontBase * 0.3;

  const pctTexts: { text: Text; pct: number }[] = [];
  let winnerRow: Container | null = null;

  opts.forEach((opt, i) => {
    const isWinner = i === winnerIdx;
    const rowY = rowCenterY(i);
    const lineCY = -rowH / 2 + lineH / 2;
    const trackCY = rowH / 2 - trackH / 2;

    const c = new Container();
    c.position.set(cx, rowY + 34);
    c.alpha = 0;
    root.addChild(c);
    if (isWinner) winnerRow = c;

    const labelSize = shrinkToFit(opt.label, measureDisplay, { maxWidth: labelMaxW, baseSize: rowFontBase, minSize: Math.round(rowFontBase * 0.55) });
    const label = makeText(fonts, { text: opt.label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    label.position.set(-clusterW / 2, lineCY);
    c.addChild(label);

    const pctText = makeText(fonts, { text: "0%", role: "display", weight: 700, size: rowFontBase, color: textColor, anchor: { x: 1, y: 0.5 } });
    pctText.position.set(clusterW / 2, lineCY);
    c.addChild(pctText);
    pctTexts.push({ text: pctText, pct: opt.pct });

    if (isWinner && showCheck) {
      const badge = new Container();
      badge.addChild(new Graphics().circle(0, 0, badgeD / 2).fill(accent));
      badge.addChild(makeIcon("check", badgeD * 0.62, { color: CHECK_ICON }));
      badge.position.set(clusterW / 2 - pctReserve - badgeGap - badgeD / 2, lineCY);
      badge.scale.set(0);
      c.addChild(badge);
      timeline
        .to(badge, { prop: "scale.x", from: 0, to: 1, start: fillEnd, duration: CHECK_DUR, ease: makeOutBack(2) })
        .to(badge, { prop: "scale.y", from: 0, to: 1, start: fillEnd, duration: CHECK_DUR, ease: makeOutBack(2) });
    }

    const trackBg = new Graphics().roundRect(0, 0, clusterW, trackH, trackH / 2).fill(track);
    trackBg.position.set(-clusterW / 2, trackCY);
    c.addChild(trackBg);

    const fill = new Graphics().roundRect(0, 0, clusterW, trackH, trackH / 2).fill(isWinner ? accent : otherFill);
    fill.position.set(-clusterW / 2, trackCY);
    fill.scale.set(0, 1);
    c.addChild(fill);
    timeline.to(fill, { prop: "scale.x", from: 0, to: opt.pct / 100, start: fillStart, duration: FILL_DUR, ease: outExpo });

    const start = ROW_START0 + i * ROW_STAGGER;
    timeline
      .to(c, { prop: "alpha", from: 0, to: 1, start, duration: 0.32, ease: outQuad })
      .to(c, { prop: "y", from: rowY + 34, to: rowY, start, duration: ROW_DUR, ease: outExpo });
  });

  if (winnerRow) {
    const wr: Container = winnerRow;
    timeline
      .to(wr, { prop: "scale.x", from: 1, to: 1.035, start: fillEnd, duration: 0.16, ease: outQuad })
      .to(wr, { prop: "scale.y", from: 1, to: 1.035, start: fillEnd, duration: 0.16, ease: outQuad })
      .to(wr, { prop: "scale.x", from: 1.035, to: 1, start: fillEnd + 0.16, duration: 0.28, ease: outQuad })
      .to(wr, { prop: "scale.y", from: 1.035, to: 1, start: fillEnd + 0.16, duration: 0.28, ease: outQuad });
  }

  const capturedVotes = votesText;
  const update = (t: number): void => {
    const u = t <= fillStart ? 0 : t >= fillEnd ? 1 : (t - fillStart) / (fillEnd - fillStart);
    const eased = outCubic(u);
    for (const p of pctTexts) p.text.text = `${Math.round(p.pct * eased)}%`;
    if (capturedVotes) {
      capturedVotes.text = `${groupThousands(Math.round(votesInfo.n * eased))}${votesInfo.suffix ? " " + votesInfo.suffix : ""}`;
    }
  };

  return { timeline, duration, update };
}

export const pollResults: TemplateDefinition = {
  id: "poll-results",
  name: "Poll Results",
  tagline: "Result bars fill to their percentages and the winner gets a check.",
  category: "social",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "1:1",
  loopable: false,
  posterTime: 2.6,
  estimateDuration: computeDuration,
  fontRoles: { question: "display", options: "display", votes: "body" },
  palettes: PALETTES,
  fields: [
    { key: "question", type: "text", label: "Question", default: "Cats or dogs?", maxLength: 40, optional: true, shrinkToFit: true },
    {
      key: "options",
      type: "textlist",
      label: "Options (label | percent)",
      default: DEFAULT_OPTIONS,
      minItems: 2,
      maxItems: 3,
      maxLength: 28,
      help: "One per line as \"Label | percent\", e.g. \"Cats | 64\".",
    },
    { key: "votes", type: "text", label: "Votes", default: "2,481 votes", maxLength: 20, optional: true, shrinkToFit: true },
    { key: "showCheck", type: "toggle", label: "Winner check", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

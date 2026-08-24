import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  outCubic,
  shrinkToFit,
  safeRect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type Values,
  type TemplateDefinition,
} from "@jima/engine";
import { groupThousands } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const clamp01 = (u: number): number => (u < 0 ? 0 : u > 1 ? 1 : u);

const PALETTES: Palette[] = [
  { id: "light", name: "Light", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#17C964", track: "#EFEFF2", barMuted: "#C7C9D1" } },
  { id: "sky", name: "Sky", colors: { background: "#EAF3FF", textColor: "#0B2447", accent: "#2E7DF6", track: "#DCE9FB", barMuted: "#AFC7E8" } },
  { id: "grape-night", name: "Grape night", colors: { background: "#150F24", textColor: "#FFFFFF", accent: "#B084F5", track: "#241934", barMuted: "#392A52" } },
  { id: "sunset", name: "Sunset", colors: { background: "#FFF4EC", textColor: "#401D07", accent: "#FF7A1A", track: "#F7E2D0", barMuted: "#E7C3A3" } },
];

interface Answer {
  label: string;
  pct: number;
}

const DEFAULT_ANSWERS = ["Very satisfied|48", "Satisfied|34", "Neutral|12", "Unhappy|6"];

function parseAnswer(raw: string, fallback: string): Answer {
  const idx = raw.indexOf("|");
  const label = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const valPart = (idx >= 0 ? raw.slice(idx + 1) : "").trim();
  const num = Number(valPart.replace(/[^\d.-]/g, ""));
  const pct = Number.isFinite(num) ? Math.max(0, Math.min(100, Math.round(num))) : 0;
  return { label: label.length ? label : fallback, pct };
}

function answersOf(values: Values): Answer[] {
  return asList(values.answers, DEFAULT_ANSWERS)
    .slice(0, 5)
    .map((r, i) => parseAnswer(r, `Answer ${String.fromCharCode(65 + i)}`));
}

/** Split "1,204 responses" into a counting number + trailing label. */
function splitCount(raw: string): { n: number; suffix: string } {
  const m = /^([\d,]+)\s*(.*)$/.exec(raw.trim());
  if (!m) return { n: 0, suffix: raw.trim() };
  const n = Number((m[1] ?? "0").replace(/,/g, ""));
  return { n: Number.isFinite(n) ? n : 0, suffix: (m[2] ?? "").trim() };
}

const ROW_START = 0.42;
const ROW_STAGGER = 0.16;
const ROW_DUR = 0.5;
const FILL_DELAY = 0.24;
const FILL_DUR = 0.85;
const HOLD = 0.85;

function computeDuration(values: Values): number {
  const n = answersOf(values).length;
  const lastRow = ROW_START + (n - 1) * ROW_STAGGER;
  return lastRow + FILL_DELAY + FILL_DUR + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#17C964"));
  const track = pc("track", "#EFEFF2");
  const barMuted = pc("barMuted", "#C7C9D1");

  const question = str(values.question, "How was your experience?");
  const responsesRaw = str(values.responses, "1,204 responses");
  const highlightTop = values.highlightTop !== false;
  const showResponses = values.showResponses !== false;

  const answers = answersOf(values);
  const n = answers.length;
  const topIdx = answers.reduce((best, a, i, arr) => (a.pct > (arr[best]?.pct ?? -1) ? i : best), 0);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const safe = safeRect(ctx.aspect);
  const cx = w / 2;
  const cluster = Math.min(safe.width * 0.94, minDim * 0.86);

  const familyDisplay = fonts.family("display");
  const measureDisplay = (s: string, sz: number): number => fonts.measure(s, { family: familyDisplay, weight: 700, size: sz });

  // --- Metrics ---
  const qSize0 = Math.round(minDim * 0.052);
  const qSize = shrinkToFit(question, measureDisplay, { maxWidth: cluster, baseSize: qSize0, minSize: Math.round(qSize0 * 0.55) });
  const qBlockH = qSize * 1.3;
  const respSize = showResponses ? Math.round(minDim * 0.03) : 0;
  const respBlockH = showResponses ? respSize * 1.3 : 0;
  const headerGap = minDim * 0.02;
  const rowsGapTop = minDim * 0.06;

  const rowFont = Math.round(minDim * (n >= 4 ? 0.036 : 0.042));
  const trackH = Math.round(minDim * (n >= 4 ? 0.032 : 0.038));
  const labelLineH = Math.round(rowFont * 1.15);
  const rowVGap = Math.round(rowFont * 0.4);
  const rowH = labelLineH + rowVGap + trackH;
  const rowGap = Math.round(minDim * 0.03);

  const headerH = qBlockH + (respBlockH > 0 ? headerGap + respBlockH : 0);
  const rowsBlockH = n * rowH + (n - 1) * rowGap;
  const totalH = headerH + rowsGapTop + rowsBlockH;
  const top = safe.y + Math.max(0, (safe.height - totalH) / 2);

  let cursor = top;
  const qCenterY = cursor + qBlockH / 2;
  cursor += qBlockH;
  let respCenterY = 0;
  if (respBlockH > 0) {
    cursor += headerGap;
    respCenterY = cursor + respBlockH / 2;
    cursor += respBlockH;
  }
  cursor += rowsGapTop;
  const rowsTop = cursor;

  // --- Question ---
  const qText = makeText(fonts, { text: question, role: "display", weight: 700, size: qSize, color: textColor, anchor: 0.5, align: "center" });
  qText.position.set(cx, qCenterY + 26);
  qText.alpha = 0;
  root.addChild(qText);
  timeline
    .to(qText, { prop: "alpha", from: 0, to: 1, start: 0.02, duration: 0.4, ease: outQuad })
    .to(qText, { prop: "y", from: qCenterY + 26, to: qCenterY, start: 0.02, duration: 0.5, ease: outExpo });

  // --- Responses count-up ---
  const respInfo = splitCount(responsesRaw);
  let respText: Text | null = null;
  if (respBlockH > 0) {
    respText = makeText(fonts, { text: responsesRaw, role: "body", weight: 600, size: respSize, color: textColor, anchor: 0.5, align: "center" });
    respText.position.set(cx, respCenterY + 16);
    respText.alpha = 0;
    root.addChild(respText);
    timeline
      .to(respText, { prop: "alpha", from: 0, to: 0.7, start: 0.18, duration: 0.4, ease: outQuad })
      .to(respText, { prop: "y", from: respCenterY + 16, to: respCenterY, start: 0.18, duration: 0.5, ease: outExpo });
  }

  // --- Answer rows ---
  const pctReserve = measureDisplay("100%", rowFont);
  const labelMaxW = cluster - pctReserve - rowFont * 0.4;
  const counters: { text: Text; pct: number; start: number }[] = [];

  answers.forEach((a, i) => {
    const isTop = i === topIdx && highlightTop;
    const rowCY = rowsTop + i * (rowH + rowGap) + rowH / 2;
    const labelCY = -rowH / 2 + labelLineH / 2;
    const trackCY = rowH / 2 - trackH / 2;
    const start = ROW_START + i * ROW_STAGGER;
    const fillStart = start + FILL_DELAY;

    const rowC = new Container();
    rowC.position.set(cx, rowCY + 28);
    rowC.alpha = 0;
    root.addChild(rowC);

    const labelSize = shrinkToFit(a.label, measureDisplay, { maxWidth: labelMaxW, baseSize: rowFont, minSize: Math.round(rowFont * 0.6) });
    const label = makeText(fonts, { text: a.label, role: "display", weight: 700, size: labelSize, color: textColor, anchor: { x: 0, y: 0.5 } });
    label.position.set(-cluster / 2, labelCY);
    rowC.addChild(label);

    const pctText = makeText(fonts, { text: "0%", role: "display", weight: 700, size: rowFont, color: isTop ? accent : textColor, anchor: { x: 1, y: 0.5 } });
    pctText.position.set(cluster / 2, labelCY);
    rowC.addChild(pctText);
    counters.push({ text: pctText, pct: a.pct, start: fillStart });

    const trackBg = new Graphics().roundRect(0, 0, cluster, trackH, trackH / 2).fill(track);
    trackBg.position.set(-cluster / 2, trackCY);
    rowC.addChild(trackBg);

    const fill = new Graphics().roundRect(0, 0, cluster, trackH, trackH / 2).fill(isTop ? accent : barMuted);
    fill.position.set(-cluster / 2, trackCY);
    fill.scale.set(0, 1);
    rowC.addChild(fill);
    timeline.to(fill, { prop: "scale.x", from: 0, to: a.pct / 100, start: fillStart, duration: FILL_DUR, ease: outExpo });

    timeline
      .to(rowC, { prop: "alpha", from: 0, to: 1, start, duration: 0.34, ease: outQuad })
      .to(rowC, { prop: "y", from: rowCY + 28, to: rowCY, start, duration: ROW_DUR, ease: outQuint });
  });

  const capturedResp = respText;
  const update = (t: number): void => {
    for (const c of counters) {
      const p = outCubic(clamp01((t - c.start) / FILL_DUR));
      c.text.text = `${Math.round(c.pct * p)}%`;
    }
    if (capturedResp) {
      const p = outCubic(clamp01((t - 0.18) / FILL_DUR));
      capturedResp.text = `${groupThousands(Math.round(respInfo.n * p))}${respInfo.suffix ? " " + respInfo.suffix : ""}`;
    }
  };

  return { timeline, duration: computeDuration(values), update };
}

export const surveyResults: TemplateDefinition = {
  id: "survey-results",
  name: "Survey Results",
  tagline: "A question's answer bars grow in turn as their percentages count up.",
  category: "stat",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 2.5,
  estimateDuration: computeDuration,
  fontRoles: { question: "display", answers: "display", responses: "body" },
  palettes: PALETTES,
  fields: [
    { key: "question", type: "text", label: "Question", default: "How was your experience?", maxLength: 46, shrinkToFit: true },
    {
      key: "answers",
      type: "textlist",
      label: "Answers (answer | percent)",
      default: DEFAULT_ANSWERS,
      minItems: 2,
      maxItems: 5,
      maxLength: 28,
      help: 'One per line as "answer | percent", e.g. "Satisfied | 34".',
    },
    { key: "responses", type: "text", label: "Responses line", default: "1,204 responses", maxLength: 22, optional: true, shrinkToFit: true },
    { key: "highlightTop", type: "toggle", label: "Highlight top answer", default: true },
    { key: "showResponses", type: "toggle", label: "Responses line", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

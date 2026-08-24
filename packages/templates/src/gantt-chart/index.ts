import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outExpo,
  outQuint,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { parseTargetNumber } from "../shared/format";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const num = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};
const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

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

// Task bars carry no text (labels live on the rail in textColor-on-background,
// ≥ 4.5:1 everywhere); the accent colors the today line + title underline. The
// today chip inverts background/text, so its contrast equals the base pair's.
const PALETTES: Palette[] = [
  { id: "ink", name: "Ink", colors: { background: "#FFFFFF", textColor: "#101014", accent: "#FF4D1C", barA: "#2E7DF6", barB: "#17A34A", barC: "#F59E0B", barD: "#7C5CFF" } },
  { id: "cobalt", name: "Cobalt", colors: { background: "#EEF3FF", textColor: "#0B1F4D", accent: "#FF4D1C", barA: "#2E7DF6", barB: "#7C5CFF", barC: "#0EA5E9", barD: "#17A34A" } },
  { id: "emerald", name: "Emerald", colors: { background: "#ECFDF3", textColor: "#0B3B26", accent: "#F97316", barA: "#17A34A", barB: "#2E7DF6", barC: "#0D9488", barD: "#7C5CFF" } },
  { id: "midnight", name: "Midnight", colors: { background: "#101014", textColor: "#F4F1E8", accent: "#D8F34D", barA: "#38C7FF", barB: "#FF8A5C", barC: "#33E2A0", barD: "#B18CFF" } },
];

interface Task {
  label: string;
  start: number;
  len: number;
}

const DEFAULT_TASKS = ["Research|1|2", "Design|2|2", "Build|3|3", "Launch|5|1"];

function parseTask(raw: string, fallback: string): Task {
  const parts = raw.split("|").map((s) => s.trim());
  const label = parts[0] ?? "";
  const start = clamp(Math.round(parseTargetNumber(parts[1] ?? "1")) || 1, 1, 8);
  const len = clamp(Math.round(parseTargetNumber(parts[2] ?? "1")) || 1, 1, 6);
  return { label: label.length ? label : fallback, start, len };
}

function tasksOf(values: Values): Task[] {
  return asList(values.tasks, DEFAULT_TASKS)
    .slice(0, 5)
    .map((r, i) => parseTask(r, `Task ${i + 1}`));
}

const GRID_START = 0.35;
const BARS_START = 0.95;
const BAR_EACH = 0.22;
const BAR_GROW = 0.6;
const TODAY_TAIL = 0.75; // line sweep + chip pop after the today start beat
const HOLD = 1.25;

function todayStart(n: number): number {
  return BARS_START + n * BAR_EACH + 0.3;
}

function computeDuration(values: Values): number {
  return todayStart(tasksOf(values).length) + TODAY_TAIL + HOLD;
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#FFFFFF"));
  const textColor = str(values.textColor, pc("textColor", "#101014"));
  const accent = str(values.accent, pc("accent", "#FF4D1C"));
  const barColors = [pc("barA", "#2E7DF6"), pc("barB", "#17A34A"), pc("barC", "#F59E0B"), pc("barD", "#7C5CFF")];

  const title = str(values.title, "Launch plan");
  const prefix = str(values.colPrefix, "W");
  const todayLabel = str(values.todayLabel, "Today");
  const showGrid = values.showGrid !== false;
  const showToday = values.showToday !== false;
  const showAccentBar = values.accentBar !== false;

  const tasks = tasksOf(values);
  const n = tasks.length;
  const numCols = clamp(Math.max(...tasks.map((t) => t.start + t.len - 1)), 4, 6);
  const today = clamp(num(values.today, 3.5), 1, numCols);

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);

  // --- Title (+ accent underline) ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), zone.width);
  const titleY = zone.y + titleSize * 0.75;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 } });
  titleText.position.set(zone.x, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: 0.4, ease: outQuad })
    .to(titleText, { prop: "x", from: zone.x - 18, to: zone.x, start: 0, duration: 0.5, ease: outQuint });

  let titleBottom = titleY + titleSize * 0.7;
  if (showAccentBar) {
    const ruleW = titleSize * 1.5;
    const ruleH = Math.max(3, titleSize * 0.09);
    const rule = new Graphics().roundRect(0, 0, ruleW, ruleH, ruleH / 2).fill(accent);
    rule.position.set(zone.x, titleY + titleSize * 0.72);
    rule.scale.set(0, 1);
    root.addChild(rule);
    timeline.to(rule, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });
    titleBottom = titleY + titleSize * 0.9;
  }

  // --- Grid geometry: label rail left, week/phase columns right ---
  const railW = zone.width * 0.24;
  const gridLeft = zone.x + railW;
  const gridW = zone.x + zone.width - gridLeft;
  const colW = gridW / numCols;
  const headerFont = Math.round(minDim * 0.024);
  const gridBottom = zone.y + zone.height - minDim * 0.01;
  const chipRoom = minDim * 0.075;
  const gridTop0 = titleBottom + minDim * 0.045 + headerFont * 1.9;
  const laneH = Math.min(minDim * 0.11, Math.max(minDim * 0.05, (gridBottom - gridTop0 - chipRoom) / n));
  // Center the grid block in the space left under the title (tall aspects
  // otherwise leave a large empty band at the bottom of the safe zone).
  const slack = Math.max(0, gridBottom - (gridTop0 + laneH * n + chipRoom));
  const gridTop = gridTop0 + Math.min(minDim * 0.22, slack * 0.45);
  const lanesBottom = gridTop + laneH * n;
  const hairThick = Math.max(1.5, minDim * 0.0025);

  // --- Column headers (always) + vertical hairlines / lane rules (toggle) ---
  for (let k = 0; k <= numCols; k++) {
    const gx = gridLeft + k * colW;
    if (showGrid) {
      const line = new Container();
      line.position.set(gx, gridTop);
      line.scale.set(1, 0);
      line.addChild(new Graphics().rect(-hairThick / 2, 0, hairThick, lanesBottom - gridTop).fill({ color: textColor, alpha: 0.15 }));
      root.addChild(line);
      timeline.to(line, { prop: "scale.y", from: 0, to: 1, start: GRID_START + k * 0.05, duration: 0.5, ease: outExpo });
    }
    if (k < numCols) {
      const label = `${prefix}${k + 1}`;
      const hSize = fitSize(fonts, label, "body", 600, headerFont, colW * 0.85);
      const header = makeText(fonts, { text: label, role: "body", weight: 600, size: hSize, color: textColor, anchor: 0.5, letterSpacing: 1 });
      header.position.set(gx + colW / 2, gridTop - headerFont * 0.95);
      header.alpha = 0;
      root.addChild(header);
      timeline.to(header, { prop: "alpha", from: 0, to: 0.75, start: GRID_START + 0.1 + k * 0.05, duration: 0.4, ease: outQuad });
    }
  }
  if (showGrid) {
    for (let r = 0; r <= n; r++) {
      const ly = gridTop + r * laneH;
      const lane = new Graphics().rect(gridLeft, ly - hairThick / 2, gridW, hairThick).fill({ color: textColor, alpha: 0.07 });
      lane.alpha = 0;
      root.addChild(lane);
      timeline.to(lane, { prop: "alpha", from: 0, to: 1, start: GRID_START + 0.25, duration: 0.4, ease: outQuad });
    }
  }

  // --- Task bars slide/grow into their grid slots in sequence ---
  const barH = laneH * 0.52;
  const barInset = Math.min(colW * 0.08, minDim * 0.008);
  const labelFont = Math.round(minDim * 0.028);
  const labelMaxW = railW - minDim * 0.04;

  tasks.forEach((task, i) => {
    const startCol = clamp(task.start, 1, numCols);
    const len = clamp(task.len, 1, numCols - startCol + 1);
    const cy = gridTop + i * laneH + laneH / 2;
    const x0 = gridLeft + (startCol - 1) * colW + barInset;
    const bw = len * colW - barInset * 2;
    const start = BARS_START + i * BAR_EACH;

    const bar = new Container();
    bar.position.set(x0, cy);
    bar.scale.set(0, 1);
    bar.addChild(new Graphics().roundRect(0, -barH / 2, bw, barH, barH / 2).fill(barColors[i % barColors.length] ?? accent));
    root.addChild(bar);
    timeline.to(bar, { prop: "scale.x", from: 0, to: 1, start, duration: BAR_GROW, ease: outQuint });

    const lSize = fitSize(fonts, task.label, "body", 600, labelFont, labelMaxW);
    const lbl = makeText(fonts, { text: task.label, role: "body", weight: 600, size: lSize, color: textColor, anchor: { x: 1, y: 0.5 } });
    const lblX = gridLeft - minDim * 0.022;
    lbl.position.set(lblX, cy);
    lbl.alpha = 0;
    root.addChild(lbl);
    timeline
      .to(lbl, { prop: "alpha", from: 0, to: 1, start: start - 0.05, duration: 0.35, ease: outQuad })
      .to(lbl, { prop: "x", from: lblX - 12, to: lblX, start: start - 0.05, duration: 0.45, ease: outQuint });
  });

  // --- Today marker: a vertical accent line sweeps in last, chip below ---
  if (showToday) {
    const tStart = todayStart(n);
    const tx = gridLeft + ((today - 0.5) / numCols) * gridW;
    const lineTop = gridTop - minDim * 0.012;
    const lineLen = lanesBottom - lineTop + minDim * 0.012;
    const lineThick = Math.max(3, minDim * 0.005);

    const line = new Container();
    line.position.set(tx, lineTop);
    line.scale.set(1, 0);
    line.addChild(new Graphics().roundRect(-lineThick / 2, 0, lineThick, lineLen, lineThick / 2).fill(accent));
    root.addChild(line);
    timeline.to(line, { prop: "scale.y", from: 0, to: 1, start: tStart, duration: 0.45, ease: outExpo });

    // Inverted chip (textColor plate, background-colored label).
    const chipFont = fitSize(fonts, todayLabel, "body", 600, Math.round(minDim * 0.024), minDim * 0.2);
    const chipTxt = makeText(fonts, { text: todayLabel, role: "body", weight: 600, size: chipFont, color: bg, anchor: 0.5, letterSpacing: 0.5 });
    const cw = chipTxt.width + minDim * 0.03;
    const chh = chipTxt.height + minDim * 0.014;
    const chip = new Container();
    chip.addChild(new Graphics().roundRect(-cw / 2, -chh / 2, cw, chh, chh / 2).fill(textColor));
    chip.addChild(chipTxt);
    const chipX = clamp(tx, zone.x + cw / 2, zone.x + zone.width - cw / 2);
    chip.position.set(chipX, lineTop + lineLen + chh / 2 + minDim * 0.016);
    chip.scale.set(0);
    root.addChild(chip);
    timeline
      .to(chip, { prop: "scale.x", from: 0, to: 1, start: tStart + 0.25, duration: 0.5, ease: makeOutBack(1.9) })
      .to(chip, { prop: "scale.y", from: 0, to: 1, start: tStart + 0.25, duration: 0.5, ease: makeOutBack(1.9) });
  }

  return { timeline, duration: computeDuration(values) };
}

export const ganttChart: TemplateDefinition = {
  id: "gantt-chart",
  name: "Gantt Chart",
  tagline: "Task bars grow into a week grid one by one, then a today line sweeps in.",
  category: "educational",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.4,
  estimateDuration: computeDuration,
  fontRoles: { title: "display", tasks: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Title", default: "Launch plan", maxLength: 32, optional: true, shrinkToFit: true },
    {
      key: "tasks",
      type: "textlist",
      label: "Tasks (label | start | length)",
      default: DEFAULT_TASKS,
      minItems: 3,
      maxItems: 5,
      maxLength: 24,
      help: 'One per line as "task | start week | weeks long", e.g. "Design | 2 | 2".',
    },
    { key: "colPrefix", type: "text", label: "Column prefix", default: "W", maxLength: 4 },
    { key: "today", type: "slider", label: "Today marker (week)", default: 3.5, min: 1, max: 6, step: 0.5 },
    { key: "todayLabel", type: "text", label: "Marker label", default: "Today", maxLength: 12, shrinkToFit: true },
    { key: "showToday", type: "toggle", label: "Today marker", default: true },
    { key: "showGrid", type: "toggle", label: "Grid lines", default: true },
    { key: "accentBar", type: "toggle", label: "Accent bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent (today line)", default: "", optional: true },
  ],
  build,
};

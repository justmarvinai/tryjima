import { Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  steps,
  safeRect,
  type BuiltTemplate,
  type FontRegistry,
  type FontRole,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;
const asList = (v: unknown, fallback: string[]): string[] => {
  if (Array.isArray(v)) {
    const arr = v.filter((s): s is string => typeof s === "string" && s.length > 0);
    if (arr.length) return arr;
  }
  return fallback;
};

/** Largest size <= size at which `text` fits maxWidth (crisp, single-line). */
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

interface FlightRow {
  time: string;
  dest: string;
  gate: string;
  status: string;
}

function parseFlight(raw: string): FlightRow {
  const parts = raw.split("|").map((s) => s.trim());
  const time = parts[0];
  const dest = parts[1];
  const gate = parts[2];
  const status = parts[3];
  return {
    time: time && time.length > 0 ? time : "--:--",
    dest: dest && dest.length > 0 ? dest.toUpperCase() : "—",
    gate: gate && gate.length > 0 ? gate.toUpperCase() : "--",
    status: status && status.length > 0 ? status.toUpperCase() : "ON TIME",
  };
}

const DEFAULT_FLIGHTS = ["08:45|London|A2|ON TIME", "10:20|Tokyo|B7|BOARDING", "12:15|Dubai|C3|ON TIME", "14:05|Paris|A9|DELAYED"];

function resolveFlights(values: Values): FlightRow[] {
  return asList(values.flights, DEFAULT_FLIGHTS)
    .slice(0, 4)
    .map(parseFlight);
}

const PALETTES: Palette[] = [
  { id: "midnight-board", name: "Midnight board", colors: { background: "#0B0F17", tileColor: "#161C28", textColor: "#EDEFF4", accent: "#FFB020" } },
  { id: "terminal-green", name: "Terminal green", colors: { background: "#081109", tileColor: "#10230F", textColor: "#E9F5E7", accent: "#33E27A" } },
  { id: "paper-manifest", name: "Paper manifest", colors: { background: "#F4F1E7", tileColor: "#E7E1CE", textColor: "#1B1A15", accent: "#B23A1E" } },
  { id: "sky-gate", name: "Sky gate", colors: { background: "#EAF1FB", tileColor: "#D9E6F7", textColor: "#0C1B33", accent: "#1457C7" } },
];

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:".split("");
const CYCLE_LEN = 3;
const STEP_DUR = 0.1;
const FLIP_WINDOW = CYCLE_LEN * STEP_DUR;
const HEADER_DUR = 0.4;
const ROW_STAGGER = 0.46;
const COL_STAGGER = 0.11;
const CHAR_STAGGER = 0.028;
const DURATION = 4.3;

interface FlapChar {
  node: Text;
  start: number;
  states: string[];
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#0B0F17"));
  const tileColor = pc("tileColor", "#161C28");
  const textColor = str(values.textColor, pc("textColor", "#EDEFF4"));
  const accent = str(values.accent, pc("accent", "#FFB020"));
  const title = str(values.title, "DEPARTURES").toUpperCase();
  const showHeader = values.showHeader !== false;

  const rows = resolveFlights(values);

  const w = size.width;
  const h = size.height;
  const cx = w / 2;
  const minDim = Math.min(w, h);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();
  const zone = safeRect(ctx.aspect);

  // --- Column sizing (mono grid; shrink once if the widest row overflows) ---
  const family = fonts.family("mono");
  const weight = 700;
  const measureAt = (s: string, sz: number): number => fonts.measure(s, { family, weight, size: sz });
  const colWidth = (chars: number, cw: number, gap: number): number => chars * cw + Math.max(0, chars - 1) * gap;

  const timeChars = Math.max(...rows.map((r) => r.time.length), 1);
  const destChars = Math.max(...rows.map((r) => r.dest.length), 1);
  const gateChars = Math.max(...rows.map((r) => r.gate.length), 1);
  const statusChars = Math.max(...rows.map((r) => r.status.length), 1);

  let fontSize = Math.round(zone.width * 0.036);
  let charW = measureAt("0", fontSize);
  let tileGap = fontSize * 0.1;
  let colGap = fontSize * 1.15;
  let timeColW = colWidth(timeChars, charW, tileGap);
  let destColW = colWidth(destChars, charW, tileGap);
  let gateColW = colWidth(gateChars, charW, tileGap);
  let statusColW = colWidth(statusChars, charW, tileGap);
  let totalW = timeColW + destColW + gateColW + statusColW + colGap * 3;

  const maxBoardW = zone.width * 0.96;
  if (totalW > maxBoardW && totalW > 0) {
    const scale = maxBoardW / totalW;
    fontSize = Math.max(13, Math.floor(fontSize * scale));
    charW = measureAt("0", fontSize);
    tileGap = fontSize * 0.1;
    colGap = fontSize * 1.15;
    timeColW = colWidth(timeChars, charW, tileGap);
    destColW = colWidth(destChars, charW, tileGap);
    gateColW = colWidth(gateChars, charW, tileGap);
    statusColW = colWidth(statusChars, charW, tileGap);
    totalW = timeColW + destColW + gateColW + statusColW + colGap * 3;
  }

  const boardLeft = cx - totalW / 2;
  const timeX = boardLeft;
  const destX = timeX + timeColW + colGap;
  const gateX = destX + destColW + colGap;
  const statusX = gateX + gateColW + colGap;

  // --- Header (board title + column labels + divider) ---
  let headerBottom = zone.y + minDim * 0.02;
  if (showHeader) {
    const titleSize0 = Math.round(minDim * 0.05);
    const titleMaxW = Math.max(40, zone.x + zone.width - boardLeft);
    const titleSize = fitSize(fonts, title, "display", 700, titleSize0, titleMaxW);
    const titleY = zone.y + titleSize * 0.82;
    const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: { x: 0, y: 0.5 }, letterSpacing: 2 });
    titleText.position.set(boardLeft, titleY);
    titleText.alpha = 0;
    root.addChild(titleText);
    timeline
      .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0, duration: HEADER_DUR, ease: outQuad })
      .to(titleText, { prop: "y", from: titleY - 10, to: titleY, start: 0, duration: HEADER_DUR + 0.1, ease: outExpo });

    const colLabelSize0 = Math.max(9, Math.round(fontSize * 0.52));
    const colLabelY = titleY + titleSize * 0.6 + minDim * 0.026;
    const labels: { text: string; x: number; w: number }[] = [
      { text: "TIME", x: timeX, w: timeColW },
      { text: "DESTINATION", x: destX, w: destColW },
      { text: "GATE", x: gateX, w: gateColW },
      { text: "STATUS", x: statusX, w: statusColW },
    ];
    const colLabelNodes: Text[] = labels.map((l) => {
      const lblSize = fitSize(fonts, l.text, "body", 600, colLabelSize0, Math.max(l.w, colLabelSize0));
      const lbl = makeText(fonts, { text: l.text, role: "body", weight: 600, size: lblSize, color: textColor, anchor: { x: 0, y: 0.5 }, letterSpacing: 1.5 });
      lbl.position.set(l.x, colLabelY);
      lbl.alpha = 0;
      root.addChild(lbl);
      return lbl;
    });
    timeline.stagger(colLabelNodes, { prop: "alpha", from: 0, to: 0.85, start: 0.15, duration: 0.3, ease: outQuad }, { each: 0.05, start: 0.15 });

    const dividerY = colLabelY + colLabelSize0 * 0.75;
    const divider = new Graphics().roundRect(0, 0, totalW, Math.max(2, fontSize * 0.05), 1).fill({ color: textColor, alpha: 0.18 });
    divider.position.set(boardLeft, dividerY);
    divider.scale.set(0, 1);
    root.addChild(divider);
    timeline.to(divider, { prop: "scale.x", from: 0, to: 1, start: 0.3, duration: 0.4, ease: outExpo });

    headerBottom = dividerY + minDim * 0.034;
  }

  // --- Flight rows: each a shared "flap" background bar + per-character cells ---
  const cellRowH = fontSize * 1.6;
  const rowGap = fontSize * 1.0;
  const rowsTop = headerBottom;
  const ROWS_START = showHeader ? 0.55 : 0.15;

  const allFlaps: FlapChar[] = [];
  let salt = 0;

  rows.forEach((row, i) => {
    const rowCy = rowsTop + i * (cellRowH + rowGap) + cellRowH / 2;
    const rowStart = ROWS_START + i * ROW_STAGGER;

    const barPad = fontSize * 0.42;
    const barH = cellRowH + fontSize * 0.32;
    const bar = new Graphics().roundRect(0, 0, totalW + barPad * 2, barH, barH * 0.16).fill(tileColor);
    bar.position.set(boardLeft - barPad, rowCy - barH / 2);
    bar.alpha = 0;
    root.addChild(bar);
    timeline.to(bar, { prop: "alpha", from: 0, to: 1, start: rowStart, duration: 0.3, ease: outQuad });

    const statusColor = row.status === "BOARDING" ? accent : textColor;
    const cols: { value: string; x: number; color: string }[] = [
      { value: row.time, x: timeX, color: textColor },
      { value: row.dest, x: destX, color: textColor },
      { value: row.gate, x: gateX, color: textColor },
      { value: row.status, x: statusX, color: statusColor },
    ];

    cols.forEach((col, ci) => {
      const colStart = rowStart + 0.12 + ci * COL_STAGGER;
      const chars = Array.from(col.value);
      chars.forEach((ch, k) => {
        if (ch.trim().length === 0) return;
        const chX = col.x + k * (charW + tileGap) + charW / 2;
        const node = makeText(fonts, { text: "", role: "mono", weight, size: fontSize, color: col.color, anchor: 0.5 });
        node.position.set(chX, rowCy);
        node.alpha = 0;
        root.addChild(node);

        const fi = rng.fork(salt++);
        const decoys: string[] = [];
        for (let d = 0; d < CYCLE_LEN - 1; d++) decoys.push(fi.pick(CHARSET));
        const states = [...decoys, ch.toUpperCase()];
        allFlaps.push({ node, start: colStart + k * CHAR_STAGGER, states });
      });
    });
  });

  const stepFn = steps(CYCLE_LEN);

  // Pure in t: every flap's shown glyph + squash is fully determined from
  // (start, states) — no per-frame randomness (CLAUDE.md determinism rule).
  const update = (t: number): void => {
    for (const f of allFlaps) {
      const localRaw = (t - f.start) / FLIP_WINDOW;
      if (localRaw < 0) {
        f.node.alpha = 0;
        continue;
      }
      f.node.alpha = 1;
      const local = localRaw > 1 ? 1 : localRaw;
      const k = Math.min(CYCLE_LEN - 1, Math.floor(stepFn(local) * CYCLE_LEN + 1e-6));
      const cur = local * CYCLE_LEN;
      const within = Math.min(1, Math.max(0, cur - k));
      const prevText = k === 0 ? "" : f.states[k - 1]!;
      const nextText = f.states[k]!;
      const shown = within >= 0.5 ? nextText : prevText;
      if (f.node.text !== shown) f.node.text = shown;
      f.node.scale.y = Math.abs(Math.cos(within * Math.PI));
    }
  };

  return { timeline, duration: DURATION, update };
}

export const flightBoard: TemplateDefinition = {
  id: "flight-board",
  name: "Flight Board",
  tagline: "An airport departures board where split-flap characters flip into place.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.2,
  fontRoles: { title: "display" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Board title", default: "DEPARTURES", maxLength: 16 },
    {
      key: "flights",
      type: "textlist",
      label: "Flights",
      default: DEFAULT_FLIGHTS,
      minItems: 3,
      maxItems: 4,
      maxLength: 40,
      help: 'One per line as "time|destination|gate|status", e.g. "08:45|London|A2|ON TIME".',
    },
    { key: "showHeader", type: "toggle", label: "Header & column labels", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

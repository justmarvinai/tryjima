import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  outQuad,
  outExpo,
  outQuint,
  inOutCubic,
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
  return w > maxWidth ? Math.max(10, Math.floor((size * maxWidth) / w)) : size;
}

function relLum(hex: string): number {
  const h = hex.replace("#", "");
  const n = h.length >= 6 ? h.slice(0, 6) : h.padEnd(6, h.slice(-1) || "0");
  const c = [0, 2, 4].map((i) => {
    const v = parseInt(n.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}
const contrastRatio = (a: string, b: string): number => {
  const la = relLum(a);
  const lb = relLum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};
/** Ink that stays legible on an arbitrary (user-picked) chip fill. */
const readableOn = (bg: string): string =>
  contrastRatio("#FFFFFF", bg) >= contrastRatio("#12161C", bg) ? "#FFFFFF" : "#12161C";

const COLUMNS = "ABCDEF";
const COLS = 6;
const ROWS = 6;

interface SeatRef {
  row: number;
  col: number;
  label: string;
}

/** "14A" → row 14, column A. Anything unparseable falls back to 14A. */
function parseSeat(raw: string): SeatRef {
  const label = raw.trim().toUpperCase();
  const m = /^(\d{1,3})([A-F])$/.exec(label);
  if (!m) return { row: 14, col: 0, label: label.length > 0 ? label : "14A" };
  const row = Math.min(199, Math.max(1, parseInt(m[1]!, 10)));
  const col = COLUMNS.indexOf(m[2]!);
  return { row, col: col < 0 ? 0 : col, label };
}

// `seatColor` is the resting seat fill (never the frame background) so the map
// still reads as a cabin when the background is recolored or exported alpha.
const PALETTES: Palette[] = [
  { id: "cabin-light", name: "Cabin light", colors: { background: "#F4F6F8", seatColor: "#DCE3EA", textColor: "#161E28", accent: "#1E6BE6" } },
  { id: "linen-cabin", name: "Linen cabin", colors: { background: "#F8F3EA", seatColor: "#E6DCCA", textColor: "#2A2117", accent: "#B7742F" } },
  { id: "night-cabin", name: "Night cabin", colors: { background: "#101520", seatColor: "#1E2634", textColor: "#EEF2F8", accent: "#4FC3F7" } },
  { id: "mint-cabin", name: "Mint cabin", colors: { background: "#EDF5F1", seatColor: "#D5E5DC", textColor: "#0F251C", accent: "#0E7C55" } },
];

const SEATS_START = 0.42;
const ROW_STAGGER = 0.1;
const COL_STAGGER = 0.032;
const HL_START = 1.85;
const CHIP_START = 2.35;
const DURATION = 4.2;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#F4F6F8"));
  const seatColor = str(values.seatColor, pc("seatColor", "#DCE3EA"));
  const textColor = str(values.textColor, pc("textColor", "#161E28"));
  const accent = str(values.accent, pc("accent", "#1E6BE6"));
  const chipInk = readableOn(accent);

  const title = str(values.title, "Seat selected");
  const note = str(values.note, "Window · Extra legroom");
  const seat = parseSeat(str(values.seat, "14A"));
  const showOutline = values.showOutline !== false;
  const showLetters = values.showLetters !== false;
  const showChip = values.showChip !== false;

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const cx = w / 2;
  const zone = safeRect(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- Header ---
  const titleSize = fitSize(fonts, title, "display", 700, Math.round(minDim * 0.05), zone.width * 0.86);
  const titleY = zone.y + titleSize * 0.72;
  const titleText = makeText(fonts, { text: title, role: "display", weight: 700, size: titleSize, color: textColor, anchor: 0.5, align: "center" });
  titleText.position.set(cx, titleY);
  titleText.alpha = 0;
  root.addChild(titleText);
  timeline
    .to(titleText, { prop: "alpha", from: 0, to: 1, start: 0.08, duration: 0.45, ease: outQuad })
    .to(titleText, { prop: "y", from: titleY - 14, to: titleY, start: 0.08, duration: 0.6, ease: outQuint });

  // --- Layout: header band | seat grid band | callout + note footer ---
  const noteSize = Math.round(minDim * 0.026);
  const chipH = Math.round(minDim * 0.058);
  const leaderH = minDim * 0.038;
  const footerH = leaderH + chipH + minDim * 0.038 + noteSize * 1.5;
  const bandTop = zone.y + titleSize * 1.5 + minDim * 0.028;
  const bandH = zone.y + zone.height - footerH - bandTop;

  // One seat cell drives every other measurement. 9.79 / 8.6 are the width and
  // height of the whole map (grid + row numbers + letters + fuselage padding)
  // expressed in cells, so the map always fits the band in every aspect.
  const s = Math.min((zone.width * 0.94) / 9.79, bandH / 8.6, minDim * 0.105);
  const letterBand = s * 0.62;
  const gridH = s * 7.1;
  const blockH = letterBand + gridH;
  const gridW = s * 8.69;
  const gridTop = bandTop + (bandH - blockH) / 2 + letterBand;
  const gridLeft = cx - gridW / 2;
  const seatsLeft = gridLeft + s * 1.2;
  const gridBottom = gridTop + gridH;

  const colX = (c: number): number =>
    seatsLeft + (c < 3 ? 0 : s * 4.17) + (c % 3) * s * 1.16 + s * 0.5;
  const rowY = (r: number): number => gridTop + r * s * 1.22 + s * 0.5;

  const firstRow = Math.max(1, seat.row - (ROWS - 1));
  const hlRow = seat.row - firstRow;

  // --- Fuselage outline (hairline, decorative) ---
  if (showOutline) {
    const outline = new Graphics()
      .roundRect(gridLeft - s * 0.55, gridTop - letterBand - s * 0.35, gridW + s * 1.1, blockH + s * 0.7, s * 0.9)
      .stroke({ color: textColor, width: Math.max(1.2, s * 0.022), alpha: 0.22 });
    outline.alpha = 0;
    root.addChild(outline);
    timeline.to(outline, { prop: "alpha", from: 0, to: 1, start: 0.2, duration: 0.7, ease: outQuad });
  }

  // --- Column letters ---
  if (showLetters) {
    const letterSize = Math.max(9, Math.round(s * 0.3));
    for (let c = 0; c < COLS; c++) {
      const letter = makeText(fonts, {
        text: COLUMNS[c]!,
        role: "body",
        weight: 600,
        size: letterSize,
        color: textColor,
        anchor: 0.5,
        letterSpacing: 1,
      });
      letter.position.set(colX(c), gridTop - letterBand * 0.55);
      letter.alpha = 0;
      root.addChild(letter);
      timeline.to(letter, { prop: "alpha", from: 0, to: 0.55, start: 0.28 + c * 0.03, duration: 0.5, ease: outQuad });
    }
  }

  // --- The chosen seat's soft halo sits under the whole grid ---
  const hlX = colX(seat.col);
  const hlY = rowY(hlRow);
  const halo = new Graphics().circle(0, 0, s * 0.82).fill({ color: accent, alpha: 0.16 });
  halo.position.set(hlX, hlY);
  halo.alpha = 0;
  halo.scale.set(0.55);
  root.addChild(halo);
  timeline
    .to(halo, { prop: "alpha", from: 0, to: 1, start: HL_START, duration: 0.7, ease: outQuad })
    .to(halo, { prop: "scale.x", from: 0.55, to: 1, start: HL_START, duration: 0.95, ease: outExpo })
    .to(halo, { prop: "scale.y", from: 0.55, to: 1, start: HL_START, duration: 0.95, ease: outExpo });

  // --- Row numbers + seats: a soft diagonal wave down the cabin ---
  const rowNumSize = Math.max(9, Math.round(s * 0.3));
  const seatR = s * 0.2;
  let hlSeat: Container | null = null;

  for (let r = 0; r < ROWS; r++) {
    const y = rowY(r);
    const rowStart = SEATS_START + r * ROW_STAGGER;

    const rowNum = makeText(fonts, {
      text: String(firstRow + r),
      role: "body",
      weight: 500,
      size: rowNumSize,
      color: textColor,
      anchor: { x: 1, y: 0.5 },
    });
    rowNum.position.set(gridLeft + s * 0.9, y);
    rowNum.alpha = 0;
    root.addChild(rowNum);
    timeline
      .to(rowNum, { prop: "alpha", from: 0, to: 0.5, start: rowStart, duration: 0.45, ease: outQuad })
      .to(rowNum, { prop: "y", from: y + s * 0.24, to: y, start: rowStart, duration: 0.6, ease: outQuint });

    for (let c = 0; c < COLS; c++) {
      const x = colX(c);
      const start = rowStart + c * COL_STAGGER;
      const isHl = r === hlRow && c === seat.col;

      const cell = new Container();
      cell.position.set(x, y);
      cell.alpha = 0;
      cell.scale.set(0.9);
      root.addChild(cell);
      cell.addChild(new Graphics().roundRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84, seatR).fill(seatColor));

      timeline
        .to(cell, { prop: "alpha", from: 0, to: 1, start, duration: 0.45, ease: outQuad })
        .to(cell, { prop: "y", from: y + s * 0.28, to: y, start, duration: 0.62, ease: outQuint })
        .to(cell, { prop: "scale.x", from: 0.9, to: 1, start, duration: 0.62, ease: outQuint })
        .to(cell, { prop: "scale.y", from: 0.9, to: 1, start, duration: 0.62, ease: outQuint });

      if (isHl) hlSeat = cell;
    }
  }

  // --- The chosen seat blooms: accent fill, then a gentle settle ---
  if (hlSeat) {
    const fill = new Graphics().roundRect(-s * 0.42, -s * 0.42, s * 0.84, s * 0.84, seatR).fill(accent);
    fill.alpha = 0;
    hlSeat.addChild(fill);
    const letterSize = Math.max(10, Math.round(s * 0.34));
    const seatLetter = makeText(fonts, {
      text: COLUMNS[seat.col] ?? "A",
      role: "body",
      weight: 700,
      size: letterSize,
      color: chipInk,
      anchor: 0.5,
    });
    seatLetter.alpha = 0;
    hlSeat.addChild(seatLetter);

    timeline
      .to(fill, { prop: "alpha", from: 0, to: 1, start: HL_START, duration: 0.6, ease: outQuad })
      .to(seatLetter, { prop: "alpha", from: 0, to: 1, start: HL_START + 0.18, duration: 0.5, ease: outQuad })
      // A long lift, then a small settle back — no bounce.
      .to(hlSeat, { prop: "scale.x", from: 1, to: 1.2, start: HL_START, duration: 0.55, ease: outQuint })
      .to(hlSeat, { prop: "scale.y", from: 1, to: 1.2, start: HL_START, duration: 0.55, ease: outQuint })
      .to(hlSeat, { prop: "scale.x", from: 1.2, to: 1.13, start: HL_START + 0.55, duration: 0.5, ease: inOutCubic })
      .to(hlSeat, { prop: "scale.y", from: 1.2, to: 1.13, start: HL_START + 0.55, duration: 0.5, ease: inOutCubic });
  }

  // --- Callout chip under the map, leader line up to the seat ---
  const chipCy = gridBottom + leaderH + chipH / 2;
  if (showChip) {
    const chipTextSize = fitSize(fonts, seat.label, "body", 700, Math.round(chipH * 0.44), minDim * 0.24);
    const chipTextW = fonts.measure(seat.label, { family: fonts.family("body"), weight: 700, size: chipTextSize });
    const chipW = chipTextW + chipH * 1.1;
    const chipCx = Math.min(Math.max(hlX, zone.x + chipW / 2), zone.x + zone.width - chipW / 2);
    const notchW = chipH * 0.2;
    const notchDx = Math.min(Math.max(hlX - chipCx, -(chipW / 2 - notchW * 2)), chipW / 2 - notchW * 2);

    const seatBottom = hlY + s * 0.42;
    const chipTop = chipCy - chipH / 2;
    const leader = new Container();
    leader.position.set(hlX, seatBottom);
    root.addChild(leader);
    leader.addChild(
      new Graphics()
        .moveTo(0, 0)
        .lineTo(0, chipTop - seatBottom)
        .stroke({ color: accent, width: Math.max(1.2, s * 0.03), alpha: 0.5, cap: "round" }),
    );
    leader.scale.set(1, 0);
    timeline.to(leader, { prop: "scale.y", from: 0, to: 1, start: CHIP_START - 0.16, duration: 0.5, ease: outQuint });

    const chip = new Container();
    chip.position.set(chipCx, chipCy);
    chip.alpha = 0;
    root.addChild(chip);
    // Soft drop shadow so the chip floats over any background.
    chip.addChild(
      new Graphics()
        .roundRect(-chipW / 2, -chipH / 2 + chipH * 0.12, chipW, chipH, chipH / 2)
        .fill({ color: "#000000", alpha: 0.1 }),
    );
    const body = new Graphics().roundRect(-chipW / 2, -chipH / 2, chipW, chipH, chipH / 2).fill(accent);
    body.moveTo(notchDx - notchW, -chipH / 2 + 1)
      .lineTo(notchDx, -chipH / 2 - notchW * 1.1)
      .lineTo(notchDx + notchW, -chipH / 2 + 1)
      .fill(accent);
    chip.addChild(body);
    chip.addChild(
      makeText(fonts, { text: seat.label, role: "body", weight: 700, size: chipTextSize, color: chipInk, anchor: 0.5, letterSpacing: 1 }),
    );
    timeline
      .to(chip, { prop: "alpha", from: 0, to: 1, start: CHIP_START, duration: 0.45, ease: outQuad })
      .to(chip, { prop: "y", from: chipCy - chipH * 0.3, to: chipCy, start: CHIP_START, duration: 0.6, ease: outQuint });
  }

  // --- Footnote ---
  const noteFit = fitSize(fonts, note, "body", 500, noteSize, zone.width * 0.82);
  const noteY = chipCy + chipH / 2 + minDim * 0.038 + noteFit * 0.6;
  const noteText = makeText(fonts, { text: note, role: "body", weight: 500, size: noteFit, color: textColor, anchor: 0.5, align: "center", letterSpacing: 1 });
  noteText.position.set(cx, noteY);
  noteText.alpha = 0;
  root.addChild(noteText);
  timeline
    .to(noteText, { prop: "alpha", from: 0, to: 0.72, start: 2.7, duration: 0.5, ease: outQuad })
    .to(noteText, { prop: "y", from: noteY + 10, to: noteY, start: 2.7, duration: 0.55, ease: outQuint });

  return { timeline, duration: DURATION };
}

export const seatMap: TemplateDefinition = {
  id: "seat-map",
  name: "Seat Map",
  tagline: "A cabin seat map fills in row by row, then your seat lights up with a callout.",
  category: "travel",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "4:5",
  loopable: false,
  posterTime: 3.6,
  fontRoles: { title: "display", note: "body", seat: "body" },
  palettes: PALETTES,
  fields: [
    { key: "title", type: "text", label: "Headline", default: "Seat selected", maxLength: 26, shrinkToFit: true },
    { key: "seat", type: "text", label: "Seat", default: "14A", maxLength: 4, help: 'Row + column, e.g. "14A". Columns run A–F.' },
    { key: "note", type: "text", label: "Footnote", default: "Window · Extra legroom", maxLength: 34, shrinkToFit: true },
    { key: "showOutline", type: "toggle", label: "Cabin outline", default: true },
    { key: "showLetters", type: "toggle", label: "Column letters", default: true },
    { key: "showChip", type: "toggle", label: "Seat callout", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "seatColor", type: "color", label: "Seats", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Accent", default: "", optional: true },
  ],
  build,
};

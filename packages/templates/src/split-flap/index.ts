import { Container, Graphics, type Text } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  steps,
  type Aspect,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

// Tile color is always a subtle "card" shade near its own background's
// lightness, so textColor clears 4.5:1 whether showTiles is on or off.
const PALETTES: Palette[] = [
  { id: "departure-navy", name: "Departure navy", colors: { background: "#10151F", tileColor: "#1B2230", textColor: "#F4F6FA" } },
  { id: "paper-board", name: "Paper board", colors: { background: "#F7F3E8", tileColor: "#ECE4D2", textColor: "#17130E" } },
  { id: "amber-board", name: "Amber board", colors: { background: "#1C1206", tileColor: "#2A1D0D", textColor: "#FFD23F" } },
  { id: "sky-board", name: "Sky board", colors: { background: "#EAF2FB", tileColor: "#DCE9FA", textColor: "#0B1E3D" } },
];

const CHARSET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789".split("");
// Per character: a "blank" opener + (CYCLE_LEN - 1) decoys, landing on the
// real glyph as the CYCLE_LEN-th state (steps() drives the discrete index).
const CYCLE_LEN = 4;
const STEP_DUR = 0.115;
const FLIP_WINDOW = CYCLE_LEN * STEP_DUR;
const BASE = 0.28;
const STAGGER = 0.085;
const TAIL = 2.7;

function fontFrac(aspect: Aspect): number {
  switch (aspect) {
    case "16:9":
      return 0.076;
    case "9:16":
      return 0.05;
    case "4:5":
      return 0.06;
    case "1:1":
    default:
      return 0.064;
  }
}

interface Cell {
  container: Container;
  text: Text;
  charStart: number;
  states: string[];
}

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts, rng } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", "#10151F"));
  const tileColor = str(values.tileColor, pc("tileColor", "#1B2230"));
  const textColor = str(values.textColor, pc("textColor", "#F4F6FA"));
  const text = str(values.text, "ARRIVALS");
  const showTiles = values.showTiles !== false;

  const bgRect = new Graphics().rect(0, 0, size.width, size.height).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const chars = Array.from(text);
  const n = chars.length;

  // Fixed-width "cell" grid (a real split-flap board has identical mechanical
  // units, not proportional glyph widths) — sized from a wide reference glyph,
  // then rescaled once if the whole row would overflow the frame.
  const family = fonts.family("display");
  const weight = 700;
  const measureAt = (sz: number): number => fonts.measure("M", { family, weight, size: sz });

  let fontSize = Math.round(size.width * fontFrac(ctx.aspect));
  let unitW = measureAt(fontSize);
  let tileW = unitW + fontSize * 0.62;
  let tileGap = fontSize * 0.16;
  let totalW = n * tileW + Math.max(0, n - 1) * tileGap;
  const maxW = size.width * 0.9;
  if (totalW > maxW && totalW > 0) {
    const scale = maxW / totalW;
    fontSize = Math.max(14, Math.floor(fontSize * scale));
    unitW = measureAt(fontSize);
    tileW = unitW + fontSize * 0.62;
    tileGap = fontSize * 0.16;
    totalW = n * tileW + Math.max(0, n - 1) * tileGap;
  }

  const tileH = fontSize * 1.34;
  const radius = fontSize * 0.14;
  const cx = size.width / 2;
  const cy = size.height * 0.5;
  const startX = cx - totalW / 2;

  const content = new Container();
  content.label = "content";
  root.addChild(content);

  const cells: Cell[] = [];
  for (let i = 0; i < n; i++) {
    const ch = chars[i]!;
    const cellX = startX + i * (tileW + tileGap) + tileW / 2;
    if (ch.trim().length === 0) continue; // spaces keep their grid slot, no tile

    const container = new Container();
    container.position.set(cellX, cy);
    container.alpha = 0;
    content.addChild(container);

    if (showTiles) {
      const tile = new Graphics().roundRect(-tileW / 2, -tileH / 2, tileW, tileH, radius).fill(tileColor);
      container.addChild(tile);
      const seamInset = radius * 0.4;
      const seam = new Graphics().rect(-tileW / 2 + seamInset, -1, tileW - seamInset * 2, 2).fill({ color: "#000000", alpha: 0.18 });
      container.addChild(seam);
    }

    const textNode = makeText(fonts, { text: "", role: "display", weight, size: Math.round(fontSize * 0.68), color: textColor, anchor: 0.5 });
    container.addChild(textNode);

    // Deterministic per-character decoy sequence (forked stream, CLAUDE.md rule 6).
    const fi = rng.fork(i);
    const decoys: string[] = [];
    for (let k = 0; k < CYCLE_LEN - 1; k++) decoys.push(fi.pick(CHARSET));
    const states = [...decoys, ch];

    cells.push({ container, text: textNode, charStart: BASE + i * STAGGER, states });
  }

  const lastIndex = n > 0 ? n - 1 : 0;
  const duration = Math.max(3.4, BASE + lastIndex * STAGGER + FLIP_WINDOW + TAIL);

  const stepFn = steps(CYCLE_LEN);

  // Pure in t: for a given t every tile's shown glyph and squash are fully
  // determined from (charStart, states) — no per-frame randomness.
  const update = (t: number): void => {
    for (const cell of cells) {
      const localRaw = (t - cell.charStart) / FLIP_WINDOW;
      if (localRaw < 0) {
        cell.container.alpha = 0;
        continue;
      }
      cell.container.alpha = 1;
      const local = localRaw > 1 ? 1 : localRaw;
      // steps() gives the discrete "which glyph is next" index; a continuous
      // cosine squash within that step sells the mechanical flip, swapping the
      // glyph exactly at the point of maximum squash (within === 0.5).
      const k = Math.min(CYCLE_LEN - 1, Math.floor(stepFn(local) * CYCLE_LEN + 1e-6));
      const cur = local * CYCLE_LEN;
      const within = Math.min(1, Math.max(0, cur - k));
      const prevText = k === 0 ? "" : cell.states[k - 1]!;
      const nextText = cell.states[k]!;
      const shown = within >= 0.5 ? nextText : prevText;
      if (cell.text.text !== shown) cell.text.text = shown;
      cell.container.scale.y = Math.abs(Math.cos(within * Math.PI));
    }
  };

  return { timeline: new JimaTimeline(), duration, update };
}

export const splitFlap: TemplateDefinition = {
  id: "split-flap",
  name: "Split Flap",
  tagline: "A departure-board reveal — tiles flip through glyphs to land on your text.",
  category: "statement",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "16:9",
  loopable: false,
  posterTime: 3.0,
  fontRoles: { text: "display" },
  palettes: PALETTES,
  fields: [
    { key: "text", type: "text", label: "Text", default: "ARRIVALS", maxLength: 18, shrinkToFit: true },
    { key: "showTiles", type: "toggle", label: "Flap tiles", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "tileColor", type: "color", label: "Tile", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
  ],
  build,
};

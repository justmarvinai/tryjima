import { Container, Graphics } from "pixi.js";
import {
  JimaTimeline,
  makeText,
  makeOutBack,
  outQuad,
  outQuint,
  inQuad,
  linear,
  safeZone,
  TRANSPARENT_BG,
  type BuiltTemplate,
  type Palette,
  type TemplateContext,
  type TemplateDefinition,
} from "@jima/engine";
import { layoutWords, type WordBox } from "../shared/words";

const str = (v: unknown, fallback: string): string =>
  typeof v === "string" && v.length > 0 ? v : fallback;

/** Like `str`, but an explicit empty string is kept (drops the second line). */
const strOpt = (v: unknown, fallback: string): string => (typeof v === "string" ? v : fallback);

// Reels-style karaoke caption: the whole line is visible but dimmed, and an
// accent pill snaps from word to word, lighting each one up on the beat; a
// second caption line swaps in halfway. The traveling per-word highlight is the
// mechanic (subtitle-bar just fades words in; caption-pop pops whole captions).
// Only the full-frame `bg` rect is tied to the background field (defaults to
// the transparent sentinel so it drops straight onto footage); the caption bar
// uses its own palette-only `barBg` (with a soft shadow) so the caption
// survives as overlay content. `accentText` is a fixed, contrast-checked color
// for the active word sitting on the accent pill.
const PALETTES: Palette[] = [
  { id: "noir-pop", name: "Noir pop", colors: { barBg: "#101014", textColor: "#FFFFFF", accent: "#FFD60A", accentText: "#14120B" } },
  { id: "pure-pop", name: "Pure pop", colors: { barBg: "#FFFFFF", textColor: "#0B0B0F", accent: "#7C3AED", accentText: "#FFFFFF" } },
  { id: "ember", name: "Ember", colors: { barBg: "#200A10", textColor: "#FFFFFF", accent: "#FF4D1C", accentText: "#14060A" } },
  { id: "mint", name: "Mint", colors: { barBg: "#0B1F16", textColor: "#E9FBF1", accent: "#4ADE80", accentText: "#0B1F16" } },
];

// Highlight rhythm (seconds). Duration derives from these + the word counts.
const L1_IN = 0.3;
const HL1 = 0.75;
const BEAT = 0.32;
const TAIL = 0.85;
const DIM = 0.62;

function build(ctx: TemplateContext): BuiltTemplate {
  const { root, size, values, palette, fonts } = ctx;
  const pc = (k: string, d: string): string => palette.colors[k] ?? d;
  const bg = str(values.background, pc("background", TRANSPARENT_BG));
  const barBg = pc("barBg", "#101014");
  const textColor = str(values.textColor, pc("textColor", "#FFFFFF"));
  const accent = str(values.accent, pc("accent", "#FFD60A"));
  const accentText = pc("accentText", "#14120B");

  const line1 = str(values.line1, "Captions that pop");
  const line2 = strOpt(values.line2, "right on the beat");
  const showBar = values.showBar !== false;
  const lines = line2.length > 0 ? [line1, line2] : [line1];

  const w = size.width;
  const h = size.height;
  const minDim = Math.min(w, h);
  const zone = safeZone(ctx.aspect);

  const bgRect = new Graphics().rect(0, 0, w, h).fill(bg);
  bgRect.label = "bg";
  root.addChild(bgRect);

  const timeline = new JimaTimeline();

  // --- One shared font size that fits every line into <= 2 rows (German-safe). ---
  const maxCaptionW = w - zone.left - zone.right - minDim * 0.06;
  const minFontSize = Math.round(minDim * 0.026);
  const rowsAt = (text: string, fs: number): number => {
    const boxes = layoutWords(text, fonts, {
      role: "body",
      weight: 700,
      fontSize: fs,
      lineHeight: Math.round(fs * 1.32),
      maxWidth: maxCaptionW,
      align: "center",
      anchorX: w / 2,
      centerY: 0,
    });
    return boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
  };
  let fontSize = Math.round(minDim * 0.048);
  for (let g = 0; g < 10 && fontSize > minFontSize; g++) {
    if (lines.every((l) => rowsAt(l, fontSize) <= 2)) break;
    fontSize = Math.max(minFontSize, Math.round(fontSize * 0.92));
  }
  const lineHeight = Math.round(fontSize * 1.32);
  const padX = Math.round(fontSize * 0.75);
  const padY = Math.round(fontSize * 0.5);

  const layoutLine = (text: string, cy: number): WordBox[] =>
    layoutWords(text, fonts, {
      role: "body",
      weight: 700,
      fontSize,
      lineHeight,
      maxWidth: maxCaptionW,
      align: "center",
      anchorX: w / 2,
      centerY: cy,
    });

  // Bar sizes per line (the tallest fixes the shared vertical center).
  const metrics = lines.map((text) => {
    const boxes = layoutLine(text, 0);
    const rows = boxes.length ? Math.max(...boxes.map((b) => b.line)) + 1 : 1;
    const blockW = boxes.length
      ? Math.max(...boxes.map((b) => b.cx + b.width / 2)) - Math.min(...boxes.map((b) => b.cx - b.width / 2))
      : 0;
    return {
      barW: Math.min(w - zone.left - zone.right, blockW + padX * 2),
      barH: Math.round(rows * lineHeight * 0.92) + padY * 2,
    };
  });
  const maxBarH = Math.max(...metrics.map((m) => m.barH));
  const capBottom = h - zone.bottom - Math.round(minDim * 0.03);
  const centerY = capBottom - maxBarH / 2;

  // --- Timing per line. ---
  const n1 = line1.split(/\s+/).filter(Boolean).length;
  const end1 = HL1 + n1 * BEAT;
  const HL2 = end1 + 0.6;
  const n2 = lines.length > 1 ? lines[1]!.split(/\s+/).filter(Boolean).length : 0;
  const endLast = lines.length > 1 ? HL2 + n2 * BEAT : end1;
  // 4.44s with the default lines; floored so a cleared line 2 still holds.
  const duration = Math.max(3.2, endLast + TAIL);

  lines.forEach((text, li) => {
    const m = metrics[li]!;
    const boxes = layoutLine(text, centerY);
    const inStart = li === 0 ? L1_IN : end1 + 0.28;
    const hlStart = li === 0 ? HL1 : HL2;
    const isLastLine = li === lines.length - 1;

    const groupY = fontSize * 0.5;
    const G = new Container();
    G.alpha = 0;
    G.position.set(0, groupY);
    root.addChild(G);

    if (showBar) {
      const barC = new Container();
      barC.position.set(w / 2, centerY);
      G.addChild(barC);
      const r = Math.min(m.barH / 2, fontSize * 0.8);
      const e = Math.round(fontSize * 0.05);
      const off = Math.round(fontSize * 0.09);
      barC.addChild(
        new Graphics()
          .roundRect(-m.barW / 2 - e, -m.barH / 2 - e + off, m.barW + e * 2, m.barH + e * 2, r + e)
          .fill({ color: "#000000", alpha: 0.18 }),
      );
      barC.addChild(new Graphics().roundRect(-m.barW / 2, -m.barH / 2, m.barW, m.barH, r).fill(barBg));
    }

    // Pills under all words, then the dim base words, then the lit copies.
    const pills: Container[] = [];
    boxes.forEach((box) => {
      const pw = box.width + fontSize * 0.34;
      const ph = fontSize * 1.3;
      const pill = new Container();
      pill.position.set(box.cx, box.cy);
      pill.alpha = 0;
      pill.scale.set(0.72);
      pill.addChild(new Graphics().roundRect(-pw / 2, -ph / 2, pw, ph, ph / 2).fill(accent));
      G.addChild(pill);
      pills.push(pill);
    });
    boxes.forEach((box, i) => {
      const base = makeText(fonts, { text: box.text, role: "body", weight: 700, size: fontSize, color: textColor, anchor: 0.5 });
      base.position.set(box.cx, box.cy);
      base.alpha = DIM;
      G.addChild(base);
      const active = makeText(fonts, { text: box.text, role: "body", weight: 700, size: fontSize, color: accentText, anchor: 0.5 });
      active.position.set(box.cx, box.cy);
      active.alpha = 0;
      G.addChild(active);

      const ws = hlStart + i * BEAT;
      const we = ws + BEAT;
      const isLastWord = i === boxes.length - 1;
      const pill = pills[i]!;
      timeline
        .to(pill, { prop: "alpha", from: 0, to: 1, start: ws, duration: 0.05, ease: linear })
        .to(pill, { prop: "scale.x", from: 0.72, to: 1, start: ws, duration: 0.2, ease: makeOutBack(2.4) })
        .to(pill, { prop: "scale.y", from: 0.72, to: 1, start: ws, duration: 0.2, ease: makeOutBack(2.4) })
        .to(base, { prop: "alpha", from: DIM, to: 0, start: ws, duration: 0.05, ease: linear })
        .to(active, { prop: "alpha", from: 0, to: 1, start: ws, duration: 0.05, ease: linear })
        .to(active, { prop: "scale.x", from: 0.92, to: 1, start: ws, duration: 0.18, ease: makeOutBack(2.0) })
        .to(active, { prop: "scale.y", from: 0.92, to: 1, start: ws, duration: 0.18, ease: makeOutBack(2.0) });
      if (!isLastWord) {
        // The pill snaps onward: this word's highlight cuts out exactly as the
        // next word's pill lands, and the passed word stays bright.
        timeline
          .to(pill, { prop: "alpha", from: 1, to: 0, start: we, duration: 0.05, ease: linear })
          .to(base, { prop: "alpha", from: 0, to: 1, start: we, duration: 0.08, ease: outQuad })
          .to(active, { prop: "alpha", from: 1, to: 0, start: we, duration: 0.05, ease: linear });
      }
    });

    // Line entrance (rise + fade) and, for line 1, the mid-way swap out.
    timeline
      .to(G, { prop: "alpha", from: 0, to: 1, start: inStart, duration: 0.35, ease: outQuad })
      .to(G, { prop: "y", from: groupY, to: 0, start: inStart, duration: 0.45, ease: outQuint });
    if (!isLastLine) {
      const outStart = end1 + 0.06;
      timeline
        .to(G, { prop: "alpha", from: 1, to: 0, start: outStart, duration: 0.28, ease: inQuad })
        .to(G, { prop: "y", from: 0, to: -fontSize * 0.45, start: outStart, duration: 0.3, ease: inQuad });
    }
  });

  return { timeline, duration };
}

export const karaokeCaption: TemplateDefinition = {
  id: "karaoke-caption",
  name: "Karaoke Caption",
  tagline: "A caption lights up word by word as an accent pill snaps across the line.",
  category: "overlay",
  aspects: ["1:1", "4:5", "9:16", "16:9"],
  defaultAspect: "9:16",
  loopable: false,
  posterTime: 4.0,
  fontRoles: { line1: "body", line2: "body" },
  palettes: PALETTES,
  fields: [
    { key: "line1", type: "text", label: "Caption line 1", default: "Captions that pop", maxLength: 48, shrinkToFit: true },
    { key: "line2", type: "text", label: "Caption line 2", default: "right on the beat", maxLength: 48, optional: true, shrinkToFit: true },
    { key: "showBar", type: "toggle", label: "Backing bar", default: true },
    { key: "background", type: "color", label: "Background", default: "", optional: true },
    { key: "textColor", type: "color", label: "Text", default: "", optional: true },
    { key: "accent", type: "color", label: "Highlight", default: "", optional: true },
  ],
  build,
};

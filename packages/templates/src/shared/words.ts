import type { FontRegistry, FontRole } from "@jima/engine";

export interface WordBox {
  text: string;
  /** Center position in logical coordinates. */
  cx: number;
  cy: number;
  width: number;
  height: number;
  line: number;
}

export interface WordLayoutOptions {
  role: FontRole;
  weight: number;
  fontSize: number;
  lineHeight: number;
  maxWidth: number;
  align: "left" | "center";
  /** Left edge (align=left) or center x (align=center) of the block. */
  anchorX: number;
  /** Vertical center of the whole block. */
  centerY: number;
  spaceWidthEm?: number;
}

/**
 * Lay a headline out into word boxes, wrapping to fit maxWidth. Each word gets a
 * center position so it can be animated independently (scale/rotate about its
 * center). Pure given the injected measure — deterministic.
 */
export function layoutWords(
  text: string,
  fonts: FontRegistry,
  opts: WordLayoutOptions,
): WordBox[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];

  const measure = (s: string) =>
    fonts.measure(s, { family: fonts.family(opts.role), weight: opts.weight, size: opts.fontSize });
  const spaceWidth = (opts.spaceWidthEm ?? 0.32) * opts.fontSize;

  // Greedy wrap, tracking per-word widths.
  const lines: { words: { text: string; width: number }[]; width: number }[] = [];
  let current: { text: string; width: number }[] = [];
  let currentWidth = 0;
  for (const word of words) {
    const w = measure(word);
    const add = current.length === 0 ? w : currentWidth + spaceWidth + w;
    if (add <= opts.maxWidth || current.length === 0) {
      current.push({ text: word, width: w });
      currentWidth = add;
    } else {
      lines.push({ words: current, width: currentWidth });
      current = [{ text: word, width: w }];
      currentWidth = w;
    }
  }
  if (current.length) lines.push({ words: current, width: currentWidth });

  const totalHeight = lines.length * opts.lineHeight;
  const top = opts.centerY - totalHeight / 2;

  const boxes: WordBox[] = [];
  lines.forEach((line, li) => {
    const lineY = top + li * opts.lineHeight + opts.lineHeight / 2;
    let cursor = opts.align === "left" ? opts.anchorX : opts.anchorX - line.width / 2;
    for (const word of line.words) {
      boxes.push({
        text: word.text,
        cx: cursor + word.width / 2,
        cy: lineY,
        width: word.width,
        height: opts.fontSize,
        line: li,
      });
      cursor += word.width + spaceWidth;
    }
  });
  return boxes;
}

export interface CharBox {
  char: string;
  /** Center position in logical coordinates. */
  cx: number;
  cy: number;
  width: number;
  line: number;
  /** 0-based index across all non-space glyphs (for stagger timing). */
  index: number;
}

/**
 * Lay a headline out into per-character boxes, word-wrapped to maxWidth. Each
 * glyph gets a kerning-accurate center (measured from cumulative prefixes) so it
 * can be animated independently (per-letter reveals, drops, waves, scrambles).
 * Whitespace advances the cursor but yields no box. Deterministic.
 */
export function layoutChars(text: string, fonts: FontRegistry, opts: WordLayoutOptions): CharBox[] {
  const style = { family: fonts.family(opts.role), weight: opts.weight, size: opts.fontSize };
  const measure = (s: string) => fonts.measure(s, style);
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const spaceWidth = (opts.spaceWidthEm ?? 0.3) * opts.fontSize;

  // Greedy wrap into lines of words.
  const lines: string[][] = [];
  let current: string[] = [];
  let currentWidth = 0;
  for (const word of words) {
    const w = measure(word);
    const add = current.length === 0 ? w : currentWidth + spaceWidth + w;
    if (add <= opts.maxWidth || current.length === 0) {
      current.push(word);
      currentWidth = add;
    } else {
      lines.push(current);
      current = [word];
      currentWidth = w;
    }
  }
  if (current.length) lines.push(current);

  const totalHeight = lines.length * opts.lineHeight;
  const top = opts.centerY - totalHeight / 2;

  const boxes: CharBox[] = [];
  let index = 0;
  lines.forEach((lineWords, li) => {
    // Reconstruct the line with a spacer so per-glyph advance stays consistent.
    const lineWidth = lineWords.reduce((acc, w, i) => acc + measure(w) + (i > 0 ? spaceWidth : 0), 0);
    const lineY = top + li * opts.lineHeight + opts.lineHeight / 2;
    let cursor = opts.align === "left" ? opts.anchorX : opts.anchorX - lineWidth / 2;
    lineWords.forEach((word, wi) => {
      if (wi > 0) cursor += spaceWidth;
      let prev = 0;
      for (let i = 0; i < word.length; i++) {
        const upto = measure(word.slice(0, i + 1));
        const charW = upto - prev;
        boxes.push({
          char: word[i]!,
          cx: cursor + prev + charW / 2,
          cy: lineY,
          width: charW,
          line: li,
          index: index++,
        });
        prev = upto;
      }
      cursor += measure(word);
    });
  });
  return boxes;
}

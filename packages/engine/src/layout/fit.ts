// Text fitting — shrink-to-fit and simple word wrapping. Pure: the caller injects
// a measure function so this is testable without a canvas and identical across
// preview and export.

/** Measures the pixel width of `text` rendered at `fontSize`. */
export type MeasureWidth = (text: string, fontSize: number) => number;

export interface ShrinkOptions {
  maxWidth: number;
  baseSize: number;
  minSize: number;
  /** Granularity of the search, px. Default 1. */
  step?: number;
}

/**
 * Largest size ≤ baseSize (down to minSize) at which `text` fits `maxWidth`.
 * Returns minSize if nothing fits (caller decides whether to also wrap).
 */
export function shrinkToFit(text: string, measure: MeasureWidth, opts: ShrinkOptions): number {
  const step = opts.step ?? 1;
  let size = opts.baseSize;
  while (size > opts.minSize) {
    if (measure(text, size) <= opts.maxWidth) return size;
    size -= step;
  }
  return opts.minSize;
}

/**
 * Greedy word-wrap into lines that each fit `maxWidth` at `fontSize`.
 * A single word longer than maxWidth is kept on its own line (never dropped).
 */
export function wrapText(
  text: string,
  measure: MeasureWidth,
  fontSize: number,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (measure(candidate, fontSize) <= maxWidth || current === "") {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Fit multi-line text into a box: find the largest size (≤ baseSize) whose
 * wrapped lines fit within maxWidth and produce ≤ maxLines lines.
 */
export function fitBox(
  text: string,
  measure: MeasureWidth,
  opts: ShrinkOptions & { maxLines: number },
): { fontSize: number; lines: string[] } {
  const step = opts.step ?? 1;
  let size = opts.baseSize;
  while (size > opts.minSize) {
    const lines = wrapText(text, measure, size, opts.maxWidth);
    if (lines.length <= opts.maxLines) return { fontSize: size, lines };
    size -= step;
  }
  return { fontSize: opts.minSize, lines: wrapText(text, measure, opts.minSize, opts.maxWidth) };
}

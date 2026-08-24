import type { Cue, Word } from './types';

/** Minimum cue/word duration in seconds, so nothing collapses to zero length. */
export const MIN_DURATION = 0.1;

/** Generate a fresh cue id. */
export function newCueId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `cue_${crypto.randomUUID()}`;
  }
  return `cue_${Math.random().toString(36).slice(2)}_${Date.now()}`;
}

/**
 * Distribute the span [start, end] across `texts`, proportional to each word's
 * character length. Pure. Consecutive words share boundaries exactly, and the
 * last word ends precisely at `end`.
 */
export function distributeWordTimings(texts: string[], start: number, end: number): Word[] {
  const n = texts.length;
  if (n === 0) return [];
  const span = Math.max(0, end - start);
  const weights = texts.map((t) => Math.max(1, t.length));
  const total = weights.reduce((a, b) => a + b, 0);

  const words: Word[] = [];
  let cursor = start;
  for (let i = 0; i < n; i++) {
    // Both lookups are in range for the whole loop; the fallbacks exist only to
    // satisfy noUncheckedIndexedAccess, and are never reached.
    const weight = weights[i] ?? 1;
    const text = texts[i] ?? '';
    const wStart = cursor;
    const wEnd = i === n - 1 ? end : cursor + (span * weight) / total;
    words.push({ text, start: wStart, end: wEnd });
    cursor = wEnd;
  }
  return words;
}

/** Split edited text into words. */
export function splitText(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Rebuild a cue's words from edited text, re-distributing the cue's existing
 * time span proportionally. Returns [] when the text is empty (caller deletes).
 */
export function retimeCueText(cue: Cue, newText: string): Word[] {
  return distributeWordTimings(splitText(newText), cue.start, cue.end);
}

/** Merge two cues into one spanning both, concatenating their words. */
export function mergeCues(a: Cue, b: Cue): Cue {
  return {
    id: newCueId(),
    start: Math.min(a.start, b.start),
    end: Math.max(a.end, b.end),
    words: [...a.words, ...b.words].map((w) => ({ ...w })),
  };
}

/**
 * Split a cue before `wordIndex` into two cues. `wordIndex` is clamped to
 * [1, words.length-1], so both halves keep at least one word.
 */
export function splitCue(cue: Cue, wordIndex: number): [Cue, Cue] {
  const i = Math.max(1, Math.min(cue.words.length - 1, wordIndex));
  const first = cue.words.slice(0, i);
  const second = cue.words.slice(i);
  const lastOfFirst = first[first.length - 1];
  const firstOfSecond = second[0];
  // `i` is clamped to 1..len-1 above, so both halves have at least one word —
  // provided the caller checked `words.length >= 2`, which is a precondition of
  // this function. Splitting a one-word cue is a programming error, not a user
  // action, so say so rather than returning a cue with a NaN boundary.
  if (!lastOfFirst || !firstOfSecond) {
    throw new Error('splitCue: needs a cue with at least two words');
  }
  const firstCue: Cue = {
    id: newCueId(),
    start: cue.start,
    end: lastOfFirst.end,
    words: first.map((w) => ({ ...w })),
  };
  const secondCue: Cue = {
    id: newCueId(),
    start: firstOfSecond.start,
    end: cue.end,
    words: second.map((w) => ({ ...w })),
  };
  return [firstCue, secondCue];
}

export interface NudgeBounds {
  /** Earliest allowed start (e.g. previous cue's end). */
  min?: number;
  /** Latest allowed end (e.g. next cue's start). */
  max?: number;
}

/**
 * Move a cue's start or end by `delta` seconds, keeping a minimum duration,
 * staying within optional neighbor bounds, and clamping the cue's words to the
 * new span.
 */
export function nudgeCue(
  cue: Cue,
  field: 'start' | 'end',
  delta: number,
  bounds: NudgeBounds = {},
): Cue {
  let { start, end } = cue;

  if (field === 'start') {
    start = cue.start + delta;
    if (bounds.min != null) start = Math.max(start, bounds.min);
    start = Math.max(0, start);
    start = Math.min(start, end - MIN_DURATION);
  } else {
    end = cue.end + delta;
    if (bounds.max != null) end = Math.min(end, bounds.max);
    end = Math.max(end, start + MIN_DURATION);
  }

  const words = cue.words.map((w) => ({
    ...w,
    start: clamp(w.start, start, end),
    end: clamp(w.end, start, end),
  }));

  return { ...cue, start, end, words };
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(Math.max(value, lo), hi);
}

import type { Cue, Word } from './types';

/** Tunables for turning a flat word stream into on-screen cues. */
export interface GroupingOptions {
  /** Max words shown at once. */
  maxWords: number;
  /** Max characters (incl. spaces) shown at once. */
  maxChars: number;
  /** A silence gap larger than this (seconds) forces a new cue. */
  maxGapSec: number;
  /** Minimum time a cue stays on screen (seconds). */
  minDisplaySec: number;
  /** Used when a word has a missing/invalid end timestamp. */
  missingEndFallbackSec: number;
}

export const DEFAULT_GROUPING_OPTIONS: GroupingOptions = {
  maxWords: 4,
  maxChars: 18,
  maxGapSec: 0.6,
  minDisplaySec: 0.3,
  missingEndFallbackSec: 0.35,
};

/** Matches a token that is entirely a non-speech tag, e.g. "[Music]", "(applause)". */
const NON_SPEECH = /^[[(][^\])]*[\])]$/;
/** Has at least one letter or number (Unicode-aware, so German umlauts count). */
const HAS_WORD_CHAR = /[\p{L}\p{N}]/u;
/** Ends a sentence: . ! ? … possibly trailed by a closing quote/bracket. */
const SENTENCE_END = /[.!?…]["'”’)\]]*$/;

/**
 * Clean raw Whisper words: trim, drop empty / non-speech / punctuation-only
 * tokens, and repair missing or non-monotonic timestamps. Pure and order-
 * preserving. Timestamps are clamped so each word has `end > start`.
 */
export function sanitizeWords(
  rawWords: readonly Word[],
  options: GroupingOptions = DEFAULT_GROUPING_OPTIONS,
): Word[] {
  const cleaned: Word[] = [];

  for (const raw of rawWords) {
    const text = raw.text.trim();
    if (text === '') continue;
    if (NON_SPEECH.test(text)) continue;
    if (!HAS_WORD_CHAR.test(text)) continue;

    const start = Number.isFinite(raw.start) ? Math.max(0, raw.start) : NaN;
    if (!Number.isFinite(start)) continue;

    cleaned.push({ text, start, end: raw.end });
  }

  // Second pass: fix end timestamps using the next word's start when needed,
  // and enforce monotonic, non-zero-length timings.
  for (let i = 0; i < cleaned.length; i++) {
    const word = cleaned[i];
    if (!word) continue;
    const next = cleaned[i + 1];
    let end = word.end;

    if (!Number.isFinite(end) || end <= word.start) {
      end = next && Number.isFinite(next.start) ? next.start : word.start + options.missingEndFallbackSec;
    }
    // Never overlap the next word.
    if (next && Number.isFinite(next.start) && end > next.start) {
      end = next.start;
    }
    // Guarantee a positive duration even after clamping.
    if (end <= word.start) {
      end = word.start + options.missingEndFallbackSec;
    }
    word.end = end;
  }

  return cleaned;
}

function endsSentence(text: string): boolean {
  return SENTENCE_END.test(text);
}

function makeCue(words: Word[], options: GroupingOptions, index: number): Cue {
  const first = words[0];
  const last = words[words.length - 1];
  // Only ever called from flush() with a non-empty buffer.
  if (!first || !last) throw new Error('makeCue: called with no words');
  const start = first.start;
  let end = last.end;
  if (end - start < options.minDisplaySec) {
    end = start + options.minDisplaySec;
  }
  return {
    id: `cue_${Math.round(start * 1000)}_${index}`,
    start,
    end,
    words: words.map((w) => ({ ...w })),
  };
}

/**
 * Group a (already sanitized) word stream into cues, breaking before a word
 * when the current cue is full or a long silence precedes it, and after a word
 * that ends a sentence. Overlaps between consecutive cues are clamped away.
 */
export function groupWords(
  words: readonly Word[],
  options: GroupingOptions = DEFAULT_GROUPING_OPTIONS,
): Cue[] {
  const cues: Cue[] = [];
  let current: Word[] = [];
  let charLen = 0;

  const flush = () => {
    if (current.length > 0) {
      cues.push(makeCue(current, options, cues.length));
      current = [];
      charLen = 0;
    }
  };

  for (const word of words) {
    const prev = current[current.length - 1];
    if (prev) {
      const gap = word.start - prev.end;
      const exceedsWords = current.length >= options.maxWords;
      const exceedsChars = charLen + 1 + word.text.length > options.maxChars;
      if (gap > options.maxGapSec || exceedsWords || exceedsChars) {
        flush();
      }
    }

    charLen += (current.length > 0 ? 1 : 0) + word.text.length;
    current.push(word);

    if (endsSentence(word.text)) {
      flush();
    }
  }
  flush();

  // Clamp any residual overlap so cue[i] never extends past cue[i+1]'s start.
  for (let i = 0; i < cues.length - 1; i++) {
    const cue = cues[i];
    const next = cues[i + 1];
    if (!cue || !next) continue;
    if (cue.end > next.start) {
      cue.end = Math.max(cue.start, next.start);
    }
  }

  return cues;
}

/** Full transcript → cues: sanitize then group. */
export function groupTranscript(
  rawWords: readonly Word[],
  options: GroupingOptions = DEFAULT_GROUPING_OPTIONS,
): Cue[] {
  return groupWords(sanitizeWords(rawWords, options), options);
}

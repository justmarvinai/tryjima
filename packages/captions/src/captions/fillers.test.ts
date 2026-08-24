import { describe, it, expect } from 'vitest';
import { isFillerWord, countFillerWords, removeFillerWords } from './fillers';
import type { Cue } from './types';

function cue(id: string, start: number, end: number, texts: string[]): Cue {
  const span = (end - start) / texts.length;
  return {
    id,
    start,
    end,
    words: texts.map((text, i) => ({ text, start: start + i * span, end: start + (i + 1) * span })),
  };
}

describe('isFillerWord', () => {
  it('matches English and German fillers, case-insensitively', () => {
    for (const w of ['um', 'Um', 'UH', 'erm', 'äh', 'Ähm', 'öhm', 'hmm']) {
      expect(isFillerWord(w), w).toBe(true);
    }
  });
  it('ignores trailing/leading punctuation', () => {
    expect(isFillerWord('Um,')).toBe(true);
    expect(isFillerWord('äh...')).toBe(true);
    expect(isFillerWord('“ähm”')).toBe(true);
  });
  it('never touches real words', () => {
    for (const w of ['umbrella', 'her', 'like', 'well', 'also', 'so', 'ehrlich', 'Ähre']) {
      expect(isFillerWord(w), w).toBe(false);
    }
  });
});

describe('countFillerWords', () => {
  it('counts across cues', () => {
    const cues = [cue('a', 0, 2, ['Um,', 'hello']), cue('b', 2, 4, ['äh', 'wie', 'gehts'])];
    expect(countFillerWords(cues)).toBe(2);
  });
});

describe('removeFillerWords', () => {
  it('removes fillers and reports the count', () => {
    const cues = [cue('a', 0, 3, ['Um,', 'hello', 'uh', 'world'])];
    const { cues: next, removed } = removeFillerWords(cues);
    expect(removed).toBe(2);
    expect(next[0]!.words.map((w) => w.text)).toEqual(['hello', 'world']);
  });

  it('keeps the cue display window', () => {
    const cues = [cue('a', 1, 3, ['um', 'ok'])];
    const { cues: next } = removeFillerWords(cues);
    expect(next[0]!.start).toBe(1);
    expect(next[0]!.end).toBe(3);
  });

  it('drops cues that become empty', () => {
    const cues = [cue('a', 0, 1, ['ähm']), cue('b', 1, 2, ['weiter'])];
    const { cues: next, removed } = removeFillerWords(cues);
    expect(removed).toBe(1);
    expect(next).toHaveLength(1);
    expect(next[0]!.id).toBe('b');
  });

  it('does not mutate the input', () => {
    const cues = [cue('a', 0, 2, ['um', 'hi'])];
    removeFillerWords(cues);
    expect(cues[0]!.words).toHaveLength(2);
  });

  it('is a no-op on clean cues', () => {
    const cues = [cue('a', 0, 2, ['alles', 'gut'])];
    const { cues: next, removed } = removeFillerWords(cues);
    expect(removed).toBe(0);
    expect(next[0]!.words.map((w) => w.text)).toEqual(['alles', 'gut']);
  });
});

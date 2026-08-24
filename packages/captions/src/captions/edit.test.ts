import { describe, it, expect } from 'vitest';
import {
  distributeWordTimings,
  retimeCueText,
  splitText,
  mergeCues,
  splitCue,
  nudgeCue,
  MIN_DURATION,
} from './edit';
import type { Cue, Word } from './types';

function w(text: string, start: number, end: number): Word {
  return { text, start, end };
}
function cue(id: string, start: number, end: number, words: Word[]): Cue {
  return { id, start, end, words };
}

describe('distributeWordTimings', () => {
  it('splits a span proportional to word length', () => {
    const words = distributeWordTimings(['aa', 'bbbb'], 0, 6); // weights 2:4
    expect(words[0]!.start).toBe(0);
    expect(words[0]!.end).toBeCloseTo(2);
    expect(words[1]!.start).toBeCloseTo(2);
    expect(words[1]!.end).toBe(6);
  });

  it('is contiguous (each word starts where the previous ended)', () => {
    const words = distributeWordTimings(['a', 'b', 'c'], 1, 4);
    expect(words[1]!.start).toBeCloseTo(words[0]!.end);
    expect(words[2]!.start).toBeCloseTo(words[1]!.end);
  });

  it('ends exactly at the span end', () => {
    const words = distributeWordTimings(['x', 'y', 'z'], 2, 5);
    expect(words[words.length - 1]!.end).toBe(5);
  });

  it('returns [] for no words', () => {
    expect(distributeWordTimings([], 0, 3)).toEqual([]);
  });
});

describe('splitText', () => {
  it('splits on whitespace and drops empties', () => {
    expect(splitText('  hello   world ')).toEqual(['hello', 'world']);
  });
  it('returns [] for blank text', () => {
    expect(splitText('   ')).toEqual([]);
  });
});

describe('retimeCueText', () => {
  it('rebuilds words keeping the cue span', () => {
    const c = cue('c', 10, 12, [w('old', 10, 12)]);
    const words = retimeCueText(c, 'brand new text');
    expect(words.map((x) => x.text)).toEqual(['brand', 'new', 'text']);
    expect(words[0]!.start).toBe(10);
    expect(words[words.length - 1]!.end).toBe(12);
  });

  it('returns [] when cleared (signals delete)', () => {
    expect(retimeCueText(cue('c', 0, 1, [w('a', 0, 1)]), '   ')).toEqual([]);
  });
});

describe('mergeCues', () => {
  it('spans both and concatenates words', () => {
    const a = cue('a', 0, 1, [w('one', 0, 1)]);
    const b = cue('b', 1, 2.5, [w('two', 1, 2.5)]);
    const m = mergeCues(a, b);
    expect(m.start).toBe(0);
    expect(m.end).toBe(2.5);
    expect(m.words.map((x) => x.text)).toEqual(['one', 'two']);
    expect(m.id).not.toBe('a');
  });

  it('does not mutate the inputs', () => {
    const a = cue('a', 0, 1, [w('one', 0, 1)]);
    const b = cue('b', 1, 2, [w('two', 1, 2)]);
    mergeCues(a, b);
    expect(a.words).toHaveLength(1);
    expect(b.words).toHaveLength(1);
  });
});

describe('splitCue', () => {
  const c = cue('c', 0, 3, [w('a', 0, 1), w('b', 1, 2), w('c', 2, 3)]);

  it('splits before the given word index', () => {
    const [first, second] = splitCue(c, 1);
    expect(first.words.map((x) => x.text)).toEqual(['a']);
    expect(second.words.map((x) => x.text)).toEqual(['b', 'c']);
  });

  it('keeps outer bounds and uses word boundary in the middle', () => {
    const [first, second] = splitCue(c, 2);
    expect(first.start).toBe(0);
    expect(first.end).toBe(2); // end of word "b"
    expect(second.start).toBe(2); // start of word "c"
    expect(second.end).toBe(3);
  });

  it('clamps the index so both halves keep a word', () => {
    const [first, second] = splitCue(c, 0);
    expect(first.words).toHaveLength(1);
    expect(second.words).toHaveLength(2);
  });

  it('gives the two halves distinct ids', () => {
    const [first, second] = splitCue(c, 1);
    expect(first.id).not.toBe(second.id);
  });
});

describe('nudgeCue', () => {
  const c = cue('c', 5, 7, [w('a', 5, 6), w('b', 6, 7)]);

  it('moves the start earlier', () => {
    expect(nudgeCue(c, 'start', -0.5).start).toBeCloseTo(4.5);
  });
  it('moves the end later', () => {
    expect(nudgeCue(c, 'end', 0.5).end).toBeCloseTo(7.5);
  });

  it('keeps a minimum duration when squeezing start', () => {
    const out = nudgeCue(c, 'start', +5); // would pass end
    expect(out.end - out.start).toBeGreaterThanOrEqual(MIN_DURATION - 1e-9);
  });

  it('respects the min bound (previous cue end)', () => {
    const out = nudgeCue(c, 'start', -2, { min: 4 });
    expect(out.start).toBeGreaterThanOrEqual(4);
  });

  it('respects the max bound (next cue start)', () => {
    const out = nudgeCue(c, 'end', +2, { max: 7.5 });
    expect(out.end).toBeLessThanOrEqual(7.5);
  });

  it('never lets start go negative', () => {
    const early = cue('c', 0.2, 2, [w('a', 0.2, 2)]);
    expect(nudgeCue(early, 'start', -1).start).toBeGreaterThanOrEqual(0);
  });

  it('clamps words within the new span', () => {
    const out = nudgeCue(c, 'end', -1.5); // end 5.5, word "b" was [6,7]
    for (const word of out.words) {
      expect(word.start).toBeGreaterThanOrEqual(out.start - 1e-9);
      expect(word.end).toBeLessThanOrEqual(out.end + 1e-9);
    }
  });
});

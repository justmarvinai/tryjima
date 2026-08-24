import { describe, it, expect } from 'vitest';
import {
  sanitizeWords,
  groupWords,
  groupTranscript,
  DEFAULT_GROUPING_OPTIONS,
  type GroupingOptions,
} from './grouping';
import type { Word } from './types';

const opts: GroupingOptions = DEFAULT_GROUPING_OPTIONS;

function w(text: string, start: number, end: number): Word {
  return { text, start, end };
}

describe('sanitizeWords', () => {
  it('trims whitespace from tokens', () => {
    expect(sanitizeWords([w(' Hello', 0, 0.5)])[0]!.text).toBe('Hello');
  });

  it('drops empty and whitespace-only tokens', () => {
    expect(sanitizeWords([w('  ', 0, 0.5), w('hi', 0.5, 1)])).toHaveLength(1);
  });

  it('drops non-speech tags like [Music] and (applause)', () => {
    const out = sanitizeWords([w('[Music]', 0, 1), w('(applause)', 1, 2), w('hey', 2, 2.5)]);
    expect(out).toHaveLength(1);
    expect(out[0]!.text).toBe('hey');
  });

  it('drops punctuation-only tokens but keeps words with trailing punctuation', () => {
    const out = sanitizeWords([w('...', 0, 0.2), w('done.', 0.2, 0.8)]);
    expect(out.map((x) => x.text)).toEqual(['done.']);
  });

  it('keeps German words with umlauts and ß', () => {
    const out = sanitizeWords([w('Grüße', 0, 0.5), w('schön', 0.5, 1)]);
    expect(out.map((x) => x.text)).toEqual(['Grüße', 'schön']);
  });

  it('repairs a missing end using the next word start', () => {
    const out = sanitizeWords([w('a', 0, NaN), w('b', 0.7, 1.2)]);
    expect(out[0]!.end).toBeCloseTo(0.7);
  });

  it('repairs a trailing missing end with the fallback duration', () => {
    const out = sanitizeWords([w('solo', 3, NaN)]);
    expect(out[0]!.end).toBeCloseTo(3 + opts.missingEndFallbackSec);
  });

  it('clamps an end that overlaps the next word', () => {
    const out = sanitizeWords([w('a', 0, 1.5), w('b', 1.0, 1.4)]);
    expect(out[0]!.end).toBeLessThanOrEqual(1.0);
  });

  it('guarantees positive duration for every word', () => {
    const out = sanitizeWords([w('a', 0, 0), w('b', 0.05, 0.05)]);
    for (const word of out) expect(word.end).toBeGreaterThan(word.start);
  });
});

describe('groupWords', () => {
  it('breaks when the word count limit is reached', () => {
    const words = [
      w('one', 0, 0.3),
      w('two', 0.3, 0.6),
      w('three', 0.6, 0.9),
      w('four', 0.9, 1.2),
      w('five', 1.2, 1.5),
    ];
    const cues = groupWords(words, { ...opts, maxChars: 999 });
    expect(cues[0]!.words).toHaveLength(4);
    expect(cues[1]!.words).toHaveLength(1);
  });

  it('breaks on a long silence gap', () => {
    const words = [w('before', 0, 0.5), w('after', 2.0, 2.5)]; // 1.5s gap > 0.6
    const cues = groupWords(words, opts);
    expect(cues).toHaveLength(2);
  });

  it('breaks after sentence-ending punctuation', () => {
    const words = [w('Stop.', 0, 0.5), w('Go', 0.6, 0.9)];
    const cues = groupWords(words, opts);
    expect(cues).toHaveLength(2);
    expect(cues[0]!.words[0]!.text).toBe('Stop.');
  });

  it('breaks on the character limit', () => {
    const words = [w('watermelon', 0, 0.5), w('cantaloupe', 0.5, 1.0)]; // 10+1+10 > 18
    const cues = groupWords(words, opts);
    expect(cues).toHaveLength(2);
  });

  it('sets cue timing from first word start to last word end', () => {
    const words = [w('a', 1.0, 1.4), w('b', 1.4, 1.9)];
    const [cue] = groupWords(words, opts);
    if (!cue) throw new Error('expected a cue');
    expect(cue.start).toBeCloseTo(1.0);
    expect(cue.end).toBeCloseTo(1.9);
  });

  it('enforces a minimum display duration', () => {
    const words = [w('hi', 5.0, 5.05)];
    const [cue] = groupWords(words, opts);
    if (!cue) throw new Error('expected a cue');
    expect(cue.end - cue.start).toBeGreaterThanOrEqual(opts.minDisplaySec - 1e-9);
  });

  it('clamps overlap so a padded cue never covers the next cue start', () => {
    // "Hi." flushes on punctuation with a tiny duration; min-display padding
    // would push its end (5.3) past the next cue's start (5.1) without clamping.
    const words = [w('Hi.', 5.0, 5.05), w('there', 5.1, 5.6)];
    const cues = groupWords(words, opts);
    expect(cues).toHaveLength(2);
    expect(cues[0]!.end).toBeLessThanOrEqual(cues[1]!.start + 1e-9);
  });

  it('gives every cue a unique id', () => {
    const words = [w('a.', 0, 0.4), w('b.', 0.5, 0.9), w('c.', 1.0, 1.4)];
    const cues = groupWords(words, opts);
    const ids = new Set(cues.map((c) => c.id));
    expect(ids.size).toBe(cues.length);
  });

  it('returns no cues for empty input', () => {
    expect(groupWords([], opts)).toEqual([]);
  });
});

describe('groupTranscript', () => {
  it('sanitizes then groups end to end', () => {
    const raw = [
      w(' Hello', 0, 0.4),
      w(' world.', 0.4, 0.9),
      w('[Music]', 0.9, 2.0),
      w(' Next', 2.2, 2.6),
      w(' one', 2.6, 3.0),
    ];
    const cues = groupTranscript(raw, opts);
    // "Hello world." is one sentence-terminated cue; "Next one" follows.
    expect(cues).toHaveLength(2);
    expect(cues[0]!.words.map((x) => x.text)).toEqual(['Hello', 'world.']);
    expect(cues[1]!.words.map((x) => x.text)).toEqual(['Next', 'one']);
  });
});

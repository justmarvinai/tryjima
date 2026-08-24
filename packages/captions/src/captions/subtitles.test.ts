import { describe, it, expect } from 'vitest';
import { formatTimestamp, toSrt, toVtt, subtitleFileName } from './subtitles';
import type { Cue } from './types';

const cues: Cue[] = [
  {
    id: 'a',
    start: 0,
    end: 1.5,
    words: [
      { text: 'Hello', start: 0, end: 0.7 },
      { text: 'there', start: 0.7, end: 1.5 },
    ],
  },
  {
    id: 'b',
    start: 61.25,
    end: 63,
    words: [{ text: 'again', start: 61.25, end: 63 }],
  },
];

describe('formatTimestamp', () => {
  it('formats SRT style with a comma', () => {
    expect(formatTimestamp(0, ',')).toBe('00:00:00,000');
    expect(formatTimestamp(61.25, ',')).toBe('00:01:01,250');
  });
  it('formats VTT style with a dot', () => {
    expect(formatTimestamp(61.25, '.')).toBe('00:01:01.250');
  });
  it('handles hours', () => {
    expect(formatTimestamp(3723.007, ',')).toBe('01:02:03,007');
  });
  it('normalizes millisecond rounding carry', () => {
    expect(formatTimestamp(1.9996, ',')).toBe('00:00:02,000');
  });
  it('clamps negatives to zero', () => {
    expect(formatTimestamp(-0.5, ',')).toBe('00:00:00,000');
  });
});

describe('toSrt', () => {
  it('produces numbered blocks with comma timestamps', () => {
    const srt = toSrt(cues);
    expect(srt).toBe(
      '1\n00:00:00,000 --> 00:00:01,500\nHello there\n\n' +
        '2\n00:01:01,250 --> 00:01:03,000\nagain\n',
    );
  });
  it('is empty for no cues', () => {
    expect(toSrt([])).toBe('');
  });
});

describe('toVtt', () => {
  it('starts with the WEBVTT header and uses dot timestamps', () => {
    const vtt = toVtt(cues);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:00.000 --> 00:00:01.500\nHello there');
    expect(vtt).not.toContain(',');
  });
});

describe('subtitleFileName', () => {
  it('derives from the video name', () => {
    expect(subtitleFileName('clip.mp4', 'srt')).toBe('jima-clip.srt');
    expect(subtitleFileName('My Video.MP4', 'vtt')).toBe('jima-My Video.vtt');
  });
  it('falls back for empty names', () => {
    expect(subtitleFileName('.mp4', 'srt')).toBe('jima-captions.srt');
  });
});

import { describe, it, expect } from 'vitest';
import { mixDownToMono, resampledLength, WHISPER_SAMPLE_RATE } from './audio';

describe('mixDownToMono', () => {
  it('returns an empty buffer for no channels', () => {
    expect(mixDownToMono([]).length).toBe(0);
  });

  it('returns a copy (not the same ref) for a single channel', () => {
    const ch = new Float32Array([0.5, -0.25, 0.75]); // float32-exact values
    const out = mixDownToMono([ch]);
    expect(Array.from(out)).toEqual([0.5, -0.25, 0.75]);
    expect(out).not.toBe(ch);
  });

  it('averages two channels sample-by-sample', () => {
    const l = new Float32Array([1, 0, -1, 0.5]);
    const r = new Float32Array([-1, 0, 1, 0.5]);
    const out = mixDownToMono([l, r]);
    expect(Array.from(out)).toEqual([0, 0, 0, 0.5]);
  });

  it('averages three channels', () => {
    const a = new Float32Array([3]);
    const b = new Float32Array([6]);
    const c = new Float32Array([9]);
    expect(mixDownToMono([a, b, c])[0]).toBeCloseTo(6);
  });
});

describe('resampledLength', () => {
  it('downsamples 48k -> 16k to one third the samples', () => {
    expect(resampledLength(48000, 48000, WHISPER_SAMPLE_RATE)).toBe(16000);
  });

  it('handles 44.1k -> 16k', () => {
    expect(resampledLength(44100, 44100, 16000)).toBe(16000);
  });

  it('is identity when rates match', () => {
    expect(resampledLength(12345, 16000, 16000)).toBe(12345);
  });

  it('guards against a zero/invalid source rate', () => {
    expect(resampledLength(1000, 0, 16000)).toBe(0);
  });
});

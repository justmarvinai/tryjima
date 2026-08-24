import { describe, it, expect } from 'vitest';
import {
  estimateVideoBitrate,
  chooseVideoBitrate,
  outputFileName,
  exportProgress,
  shiftToZero,
} from './bitrate';

describe('estimateVideoBitrate', () => {
  it('scales with resolution and frame rate', () => {
    const p720 = estimateVideoBitrate(1280, 720, 30);
    const p1080 = estimateVideoBitrate(1920, 1080, 30);
    expect(p1080).toBeGreaterThan(p720);
  });

  it('applies a minimum floor for tiny videos', () => {
    expect(estimateVideoBitrate(320, 240, 30)).toBe(2_000_000);
  });

  it('applies a maximum ceiling for huge videos', () => {
    expect(estimateVideoBitrate(7680, 4320, 60)).toBe(50_000_000);
  });

  it('defaults a bad fps to 30', () => {
    expect(estimateVideoBitrate(1920, 1080, 0)).toBe(estimateVideoBitrate(1920, 1080, 30));
    expect(estimateVideoBitrate(1920, 1080, NaN)).toBe(estimateVideoBitrate(1920, 1080, 30));
  });
});

describe('chooseVideoBitrate', () => {
  it('never drops below the heuristic', () => {
    const h = estimateVideoBitrate(1920, 1080, 30);
    expect(chooseVideoBitrate(1920, 1080, 30, 1_000)).toBe(h);
  });

  it('matches a higher source bitrate', () => {
    const source = 20_000_000;
    expect(chooseVideoBitrate(1280, 720, 30, source)).toBe(source);
  });

  it('caps a pathological source bitrate', () => {
    expect(chooseVideoBitrate(1920, 1080, 30, 900_000_000)).toBe(50_000_000);
  });

  it('ignores a zero/unknown source bitrate', () => {
    const h = estimateVideoBitrate(1920, 1080, 30);
    expect(chooseVideoBitrate(1920, 1080, 30, 0)).toBe(h);
  });
});

describe('outputFileName', () => {
  it('prefixes jima- and keeps a single .mp4', () => {
    expect(outputFileName('clip.mp4')).toBe('jima-clip.mp4');
    expect(outputFileName('My Video.MP4')).toBe('jima-My Video.mp4');
    expect(outputFileName('noext')).toBe('jima-noext.mp4');
  });

  it('falls back for an empty name', () => {
    expect(outputFileName('.mp4')).toBe('jima-video.mp4');
  });
});

describe('exportProgress', () => {
  it('is a 0..1 fraction', () => {
    expect(exportProgress(0, 10)).toBe(0);
    expect(exportProgress(5, 10)).toBe(0.5);
    expect(exportProgress(10, 10)).toBe(1);
  });
  it('clamps out-of-range inputs', () => {
    expect(exportProgress(15, 10)).toBe(1);
    expect(exportProgress(-1, 10)).toBe(0);
    expect(exportProgress(5, 0)).toBe(0);
  });
});

describe('shiftToZero', () => {
  it('shifts a negative first-frame timestamp to 0', () => {
    expect(shiftToZero(-0.0333, -0.0333)).toBe(0);
  });
  it('keeps relative spacing when shifting', () => {
    expect(shiftToZero(1.0, -0.0333)).toBeCloseTo(1.0333);
  });
  it('is a no-op when the offset is 0', () => {
    expect(shiftToZero(2.5, 0)).toBe(2.5);
  });
  it('never returns negative (guards float drift)', () => {
    expect(shiftToZero(0.4, 0.5)).toBe(0);
  });
});

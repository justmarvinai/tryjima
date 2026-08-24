import { describe, it, expect } from 'vitest';
import {
  validateFileBasics,
  validateDuration,
  hasAcceptedExtension,
  formatBytesMB,
  type FileLike,
} from './validate';
import { MAX_FILE_BYTES, DURATION_CUTOFF_SECONDS } from './constants';

function file(overrides: Partial<FileLike> = {}): FileLike {
  return { name: 'clip.mp4', type: 'video/mp4', size: 5 * 1024 * 1024, ...overrides };
}

describe('validateFileBasics', () => {
  it('accepts a normal mp4', () => {
    expect(validateFileBasics(file())).toEqual({ ok: true });
  });

  it('accepts an .mp4 with empty MIME type (OS reported no type)', () => {
    expect(validateFileBasics(file({ type: '' }))).toEqual({ ok: true });
  });

  it('accepts an .mp4 reported as application/octet-stream', () => {
    expect(validateFileBasics(file({ type: 'application/octet-stream' }))).toEqual({ ok: true });
  });

  it('rejects a non-mp4 video type even with any extension', () => {
    const result = validateFileBasics(file({ name: 'clip.mov', type: 'video/quicktime' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('wrong-type');
  });

  it('rejects a webm', () => {
    const result = validateFileBasics(file({ name: 'clip.webm', type: 'video/webm' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('wrong-type');
  });

  it('rejects an unknown-type file without an .mp4 extension', () => {
    const result = validateFileBasics(file({ name: 'clip.bin', type: '' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('wrong-type');
  });

  it('rejects an empty file', () => {
    const result = validateFileBasics(file({ size: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('empty-file');
  });

  it('rejects a file over the size limit', () => {
    const result = validateFileBasics(file({ size: MAX_FILE_BYTES + 1 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('too-large');
  });

  it('accepts a file exactly at the size limit', () => {
    expect(validateFileBasics(file({ size: MAX_FILE_BYTES }))).toEqual({ ok: true });
  });

  it('is case-insensitive about the extension', () => {
    expect(validateFileBasics(file({ name: 'CLIP.MP4', type: '' }))).toEqual({ ok: true });
  });
});

describe('validateDuration', () => {
  it('accepts a short clip', () => {
    expect(validateDuration(12.5)).toEqual({ ok: true });
  });

  it('accepts a clip just over 60s but within tolerance', () => {
    expect(validateDuration(60.5)).toEqual({ ok: true });
  });

  it('accepts a clip exactly at the cutoff', () => {
    expect(validateDuration(DURATION_CUTOFF_SECONDS)).toEqual({ ok: true });
  });

  it('rejects a clip past the cutoff', () => {
    const result = validateDuration(DURATION_CUTOFF_SECONDS + 0.5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('too-long');
  });

  it('rejects a non-finite duration as unreadable', () => {
    const result = validateDuration(Number.NaN);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unreadable');
  });

  it('rejects a zero/negative duration as unreadable', () => {
    expect(validateDuration(0).ok).toBe(false);
    expect(validateDuration(-3).ok).toBe(false);
  });
});

describe('helpers', () => {
  it('hasAcceptedExtension matches .mp4 case-insensitively', () => {
    expect(hasAcceptedExtension('a.mp4')).toBe(true);
    expect(hasAcceptedExtension('a.MP4')).toBe(true);
    expect(hasAcceptedExtension('a.mov')).toBe(false);
  });

  it('formatBytesMB renders decimals under 100 MB and whole numbers above', () => {
    expect(formatBytesMB(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatBytesMB(150 * 1024 * 1024)).toBe('150 MB');
  });
});

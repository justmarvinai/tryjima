import { describe, it, expect } from 'vitest';
import { sanitizeStoredStyle } from './persist';
import { DEFAULT_CAPTION_STYLE, CAPTION_PRESETS } from './style';

describe('sanitizeStoredStyle', () => {
  it('round-trips every preset unchanged', () => {
    for (const preset of CAPTION_PRESETS) {
      expect(sanitizeStoredStyle(JSON.parse(JSON.stringify(preset.style)))).toEqual(preset.style);
    }
  });

  it('rejects non-objects', () => {
    expect(sanitizeStoredStyle(null)).toBeNull();
    expect(sanitizeStoredStyle('nope')).toBeNull();
    expect(sanitizeStoredStyle(42)).toBeNull();
  });

  it('falls back per-field on invalid values', () => {
    const out = sanitizeStoredStyle({
      fontFamily: 'comic-sans-9000', // unknown font
      fontSizePct: 999, // out of range
      textColor: 'red', // not hex
      highlightStyle: 'sparkles', // unknown enum
      maxLines: 3, // invalid
      positionYPct: 80, // valid — must survive
    });
    expect(out).not.toBeNull();
    expect(out!.fontFamily).toBe(DEFAULT_CAPTION_STYLE.fontFamily);
    expect(out!.fontSizePct).toBe(DEFAULT_CAPTION_STYLE.fontSizePct);
    expect(out!.textColor).toBe(DEFAULT_CAPTION_STYLE.textColor);
    expect(out!.highlightStyle).toBe(DEFAULT_CAPTION_STYLE.highlightStyle);
    expect(out!.maxLines).toBe(DEFAULT_CAPTION_STYLE.maxLines);
    expect(out!.positionYPct).toBe(80);
  });

  it('accepts a partial object (old stored shape after an update)', () => {
    const out = sanitizeStoredStyle({ uppercase: false });
    expect(out).not.toBeNull();
    expect(out!.uppercase).toBe(false);
    expect(out!.fontFamily).toBe(DEFAULT_CAPTION_STYLE.fontFamily);
  });
});

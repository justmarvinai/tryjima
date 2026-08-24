import { describe, it, expect, vi } from 'vitest';
import {
  hexToRgb,
  rgba,
  findActiveCueIndex,
  findActiveWordIndex,
  layoutLines,
  drawCaptions,
  animationState,
  fitScale,
  activeWordBox,
  type CaptionScene,
} from './render';
import { DEFAULT_CAPTION_STYLE, CAPTION_PRESETS, matchingPresetId } from './style';
import type { Cue, Word } from './types';

function word(text: string, start: number, end: number): Word {
  return { text, start, end };
}
function cue(id: string, start: number, end: number, words: Word[] = []): Cue {
  return { id, start, end, words };
}

/** Fake measurer: 10px per character, space = 5px. Deterministic. */
const measure = (t: string) => (t === ' ' ? 5 : t.length * 10);

describe('hexToRgb / rgba', () => {
  it('parses #RRGGBB', () => {
    expect(hexToRgb('#FF8000')).toEqual({ r: 255, g: 128, b: 0 });
  });
  it('parses shorthand #RGB', () => {
    expect(hexToRgb('#f80')).toEqual({ r: 255, g: 136, b: 0 });
  });
  it('falls back to black on garbage', () => {
    expect(hexToRgb('nope')).toEqual({ r: 0, g: 0, b: 0 });
  });
  it('builds an rgba string with clamped alpha', () => {
    expect(rgba('#000000', 0.5)).toBe('rgba(0, 0, 0, 0.5)');
    expect(rgba('#ffffff', 2)).toBe('rgba(255, 255, 255, 1)');
  });
});

describe('findActiveCueIndex', () => {
  const cues = [cue('a', 0, 1), cue('b', 1, 2), cue('c', 3, 4)];

  it('finds the cue containing t', () => {
    expect(findActiveCueIndex(cues, 0.5)).toBe(0);
    expect(findActiveCueIndex(cues, 1.5)).toBe(1);
    expect(findActiveCueIndex(cues, 3.2)).toBe(2);
  });
  it('is inclusive of start, exclusive of end', () => {
    expect(findActiveCueIndex(cues, 1)).toBe(1);
    expect(findActiveCueIndex(cues, 2)).toBe(-1); // gap between b and c
  });
  it('returns -1 before the first and in gaps', () => {
    expect(findActiveCueIndex(cues, -1)).toBe(-1);
    expect(findActiveCueIndex(cues, 2.5)).toBe(-1);
  });
  it('handles an empty cue list', () => {
    expect(findActiveCueIndex([], 1)).toBe(-1);
  });
});

describe('findActiveWordIndex', () => {
  const words = [word('a', 0, 0.5), word('b', 0.5, 1), word('c', 1, 1.5)];

  it('returns the last word whose start ≤ t (karaoke)', () => {
    expect(findActiveWordIndex(words, 0.2)).toBe(0);
    expect(findActiveWordIndex(words, 0.7)).toBe(1);
    expect(findActiveWordIndex(words, 1.4)).toBe(2);
  });
  it('holds the last word past the cue until the next starts', () => {
    expect(findActiveWordIndex(words, 5)).toBe(2);
  });
  it('returns -1 before the first word', () => {
    expect(findActiveWordIndex(words, -0.1)).toBe(-1);
  });
});

describe('layoutLines', () => {
  const words = (texts: string[]) => texts.map((text, i) => ({ text, wordIndex: i }));

  it('keeps words on one line when they fit', () => {
    const lines = layoutLines(words(['ab', 'cd']), measure, 1000);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.words.map((w) => w.text)).toEqual(['ab', 'cd']);
  });

  it('wraps when the next word would overflow', () => {
    // "aaaa"(40) + space(5) + "bbbb"(40) = 85 > 60 → wrap
    const lines = layoutLines(words(['aaaa', 'bbbb']), measure, 60);
    expect(lines).toHaveLength(2);
    expect(lines[0]!.words[0]!.text).toBe('aaaa');
    expect(lines[1]!.words[0]!.text).toBe('bbbb');
  });

  it('positions words left-to-right with a space gap', () => {
    const [line] = layoutLines(words(['ab', 'cd']), measure, 1000);
    if (!line) throw new Error('expected a line');
    expect(line.words[0]!.x).toBe(0);
    expect(line.words[0]!.width).toBe(20);
    expect(line.words[1]!.x).toBe(25); // 20 + space(5)
    expect(line.width).toBe(45); // 20 + 5 + 20
  });

  it('preserves global word indices across wraps', () => {
    const lines = layoutLines(words(['aaaa', 'bbbb', 'cccc']), measure, 60);
    const indices = lines.flatMap((l) => l.words.map((w) => w.wordIndex));
    expect(indices).toEqual([0, 1, 2]);
  });

  it('never drops a word even if it alone exceeds the max width', () => {
    const lines = layoutLines(words(['superlongword']), measure, 10);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.words[0]!.text).toBe('superlongword');
  });

  it('returns nothing for no words', () => {
    expect(layoutLines([], measure, 100)).toEqual([]);
  });
});

describe('animationState', () => {
  it('none is always identity', () => {
    expect(animationState('none', 0)).toEqual({ alpha: 1, scale: 1, rotate: 0 });
    expect(animationState('none', 0.05)).toEqual({ alpha: 1, scale: 1, rotate: 0 });
  });

  it('every animation settles to identity after its duration', () => {
    for (const kind of ['fade', 'pop', 'swing'] as const) {
      expect(animationState(kind, 1)).toEqual({ alpha: 1, scale: 1, rotate: 0 });
    }
  });

  it('fade ramps alpha from 0 to 1', () => {
    expect(animationState('fade', 0).alpha).toBe(0);
    expect(animationState('fade', 0.09).alpha).toBeCloseTo(0.5);
    expect(animationState('fade', 0.18).alpha).toBe(1);
  });

  it('pop starts small and overshoots slightly before settling', () => {
    expect(animationState('pop', 0).scale).toBeCloseTo(0.8);
    const mid = animationState('pop', 0.18).scale;
    expect(mid).toBeGreaterThan(1); // overshoot
    expect(mid).toBeLessThan(1.1); // but subtle
  });

  it('swing rotates mid-flight and ends level', () => {
    expect(Math.abs(animationState('swing', 0.1).rotate)).toBeGreaterThan(0);
    expect(animationState('swing', 0.5).rotate).toBe(0);
    // subtle: never more than 4.5°
    expect(Math.abs(animationState('swing', 0.1).rotate)).toBeLessThanOrEqual((4.5 * Math.PI) / 180);
  });

  it('is deterministic (same input, same output — preview === export)', () => {
    expect(animationState('swing', 0.123)).toEqual(animationState('swing', 0.123));
  });

  it('clamps negative dt', () => {
    expect(animationState('fade', -1).alpha).toBe(0);
  });
});

describe('fitScale', () => {
  it('is 1 when the line already fits', () => {
    expect(fitScale(100, 200)).toBe(1);
  });
  it('shrinks proportionally when too wide', () => {
    expect(fitScale(400, 200)).toBe(0.5);
  });
  it('guards degenerate inputs', () => {
    expect(fitScale(0, 200)).toBe(1);
    expect(fitScale(100, 0)).toBe(1);
  });
});

describe('activeWordBox', () => {
  it('wraps the word with symmetric padding, centered on the line', () => {
    const box = activeWordBox(100, 50, 80, 20);
    expect(box.x).toBeLessThan(100); // pads left
    expect(box.x + box.w).toBeGreaterThan(180); // pads right
    expect(box.y + box.h / 2).toBeCloseTo(50); // vertically centered
    expect((100 - box.x)).toBeCloseTo(box.x + box.w - 180); // symmetric
  });
  it('scales with font size', () => {
    expect(activeWordBox(0, 0, 50, 40).h).toBeGreaterThan(activeWordBox(0, 0, 50, 20).h);
  });
});

describe('caption presets', () => {
  it('ships 4 complete presets', () => {
    expect(CAPTION_PRESETS).toHaveLength(4);
    for (const preset of CAPTION_PRESETS) {
      expect(preset.style.fontFamily).toBeTruthy();
      expect([1, 2]).toContain(preset.style.maxLines);
      expect(['none', 'fade', 'pop', 'swing']).toContain(preset.style.animation);
      expect(['color', 'box']).toContain(preset.style.highlightStyle);
    }
  });

  it('includes the karaoke-box "Focus" preset', () => {
    const focus = CAPTION_PRESETS.find((p) => p.id === 'focus');
    expect(focus?.style.highlightStyle).toBe('box');
  });

  it('default style is the first preset and matches by id', () => {
    expect(DEFAULT_CAPTION_STYLE).toEqual(CAPTION_PRESETS[0]!.style);
    expect(matchingPresetId(DEFAULT_CAPTION_STYLE)).toBe(CAPTION_PRESETS[0]!.id);
  });

  it('a manual edit no longer matches any preset', () => {
    expect(matchingPresetId({ ...DEFAULT_CAPTION_STYLE, fontSizePct: 13.5 })).toBeNull();
  });
});

describe('drawCaptions clear option', () => {
  const scene: CaptionScene = {
    cues: [],
    style: DEFAULT_CAPTION_STYLE,
    videoWidth: 100,
    videoHeight: 100,
  };

  it('clears the canvas by default (preview overlay)', () => {
    const ctx = { clearRect: vi.fn() } as unknown as CanvasRenderingContext2D;
    drawCaptions(ctx, 0, scene);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  });

  it('does NOT clear when clear:false (export composite over the frame)', () => {
    const ctx = { clearRect: vi.fn() } as unknown as CanvasRenderingContext2D;
    drawCaptions(ctx, 0, scene, { clear: false });
    expect(ctx.clearRect).not.toHaveBeenCalled();
  });
});

/**
 * Everything about how captions look. All spatial values are percentages so the
 * same style renders identically at any resolution — this is what lets the live
 * preview and the export match exactly.
 */

/**
 * Entrance animation applied when a cue appears. Deterministic in time
 * (a pure function of `t - cue.start`), so preview and export render the
 * exact same frames.
 */
export type CaptionAnimation = 'none' | 'fade' | 'pop' | 'swing';

export interface CaptionStyle {
  /** Key into the FONTS registry (implies family + weight). */
  fontFamily: string;
  /** Font size as a % of video height. */
  fontSizePct: number;

  textColor: string; // hex
  strokeColor: string; // hex
  /** Outline width as a % of font size. 0 = no stroke. */
  strokeWidthPct: number;

  /** Highlight the currently-spoken word (karaoke). */
  highlightEnabled: boolean;
  highlightColor: string; // hex
  /**
   * How the active word is highlighted: recolor the word itself, or draw a
   * rounded box in the highlight color behind it (the "karaoke box" look).
   */
  highlightStyle: 'color' | 'box';

  /** Rounded background pill behind each line. */
  backgroundEnabled: boolean;
  backgroundColor: string; // hex
  backgroundOpacity: number; // 0..1
  /** Pill corner radius as a % of line height. */
  backgroundRadiusPct: number;

  uppercase: boolean;

  /** Cue entrance animation. */
  animation: CaptionAnimation;

  /**
   * Max lines on screen. 1 = never wrap (the block auto-shrinks to fit the max
   * width instead); 2 = wrap onto a second line when needed.
   */
  maxLines: 1 | 2;

  /** Vertical center of the caption block, 0 (top) … 100 (bottom). */
  positionYPct: number;
  /** Max line width before wrapping, as a % of video width. */
  maxWidthPct: number;
}

export interface CaptionPreset {
  id: string;
  name: string;
  /** One-word vibe shown under the name. */
  tagline: string;
  style: CaptionStyle;
}

/**
 * Ready-made looks — usable as-is, no style editing needed. The first preset is
 * the default style. Every preset is a complete CaptionStyle so applying one
 * fully resets the look.
 */
export const CAPTION_PRESETS: CaptionPreset[] = [
  {
    id: 'bold',
    name: 'Bold',
    tagline: 'Classic TikTok',
    style: {
      fontFamily: 'anton-400',
      fontSizePct: 8,
      textColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidthPct: 12,
      highlightEnabled: true,
      highlightColor: '#FFD84D',
      highlightStyle: 'color',
      backgroundEnabled: false,
      backgroundColor: '#000000',
      backgroundOpacity: 0.5,
      backgroundRadiusPct: 22,
      uppercase: true,
      animation: 'none',
      maxLines: 2,
      positionYPct: 78,
      maxWidthPct: 86,
    },
  },
  {
    id: 'clean',
    name: 'Clean',
    tagline: 'Minimal pill',
    style: {
      fontFamily: 'inter-700',
      fontSizePct: 5.5,
      textColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidthPct: 0,
      highlightEnabled: true,
      highlightColor: '#8B7BFF',
      highlightStyle: 'color',
      backgroundEnabled: true,
      backgroundColor: '#000000',
      backgroundOpacity: 0.55,
      backgroundRadiusPct: 32,
      uppercase: false,
      animation: 'fade',
      maxLines: 2,
      positionYPct: 80,
      maxWidthPct: 80,
    },
  },
  {
    id: 'pop',
    name: 'Pop',
    tagline: 'Loud & bouncy',
    style: {
      fontFamily: 'archivo-900',
      fontSizePct: 9,
      textColor: '#FFFFFF',
      strokeColor: '#0B0C0F',
      strokeWidthPct: 16,
      highlightEnabled: true,
      highlightColor: '#FF6B4A',
      highlightStyle: 'color',
      backgroundEnabled: false,
      backgroundColor: '#000000',
      backgroundOpacity: 0.5,
      backgroundRadiusPct: 22,
      uppercase: true,
      animation: 'pop',
      maxLines: 1,
      positionYPct: 76,
      maxWidthPct: 88,
    },
  },
  {
    id: 'focus',
    name: 'Focus',
    tagline: 'Word spotlight',
    style: {
      fontFamily: 'inter-700',
      fontSizePct: 6.5,
      textColor: '#FFFFFF',
      strokeColor: '#000000',
      strokeWidthPct: 8,
      highlightEnabled: true,
      highlightColor: '#6E56F8',
      highlightStyle: 'box',
      backgroundEnabled: false,
      backgroundColor: '#000000',
      backgroundOpacity: 0.5,
      backgroundRadiusPct: 22,
      uppercase: true,
      animation: 'fade',
      maxLines: 2,
      positionYPct: 78,
      maxWidthPct: 84,
    },
  },
];

const FIRST_PRESET = CAPTION_PRESETS[0];
if (!FIRST_PRESET) throw new Error('CAPTION_PRESETS must not be empty');

/** Bold, high-contrast short-form default — the first preset. */
export const DEFAULT_CAPTION_STYLE: CaptionStyle = FIRST_PRESET.style;

/** The preset whose style exactly matches `style`, or null after manual edits. */
export function matchingPresetId(style: CaptionStyle): string | null {
  for (const preset of CAPTION_PRESETS) {
    if (JSON.stringify(preset.style) === JSON.stringify(style)) return preset.id;
  }
  return null;
}

/** Editable ranges for the style controls (min, max, step). */
export const STYLE_RANGES = {
  fontSizePct: { min: 4, max: 14, step: 0.5 },
  strokeWidthPct: { min: 0, max: 30, step: 1 },
  backgroundOpacity: { min: 0, max: 1, step: 0.05 },
  backgroundRadiusPct: { min: 0, max: 50, step: 1 },
  positionYPct: { min: 40, max: 95, step: 1 },
  maxWidthPct: { min: 50, max: 100, step: 1 },
} as const;

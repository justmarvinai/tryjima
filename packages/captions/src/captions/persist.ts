import { DEFAULT_CAPTION_STYLE, type CaptionStyle } from './style';
import { FONTS } from '../fonts/registry';
import { STYLE_RANGES } from './style';

/**
 * Persist the user's caption style + language choice across sessions —
 * preferences only, never content. Stored in localStorage on the user's own
 * device, consistent with Jima's privacy model.
 */

export const STYLE_STORAGE_KEY = 'jima.style.v1';
export const LANGUAGE_STORAGE_KEY = 'jima.language.v1';

const HEX = /^#[0-9a-fA-F]{3,8}$/;

function inRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

/**
 * Turn untrusted stored JSON into a valid CaptionStyle, or null if hopeless.
 * Unknown/invalid fields fall back to the default, so an old stored shape can
 * never crash the renderer after an update.
 */
export function sanitizeStoredStyle(raw: unknown): CaptionStyle | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const d = DEFAULT_CAPTION_STYLE;

  const style: CaptionStyle = {
    fontFamily:
      typeof o.fontFamily === 'string' && FONTS[o.fontFamily] ? o.fontFamily : d.fontFamily,
    fontSizePct: inRange(o.fontSizePct, STYLE_RANGES.fontSizePct.min, STYLE_RANGES.fontSizePct.max)
      ? o.fontSizePct
      : d.fontSizePct,
    textColor: typeof o.textColor === 'string' && HEX.test(o.textColor) ? o.textColor : d.textColor,
    strokeColor:
      typeof o.strokeColor === 'string' && HEX.test(o.strokeColor) ? o.strokeColor : d.strokeColor,
    strokeWidthPct: inRange(o.strokeWidthPct, 0, STYLE_RANGES.strokeWidthPct.max)
      ? o.strokeWidthPct
      : d.strokeWidthPct,
    highlightEnabled: typeof o.highlightEnabled === 'boolean' ? o.highlightEnabled : d.highlightEnabled,
    highlightColor:
      typeof o.highlightColor === 'string' && HEX.test(o.highlightColor)
        ? o.highlightColor
        : d.highlightColor,
    highlightStyle: o.highlightStyle === 'box' || o.highlightStyle === 'color' ? o.highlightStyle : d.highlightStyle,
    backgroundEnabled:
      typeof o.backgroundEnabled === 'boolean' ? o.backgroundEnabled : d.backgroundEnabled,
    backgroundColor:
      typeof o.backgroundColor === 'string' && HEX.test(o.backgroundColor)
        ? o.backgroundColor
        : d.backgroundColor,
    backgroundOpacity: inRange(o.backgroundOpacity, 0, 1) ? o.backgroundOpacity : d.backgroundOpacity,
    backgroundRadiusPct: inRange(o.backgroundRadiusPct, 0, STYLE_RANGES.backgroundRadiusPct.max)
      ? o.backgroundRadiusPct
      : d.backgroundRadiusPct,
    uppercase: typeof o.uppercase === 'boolean' ? o.uppercase : d.uppercase,
    animation:
      o.animation === 'none' || o.animation === 'fade' || o.animation === 'pop' || o.animation === 'swing'
        ? o.animation
        : d.animation,
    maxLines: o.maxLines === 1 || o.maxLines === 2 ? o.maxLines : d.maxLines,
    positionYPct: inRange(o.positionYPct, STYLE_RANGES.positionYPct.min, STYLE_RANGES.positionYPct.max)
      ? o.positionYPct
      : d.positionYPct,
    maxWidthPct: inRange(o.maxWidthPct, STYLE_RANGES.maxWidthPct.min, STYLE_RANGES.maxWidthPct.max)
      ? o.maxWidthPct
      : d.maxWidthPct,
  };
  return style;
}

/** Read the persisted style, or null. Never throws. */
export function loadStoredStyle(): CaptionStyle | null {
  try {
    const raw = localStorage.getItem(STYLE_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeStoredStyle(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Persist the style. Never throws (private mode, quota, …). */
export function saveStoredStyle(style: CaptionStyle): void {
  try {
    localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(style));
  } catch {
    /* best effort */
  }
}

export function loadStoredLanguage(): 'auto' | 'en' | 'de' | null {
  try {
    const raw = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return raw === 'auto' || raw === 'en' || raw === 'de' ? raw : null;
  } catch {
    return null;
  }
}

export function saveStoredLanguage(language: string): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    /* best effort */
  }
}

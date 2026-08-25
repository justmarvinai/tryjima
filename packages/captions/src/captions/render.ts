import type { Cue, Word } from './types';
import type { CaptionStyle, CaptionAnimation } from './style';
import { FONTS } from '../fonts/registry';

/**
 * The one caption renderer. Pure and DOM-free: it draws onto any 2D context —
 * a `CanvasRenderingContext2D` in the live preview and an
 * `OffscreenCanvasRenderingContext2D` in the export worker — so what you see is
 * exactly what gets encoded. All geometry is derived from the video's pixel
 * dimensions, so it's resolution-independent.
 */

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface CaptionScene {
  cues: Cue[];
  style: CaptionStyle;
  videoWidth: number;
  videoHeight: number;
}

// ── Pure geometry / lookup helpers (unit-tested) ───────────────────────

/** Parse #RGB or #RRGGBB into components. Falls back to black. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) {
    const [r, g, b] = h;
    h = `${r}${r}${g}${g}${b}${b}`;
  }
  if (h.length !== 6 || /[^0-9a-fA-F]/.test(h)) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function rgba(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp01(alpha)})`;
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Index of the cue active at time `t`, or -1. Assumes cues sorted by start. */
export function findActiveCueIndex(cues: readonly Cue[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if ((cues[mid]?.start ?? Number.POSITIVE_INFINITY) <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  const found = ans >= 0 ? cues[ans] : undefined;
  return found && t < found.end ? ans : -1;
}

/** Index of the karaoke-active word: the last word whose start ≤ t. -1 if none. */
export function findActiveWordIndex(words: readonly Word[], t: number): number {
  let ans = -1;
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word && word.start <= t) ans = i;
    else break;
  }
  return ans;
}

export interface LaidOutWord {
  text: string;
  wordIndex: number;
  /** x offset from the line's left edge. */
  x: number;
  width: number;
}

export interface LaidOutLine {
  words: LaidOutWord[];
  width: number;
}

/**
 * Greedy word wrap into lines no wider than `maxWidthPx`. Pure: takes a
 * `measure` function so it's testable without a real canvas.
 */
export function layoutLines(
  words: readonly { text: string; wordIndex: number }[],
  measure: (text: string) => number,
  maxWidthPx: number,
): LaidOutLine[] {
  const spaceWidth = measure(' ');
  const lines: LaidOutLine[] = [];
  let current: LaidOutWord[] = [];
  let cursor = 0;

  const flush = () => {
    if (current.length > 0) {
      lines.push({ words: current, width: cursor });
      current = [];
      cursor = 0;
    }
  };

  for (const word of words) {
    const width = measure(word.text);
    const gap = current.length > 0 ? spaceWidth : 0;
    if (current.length > 0 && cursor + gap + width > maxWidthPx) {
      flush();
    }
    const x = current.length > 0 ? cursor + spaceWidth : 0;
    current.push({ text: word.text, wordIndex: word.wordIndex, x, width });
    cursor = x + width;
  }
  flush();

  return lines;
}

// ── Entrance animation math (pure, deterministic in time) ─────────────

export interface AnimState {
  /** 0..1 opacity multiplier. */
  alpha: number;
  /** Uniform scale around the block center. */
  scale: number;
  /** Rotation around the block center, radians. */
  rotate: number;
}

const IDENTITY: AnimState = { alpha: 1, scale: 1, rotate: 0 };

function easeOutBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

/**
 * The entrance animation state for a cue that has been visible for `dtSec`.
 * Pure — the same (kind, dt) always yields the same frame, which is what keeps
 * the preview and the export pixel-identical.
 */
export function animationState(kind: CaptionAnimation, dtSec: number): AnimState {
  const dt = Math.max(0, dtSec);
  switch (kind) {
    case 'fade': {
      const DUR = 0.18;
      if (dt >= DUR) return IDENTITY;
      return { alpha: dt / DUR, scale: 1, rotate: 0 };
    }
    case 'pop': {
      const DUR = 0.22;
      if (dt >= DUR) return IDENTITY;
      const p = dt / DUR;
      return {
        alpha: Math.min(1, dt / 0.08),
        scale: 0.8 + 0.2 * easeOutBack(p),
        rotate: 0,
      };
    }
    case 'swing': {
      const DUR = 0.5;
      if (dt >= DUR) return IDENTITY;
      const p = dt / DUR;
      const damp = (1 - p) * (1 - p);
      const maxAngle = (4.5 * Math.PI) / 180; // subtle: 4.5°
      return {
        alpha: Math.min(1, dt / 0.12),
        scale: 1,
        rotate: maxAngle * damp * Math.sin(p * Math.PI * 2.5),
      };
    }
    case 'none':
    default:
      return IDENTITY;
  }
}

/** Scale needed to fit a single line of `lineWidth` into `maxWidth` (≤ 1). */
export function fitScale(lineWidth: number, maxWidth: number): number {
  if (!(lineWidth > 0) || !(maxWidth > 0)) return 1;
  return Math.min(1, maxWidth / lineWidth);
}

/**
 * Geometry of the karaoke box drawn behind the active word (highlightStyle
 * 'box'). Pure: x is the word's left edge, lineCenterY its vertical center.
 */
export function activeWordBox(
  x: number,
  lineCenterY: number,
  wordWidth: number,
  fontSize: number,
): { x: number; y: number; w: number; h: number; r: number } {
  const padX = fontSize * 0.24;
  const h = fontSize * 1.18;
  return {
    x: x - padX,
    y: lineCenterY - h / 2,
    w: wordWidth + padX * 2,
    h,
    r: fontSize * 0.26,
  };
}

function resolveFont(key: string): { family: string; weight: number } {
  const def = FONTS[key];
  return def ? { family: def.family, weight: def.weight } : { family: 'sans-serif', weight: 700 };
}

function roundRectPath(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, h / 2, w / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

// ── The renderer ───────────────────────────────────────────────────────

export interface DrawOptions {
  /**
   * Clear the canvas before drawing. True (default) for the live preview, whose
   * overlay is a dedicated transparent canvas. False for export, where captions
   * are composited on top of the already-drawn video frame — clearing there
   * would erase the frame and leave captions on black.
   */
  clear?: boolean;
}

export function drawCaptions(
  ctx: Ctx2D,
  timeSec: number,
  scene: CaptionScene,
  options: DrawOptions = {},
): void {
  const { cues, style, videoWidth, videoHeight } = scene;
  if (options.clear ?? true) ctx.clearRect(0, 0, videoWidth, videoHeight);

  const cueIndex = findActiveCueIndex(cues, timeSec);
  if (cueIndex < 0) return;
  const cue = cues[cueIndex];
  if (!cue) return;

  const fontSize = (videoHeight * style.fontSizePct) / 100;
  const lineHeight = fontSize * 1.18;
  const { family, weight } = resolveFont(style.fontFamily);

  ctx.font = `${weight} ${fontSize}px "${family}", sans-serif`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';

  const renderWords = cue.words.map((w, i) => ({
    text: style.uppercase ? w.text.toUpperCase() : w.text,
    wordIndex: i,
  }));

  const maxWidth = (videoWidth * style.maxWidthPct) / 100;
  // 1-line mode never wraps: lay out on one line, then shrink to fit the width.
  const wrapWidth = style.maxLines === 1 ? Number.POSITIVE_INFINITY : maxWidth;
  const lines = layoutLines(renderWords, (s) => ctx.measureText(s).width, wrapWidth);
  if (lines.length === 0) return;

  // `maxLines` is a cap, not a hint. Greedy wrapping happily produced three or
  // four lines from a wide font in a narrow frame while the style said "2", and
  // the block then ran off the bottom of the video. Over the cap, fold the
  // surplus lines back into the last allowed one and shrink the whole block to
  // fit instead — the same treatment 1-line mode already gets.
  const capped = lines.slice(0, style.maxLines);
  const overflow = lines.slice(style.maxLines);
  if (overflow.length > 0) {
    const last = capped[capped.length - 1];
    if (last) {
      const spaceWidth = ctx.measureText(' ').width;
      let cursor = last.width;
      for (const line of overflow) {
        for (const word of line.words) {
          cursor += spaceWidth;
          last.words.push({ ...word, x: cursor });
          cursor += word.width;
        }
      }
      last.width = cursor;
    }
  }

  const centerX = videoWidth / 2;
  const centerY = (videoHeight * style.positionYPct) / 100;
  const blockTop = centerY - (capped.length * lineHeight) / 2;

  const activeWord = style.highlightEnabled ? findActiveWordIndex(cue.words, timeSec) : -1;
  const strokeWidth = (fontSize * style.strokeWidthPct) / 100;

  // Entrance animation + 1-line fit, applied as one transform around the block
  // center so preview and export stay identical.
  const anim = animationState(style.animation, timeSec - cue.start);
  // Shrink for 1-line mode, and for any line the cap forced to over-run.
  const widest = capped.reduce((w, l) => Math.max(w, l.width), 0);
  const shrink = style.maxLines === 1 || overflow.length > 0 ? fitScale(widest, maxWidth) : 1;
  const totalScale = anim.scale * shrink;

  ctx.save();
  ctx.globalAlpha *= anim.alpha;
  if (totalScale !== 1 || anim.rotate !== 0) {
    ctx.translate(centerX, centerY);
    ctx.rotate(anim.rotate);
    ctx.scale(totalScale, totalScale);
    ctx.translate(-centerX, -centerY);
  }

  // Background pills, per line.
  if (style.backgroundEnabled) {
    ctx.fillStyle = rgba(style.backgroundColor, style.backgroundOpacity);
    const padX = fontSize * 0.35;
    const pillH = fontSize * 1.3;
    capped.forEach((line, li) => {
      const lineCenterY = blockTop + li * lineHeight + lineHeight / 2;
      const w = line.width + padX * 2;
      roundRectPath(
        ctx,
        centerX - w / 2,
        lineCenterY - pillH / 2,
        w,
        pillH,
        (pillH * style.backgroundRadiusPct) / 100,
      );
      ctx.fill();
    });
  }

  // Words: stroke then fill, highlighting the active word.
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;
  capped.forEach((line, li) => {
    const lineCenterY = blockTop + li * lineHeight + lineHeight / 2;
    const lineStartX = centerX - line.width / 2;
    for (const word of line.words) {
      const x = lineStartX + word.x;
      const isActive = word.wordIndex === activeWord;

      // Karaoke box: a rounded box in the highlight color behind the active
      // word; the word itself keeps the normal text color.
      if (isActive && style.highlightStyle === 'box') {
        const box = activeWordBox(x, lineCenterY, word.width, fontSize);
        ctx.fillStyle = style.highlightColor;
        roundRectPath(ctx, box.x, box.y, box.w, box.h, box.r);
        ctx.fill();
      }

      if (strokeWidth > 0) {
        ctx.lineWidth = strokeWidth;
        ctx.strokeStyle = style.strokeColor;
        ctx.strokeText(word.text, x, lineCenterY);
      }
      ctx.fillStyle =
        isActive && style.highlightStyle === 'color' ? style.highlightColor : style.textColor;
      ctx.fillText(word.text, x, lineCenterY);
    }
  });

  ctx.restore();
}

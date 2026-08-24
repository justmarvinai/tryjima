import type { Cue } from './types';

/**
 * Subtitle-file export (SRT + WebVTT). Pure text generation from cues, so the
 * same edited/re-timed captions the user sees are exactly what lands in the
 * file. Everything runs locally — the file is assembled in memory and saved
 * via a normal browser download.
 */

function pad(n: number, width: number): string {
  return n.toString().padStart(width, '0');
}

/** Seconds → `HH:MM:SS<sep>mmm` (SRT uses ",", VTT uses "."). */
export function formatTimestamp(seconds: number, sep: ',' | '.'): string {
  const total = Math.max(0, seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const ms = Math.round((total - Math.floor(total)) * 1000);
  // Rounding ms can carry (e.g. 1.9996s → 2.000); normalize.
  if (ms === 1000) return formatTimestamp(Math.floor(total) + 1, sep);
  return `${pad(h, 2)}:${pad(m, 2)}:${pad(s, 2)}${sep}${pad(ms, 3)}`;
}

function cueText(cue: Cue): string {
  return cue.words.map((w) => w.text).join(' ');
}

/** Cues → SubRip (.srt) file contents. */
export function toSrt(cues: readonly Cue[]): string {
  return cues
    .map(
      (cue, i) =>
        `${i + 1}\n${formatTimestamp(cue.start, ',')} --> ${formatTimestamp(cue.end, ',')}\n${cueText(cue)}`,
    )
    .join('\n\n')
    .concat(cues.length > 0 ? '\n' : '');
}

/** Cues → WebVTT (.vtt) file contents. */
export function toVtt(cues: readonly Cue[]): string {
  const body = cues
    .map(
      (cue) =>
        `${formatTimestamp(cue.start, '.')} --> ${formatTimestamp(cue.end, '.')}\n${cueText(cue)}`,
    )
    .join('\n\n');
  return `WEBVTT\n\n${body}${cues.length > 0 ? '\n' : ''}`;
}

/** `clip.mp4` + 'srt' → `jima-clip.srt`. */
export function subtitleFileName(inputName: string, ext: 'srt' | 'vtt'): string {
  const base = inputName.replace(/\.mp4$/i, '').trim() || 'captions';
  return `jima-${base}.${ext}`;
}

/** Trigger a browser download of a generated text file. Browser only. */
export function downloadTextFile(fileName: string, contents: string, mimeType: string): void {
  const blob = new Blob([contents], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

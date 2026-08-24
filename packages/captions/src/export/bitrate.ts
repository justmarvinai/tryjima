/** Pure export math: bitrate selection, filenames, progress. Unit-tested. */

/** Bits per pixel per frame for the H.264 heuristic. ~0.12 is visually high quality. */
const BITS_PER_PIXEL = 0.12;
const MIN_BITRATE = 2_000_000; // 2 Mbps floor
const MAX_BITRATE = 50_000_000; // 50 Mbps ceiling (keeps 4K exports sane)

/** Heuristic target video bitrate (bits/sec) for a resolution + frame rate. */
export function estimateVideoBitrate(width: number, height: number, fps: number): number {
  const frameRate = fps > 0 && Number.isFinite(fps) ? fps : 30;
  const raw = width * height * frameRate * BITS_PER_PIXEL;
  return clamp(Math.round(raw), MIN_BITRATE, MAX_BITRATE);
}

/**
 * Full-quality target: at least the heuristic, and at least the source bitrate
 * (so we never degrade), capped so a pathological source doesn't blow up.
 */
export function chooseVideoBitrate(
  width: number,
  height: number,
  fps: number,
  sourceBitrate: number,
): number {
  const heuristic = estimateVideoBitrate(width, height, fps);
  const source = Number.isFinite(sourceBitrate) && sourceBitrate > 0 ? sourceBitrate : 0;
  return clamp(Math.max(heuristic, source), MIN_BITRATE, MAX_BITRATE);
}

/** Download filename: `jima-<original without extension>.mp4`. */
export function outputFileName(inputName: string): string {
  const base = inputName.replace(/\.mp4$/i, '').trim() || 'video';
  return `jima-${base}.mp4`;
}

/** Export progress as 0..1 from the current frame time and total duration. */
export function exportProgress(currentTimeSec: number, durationSec: number): number {
  if (!(durationSec > 0)) return 0;
  return clamp(currentTimeSec / durationSec, 0, 1);
}

/**
 * Shift a timestamp so the output timeline starts at 0. Some containers report a
 * slightly-negative first timestamp (edit lists / encoder delay), which the
 * muxer rejects. Subtracting the track's start offset fixes it; the final
 * `max(0, …)` guards against tiny float drift.
 */
export function shiftToZero(timestampSec: number, startOffsetSec: number): number {
  return Math.max(0, timestampSec - startOffsetSec);
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

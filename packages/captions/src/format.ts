/** Formatting helpers shared across the UI. */

/** Seconds → `M:SS` (e.g. 72.4 → "1:12"). */
export function formatClock(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Seconds → `M:SS.d` with tenths (e.g. 72.45 → "1:12.4"). */
export function formatClockTenths(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const tenths = Math.floor((safe * 10) % 10);
  return `${m}:${s.toString().padStart(2, '0')}.${tenths}`;
}

/** Uppercase a codec string for display, or a dash when unknown. */
export function codecLabel(codec: string | null): string {
  return codec ? codec.toUpperCase() : '—';
}

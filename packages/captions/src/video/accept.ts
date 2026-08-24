import { probeVideo, ProbeError } from './probe';
import {
  validateFileBasics,
  validateDuration,
  noAudioError,
  noVideoError,
  unreadableError,
} from './validate';
import type { AcceptResult } from './types';

/**
 * The full "can we caption this file?" flow, in order:
 *   1. cheap synchronous checks (type + size)
 *   2. probe metadata locally (mediabunny)
 *   3. duration limit + audio-track presence
 *
 * Returns a typed result with a friendly message on failure — it never throws
 * for expected validation problems.
 */
export async function acceptVideo(file: File): Promise<AcceptResult> {
  const basics = validateFileBasics(file);
  if (!basics.ok) return basics;

  let metadata;
  try {
    metadata = await probeVideo(file);
  } catch (e) {
    if (e instanceof ProbeError && e.code === 'no-video-track') {
      return { ok: false, error: noVideoError() };
    }
    return { ok: false, error: unreadableError() };
  }

  const duration = validateDuration(metadata.durationSec);
  if (!duration.ok) return duration;

  if (!metadata.hasAudio) {
    return { ok: false, error: noAudioError() };
  }

  return { ok: true, metadata };
}

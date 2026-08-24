import {
  ACCEPTED_EXTENSIONS,
  ACCEPTED_MIME_TYPES,
  DURATION_CUTOFF_SECONDS,
  MAX_DURATION_SECONDS,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
} from './constants';
import type { BasicValidation, ValidationError, ValidationErrorCode } from './types';

/** A minimal shape so these checks are testable without a real File. */
export interface FileLike {
  name: string;
  type: string;
  size: number;
}

function err(code: ValidationErrorCode, message: string): BasicValidation {
  return { ok: false, error: { code, message } };
}

export function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function hasAcceptedMime(type: string): boolean {
  return (ACCEPTED_MIME_TYPES as readonly string[]).includes(type);
}

export function formatBytesMB(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  // One decimal for anything under 100 MB, whole numbers above.
  return mb >= 100 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
}

/**
 * Synchronous pre-probe validation: file must be a non-empty .mp4 within the
 * size limit. Some browsers/OSes report an empty `type`, so we fall back to the
 * extension — but a *wrong* declared type (e.g. video/quicktime) is rejected.
 */
export function validateFileBasics(file: FileLike): BasicValidation {
  if (file.size === 0) {
    return err('empty-file', 'That file is empty. Try exporting your video again.');
  }

  const mimeOk = hasAcceptedMime(file.type);
  const extOk = hasAcceptedExtension(file.name);
  const typeUnknown = file.type === '' || file.type === 'application/octet-stream';

  // Accept when the MIME says mp4, or when the MIME is unknown but the
  // extension is .mp4. Reject a positively-wrong video type.
  if (!mimeOk && !(typeUnknown && extOk)) {
    return err('wrong-type', 'Jima needs an .mp4 file. Other formats aren’t supported yet.');
  }

  if (file.size > MAX_FILE_BYTES) {
    return err(
      'too-large',
      `That file is ${formatBytesMB(file.size)}. The limit is ${MAX_FILE_MB} MB.`,
    );
  }

  return { ok: true };
}

/** Validate the probed duration against the limit. `durationSec` must be finite. */
export function validateDuration(durationSec: number): BasicValidation {
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return err('unreadable', 'Jima couldn’t read this video. The file may be damaged.');
  }
  if (durationSec > DURATION_CUTOFF_SECONDS) {
    const seconds = Math.round(durationSec);
    return err(
      'too-long',
      `That clip is ${seconds}s. Jima handles videos up to ${MAX_DURATION_SECONDS} seconds.`,
    );
  }
  return { ok: true };
}

export function noAudioError(): ValidationError {
  return {
    code: 'no-audio-track',
    message: 'This video has no audio, so there’s nothing to caption.',
  };
}

export function noVideoError(): ValidationError {
  return {
    code: 'no-video-track',
    message: 'That file has no video track Jima can read.',
  };
}

export function unreadableError(): ValidationError {
  return {
    code: 'unreadable',
    message: 'Jima couldn’t read this video. Make sure it’s a standard .mp4.',
  };
}

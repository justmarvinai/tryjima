export type ValidationErrorCode =
  | 'empty-file'
  | 'wrong-type'
  | 'too-large'
  | 'unreadable'
  | 'no-video-track'
  | 'too-long'
  | 'no-audio-track';

export interface ValidationError {
  code: ValidationErrorCode;
  /** Friendly, user-facing message. */
  message: string;
}

/** Result of the synchronous, pre-probe checks (type + size). */
export type BasicValidation = { ok: true } | { ok: false; error: ValidationError };

/** Metadata read from the file by the mediabunny probe. */
export interface VideoMetadata {
  /** Display width in px, after aspect-ratio and rotation adjustment. */
  width: number;
  /** Display height in px, after aspect-ratio and rotation adjustment. */
  height: number;
  durationSec: number;
  hasAudio: boolean;
  videoCodec: string | null;
  audioCodec: string | null;
}

/** Result of the full accept flow (basics + probe + limits). */
export type AcceptResult =
  | { ok: true; metadata: VideoMetadata }
  | { ok: false; error: ValidationError };

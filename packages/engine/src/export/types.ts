export type ExportFormat = "mp4" | "webm" | "gif";

export interface ExportProfile {
  format: ExportFormat;
  /** Output long-edge scale factor vs logical size (1 = 1080p class). */
  resolution?: number;
  fps: number;
  /** GIF only: max palette colors (2–255). */
  gifMaxColors?: number;
}

/**
 * Synthetic motion blur: each output frame is the average of `samples` poses
 * spread across `shutter` × the frame interval, centred on the frame time.
 * 0.5 is a 180° shutter — the film default.
 */
export interface MotionBlur {
  samples: number;
  shutter: number;
}

export const MOTION_BLUR_DEFAULT: MotionBlur = { samples: 8, shutter: 0.5 };

export type ExportPhase = "prepare" | "render" | "finalize";

export interface ExportProgress {
  phase: ExportPhase;
  frame: number;
  totalFrames: number;
  /** 0..1 overall. */
  ratio: number;
}

export interface ExportResult {
  blob: Blob;
  bytes: Uint8Array;
  format: ExportFormat;
  width: number;
  height: number;
  fps: number;
  frames: number;
  filename: string;
}

/** What the current browser can actually produce (probed, not assumed). */
export interface Capabilities {
  mp4: "native" | "none";
  webm: "native" | "none";
  gif: "always";
  /** Codec chosen for MP4 (avc) / WebM (vp9|vp8|av1) if available. */
  mp4Codec: string | null;
  webmCodec: string | null;
  /** Audio codec for the sound track: AAC (MP4) / Opus (WebM), null if none. */
  mp4AudioCodec: string | null;
  webmAudioCodec: string | null;
}

export class ExportCancelledError extends Error {
  constructor() {
    super("Export cancelled");
    this.name = "ExportCancelledError";
  }
}

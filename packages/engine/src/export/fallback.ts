// Fallback ladder scaffolding (docs/MOTION_ARCHITECTURE.md §4, §8.2/§8.5).
//
// The primary path is WebCodecs → Mediabunny (MP4/WebM) + gifenc (GIF). Capability
// detection (./capabilities) ensures we only ever OFFER a format that will work,
// so on Tier A/B these fallbacks are never needed. They are scaffolded here with
// their contracts so Phase 3 can wire honest messaging and, if export telemetry
// ever justifies it, real implementations — without reshaping the exporter.
//
// Tier C order when native encoding is unavailable:
//   1. GIF (gifenc) — always works, pure JS. This is the universal floor.
//   2. ffmpeg.wasm (single-thread, lazy ~31 MB) — MP4 for Firefox/legacy, on
//      explicit user consent (download-size + speed warning).
//   3. MediaRecorder + canvas.captureStream — realtime, non-deterministic,
//      labeled "preview quality". Absolute last resort.

export type FallbackTier = "ffmpeg-wasm" | "media-recorder";

export class FallbackNotImplementedError extends Error {
  constructor(tier: FallbackTier) {
    super(
      `Fallback "${tier}" is scaffolded but not implemented in v1. GIF is the ` +
        `universal floor; MP4/WebM come from WebCodecs on supported browsers.`,
    );
    this.name = "FallbackNotImplementedError";
  }
}

/** Placeholder: lazy single-thread ffmpeg.wasm MP4 encode (Tier B/C, on consent). */
export function ffmpegWasmAvailable(): boolean {
  return false;
}

/** Placeholder: MediaRecorder "preview quality" capture (Tier C last resort). */
export function mediaRecorderAvailable(): boolean {
  return typeof MediaRecorder !== "undefined";
}

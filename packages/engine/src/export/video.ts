import {
  Output,
  BufferTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
  CanvasSource,
  AudioBufferSource,
  QUALITY_HIGH,
  QUALITY_MEDIUM,
  type VideoCodec,
  type AudioCodec,
} from "mediabunny";
import type { TemplateRunner } from "../runtime/runner";
import { ExportCancelledError, type ExportFormat, type ExportProgress, type MotionBlur } from "./types";
import { renderFrame } from "./frame";

export interface VideoExportArgs {
  runner: TemplateRunner;
  format: Extract<ExportFormat, "mp4" | "webm">;
  codec: string;
  fps: number;
  totalFrames: number;
  /** Timeline-time = outputTime × speed (clamped to duration). Default 1. */
  speed?: number;
  /** Optional baked sound track + its audio codec (AAC/Opus). Muxed if both set. */
  audio?: AudioBuffer | null;
  audioCodec?: string | null;
  /** Keep the canvas alpha channel (transparent WebM). VP9/VP8 only. */
  alpha?: boolean;
  /** Synthetic motion blur; omitted or null renders one pose per frame. */
  motionBlur?: MotionBlur | null;
  signal?: AbortSignal;
  onProgress?: (p: ExportProgress) => void;
}

/**
 * Deterministic frame loop → WebCodecs (via Mediabunny CanvasSource) → MP4/WebM.
 * Renders each frame at t = i/fps, hands the canvas to Mediabunny, and awaits
 * `source.add` so encoder/writer backpressure is respected (no OOM on long
 * exports — CLAUDE.md). Never uses captureStream; frame count is exact.
 */
export async function exportVideo(args: VideoExportArgs): Promise<Uint8Array> {
  const { runner, format, codec, fps, totalFrames, signal, onProgress } = args;
  const speed = args.speed && args.speed > 0 ? args.speed : 1;

  const output = new Output({
    format: format === "mp4" ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target: new BufferTarget(),
  });
  const source = new CanvasSource(runner.canvas, {
    codec: codec as VideoCodec, // validated by capability detection
    bitrate: QUALITY_HIGH,
    keyFrameInterval: 2,
    // Encode the alpha channel too (WebM/VP9 emits it as packet side data, which
    // Mediabunny uses to mark the track transparent). Only set for WebM.
    ...(args.alpha ? { alpha: "keep" as const } : {}),
  });
  output.addVideoTrack(source, { frameRate: fps });

  // Optional sound track (added before start, fed after the video frames).
  const audioSource =
    args.audio && args.audioCodec
      ? new AudioBufferSource({ codec: args.audioCodec as AudioCodec, bitrate: QUALITY_MEDIUM })
      : null;
  if (audioSource) output.addAudioTrack(audioSource);

  await output.start();

  // Guard fps=0 → Infinity frameDur → NaN timestamps (the editor only sends
  // 12/30/60; this protects the reusable export API from misuse).
  const frameDur = 1 / Math.max(1, fps);
  try {
    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) {
        await output.cancel();
        throw new ExportCancelledError();
      }
      renderFrame(runner, Math.min(runner.duration, i * frameDur * speed), frameDur * speed, args.motionBlur);
      await source.add(i * frameDur, frameDur);
      onProgress?.({
        phase: "render",
        frame: i + 1,
        totalFrames,
        ratio: ((i + 1) / totalFrames) * 0.97,
      });
    }
    if (audioSource && args.audio) {
      await audioSource.add(args.audio);
      audioSource.close();
    }
    onProgress?.({ phase: "finalize", frame: totalFrames, totalFrames, ratio: 0.99 });
    await output.finalize();
  } catch (err) {
    if (!(err instanceof ExportCancelledError)) {
      try {
        await output.cancel();
      } catch {
        /* already failed */
      }
    }
    throw err;
  }

  const buffer = output.target.buffer;
  if (!buffer) throw new Error("exportVideo: no output buffer produced");
  return new Uint8Array(buffer);
}

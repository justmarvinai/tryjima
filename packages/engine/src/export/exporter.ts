import { TemplateRunner, type RunnerConfig } from "../runtime/runner";
import { sizeOf } from "../layout/aspect";
import { TRANSPARENT_BG, type TemplateDefinition } from "../sdk/types";
import { cuesForTemplate, trimCues, renderCuesToBuffer, type SoundPack } from "../audio/index";
import { detectCapabilities } from "./capabilities";
import { exportVideo } from "./video";
import { exportGif } from "./gif";
import { MOTION_BLUR_DEFAULT, type ExportFormat, type ExportProfile, type ExportProgress, type ExportResult, type MotionBlur } from "./types";

export interface ExportRequest {
  def: TemplateDefinition;
  /** Aspect / values / palette / seed for the render. */
  runner: RunnerConfig;
  profile: ExportProfile;
  /** Playback speed multiplier (compresses/stretches output length). Default 1. */
  speed?: number;
  /** Bake the motion-matched sound track into MP4/WebM (GIF stays silent). */
  sound?: boolean;
  soundPack?: SoundPack;
  /** Bake the procedural music bed under the effects (requires `sound`). */
  music?: boolean;
  /** Export a transparent background (alpha). WebM only — ignored otherwise. */
  transparent?: boolean;
  /**
   * Synthetic motion blur. `true` uses the 180°/8-sample default; pass an object
   * to tune it. Costs one extra render per sample, so it is export-only.
   */
  motionBlur?: boolean | MotionBlur;
  signal?: AbortSignal;
  onProgress?: (p: ExportProgress) => void;
}

const MIME: Record<ExportFormat, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  gif: "image/gif",
};

/** Force even dimensions (H.264 requires it; harmless for WebM/GIF). */
function evenize(n: number): number {
  const r = Math.round(n);
  return r % 2 === 0 ? r : r + 1;
}

/**
 * Export a template to a downloadable Blob — entirely client-side. Builds a
 * dedicated runner at the exact output resolution (never reads back the
 * DPR-scaled preview canvas — CLAUDE.md), then dispatches by format. Progress
 * is reported per frame and the whole run is cancelable via `signal`.
 */
export async function exportTemplate(req: ExportRequest): Promise<ExportResult> {
  const { def, profile, signal, onProgress } = req;
  const resolution = profile.resolution ?? 1;
  const logical = sizeOf(req.runner.aspect);
  const width = evenize(logical.width * resolution);
  const height = evenize(logical.height * resolution);

  onProgress?.({ phase: "prepare", frame: 0, totalFrames: 0, ratio: 0 });

  // Transparent output is only meaningful for alpha-capable video (WebM/VP9).
  const transparent = req.transparent === true && profile.format === "webm";
  const runnerReq: RunnerConfig = transparent
    ? {
        ...req.runner,
        resolution,
        transparent: true,
        // Blank the template's full-frame background rect so the alpha clear
        // shows through, without disturbing the user's chosen palette/colors.
        values: { ...req.runner.values, background: TRANSPARENT_BG },
      }
    : { ...req.runner, resolution };

  const runner = await TemplateRunner.create(def, runnerReq);
  try {
    const fps = profile.fps;
    // Speed compresses (>1) or stretches (<1) the output: fewer/more frames,
    // each sampling the timeline at outputTime × speed.
    const speed = req.speed && req.speed > 0 ? req.speed : 1;
    const totalFrames = Math.max(1, Math.round((runner.duration / speed) * fps));
    // Motion blur costs one render per sample, so it is opt-in and export-only.
    const motionBlur: MotionBlur | null =
      req.motionBlur === true ? MOTION_BLUR_DEFAULT : typeof req.motionBlur === "object" ? req.motionBlur : null;

    let bytes: Uint8Array;
    if (profile.format === "gif") {
      bytes = await exportGif({
        runner,
        fps,
        totalFrames,
        speed,
        ...(motionBlur ? { motionBlur } : {}),
        ...(profile.gifMaxColors !== undefined ? { maxColors: profile.gifMaxColors } : {}),
        ...(signal ? { signal } : {}),
        ...(onProgress ? { onProgress } : {}),
      });
    } else {
      const caps = await detectCapabilities({ width, height });
      const codec = profile.format === "mp4" ? caps.mp4Codec : caps.webmCodec;
      if (!codec) {
        throw new Error(
          `This browser can't encode ${profile.format.toUpperCase()} — try GIF, or WebM on Firefox.`,
        );
      }

      // Bake the motion-matched sound track offline (skipped silently if the
      // browser can't encode audio, or OfflineAudioContext is unavailable).
      const audioCodec = profile.format === "mp4" ? caps.mp4AudioCodec : caps.webmAudioCodec;
      let audio: AudioBuffer | null = null;
      if (req.sound && audioCodec) {
        // Same cue sheet and same profile the preview played, so what the user
        // heard while editing is what lands in the file.
        const sheet = cuesForTemplate(runner.def, runner.timeline, runner.timelineDuration);
        audio = await renderCuesToBuffer(trimCues(sheet.cues, runner.trim), runner.duration, {
          speed,
          profile: sheet.profile,
          ...(req.music ? { music: true } : {}),
          ...(req.soundPack ? { pack: req.soundPack } : {}),
        });
      }

      bytes = await exportVideo({
        runner,
        format: profile.format,
        codec,
        fps,
        totalFrames,
        speed,
        ...(motionBlur ? { motionBlur } : {}),
        ...(audio ? { audio, audioCodec } : {}),
        ...(transparent ? { alpha: true } : {}),
        ...(signal ? { signal } : {}),
        ...(onProgress ? { onProgress } : {}),
      });
    }

    const blob = new Blob([bytes as BlobPart], { type: MIME[profile.format] });
    return {
      blob,
      bytes,
      format: profile.format,
      width,
      height,
      fps,
      frames: totalFrames,
      filename: `jima-${def.id}-${width}x${height}.${profile.format}`,
    };
  } finally {
    runner.destroy();
  }
}

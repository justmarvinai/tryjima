import type { TemplateRunner } from "../runtime/runner";
import { readCanvasRGBA } from "./pixels";
import { encodeGif, type GifFrameData } from "./gifEncode";
import { ExportCancelledError, type ExportProgress, type MotionBlur } from "./types";
import { renderFrame } from "./frame";
import type { GifWorkerRequest, GifWorkerResponse } from "./gif.worker";

export interface GifExportArgs {
  runner: TemplateRunner;
  fps: number;
  totalFrames: number;
  /** Timeline-time = outputTime × speed (clamped to duration). Default 1. */
  speed?: number;
  maxColors?: number;
  /** Synthetic motion blur; omitted or null renders one pose per frame. */
  motionBlur?: MotionBlur | null;
  signal?: AbortSignal;
  onProgress?: (p: ExportProgress) => void;
}

/**
 * Render each frame, read its pixels, then encode a single-global-palette GIF.
 * Encoding runs in a worker when available (keeps the main thread responsive);
 * falls back to inline encoding otherwise. Deterministic either way.
 */
export async function exportGif(args: GifExportArgs): Promise<Uint8Array> {
  const { runner, fps, totalFrames, signal, onProgress } = args;
  const maxColors = args.maxColors ?? 256;
  const speed = args.speed && args.speed > 0 ? args.speed : 1;

  const frames: GifFrameData[] = [];
  let width = 0;
  let height = 0;
  const frameDur = 1 / fps;

  for (let i = 0; i < totalFrames; i++) {
    if (signal?.aborted) throw new ExportCancelledError();
    renderFrame(runner, Math.min(runner.duration, i * frameDur * speed), frameDur * speed, args.motionBlur);
    const shot = readCanvasRGBA(runner.canvas);
    width = shot.width;
    height = shot.height;
    frames.push({ rgba: shot.rgba });
    onProgress?.({ phase: "render", frame: i + 1, totalFrames, ratio: ((i + 1) / totalFrames) * 0.7 });
  }

  onProgress?.({ phase: "finalize", frame: totalFrames, totalFrames, ratio: 0.72 });
  const bytes = await encode(frames, { width, height, fps, maxColors });
  onProgress?.({ phase: "finalize", frame: totalFrames, totalFrames, ratio: 1 });
  return bytes;
}

async function encode(
  frames: GifFrameData[],
  opts: { width: number; height: number; fps: number; maxColors: number },
): Promise<Uint8Array> {
  try {
    return await encodeInWorker(frames, opts);
  } catch (err) {
    // The worker path transfers the frame buffers into the worker; if it failed
    // *after* that transfer (e.g. the module worker errored mid-encode), those
    // buffers are now detached and inline encoding would read empty data and emit
    // a corrupt GIF. Only fall back inline when the buffers are still intact — the
    // usual "no Worker available" case, where nothing was ever transferred.
    if (frames.length > 0 && frames[0]!.rgba.byteLength === 0) throw err;
    return encodeGif(frames, opts);
  }
}

function encodeInWorker(
  frames: GifFrameData[],
  opts: { width: number; height: number; fps: number; maxColors: number },
): Promise<Uint8Array> {
  if (typeof Worker === "undefined") return Promise.reject(new Error("no worker"));

  return new Promise<Uint8Array>((resolve, reject) => {
    const worker = new Worker(new URL("./gif.worker.ts", import.meta.url), { type: "module" });
    const buffers = frames.map((f) => f.rgba.buffer as ArrayBuffer);
    const req: GifWorkerRequest = {
      frames: buffers,
      width: opts.width,
      height: opts.height,
      fps: opts.fps,
      maxColors: opts.maxColors,
    };
    worker.onmessage = (e: MessageEvent<GifWorkerResponse>) => {
      worker.terminate();
      if (e.data.ok) resolve(new Uint8Array(e.data.bytes));
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(new Error(e.message || "gif worker error"));
    };
    worker.postMessage(req, buffers);
  });
}

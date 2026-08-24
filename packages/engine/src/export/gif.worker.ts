// Web Worker: GIF quantization + encoding off the main thread (ADR-005).
// Receives raw RGBA frame buffers, returns encoded GIF bytes.
import { encodeGif, type GifFrameData } from "./gifEncode";

export interface GifWorkerRequest {
  frames: ArrayBuffer[];
  width: number;
  height: number;
  fps: number;
  maxColors: number;
}
export type GifWorkerResponse =
  | { ok: true; bytes: ArrayBuffer }
  | { ok: false; error: string };

self.onmessage = (e: MessageEvent<GifWorkerRequest>) => {
  const { frames, width, height, fps, maxColors } = e.data;
  try {
    const frameData: GifFrameData[] = frames.map((buf) => ({ rgba: new Uint8Array(buf) }));
    const bytes = encodeGif(frameData, { width, height, fps, maxColors });
    const out = bytes.buffer.slice(0) as ArrayBuffer;
    const res: GifWorkerResponse = { ok: true, bytes: out };
    (self as unknown as Worker).postMessage(res, [out]);
  } catch (err) {
    const res: GifWorkerResponse = { ok: false, error: err instanceof Error ? err.message : String(err) };
    (self as unknown as Worker).postMessage(res);
  }
};

import { GIFEncoder, quantize, applyPalette } from "./gifenc";

export interface GifFrameData {
  /** RGBA pixels, length = width*height*4. */
  rgba: Uint8Array;
}

export interface GifEncodeOptions {
  width: number;
  height: number;
  fps: number;
  maxColors?: number;
}

const GIF_FORMAT = "rgb565" as const;

/**
 * Build one global palette sampled across the clip, then encode every frame
 * against it — stable colors, no per-frame flicker (docs/MOTION_ARCHITECTURE.md
 * §8.3). Pure: identical frames in → identical bytes out. gifenc's PnnQuant
 * suits flat template art (no dithering, by design).
 */
export function encodeGif(frames: GifFrameData[], opts: GifEncodeOptions): Uint8Array {
  if (frames.length === 0) throw new Error("encodeGif: no frames");
  const maxColors = Math.max(2, Math.min(256, opts.maxColors ?? 256));
  const palette = quantize(buildSample(frames), maxColors, { format: GIF_FORMAT });

  const gif = GIFEncoder();
  // Guard fps=0 (Infinity delay → corrupt GIF); the editor only sends 12/30/60.
  const delay = Math.max(1, Math.round(1000 / Math.max(1, opts.fps)));
  for (const frame of frames) {
    const index = applyPalette(frame.rgba, palette, GIF_FORMAT);
    gif.writeFrame(index, opts.width, opts.height, { palette, delay });
  }
  gif.finish();
  return gif.bytes();
}

// Concatenate a strided sample of pixels from up to 12 evenly-spaced frames to
// derive a representative global palette cheaply.
function buildSample(frames: GifFrameData[]): Uint8Array {
  const maxFrames = Math.min(12, frames.length);
  const pickStride = Math.max(1, Math.floor(frames.length / maxFrames));
  const pixelStride = 4 * 4; // every 4th pixel

  const chunks: Uint8Array[] = [];
  for (let i = 0; i < frames.length; i += pickStride) {
    const src = frames[i]!.rgba;
    const out = new Uint8Array(Math.ceil(src.length / pixelStride) * 4);
    let o = 0;
    for (let p = 0; p + 4 <= src.length; p += pixelStride) {
      out[o] = src[p]!;
      out[o + 1] = src[p + 1]!;
      out[o + 2] = src[p + 2]!;
      out[o + 3] = 255;
      o += 4;
    }
    chunks.push(out.subarray(0, o));
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const sample = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    sample.set(c, off);
    off += c.length;
  }
  return sample;
}

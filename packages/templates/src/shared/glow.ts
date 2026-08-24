import { Texture } from "pixi.js";

let cached: Texture | null = null;

/**
 * A soft radial gradient (white center → transparent edge), baked once to a
 * texture. Used as tinted Sprites for gradient "blobs" — resolution-independent
 * (unlike a BlurFilter, whose pixel strength would differ between preview and
 * export scales) and deterministic.
 */
export function radialGlowTexture(): Texture {
  if (cached) return cached;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("radialGlowTexture: no 2D context");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.45, "rgba(255,255,255,0.7)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  cached = Texture.from(canvas);
  return cached;
}

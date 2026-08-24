import { Texture } from "pixi.js";

let cached: Texture | null = null;

/**
 * Vertical gradient (transparent top → opaque bottom), baked once. Used as a
 * tinted Sprite to darken the lower part of a photo so captions stay legible.
 */
export function verticalScrimTexture(): Texture {
  if (cached) return cached;
  const w = 4;
  const h = 256;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("verticalScrimTexture: no 2D context");
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "rgba(255,255,255,0)");
  g.addColorStop(0.55, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  cached = Texture.from(canvas);
  return cached;
}

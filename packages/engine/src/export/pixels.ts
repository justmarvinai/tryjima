// Read RGBA pixels out of a (WebGL) canvas by drawing it onto a 2D scratch
// canvas. Used by the GIF path, which needs raw pixels rather than encoded
// VideoFrames. Reuses one scratch canvas per size to avoid churn.

let scratch: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; w: number; h: number } | null =
  null;

function scratchFor(width: number, height: number): CanvasRenderingContext2D {
  if (!scratch || scratch.w !== width || scratch.h !== height) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("pixels: 2D context unavailable");
    scratch = { canvas, ctx, w: width, h: height };
  }
  return scratch.ctx;
}

export function readCanvasRGBA(source: HTMLCanvasElement): {
  rgba: Uint8Array;
  width: number;
  height: number;
} {
  const width = source.width;
  const height = source.height;
  const ctx = scratchFor(width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(source, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;
  return { rgba: new Uint8Array(data.buffer.slice(0)), width, height };
}

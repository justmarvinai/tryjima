import { describe, it, expect } from "vitest";
import { encodeGif, type GifFrameData } from "./gifEncode";

function solidFrame(w: number, h: number, r: number, g: number, b: number): GifFrameData {
  const rgba = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = 255;
  }
  return { rgba };
}

const W = 8;
const H = 8;
const frames: GifFrameData[] = [
  solidFrame(W, H, 255, 77, 28), // ember
  solidFrame(W, H, 16, 16, 20), // ink
  solidFrame(W, H, 216, 243, 77), // lime
];

describe("encodeGif", () => {
  it("produces a valid GIF89a byte stream", () => {
    const bytes = encodeGif(frames, { width: W, height: H, fps: 10 });
    const header = String.fromCharCode(...bytes.slice(0, 6));
    expect(header).toBe("GIF89a");
    // trailer byte 0x3B
    expect(bytes[bytes.length - 1]).toBe(0x3b);
    expect(bytes.length).toBeGreaterThan(20);
  });

  it("is deterministic — identical frames in, identical bytes out", () => {
    const a = encodeGif(frames, { width: W, height: H, fps: 10, maxColors: 64 });
    const b = encodeGif(frames, { width: W, height: H, fps: 10, maxColors: 64 });
    expect(Array.from(a)).toEqual(Array.from(b));
  });

  it("throws on empty input", () => {
    expect(() => encodeGif([], { width: W, height: H, fps: 10 })).toThrow();
  });
});

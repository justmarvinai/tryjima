// Typed shim over the untyped `gifenc` package (it ships no declarations).
// A normal module (not an ambient .d.ts) so the types travel with the import
// wherever the engine is compiled — including from consumer packages.

// @ts-expect-error gifenc ships no type declarations
import * as gifencRaw from "gifenc";

export type GifPalette = number[][];
export type GifFormat = "rgb565" | "rgb444" | "rgba4444";

export interface QuantizeOptions {
  format?: GifFormat;
  oneBitAlpha?: boolean | number;
  clearAlpha?: boolean;
}
export interface WriteFrameOptions {
  palette?: GifPalette;
  first?: boolean;
  transparent?: boolean | number;
  delay?: number;
  repeat?: number;
  dispose?: number;
}
export interface GifEncoderInstance {
  writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void;
  finish(): void;
  bytes(): Uint8Array;
}

const raw = gifencRaw as {
  quantize: (
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: QuantizeOptions,
  ) => GifPalette;
  applyPalette: (
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: GifFormat,
  ) => Uint8Array;
  GIFEncoder: () => GifEncoderInstance;
};

export const quantize = raw.quantize;
export const applyPalette = raw.applyPalette;
export const GIFEncoder = raw.GIFEncoder;

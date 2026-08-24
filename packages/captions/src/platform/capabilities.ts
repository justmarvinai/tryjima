/**
 * Startup capability detection. Jima runs entirely in the browser and leans on
 * a few modern APIs — this module probes for them once so the UI can show an
 * honest "your browser can't do this yet" screen instead of failing mid-export.
 *
 * Hard requirements (export won't work without them):
 *   - WebCodecs VideoEncoder / VideoDecoder  (Chromium ≥ 113)
 *   - OffscreenCanvas
 *   - Web Workers
 *
 * Soft / informational:
 *   - WebGPU  (fast transcription; WASM is the fallback)
 *   - SharedArrayBuffer (fast multithreaded WASM; needs cross-origin isolation)
 */

export interface CapabilityReport {
  webCodecs: boolean;
  offscreenCanvas: boolean;
  workers: boolean;
  webGPU: boolean;
  wasm: boolean;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  /** Everything required to run the full pipeline through export. */
  canRun: boolean;
}

function hasWebCodecs(): boolean {
  return (
    typeof globalThis.VideoEncoder === 'function' &&
    typeof globalThis.VideoDecoder === 'function' &&
    typeof globalThis.VideoFrame === 'function' &&
    typeof globalThis.EncodedVideoChunk === 'function'
  );
}

function hasOffscreenCanvas(): boolean {
  return typeof globalThis.OffscreenCanvas === 'function';
}

function hasWorkers(): boolean {
  return typeof globalThis.Worker === 'function';
}

function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

function hasWasm(): boolean {
  return typeof globalThis.WebAssembly === 'object';
}

function hasSharedArrayBuffer(): boolean {
  return typeof globalThis.SharedArrayBuffer === 'function';
}

export function detectCapabilities(): CapabilityReport {
  const webCodecs = hasWebCodecs();
  const offscreenCanvas = hasOffscreenCanvas();
  const workers = hasWorkers();
  const wasm = hasWasm();

  return {
    webCodecs,
    offscreenCanvas,
    workers,
    webGPU: hasWebGPU(),
    wasm,
    sharedArrayBuffer: hasSharedArrayBuffer(),
    crossOriginIsolated:
      typeof globalThis.crossOriginIsolated === 'boolean'
        ? globalThis.crossOriginIsolated
        : false,
    canRun: webCodecs && offscreenCanvas && workers && wasm,
  };
}

/** Human-readable list of what's missing, for the unsupported screen. */
export function missingRequirements(report: CapabilityReport): string[] {
  const missing: string[] = [];
  if (!report.webCodecs) missing.push('WebCodecs (video encoding)');
  if (!report.offscreenCanvas) missing.push('OffscreenCanvas');
  if (!report.workers) missing.push('Web Workers');
  if (!report.wasm) missing.push('WebAssembly');
  return missing;
}

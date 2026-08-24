import { describe, it, expect } from 'vitest';
import { detectCapabilities, missingRequirements } from './capabilities';

describe('detectCapabilities', () => {
  it('returns a report with all expected keys', () => {
    const report = detectCapabilities();
    expect(report).toMatchObject({
      webCodecs: expect.any(Boolean),
      offscreenCanvas: expect.any(Boolean),
      workers: expect.any(Boolean),
      webGPU: expect.any(Boolean),
      wasm: expect.any(Boolean),
      sharedArrayBuffer: expect.any(Boolean),
      crossOriginIsolated: expect.any(Boolean),
      canRun: expect.any(Boolean),
    });
  });

  it('canRun is true only when every hard requirement is met', () => {
    const report = detectCapabilities();
    const expected =
      report.webCodecs && report.offscreenCanvas && report.workers && report.wasm;
    expect(report.canRun).toBe(expected);
  });
});

describe('missingRequirements', () => {
  it('lists nothing when all hard requirements are present', () => {
    const full = {
      webCodecs: true,
      offscreenCanvas: true,
      workers: true,
      webGPU: true,
      wasm: true,
      sharedArrayBuffer: true,
      crossOriginIsolated: true,
      canRun: true,
    };
    expect(missingRequirements(full)).toEqual([]);
  });

  it('names each missing hard requirement', () => {
    const none = {
      webCodecs: false,
      offscreenCanvas: false,
      workers: false,
      webGPU: false,
      wasm: false,
      sharedArrayBuffer: false,
      crossOriginIsolated: false,
      canRun: false,
    };
    const missing = missingRequirements(none);
    expect(missing).toHaveLength(4);
    expect(missing.join(' ')).toMatch(/WebCodecs/);
    expect(missing.join(' ')).toMatch(/OffscreenCanvas/);
    expect(missing.join(' ')).toMatch(/Workers/);
    expect(missing.join(' ')).toMatch(/WebAssembly/);
  });
});

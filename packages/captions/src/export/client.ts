import type { Cue } from '../captions/types';
import type { CaptionStyle } from '../captions/style';
import type { AudioMode, ExportPhase, ExportResponse } from './protocol';

export interface ExportCallbacks {
  onPhase?: (phase: ExportPhase) => void;
  onProgress?: (fraction: number) => void;
}

export interface ExportResult {
  blob: Blob;
  audio: AudioMode;
}

/** Thrown into the run's promise when `cancel()` is called. */
export class CancelledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CancelledError';
  }
}

export interface ExportHandle {
  promise: Promise<ExportResult>;
  /** Abort and tear down the worker. */
  cancel: () => void;
}

/**
 * Runs an export in a dedicated worker. Resolves with the output Blob. The
 * worker is always terminated when the run settles or is cancelled.
 */
export function exportVideo(
  file: File,
  cues: Cue[],
  style: CaptionStyle,
  callbacks: ExportCallbacks = {},
): ExportHandle {
  const worker = new Worker(new URL('./export.worker.ts', import.meta.url), {
    type: 'module',
    name: 'jima-export',
  });

  let settled = false;
  let rejectRun: (reason: unknown) => void = () => undefined;

  const promise = new Promise<ExportResult>((resolve, reject) => {
    rejectRun = reject;
    const finish = (fn: () => void) => {
      settled = true;
      worker.terminate();
      fn();
    };

    worker.onmessage = (event: MessageEvent<ExportResponse>) => {
      const message = event.data;
      switch (message.type) {
        case 'phase':
          callbacks.onPhase?.(message.phase);
          break;
        case 'progress':
          callbacks.onProgress?.(message.progress);
          break;
        case 'done':
          finish(() =>
            resolve({ blob: new Blob([message.buffer], { type: message.mimeType }), audio: message.audio }),
          );
          break;
        case 'error':
          finish(() => reject(new Error(message.message)));
          break;
      }
    };

    worker.onerror = (event) => {
      if (settled) return;
      finish(() => reject(new Error(event.message || 'The export worker crashed.')));
    };
  });

  worker.postMessage({ type: 'export', file, cues, style });

  const cancel = () => {
    if (settled) return;
    settled = true;
    worker.terminate();
    // Settle the promise. Terminating the worker alone left it pending FOREVER,
    // so the `await` in the calling action never returned, its `finally` never
    // ran, and the whole closure — file, cues, callbacks — was retained for the
    // life of the page. The doc comment claimed this already happened.
    rejectRun(new CancelledError('export cancelled'));
  };

  return { promise, cancel };
}

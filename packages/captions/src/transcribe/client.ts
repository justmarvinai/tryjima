import type { Word } from '../captions/types';
import type { Language, TranscribeDevice, WhisperResponse } from './protocol';

export interface TranscribeCallbacks {
  /** Model download progress, 0..1, aggregated across all model files. */
  onModelProgress?: (fraction: number) => void;
  /** Stage transitions, with the device actually in use. */
  onStatus?: (stage: 'loading-model' | 'transcribing', device: TranscribeDevice) => void;
}

export interface TranscribeResult {
  words: Word[];
  detectedLanguage: 'en' | 'de';
}

/** Thrown into the run's promise when `cancel()` is called. */
export class CancelledError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CancelledError';
  }
}

export interface TranscribeHandle {
  promise: Promise<TranscribeResult>;
  /** Abort and tear down the worker. Rejects the promise if still pending. */
  cancel: () => void;
}

/**
 * Runs a transcription in a fresh Whisper worker. The audio buffer is
 * transferred (not copied). The worker is always terminated when the run
 * settles or is cancelled — nothing lingers in memory.
 */
export function transcribe(
  audio: Float32Array,
  language: Language,
  callbacks: TranscribeCallbacks = {},
): TranscribeHandle {
  const worker = new Worker(new URL('./whisper.worker.ts', import.meta.url), {
    type: 'module',
    name: 'jima-whisper',
  });

  const perFile = new Map<string, { loaded: number; total: number }>();
  let settled = false;
  let rejectRun: (reason: unknown) => void = () => undefined;

  const promise = new Promise<TranscribeResult>((resolve, reject) => {
    rejectRun = reject;
    const finish = (fn: () => void) => {
      settled = true;
      worker.terminate();
      fn();
    };

    worker.onmessage = (event: MessageEvent<WhisperResponse>) => {
      const message = event.data;
      switch (message.type) {
        case 'model-progress': {
          perFile.set(message.file, { loaded: message.loaded, total: message.total });
          let loaded = 0;
          let total = 0;
          for (const entry of perFile.values()) {
            loaded += entry.loaded;
            total += entry.total;
          }
          callbacks.onModelProgress?.(total > 0 ? loaded / total : 0);
          break;
        }
        case 'status':
          callbacks.onStatus?.(message.stage, message.device);
          break;
        case 'done':
          finish(() => resolve({ words: message.words, detectedLanguage: message.detectedLanguage }));
          break;
        case 'error':
          finish(() => reject(new Error(message.message)));
          break;
      }
    };

    worker.onerror = (event) => {
      if (settled) return;
      finish(() => reject(new Error(event.message || 'The transcription worker crashed.')));
    };
  });

  worker.postMessage({ type: 'transcribe', audio, language }, [audio.buffer]);

  const cancel = () => {
    if (settled) return;
    settled = true;
    worker.terminate();
    // Settle the promise. Terminating the worker alone left it pending FOREVER,
    // so the `await` in the calling action never returned, its `finally` never
    // ran, and the whole closure — file, cues, callbacks — was retained for the
    // life of the page. The doc comment claimed this already happened.
    rejectRun(new CancelledError('transcription cancelled'));
  };

  return { promise, cancel };
}

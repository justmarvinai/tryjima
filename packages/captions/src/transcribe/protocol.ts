import type { Word } from '../captions/types';

/** Transcription language choice. `auto` lets Whisper detect it. */
export type Language = 'auto' | 'en' | 'de';

/** Compute device actually used by the worker. */
export type TranscribeDevice = 'webgpu' | 'wasm';

// ── main thread → worker ───────────────────────────────────────────────
export type WhisperRequest = {
  type: 'transcribe';
  /** 16 kHz mono PCM. Transferred, not copied. */
  audio: Float32Array;
  language: Language;
};

// ── worker → main thread ───────────────────────────────────────────────
export type WhisperResponse =
  | { type: 'model-progress'; file: string; loaded: number; total: number }
  | { type: 'status'; stage: 'loading-model' | 'transcribing'; device: TranscribeDevice }
  | { type: 'done'; words: Word[]; detectedLanguage: 'en' | 'de' }
  | { type: 'error'; message: string };

/** Map our language code to the name transformers.js expects (undefined = auto-detect). */
export function toWhisperLanguage(language: Language): 'english' | 'german' | undefined {
  switch (language) {
    case 'en':
      return 'english';
    case 'de':
      return 'german';
    case 'auto':
      return undefined;
  }
}

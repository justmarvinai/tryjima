import type { StateCreator } from 'zustand';
import type { AppStore } from './store';
import type { Cue, Word } from '@jima/captions/captions';
import type { Language, TranscribeDevice } from '@jima/captions/transcribe';
import { extractAudioForWhisper } from '@jima/captions/transcribe';
import { transcribe, type TranscribeHandle } from '@jima/captions/transcribe';
import { groupTranscript } from '@jima/captions/captions';

export type TranscriptionStatus =
  | 'idle'
  | 'extracting'
  | 'loading-model'
  | 'transcribing'
  | 'done'
  | 'error';

export interface TranscriptionState {
  status: TranscriptionStatus;
  device: TranscribeDevice | null;
  /** Model download progress, 0..1 (only meaningful while loading-model). */
  modelProgress: number;
  /** User's language choice. */
  language: Language;
  /** Language actually used/detected, surfaced after a run. */
  detectedLanguage: 'en' | 'de' | null;
  /** Raw word stream from Whisper (kept for re-grouping in later phases). */
  words: Word[];
  cues: Cue[];
  error: string | null;
}

export interface TranscriptionSlice {
  transcription: TranscriptionState;
  setLanguage: (language: Language) => void;
  startTranscription: () => Promise<void>;
  cancelTranscription: () => void;
  resetTranscription: () => void;
}

const initialTranscription: TranscriptionState = {
  status: 'idle',
  device: null,
  modelProgress: 0,
  language: 'auto',
  detectedLanguage: null,
  words: [],
  cues: [],
  error: null,
};

/** The in-flight run, if any. Module-scoped so actions can cancel it. */
let activeHandle: TranscribeHandle | null = null;

export const createTranscriptionSlice: StateCreator<AppStore, [], [], TranscriptionSlice> = (
  set,
  get,
) => ({
  transcription: initialTranscription,

  setLanguage: (language) =>
    set((s) => ({ transcription: { ...s.transcription, language } })),

  resetTranscription: () => {
    activeHandle?.cancel();
    activeHandle = null;
    // Preserve the user's language choice across resets.
    set((s) => ({
      transcription: { ...initialTranscription, language: s.transcription.language },
      cueHistory: { past: [], future: [] },
    }));
  },

  cancelTranscription: () => {
    activeHandle?.cancel();
    activeHandle = null;
    set((s) => ({
      transcription: { ...s.transcription, status: 'idle', modelProgress: 0, device: null, error: null },
    }));
  },

  startTranscription: async () => {
    const file = get().project.file;
    if (!file) return;
    const { language } = get().transcription;

    set((s) => ({
      transcription: { ...initialTranscription, language: s.transcription.language, status: 'extracting' },
    }));

    let audio: Float32Array;
    try {
      audio = await extractAudioForWhisper(file);
    } catch {
      set((s) => ({
        transcription: {
          ...s.transcription,
          status: 'error',
          error: "Jima couldn't read this video's audio.",
        },
      }));
      return;
    }

    const handle = transcribe(audio, language, {
      onModelProgress: (fraction) =>
        set((s) => ({ transcription: { ...s.transcription, modelProgress: fraction } })),
      onStatus: (stage, device) =>
        set((s) => ({ transcription: { ...s.transcription, status: stage, device } })),
    });
    activeHandle = handle;

    try {
      const { words, detectedLanguage } = await handle.promise;
      if (activeHandle !== handle) return; // cancelled or superseded
      const cues = groupTranscript(words);
      set((s) => ({
        transcription: {
          ...s.transcription,
          status: 'done',
          words,
          cues,
          detectedLanguage,
          modelProgress: 1,
        },
        // Fresh transcript — start editing history clean.
        cueHistory: { past: [], future: [] },
      }));
    } catch (error) {
      if (activeHandle !== handle) return;
      set((s) => ({
        transcription: {
          ...s.transcription,
          status: 'error',
          error: error instanceof Error ? error.message : 'Transcription failed.',
        },
      }));
    } finally {
      if (activeHandle === handle) activeHandle = null;
    }
  },
});

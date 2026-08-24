import type { StateCreator } from 'zustand';
import type { AppStore } from './store';
import type { Cue } from '@jima/captions/captions';
import { mergeCues, nudgeCue, retimeCueText, splitCue } from '@jima/captions/captions';
import { removeFillerWords } from '@jima/captions/captions';

const HISTORY_LIMIT = 50;

export interface CueHistory {
  past: Cue[][];
  future: Cue[][];
}

export interface EditingSlice {
  cueHistory: CueHistory;
  /** Edit a cue's text; re-times its words. Empty text deletes the cue. */
  updateCueText: (id: string, text: string) => void;
  deleteCue: (id: string) => void;
  mergeCueWithNext: (id: string) => void;
  /** Split a cue before the given word index. */
  splitCueAtWord: (id: string, wordIndex: number) => void;
  nudgeCueTime: (id: string, field: 'start' | 'end', delta: number) => void;
  /** Strip filler words ("um", "äh", …) from every cue. Undoable. */
  removeFillers: () => void;
  undo: () => void;
  redo: () => void;
}

export const createEditingSlice: StateCreator<AppStore, [], [], EditingSlice> = (set, get) => {
  /** Apply a new cue array, pushing the current one onto the undo stack. */
  const commit = (nextCues: Cue[]) => {
    const current = get().transcription.cues;
    set((s) => ({
      transcription: { ...s.transcription, cues: nextCues },
      cueHistory: {
        past: [...s.cueHistory.past, current].slice(-HISTORY_LIMIT),
        future: [],
      },
    }));
  };

  const indexOf = (id: string) => get().transcription.cues.findIndex((c) => c.id === id);

  return {
    cueHistory: { past: [], future: [] },

    updateCueText: (id, text) => {
      const cues = get().transcription.cues;
      const next = cues.flatMap((c) => {
        if (c.id !== id) return [c];
        const words = retimeCueText(c, text);
        return words.length === 0 ? [] : [{ ...c, words }];
      });
      commit(next);
    },

    deleteCue: (id) => {
      commit(get().transcription.cues.filter((c) => c.id !== id));
    },

    mergeCueWithNext: (id) => {
      const cues = get().transcription.cues;
      const i = indexOf(id);
      if (i < 0 || i >= cues.length - 1) return;
      const cue = cues[i];
      const next = cues[i + 1];
      if (!cue || !next) return;
      const merged = mergeCues(cue, next);
      commit([...cues.slice(0, i), merged, ...cues.slice(i + 2)]);
    },

    splitCueAtWord: (id, wordIndex) => {
      const cues = get().transcription.cues;
      const i = indexOf(id);
      const cue = cues[i];
      if (!cue || cue.words.length < 2) return;
      const [a, b] = splitCue(cue, wordIndex);
      commit([...cues.slice(0, i), a, b, ...cues.slice(i + 1)]);
    },

    nudgeCueTime: (id, field, delta) => {
      const cues = get().transcription.cues;
      const i = indexOf(id);
      const cue = cues[i];
      if (!cue) return;
      const prev = cues[i - 1];
      const next = cues[i + 1];
      const bounds: { min: number; max?: number } = { min: prev ? prev.end : 0 };
      if (next) bounds.max = next.start;
      const nudged = nudgeCue(cue, field, delta, bounds);
      commit([...cues.slice(0, i), nudged, ...cues.slice(i + 1)]);
    },

    removeFillers: () => {
      const { cues, removed } = removeFillerWords(get().transcription.cues);
      if (removed === 0) return; // nothing to do — don't pollute the undo history
      commit(cues);
    },

    undo: () => {
      const { past, future } = get().cueHistory;
      if (past.length === 0) return;
      const current = get().transcription.cues;
      const previous = past[past.length - 1];
      if (!previous) return;
      set((s) => ({
        transcription: { ...s.transcription, cues: previous },
        cueHistory: {
          past: past.slice(0, -1),
          future: [current, ...future].slice(0, HISTORY_LIMIT),
        },
      }));
    },

    redo: () => {
      const { past, future } = get().cueHistory;
      if (future.length === 0) return;
      const current = get().transcription.cues;
      const restored = future[0];
      if (!restored) return;
      set((s) => ({
        transcription: { ...s.transcription, cues: restored },
        cueHistory: {
          past: [...past, current].slice(-HISTORY_LIMIT),
          future: future.slice(1),
        },
      }));
    },
  };
};

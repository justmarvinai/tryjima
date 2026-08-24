import { create } from 'zustand';
import { createProjectSlice, type ProjectSlice } from './projectSlice';
import { createTranscriptionSlice, type TranscriptionSlice } from './transcriptionSlice';
import { createStyleSlice, type StyleSlice } from './styleSlice';
import { createPlaybackSlice, type PlaybackSlice } from './playbackSlice';
import { createEditingSlice, type EditingSlice } from './editingSlice';
import { createExportSlice, type ExportSlice } from './exportSlice';
import { drawCaptions } from '@jima/captions/captions';
import {
  loadStoredStyle,
  saveStoredStyle,
  loadStoredLanguage,
  saveStoredLanguage,
} from '@jima/captions/captions';

/** Single app store, composed from slices. */
export type AppStore = ProjectSlice &
  TranscriptionSlice &
  StyleSlice &
  PlaybackSlice &
  EditingSlice &
  ExportSlice;

export const useAppStore = create<AppStore>()((...args) => ({
  ...createProjectSlice(...args),
  ...createTranscriptionSlice(...args),
  ...createStyleSlice(...args),
  ...createPlaybackSlice(...args),
  ...createEditingSlice(...args),
  ...createExportSlice(...args),
}));

// ── Preference persistence (style + language only — never content) ─────
if (typeof window !== 'undefined') {
  const storedStyle = loadStoredStyle();
  if (storedStyle) useAppStore.setState({ style: storedStyle });
  const storedLanguage = loadStoredLanguage();
  if (storedLanguage) {
    useAppStore.setState((s) => ({ transcription: { ...s.transcription, language: storedLanguage } }));
  }

  let prevStyle = useAppStore.getState().style;
  let prevLanguage = useAppStore.getState().transcription.language;
  useAppStore.subscribe((state) => {
    if (state.style !== prevStyle) {
      prevStyle = state.style;
      saveStoredStyle(state.style);
    }
    if (state.transcription.language !== prevLanguage) {
      prevLanguage = state.transcription.language;
      saveStoredLanguage(state.transcription.language);
    }
  });
}

// E2E hook: expose the store (and the shared renderer) only when the page is
// opened with `?__e2e`, so tests can drive it — inject cues, exercise the
// export-composite path — without shipping a global in normal use.
if (typeof window !== 'undefined' && window.location?.search.includes('__e2e')) {
  (
    window as unknown as { __JIMA__?: { store: typeof useAppStore; drawCaptions: typeof drawCaptions } }
  ).__JIMA__ = { store: useAppStore, drawCaptions };
}

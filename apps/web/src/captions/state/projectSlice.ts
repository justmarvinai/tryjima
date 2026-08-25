import type { StateCreator } from 'zustand';
import type { AppStore } from './store';
import { acceptVideo } from '@jima/captions/video';
import type { ValidationError, VideoMetadata } from '@jima/captions/video';

export type ProjectStatus = 'empty' | 'validating' | 'ready' | 'error';

export interface ProjectState {
  status: ProjectStatus;
  file: File | null;
  /** Object URL for the preview <video>. Owned by the store; revoked on reset/replace. */
  objectUrl: string | null;
  metadata: VideoMetadata | null;
  error: ValidationError | null;
}

export interface ProjectSlice {
  project: ProjectState;
  /** Validate + probe a file, then move to `ready` or `error`. */
  loadFile: (file: File) => Promise<void>;
  /** Clear the current project and free its object URL. */
  resetProject: () => void;
}

const emptyProject: ProjectState = {
  status: 'empty',
  file: null,
  objectUrl: null,
  metadata: null,
  error: null,
};

export const createProjectSlice: StateCreator<AppStore, [], [], ProjectSlice> = (set, get) => ({
  project: emptyProject,

  loadFile: async (file) => {
    const previousUrl = get().project.objectUrl;
    if (previousUrl) URL.revokeObjectURL(previousUrl);

    // A new video invalidates any existing transcript — and the previous
    // clip's transport. Leaving `playback` alone meant the new video mounted
    // carrying the old one's duration, playhead and (worst) its `seekTarget`,
    // so it jumped straight to whatever cue was last clicked in the old clip.
    get().resetTranscription();
    get().resetPlayback();

    set({ project: { ...emptyProject, status: 'validating', file } });

    const result = await acceptVideo(file);

    // A newer file may have been dropped while this one was probing — if so,
    // discard this (now stale) result.
    if (get().project.file !== file) return;

    if (!result.ok) {
      set({ project: { ...emptyProject, status: 'error', error: result.error } });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    set({
      project: { status: 'ready', file, objectUrl, metadata: result.metadata, error: null },
    });
  },

  resetProject: () => {
    const previousUrl = get().project.objectUrl;
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    get().resetTranscription();
    get().resetPlayback();
    get().dismissExport();
    set({ project: emptyProject });
  },
});

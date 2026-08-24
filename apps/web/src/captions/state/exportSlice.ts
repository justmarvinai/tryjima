import type { StateCreator } from 'zustand';
import type { AppStore } from './store';
import { exportVideo, type ExportHandle } from '@jima/captions/export';
import { outputFileName } from '@jima/captions/export';
import type { AudioMode, ExportPhase } from '@jima/captions/export';

export type ExportStatus = 'idle' | ExportPhase | 'done' | 'error';

export interface ExportState {
  status: ExportStatus;
  progress: number;
  audio: AudioMode | null;
  resultUrl: string | null;
  fileName: string | null;
  error: string | null;
}

export interface ExportSlice {
  exportState: ExportState;
  startExport: () => Promise<void>;
  cancelExport: () => void;
  /** Close the dialog and free the result URL. */
  dismissExport: () => void;
}

const initialExport: ExportState = {
  status: 'idle',
  progress: 0,
  audio: null,
  resultUrl: null,
  fileName: null,
  error: null,
};

let activeHandle: ExportHandle | null = null;

export const createExportSlice: StateCreator<AppStore, [], [], ExportSlice> = (set, get) => ({
  exportState: initialExport,

  startExport: async () => {
    const file = get().project.file;
    const cues = get().transcription.cues;
    const style = get().style;
    if (!file || cues.length === 0) return;

    // Free any previous result.
    const prevUrl = get().exportState.resultUrl;
    if (prevUrl) URL.revokeObjectURL(prevUrl);

    set({ exportState: { ...initialExport, status: 'preparing' } });

    const handle = exportVideo(file, cues, style, {
      onPhase: (phase) => set((s) => ({ exportState: { ...s.exportState, status: phase } })),
      onProgress: (progress) => set((s) => ({ exportState: { ...s.exportState, progress } })),
    });
    activeHandle = handle;

    try {
      const { blob, audio } = await handle.promise;
      if (activeHandle !== handle) return; // cancelled/superseded
      const resultUrl = URL.createObjectURL(blob);
      set((s) => ({
        exportState: {
          ...s.exportState,
          status: 'done',
          progress: 1,
          audio,
          resultUrl,
          fileName: outputFileName(file.name),
        },
      }));
    } catch (error) {
      if (activeHandle !== handle) return;
      set((s) => ({
        exportState: {
          ...s.exportState,
          status: 'error',
          error: error instanceof Error ? error.message : 'Export failed.',
        },
      }));
    } finally {
      if (activeHandle === handle) activeHandle = null;
    }
  },

  cancelExport: () => {
    activeHandle?.cancel();
    activeHandle = null;
    set({ exportState: initialExport });
  },

  dismissExport: () => {
    const prevUrl = get().exportState.resultUrl;
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    activeHandle?.cancel();
    activeHandle = null;
    set({ exportState: initialExport });
  },
});

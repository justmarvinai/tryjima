import type { StateCreator } from 'zustand';
import type { AppStore } from './store';

export interface PlaybackState {
  currentTime: number;
  duration: number;
  playing: boolean;
  /** Seek target the video element should jump to. */
  seekTarget: number | null;
  /** Bumped on each seek request so the video effect re-fires even to the same time. */
  seekNonce: number;
}

export interface PlaybackSlice {
  playback: PlaybackState;
  /** Called by the video element to mirror its state into the store. */
  setPlayback: (patch: Partial<Omit<PlaybackState, 'seekTarget' | 'seekNonce'>>) => void;
  /** Request the video jump to `time` (used by click-to-seek in the transcript). */
  seekTo: (time: number) => void;
}

const initialPlayback: PlaybackState = {
  currentTime: 0,
  duration: 0,
  playing: false,
  seekTarget: null,
  seekNonce: 0,
};

export const createPlaybackSlice: StateCreator<AppStore, [], [], PlaybackSlice> = (set) => ({
  playback: initialPlayback,

  setPlayback: (patch) => set((s) => ({ playback: { ...s.playback, ...patch } })),

  seekTo: (time) =>
    set((s) => ({
      playback: {
        ...s.playback,
        seekTarget: Math.max(0, time),
        seekNonce: s.playback.seekNonce + 1,
        currentTime: Math.max(0, time),
      },
    })),
});

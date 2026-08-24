import type { StateCreator } from 'zustand';
import type { AppStore } from './store';
import { DEFAULT_CAPTION_STYLE, type CaptionStyle } from '@jima/captions/captions';

export interface StyleSlice {
  style: CaptionStyle;
  setStyle: (patch: Partial<CaptionStyle>) => void;
  resetStyle: () => void;
}

export const createStyleSlice: StateCreator<AppStore, [], [], StyleSlice> = (set) => ({
  style: DEFAULT_CAPTION_STYLE,
  setStyle: (patch) => set((s) => ({ style: { ...s.style, ...patch } })),
  resetStyle: () => set({ style: DEFAULT_CAPTION_STYLE }),
});

import type { Cue } from '../captions/types';
import type { CaptionStyle } from '../captions/style';

/** How the audio track was handled in the output. */
export type AudioMode = 'passthrough' | 'reencoded' | 'none';

export type ExportPhase = 'preparing' | 'encoding' | 'finalizing';

// main → worker
export type ExportRequest = {
  type: 'export';
  file: File;
  cues: Cue[];
  style: CaptionStyle;
};

// worker → main
export type ExportResponse =
  | { type: 'phase'; phase: ExportPhase }
  | { type: 'progress'; progress: number } // 0..1
  | { type: 'done'; buffer: ArrayBuffer; mimeType: string; audio: AudioMode }
  | { type: 'error'; message: string };

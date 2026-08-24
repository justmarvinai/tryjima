import { useAppStore } from '../../state/store';
import { Button } from '@/ui';
import { LanguageSelector } from './LanguageSelector';
import { TranscriptionProgress } from './TranscriptionProgress';
import { EditableTranscript } from './EditableTranscript';
import { languageLabel } from '@jima/captions/transcribe';
import { useUndoRedoShortcuts } from '../../hooks/useUndoRedoShortcuts';
import { countFillerWords } from '@jima/captions/captions';
import { toSrt, toVtt, subtitleFileName, downloadTextFile } from '@jima/captions/captions';

/**
 * Left-panel transcript flow: choose a language and generate captions, watch
 * progress, then edit the resulting cues (seek, retext, retime, merge, split,
 * delete) with undo/redo.
 */
export function TranscriptPanel() {
  useUndoRedoShortcuts();

  const status = useAppStore((s) => s.transcription.status);
  const error = useAppStore((s) => s.transcription.error);
  const detected = useAppStore((s) => s.transcription.detectedLanguage);
  const cueCount = useAppStore((s) => s.transcription.cues.length);
  const startTranscription = useAppStore((s) => s.startTranscription);
  const cancelTranscription = useAppStore((s) => s.cancelTranscription);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.cueHistory.past.length > 0);
  const canRedo = useAppStore((s) => s.cueHistory.future.length > 0);
  const cues = useAppStore((s) => s.transcription.cues);
  const removeFillers = useAppStore((s) => s.removeFillers);
  const videoName = useAppStore((s) => s.project.file?.name ?? 'captions.mp4');

  const running = status === 'extracting' || status === 'loading-model' || status === 'transcribing';
  const fillerCount = status === 'done' ? countFillerWords(cues) : 0;

  const downloadSubtitles = (ext: 'srt' | 'vtt') => {
    const contents = ext === 'srt' ? toSrt(cues) : toVtt(cues);
    downloadTextFile(subtitleFileName(videoName, ext), contents, 'text/plain;charset=utf-8');
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-[13px] font-semibold text-chalk">Transcript</p>
        {status === 'done' && (
          <div className="flex items-center gap-1">
            <HistoryButton label="Undo" disabled={!canUndo} onClick={undo}>
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h11a5 5 0 0 1 0 10h-1" />
            </HistoryButton>
            <HistoryButton label="Redo" disabled={!canRedo} onClick={redo}>
              <path d="m15 14 5-5-5-5" />
              <path d="M20 9H9a5 5 0 0 0 0 10h1" />
            </HistoryButton>
            <span className="ml-1 font-mono text-[11px] text-dim">
              {cueCount} · {languageLabel(detected)}
            </span>
          </div>
        )}
      </div>

      <div className="panel-scroll min-h-0 flex-1 overflow-y-auto py-2">
        <div className="px-2">
          {status === 'idle' && (
            <div className="space-y-4 p-2">
              <p className="text-sm leading-relaxed text-dim">
                Pick the spoken language, then generate captions. The AI model runs
                entirely in your browser.
              </p>
              <LanguageSelector />
              <Button onClick={() => void startTranscription()} className="w-full">
                Generate captions
              </Button>
              <p className="text-xs leading-relaxed text-dim">
                First run downloads the model once (~a minute on a typical
                connection). After that it’s instant and offline.
              </p>
            </div>
          )}

          {running && (
            <div className="space-y-4 p-2">
              <TranscriptionProgress />
              <Button variant="secondary" onClick={cancelTranscription} className="w-full">
                Cancel
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="space-y-4 p-2">
              <div
                role="alert"
                className="rounded-input border border-error/25 bg-error/[0.04] px-4 py-3 text-sm text-error"
              >
                {error ?? 'Something went wrong during transcription.'}
              </div>
              <LanguageSelector />
              <Button onClick={() => void startTranscription()} className="w-full">
                Try again
              </Button>
            </div>
          )}
        </div>

        {status === 'done' && (
          <>
            {fillerCount > 0 && (
              <div className="mx-2 mb-2 px-2">
                <button
                  type="button"
                  onClick={removeFillers}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-lime/40 bg-lime-tint/40 px-3 py-2 text-[13px] font-semibold text-lime transition-colors hover:bg-lime-tint"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
                  </svg>
                  Remove {fillerCount} filler word{fillerCount === 1 ? '' : 's'}
                </button>
              </div>
            )}

            <EditableTranscript />

            {cueCount > 0 && (
              <div className="mx-2 mt-2 flex items-center justify-between rounded-xl bg-surface-2/70 px-4 py-2.5">
                <span className="text-[12px] font-medium text-dim">Captions file</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => downloadSubtitles('srt')}
                    className="rounded-full bg-surface px-3 py-1 text-[12px] font-semibold text-chalk shadow-xs transition-colors hover:text-lime"
                  >
                    .srt
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadSubtitles('vtt')}
                    className="rounded-full bg-surface px-3 py-1 text-[12px] font-semibold text-chalk shadow-xs transition-colors hover:text-lime"
                  >
                    .vtt
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function HistoryButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-dim transition-colors hover:bg-surface-2 hover:text-chalk disabled:pointer-events-none disabled:opacity-30"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}

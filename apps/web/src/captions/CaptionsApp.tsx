import { useEffect } from 'react';
import { missingRequirements } from '@jima/captions/platform';
import { languageLabel } from '@jima/captions/transcribe';
import { Button, IconButton, DownloadIcon, UndoIcon, RedoIcon } from '@/ui';
import { ToolBar, ToolBarChip } from '@/shell/ToolBar';
import { CapabilityFloor } from '@/shell/CapabilityFloor';
import { Dropzone } from './components/upload/Dropzone';
import { VideoStage } from './components/preview/VideoStage';
import { TranscriptPanel } from './components/transcribe/TranscriptPanel';
import { StylePanel } from './components/style/StylePanel';
import { ExportDialog } from './components/export/ExportDialog';
import { useCaptionCapabilities } from './hooks/useCaptionCapabilities';
import { useAppStore } from './state/store';

/**
 * Jima Captions — the editor shell.
 *
 * Dark chrome, three panes, and one bright thing in the middle: the video. The
 * transcript sits left (you read it top-to-bottom while the clip plays) and
 * style sits right (you change it and watch the centre react). Both panes
 * collapse below `lg`, where the stage is all there is room for.
 */
export function CaptionsApp() {
  const caps = useCaptionCapabilities();
  const status = useAppStore((s) => s.project.status);
  const file = useAppStore((s) => s.project.file);
  const resetProject = useAppStore((s) => s.resetProject);
  const language = useAppStore((s) => s.transcription.language);
  const detectedLanguage = useAppStore((s) => s.transcription.detectedLanguage);
  const transcriptionStatus = useAppStore((s) => s.transcription.status);
  const cueCount = useAppStore((s) => s.transcription.cues.length);
  const startExport = useAppStore((s) => s.startExport);
  const exporting = useAppStore((s) => s.exportState.status !== 'idle');
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const canUndo = useAppStore((s) => s.cueHistory.past.length > 0);
  const canRedo = useAppStore((s) => s.cueHistory.future.length > 0);

  useEffect(() => {
    document.title = 'Jima Captions — auto-captions for short-form video';
  }, []);

  if (!caps.canRun) {
    return (
      <CapabilityFloor
        product="captions"
        title="This browser can't run Captions yet"
        body="Captions transcribes, renders and re-encodes your video entirely on your device. That needs a few modern browser features that aren't available here."
        missing={missingRequirements(caps)}
      />
    );
  }

  const ready = status === 'ready';
  const canExport = ready && cueCount > 0 && !exporting;
  const languagePill =
    transcriptionStatus === 'done' && detectedLanguage
      ? `${languageLabel(detectedLanguage)} · detected`
      : languageLabel(language);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-void">
      <ToolBar
        product="captions"
        lead={
          <ToolBarChip title={ready && file ? file.name : undefined}>
            {ready && file ? file.name : 'no video loaded'}
          </ToolBarChip>
        }
        actions={
          <>
            {ready && (
              <>
                <IconButton label="Undo (⌘Z)" size="sm" onClick={undo} disabled={!canUndo}>
                  <UndoIcon width={16} height={16} />
                </IconButton>
                <IconButton label="Redo (⌘⇧Z)" size="sm" onClick={redo} disabled={!canRedo}>
                  <RedoIcon width={16} height={16} />
                </IconButton>
                <span aria-hidden className="mx-1 h-5 w-px bg-line" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={resetProject}
                  title="Load a different video"
                  className="hidden sm:inline-flex"
                >
                  Replace
                </Button>
              </>
            )}
            <span className="hidden rounded-full bg-surface-2 px-3 py-1.5 font-mono text-[11.5px] text-ash ring-1 ring-inset ring-line md:inline-block">
              {languagePill}
            </span>
            <Button
              variant="primary"
              size="sm"
              onClick={() => void startExport()}
              disabled={!canExport}
              title={ready && cueCount === 0 ? 'Generate captions first' : 'Export captioned video'}
            >
              <DownloadIcon width={15} height={15} />
              Export
            </Button>
          </>
        }
      />

      {ready ? (
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(280px,320px)_1fr_minmax(280px,308px)]">
          <aside className="hidden min-h-0 border-r border-line bg-base lg:block">
            <TranscriptPanel />
          </aside>
          <main className="stage-dots flex min-h-0 items-center justify-center overflow-hidden p-4 sm:p-6">
            <VideoStage />
          </main>
          <aside className="hidden min-h-0 border-l border-line bg-base lg:block">
            <StylePanel />
          </aside>
        </div>
      ) : (
        <main className="stage-dots flex min-h-0 flex-1 items-center justify-center p-5">
          <Dropzone />
        </main>
      )}

      <ExportDialog />
    </div>
  );
}

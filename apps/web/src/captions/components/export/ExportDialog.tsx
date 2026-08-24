import { useAppStore } from '../../state/store';
import { Button, ProgressBar, buttonClasses } from '@/ui';

const PHASE_LABEL: Record<string, string> = {
  preparing: 'Preparing…',
  encoding: 'Encoding frames',
  finalizing: 'Finishing up…',
};

const AUDIO_NOTE: Record<string, string> = {
  passthrough: 'Audio copied losslessly.',
  reencoded: 'Audio re-encoded to AAC.',
  none: 'No audio track.',
};

/** Modal shown during and after an export. */
export function ExportDialog() {
  const status = useAppStore((s) => s.exportState.status);
  const progress = useAppStore((s) => s.exportState.progress);
  const audio = useAppStore((s) => s.exportState.audio);
  const resultUrl = useAppStore((s) => s.exportState.resultUrl);
  const fileName = useAppStore((s) => s.exportState.fileName);
  const error = useAppStore((s) => s.exportState.error);
  const cancelExport = useAppStore((s) => s.cancelExport);
  const dismissExport = useAppStore((s) => s.dismissExport);
  const startExport = useAppStore((s) => s.startExport);

  if (status === 'idle') return null;

  const running = status === 'preparing' || status === 'encoding' || status === 'finalizing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/75 p-4 backdrop-blur-md">
      <div className="fade-up w-full max-w-sm rounded-[24px] border border-line bg-surface p-6 shadow-pop">
        {running && (
          <div>
            <h2 className="font-display text-xl font-bold text-chalk">Exporting your video</h2>
            <p className="mt-1 text-sm text-dim">{PHASE_LABEL[status]}</p>
            <div className="mt-4">
              <ProgressBar value={progress} indeterminate={status !== 'encoding'} />
            </div>
            <div className="mt-2 flex items-center justify-between">
              <p className="text-xs text-dim">Encoding locally — nothing is uploaded.</p>
              {status === 'encoding' && (
                <span className="font-mono text-xs text-dim">{Math.round(progress * 100)}%</span>
              )}
            </div>
            <Button variant="secondary" onClick={cancelExport} className="mt-5 w-full">
              Cancel
            </Button>
          </div>
        )}

        {status === 'done' && (
          <div>
            <h2 className="font-display text-xl font-bold text-chalk">Your video is ready</h2>
            <p className="mt-1 text-sm text-dim">
              Full quality, captions burned in. {audio ? AUDIO_NOTE[audio] : ''}
            </p>
            <a
              href={resultUrl ?? '#'}
              download={fileName ?? 'jima-video.mp4'}
              className={buttonClasses('primary', 'lg', 'mt-5 w-full')}
            >
              Download
            </a>
            <button
              type="button"
              onClick={dismissExport}
              className="mt-2 w-full py-2 text-sm text-dim transition-colors hover:text-chalk"
            >
              Done
            </button>
          </div>
        )}

        {status === 'error' && (
          <div>
            <h2 className="font-display text-xl font-bold text-chalk">Export failed</h2>
            <p className="mt-2 rounded-input border border-error/25 bg-error/[0.04] px-3 py-2 text-sm text-error">
              {error ?? 'Something went wrong.'}
            </p>
            <Button onClick={() => void startExport()} className="mt-5 w-full">
              Try again
            </Button>
            <button
              type="button"
              onClick={dismissExport}
              className="mt-2 w-full py-2 text-sm text-dim transition-colors hover:text-chalk"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

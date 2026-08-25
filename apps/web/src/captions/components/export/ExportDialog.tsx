import { useEffect, useRef } from 'react';
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

  const running = status === 'preparing' || status === 'encoding' || status === 'finalizing';
  const open = status !== 'idle';

  return (
    <ModalShell open={open} onDismiss={running ? cancelExport : dismissExport} titleId="export-dialog-title">
      <div>
        {running && (
          <div>
            <h2 id="export-dialog-title" className="font-display text-xl font-bold text-chalk">
              Exporting your video
            </h2>
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
            <h2 id="export-dialog-title" className="font-display text-xl font-bold text-chalk">
              Your video is ready
            </h2>
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
            <h2 id="export-dialog-title" className="font-display text-xl font-bold text-chalk">
              Export failed
            </h2>
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
    </ModalShell>
  );
}

/**
 * The modal wrapper the export dialog was missing entirely.
 *
 * It was a bare `fixed inset-0` overlay: visually blocking, but with no dialog
 * role, no `aria-modal`, no focus move, no focus trap, no Escape and no focus
 * restore. A screen reader never learned an export had started, and a keyboard
 * user could tab straight through to the editor behind the scrim and change the
 * style of a video that was already encoding.
 */
function ModalShell({
  open,
  onDismiss,
  titleId,
  children,
}: {
  open: boolean;
  onDismiss: () => void;
  titleId: string;
  children: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreTo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreTo.current = document.activeElement as HTMLElement | null;
    // Focus the first control in the panel, or the panel itself.
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? panelRef.current)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!items || items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      restoreTo.current?.focus?.();
    };
  }, [open, onDismiss]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/75 p-4 backdrop-blur-md">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="fade-up w-full max-w-sm rounded-[24px] border border-line bg-surface p-6 shadow-pop focus:outline-none"
      >
        {children}
      </div>
    </div>
  );
}

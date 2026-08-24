import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../../state/store';
import { FILE_INPUT_ACCEPT, MAX_DURATION_SECONDS, MAX_FILE_MB } from '@jima/captions/video';
import { Spinner } from '@/ui';

/**
 * Upload surface: drag-and-drop or click-to-browse. Doubles as the editor's
 * empty state and its error state (validation messages render inline here).
 */
export function Dropzone() {
  const status = useAppStore((s) => s.project.status);
  const error = useAppStore((s) => s.project.error);
  const loadFile = useAppStore((s) => s.loadFile);

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const busy = status === 'validating';

  const pickFirst = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (file) void loadFile(file);
    },
    [loadFile],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (busy) return;
      pickFirst(e.dataTransfer.files);
    },
    [busy, pickFirst],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!busy) setDragging(true);
    },
    [busy],
  );

  return (
    <div className="w-full max-w-md">
      <label
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={() => setDragging(false)}
        className={[
          'group flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed px-8 py-16 text-center transition-all duration-200 ease-out-soft',
          dragging
            ? 'scale-[1.01] border-lime bg-lime-tint/60 shadow-card'
            : 'border-line bg-surface hover:border-lime/40 hover:shadow-card',
          busy ? 'pointer-events-none' : '',
        ].join(' ')}
      >
        <input
          ref={inputRef}
          type="file"
          accept={FILE_INPUT_ACCEPT}
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            pickFirst(e.target.files);
            e.target.value = ''; // allow re-selecting the same file
          }}
        />

        {busy ? (
          <>
            <Spinner />
            <h1 className="mt-5 font-display text-xl font-semibold text-chalk">
              Analysing your video
            </h1>
            <p className="mt-1.5 text-sm text-dim">Reading it locally — it never leaves your device.</p>
          </>
        ) : (
          <>
            <UploadGlyph dragging={dragging} />
            {/* The page's h1 while the editor is empty: this IS what the
                route is for, and a tool with no heading at all is a hole in
                the document outline. */}
            <h1 className="mt-5 font-display text-xl font-semibold text-chalk">
              {dragging ? 'Drop to start' : 'Drop your video here'}
            </h1>
            <p className="mt-1.5 text-sm text-dim">
              or <span className="font-semibold text-lime">browse</span> — .mp4, up to {MAX_FILE_MB} MB and{' '}
              {MAX_DURATION_SECONDS}s
            </p>
            <p className="mt-4 rounded-full bg-surface-2 px-3.5 py-1.5 text-[12px] font-medium text-dim">
              Processed 100% on your device
            </p>
          </>
        )}
      </label>

      {/* Three steps, so the empty state answers "and then what?" without
          making anyone read a help page first. */}
      {status !== 'error' && (
        <ol className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-dim">
          {['Drop an .mp4', 'It listens on your device', 'Style it and export'].map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-surface-2 font-mono text-[10px] font-semibold text-lime ring-1 ring-inset ring-line">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      )}

      {status === 'error' && error && (
        <div
          role="alert"
          className="mt-4 rounded-input border border-error/25 bg-error/[0.05] px-4 py-3 text-sm font-medium text-error"
        >
          {error.message}
        </div>
      )}
    </div>
  );
}

function UploadGlyph({ dragging }: { dragging: boolean }) {
  return (
    <div
      className={[
        'flex h-16 w-16 items-center justify-center rounded-[20px] bg-lime text-void shadow-glow transition-transform duration-200 ease-out-soft',
        dragging ? 'scale-110' : 'group-hover:scale-105',
      ].join(' ')}
      aria-hidden
    >
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M20 16v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2" />
      </svg>
    </div>
  );
}

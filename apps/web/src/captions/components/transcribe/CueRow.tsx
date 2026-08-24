import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppStore } from '../../state/store';
import { formatClock } from '@jima/captions';
import type { Cue } from '@jima/captions/captions';

function cueText(cue: Cue): string {
  return cue.words.map((w) => w.text).join(' ');
}

interface CueRowProps {
  cue: Cue;
  isActive: boolean;
  isLast: boolean;
}

export function CueRow({ cue, isActive, isLast }: CueRowProps) {
  const seekTo = useAppStore((s) => s.seekTo);
  const updateCueText = useAppStore((s) => s.updateCueText);
  const nudgeCueTime = useAppStore((s) => s.nudgeCueTime);
  const mergeCueWithNext = useAppStore((s) => s.mergeCueWithNext);
  const splitCueAtWord = useAppStore((s) => s.splitCueAtWord);
  const deleteCue = useAppStore((s) => s.deleteCue);

  const [text, setText] = useState(() => cueText(cue));
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const rowRef = useRef<HTMLLIElement>(null);

  // Re-sync local text when the cue changes underneath us (undo, merge, split).
  const external = cueText(cue);
  useEffect(() => {
    setText(external);
  }, [external]);

  // Autosize the textarea to its content.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);

  // Follow playback: scroll the active cue into view.
  useEffect(() => {
    if (isActive) rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isActive]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed !== external) updateCueText(cue.id, trimmed);
  };

  const canSplit = cue.words.length >= 2;

  return (
    <li
      ref={rowRef}
      className={`group mx-2 rounded-xl border-l-2 px-3 py-2.5 transition-all duration-200 ease-out-soft ${
        isActive ? 'border-lime bg-lime-tint/70 shadow-xs' : 'border-transparent hover:bg-surface-2/70'
      }`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => seekTo(cue.start)}
          className={`rounded-full px-2 py-0.5 font-mono text-[11px] transition-colors ${
            isActive ? 'bg-lime text-void' : 'bg-surface-2 text-dim hover:bg-lime-tint hover:text-lime'
          }`}
          title="Jump to this cue"
        >
          {formatClock(cue.start)}
        </button>

        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {canSplit && (
            <IconButton
              label="Split cue"
              onClick={() => splitCueAtWord(cue.id, Math.round(cue.words.length / 2))}
            >
              <path d="M6 3v12a3 3 0 1 0 2 0V3M18 3v12a3 3 0 1 1-2 0V3" />
              <path d="M8 8h8" />
            </IconButton>
          )}
          {!isLast && (
            <IconButton label="Merge with next" onClick={() => mergeCueWithNext(cue.id)}>
              <path d="M12 5v14" />
              <path d="m6 13 6 6 6-6" />
            </IconButton>
          )}
          <IconButton label="Delete cue" onClick={() => deleteCue(cue.id)} danger>
            <path d="M4 7h16" />
            <path d="M10 11v6M14 11v6" />
            <path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" />
            <path d="M9 7V4h6v3" />
          </IconButton>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            commit();
            e.currentTarget.blur();
          }
        }}
        rows={1}
        spellCheck={false}
        className="mt-0.5 w-full resize-none border-0 bg-transparent p-0 text-sm leading-snug text-chalk outline-none focus:ring-0"
      />

      <div className="mt-1 flex items-center gap-3 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <NudgeGroup
          label="in"
          onMinus={() => nudgeCueTime(cue.id, 'start', -0.1)}
          onPlus={() => nudgeCueTime(cue.id, 'start', 0.1)}
        />
        <NudgeGroup
          label="out"
          onMinus={() => nudgeCueTime(cue.id, 'end', -0.1)}
          onPlus={() => nudgeCueTime(cue.id, 'end', 0.1)}
        />
        <span className="ml-auto font-mono text-[10px] text-dim">
          {(cue.end - cue.start).toFixed(1)}s
        </span>
      </div>
    </li>
  );
}

function NudgeGroup({
  label,
  onMinus,
  onPlus,
}: {
  label: string;
  onMinus: () => void;
  onPlus: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="font-mono text-[10px] uppercase text-dim">{label}</span>
      <button
        type="button"
        onClick={onMinus}
        aria-label={`Move ${label} earlier`}
        className="flex h-5 w-5 items-center justify-center rounded-md bg-surface text-dim shadow-xs transition-colors hover:text-lime"
      >
        −
      </button>
      <button
        type="button"
        onClick={onPlus}
        aria-label={`Move ${label} later`}
        className="flex h-5 w-5 items-center justify-center rounded-md bg-surface text-dim shadow-xs transition-colors hover:text-lime"
      >
        +
      </button>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-surface hover:shadow-xs ${
        danger ? 'text-dim hover:text-error' : 'text-dim hover:text-chalk'
      }`}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {children}
      </svg>
    </button>
  );
}

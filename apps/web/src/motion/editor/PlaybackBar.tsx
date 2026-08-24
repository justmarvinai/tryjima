import type { PreviewApi } from "../hooks/usePreview";
import { useMotionStore } from "../state/store";

function fmt(t: number): string {
  return t.toFixed(1);
}

export function PlaybackBar({ preview }: { preview: PreviewApi }) {
  const loop = useMotionStore((s) => s.loop);
  const setLoop = useMotionStore((s) => s.setLoop);

  return (
    <div className="flex items-center gap-3 px-1 py-2">
      <button
        type="button"
        onClick={preview.toggle}
        aria-label={preview.playing ? "Pause" : "Play"}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lime text-void shadow-xs transition-colors hover:bg-lime-bright active:bg-lime-deep"
      >
        {preview.playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <input
        type="range"
        aria-label="Timeline"
        className="h-1.5 flex-1 cursor-pointer accent-emerald"
        min={0}
        max={Math.max(0.01, preview.duration)}
        step={0.01}
        value={Math.min(preview.currentTime, preview.duration)}
        onChange={(e) => preview.seek(Number(e.target.value))}
      />

      <span className="shrink-0 text-xs tabular-nums text-slate">
        {fmt(preview.currentTime)} / {fmt(preview.duration)}s
      </span>

      <button
        type="button"
        onClick={() => setLoop(!loop)}
        aria-pressed={loop}
        aria-label="Loop"
        className={`shrink-0 rounded-lg px-2 py-1.5 text-sm transition-colors ${loop ? "bg-emerald-tint text-primary-strong" : "text-slate hover:bg-subtle hover:text-ink"}`}
        title="Loop"
      >
        ⟳
      </button>
      <button
        type="button"
        onClick={preview.restart}
        aria-label="Restart"
        className="shrink-0 rounded-lg px-2 py-1.5 text-sm text-slate transition-colors hover:bg-subtle hover:text-ink"
        title="Restart"
      >
        ⟲
      </button>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <path d="M3 1.5v11l9-5.5z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden>
      <rect x="2.5" y="1.5" width="3.5" height="11" rx="1" />
      <rect x="8" y="1.5" width="3.5" height="11" rx="1" />
    </svg>
  );
}

import { useState, type RefObject } from "react";
import type { PreviewApi } from "../hooks/usePreview";
import { useMotionStore } from "../state/store";
import { PlaybackBar } from "./PlaybackBar";

export function PreviewStage({
  containerRef,
  preview,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  preview: PreviewApi;
}) {
  const aspect = useMotionStore((s) => s.aspect);
  const [safeZone, setSafeZone] = useState(false);

  return (
    <section className="stage-dots relative flex min-h-0 flex-1 flex-col px-4 py-4 sm:px-8 sm:py-6">
      {/*
        The artboard is the one bright thing on a dark stage, so it gets a real
        drop shadow rather than the dark-UI hairline — here the surface genuinely
        IS lighter than its ground.

        The measuring box fills the available area and carries no chrome. The
        artboard chrome is a separate layer sized to `preview.canvasBox` — the
        size the canvas was actually fitted to.

        It used to be one element styled `aspect-ratio` + `width: min(100%,720px)`
        + `max-h-full`. A `max-height` clamp shortens the box without
        recomputing the declared width, so anything taller than the space
        available came out the wrong shape: at 9:16 the frame measured 720×702
        around a 395×702 canvas — 325px of dead surface inside the ring — and
        the safe-zone bands, drawn against the same box, ran 162px past the
        artboard on each side while claiming to show what the platform crops.
      */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div
          ref={containerRef}
          className="relative flex h-full w-full max-w-[720px] items-center justify-center"
          aria-live="off"
        >
          {preview.canvasBox && (
            <div
              className="pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 rounded-bento bg-surface shadow-stage ring-1 ring-line-2"
              style={{ width: preview.canvasBox.w, height: preview.canvasBox.h }}
              aria-hidden
            />
          )}
          {!preview.ready && !preview.error && <span className="text-sm text-dim">Preparing preview…</span>}
          {preview.error && (
            <p className="max-w-xs rounded-card border border-error/30 bg-error-tint px-4 py-3 text-center text-sm text-error">
              {preview.error}
            </p>
          )}
          {safeZone && aspect === "9:16" && preview.canvasBox && (
            <SafeZoneOverlay w={preview.canvasBox.w} h={preview.canvasBox.h} />
          )}
        </div>
      </div>

      <div className="mx-auto mt-4 w-full max-w-[720px]">
        <div className="rounded-2xl border border-line bg-surface/95 px-2 shadow-card backdrop-blur">
          <PlaybackBar preview={preview} />
        </div>
        {aspect === "9:16" && (
          <label className="mt-2 flex items-center justify-center gap-2 text-xs text-ash">
            <input type="checkbox" checked={safeZone} onChange={(e) => setSafeZone(e.target.checked)} className="accent-lime" />
            Show safe zones (keep text clear of platform UI)
          </label>
        )}
      </div>
    </section>
  );
}

// Approximate Reels/TikTok/Stories safe zone (bottom ~21%, top ~11%).
// Sized to the artboard, never to the stage: bands that overhang the frame are
// worse than no bands, because they say the platform crops something it doesn't.
function SafeZoneOverlay({ w, h }: { w: number; h: number }) {
  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-bento"
      style={{ width: w, height: h }}
      aria-hidden
    >
      <div className="absolute inset-x-0 top-0 h-[11.4%] bg-error/10" />
      <div className="absolute inset-x-0 bottom-0 h-[20.8%] bg-error/10" />
      <div className="absolute inset-y-0 left-0 w-[6%] bg-error/5" />
      <div className="absolute inset-y-0 right-0 w-[6%] bg-error/5" />
    </div>
  );
}

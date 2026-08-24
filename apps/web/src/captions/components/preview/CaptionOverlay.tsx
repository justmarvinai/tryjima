import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../state/store';
import { drawCaptions } from '@jima/captions/captions';
import { STYLE_RANGES } from '@jima/captions/captions';
import { loadFont } from '@jima/captions/fonts';

/** HTMLVideoElement with the (still non-standard in TS libs) rVFC methods. */
type RVFCVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, metadata: unknown) => void) => number;
  cancelVideoFrameCallback?: (handle: number) => void;
};

interface CaptionOverlayProps {
  video: HTMLVideoElement | null;
  /** Native video pixel dimensions — the canvas backing store size. */
  width: number;
  height: number;
}

/**
 * Canvas overlay that draws the captions onto the video, frame-synced via
 * `requestVideoFrameCallback` (falling back to rAF). Backing store is the
 * native resolution and CSS-scaled to the video box, so the preview is
 * pixel-identical to the export.
 */
export function CaptionOverlay({ video, width, height }: CaptionOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cues = useAppStore((s) => s.transcription.cues);
  const style = useAppStore((s) => s.style);
  const setStyle = useAppStore((s) => s.setStyle);

  // Keep the latest cues/style in refs so the frame loop never draws stale data.
  const cuesRef = useRef(cues);
  cuesRef.current = cues;
  const styleRef = useRef(style);
  styleRef.current = style;

  // ── Drag the caption block vertically to reposition it ──────────────
  const [cursor, setCursor] = useState<'default' | 'grab' | 'grabbing'>('default');
  const dragRef = useRef<{ startClientY: number; startPct: number } | null>(null);

  /** Is this pointer y (in element coords) over the caption block? */
  const overCaptionBlock = useCallback(
    (clientY: number, rect: DOMRect) => {
      if (cuesRef.current.length === 0) return false;
      const yPct = ((clientY - rect.top) / Math.max(1, rect.height)) * 100;
      const grabZone = Math.max(styleRef.current.fontSizePct * 1.6, 10); // ± in %
      return Math.abs(yPct - styleRef.current.positionYPct) <= grabZone;
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (!overCaptionBlock(e.clientY, rect)) return;
      dragRef.current = { startClientY: e.clientY, startPct: styleRef.current.positionYPct };
      e.currentTarget.setPointerCapture(e.pointerId);
      setCursor('grabbing');
    },
    [overCaptionBlock],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const drag = dragRef.current;
      if (drag) {
        const deltaPct = ((e.clientY - drag.startClientY) / Math.max(1, rect.height)) * 100;
        const { min, max } = STYLE_RANGES.positionYPct;
        const next = Math.round(Math.min(max, Math.max(min, drag.startPct + deltaPct)));
        if (next !== styleRef.current.positionYPct) setStyle({ positionYPct: next });
      } else {
        setCursor(overCaptionBlock(e.clientY, rect) ? 'grab' : 'default');
      }
    },
    [overCaptionBlock, setStyle],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* already released */
      }
    }
    setCursor('default');
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !video) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawCaptions(ctx, video.currentTime || 0, {
      cues: cuesRef.current,
      style: styleRef.current,
      videoWidth: width,
      videoHeight: height,
    });
  }, [video, width, height]);

  // Frame-synced draw loop.
  useEffect(() => {
    if (!video) return;
    const rvfc = video as RVFCVideo;
    const useRVFC = typeof rvfc.requestVideoFrameCallback === 'function';
    let cancelled = false;
    let frameHandle = 0;
    let rafHandle = 0;

    const schedule = () => {
      if (cancelled) return;
      if (useRVFC) frameHandle = rvfc.requestVideoFrameCallback!(loop);
      else rafHandle = requestAnimationFrame(loop);
    };
    const loop = () => {
      if (cancelled) return;
      draw();
      schedule();
    };

    draw();
    schedule();
    return () => {
      cancelled = true;
      if (useRVFC && frameHandle) rvfc.cancelVideoFrameCallback?.(frameHandle);
      if (rafHandle) cancelAnimationFrame(rafHandle);
    };
  }, [video, draw]);

  // Redraw when cues/style change (covers edits while paused). Load the caption
  // font first so metrics + glyphs match the export.
  useEffect(() => {
    let active = true;
    loadFont(style.fontFamily)
      .catch(() => undefined)
      .finally(() => {
        if (active) draw();
      });
    return () => {
      active = false;
    };
  }, [cues, style, draw]);

  // Redraw on seek / first frame.
  useEffect(() => {
    if (!video) return;
    const onSeek = () => draw();
    video.addEventListener('seeked', onSeek);
    video.addEventListener('loadeddata', onSeek);
    return () => {
      video.removeEventListener('seeked', onSeek);
      video.removeEventListener('loadeddata', onSeek);
    };
  }, [video, draw]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={endDrag}
      className="absolute inset-0 h-full w-full touch-none"
      style={{ cursor }}
      title="Drag the captions to reposition them"
    />
  );
}

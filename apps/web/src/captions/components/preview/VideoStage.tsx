import { useEffect, useState } from 'react';
import { useAppStore } from '../../state/store';
import { CaptionOverlay } from './CaptionOverlay';
import { formatClockTenths } from '@jima/captions';

/**
 * The center stage: the video with the caption canvas overlaid and a custom
 * transport. Mirrors playback state into the store so the transcript can
 * follow along and seek.
 */
export function VideoStage() {
  const objectUrl = useAppStore((s) => s.project.objectUrl);
  const metadata = useAppStore((s) => s.project.metadata);
  const setPlayback = useAppStore((s) => s.setPlayback);
  const seekTarget = useAppStore((s) => s.playback.seekTarget);
  const seekNonce = useAppStore((s) => s.playback.seekNonce);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);

  // Mirror the video element's state into the store.
  useEffect(() => {
    if (!videoEl) return;
    const onTime = () => setPlayback({ currentTime: videoEl.currentTime });
    const onDur = () => setPlayback({ duration: Number.isFinite(videoEl.duration) ? videoEl.duration : 0 });
    const onPlay = () => setPlayback({ playing: true });
    const onPause = () => setPlayback({ playing: false });
    videoEl.addEventListener('timeupdate', onTime);
    videoEl.addEventListener('durationchange', onDur);
    videoEl.addEventListener('loadedmetadata', onDur);
    videoEl.addEventListener('play', onPlay);
    videoEl.addEventListener('pause', onPause);
    onDur();
    return () => {
      videoEl.removeEventListener('timeupdate', onTime);
      videoEl.removeEventListener('durationchange', onDur);
      videoEl.removeEventListener('loadedmetadata', onDur);
      videoEl.removeEventListener('play', onPlay);
      videoEl.removeEventListener('pause', onPause);
    };
  }, [videoEl, setPlayback]);

  // Apply store-driven seeks (e.g. clicking a cue in the transcript).
  useEffect(() => {
    if (videoEl && seekTarget != null) videoEl.currentTime = seekTarget;
    // seekNonce forces this to run even when seeking to the same time.
  }, [videoEl, seekTarget, seekNonce]);

  // Spacebar toggles play/pause — unless a text field or button is focused.
  useEffect(() => {
    if (!videoEl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'button' || el?.isContentEditable) return;
      e.preventDefault();
      if (videoEl.paused) void videoEl.play();
      else videoEl.pause();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoEl]);

  if (!objectUrl || !metadata) return null;
  const aspect = metadata.width / metadata.height;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4">
      <div
        className="relative overflow-hidden rounded-[22px] bg-black shadow-pop ring-1 ring-black/5"
        style={{ aspectRatio: String(aspect), height: 'min(100%, 64vh)', maxWidth: '100%' }}
      >
        <video ref={setVideoEl} src={objectUrl} playsInline className="h-full w-full object-contain" />
        <CaptionOverlay video={videoEl} width={metadata.width} height={metadata.height} />
      </div>
      <Transport video={videoEl} />
    </div>
  );
}

function Transport({ video }: { video: HTMLVideoElement | null }) {
  const playing = useAppStore((s) => s.playback.playing);
  const currentTime = useAppStore((s) => s.playback.currentTime);
  const duration = useAppStore((s) => s.playback.duration);
  const setPlayback = useAppStore((s) => s.setPlayback);

  const toggle = () => {
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };
  const scrub = (t: number) => {
    if (video) video.currentTime = t;
    setPlayback({ currentTime: t });
  };

  return (
    <div className="flex w-full max-w-md items-center gap-3 rounded-full border border-line bg-surface py-2 pl-2 pr-4 shadow-xs">
      <button
        type="button"
        onClick={toggle}
        disabled={!video}
        aria-label={playing ? 'Pause' : 'Play'}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lime text-void transition-all duration-150 ease-out-soft hover:scale-105 hover:bg-lime-bright disabled:opacity-40"
      >
        {playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
          </svg>
        )}
      </button>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={Math.min(currentTime, duration || 0)}
        onChange={(e) => scrub(Number.parseFloat(e.target.value))}
        disabled={!video}
        aria-label="Seek"
        className="flex-1"
      />
      <span className="shrink-0 font-mono text-xs tabular-nums text-dim">
        {formatClockTenths(currentTime)} / {formatClockTenths(duration)}
      </span>
    </div>
  );
}

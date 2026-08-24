import type { TemplateRunner } from "../runtime/runner";

export interface PreviewPlayerOptions {
  loop?: boolean;
  speed?: number;
  autoplay?: boolean;
  /** Called after each painted frame with the current time (seconds). */
  onFrame?: (t: number, duration: number) => void;
  /**
   * Called only while playing (not on seek/scrub) with the time interval the
   * playhead just crossed, `(fromT, toT]`. `wrapped` is true when a loop
   * restarted within the step (then the interval is `(fromT, duration]` plus
   * `(0, toT]`). Lets a sound layer fire cues the playhead passes over.
   */
  onAdvance?: (fromT: number, toT: number, wrapped: boolean, duration: number) => void;
  onEnded?: () => void;
}

/**
 * Drives a TemplateRunner in real time for preview. The wall clock comes from
 * the requestAnimationFrame timestamp argument (not performance.now/Date.now),
 * keeping this module inside the determinism rules. Rendering itself stays a
 * pure function of t — only *which* t we ask for advances with real time.
 */
export class PreviewPlayer {
  private runner: TemplateRunner;
  private loopEnabled: boolean;
  private speed: number;
  private time = 0;
  private playing = false;
  private rafId: number | null = null;
  private lastTs: number | null = null;
  private readonly onFrame?: (t: number, duration: number) => void;
  private readonly onAdvance?: (fromT: number, toT: number, wrapped: boolean, duration: number) => void;
  private readonly onEnded?: () => void;

  constructor(runner: TemplateRunner, opts: PreviewPlayerOptions = {}) {
    this.runner = runner;
    this.loopEnabled = opts.loop ?? true;
    this.speed = opts.speed ?? 1;
    if (opts.onFrame) this.onFrame = opts.onFrame;
    if (opts.onAdvance) this.onAdvance = opts.onAdvance;
    if (opts.onEnded) this.onEnded = opts.onEnded;
    this.renderCurrent();
    if (opts.autoplay) this.play();
  }

  get currentTime(): number {
    return this.time;
  }
  get isPlaying(): boolean {
    return this.playing;
  }
  get duration(): number {
    return this.runner.duration;
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.lastTs = null;
    this.rafId = requestAnimationFrame(this.tick);
  }

  pause(): void {
    this.playing = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  /** Jump to an absolute time (seconds), clamped to [0, duration]. */
  seek(t: number): void {
    this.time = Math.max(0, Math.min(this.duration, t));
    this.renderCurrent();
  }

  restart(): void {
    this.seek(0);
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.1, speed);
  }

  setLoop(loop: boolean): void {
    this.loopEnabled = loop;
  }

  private tick = (ts: number): void => {
    if (!this.playing) return;
    if (this.lastTs === null) this.lastTs = ts;
    const dt = ((ts - this.lastTs) / 1000) * this.speed;
    this.lastTs = ts;

    const from = this.time;
    let next = this.time + dt;
    const dur = this.duration;
    let wrapped = false;
    if (next >= dur) {
      if (this.loopEnabled) {
        next = dur > 0 ? next % dur : 0;
        wrapped = true;
      } else {
        next = dur;
        this.time = next;
        this.renderCurrent();
        this.onAdvance?.(from, next, false, dur);
        this.pause();
        this.onEnded?.();
        return;
      }
    }
    this.time = next;
    this.renderCurrent();
    this.onAdvance?.(from, next, wrapped, dur);
    this.rafId = requestAnimationFrame(this.tick);
  };

  private renderCurrent(): void {
    this.runner.renderAt(this.time);
    this.onFrame?.(this.time, this.duration);
  }

  destroy(): void {
    this.pause();
  }
}

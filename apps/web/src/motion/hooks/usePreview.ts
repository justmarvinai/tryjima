import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  createFontRegistry,
  CueScheduler,
  cuesForTemplate,
  trimCues,
  isImageRef,
  PreviewPlayer,
  TemplateRunner,
  sizeOf,
  type Aspect,
  type SoundPack,
  type TemplateDefinition,
  type Values,
} from "@jima/engine";
import { engineValues } from "../state/values";

export interface PreviewApi {
  currentTime: number;
  duration: number;
  playing: boolean;
  ready: boolean;
  /**
   * CSS size the canvas was actually fitted to. The stage draws the artboard
   * chrome (ring, shadow, safe zones) against this rather than against its own
   * box: `aspect-ratio` plus a `max-height` clamp keeps the declared width, so
   * a container styled that way is the wrong shape for anything taller than the
   * space available — 4:5 and 9:16 both ended up with a wide band of dead
   * surface inside the ring, and the safe-zone overlay was drawn across it.
   */
  canvasBox: { w: number; h: number } | null;
  /** Set when the preview could not be built at all. */
  error: string | null;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (t: number) => void;
  restart: () => void;
  stepFrame: (dir: 1 | -1, big?: boolean) => void;
}

interface Params {
  def: TemplateDefinition | null;
  aspect: Aspect;
  values: Values;
  paletteId: string | undefined;
  font: string | undefined;
  bodyFont: string | undefined;
  speed: number;
  /** Motion energy 0–2. Baked into the timeline at build, so it recreates the runner. */
  energy: number;
  /** Seconds cut off the front / held on the end — also build-time. */
  trim: number;
  hold: number;
  /** Play the procedural music bed under the effects. */
  music: boolean;
  loop: boolean;
  sound: boolean;
  soundPack: SoundPack;
  reducedMotion: boolean;
}

function fit(container: HTMLElement, aspect: Aspect) {
  const logical = sizeOf(aspect);
  const availW = container.clientWidth;
  const availH = container.clientHeight;
  const scale = Math.min(availW / logical.width, availH / logical.height) || 0.1;
  const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  return {
    cssW: Math.round(logical.width * scale),
    cssH: Math.round(logical.height * scale),
    resolution: Math.max(0.1, Math.min(2, scale * dpr)),
  };
}

export function usePreview(containerRef: RefObject<HTMLElement | null>, params: Params): PreviewApi {
  const runnerRef = useRef<TemplateRunner | null>(null);
  const playerRef = useRef<PreviewPlayer | null>(null);
  const schedulerRef = useRef<CueScheduler | null>(null);
  const [state, setState] = useState({ t: 0, duration: 0, playing: false, ready: false });
  const [canvasBox, setCanvasBox] = useState<{ w: number; h: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Recreate the runner (which reloads image textures) when an image changes.
  const imagesKey = useMemo(() => {
    const parts: string[] = [];
    for (const [k, v] of Object.entries(params.values)) {
      if (isImageRef(v)) parts.push(`${k}:${v.url}`);
    }
    return parts.join("|");
  }, [params.values]);

  // Create runner + player when the template or aspect changes.
  useEffect(() => {
    const container = containerRef.current;
    if (!params.def || !container) return;
    let disposed = false;
    let observer: ResizeObserver | null = null;

    setError(null);
    // `void`-ing this used to swallow every failure: a template that could not
    // be built left "Preparing preview…" on screen forever and an unhandled
    // rejection in the console, with no way for the user to know.
    void (async () => {
      const runner = await TemplateRunner.create(params.def!, {
        aspect: params.aspect,
        values: engineValues(params.def!, params.values),
        ...(params.paletteId ? { paletteId: params.paletteId } : {}),
        fonts: createFontRegistry({ headline: params.font, body: params.bodyFont }),
        resolution: 1,
        energy: params.energy,
        trim: params.trim,
        hold: params.hold,
      });
      if (disposed) {
        runner.destroy();
        return;
      }
      runnerRef.current = runner;

      // The profile is the template's sonic character; the cues are its rhythm.
      // Both come from one call so the preview and the baked export match.
      const sheet = cuesForTemplate(runner.def, runner.timeline, runner.timelineDuration);
      const scheduler = new CueScheduler({
        enabled: params.sound,
        pack: params.soundPack,
        profile: sheet.profile,
        music: params.music,
      });
      scheduler.setSpeed(params.speed);
      // Cue times are timeline times; the playhead counts output time.
      scheduler.setCues(trimCues(sheet.cues, runner.trim));
      schedulerRef.current = scheduler;

      const canvas = runner.canvas;
      canvas.style.display = "block";
      canvas.style.maxWidth = "100%";
      canvas.style.maxHeight = "100%";
      // The artboard chrome behind this is a positioned sibling, and positioned
      // elements paint above static ones — without a stacking position of its
      // own the canvas would sit *under* an opaque surface. It also has to round
      // its own corners now that nothing clips it.
      canvas.style.position = "relative";
      canvas.style.zIndex = "10";
      canvas.style.borderRadius = "var(--radius-bento)";
      canvas.setAttribute("role", "img");
      // Generic, template-name-free label: embedding the template name (e.g.
      // "Kinetic Headline") would collide with field labels like "Headline" under
      // accessible-name matching. This still gives the canvas an accessible name.
      canvas.setAttribute("aria-label", "Live animation preview");
      container.appendChild(canvas);

      const applyFit = () => {
        const { cssW, cssH, resolution } = fit(container, params.aspect);
        canvas.style.width = `${cssW}px`;
        canvas.style.height = `${cssH}px`;
        runner.resize(resolution);
        setCanvasBox((prev) => (prev && prev.w === cssW && prev.h === cssH ? prev : { w: cssW, h: cssH }));
      };
      applyFit();

      const player = new PreviewPlayer(runner, {
        loop: params.loop,
        speed: params.speed,
        autoplay: !params.reducedMotion,
        onFrame: (t, duration) => setState((s) => ({ ...s, t, duration, playing: player.isPlaying })),
        onAdvance: (fromT, toT, wrapped, duration) => scheduler.advance(fromT, toT, wrapped, duration),
      });
      playerRef.current = player;
      setState({ t: 0, duration: runner.duration, playing: player.isPlaying, ready: true });

      observer = new ResizeObserver(applyFit);
      observer.observe(container);
    })().catch((e: unknown) => {
      if (disposed) return;
      setError(e instanceof Error ? e.message : "This template could not be prepared.");
      setState({ t: 0, duration: 0, playing: false, ready: false });
    });

    return () => {
      disposed = true;
      observer?.disconnect();
      playerRef.current?.destroy();
      playerRef.current = null;
      schedulerRef.current?.destroy();
      schedulerRef.current = null;
      const r = runnerRef.current;
      if (r) {
        r.canvas.remove();
        r.destroy();
        runnerRef.current = null;
      }
      setState({ t: 0, duration: 0, playing: false, ready: false });
      setCanvasBox(null);
    };
    // Energy is baked into the timeline at build time, so it belongs in this
    // list with the other structural inputs rather than in a live-update effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.def, params.aspect, imagesKey, params.font, params.bodyFont, params.energy, params.trim, params.hold]);

  // Rebuild scene on value/palette changes (debounced, in place).
  useEffect(() => {
    const runner = runnerRef.current;
    const player = playerRef.current;
    if (!runner) return;
    let cancelled = false;
    const id = setTimeout(() => {
      const next = engineValues(runner.def, params.values);
      // AWAIT the face before rebuilding. Fire-and-forget meant the scene was
      // rebuilt before the font arrived, so a newly-typed emoji rendered as a
      // tofu box until some later edit happened to rebuild it again.
      void runner
        .ensureFontsFor(next)
        .catch(() => undefined)
        .then(() => {
          if (cancelled || runnerRef.current !== runner) return;
          // `rebuildScene` is documented to throw on a transient bad value (a
          // half-typed hex reaching a template's .fill()) and to leave the last
          // good frame up. Inside a timeout that throw was unhandled, and it
          // skipped the duration + cue refresh below with it.
          try {
            runner.rebuildScene(next, params.paletteId);
          } catch {
            return; // keep the last good frame; the next keystroke retries
          }
          setState((s) => ({ ...s, duration: runner.duration }));
          // Editing values can change the motion (and its timing) → refit cues.
          schedulerRef.current?.setCues(
            trimCues(cuesForTemplate(runner.def, runner.timeline, runner.timelineDuration).cues, runner.trim),
          );
          if (player && !player.isPlaying) runner.renderAt(player.currentTime);
        });
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };

  }, [params.values, params.paletteId]);

  useEffect(() => {
    playerRef.current?.setSpeed(params.speed);
  }, [params.speed]);

  useEffect(() => {
    playerRef.current?.setLoop(params.loop);
  }, [params.loop]);

  useEffect(() => {
    schedulerRef.current?.setEnabled(params.sound);
    // Toggling sound on is a user gesture → safe to unlock the audio context.
    if (params.sound) void schedulerRef.current?.resume();
  }, [params.sound]);

  useEffect(() => {
    schedulerRef.current?.setPack(params.soundPack);
  }, [params.soundPack]);

  useEffect(() => {
    schedulerRef.current?.setMusic(params.music);
  }, [params.music]);

  useEffect(() => {
    schedulerRef.current?.setSpeed(params.speed);
  }, [params.speed]);

  const player = () => playerRef.current;
  return {
    currentTime: state.t,
    duration: state.duration,
    playing: state.playing,
    ready: state.ready,
    canvasBox,
    error,
    play: () => {
      // Unlock audio from this gesture, then start the bed once the context is
      // actually running — scheduling into a suspended context does nothing.
      void schedulerRef.current?.resume().then(() => {
        schedulerRef.current?.start(playerRef.current?.duration ?? 0);
      });
      player()?.play();
      setState((s) => ({ ...s, playing: true }));
    },
    pause: () => {
      player()?.pause();
      schedulerRef.current?.stop();
      setState((s) => ({ ...s, playing: false }));
    },
    toggle: () => {
      const p = player();
      if (!p) return;
      const willPlay = !p.isPlaying;
      void schedulerRef.current?.resume().then(() => {
        if (willPlay) schedulerRef.current?.start(p.duration);
        else schedulerRef.current?.stop();
      });
      p.toggle();
      setState((s) => ({ ...s, playing: p.isPlaying }));
    },
    seek: (t) => {
      const p = player();
      p?.seek(t);
      // The bed is one pass long and started at play time; jumping the playhead
      // without restarting it left the music running against the wrong part of
      // the motion for the rest of the pass.
      if (p?.isPlaying) schedulerRef.current?.start(p.duration);
      setState((s) => ({ ...s, t }));
    },
    restart: () => {
      player()?.seek(0);
      setState((s) => ({ ...s, t: 0 }));
    },
    stepFrame: (dir, big) => {
      const p = player();
      if (!p) return;
      p.pause();
      // Pausing the player without stopping the scheduler left the bed playing
      // over a frozen frame.
      schedulerRef.current?.stop();
      const delta = (big ? 1 : 1 / 30) * dir;
      const nt = Math.max(0, Math.min(p.duration, p.currentTime + delta));
      p.seek(nt);
      setState((s) => ({ ...s, t: nt, playing: false }));
    },
  };
}

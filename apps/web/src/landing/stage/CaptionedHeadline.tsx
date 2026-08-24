import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { cn, useReducedMotion } from "@/ui";

/**
 * The hero headline, set as a caption line.
 *
 * Every other tool's landing page describes what it does. This one runs it: the
 * words are cues, the highlight walks them the way Jima Captions walks a real
 * transcript, and the transport underneath is draggable — scrub it and the
 * highlight moves with you, at 130px. It is the product demo and the headline
 * at the same time, which is a thing only this product can do.
 *
 * Two timelines, deliberately separate:
 *
 *   the entrance   each word rises in once, fast (~1.1s for the whole line), as
 *                  a plain CSS animation. It never rests at a partial opacity —
 *                  a half-faded headline is a real contrast failure, not a
 *                  style, and axe evaluates whatever state it happens to sample.
 *   the highlight  which word is lime. Driven by `t`, which either auto-plays
 *                  once or follows the scrubber. Words are full chalk either
 *                  side of it, so the line is always legible.
 */

type Word = { text: string; ms: number; breakAfter?: boolean };

const WORDS: Word[] = [
  { text: "Caption", ms: 560 },
  { text: "it.", ms: 340, breakAfter: true },
  { text: "Animate", ms: 600 },
  { text: "it.", ms: 340, breakAfter: true },
  { text: "Post", ms: 460 },
  { text: "it.", ms: 500 },
];

const TOTAL = WORDS.reduce((a, w) => a + w.ms, 0);
const STARTS = WORDS.map((_, i) => WORDS.slice(0, i).reduce((a, w) => a + w.ms, 0));
const ENTRANCE_STEP = 105; // ms between word entrances

/** Lines, as the words group between breaks. */
const LINES: { word: Word; index: number }[][] = (() => {
  const out: { word: Word; index: number }[][] = [[]];
  WORDS.forEach((word, index) => {
    out[out.length - 1]!.push({ word, index });
    if (word.breakAfter) out.push([]);
  });
  return out.filter((l) => l.length > 0);
})();

function timecode(ms: number): string {
  const s = Math.floor(ms / 1000);
  const cs = Math.floor((ms % 1000) / 100);
  return `0:0${s}.${cs}`;
}

export function CaptionedHeadline({ titleId }: { titleId: string }) {
  const reduced = useReducedMotion();
  const [t, setT] = useState(0);
  // Set the moment the visitor touches the transport: the auto-play must not
  // fight them for the playhead, and must not resume behind them afterwards.
  const [taken, setTaken] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) {
      setT(TOTAL);
      return;
    }
    if (taken) return;
    let raf = 0;
    let start = 0;
    // Hold on the first word until the entrance has caught up with it.
    const lead = ENTRANCE_STEP * 2;
    const tick = (now: number) => {
      if (!start) start = now;
      const elapsed = Math.max(0, now - start - lead);
      setT(Math.min(TOTAL, elapsed));
      if (elapsed < TOTAL) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, taken]);

  const seekTo = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    setT(f * TOTAL);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    setTaken(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    seekTo(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) seekTo(e.clientX);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = TOTAL / 12;
    const next =
      e.key === "ArrowLeft" || e.key === "ArrowDown"
        ? t - step
        : e.key === "ArrowRight" || e.key === "ArrowUp"
          ? t + step
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? TOTAL
              : null;
    if (next === null) return;
    e.preventDefault();
    setTaken(true);
    setT(Math.min(TOTAL, Math.max(0, next)));
  };

  const activeIndex = WORDS.findIndex((w, i) => t >= STARTS[i]! && t < STARTS[i]! + w.ms);
  const progress = t / TOTAL;

  return (
    <div>
      <h1 id={titleId} className="headline-mega text-[clamp(3rem,10.6vw,9.75rem)] text-chalk">
        {LINES.map((line, li) => (
          <span key={li} className="block">
            {line.map(({ word, index }, k) => (
              // The space between words is a real text node, not a margin: the
              // accessible name is a concatenation, and `<span>Caption</span>
              // <span>it.</span>` with only a margin between them announces
              // "Captionit."
              <Fragment key={index}>
                {k > 0 && " "}
                <span
                  className={cn(
                    "inline-block transition-colors duration-150 ease-out",
                    index === activeIndex ? "text-lime" : "text-chalk",
                    !reduced && "word-in",
                  )}
                  style={{
                    ...(reduced ? null : { animationDelay: `${index * ENTRANCE_STEP}ms` }),
                    ...(index === activeIndex ? { textShadow: "0 0 60px rgb(200 255 61 / 35%)" } : null),
                  }}
                >
                  {word.text}
                </span>
              </Fragment>
            ))}
          </span>
        ))}
      </h1>

      {/* The transport. A real control, not decoration — and the only way to see
          that the headline is a transcript rather than a typographic trick. */}
      <div className="mt-9 flex max-w-md items-center gap-4 rounded-full border border-line/80 bg-surface/60 py-2.5 pl-4 pr-3 backdrop-blur-xl">
        <span className="font-mono text-[11px] tabular-nums text-lime">{timecode(t)}</span>

        <div
          ref={trackRef}
          role="slider"
          tabIndex={0}
          aria-label="Scrub the headline captions"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-valuetext={`${WORDS[activeIndex === -1 ? WORDS.length - 1 : activeIndex]?.text ?? ""}, ${timecode(t)}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onKeyDown={onKeyDown}
          className="group relative h-7 flex-1 cursor-ew-resize touch-none rounded-full focus-visible:outline-none"
        >
          <div className="absolute inset-x-0 top-1/2 h-[6px] -translate-y-1/2 overflow-hidden rounded-full bg-surface-3 ring-1 ring-inset ring-line-2">
            <div
              className="h-full rounded-full bg-lime transition-[width] duration-75"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          {/* Cue boundaries, so the bar reads as a transcript and not a loader. */}
          {STARTS.slice(1).map((s) => (
            <span
              key={s}
              aria-hidden
              className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-void/80"
              style={{ left: `${(s / TOTAL) * 100}%` }}
            />
          ))}

          <span
            aria-hidden
            className="absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-void bg-lime shadow-glow transition-transform duration-150 group-hover:scale-115 group-focus-visible:scale-115 group-focus-visible:ring-2 group-focus-visible:ring-chalk"
            style={{ left: `${progress * 100}%` }}
          />
        </div>

        <span className="shrink-0 rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-dim">
          Drag
        </span>
      </div>
    </div>
  );
}

import type { CSSProperties } from "react";
import { cn, useReducedMotion } from "@/ui";

/**
 * The hero's ground.
 *
 * Not a gradient mesh and not a dot grid — both are the house style of every
 * other tool in this category. This is a painted dark field with the product's
 * own iconography buried in it: a waveform, drawn enormous across the bottom,
 * with the part behind the playhead lit lime. The playhead advances with
 * `--sy`, so scrolling the hero plays the clip its ground is made of.
 *
 * Order matters — washes, waveform, grain, vignette. The grain has to sit above
 * the waveform, or the bars look printed onto a clean surface rather than being
 * part of it.
 */

/**
 * 72 bar heights, 0 … 1. Three detuned sines rather than a random seed: it must
 * be identical on every render (a re-shuffling background is a flicker), and it
 * has to look like speech rather than like a sine wave, which is what the third
 * harmonic buys.
 */
const WAVE = Array.from({ length: 72 }, (_, i) => {
  const a = Math.sin(i * 0.71) * 0.5 + 0.5;
  const b = Math.sin(i * 1.93 + 1.1) * 0.5 + 0.5;
  const c = Math.sin(i * 0.31 + 2.4) * 0.5 + 0.5;
  return 0.1 + (a * 0.44 + b * 0.31 + c * 0.25) * 0.9;
});

/** One row of bars. Drawn twice — neutral underneath, lime masked on top. */
function Bars({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div className={cn("absolute inset-0 flex items-end gap-[0.35%]", className)} style={style}>
      {WAVE.map((h, i) => (
        <span key={i} className="flex-1 rounded-t-[3px] bg-current" style={{ height: `${h * 100}%` }} />
      ))}
    </div>
  );
}

/**
 * Fades the row out towards its top. Deliberately a long fade starting low: the
 * bars are atmosphere, and a short fade leaves a row of hard grey teeth sitting
 * under the buttons.
 */
const TOP_FADE = "linear-gradient(to top, #000 0%, rgb(0 0 0 / 55%) 16%, transparent 82%)";
const FADE_UP = { maskImage: TOP_FADE, WebkitMaskImage: TOP_FADE } as const;

export function StageGround() {
  const reduced = useReducedMotion();

  return (
    <>
      {/* Accent washes, in their own layer so the drift never carries the
          waveform or the grain along with them. */}
      <div
        className={cn("pointer-events-none absolute inset-0 -z-30 painted-dark", !reduced && "aurora-drift")}
        aria-hidden
      />

      {/* The waveform, bled off both sides so it reads as a detail of something
          much larger than the page. */}
      <div
        className="pointer-events-none absolute inset-x-[-4%] bottom-0 -z-20 h-[58%]"
        style={{
          // Rises slightly as the hero scrolls away: parallax that reads as
          // depth rather than as a sliding image.
          transform: "translate3d(calc(var(--px, 0) * -14px), calc(var(--sy, 0) * -36px), 0)",
        }}
        aria-hidden
      >
        <Bars className="text-line opacity-70" style={FADE_UP} />
        <Bars
          className="text-lime opacity-60"
          style={{
            // Two masks compose: the same top fade, plus a playhead sweeping
            // right with the scroll. Doing it this way keeps the whole thing on
            // the compositor — the alternative is recolouring 72 nodes on every
            // scroll frame from JS.
            maskImage: `${TOP_FADE}, linear-gradient(to right, #000 0%, #000 calc(var(--sy, 0) * 62% + 10%), transparent calc(var(--sy, 0) * 62% + 30%))`,
            WebkitMaskImage: `${TOP_FADE}, linear-gradient(to right, #000 0%, #000 calc(var(--sy, 0) * 62% + 10%), transparent calc(var(--sy, 0) * 62% + 30%))`,
            maskComposite: "intersect",
            WebkitMaskComposite: "source-in",
          }}
        />
      </div>

      {/* Brushed grain. */}
      <div className="pointer-events-none absolute inset-0 -z-10 brush-grain opacity-40" aria-hidden />

      {/* Vignette into the next section, so the stage has no bottom edge. */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-72 bg-gradient-to-b from-transparent to-void"
        aria-hidden
      />
    </>
  );
}

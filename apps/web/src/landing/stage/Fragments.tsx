import type { CSSProperties, ReactNode } from "react";
import { cn, useReducedMotion } from "@/ui";

/**
 * Pieces of the two tools, floating in the hero at different depths.
 *
 * This is the one thing Revolut's page does that no amount of copy can replace:
 * instead of a screenshot of the product in a browser frame, the product is
 * taken apart and its pieces are used as composition. A screenshot says "here is
 * an app". A transcript cue sitting in front of the headline says "here is the
 * thing the app makes", which is a much shorter sentence.
 *
 * Each fragment declares its own `depth`. Depth drives the parallax offset
 * (from `--px` / `--py`, written by `useStageParallax`) and nothing else — the
 * nearer the layer, the further it travels, which is what sells the space
 * between them.
 */

function Floating({
  depth,
  className,
  delay = "0s",
  children,
}: {
  depth: number;
  className?: string;
  delay?: string;
  children: ReactNode;
}) {
  const reduced = useReducedMotion();
  // Two nested elements on purpose: the outer one owns the parallax transform,
  // the inner one owns the float animation. One element cannot hold both, since
  // an animation's `transform` replaces the declared one outright.
  return (
    <div
      className={cn("pointer-events-none absolute", className)}
      style={
        {
          transform: `translate3d(calc(var(--px, 0) * ${depth * 44}px), calc(var(--py, 0) * ${depth * 32}px), 0)`,
        } as CSSProperties
      }
      aria-hidden
    >
      <div className={cn(!reduced && (depth > 0.6 ? "float-slow" : "float-slower"))} style={{ animationDelay: delay }}>
        {children}
      </div>
    </div>
  );
}

const SHELL =
  "rounded-2xl border border-line/80 bg-surface/80 shadow-pop backdrop-blur-xl";

/** A cue as the transcript panel draws it: timecode, waveform, words. */
function TranscriptCue() {
  const bars = [30, 62, 88, 54, 96, 71, 43, 80, 58, 34, 66, 90, 47, 25];
  return (
    <div className={cn(SHELL, "w-[16.5rem] p-3.5")}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] tabular-nums text-lime">0:01.2</span>
        <div className="flex h-3.5 flex-1 items-end gap-[2px]">
          {bars.map((h, i) => (
            <span
              key={i}
              className={cn("flex-1 rounded-full", i < 6 ? "bg-lime" : "bg-line-2")}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
      <p className="mt-2.5 font-display text-[15px] font-semibold leading-snug text-chalk">
        actually <span className="text-lime">keep</span> up
      </p>
    </div>
  );
}

/** One project, three aspect ratios — the Motion half, in one card. */
function AspectCard() {
  const ratios = [
    { label: "9:16", w: 15, h: 26 },
    { label: "4:5", w: 21, h: 26 },
    { label: "1:1", w: 26, h: 26 },
    { label: "16:9", w: 34, h: 19 },
  ];
  return (
    <div className={cn(SHELL, "w-[15rem] p-4")}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-dim">One project</p>
      <div className="mt-3 flex items-end gap-2.5">
        {ratios.map((r, i) => (
          <div key={r.label} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                "rounded-[4px] ring-1 ring-inset",
                i === 0 ? "bg-lime/25 ring-lime/50" : "bg-surface-2 ring-line-2",
              )}
              style={{ width: r.w, height: r.h }}
            />
            <span className={cn("font-mono text-[9px]", i === 0 ? "text-lime" : "text-dim")}>{r.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Placement is `lg:` only. At tablet width and below the stage is a single
 * column and these would be litter across the headline rather than depth
 * behind it.
 */
export function Fragments() {
  return (
    <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
      {/* The interleave. This one sits in FRONT of both the headline (z-10) and
          the device (z-20), bridging them — which is the whole trick: a layer
          that crosses two other layers is what turns a background into a space.
          Everything else on the stage is behind it. */}
      {/* Offsets here are against the whole stage, not the content container —
          this element is `inset-0` on the stage. `right-[23%]` puts the card's
          left edge inside the tail of "Animate it." at every width from `lg`
          up, and `top-[41%]` crosses the line low enough that the glyphs stay
          readable above it — a card sitting at mid-x-height reads as a missing
          character rather than as a nearer layer. It also drops clear of the
          device's own style chip, which the previous placement sat on top of. */}
      <Floating depth={1} className="right-[23%] top-[41%] z-30" delay="-2.2s">
        <TranscriptCue />
      </Floating>

      {/* Below the device — the furthest layer, so it barely moves. */}
      <Floating depth={0.3} className="bottom-[15%] right-[4%]" delay="-1.1s">
        <AspectCard />
      </Floating>
    </div>
  );
}

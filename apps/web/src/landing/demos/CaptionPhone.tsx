import { useEffect, useRef, useState } from "react";
import { cn, useReducedMotion } from "@/ui";

const WORDS = ["CAPTIONS", "THAT", "ACTUALLY", "KEEP", "UP"];
const CYCLE_MS = 560;
const MAX_TILT = 7; // degrees

/**
 * The hero's Captions demo: a phone frame where the karaoke highlight walks the
 * line word by word, exactly the way the real renderer moves it.
 *
 * The "footage" underneath is a CSS gradient rather than a bundled video. A
 * real clip would be a megabyte on the critical path and, worse, would be
 * someone else's footage on a page whose whole argument is that your footage
 * stays yours.
 */
export function CaptionPhone({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) {
      setActive(3); // hold "KEEP" highlighted
      return;
    }
    const id = window.setInterval(() => setActive((i) => (i + 1) % WORDS.length), CYCLE_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  const onPointerMove = (e: React.PointerEvent) => {
    if (reduced) return;
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -py * MAX_TILT, y: px * MAX_TILT });
  };

  return (
    <div
      ref={frameRef}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      style={{ perspective: "1200px" }}
      className={cn("relative select-none", className)}
    >
      {/* Accent aura behind the device. */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-8 -z-10 rounded-full bg-lime/20 blur-3xl",
          !reduced && "animate-[jima-pulse-glow_5s_ease-in-out_infinite]",
        )}
        aria-hidden
      />

      <div
        className="transition-transform duration-300 ease-out"
        style={{ transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)` }}
      >
        <div
          className={cn(
            "relative aspect-[9/16] w-full overflow-hidden rounded-[30px] border-[7px] border-surface-3 bg-void shadow-pop",
            !reduced && "float-slow",
          )}
        >
          <div className="relative h-full w-full overflow-hidden rounded-[23px]">
            {/* Stand-in "footage". */}
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(120% 90% at 20% 8%, #2b3a12 0%, #17331f 30%, #0f2733 62%, #0a0d16 100%)",
              }}
              aria-hidden
            />
            <div
              className={cn("absolute inset-0 opacity-70", !reduced && "float-slower")}
              style={{
                backgroundImage:
                  "radial-gradient(38% 26% at 72% 26%, rgba(200,255,61,0.32) 0%, transparent 70%), radial-gradient(44% 30% at 26% 74%, rgba(103,232,249,0.22) 0%, transparent 72%)",
              }}
              aria-hidden
            />
            <div className="absolute inset-0 bg-gradient-to-t from-void/70 via-transparent to-void/25" aria-hidden />

            {/* Transport chip. */}
            <div className="absolute left-3.5 top-3.5 flex items-center gap-1.5 rounded-full bg-void/60 px-2.5 py-1 font-mono text-[10px] text-chalk/90 backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden />
              0:03 / 0:14
            </div>

            {/* The caption line. */}
            <div className="absolute inset-x-0 bottom-[18%] flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-5 text-center">
              {WORDS.map((word, i) => (
                <span
                  key={word}
                  className="inline-block text-[clamp(19px,4.4cqw,30px)] uppercase leading-none tracking-tight transition-all duration-200"
                  style={{
                    fontFamily: "Anton, var(--font-display)",
                    color: i === active ? "#C8FF3D" : "#ffffff",
                    transform: i === active && !reduced ? "translateY(-2px) scale(1.07)" : "none",
                    textShadow: "0 2px 12px rgba(0,0,0,0.65)",
                  }}
                >
                  {word}
                </span>
              ))}
            </div>

            {/* Waveform strip — the audio the captions came from. */}
            <div className="absolute inset-x-4 bottom-4 flex h-6 items-end gap-[3px]" aria-hidden>
              {BARS.map((h, i) => (
                <span
                  key={i}
                  className="flex-1 rounded-full transition-all duration-300"
                  style={{
                    height: `${h}%`,
                    background: i / BARS.length < (active + 1) / WORDS.length ? "#C8FF3D" : "rgba(255,255,255,0.22)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Floating chips — the two things people ask about first. */}
      <div
        className={cn(
          "absolute -left-5 top-[22%] hidden rounded-2xl border border-line bg-surface/90 px-3.5 py-2.5 shadow-pop backdrop-blur-md sm:block",
          !reduced && "float-slower",
        )}
        aria-hidden
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-dim">Style</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="h-4 w-4 rounded-full bg-lime ring-2 ring-surface" />
          <span className="h-4 w-4 rounded-full bg-white ring-2 ring-surface" />
          <span className="h-4 w-4 rounded-full bg-violet ring-2 ring-surface" />
          <span className="ml-1 text-[13px] leading-none text-chalk" style={{ fontFamily: "Anton, var(--font-display)" }}>
            Aa
          </span>
        </div>
      </div>

      <div
        className={cn(
          "absolute -right-4 bottom-[16%] hidden items-center gap-2 rounded-full border border-line bg-surface/90 py-2 pl-2.5 pr-4 shadow-pop backdrop-blur-md sm:flex",
          !reduced && "float-slow",
        )}
        style={{ animationDelay: "1.4s" }}
        aria-hidden
      >
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-lime text-void">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 13 4 4L19 7" />
          </svg>
        </span>
        <span className="text-[12px] font-semibold text-chalk">Exported · full quality</span>
      </div>
    </div>
  );
}

/** A fixed, hand-picked waveform. Deliberately not random — it must not change
    between renders, or the strip flickers on every state update. */
const BARS = [22, 38, 61, 44, 78, 92, 66, 41, 55, 83, 70, 48, 31, 58, 74, 96, 62, 39, 50, 68, 45, 28, 36, 24];

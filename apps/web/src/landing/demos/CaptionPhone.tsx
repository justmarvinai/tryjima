import { useEffect, useRef, useState } from "react";
import { loadFont } from "@jima/captions/fonts";
import { cn, useReducedMotion } from "@/ui";

/**
 * The hero's Captions demo: a phone, turned a few degrees off-axis, with the
 * karaoke highlight walking the caption line word by word exactly the way the
 * real renderer moves it.
 *
 * The device is drawn rather than photographed — a titanium rail, a black
 * bezel, the Dynamic Island, the side buttons and the home indicator — because
 * a device photo would be a stock asset with a licence attached and a few
 * hundred kilobytes on the critical path.
 *
 * The "footage" underneath is a CSS scene: a night grade, a rack of out-of-focus
 * bokeh, a slow push, and a grain layer. That last one does most of the work —
 * grain is what separates "video" from "gradient". A real clip is off the table
 * for the same reason as the device: it would be a megabyte on the critical path
 * and, worse, someone else's footage on a page whose whole argument is that your
 * footage stays yours. It is a stand-in and does not pretend otherwise.
 *
 * Nothing here boots WebGL. The hero has to paint before the Motion engine is
 * even downloaded (`TemplateStrip` below it is lazy for exactly that reason), so
 * this is CSS, one webfont, and a timer.
 */

/** Word timings, not a metronome — real speech does not land on a fixed beat. */
const WORDS: { text: string; ms: number }[] = [
  { text: "CAPTIONS", ms: 520 },
  { text: "THAT", ms: 260 },
  { text: "ACTUALLY", ms: 500 },
  { text: "KEEP", ms: 300 },
  { text: "UP", ms: 900 },
];
const TOTAL_MS = WORDS.reduce((a, w) => a + w.ms, 0);
/** Fraction of the line complete at the END of word i — drives bar + timecode. */
const PROGRESS_AT = WORDS.map((_, i) => WORDS.slice(0, i + 1).reduce((a, w) => a + w.ms, 0) / TOTAL_MS);

/**
 * The line is one cue *inside* a clip, not the whole clip — so the transport
 * reads 0:03 → 0:07 of 0:14 rather than running the counter to the end and
 * sitting there, which looks like a stalled player.
 */
const CLIP_SECONDS = 14;
const LINE_START_S = 3.2;
const LINE_LENGTH_S = 3.6;

const MAX_TILT = 5; // degrees of pointer parallax, on top of the resting angle

/**
 * The resting three-axis angle. Turned to face the headline on its left, and
 * leaning back on its corner the way a product shot stands a device up rather
 * than standing it to attention — a real photograph of one of these is never
 * square to the frame.
 */
const REST = { x: 3, y: -16, z: 16 };

/**
 * Fixed, hand-placed bokeh — deliberately not random: it must not move between
 * renders, and `Math.random` has no business in a component.
 *
 * Each disc gets a brighter rim just inside its edge, because that is what an
 * out-of-focus highlight actually looks like through a fast lens. A plain
 * radial fade reads as a smudge; the rim is what makes it read as a light.
 */
const BOKEH = [
  { x: 12, y: 7, s: 92, rgb: "255,205,130", a: 0.3, blur: 8, delay: "0s" },
  { x: 68, y: 3, s: 126, rgb: "200,255,61", a: 0.18, blur: 14, delay: "-3.5s" },
  { x: 47, y: 15, s: 46, rgb: "255,238,196", a: 0.42, blur: 4, delay: "-6s" },
  { x: 84, y: 19, s: 68, rgb: "255,190,110", a: 0.28, blur: 7, delay: "-1.2s" },
  { x: 20, y: 25, s: 58, rgb: "120,220,255", a: 0.22, blur: 6, delay: "-4.6s" },
  { x: 60, y: 29, s: 106, rgb: "190,240,90", a: 0.16, blur: 12, delay: "-2.4s" },
  { x: 6, y: 37, s: 76, rgb: "255,214,150", a: 0.24, blur: 9, delay: "-5.2s" },
  { x: 42, y: 41, s: 38, rgb: "255,246,222", a: 0.36, blur: 3, delay: "-0.9s" },
  { x: 78, y: 45, s: 90, rgb: "100,200,240", a: 0.18, blur: 10, delay: "-7.1s" },
  { x: 28, y: 51, s: 62, rgb: "255,200,120", a: 0.26, blur: 6, delay: "-2.9s" },
  { x: 64, y: 57, s: 44, rgb: "210,255,120", a: 0.3, blur: 4, delay: "-6.4s" },
  { x: 9, y: 63, s: 98, rgb: "90,180,230", a: 0.16, blur: 12, delay: "-1.6s" },
  { x: 50, y: 69, s: 56, rgb: "255,222,160", a: 0.24, blur: 6, delay: "-4.1s" },
  { x: 82, y: 74, s: 72, rgb: "200,255,61", a: 0.18, blur: 8, delay: "-3.1s" },
];

/** Film grain, inline so it costs no request. feTurbulence at a high base
    frequency is the cheapest convincing grain there is. */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23g)'/%3E%3C/svg%3E\")";

/** A fixed, hand-picked waveform — random bars would re-shuffle on every render. */
const BARS = [
  22, 38, 61, 44, 78, 92, 66, 41, 55, 83, 70, 48, 31, 58, 74, 96, 62, 39, 50, 68, 45, 28, 36, 24, 47, 71, 86, 53,
];

function timecode(seconds: number): string {
  const s = Math.max(0, Math.min(CLIP_SECONDS, Math.round(seconds)));
  return `0:${String(s).padStart(2, "0")}`;
}

export function CaptionPhone({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const frameRef = useRef<HTMLDivElement>(null);

  // Anton is the default caption face and is loaded on demand through the
  // FontFace loader, not declared in CSS — without this the demo renders in the
  // UI font and stops looking like a caption.
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    let alive = true;
    void loadFont("anton-400")
      .then(() => alive && setFontReady(true))
      .catch(() => alive && setFontReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (reduced) {
      setActive(3); // hold "KEEP" highlighted
      return;
    }
    let timer = 0;
    const step = (i: number) => {
      setActive(i);
      timer = window.setTimeout(() => step((i + 1) % WORDS.length), WORDS[i]?.ms ?? 400);
    };
    step(0);
    return () => window.clearTimeout(timer);
  }, [reduced]);

  /** How far through the caption line we are — drives the waveform fill. */
  const progress = PROGRESS_AT[active] ?? 0;
  /** Where that puts us in the clip — drives the transport and the scrub bar. */
  const clipSeconds = LINE_START_S + progress * LINE_LENGTH_S;

  const onPointerMove = (e: React.PointerEvent) => {
    if (reduced) return;
    const el = frameRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: -py * MAX_TILT, y: px * MAX_TILT });
  };

  const captionFont = fontReady ? "Anton, var(--font-display)" : "var(--font-display)";

  return (
    <div
      ref={frameRef}
      onPointerMove={onPointerMove}
      onPointerLeave={() => setTilt({ x: 0, y: 0 })}
      style={{ perspective: "1500px" }}
      className={cn("relative select-none", className)}
    >
      {/* Accent aura behind the device. */}
      <div
        className={cn(
          "pointer-events-none absolute -inset-10 -z-10 rounded-full bg-lime/20 blur-3xl",
          !reduced && "animate-[jima-pulse-glow_5s_ease-in-out_infinite]",
        )}
        aria-hidden
      />

      <div
        className="mx-auto w-full max-w-[15.75rem] transition-transform duration-500 ease-out sm:max-w-[16.75rem]"
        style={{
          transform: `rotateX(${REST.x + tilt.x}deg) rotateY(${REST.y + tilt.y}deg) rotateZ(${REST.z}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        <div className={cn("relative", !reduced && "float-slow")}>
          {/* Contact shadow. Offset right and down: the page's light comes from
              the upper left, and the device is turned away from it. */}
          <div
            className="pointer-events-none absolute inset-x-[6%] -bottom-5 h-10 rounded-[50%] bg-black/70 blur-2xl"
            aria-hidden
          />

          {/* Side buttons, tucked under the rail so only their faces show. */}
          <span className="absolute -left-[2px] top-[17%] h-[26px] w-[3px] rounded-l-[2px] bg-gradient-to-b from-[#6b727c] to-[#2a2f36]" aria-hidden />
          <span className="absolute -left-[2px] top-[25%] h-[42px] w-[3px] rounded-l-[2px] bg-gradient-to-b from-[#6b727c] to-[#2a2f36]" aria-hidden />
          <span className="absolute -left-[2px] top-[35%] h-[42px] w-[3px] rounded-l-[2px] bg-gradient-to-b from-[#6b727c] to-[#2a2f36]" aria-hidden />
          <span className="absolute -right-[2px] top-[27%] h-[64px] w-[3px] rounded-r-[2px] bg-gradient-to-b from-[#6b727c] to-[#2a2f36]" aria-hidden />

          {/* Titanium rail — a single gradient doing brushed metal: bright at the
              two edges the light catches, dark across the face. */}
          <div
            className="relative rounded-[2.6rem] p-[3px] shadow-pop"
            style={{
              backgroundImage:
                "linear-gradient(115deg,#7d848e 0%,#3a4048 12%,#181c22 38%,#12151a 62%,#39404a 86%,#858c96 100%)",
            }}
          >
            {/* Bezel. */}
            <div className="relative rounded-[2.42rem] bg-black p-[7px]">
              {/* Screen. `container-type: inline-size` is load-bearing: the
                  caption sizes itself in `cqw`, and with no container to measure
                  the whole clamp is invalid and the text falls back to the
                  inherited size. */}
              <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2rem] bg-void [container-type:inline-size]">
                {/* ── the "footage" ─────────────────────────────────────── */}
                <div className={cn("absolute inset-0", !reduced && "drift-slow")} aria-hidden>
                  {/* Night grade: warm key top right, cool fill bottom left. */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "radial-gradient(125% 68% at 80% 0%, #6d5f21 0%, #33594a 20%, #1e4864 44%, #16273c 70%, #0b111c 100%)",
                    }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "radial-gradient(70% 40% at 6% 88%, rgba(70,140,190,0.30) 0%, transparent 72%)",
                    }}
                  />
                  {/* Out-of-focus lights. */}
                  {BOKEH.map((b, i) => (
                    <span
                      key={i}
                      className={cn("absolute rounded-full", !reduced && (i % 2 ? "float-slower" : "float-slow"))}
                      style={{
                        left: `${b.x}%`,
                        top: `${b.y}%`,
                        width: b.s,
                        height: b.s,
                        background: `radial-gradient(circle, rgba(${b.rgb},${b.a}) 0%, rgba(${b.rgb},${(b.a * 0.85).toFixed(3)}) 54%, rgba(${b.rgb},${Math.min(0.9, b.a * 1.9).toFixed(3)}) 69%, transparent 73%)`,
                        filter: `blur(${b.blur}px)`,
                        animationDelay: b.delay,
                      }}
                    />
                  ))}
                  {/* Warm key light spilling in from the top right. */}
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage:
                        "radial-gradient(36% 20% at 84% 10%, rgba(255,222,158,0.40) 0%, transparent 72%)",
                    }}
                  />
                  {/* A soft anamorphic streak across the key — pure lens. */}
                  <div
                    className="absolute inset-x-0 top-[11%] h-[3px] opacity-45 blur-[3px]"
                    style={{
                      backgroundImage:
                        "linear-gradient(to right, transparent 0%, rgba(255,226,170,0.65) 40%, rgba(255,240,210,0.8) 58%, transparent 100%)",
                    }}
                  />
                </div>

                {/* Grain sits outside the drift so it stays pinned to the sensor,
                    which is what makes it read as grain and not as texture. */}
                <div
                  className="absolute inset-0 opacity-[0.22] mix-blend-overlay"
                  style={{ backgroundImage: GRAIN, backgroundSize: "140px 140px" }}
                  aria-hidden
                />

                {/* Depth: darken the edges, and lay a scrim under the captions. */}
                <div
                  className="absolute inset-0"
                  style={{ boxShadow: "inset 0 0 64px 8px rgba(4,6,10,0.55)" }}
                  aria-hidden
                />
                <div
                  className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-void/85 via-void/25 to-transparent"
                  aria-hidden
                />

                {/* ── on-screen UI ──────────────────────────────────────── */}
                <StatusBar />

                {/* Dynamic Island. */}
                <div
                  className="absolute left-1/2 top-[9px] z-20 flex h-[26px] w-[30%] -translate-x-1/2 items-center justify-end rounded-full bg-black pr-[7px]"
                  aria-hidden
                >
                  <span
                    className="h-[9px] w-[9px] rounded-full"
                    style={{ background: "radial-gradient(circle at 35% 30%, #2b3a52 0%, #0a0f18 70%)" }}
                  />
                </div>

                {/* Transport chip. */}
                <div className="absolute left-3 top-[46px] flex items-center gap-1.5 rounded-full bg-void/70 px-2.5 py-1 font-mono text-[10px] text-chalk/90">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden />
                  {timecode(clipSeconds)} / {timecode(CLIP_SECONDS)}
                </div>

                {/* The caption line. */}
                {/* Font size lives on the row, not the words: the inter-word gap
                    is an `em` and has to measure against the caption size, not
                    the inherited 16px. */}
                <div
                  className="absolute inset-x-0 bottom-[17%] flex flex-wrap items-center justify-center gap-x-[0.3em] gap-y-[0.12em] px-4 text-center text-[clamp(20px,10.5cqw,32px)]"
                  style={{ fontFamily: captionFont }}
                >
                  {WORDS.map((word, i) => (
                    <span
                      key={word.text}
                      className="inline-block uppercase leading-[1.06] tracking-tight transition-all duration-200 ease-out"
                      style={{
                        color: i === active ? "#C8FF3D" : "#ffffff",
                        transform: i === active && !reduced ? "translateY(-2px) scale(1.08)" : "none",
                        // Same recipe the real renderer uses at its defaults: a
                        // thin dark stroke to survive a bright frame, plus a soft
                        // drop shadow to lift it off the video.
                        WebkitTextStroke: "1px rgba(6,8,12,0.55)",
                        textShadow: "0 2px 14px rgba(0,0,0,0.7)",
                      }}
                    >
                      {word.text}
                    </span>
                  ))}
                </div>

                {/* Waveform doubling as the scrub bar. */}
                <div className="absolute inset-x-4 bottom-[26px]" aria-hidden>
                  <div className="flex h-6 items-end gap-[2px]">
                    {BARS.map((h, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-full transition-colors duration-200"
                        style={{
                          height: `${h}%`,
                          background: i / BARS.length <= progress ? "#C8FF3D" : "rgba(255,255,255,0.24)",
                        }}
                      />
                    ))}
                  </div>
                  <div className="relative mt-2 h-[3px] rounded-full bg-white/20">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full bg-lime transition-[width] duration-300 ease-out"
                      style={{ width: `${(clipSeconds / CLIP_SECONDS) * 100}%` }}
                    />
                  </div>
                </div>

                {/* Home indicator. */}
                <span
                  className="absolute bottom-[7px] left-1/2 h-[4px] w-[32%] -translate-x-1/2 rounded-full bg-white/65"
                  aria-hidden
                />

                {/* Glass: one diagonal sheen across the whole panel. */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(128deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.03) 26%, transparent 46%)",
                  }}
                  aria-hidden
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating chips — the two things people ask about first. Left flat while
          the device is turned, so they read as app chrome in front of it rather
          than as stickers on the glass. */}
      <div
        className={cn(
          "absolute -left-4 top-[20%] hidden rounded-2xl border border-line bg-surface/95 px-3.5 py-2.5 shadow-pop backdrop-blur-md sm:block",
          !reduced && "float-slower",
        )}
        aria-hidden
      >
        <p className="text-[10px] font-semibold uppercase tracking-wider text-dim">Style</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="h-4 w-4 rounded-full bg-lime ring-2 ring-surface" />
          <span className="h-4 w-4 rounded-full bg-white ring-2 ring-surface" />
          <span className="h-4 w-4 rounded-full bg-violet ring-2 ring-surface" />
          <span className="ml-1 text-[13px] leading-none text-chalk" style={{ fontFamily: captionFont }}>
            Aa
          </span>
        </div>
      </div>

      <div
        className={cn(
          "absolute -bottom-3 -right-5 hidden items-center gap-2 rounded-full border border-line bg-surface/95 py-2 pl-2.5 pr-4 shadow-pop backdrop-blur-md sm:flex",
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

/** iOS status bar: clock on the left, radios and battery on the right. */
function StatusBar() {
  return (
    <div
      className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-6 pt-[14px] text-white"
      aria-hidden
    >
      <span className="text-[11px] font-semibold tracking-tight">9:41</span>
      <div className="flex items-center gap-[5px]">
        {/* Cellular. */}
        <svg width="15" height="10" viewBox="0 0 15 10" fill="currentColor">
          <rect x="0" y="7" width="2.6" height="3" rx="0.8" />
          <rect x="4.1" y="5" width="2.6" height="5" rx="0.8" />
          <rect x="8.2" y="2.6" width="2.6" height="7.4" rx="0.8" />
          <rect x="12.3" y="0" width="2.6" height="10" rx="0.8" />
        </svg>
        {/* Wi-Fi. */}
        <svg width="13" height="10" viewBox="0 0 13 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M1 3.4a8.4 8.4 0 0 1 11 0" />
          <path d="M3.2 5.9a5.1 5.1 0 0 1 6.6 0" />
          <path d="M5.4 8.3a1.9 1.9 0 0 1 2.2 0" />
        </svg>
        {/* Battery. */}
        <svg width="25" height="12" viewBox="0 0 25 12" className="h-[10px] w-[21px]" fill="none">
          <rect x="0.6" y="0.6" width="20" height="10.8" rx="3" stroke="currentColor" strokeOpacity="0.5" strokeWidth="1.2" />
          <rect x="2.4" y="2.4" width="13.5" height="7.2" rx="1.8" fill="currentColor" />
          <path d="M22.4 4.2v3.6a2.2 2.2 0 0 0 0-3.6Z" fill="currentColor" fillOpacity="0.5" />
        </svg>
      </div>
    </div>
  );
}

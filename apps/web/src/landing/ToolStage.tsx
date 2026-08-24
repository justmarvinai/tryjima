import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { TEMPLATE_COUNT } from "@jima/templates/durations";
import {
  buttonClasses,
  cn,
  Container,
  ArrowRightIcon,
  CheckIcon,
  CaptionsIcon,
  MotionIcon,
  useReducedMotion,
} from "@/ui";

/**
 * The two tools, as one stage you switch between rather than two cards side by
 * side.
 *
 * A pair of feature cards is the single most over-used block on the web, and it
 * makes the two tools look like two products. One stage with a switch makes the
 * actual argument — same brand, same kit, same tab, two jobs — and it gives the
 * visitor something to do thirty seconds into the page, which a card grid never
 * does.
 *
 * The art is CSS, not the engine. Real template rendering is one section down in
 * the marquee and up in the hero rail; pulling the 2.7 MB registry into the
 * landing's own chunk to animate a decorative panel would be a bad trade.
 */

type ToolId = "captions" | "motion";

interface Tool {
  id: ToolId;
  name: string;
  short: string;
  lede: string;
  bullets: string[];
  cta: string;
  to: string;
  icon: typeof CaptionsIcon;
  /** Three steps, start to export. Folded in here rather than living in a
      "how it works" section of its own — the same three steps stated twice on
      one page is padding, not clarity. */
  steps: [string, string][];
}

const TOOLS: Tool[] = [
  {
    id: "captions",
    name: "Jima Captions",
    short: "Captions",
    lede: "Drop in an MP4. A speech model runs on your own device, times every word, and you style the result until it looks like yours.",
    bullets: [
      "Word-level timing — the highlight lands on the syllable",
      "English and German, detected automatically",
      "Fix a name, cut the ums, redraw the line breaks",
      "Burn in at source quality, or write .srt / .vtt",
    ],
    cta: "Caption a video",
    to: "/captions",
    icon: CaptionsIcon,
    steps: [
      ["Drop an MP4", "Up to 200 MB and 60 seconds, read from disk"],
      ["It listens", "Whisper runs on your GPU and timestamps every word"],
      ["Style and export", "Drag it into place, burn it in at source quality"],
    ],
  },
  {
    id: "motion",
    name: "Jima Motion",
    short: "Motion",
    lede: `Start from one of ${TEMPLATE_COUNT} designed templates, type your words, pick your colours — and export an animation that looks made, not generated.`,
    bullets: [
      `${TEMPLATE_COUNT} templates across 9 use cases, all editable`,
      "1:1, 4:5, 9:16 and 16:9 from the same project",
      "Optional motion-matched sound, synthesised on the fly",
      "MP4, WebM (transparent too) and GIF, up to 1080p",
    ],
    cta: "Browse templates",
    to: "/motion",
    icon: MotionIcon,
    steps: [
      ["Pick a template", `${TEMPLATE_COUNT} of them, filtered by what you're posting`],
      ["Make it yours", "Your words, colours, fonts, aspect ratio and pace"],
      ["Export", "MP4, WebM — transparent if you want — or a GIF"],
    ],
  },
];

export function ToolStage() {
  const [active, setActive] = useState<ToolId>("captions");
  const base = useId();

  return (
    <section id="tools" className="relative overflow-hidden border-t border-line bg-void py-20 sm:py-28" aria-labelledby="tools-title">
      <div className="pointer-events-none absolute inset-0 -z-10 brush-grain opacity-25" aria-hidden />

      <Container>
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-end">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime">The two tools</p>
            <h2 id="tools-title" className="headline-xl mt-4 text-[clamp(2.25rem,5vw,3.75rem)] text-chalk">
              One brand. Two jobs.
            </h2>
          </div>

          {/* The switch. A real tablist, so arrow keys work and the panel is
              announced as the tab's content rather than as a separate region. */}
          <div
            role="tablist"
            aria-label="Choose a tool"
            className="relative flex w-full shrink-0 rounded-full border border-line bg-surface p-1.5 sm:w-auto"
          >
            <span
              aria-hidden
              className="absolute inset-y-1.5 w-[calc(50%-0.375rem)] rounded-full bg-lime transition-transform duration-300 ease-[var(--ease-out-expo)]"
              style={{ transform: active === "motion" ? "translateX(100%)" : "translateX(0)" }}
            />
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const selected = t.id === active;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  id={`${base}-tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls={`${base}-panel-${t.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActive(t.id)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                      e.preventDefault();
                      setActive((v) => (v === "captions" ? "motion" : "captions"));
                    }
                  }}
                  className={cn(
                    "relative z-10 flex flex-1 items-center justify-center gap-2 rounded-full px-6 py-2.5 text-[15px] font-semibold transition-colors duration-200 sm:flex-none",
                    selected ? "text-void" : "text-ash hover:text-chalk",
                  )}
                >
                  <Icon width={17} height={17} />
                  {t.short}
                </button>
              );
            })}
          </div>
        </div>

        {TOOLS.map((t) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`${base}-panel-${t.id}`}
            aria-labelledby={`${base}-tab-${t.id}`}
            hidden={t.id !== active}
            className="mt-12"
          >
            <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
              <div className="flex flex-col rounded-bento border border-line bg-surface p-7 sm:p-9">
                <h3 className="font-display text-2xl font-bold tracking-tight text-chalk">{t.name}</h3>
                <p className="mt-4 text-[15.5px] leading-relaxed text-ash">{t.lede}</p>

                <ul className="mt-7 flex flex-col gap-3">
                  {t.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2.5 text-[14px] leading-snug text-silver">
                      <CheckIcon width={15} height={15} className="mt-0.5 shrink-0 text-lime" />
                      {b}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto pt-9">
                  <Link to={t.to} className={cn(buttonClasses("primary", "md"), "group w-full sm:w-auto")}>
                    {t.cta}
                    <ArrowRightIcon
                      width={16}
                      height={16}
                      className="transition-transform group-hover:translate-x-0.5"
                    />
                  </Link>
                </div>
              </div>

              <div className="min-h-[22rem] overflow-hidden rounded-bento border border-line bg-shell">
                {t.id === "captions" ? <CaptionsArt live={t.id === active} /> : <MotionArt live={t.id === active} />}
              </div>
            </div>

            <ol className="mt-6 grid gap-px overflow-hidden rounded-bento border border-line bg-line sm:grid-cols-3">
              {t.steps.map(([title, body], i) => (
                <li key={title} className="bg-surface p-6">
                  <span className="font-mono text-[11px] tabular-nums text-lime">0{i + 1}</span>
                  <p className="mt-2 font-display text-[15px] font-semibold text-chalk">{title}</p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-ash">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </Container>
    </section>
  );
}

/* ---- Panel art ------------------------------------------------------- */

const CAP_WORDS = ["this", "is", "what", "it", "looks", "like"];
const CAP_CYCLE = 3.6; // seconds

/** The Captions panel: a frame with a caption line, and the transcript beside it. */
function CaptionsArt({ live }: { live: boolean }) {
  const reduced = useReducedMotion();
  const cues = [
    { t: "0:00.0", text: "so here is the thing", on: false },
    { t: "0:01.4", text: "this is what it looks like", on: true },
    { t: "0:03.2", text: "every word, on its own beat", on: false },
  ];

  return (
    <div className="flex h-full flex-col gap-4 p-5 sm:flex-row">
      {/* The frame. Same night grade as the hero device, at panel scale. */}
      <div className="relative aspect-[9/13] w-full shrink-0 overflow-hidden rounded-panel bg-void sm:aspect-auto sm:w-[46%]">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(120% 66% at 78% 4%, #6d5f21 0%, #33594a 20%, #1e4864 46%, #16273c 72%, #0b111c 100%)",
          }}
          aria-hidden
        />
        {[
          { x: 16, y: 14, s: 74, c: "255,205,130", a: 0.3 },
          { x: 66, y: 30, s: 96, c: "200,255,61", a: 0.16 },
          { x: 28, y: 52, s: 58, c: "120,220,255", a: 0.2 },
        ].map((b, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute rounded-full"
            style={{
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: b.s,
              height: b.s,
              background: `radial-gradient(circle, rgba(${b.c},${b.a}) 0%, rgba(${b.c},${b.a * 1.8}) 68%, transparent 72%)`,
              filter: "blur(7px)",
            }}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-void/85 via-transparent to-transparent" aria-hidden />

        <p className="absolute inset-x-4 bottom-6 text-center font-display text-[clamp(15px,3.4vw,21px)] font-extrabold uppercase leading-tight tracking-tight">
          {CAP_WORDS.map((w, i) => (
            <span
              key={w}
              className={cn("mx-[0.12em] inline-block text-white", live && !reduced && "karaoke")}
              style={
                live && !reduced
                  ? { animationDuration: `${CAP_CYCLE}s`, animationDelay: `${(i * CAP_CYCLE) / CAP_WORDS.length}s` }
                  : i === 3
                    ? { color: "var(--color-lime)" }
                    : undefined
              }
            >
              {w}
            </span>
          ))}
        </p>
      </div>

      {/* The transcript panel. */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <p className="px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-dim">Transcript</p>
        {cues.map((c) => (
          <div
            key={c.t}
            className={cn(
              "rounded-xl px-3.5 py-3 ring-1 ring-inset",
              c.on ? "bg-lime-tint ring-lime/30" : "bg-surface ring-line",
            )}
          >
            <span className="font-mono text-[10px] tabular-nums text-dim">{c.t}</span>
            <p className={cn("mt-1 text-[13.5px] leading-snug", c.on ? "text-chalk" : "text-ash")}>{c.text}</p>
          </div>
        ))}
        <div className="mt-auto flex items-center gap-2 rounded-xl bg-surface px-3.5 py-2.5 ring-1 ring-inset ring-line">
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-lime" aria-hidden />
          <span className="text-[11.5px] text-dim">Runs on your device — nothing is sent anywhere</span>
        </div>
      </div>
    </div>
  );
}

/**
 * The Motion panel: a white artboard on the dark shell.
 *
 * The one place on the landing where something is genuinely bright, and it is
 * the artboard — which is the design system's whole rule ("dark shell, light
 * canvas") stated in one picture rather than in a paragraph.
 */
function MotionArt({ live }: { live: boolean }) {
  const reduced = useReducedMotion();
  const animate = live && !reduced;

  return (
    <div className="flex h-full flex-col justify-center gap-4 stage-dots p-5">
      <div className="relative mx-auto aspect-[16/10] w-full max-w-[30rem] overflow-hidden rounded-panel bg-artboard shadow-stage">
        <div className="absolute inset-0 flex flex-col justify-center px-8">
          <span
            className={cn("block h-[6px] w-16 origin-left rounded-full bg-lime-deep", animate && "mini-wipe")}
            aria-hidden
          />
          <p
            className={cn(
              "mt-4 font-display text-[clamp(22px,4.4vw,38px)] font-extrabold leading-[0.95] tracking-tight text-void",
              animate && "mini-rise",
            )}
          >
            Make every
            <br />
            post move.
          </p>
          <p
            className={cn("mt-3 text-[13px] font-medium text-void/55", animate && "mini-rise")}
            style={animate ? { animationDelay: "0.35s" } : undefined}
          >
            495 templates · edit every word
          </p>
        </div>
        <span className="absolute right-4 top-4 rounded-full bg-void/8 px-2.5 py-1 font-mono text-[10px] text-void/60">
          16:9
        </span>
      </div>

      <div className="mx-auto flex flex-wrap items-center justify-center gap-2">
        {["9:16", "4:5", "1:1", "16:9"].map((r, i) => (
          <span
            key={r}
            className={cn(
              "rounded-full px-3 py-1.5 font-mono text-[11px] ring-1 ring-inset",
              i === 3 ? "bg-lime-tint text-lime ring-lime/30" : "bg-surface text-dim ring-line",
            )}
          >
            {r}
          </span>
        ))}
      </div>
    </div>
  );
}

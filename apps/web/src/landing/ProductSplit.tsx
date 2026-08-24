import { Link } from "react-router-dom";
import { TEMPLATE_COUNT } from "@jima/templates/durations";
import {
  buttonClasses,
  cn,
  Container,
  Reveal,
  SectionHeading,
  ArrowRightIcon,
  CheckIcon,
  CaptionsIcon,
  MotionIcon,
} from "@/ui";

interface ToolCard {
  id: string;
  name: string;
  lede: string;
  bullets: string[];
  cta: string;
  to: string;
  icon: typeof CaptionsIcon;
  art: React.ReactNode;
}

const CARDS: ToolCard[] = [
  {
    id: "captions",
    name: "Jima Captions",
    lede: "Drop in an MP4. A speech model runs on your own device, times every word, and you style the result until it looks like yours.",
    bullets: [
      "Word-level timing — the highlight lands on the syllable",
      "English & German, detected automatically",
      "Edit the words, fix a name, strip the ums in one click",
      "Burn in at full source quality, or export .srt / .vtt",
    ],
    cta: "Caption a video",
    to: "/captions",
    icon: CaptionsIcon,
    art: <CaptionsArt />,
  },
  {
    id: "motion",
    name: "Jima Motion",
    lede: `Start from one of ${TEMPLATE_COUNT} designed templates, type your words, pick your colours — and export an animation that looks made, not generated.`,
    bullets: [
      `${TEMPLATE_COUNT} templates across 9 use cases, all editable`,
      "1:1, 4:5, 9:16 and 16:9 from the same project",
      "Optional motion-matched sound, synthesised on the fly",
      "MP4, WebM (incl. transparent) and GIF, up to 1080p",
    ],
    cta: "Browse templates",
    to: "/motion",
    icon: MotionIcon,
    art: <MotionArt />,
  },
];

export function ProductSplit() {
  return (
    <section id="tools" className="border-t border-line bg-void py-20 sm:py-28" aria-labelledby="tools-title">
      <Container>
        <SectionHeading
          eyebrow="The two tools"
          title={
            <span id="tools-title">
              One brand. Two jobs.
            </span>
          }
          lead="Captions makes what you said readable. Motion makes what you post look designed. They share a brand kit, a projects list and a keyboard shortcut — and nothing else about them is duplicated."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {CARDS.map((card, i) => {
            const Icon = card.icon;
            return (
              <Reveal key={card.id} delay={i * 90}>
                <article className="group flex h-full flex-col overflow-hidden rounded-bento border border-line bg-surface shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-lime/35 hover:shadow-pop">
                  <div className="relative aspect-[16/10] overflow-hidden border-b border-line bg-shell">
                    {card.art}
                  </div>

                  <div className="flex flex-1 flex-col p-7 sm:p-8">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-lime-tint text-lime ring-1 ring-inset ring-lime/25">
                        <Icon />
                      </span>
                      <h3 className="font-display text-2xl font-bold tracking-tight text-chalk">{card.name}</h3>
                    </div>

                    <p className="mt-4 text-[15px] leading-relaxed text-ash">{card.lede}</p>

                    <ul className="mt-6 flex flex-col gap-2.5">
                      {card.bullets.map((b) => (
                        <li key={b} className="flex items-start gap-2.5 text-[14px] leading-snug text-silver">
                          <CheckIcon width={15} height={15} className="mt-0.5 shrink-0 text-lime" />
                          {b}
                        </li>
                      ))}
                    </ul>

                    <div className="mt-8 pt-1">
                      <Link to={card.to} className={cn(buttonClasses("primary", "md"), "group/cta w-full sm:w-auto")}>
                        {card.cta}
                        <ArrowRightIcon
                          width={16}
                          height={16}
                          className="transition-transform group-hover/cta:translate-x-0.5"
                        />
                      </Link>
                    </div>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}

/* ---- Card artwork ---------------------------------------------------
   Both are pure CSS/SVG rather than screenshots: a screenshot goes stale the
   first time either tool is restyled, and these stay crisp at any width. */

function CaptionsArt() {
  const rows = [
    { t: "0:00.4", w: "68%", on: false },
    { t: "0:01.2", w: "84%", on: true },
    { t: "0:02.9", w: "52%", on: false },
    { t: "0:04.1", w: "76%", on: false },
  ];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2.5 p-6">
      {rows.map((r) => (
        <div
          key={r.t}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ring-inset transition-colors",
            r.on ? "bg-lime-tint ring-lime/30" : "bg-surface ring-line",
          )}
        >
          <span className="font-mono text-[10px] tabular-nums text-dim">{r.t}</span>
          <span
            className={cn("h-2 rounded-full", r.on ? "bg-lime" : "bg-line-2")}
            style={{ width: r.w }}
            aria-hidden
          />
        </div>
      ))}
      <p className="mt-1 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-dim">
        word-level timing
      </p>
    </div>
  );
}

function MotionArt() {
  return (
    <div className="absolute inset-0 grid grid-cols-3 gap-2.5 p-6">
      {[
        "aspect-square",
        "aspect-square",
        "aspect-square",
        "aspect-square",
        "aspect-square",
        "aspect-square",
      ].map((c, i) => (
        <div
          key={i}
          className={cn(
            "relative overflow-hidden rounded-lg ring-1 ring-inset ring-line",
            c,
            i === 1 ? "bg-lime-tint ring-lime/30" : "bg-surface",
          )}
        >
          <span
            className={cn(
              "absolute left-2.5 top-1/2 h-1.5 -translate-y-1/2 rounded-full",
              i === 1 ? "bg-lime" : "bg-line-2",
            )}
            style={{ width: `${34 + ((i * 13) % 40)}%` }}
            aria-hidden
          />
          <span
            className={cn("absolute bottom-2.5 left-2.5 h-1 rounded-full bg-line-2")}
            style={{ width: `${22 + ((i * 17) % 30)}%` }}
            aria-hidden
          />
        </div>
      ))}
    </div>
  );
}

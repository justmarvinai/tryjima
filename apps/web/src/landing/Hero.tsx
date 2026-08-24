import { lazy, Suspense, useRef } from "react";
import { Link } from "react-router-dom";
import { TEMPLATE_COUNT } from "@jima/templates/durations";
import {
  buttonClasses,
  cn,
  Container,
  ArrowRightIcon,
  BoltIcon,
  CaptionsIcon,
  MotionIcon,
  ShieldIcon,
  useReducedMotion,
} from "@/ui";
import { CaptionPhone } from "./demos/CaptionPhone";
import { CaptionedHeadline } from "./stage/CaptionedHeadline";
import { Fragments } from "./stage/Fragments";
import { StageGround } from "./stage/StageGround";
import { useStageParallax } from "./stage/useStageParallax";

// The live template rail boots WebGL, so it loads after first paint and never
// blocks the headline.
const TemplateStrip = lazy(() => import("./TemplateStrip"));

const TRUST = [
  { icon: ShieldIcon, label: "Nothing is uploaded" },
  { icon: BoltIcon, label: "No account, no watermark" },
];

/**
 * The stage.
 *
 * Deliberately not the two-column "copy on the left, screenshot on the right"
 * hero — that layout is the reason a hundred tools' landing pages are
 * indistinguishable from one another. This is one composition with things at
 * different distances in it: painted ground, a waveform buried in it, the
 * headline, the device, and pieces of both tools floating in front. The device
 * crosses the headline's column rather than sitting politely beside it, and
 * everything moves at its own rate under the pointer.
 *
 * Below the fold of the composition, the live template rail — because the
 * fastest way to prove 495 templates is to play a dozen of them.
 */
export function Hero() {
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  useStageParallax(stage, !reduced);

  return (
    <section aria-labelledby="hero-title">
      {/* The stage is its own box, and the ground is bounded by it. It used to
          be the whole section — which put the waveform directly behind the
          template rail, where 72 bars at full strength fought a dozen bright
          poster frames for the same pixels. */}
      <div
        ref={stage}
        // `isolate` gives the negative-z ground layers a stacking context of
        // their own, so they sit above the box's background and below the
        // content instead of disappearing behind the page.
        className="relative isolate overflow-hidden pb-16 pt-32 sm:pt-36 lg:min-h-[46rem] lg:pb-24"
        style={{ "--px": 0, "--py": 0, "--sy": 0 } as React.CSSProperties}
      >
        <StageGround />
        <Fragments />

        <Container className="relative">
          {/* The device. Absolutely placed from `lg` up so it can overlap the
              headline's column; in normal flow below that, under the copy. */}
          <div
            className="pointer-events-none absolute right-0 top-[1rem] z-20 hidden w-[16.5rem] lg:block xl:right-[-1.5rem] xl:w-[18.5rem]"
            style={{ transform: "translate3d(calc(var(--px, 0) * 26px), calc(var(--py, 0) * 20px), 0)" }}
          >
            <CaptionPhone />
          </div>

          {/* A soft scrim under the copy column. The waveform in the ground runs
              the full width, and body text on top of it turns to mush without
              something to sit on. */}
          <div
            className="pointer-events-none absolute -left-[20%] top-0 -z-[5] hidden h-full w-[95%] lg:block"
            style={{ background: "radial-gradient(60% 55% at 42% 52%, rgb(8 9 11 / 88%) 0%, transparent 72%)" }}
            aria-hidden
          />

          <div className="relative z-10">
            <p className="inline-flex items-center gap-2 rounded-full bg-surface/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-lime ring-1 ring-inset ring-line backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden />
              Two tools · one tab
            </p>

            <div className="mt-7">
              <CaptionedHeadline titleId="hero-title" />
            </div>

            <p className="mt-9 max-w-md text-lg leading-relaxed text-ash">
              On-device auto-captions and{" "}
              <span className="font-mono text-chalk tabular-nums">{TEMPLATE_COUNT}</span> motion-graphics templates.
              Free, no account — and nothing you make ever leaves this tab, because there is no server for it to
              leave to.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/captions" className={cn(buttonClasses("primary", "lg"), "group")}>
                <CaptionsIcon width={18} height={18} />
                Caption a video
                <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link to="/motion" className={cn(buttonClasses("secondary", "lg"), "group")}>
                <MotionIcon width={18} height={18} />
                Browse templates
                <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2.5">
              {TRUST.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-2 text-[13px] font-medium text-dim">
                  <Icon width={15} height={15} className="text-lime" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* Below `lg` the device drops into the flow, centred under the copy. */}
          <div className="mx-auto mt-16 w-full max-w-[17rem] lg:hidden">
            <CaptionPhone />
          </div>
        </Container>
      </div>

      {/* The live rail, on the flat ground below the stage. */}
      <div className="relative z-10 -mt-2 pb-2">
        <Suspense fallback={<div className="h-[15rem]" aria-hidden />}>
          <TemplateStrip />
        </Suspense>
      </div>
    </section>
  );
}

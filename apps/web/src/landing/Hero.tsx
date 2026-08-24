import { lazy, Suspense } from "react";
import { Link } from "react-router-dom";
import { TEMPLATE_COUNT } from "@jima/templates/durations";
import { buttonClasses, cn, Container, ArrowRightIcon, ShieldIcon, BoltIcon, CaptionsIcon, MotionIcon } from "@/ui";
import { CaptionPhone } from "./demos/CaptionPhone";

// The live template rail boots WebGL, so it loads after first paint and never
// blocks the headline.
const TemplateStrip = lazy(() => import("./TemplateStrip"));

const TRUST = [
  { icon: ShieldIcon, label: "Nothing is uploaded" },
  { icon: BoltIcon, label: "No account, no watermark" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-28 sm:pt-32" aria-labelledby="hero-title">
      {/* Ground: fine grid, one lime bloom off to the right, vignette to black. */}
      <div className="grid-lines pointer-events-none absolute inset-0 -z-20" aria-hidden />
      <div
        className="pointer-events-none absolute -right-[10%] -top-[18%] -z-10 h-[46rem] w-[46rem] rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(200,255,61,0.16) 0%, transparent 65%)" }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-64 bg-gradient-to-b from-transparent to-void"
        aria-hidden
      />

      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.85fr)] lg:gap-8">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-lime ring-1 ring-inset ring-line backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden />
              Two tools · one tab
            </p>

            <h1
              id="hero-title"
              className="headline-xl mt-6 text-[clamp(2.75rem,7.4vw,5.25rem)] text-chalk"
            >
              Caption it.
              <br />
              <span className="text-gradient-lime">Animate it.</span>
              <br />
              Post it.
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-ash sm:text-xl">
              Jima is two tools for short-form video: on-device auto-captions, and{" "}
              <span className="font-mono text-chalk tabular-nums">{TEMPLATE_COUNT}</span> motion-graphics templates.
              Both free, both without an account — and neither one ever uploads your work, because there is no
              server to upload it to.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link to="/captions" className={cn(buttonClasses("primary", "lg"), "group")}>
                <CaptionsIcon width={18} height={18} />
                Caption a video
                <ArrowRightIcon
                  width={16}
                  height={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
              <Link to="/motion" className={cn(buttonClasses("secondary", "lg"), "group")}>
                <MotionIcon width={18} height={18} />
                Browse templates
                <ArrowRightIcon
                  width={16}
                  height={16}
                  className="transition-transform group-hover:translate-x-0.5"
                />
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

          <div className="relative mx-auto w-full max-w-[19rem] sm:max-w-[21rem] lg:mx-0 lg:ml-auto">
            <CaptionPhone />
          </div>
        </div>
      </Container>

      {/* The live template rail, straight under the fold: Motion's half of the
          pitch, proved rather than described. */}
      <div className="mt-16 sm:mt-20">
        <Suspense fallback={<div className="h-[15rem]" aria-hidden />}>
          <TemplateStrip />
        </Suspense>
      </div>
    </section>
  );
}

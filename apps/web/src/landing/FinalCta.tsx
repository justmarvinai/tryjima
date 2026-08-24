import { Link } from "react-router-dom";
import { buttonClasses, cn, Container, ArrowRightIcon, CaptionsIcon, MotionIcon } from "@/ui";

/**
 * The closing band. The one place on the page where lime is the ground rather
 * than the accent — which is exactly why it only happens once.
 */
export function FinalCta() {
  return (
    <section className="relative overflow-hidden bg-lime py-20 sm:py-24" aria-labelledby="cta-title">
      {/* A faint grid over the lime so the band has texture rather than reading
          as a flat swatch. Very low alpha — the type must stay the loudest thing. */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "linear-gradient(to right, #08090B 1px, transparent 1px), linear-gradient(to bottom, #08090B 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <Container className="relative text-center">
        <h2 id="cta-title" className="headline-xl text-[clamp(2.5rem,6.5vw,4.5rem)] text-void">
          Open a tab. Make something.
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-void/75">
          No sign-up, no trial, no credit card, no "export unlocked with Pro". Both tools are one click away and
          always will be.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/captions"
            className={cn(buttonClasses("onAccent", "lg"), "group")}
          >
            <CaptionsIcon width={18} height={18} />
            Jima Captions
            <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/motion"
            className={cn(buttonClasses("onAccentQuiet", "lg"), "group")}
          >
            <MotionIcon width={18} height={18} />
            Jima Motion
            <ArrowRightIcon width={16} height={16} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </Container>
    </section>
  );
}

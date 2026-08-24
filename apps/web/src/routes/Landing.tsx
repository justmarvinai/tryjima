import { lazy, Suspense, useEffect } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "@/shell/SiteHeader";
import { SiteFooter } from "@/shell/SiteFooter";
import { Hero } from "@/landing/Hero";
import { ToolStage } from "@/landing/ToolStage";
import { PrivacyBand, BrandKitBand, Stats } from "@/landing/Sections";
import { Faq } from "@/landing/Faq";
import { FinalCta } from "@/landing/FinalCta";

// The poster marquee is the only landing section that needs the template
// registry (~2.7 MB with Pixi), so it loads as its own chunk well after the
// hero has painted rather than sitting on the critical path.
const Marquee = lazy(() => import("@/landing/Marquee"));

/**
 * The one Jima landing page.
 *
 * There is deliberately no per-product landing page: a visitor who has heard of
 * "Jima Motion" and a visitor who has heard of "Jima Captions" should both
 * arrive somewhere that explains the pair, then hands them the tool they came
 * for. Two marketing pages would rebuild exactly the seam the merge removed.
 */
export default function Landing() {
  useEffect(() => {
    document.title = "Jima — Captions and motion graphics for short-form video";
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-void">
      <SiteHeader
        banner={
          <>
            <span className="hidden sm:inline">Captions and Motion are one Jima now.</span>
            <span className="sm:hidden">Two tools, one Jima.</span>
            <Link to="/whats-new" className="underline underline-offset-2 hover:no-underline">
              See what changed
            </Link>
          </>
        }
      />
      <main className="flex-1">
        <Hero />
        <ToolStage />
        <PrivacyBand />
        <Suspense fallback={<div className="h-[32rem]" aria-hidden />}>
          <Marquee />
        </Suspense>
        <BrandKitBand />
        <Stats />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

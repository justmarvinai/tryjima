import { useEffect, type ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/**
 * Layout for every content page (legal, what's new, help). The tools use their
 * own full-height chrome; anything with a header, prose and a footer lands here.
 */
export function PageShell({
  eyebrow,
  title,
  meta,
  intro,
  children,
  wide = false,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
  intro?: ReactNode;
  children: ReactNode;
  /** Content pages that lay out cards rather than prose want the wider column. */
  wide?: boolean;
}) {
  // Standalone routes start at the top, not wherever the user last scrolled.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-void">
      <SiteHeader />
      <main className="flex-1 pt-16">
        <div className={`mx-auto w-full px-5 pb-20 pt-14 sm:px-6 sm:pt-20 ${wide ? "max-w-5xl" : "max-w-3xl"}`}>
          {eyebrow && (
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-lime">{eyebrow}</p>
          )}
          <h1 className="headline-xl mt-3 text-4xl text-chalk sm:text-5xl">{title}</h1>
          {meta && <p className="mt-4 font-mono text-xs text-dim">{meta}</p>}
          {intro && <div className="mt-6 text-lg leading-relaxed text-ash">{intro}</div>}
          <div className="mt-10">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

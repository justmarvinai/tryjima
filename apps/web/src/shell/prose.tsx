import type { ReactNode } from "react";

/**
 * Typographic primitives for long-form copy (legal, help, release notes).
 * Explicit components rather than a `.prose` class: the legal pages are the one
 * place where the exact rhythm matters and where a stray utility class would go
 * unnoticed for months.
 */

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-10 first:mt-0">
      <H2>{title}</H2>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 mt-10 text-xl font-semibold text-chalk first:mt-0 sm:text-2xl">{children}</h2>;
}

export function H3({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 mt-6 text-base font-semibold text-silver">{children}</h3>;
}

export function P({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-relaxed text-ash">{children}</p>;
}

export function Strong({ children }: { children: ReactNode }) {
  return <strong className="font-semibold text-chalk">{children}</strong>;
}

export function UL({ children }: { children: ReactNode }) {
  return <ul className="space-y-2.5 pl-1">{children}</ul>;
}

export const List = UL;

export function LI({ children }: { children: ReactNode }) {
  return (
    <li className="relative pl-6 text-[15px] leading-relaxed text-ash">
      <span aria-hidden className="absolute left-0 top-[0.7em] h-1.5 w-1.5 rounded-full bg-lime" />
      {children}
    </li>
  );
}

/** A pulled-out statement — used for the "short version" of a legal page. */
export function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-card border border-lime/25 bg-lime-tint px-5 py-4 text-[15px] leading-relaxed text-silver">
      {children}
    </div>
  );
}

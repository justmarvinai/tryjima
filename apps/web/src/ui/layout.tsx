import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";
import { useInView } from "./useInView";

/*
 * Surfaces and page furniture. Everything here assumes the dark shell: depth
 * comes from a hairline plus a deep shadow, not from a lighter fill, because on
 * near-black a "raised white card" has nowhere to go.
 */

/** Centred max-width page container. */
export function Container({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-6xl px-5 sm:px-6", className)} {...props} />;
}

/** Wider container for app-shell layouts (library, projects). */
export function WideContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-[1600px] px-4 sm:px-6", className)} {...props} />;
}

export type Tone = "surface" | "lime" | "violet" | "cyan" | "amber" | "coral" | "mint" | "pink" | "indigo";

/** Tinted background + matching hairline per tone. All take chalk text. */
const TONES: Record<Tone, string> = {
  surface: "bg-surface border-line",
  lime: "bg-lime-tint border-lime/25",
  violet: "bg-violet-tint border-violet/25",
  cyan: "bg-cyan-tint border-cyan/25",
  amber: "bg-amber-tint border-amber/25",
  coral: "bg-coral-tint border-coral/25",
  mint: "bg-mint-tint border-mint/25",
  pink: "bg-pink-tint border-pink/25",
  indigo: "bg-indigo-tint border-indigo/25",
};

/** The accent colour that belongs with each tone, for icons and rules. */
export const TONE_ACCENT: Record<Tone, string> = {
  surface: "text-chalk",
  lime: "text-lime",
  violet: "text-violet",
  cyan: "text-cyan",
  amber: "text-amber",
  coral: "text-coral",
  mint: "text-mint",
  pink: "text-pink",
  indigo: "text-indigo",
};

/** Surface card. */
export function Card({
  tone = "surface",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return <div className={cn("rounded-card border shadow-card", TONES[tone], className)} {...props} />;
}

/** A chrome panel: rail, inspector, sidebar. Flat, hairline-separated. */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("bg-shell", className)} {...props} />;
}

/** Oversized landing tile with a hover lift. */
export function BentoCard({
  tone = "surface",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: Tone }) {
  return (
    <div
      className={cn(
        "group/bento relative overflow-hidden rounded-bento border p-7 shadow-card transition-all duration-300",
        "hover:-translate-y-1 hover:shadow-pop",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  lime: "bg-lime-tint text-lime ring-1 ring-inset ring-lime/25",
  neutral: "bg-surface-2 text-silver ring-1 ring-inset ring-line",
  outline: "bg-transparent text-ash ring-1 ring-inset ring-line-2",
  solid: "bg-lime text-void",
  chalk: "bg-chalk text-void",
  violet: "bg-violet-tint text-violet ring-1 ring-inset ring-violet/25",
  cyan: "bg-cyan-tint text-cyan ring-1 ring-inset ring-cyan/25",
  amber: "bg-amber-tint text-amber ring-1 ring-inset ring-amber/25",
  coral: "bg-coral-tint text-coral ring-1 ring-inset ring-coral/25",
  mint: "bg-mint-tint text-mint ring-1 ring-inset ring-mint/25",
  success: "bg-success-tint text-success ring-1 ring-inset ring-success/25",
  error: "bg-error-tint text-error ring-1 ring-inset ring-error/25",
};

export type BadgeTone = keyof typeof BADGE_TONES;

/** Small status/label pill. */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Section eyebrow + oversized heading + optional lead. */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
  size = "md",
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left";
  size?: "md" | "lg";
  className?: string;
}) {
  return (
    <div className={cn(align === "center" ? "mx-auto max-w-3xl text-center" : "max-w-3xl", className)}>
      {eyebrow && (
        <span
          className={cn(
            "mb-4 inline-flex items-center gap-2 rounded-full bg-surface-2 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-lime ring-1 ring-inset ring-line",
            align === "center" ? "mx-auto" : "",
          )}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-lime" aria-hidden />
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "headline-xl text-chalk",
          size === "lg" ? "text-4xl sm:text-5xl lg:text-6xl" : "text-3xl sm:text-4xl lg:text-[2.75rem]",
        )}
      >
        {title}
      </h2>
      {lead && <p className="mt-4 text-lg leading-relaxed text-ash">{lead}</p>}
    </div>
  );
}

/**
 * A word with an animated highlighter swipe behind it. The lime bar wipes in
 * the first time it scrolls into view; it covers only the lower half of the
 * line, so chalk text above it stays well clear of 4.5:1.
 */
export function Marker({ children, className }: { children: ReactNode; className?: string }) {
  const { ref, inView } = useInView<HTMLSpanElement>({ threshold: 0.6 });
  return (
    <span ref={ref} className={cn("relative inline-block whitespace-nowrap", className)}>
      <span aria-hidden className={cn("marker-hl -rotate-1 bg-lime/25", inView && "is-in")} />
      <span className="relative z-10">{children}</span>
    </span>
  );
}

/** A faux app-window frame with a traffic-light top bar. */
export function MockupFrame({
  label,
  children,
  className,
  barClassName,
}: {
  label?: string;
  children: ReactNode;
  className?: string;
  barClassName?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-bento border border-line bg-shell shadow-pop", className)}>
      <div className={cn("flex items-center gap-1.5 border-b border-line bg-surface px-4 py-3", barClassName)} aria-hidden>
        <span className="h-2.5 w-2.5 rounded-full bg-line-2" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-2" />
        <span className="h-2.5 w-2.5 rounded-full bg-line-2" />
        {label && (
          <span className="ml-2 truncate rounded-full bg-void px-3 py-1 font-mono text-[11px] text-dim ring-1 ring-inset ring-line">
            {label}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

/** Empty-state block for panels and lists. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {icon && <div className="mb-4 text-dim">{icon}</div>}
      <p className="text-base font-semibold text-chalk">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-dim">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Keyboard key cap, for shortcut hints. */
export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-2 bg-surface-2 px-1.5 font-mono text-[10px] font-medium text-ash">
      {children}
    </kbd>
  );
}

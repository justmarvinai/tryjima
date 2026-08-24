import { cn } from "./cn";

/** Thin progress track. Determinate by value (0..1), or an indeterminate sweep. */
export function ProgressBar({
  value = 0,
  indeterminate = false,
  className,
  label,
}: {
  value?: number;
  indeterminate?: boolean;
  className?: string;
  /** Accessible name — set it whenever the bar is not next to its own label. */
  label?: string;
}) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      role="progressbar"
      {...(label ? { "aria-label": label } : {})}
      {...(indeterminate ? {} : { "aria-valuenow": pct, "aria-valuemin": 0, "aria-valuemax": 100 })}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-3", className)}
    >
      {indeterminate ? (
        <div className="h-full w-1/3 animate-[jima-marquee-left_1.4s_linear_infinite] rounded-full bg-lime" />
      ) : (
        <div
          className="h-full rounded-full bg-lime transition-[width] duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}

/** Minimal accent spinner. */
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block h-6 w-6 animate-spin rounded-full border-2 border-line-2 border-t-lime", className)}
    />
  );
}

/** Full-route loading state, used as the Suspense fallback for lazy routes. */
export function RouteFallback() {
  return (
    <div className="grid min-h-[60dvh] place-items-center bg-void" aria-busy="true">
      <div className="flex flex-col items-center gap-4">
        <Spinner />
        <p className="text-sm text-dim">Loading…</p>
      </div>
    </div>
  );
}

/** Inline notice: informational, warning or error. */
export function Notice({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: "info" | "warning" | "error" | "success";
  title?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    info: "bg-surface-2 text-silver ring-line",
    warning: "bg-warning-tint text-warning ring-warning/25",
    error: "bg-error-tint text-error ring-error/25",
    success: "bg-success-tint text-success ring-success/25",
  } as const;
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={cn("rounded-card px-4 py-3 text-sm leading-relaxed ring-1 ring-inset", tones[tone], className)}
    >
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={cn(title && "mt-1", "text-current/85")}>{children}</div>}
    </div>
  );
}

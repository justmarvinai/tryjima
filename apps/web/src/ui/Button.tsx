import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant = "primary" | "chalk" | "secondary" | "ghost" | "danger";
export type ButtonSize = "xs" | "sm" | "md" | "lg";

/*
 * A note on the lime fill: white text on #C8FF3D is a 1.1:1 contrast failure.
 * Every accent surface in this app therefore takes a `text-void` label, and the
 * rule is encoded here so no call site has to remember it.
 */
const VARIANTS: Record<ButtonVariant, string> = {
  // The accent CTA. Lime fill, near-black label — 17.8:1.
  primary: "bg-lime text-void hover:bg-lime-bright active:bg-lime-deep shadow-xs",
  // Strong neutral CTA for dark chrome: light fill, dark label.
  chalk: "bg-chalk text-void hover:bg-white active:bg-silver shadow-xs",
  // Outline on dark.
  secondary: "bg-surface-2 text-chalk ring-1 ring-inset ring-line-2 hover:bg-surface-3 hover:ring-line-2 hover:text-white",
  // Low emphasis.
  ghost: "bg-transparent text-ash hover:bg-surface-2 hover:text-chalk",
  // Destructive.
  danger: "bg-error-tint text-error ring-1 ring-inset ring-error/30 hover:bg-error hover:text-void",
};

const SIZES: Record<ButtonSize, string> = {
  xs: "h-7 gap-1.5 px-2.5 text-xs rounded-lg",
  sm: "h-9 gap-1.5 px-3.5 text-[13px] rounded-[10px]",
  md: "h-11 gap-2 px-5 text-[15px] rounded-xl",
  lg: "h-13 gap-2.5 px-7 text-base rounded-xl",
};

const BASE =
  "inline-flex select-none items-center justify-center font-semibold transition-all duration-150 " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-40";

/**
 * Shared button styling as a plain string, so a `<Link>` or `<a>` can wear the
 * exact same skin. Never nest a `<button>` inside an `<a>` — it is invalid HTML
 * and breaks keyboard semantics.
 */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  extra = "",
): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], extra);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...props },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClasses(variant, size, className ?? "")} {...props} />;
});

/**
 * Square icon-only button for dense chrome (toolbars, rails, card overlays).
 * `label` is required — an icon button with no accessible name is invisible to
 * a screen reader.
 */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    label: string;
    size?: "sm" | "md";
    variant?: "ghost" | "secondary" | "primary";
    active?: boolean;
  }
>(function IconButton({ label, size = "md", variant = "ghost", active = false, className, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[10px] transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-40",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
        active
          ? "bg-lime-tint text-lime ring-1 ring-inset ring-lime/30"
          : variant === "primary"
            ? "bg-lime text-void hover:bg-lime-bright"
            : variant === "secondary"
              ? "bg-surface-2 text-silver ring-1 ring-inset ring-line hover:bg-surface-3 hover:text-chalk"
              : "text-ash hover:bg-surface-2 hover:text-chalk",
        className,
      )}
      {...props}
    />
  );
});

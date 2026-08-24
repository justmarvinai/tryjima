import type { HTMLAttributes } from "react";
import { useInView } from "./useInView";
import { cn } from "./cn";

/**
 * Scroll-reveal wrapper: fades + rises its children into place the first time
 * they enter the viewport. `delay` staggers siblings (ms); `scale` adds a subtle
 * zoom. Honors prefers-reduced-motion (content shows instantly — see index.css).
 */
export function Reveal({
  className,
  delay,
  scale = false,
  style,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { delay?: number; scale?: boolean }) {
  const { ref, inView } = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={cn("reveal", scale && "reveal-scale", inView && "is-in", className)}
      style={{ ...(delay ? { transitionDelay: `${delay}ms` } : {}), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

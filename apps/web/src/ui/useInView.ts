import { useEffect, useRef, useState } from "react";

/**
 * Returns a ref + whether the element has scrolled into view. Fires once by
 * default (then unobserves) — used to drive scroll-reveal + marker animations.
 * Falls back to `true` where IntersectionObserver is unavailable so content is
 * never left hidden.
 */
export function useInView<T extends Element = HTMLDivElement>(opts?: {
  rootMargin?: string;
  threshold?: number;
  once?: boolean;
}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  const once = opts?.once ?? true;
  const rootMargin = opts?.rootMargin ?? "0px 0px -10% 0px";
  const threshold = opts?.threshold ?? 0.15;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setInView(true);
            if (once) io.disconnect();
          } else if (!once) {
            setInView(false);
          }
        }
      },
      { rootMargin, threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [once, rootMargin, threshold]);

  return { ref, inView };
}

import { useEffect, type RefObject } from "react";

/**
 * Publishes the pointer position and the stage's own scroll progress as CSS
 * custom properties on a single element:
 *
 *   --px, --py   pointer, -0.5 … 0.5, relative to the viewport
 *   --sy          0 … 1 as the stage scrolls out of the top of the window
 *
 * Deliberately not React state. A dozen layers reading a state variable would
 * re-render the whole hero on every pointer move; writing two custom properties
 * lets each layer pick its own depth in plain CSS —
 * `translate3d(calc(var(--px) * 30px), …)` — and the work stays on the
 * compositor. Nothing here reads layout except the one `offsetHeight` per
 * resize.
 */
export function useStageParallax(ref: RefObject<HTMLElement | null>, enabled: boolean): void {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let frame = 0;
    let height = el.offsetHeight || 1;

    const measure = () => {
      height = el.offsetHeight || 1;
    };

    const onPointer = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        el.style.setProperty("--px", (e.clientX / window.innerWidth - 0.5).toFixed(4));
        el.style.setProperty("--py", (e.clientY / window.innerHeight - 0.5).toFixed(4));
      });
    };

    const onScroll = () => {
      const y = Math.min(1, Math.max(0, window.scrollY / height));
      el.style.setProperty("--sy", y.toFixed(4));
    };

    measure();
    onScroll();
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", measure);
    };
  }, [ref, enabled]);
}

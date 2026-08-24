import { useEffect, type RefObject } from "react";

/**
 * Closes a popover on Escape and on a pointer press outside it.
 *
 * `ref` must wrap BOTH the trigger and the panel — otherwise clicking the
 * trigger to close fires the outside-press handler first and the menu re-opens
 * on the very same click.
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    const onPointer = (e: PointerEvent) => {
      const el = ref.current;
      if (el && e.target instanceof Node && !el.contains(e.target)) onClose();
    };

    document.addEventListener("keydown", onKey);
    // Capture phase: a menu item that re-renders the tree on click would
    // otherwise detach before a bubbled listener could read the target.
    document.addEventListener("pointerdown", onPointer, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer, true);
    };
  }, [ref, open, onClose]);
}

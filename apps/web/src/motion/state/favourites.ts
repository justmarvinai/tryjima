import { useEffect, useState } from "react";

/**
 * Starred templates, in localStorage.
 *
 * 495 templates is well past the point where scrolling is a strategy, and a
 * shortlist is the cheapest fix. Client-side only, like everything else here —
 * no account, nothing leaves the browser (CLAUDE.md rules 1 and 2).
 */
const KEY = "jima.favourites";

function read(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(ids: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    /* quota / private mode — favourites are a convenience, never a blocker */
  }
}

// A module-level subscriber list, so every card and every chip count stay in
// sync without threading state through the whole gallery. Cheaper and less
// fragile than lifting it, for something this small.
let current = read();
const listeners = new Set<(ids: string[]) => void>();

function emit(next: string[], persist = true): void {
  current = next;
  if (persist) write(next);
  for (const fn of listeners) fn(next);
}

// Two Studio tabs are one browser and should agree. `storage` only fires in the
// *other* tabs, so this is a pure receive path — no echo, no loop.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY || e.key === null) emit(read(), false);
  });
}

export function toggleFavourite(id: string): void {
  emit(current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
}

/** Subscribe to the whole favourites set — for the gallery's filters and counts. */
export function useFavourites(): { ids: string[]; toggle: (id: string) => void } {
  const [ids, setIds] = useState(current);
  useEffect(() => {
    listeners.add(setIds);
    // Catch anything that landed between render and this effect.
    setIds(current);
    return () => {
      listeners.delete(setIds);
    };
  }, []);
  return { ids, toggle: toggleFavourite };
}

/**
 * Subscribe to *one* template's star.
 *
 * All 495 cards are mounted at once, so this deliberately holds a boolean rather
 * than the array: every card is still notified on a toggle, but React bails out
 * of a `setState` that doesn't change the value, so starring re-renders the one
 * card that changed instead of the whole grid.
 */
export function useIsFavourite(id: string): boolean {
  const [on, setOn] = useState(() => current.includes(id));
  useEffect(() => {
    const listener = (ids: string[]) => setOn(ids.includes(id));
    listeners.add(listener);
    setOn(current.includes(id));
    return () => {
      listeners.delete(listener);
    };
  }, [id]);
  return on;
}

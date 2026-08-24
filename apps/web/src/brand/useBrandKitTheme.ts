import { useEffect } from "react";
import { BRAND_KIT_STORAGE_KEY, refreshBrandKit } from "./kit";

/**
 * Keeps the shared brand kit in sync across tabs.
 *
 * Note what this deliberately does NOT do: apply the user's colours to Jima's
 * own chrome. The kit is the *user's* brand, for the work they make; the app
 * around it stays Jima's. A tool that repaints its own UI in whatever three
 * colours you last used stops being legible very quickly.
 */
export function useBrandKitTheme(): void {
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      // `key === null` is a whole-origin clear (e.g. "clear site data").
      if (e.key === null || e.key === BRAND_KIT_STORAGE_KEY) refreshBrandKit();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}

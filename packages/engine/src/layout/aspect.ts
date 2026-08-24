// Aspect ratios and their logical render sizes. Templates author in these exact
// pixel units; preview/export scale from here (docs/MOTION_ARCHITECTURE.md §6.3).

export type Aspect = "1:1" | "4:5" | "9:16" | "16:9";

export const ASPECTS: readonly Aspect[] = ["1:1", "4:5", "9:16", "16:9"] as const;

export interface Size {
  width: number;
  height: number;
}

const SIZES: Record<Aspect, Size> = {
  "1:1": { width: 1080, height: 1080 },
  "4:5": { width: 1080, height: 1350 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

export function sizeOf(aspect: Aspect): Size {
  return SIZES[aspect];
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Platform-UI safe zone (px) — keep key content inside these insets.
 * 9:16 reserves the bottom 400px / top 220px for Reels/TikTok/Stories chrome
 * (docs/COMPETITOR_RESEARCH.md §4.4); other aspects use a modest uniform margin.
 */
export function safeZone(aspect: Aspect): Insets {
  const { width, height } = SIZES[aspect];
  if (aspect === "9:16") {
    return { top: 220, right: 64, bottom: 400, left: 64 };
  }
  const margin = Math.round(Math.min(width, height) * 0.06);
  return { top: margin, right: margin, bottom: margin, left: margin };
}

/** The content rectangle inside the safe zone. */
export function safeRect(aspect: Aspect): { x: number; y: number; width: number; height: number } {
  const { width, height } = SIZES[aspect];
  const z = safeZone(aspect);
  return {
    x: z.left,
    y: z.top,
    width: width - z.left - z.right,
    height: height - z.top - z.bottom,
  };
}

/** Center point of the safe rectangle — a good default anchor. */
export function safeCenter(aspect: Aspect): { x: number; y: number } {
  const r = safeRect(aspect);
  return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
}

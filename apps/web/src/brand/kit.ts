import { useSyncExternalStore } from "react";

/**
 * The Jima brand kit — one saved set of brand choices that applies in BOTH
 * tools.
 *
 * This is the piece that makes Jima a product rather than two products behind
 * one nav bar: pick your colours and typeface once, and a Motion template and a
 * caption style will both wear them. It is deliberately small — three colours
 * and two fonts — because a kit nobody fills in is worth nothing, and those
 * five values are what actually make work look like it came from one brand.
 *
 * Storage: `localStorage`, this browser only. Like everything else in Jima it
 * never leaves the device; there is no account to attach it to and no server to
 * send it to. Cross-tab changes propagate through the `storage` event so two
 * open tabs never disagree.
 */
export interface BrandKit {
  /** Surface colour: a Motion template's background, a caption's pill fill. */
  background?: string;
  /** Foreground colour: template text, caption text. */
  textColor?: string;
  /** Accent: template accent bars/dots, the caption's active-word highlight. */
  accent?: string;
  /** Headline font — a Jima Motion `FontChoice.id`. */
  font?: string;
  /** Body font — a Jima Motion `BODY_FONT_CHOICES` id. */
  bodyFont?: string;
  /** When the kit was last written, epoch ms. */
  savedAt: number;
}

/**
 * The storage key is inherited verbatim from Jima Motion v1.17, so anyone who
 * saved a kit in the old app still has it here. Do not rename it.
 */
const KEY = "jima.brandKit";

const HEX = /^#[0-9a-fA-F]{3}$|^#[0-9a-fA-F]{6}$/;

function sanitize(raw: unknown): BrandKit | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const colour = (v: unknown) => (typeof v === "string" && HEX.test(v) ? v : undefined);
  const id = (v: unknown) => (typeof v === "string" && v.length > 0 && v.length < 64 ? v : undefined);

  const kit: BrandKit = { savedAt: typeof o.savedAt === "number" ? o.savedAt : 0 };
  const bg = colour(o.background);
  const text = colour(o.textColor);
  const accent = colour(o.accent);
  const font = id(o.font);
  const bodyFont = id(o.bodyFont);
  if (bg) kit.background = bg;
  if (text) kit.textColor = text;
  if (accent) kit.accent = accent;
  if (font) kit.font = font;
  if (bodyFont) kit.bodyFont = bodyFont;

  // A kit with nothing in it is the same as no kit — don't hand callers an
  // "active" kit that would change nothing if applied.
  const empty = !bg && !text && !accent && !font && !bodyFont;
  return empty ? null : kit;
}

export function readBrandKit(): BrandKit | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/* ---- A tiny observable around the stored value ---------------------- */

let current: BrandKit | null = readBrandKit();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

export function subscribeBrandKit(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current kit. Referentially stable until it actually changes. */
export function getBrandKit(): BrandKit | null {
  return current;
}

/** Write a kit (or clear it with `null`) and notify every subscriber. */
export function writeBrandKit(next: Omit<BrandKit, "savedAt"> | null): BrandKit | null {
  if (next === null) {
    current = null;
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(KEY);
      } catch {
        /* blocked storage — the in-memory value still updates for this session */
      }
    }
    emit();
    return null;
  }

  const kit = sanitize({ ...next, savedAt: Date.now() });
  current = kit;
  if (typeof localStorage !== "undefined") {
    try {
      if (kit) localStorage.setItem(KEY, JSON.stringify(kit));
      else localStorage.removeItem(KEY);
    } catch {
      /* storage full or blocked — keep it in memory for this session */
    }
  }
  emit();
  return kit;
}

/**
 * Re-read from storage. Called by the app-level `storage` listener so a kit
 * saved in one tab shows up in another.
 */
export function refreshBrandKit(): void {
  const next = readBrandKit();
  const same = JSON.stringify(next) === JSON.stringify(current);
  if (same) return;
  current = next;
  emit();
}

export const BRAND_KIT_STORAGE_KEY = KEY;

/** Subscribe a component to the shared brand kit. */
export function useBrandKit(): BrandKit | null {
  return useSyncExternalStore(subscribeBrandKit, getBrandKit, () => null);
}

/** True when the kit has at least one colour set. */
export function kitHasColours(kit: BrandKit | null): boolean {
  return Boolean(kit && (kit.background || kit.textColor || kit.accent));
}

/** The kit's colours as a swatch row, for quick-pick UI. */
export function kitSwatches(kit: BrandKit | null): string[] {
  if (!kit) return [];
  return [kit.background, kit.textColor, kit.accent].filter((c): c is string => Boolean(c));
}

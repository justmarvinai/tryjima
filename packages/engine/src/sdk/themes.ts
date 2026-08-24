// Global theme presets — palettes that work on *any* template.
//
// Each template ships its own bespoke `palettes` (tuned to its specific color
// keys). These presets are the complement: a curated set of background / text /
// accent triples that apply library-wide, because virtually every template in
// the library exposes those three color fields by convention (`background`,
// `textColor`, `accent`). The Studio maps a preset onto whichever of the three a
// template actually declares and leaves bespoke keys (card fills, bubble tints…)
// untouched, so a preset never breaks a layout it doesn't understand.
//
// Contrast rule: `text` on `background` is >= 4.5:1 and `accent` on `background`
// is >= 3:1 for every preset — asserted by a unit test, not by eyeballing.

/** The three color roles a preset can drive, in template field-key terms. */
export const THEME_KEYS = { background: "background", text: "textColor", accent: "accent" } as const;

export interface ThemePreset {
  id: string;
  name: string;
  /** Grouping for the picker: light-surface vs dark-surface presets. */
  mode: "light" | "dark";
  background: string;
  text: string;
  accent: string;
}

/**
 * 18 presets — 12 light, 6 dark. Ordered for the picker (neutrals first, then
 * color families, then the dark set).
 */
export const THEME_PRESETS: ThemePreset[] = [
  // --- Light surfaces ---
  { id: "paper", name: "Paper", mode: "light", background: "#FFFFFF", text: "#111114", accent: "#047857" },
  { id: "porcelain", name: "Porcelain", mode: "light", background: "#F4F5F7", text: "#16161A", accent: "#3730A3" },
  { id: "cream", name: "Cream", mode: "light", background: "#FBF6EC", text: "#1F1A12", accent: "#B45309" },
  { id: "sand", name: "Sand", mode: "light", background: "#F3E9DA", text: "#26201A", accent: "#9A3412" },
  { id: "mint", name: "Mint", mode: "light", background: "#E9FBF4", text: "#0C2A22", accent: "#047857" },
  { id: "sky", name: "Sky", mode: "light", background: "#E8F2FE", text: "#10243B", accent: "#1D4ED8" },
  { id: "lilac", name: "Lilac", mode: "light", background: "#F0EBFE", text: "#1F1733", accent: "#6D28D9" },
  { id: "blush", name: "Blush", mode: "light", background: "#FDEAF1", text: "#33121F", accent: "#BE185D" },
  { id: "coral", name: "Coral", mode: "light", background: "#FFEDE6", text: "#2E1509", accent: "#C2410C" },
  { id: "butter", name: "Butter", mode: "light", background: "#FFF6D8", text: "#2B2205", accent: "#A16207" },
  { id: "sage", name: "Sage", mode: "light", background: "#EDF3EA", text: "#1A2417", accent: "#3F6212" },
  { id: "slate-light", name: "Cool Grey", mode: "light", background: "#EEF1F4", text: "#14181D", accent: "#0F766E" },
  // --- Dark surfaces ---
  { id: "ink", name: "Ink", mode: "dark", background: "#0C0D10", text: "#F7F7F8", accent: "#34D399" },
  { id: "midnight", name: "Midnight", mode: "dark", background: "#101828", text: "#F2F5FA", accent: "#60A5FA" },
  { id: "espresso", name: "Espresso", mode: "dark", background: "#231A14", text: "#F8F1E7", accent: "#FBBF24" },
  { id: "plum", name: "Plum", mode: "dark", background: "#1E1030", text: "#F4EEFC", accent: "#C084FC" },
  { id: "forest", name: "Forest", mode: "dark", background: "#0E211A", text: "#EAF6F0", accent: "#5EEAD4" },
  { id: "carbon", name: "Carbon", mode: "dark", background: "#17181B", text: "#F4F4F5", accent: "#FB7185" },
];

export function themePreset(id: string | undefined): ThemePreset | undefined {
  return id ? THEME_PRESETS.find((t) => t.id === id) : undefined;
}

// --- contrast helpers (also used by the Studio's readability hint) ---

/** Parse #rgb/#rgba/#rrggbb/#rrggbbaa into [r,g,b] 0-255, or null if malformed. */
export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3,8})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3 || h.length === 4) h = h.slice(0, 3).split("").map((c) => c + c).join("");
  else if (h.length === 6 || h.length === 8) h = h.slice(0, 6);
  else return null;
  const n = Number.parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.1. */
export function luminance(rgb: [number, number, number]): number {
  return 0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2]);
}

/** WCAG contrast ratio between two hex colors; null if either is malformed. */
export function contrastRatio(a: string, b: string): number | null {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return null;
  const la = luminance(ra);
  const lb = luminance(rb);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

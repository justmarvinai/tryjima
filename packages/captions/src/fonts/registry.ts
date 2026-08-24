/**
 * Caption font registry — the single source of truth for every typeface Jima
 * Captions can render, both in the editor preview and burned into an export.
 * Each entry maps a stable key to its CSS family, weight and self-hosted woff2
 * URL under /fonts.
 *
 * The family list is deliberately the SAME roster Jima Motion offers for
 * template headlines (see `FONT_CHOICES` in @jima/engine), so the shared Jima
 * brand kit can name one font and have it apply in both tools. Captions pick
 * the heavy end of each family — a caption is read in a fifth of a second on a
 * phone, so anything below 700 disappears against video.
 *
 * Anton and Archivo Black have no Motion counterpart: they are the short-form
 * caption faces, and Anton is the default.
 *
 * Every file is self-hosted (public/fonts). Nothing is fetched from a font CDN
 * — that would leak the visitor's IP to a third party, which is the one thing
 * this product promises never to do.
 */

export interface FontDef {
  /** Stable key stored in CaptionStyle and used by the picker. */
  key: string;
  /** CSS font-family value. */
  family: string;
  weight: number;
  /** Public URL of the woff2 file. */
  url: string;
  /** Label shown in the UI. */
  label: string;
  /** Whether this font is offered as a caption typeface. */
  caption: boolean;
  /**
   * Matching Jima Motion font id (`FontChoice.id`), where one exists. This is
   * what lets the shared brand kit round-trip a font between the two tools.
   */
  motionId?: string;
}

function def(
  key: string,
  family: string,
  weight: number,
  file: string,
  label: string,
  motionId?: string,
): FontDef {
  return {
    key,
    family,
    weight,
    url: `/fonts/${file}`,
    label,
    caption: true,
    ...(motionId ? { motionId } : {}),
  };
}

export const FONTS: Record<string, FontDef> = {
  // ── Short-form caption faces (no Motion equivalent) ──────────────────
  'anton-400': def('anton-400', 'Anton', 400, 'anton-latin-400-normal.woff2', 'Anton'),
  'archivo-900': def('archivo-900', 'Archivo', 900, 'archivo-latin-900-normal.woff2', 'Archivo Black'),
  'archivo-800': def('archivo-800', 'Archivo', 800, 'archivo-latin-800-normal.woff2', 'Archivo Extrabold'),

  // ── The shared brand-kit roster, at caption weight ───────────────────
  'archivo-700': def('archivo-700', 'Archivo', 700, 'archivo-latin-700-normal.woff2', 'Archivo Bold', 'archivo'),
  'space-grotesk-700': def(
    'space-grotesk-700',
    'Space Grotesk',
    700,
    'space-grotesk-latin-700-normal.woff2',
    'Space Grotesk',
    'default',
  ),
  'inter-700': def('inter-700', 'Inter', 700, 'inter-latin-700-normal.woff2', 'Inter Bold', 'inter'),
  'parkinsans-700': def('parkinsans-700', 'Parkinsans', 700, 'parkinsans-latin-700-normal.woff2', 'Parkinsans', 'parkinsans'),
  'jakarta-700': def(
    'jakarta-700',
    'Plus Jakarta Sans',
    700,
    'plus-jakarta-sans-latin-700-normal.woff2',
    'Plus Jakarta Sans',
    'jakarta',
  ),
  'sora-700': def('sora-700', 'Sora', 700, 'sora-latin-700-normal.woff2', 'Sora', 'sora'),
  'poppins-700': def('poppins-700', 'Poppins', 700, 'poppins-latin-700-normal.woff2', 'Poppins', 'poppins'),
  'outfit-700': def('outfit-700', 'Outfit', 700, 'outfit-latin-700-normal.woff2', 'Outfit', 'outfit'),
  'fraunces-700': def('fraunces-700', 'Fraunces', 700, 'fraunces-latin-700-normal.woff2', 'Fraunces', 'fraunces'),
  'jetbrains-700': def(
    'jetbrains-700',
    'JetBrains Mono',
    700,
    'jetbrains-mono-latin-700-normal.woff2',
    'JetBrains Mono',
    'jetbrains',
  ),

  // ── UI-only weights, kept so the editor chrome can preload them ──────
  'inter-400': { key: 'inter-400', family: 'Inter', weight: 400, url: '/fonts/inter-latin-400-normal.woff2', label: 'Inter', caption: false },
  'inter-500': { key: 'inter-500', family: 'Inter', weight: 500, url: '/fonts/inter-latin-500-normal.woff2', label: 'Inter Medium', caption: false },
  'inter-600': { key: 'inter-600', family: 'Inter', weight: 600, url: '/fonts/inter-latin-600-normal.woff2', label: 'Inter Semibold', caption: false },
};

export const CAPTION_FONTS: FontDef[] = Object.values(FONTS).filter((f) => f.caption);

export const DEFAULT_CAPTION_FONT = 'anton-400';

/**
 * Resolve a Jima Motion font id (from the shared brand kit) to the caption font
 * that renders the same family. Returns undefined for families Captions does
 * not carry, so callers can fall back to the user's own choice rather than
 * silently swapping their typeface.
 */
export function captionFontForMotionId(motionId: string | undefined): FontDef | undefined {
  if (!motionId) return undefined;
  return CAPTION_FONTS.find((f) => f.motionId === motionId);
}

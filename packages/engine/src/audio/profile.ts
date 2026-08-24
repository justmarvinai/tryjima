import type { TemplateCategory } from "../sdk/types";

/**
 * The sonic character a template's sound is drawn from.
 *
 * The old sound layer gave all 495 templates one vocabulary, which is the main
 * reason it read as "doesn't fit": a bar chart, an iOS notification and a
 * cinematic opener all got the same beep. A profile picks the instrument family,
 * the musical scale pitched cues walk, and the overall brightness/space — so the
 * same *motion* still drives the same *rhythm*, but a data template steps up a
 * marimba while an opener swells and lands on a sub.
 *
 * Templates inherit one from their category (see {@link profileForCategory}) and
 * can override it with `sound` on the definition.
 */
export type SoundProfile = "ui" | "type" | "impact" | "data" | "airy" | "warm" | "cinematic";

export interface ProfileSpec {
  /** Root pitch for tonal cues (Hz). */
  root: number;
  /** Semitone degrees pitched runs walk through, looping up by octaves. */
  scale: number[];
  /** Overall level trim — overlays and text sit back, impacts lean in. */
  level: number;
  /** Reverb send for tonal cues (0–1). Space is most of "produced" vs "beepy". */
  room: number;
  /** Lowpass ceiling in Hz — the profile's brightness. */
  tone: number;
  /** Minimum gap between cues (s). Denser profiles tolerate faster runs. */
  minGap: number;
  /** How the resolve at the end of a quiet tail is voiced. */
  resolve: "chime" | "bell" | "shimmer" | "pluck" | "none";
  /** Swell into the first big hit — for openers, where it reads as production. */
  riser: boolean;
}

// Roots are chosen so profiles don't all sit on the same note, and stay in the
// 2–4 kHz-clear range where small phone speakers actually reproduce pitch.
const SPECS: Record<SoundProfile, ProfileSpec> = {
  // Crisp, close, modern app UI — notifications, taps, sends.
  ui: { root: 587.33, scale: [0, 3, 5, 7, 10], level: 1, room: 0.12, tone: 11000, minGap: 0.05, resolve: "chime", riser: false },
  // Typographic: dry ticks with a light tonal centre, so long staggered runs of
  // letters read as texture rather than as 20 identical clicks.
  type: { root: 523.25, scale: [0, 2, 4, 7, 9], level: 0.82, room: 0.16, tone: 9000, minGap: 0.042, resolve: "chime", riser: false },
  // Product/promo: confident, punchy, a little low-end behind the hits.
  impact: { root: 440, scale: [0, 3, 7, 10, 12], level: 1.1, room: 0.14, tone: 12000, minGap: 0.055, resolve: "chime", riser: false },
  // Charts and explainers: mallet-ish steps up a pentatonic — reads as counting.
  data: { root: 659.25, scale: [0, 2, 4, 7, 9], level: 0.9, room: 0.22, tone: 8500, minGap: 0.05, resolve: "pluck", riser: false },
  // Photo/showcase/tech: glassy and open, more air than attack.
  airy: { root: 783.99, scale: [0, 4, 7, 11, 14], level: 0.8, room: 0.34, tone: 13000, minGap: 0.06, resolve: "shimmer", riser: false },
  // Brand/quotes/testimonial: rounded, unhurried, tasteful.
  warm: { root: 392, scale: [0, 3, 5, 7, 10], level: 0.85, room: 0.3, tone: 6500, minGap: 0.07, resolve: "chime", riser: false },
  // Openers: swell, land, ring out.
  cinematic: { root: 329.63, scale: [0, 5, 7, 12, 17], level: 1.15, room: 0.4, tone: 10000, minGap: 0.07, resolve: "bell", riser: true },
};

export function profileSpec(profile: SoundProfile): ProfileSpec {
  return SPECS[profile];
}

// Every category maps to a profile, so all 495 templates get something fitting
// without 495 edits. Overlays deliberately inherit `ui` and are trimmed further
// by the mapper — they play over someone else's footage.
const BY_CATEGORY: Partial<Record<TemplateCategory, SoundProfile>> = {
  statement: "type",
  announcement: "ui",
  social: "ui",
  overlay: "ui",
  promo: "impact",
  product: "impact",
  comparison: "data",
  stat: "data",
  educational: "data",
  photo: "airy",
  showcase: "airy",
  tech: "airy",
  brand: "warm",
  testimonial: "warm",
  event: "warm",
  travel: "warm",
  intro: "cinematic",
};

export function profileForCategory(category: TemplateCategory): SoundProfile {
  return BY_CATEGORY[category] ?? "ui";
}

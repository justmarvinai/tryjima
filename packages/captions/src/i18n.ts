/**
 * Centralized UI strings. The interface language is English for v1, but keeping
 * every user-facing string here means we never hardcode copy in components and
 * can localize the UI later without a hunt. (This is separate from the caption
 * transcription languages, which are English + German.)
 */
export const CAPTIONS_STRINGS = {
  brand: 'Jima',
  tagline: 'Captions that keep up.',
  landing: {
    heroSubtitle:
      'Perfectly timed captions for your Shorts, Reels & TikToks — generated entirely on your device.',
    ctaPrimary: 'Caption a video',
    ctaOpenEditor: 'Open the editor',
    privacyHeadline: 'Your video never leaves your device.',
  },
  editor: {
    noVideo: 'no video loaded',
    export: 'Export',
    backToLanding: 'Back to landing',
  },
  unsupported: {
    title: "Your browser can't run Jima yet",
  },
} as const;

export type CaptionsStrings = typeof CAPTIONS_STRINGS;

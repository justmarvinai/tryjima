/**
 * The unified release history.
 *
 * Jima Captions and Jima Motion shipped separately for a year before the merge,
 * so their histories are folded into one timeline here, each entry tagged with
 * the product it belongs to. Nothing is dropped: someone who used one of the
 * old tools should still find the release they remember.
 *
 * Newest first. Keep in sync with CHANGELOG.md when shipping.
 */

export type NewsScope = "jima" | "captions" | "motion";

export interface NewsEntry {
  version: string;
  /** Human date, e.g. "August 2026". */
  date: string;
  scope: NewsScope;
  title: string;
  summary: string;
  highlights: string[];
  /** Marks the current release — rendered with the accent treatment. */
  current?: boolean;
}

export const SCOPE_LABEL: Record<NewsScope, string> = {
  jima: "Jima",
  captions: "Captions",
  motion: "Motion",
};

export const NEWS: NewsEntry[] = [
  {
    version: "2.0",
    date: "August 2026",
    scope: "jima",
    title: "Two tools, one Jima",
    summary:
      "Jima Captions and Jima Motion are now one product, on one domain, behind one design system — with a shared brand kit and a single projects library across both.",
    current: true,
    highlights: [
      "One landing page and one nav for both tools; the old /app and /studio links redirect.",
      'A new dark visual system — near-black chrome, a light canvas for your work, and an electric-lime accent that replaces both old brand colours.',
      "A shared brand kit: save three colours and two typefaces once, and apply them in Motion templates and caption styles alike.",
      "A unified Projects page listing your Captions and Motion work side by side, with resume and delete.",
      "A product switcher in both editors, plus ⌘K to jump anywhere in the app.",
      "Both tools now offer the same twelve typefaces, so a caption and a title card can genuinely match.",
    ],
  },
  {
    version: "1.19",
    date: "August 2026",
    scope: "motion",
    title: "Fifty more templates",
    summary:
      "Ten new templates each for overlays & lower-thirds, social, product & ads, showcase, and explainers — taking the library to 495.",
    highlights: [
      "495 templates across nine use-case sections, all editable down to the last colour.",
      "New overlay and lower-third designs built for talking-head footage.",
      "More product and ad layouts for drops, restocks and offers.",
    ],
  },
  {
    version: "1.18",
    date: "July 2026",
    scope: "motion",
    title: "Clean, modern, smooth",
    summary:
      "Forty-five new templates built to a deliberately calm brief — five for every section, all long, smooth, velocity-matched motion.",
    highlights: [
      "Liquid headlines, weight shifts, slow pans, depth stacks and unfolding lines.",
      "Glass bars, hairlines and soft scrims for overlays.",
      "Sankey diagrams, treemaps, bell curves and journey maps for data.",
    ],
  },
  {
    version: "1.17",
    date: "July 2026",
    scope: "motion",
    title: "Logo, fonts, themes and the first brand kit",
    summary:
      "The official Jima logo landed across the app, along with three more typefaces, a body-font picker, eighteen contrast-checked theme presets, and the brand kit that Jima 2.0 later made shared.",
    highlights: [
      "Eighteen global theme presets, each checked for contrast before shipping.",
      "A separate body-font picker alongside the headline one.",
      "Save your colours and fonts, and reapply them on any template.",
    ],
  },
  {
    version: "1.2",
    date: "July 2026",
    scope: "captions",
    title: "Captions with superpowers",
    summary:
      "The karaoke box highlight, subtitle-file export, one-click filler cleanup, drag-to-position captions, and a style that remembers you.",
    highlights: [
      'Karaoke box highlight — a coloured box that follows the spoken word — plus the "Focus" preset built on it.',
      "Export your captions as .srt or .vtt subtitle files, straight from the transcript panel.",
      'One click removes filler words like "um", "uh", "äh" and "ähm" from the whole transcript (undoable).',
      "Drag captions up and down directly on the preview to position them.",
      "Your caption style and language choice are remembered between visits — stored only on your device.",
    ],
  },
  {
    version: "1.1",
    date: "July 2026",
    scope: "captions",
    title: "Captions, now in motion",
    summary:
      "Entrance animations for every cue, more presets, and a faster path from upload to a finished export.",
    highlights: [
      "Fade, pop and swing entrance animations, identical in preview and export.",
      "More ready-made caption presets, each a complete look rather than a colour swap.",
      "A quicker first transcription, and clearer progress while the model loads.",
    ],
  },
  {
    version: "1.0",
    date: "June 2026",
    scope: "captions",
    title: "Jima Captions is here",
    summary:
      "Word-timed captions for short-form video, transcribed by a speech model running entirely on your own device.",
    highlights: [
      "Whisper transcription in the browser, with word-level timestamps.",
      "English and German, detected automatically.",
      "Full-quality burn-in export — the output matches your source resolution.",
      "No account, no upload, no watermark.",
    ],
  },
  {
    version: "1.0",
    date: "July 2026",
    scope: "motion",
    title: "Jima Motion is here",
    summary:
      "Twelve launch templates, a deterministic render engine, and client-side MP4, WebM and GIF export.",
    highlights: [
      "A motion engine that renders the same frames every time, on every machine.",
      "Four aspect ratios from one project.",
      "Export to MP4, WebM or GIF without a watermark or an account.",
    ],
  },
];

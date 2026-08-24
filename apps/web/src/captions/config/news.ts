/**
 * Jima release history — the source for the News page. Newest first. Keep this
 * in sync with CHANGELOG.md when shipping a release (and with RELEASE in
 * release.ts for the current one).
 */

export type NewsTag = 'launch' | 'major' | 'minor';

export interface NewsEntry {
  version: string;
  /** Human date, e.g. "July 2026". */
  date: string;
  tag: NewsTag;
  title: string;
  summary: string;
  highlights: string[];
}

export const NEWS: NewsEntry[] = [
  {
    version: '1.2',
    date: 'July 2026',
    tag: 'major',
    title: 'Captions with superpowers',
    summary:
      'The karaoke box highlight, subtitle-file export, one-click filler removal, drag-to-position captions, and a style that remembers you.',
    highlights: [
      'Karaoke box highlight — a colored box that follows the spoken word — plus the new "Focus" preset built on it.',
      'Export your captions as .srt or .vtt subtitle files, right from the transcript panel.',
      'One click removes filler words like "um", "uh", "äh" and "ähm" from the whole transcript (undoable).',
      'Drag the captions up and down directly on the preview to position them.',
      'Your caption style and language choice are now remembered between visits — stored only on your device.',
    ],
  },
  {
    version: '1.1',
    date: 'July 2026',
    tag: 'major',
    title: 'Captions, now in motion',
    summary:
      'Captions can now animate in, there are one-click style presets, and you can lock captions to a single line — all still running entirely on your device.',
    highlights: [
      'Subtle entrance animations for captions — Fade, Pop and Swing (optional, off by default).',
      'Three one-click presets — Bold, Clean and Pop — so a great look is one tap away.',
      'New setting to keep captions on a single line (auto-shrinks to fit) or wrap to two.',
      'A refreshed, faster landing page and editor.',
    ],
  },
  {
    version: '1.0',
    date: 'June 2026',
    tag: 'launch',
    title: 'Jima is here',
    summary:
      'The first release of Jima: automatic, perfectly-timed captions for short-form video, generated 100% on your device.',
    highlights: [
      'On-device transcription with an AI model that runs in your browser — English & German.',
      'A live editor: fix the words, restyle the font, colors, outline, highlight and position.',
      'Full-quality .mp4 export with captions burned in and audio kept untouched.',
      'No account, no uploads, no server — your video never leaves your device.',
    ],
  },
];

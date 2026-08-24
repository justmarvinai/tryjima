/**
 * Landing hero configuration — THE file to edit around releases.
 *
 * The landing page has two hero variants:
 *   - 'default': the evergreen product hero (phone mock + floating chips).
 *   - 'update':  the WebGL release-announcement hero, themed by RELEASE below.
 *
 * Ship a new major version → update RELEASE and set ACTIVE_HERO = 'update'.
 * After the release window → set it back to 'default'. Nothing else to touch.
 */

export type HeroVariant = 'default' | 'update';

export const ACTIVE_HERO: HeroVariant = 'update';

export interface ReleaseInfo {
  /** Shown in the "New · Jima x.y" badge. */
  version: string;
  /** Headline, split into lines; the last line gets the gradient treatment. */
  headline: [string, string];
  /** One-sentence description of the release. */
  description: string;
  /** Feature chips shown under the demo (first one is the release's star). */
  chips: string[];
  /** Words the hero demo animates in (uppercase short-form style). */
  demoWords: string[];
}

export const RELEASE: ReleaseInfo = {
  version: '1.2',
  headline: ['Captions with', 'superpowers.'],
  description:
    'Jima 1.2 adds the karaoke box highlight, SRT & VTT subtitle export, one-click filler-word cleanup, and drag-to-position captions. Still free, still 100% on your device.',
  chips: ['Karaoke box', 'SRT & VTT', 'Filler cleanup'],
  demoWords: ['YOUR', 'CAPTIONS', 'YOUR', 'RULES'],
};

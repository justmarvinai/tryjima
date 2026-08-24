import type { Cue } from './types';

/**
 * One-click filler-word cleanup. Conservative by design: only tokens that are
 * unambiguous fillers in English/German are removed — nothing that could be a
 * real word ("like", "also", "well" stay). Matching ignores case and trailing
 * punctuation. Pure, so the store action stays undoable via the edit history.
 */

const FILLERS = new Set([
  // English
  'um', 'umm', 'uh', 'uhh', 'uhm', 'er', 'erm', 'ehm', 'mhm', 'mm', 'mmm', 'hm', 'hmm',
  // German
  'äh', 'ähh', 'ähm', 'ähmm', 'öh', 'öhm', 'eh', 'em', 'mh',
]);

/** Is this transcript token a filler word? ("Um," → true) */
export function isFillerWord(text: string): boolean {
  const normalized = text
    .toLowerCase()
    .replace(/[.,!?…:;'"„“”‘’]+$/u, '')
    .replace(/^[.,!?…:;'"„“”‘’]+/u, '')
    .trim();
  return FILLERS.has(normalized);
}

/** How many filler words the cues currently contain. */
export function countFillerWords(cues: readonly Cue[]): number {
  let count = 0;
  for (const cue of cues) for (const word of cue.words) if (isFillerWord(word.text)) count++;
  return count;
}

/**
 * Remove filler words from all cues. Cues left with no words are dropped;
 * surviving cues keep their original display window (start/end) so the
 * remaining words simply fill the time the filler occupied — no flicker gaps.
 */
export function removeFillerWords(cues: readonly Cue[]): { cues: Cue[]; removed: number } {
  let removed = 0;
  const next: Cue[] = [];

  for (const cue of cues) {
    const words = cue.words.filter((word) => {
      const filler = isFillerWord(word.text);
      if (filler) removed++;
      return !filler;
    });
    if (words.length === 0) continue;
    next.push({ ...cue, words: words.map((w) => ({ ...w })) });
  }

  return { cues: next, removed };
}

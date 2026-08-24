/** A single transcribed word with its timing, in seconds. */
export interface Word {
  text: string;
  start: number;
  end: number;
}

/**
 * A caption cue: the unit shown on screen at once. Holds its own word list so
 * the renderer can highlight the active word (karaoke style) within the cue.
 */
export interface Cue {
  id: string;
  start: number;
  end: number;
  words: Word[];
}

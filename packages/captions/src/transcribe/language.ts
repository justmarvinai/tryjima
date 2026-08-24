/**
 * Lightweight English-vs-German guess from transcript text. v1 supports exactly
 * these two languages, so when the user picks "Auto" we let Whisper transcribe
 * (auto-detecting internally) and use this to *label* the detected language in
 * the UI — no extra model call needed. Pure and testable.
 */

const GERMAN_STOPWORDS = [
  'und', 'der', 'die', 'das', 'ich', 'nicht', 'ist', 'ein', 'eine', 'mit',
  'auch', 'wir', 'du', 'sie', 'ja', 'für', 'auf', 'den', 'dem', 'mir',
  'mich', 'aber', 'wie', 'was', 'noch', 'nur', 'schon', 'sind', 'haben',
];

const ENGLISH_STOPWORDS = [
  'the', 'and', 'you', 'to', 'is', 'it', 'that', 'of', 'for', 'with',
  'this', 'we', 'are', 'not', 'have', 'but', 'on', 'was', 'your', 'what',
  'just', 'like', 'about', 'they', 'can', 'here',
];

function scoreStopwords(tokens: Set<string>, list: string[]): number {
  let score = 0;
  for (const word of list) if (tokens.has(word)) score++;
  return score;
}

export function guessLanguage(text: string): 'en' | 'de' {
  const lower = text.toLowerCase();
  const tokens = new Set(lower.split(/[^a-zäöüß]+/i).filter(Boolean));

  let german = scoreStopwords(tokens, GERMAN_STOPWORDS);
  const english = scoreStopwords(tokens, ENGLISH_STOPWORDS);

  // Umlauts and ß are a strong German signal.
  if (/[äöüß]/.test(lower)) german += 3;

  return german > english ? 'de' : 'en';
}

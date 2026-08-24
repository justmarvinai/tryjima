import { describe, it, expect } from 'vitest';
import { guessLanguage } from './language';

describe('guessLanguage', () => {
  it('detects English from common words', () => {
    expect(guessLanguage('This is the video that we are going to watch with you')).toBe('en');
  });

  it('detects German from common words', () => {
    expect(guessLanguage('Das ist das Video und wir haben nicht viel Zeit für dich')).toBe('de');
  });

  it('detects German from umlauts even with few stopwords', () => {
    expect(guessLanguage('Schöne Grüße, München war wunderschön')).toBe('de');
  });

  it('detects German with ß', () => {
    expect(guessLanguage('Die Straße war groß')).toBe('de');
  });

  it('defaults to English on empty/ambiguous input', () => {
    expect(guessLanguage('')).toBe('en');
    expect(guessLanguage('okay')).toBe('en');
  });
});

import type { Language } from './protocol';

/** Human label for a language code (UI display). */
export function languageLabel(code: Language | 'en' | 'de' | null): string {
  switch (code) {
    case 'en':
      return 'English';
    case 'de':
      return 'German';
    case 'auto':
      return 'Auto';
    default:
      return '—';
  }
}

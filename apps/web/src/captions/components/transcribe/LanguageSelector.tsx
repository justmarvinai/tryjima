import { useAppStore } from '../../state/store';
import type { Language } from '@jima/captions/transcribe';

const OPTIONS: { value: Language; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'German' },
];

interface LanguageSelectorProps {
  disabled?: boolean;
}

/** Segmented control for the transcription language (Auto / English / German). */
export function LanguageSelector({ disabled = false }: LanguageSelectorProps) {
  const language = useAppStore((s) => s.transcription.language);
  const setLanguage = useAppStore((s) => s.setLanguage);

  return (
    <div
      role="radiogroup"
      aria-label="Transcription language"
      className="inline-flex w-full rounded-full bg-surface-2 p-1"
    >
      {OPTIONS.map((option) => {
        const active = option.value === language;
        return (
          <button
            key={option.value}
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => setLanguage(option.value)}
            className={[
              'flex-1 rounded-full px-3 py-1.5 text-[13px] font-semibold transition-all duration-200 ease-out-soft',
              active ? 'bg-surface text-chalk shadow-xs' : 'text-dim hover:text-chalk',
              disabled ? 'pointer-events-none opacity-50' : '',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

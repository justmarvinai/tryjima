import { useAppStore } from '../../state/store';
import { findActiveCueIndex } from '@jima/captions/captions';
import { CueRow } from './CueRow';

/** The editable cue list: click-to-seek, active-cue follow, inline edits. */
export function EditableTranscript() {
  const cues = useAppStore((s) => s.transcription.cues);
  const currentTime = useAppStore((s) => s.playback.currentTime);

  if (cues.length === 0) {
    return <p className="px-3 text-sm text-dim">No speech was detected in this video.</p>;
  }

  const activeIndex = findActiveCueIndex(cues, currentTime);

  return (
    <ul className="pb-4">
      {cues.map((cue, i) => (
        <CueRow
          key={cue.id}
          cue={cue}
          isActive={i === activeIndex}
          isLast={i === cues.length - 1}
        />
      ))}
    </ul>
  );
}

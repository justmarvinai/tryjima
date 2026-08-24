import { useEffect } from 'react';
import { useAppStore } from '../state/store';

function isTextField(el: Element | null): boolean {
  const tag = el?.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || (el as HTMLElement | null)?.isContentEditable === true;
}

/**
 * Cmd/Ctrl+Z to undo, Cmd/Ctrl+Shift+Z (or Ctrl+Y) to redo cue edits. Ignored
 * while a text field is focused so native text undo keeps working there.
 */
export function useUndoRedoShortcuts(): void {
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (isTextField(document.activeElement)) return;
      const key = e.key.toLowerCase();
      if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === 'y') {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);
}

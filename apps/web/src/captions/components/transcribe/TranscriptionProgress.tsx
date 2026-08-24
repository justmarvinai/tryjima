import { useAppStore } from '../../state/store';
import { ProgressBar } from '@/ui';

/** Two-stage progress: a determinate model download, then transcription. */
export function TranscriptionProgress() {
  const status = useAppStore((s) => s.transcription.status);
  const device = useAppStore((s) => s.transcription.device);
  const modelProgress = useAppStore((s) => s.transcription.modelProgress);

  const deviceNote = device === 'webgpu' ? 'Using your GPU' : device === 'wasm' ? 'Using CPU' : null;

  if (status === 'loading-model') {
    return (
      <div>
        <div className="flex items-baseline justify-between">
          <p className="text-sm font-medium text-chalk">Downloading the model</p>
          <p className="font-mono text-xs text-dim">{Math.round(modelProgress * 100)}%</p>
        </div>
        <div className="mt-2">
          <ProgressBar value={modelProgress} />
        </div>
        <p className="mt-2 text-xs leading-relaxed text-dim">
          One-time download — it’s cached for next time.{deviceNote ? ` ${deviceNote}.` : ''}
        </p>
      </div>
    );
  }

  const label = status === 'extracting' ? 'Preparing audio' : 'Transcribing your audio';
  return (
    <div>
      <p className="text-sm font-medium text-chalk">{label}</p>
      <div className="mt-2">
        <ProgressBar indeterminate />
      </div>
      <p className="mt-2 text-xs leading-relaxed text-dim">
        Running locally — it never leaves your device.{deviceNote ? ` ${deviceNote}.` : ''}
      </p>
    </div>
  );
}

/// <reference lib="webworker" />
/**
 * Whisper transcription worker. Runs entirely off the main thread. Loads
 * `onnx-community/whisper-base` via transformers.js, tries WebGPU first and
 * falls back to WASM, and returns word-level timestamps.
 *
 * Privacy: the ORT wasm is served from our own origin (see scripts/copy-ort-wasm),
 * and the model is fetched once from the Hugging Face CDN and cached by the
 * browser. No audio ever leaves the device.
 */
import { pipeline, env, type ProgressInfo } from '@huggingface/transformers';
import type { Word } from '../captions/types';
import type { WhisperResponse, WhisperRequest, TranscribeDevice } from './protocol';
import { toWhisperLanguage } from './protocol';
import { guessLanguage } from './language';

/** The ASR pipeline class isn't exported by name, so derive its type. */
type ASRPipeline = Awaited<ReturnType<typeof pipeline<'automatic-speech-recognition'>>>;

// Fetch models from the HF hub (not from local /models), and load the
// onnxruntime wasm from our own origin instead of a CDN.
env.allowLocalModels = false;
env.useBrowserCache = true;
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.wasmPaths = '/ort/';
}

// The `_timestamped` variant is exported with cross-attentions (output_attentions),
// which transformers.js needs to produce word-level timestamps. The plain
// `whisper-base` lacks them and throws "Model outputs must contain cross attentions".
const MODEL_ID = 'onnx-community/whisper-base_timestamped';

/**
 * Device/precision attempts, in order. WebGPU is fastest; WASM is the universal
 * fallback. fp32 is guaranteed to exist for this model, so it's the final
 * safety net if a quantized variant is unavailable.
 */
const ATTEMPTS: { device: TranscribeDevice; dtype: 'fp32' | 'q8' }[] = [
  { device: 'webgpu', dtype: 'fp32' },
  { device: 'wasm', dtype: 'q8' },
  { device: 'wasm', dtype: 'fp32' },
];

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(message: WhisperResponse, transfer: Transferable[] = []): void {
  ctx.postMessage(message, transfer);
}

let pipe: ASRPipeline | null = null;
let pipeDevice: TranscribeDevice = 'wasm';

async function loadPipeline(): Promise<ASRPipeline> {
  if (pipe) return pipe;

  const progress_callback = (info: ProgressInfo): void => {
    if (info.status === 'progress' && typeof info.loaded === 'number' && typeof info.total === 'number') {
      post({ type: 'model-progress', file: info.file ?? '', loaded: info.loaded, total: info.total });
    }
  };

  let lastError: unknown;
  for (const attempt of ATTEMPTS) {
    try {
      post({ type: 'status', stage: 'loading-model', device: attempt.device });
      const instance = await pipeline('automatic-speech-recognition', MODEL_ID, {
        device: attempt.device,
        dtype: attempt.dtype,
        progress_callback,
      });
      pipe = instance;
      pipeDevice = attempt.device;
      return instance;
    } catch (error) {
      lastError = error;
      // Try the next device/precision.
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not load the transcription model.');
}

interface WhisperChunk {
  text: string;
  timestamp: [number, number | null];
}

function toWords(chunks: WhisperChunk[]): Word[] {
  const words: Word[] = [];
  for (const chunk of chunks) {
    const text = chunk.text ?? '';
    const start = chunk.timestamp?.[0];
    const end = chunk.timestamp?.[1];
    if (typeof start !== 'number') continue;
    words.push({ text, start, end: typeof end === 'number' ? end : NaN });
  }
  return words;
}

async function handleTranscribe(request: WhisperRequest): Promise<void> {
  const asr = await loadPipeline();
  post({ type: 'status', stage: 'transcribing', device: pipeDevice });

  const language = toWhisperLanguage(request.language);
  const output = (await asr(request.audio, {
    return_timestamps: 'word',
    chunk_length_s: 30,
    stride_length_s: 5,
    task: 'transcribe',
    // Only pin a language when the user chose one; omitting it lets Whisper detect.
    ...(language ? { language } : {}),
  })) as { text: string; chunks?: WhisperChunk[] };

  const words = toWords(output.chunks ?? []);
  const detectedLanguage =
    request.language === 'auto' ? guessLanguage(output.text ?? '') : request.language;

  post({ type: 'done', words, detectedLanguage });
}

ctx.onmessage = (event: MessageEvent<WhisperRequest>) => {
  const request = event.data;
  if (request?.type !== 'transcribe') return;

  handleTranscribe(request).catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Transcription failed unexpectedly.';
    post({ type: 'error', message });
  });
};

/**
 * Audio extraction for Whisper. Whisper expects 16 kHz mono float PCM, so we:
 *   1. decode the file's audio to an AudioBuffer (browser codec),
 *   2. downmix to mono (pure, tested), and
 *   3. resample to 16 kHz with an OfflineAudioContext (high-quality, anti-aliased).
 *
 * The downmix and length math are split into pure helpers so they're unit
 * testable without a real AudioContext.
 */

export const WHISPER_SAMPLE_RATE = 16000;

/** Average N channel buffers (equal length) into one mono buffer. Pure. */
export function mixDownToMono(channels: Float32Array[]): Float32Array {
  const firstChannel = channels[0];
  if (!firstChannel) return new Float32Array(0);
  if (channels.length === 1) return firstChannel.slice();

  const length = firstChannel.length;
  const out = new Float32Array(length);
  for (const channel of channels) {
    for (let i = 0; i < length; i++) {
      // Channels are asserted equal-length by the caller; a short one simply
      // contributes zeroes rather than NaN-poisoning the whole mix.
      out[i] = (out[i] ?? 0) + (channel[i] ?? 0);
    }
  }
  const inv = 1 / channels.length;
  for (let i = 0; i < length; i++) out[i] = (out[i] ?? 0) * inv;
  return out;
}

/** Number of samples after resampling `srcLength` samples from `srcRate` to `dstRate`. Pure. */
export function resampledLength(srcLength: number, srcRate: number, dstRate: number): number {
  if (srcRate <= 0) return 0;
  return Math.ceil((srcLength * dstRate) / srcRate);
}

type AudioContextCtor = typeof AudioContext;
type OfflineAudioContextCtor = typeof OfflineAudioContext;

function getAudioContextCtor(): AudioContextCtor {
  const ctor =
    (globalThis as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor })
      .AudioContext ??
    (globalThis as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!ctor) throw new Error('Web Audio API is not available in this browser.');
  return ctor;
}

function getOfflineAudioContextCtor(): OfflineAudioContextCtor {
  const ctor = (globalThis as unknown as { OfflineAudioContext?: OfflineAudioContextCtor })
    .OfflineAudioContext;
  if (!ctor) throw new Error('OfflineAudioContext is not available in this browser.');
  return ctor;
}

/** Decode a media file's audio track into an AudioBuffer. Browser only. */
async function decodeToAudioBuffer(file: Blob): Promise<AudioBuffer> {
  const bytes = await file.arrayBuffer();
  const Ctx = getAudioContextCtor();
  const ctx = new Ctx();
  try {
    // decodeAudioData wants its own copy; pass the ArrayBuffer directly.
    return await ctx.decodeAudioData(bytes);
  } finally {
    void ctx.close();
  }
}

/** Resample a mono buffer to 16 kHz using an OfflineAudioContext. */
async function resampleTo16k(mono: Float32Array, srcRate: number): Promise<Float32Array> {
  if (srcRate === WHISPER_SAMPLE_RATE) return mono;

  const Offline = getOfflineAudioContextCtor();
  const outLength = resampledLength(mono.length, srcRate, WHISPER_SAMPLE_RATE);
  const offline = new Offline(1, outLength, WHISPER_SAMPLE_RATE);

  // Carry the source samples at their native rate; the source node resamples
  // buffer.sampleRate -> context.sampleRate on playback.
  const srcBuffer = offline.createBuffer(1, mono.length, srcRate);
  // copyToChannel wants an ArrayBuffer-backed view; mono always is one here.
  srcBuffer.copyToChannel(mono as Float32Array<ArrayBuffer>, 0);

  const source = offline.createBufferSource();
  source.buffer = srcBuffer;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

/**
 * Full pipeline: file -> 16 kHz mono Float32Array ready for Whisper.
 * Throws if the file has no decodable audio.
 */
export async function extractAudioForWhisper(file: Blob): Promise<Float32Array> {
  const audioBuffer = await decodeToAudioBuffer(file);

  const channels: Float32Array[] = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }
  if (channels.length === 0) {
    throw new Error('This video has no decodable audio.');
  }

  const mono = mixDownToMono(channels);
  return resampleTo16k(mono, audioBuffer.sampleRate);
}

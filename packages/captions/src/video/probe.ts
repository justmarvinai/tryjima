import { Input, BlobSource, ALL_FORMATS } from 'mediabunny';
import type { VideoMetadata } from './types';

/**
 * Reads a video's metadata locally with mediabunny — dimensions (rotation- and
 * aspect-adjusted), duration, and whether it carries an audio track. Nothing is
 * uploaded; the Blob is read in-place. Throws on unreadable input; callers map
 * that to a friendly error.
 */
export async function probeVideo(file: Blob): Promise<VideoMetadata> {
  const input = new Input({
    source: new BlobSource(file),
    formats: ALL_FORMATS,
  });

  try {
    if (!(await input.canRead())) {
      throw new ProbeError('unreadable', 'File format not recognized');
    }

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new ProbeError('no-video-track', 'No video track');
    }

    const audioTrack = await input.getPrimaryAudioTrack();

    const [width, height, durationSec, videoCodec, audioCodec] = await Promise.all([
      videoTrack.getDisplayWidth(),
      videoTrack.getDisplayHeight(),
      input.computeDuration(),
      videoTrack.getCodec(),
      audioTrack ? audioTrack.getCodec() : Promise.resolve(null),
    ]);

    return {
      width,
      height,
      durationSec,
      hasAudio: audioTrack !== null,
      videoCodec,
      audioCodec,
    };
  } finally {
    input.dispose();
  }
}

export type ProbeErrorCode = 'unreadable' | 'no-video-track';

/** Thrown for structural problems detected during probing. */
export class ProbeError extends Error {
  readonly code: ProbeErrorCode;
  constructor(code: ProbeErrorCode, message: string) {
    super(message);
    this.name = 'ProbeError';
    this.code = code;
  }
}

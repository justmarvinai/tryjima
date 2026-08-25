/// <reference lib="webworker" />
/**
 * Export worker. Reads the source mp4 with mediabunny, draws each decoded frame
 * plus the captions onto an OffscreenCanvas at native resolution, re-encodes the
 * video with WebCodecs, and copies the audio track through untouched (re-encoding
 * to AAC only if a straight copy isn't possible). Everything streams one frame at
 * a time so memory stays bounded even for a 60 s 4K clip.
 *
 * The video renderer is the SAME `drawCaptions` used by the live preview — that's
 * what makes the export match what the user saw.
 */
import {
  Input,
  BlobSource,
  ALL_FORMATS,
  Output,
  Mp4OutputFormat,
  BufferTarget,
  CanvasSource,
  EncodedAudioPacketSource,
  AudioSampleSource,
  VideoSampleSink,
  EncodedPacketSink,
  AudioSampleSink,
  getFirstEncodableVideoCodec,
  getFirstEncodableAudioCodec,
  QUALITY_HIGH,
  AUDIO_CODECS,
  type VideoCodec,
  type AudioCodec,
} from 'mediabunny';
import { drawCaptions } from '../captions/render';
import { loadFont } from '../fonts/loader';
import { chooseVideoBitrate, exportProgress, shiftToZero } from './bitrate';
import type { ExportRequest, ExportResponse, AudioMode } from './protocol';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

function post(message: ExportResponse, transfer: Transferable[] = []): void {
  ctx.postMessage(message, transfer);
}

function isAudioCodec(codec: string): codec is AudioCodec {
  return (AUDIO_CODECS as readonly string[]).includes(codec);
}

async function runExport(request: ExportRequest): Promise<void> {
  const input = new Input({ source: new BlobSource(request.file), formats: ALL_FORMATS });
  try {
    await encode(request, input);
  } finally {
    // `dispose()` used to sit on the success path only, so any failure — an
    // undecodable track, a rejected encoder config — leaked the Input and its
    // decoders for the life of the worker.
    input.dispose();
  }
}

async function encode(request: ExportRequest, input: Input): Promise<void> {
  const { cues, style } = request;
  const outputFormat = new Mp4OutputFormat({ fastStart: 'in-memory' });

  post({ type: 'phase', phase: 'preparing' });

  const videoTrack = await input.getPrimaryVideoTrack();
  if (!videoTrack) throw new Error('This file has no video track to export.');
  if (!(await videoTrack.canDecode())) {
    throw new Error(
      'Your browser can’t decode this video’s format. Try the latest Chrome, Edge, Brave or Arc on desktop.',
    );
  }
  const audioTrack = await input.getPrimaryAudioTrack();

  const [width, height, duration, stats, startOffset] = await Promise.all([
    videoTrack.getDisplayWidth(),
    videoTrack.getDisplayHeight(),
    input.computeDuration(),
    videoTrack.computePacketStats(120),
    // Smallest start timestamp across tracks — some containers report a
    // slightly-negative first timestamp, which the muxer rejects.
    input.getFirstTimestamp(),
  ]);
  const fps = stats.averagePacketRate || 30;
  const bitrate = chooseVideoBitrate(width, height, fps, stats.averageBitrate);

  // Pick a video codec the browser can encode AND the mp4 container supports.
  const supportedCodecs = outputFormat.getSupportedCodecs() as string[];
  const videoCandidates = (['avc', 'hevc', 'vp9', 'av1'] as VideoCodec[]).filter((c) =>
    supportedCodecs.includes(c),
  );
  const videoCodec = await getFirstEncodableVideoCodec(videoCandidates, { width, height });
  if (!videoCodec) {
    throw new Error('This browser can’t encode video. Try the latest Chrome, Edge, Brave or Arc.');
  }

  // Load the caption font into the worker's FontFaceSet before drawing.
  await loadFont(style.fontFamily).catch(() => undefined);

  const canvas = new OffscreenCanvas(width, height);
  const canvasCtx = canvas.getContext('2d');
  if (!canvasCtx) throw new Error('Could not create the drawing surface.');

  const output = new Output({ format: outputFormat, target: new BufferTarget() });
  const videoSource = new CanvasSource(canvas, { codec: videoCodec, bitrate, keyFrameInterval: 2 });
  output.addVideoTrack(videoSource, { frameRate: fps });

  // Decide the audio strategy: copy the packets through, else re-encode to AAC.
  const supportedAudio = supportedCodecs.filter(isAudioCodec);
  let audioMode: AudioMode = 'none';
  let encodedAudio: EncodedAudioPacketSource | null = null;
  let sampleAudio: AudioSampleSource | null = null;

  if (audioTrack) {
    const inCodec = await audioTrack.getCodec();
    if (inCodec && isAudioCodec(inCodec) && supportedAudio.includes(inCodec)) {
      encodedAudio = new EncodedAudioPacketSource(inCodec);
      output.addAudioTrack(encodedAudio);
      audioMode = 'passthrough';
    } else if (await audioTrack.canDecode().catch(() => false)) {
      const [numberOfChannels, sampleRate] = await Promise.all([
        audioTrack.getNumberOfChannels(),
        audioTrack.getSampleRate(),
      ]);
      const target = await getFirstEncodableAudioCodec(supportedAudio, { numberOfChannels, sampleRate });
      if (target) {
        sampleAudio = new AudioSampleSource({ codec: target, bitrate: QUALITY_HIGH });
        output.addAudioTrack(sampleAudio);
        audioMode = 'reencoded';
      }
      // else: export video-only (audioMode stays 'none').
    }
    // A track we can neither copy nor decode also falls through to video-only.
    // Attempting the re-encode anyway failed the whole export with a decoder
    // error, when dropping the audio is both possible and already handled.
  }

  await output.start();

  // Every track is shifted by the same offset so the output starts at 0 and A/V
  // stay in sync.
  const shift = (t: number) => shiftToZero(t, startOffset);

  // ── Audio first (fast), then video (the slow, progress-reported part) ──
  if (audioTrack && encodedAudio) {
    const sink = new EncodedPacketSink(audioTrack);
    const decoderConfig = await audioTrack.getDecoderConfig();
    let meta = decoderConfig ? { decoderConfig } : undefined;
    for await (const packet of sink.packets()) {
      const shifted = startOffset !== 0 ? packet.clone({ timestamp: shift(packet.timestamp) }) : packet;
      await encodedAudio.add(shifted, meta);
      meta = undefined; // only the first packet needs the config
    }
  } else if (audioTrack && sampleAudio) {
    const sink = new AudioSampleSink(audioTrack);
    for await (const sample of sink.samples()) {
      sample.setTimestamp(shift(sample.timestamp));
      await sampleAudio.add(sample);
      sample.close();
    }
  }

  post({ type: 'phase', phase: 'encoding' });

  const scene = { cues, style, videoWidth: width, videoHeight: height };
  const videoSink = new VideoSampleSink(videoTrack);
  // One message per frame is ~1,800 postMessages and as many React renders for
  // a 60s clip, all landing during the heaviest part of the work. Half a percent
  // is finer than the progress bar can show.
  let lastPosted = -1;
  for await (const sample of videoSink.samples()) {
    try {
      const t = shift(sample.timestamp);
      sample.draw(canvasCtx, 0, 0, width, height); // rotation-aware, fills the frame
      // Composite captions on top — DON'T clear, or we'd erase the video frame.
      drawCaptions(canvasCtx, t, scene, { clear: false });
      await videoSource.add(t, sample.duration);
      const progress = exportProgress(t, duration);
      if (progress - lastPosted >= 0.005 || progress >= 1) {
        lastPosted = progress;
        post({ type: 'progress', progress });
      }
    } finally {
      // Every VideoFrame gets closed, including on the way out of a throw.
      sample.close();
    }
  }

  post({ type: 'phase', phase: 'finalizing' });
  await output.finalize();

  const buffer = output.target.buffer;
  if (!buffer) throw new Error('Export produced no output.');
  const mimeType = await output.getMimeType().catch(() => 'video/mp4');

  post({ type: 'done', buffer, mimeType, audio: audioMode }, [buffer]);
}

ctx.onmessage = (event: MessageEvent<ExportRequest>) => {
  const request = event.data;
  if (request?.type !== 'export') return;
  runExport(request).catch((error: unknown) => {
    post({ type: 'error', message: error instanceof Error ? error.message : 'Export failed.' });
  });
};

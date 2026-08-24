import { getFirstEncodableVideoCodec, getFirstEncodableAudioCodec } from "mediabunny";
import type { Capabilities } from "./types";

// Memoized per probe size — encoder support is resolution-dependent (a device
// may encode 1080p H.264 but not 4K), so the smoke test must be keyed by the
// dimensions it actually ran at, not shared across every caller.
const cache = new Map<string, Capabilities>();

/**
 * Probe what this browser can actually encode. Uses Mediabunny's real
 * encodability checks (a genuine VideoEncoder.configure under the hood), which
 * is why a Firefox that *claims* H.264 support but can't configure it is
 * correctly reported as mp4:"none" (CLAUDE.md pitfall). GIF is always available
 * (pure JS), so there is never a dead end.
 */
export async function detectCapabilities(
  probe: { width: number; height: number } = { width: 1080, height: 1080 },
): Promise<Capabilities> {
  const key = `${probe.width}x${probe.height}`;
  const hit = cache.get(key);
  if (hit) return hit;

  let mp4Codec: string | null = null;
  let webmCodec: string | null = null;

  if (typeof VideoEncoder !== "undefined") {
    try {
      mp4Codec = await getFirstEncodableVideoCodec(["avc"], probe);
    } catch {
      mp4Codec = null;
    }
    try {
      webmCodec = await getFirstEncodableVideoCodec(["vp9", "vp8", "av1"], probe);
    } catch {
      webmCodec = null;
    }
  }

  // Audio codecs for the optional sound track (AAC → MP4, Opus → WebM). Probed
  // the same way — a browser without AudioEncoder just exports silent video.
  let mp4AudioCodec: string | null = null;
  let webmAudioCodec: string | null = null;
  if (typeof AudioEncoder !== "undefined") {
    try {
      mp4AudioCodec = await getFirstEncodableAudioCodec(["aac"]);
    } catch {
      mp4AudioCodec = null;
    }
    try {
      webmAudioCodec = await getFirstEncodableAudioCodec(["opus"]);
    } catch {
      webmAudioCodec = null;
    }
  }

  const result: Capabilities = {
    mp4: mp4Codec ? "native" : "none",
    webm: webmCodec ? "native" : "none",
    gif: "always",
    mp4Codec,
    webmCodec,
    mp4AudioCodec,
    webmAudioCodec,
  };
  cache.set(key, result);
  return result;
}

/** Test hook — clears the memoized probes. */
export function _resetCapabilities(): void {
  cache.clear();
}

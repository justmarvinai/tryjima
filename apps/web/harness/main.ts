// Headless render + export harness for golden-frame and export-smoke tests, and
// for eyeballing templates during development. Driven by URL params:
//   /harness.html?template=kinetic-headline&aspect=9:16&t=1.5&res=0.5&palette=ink-white&v=<json>
//
// Fonts are imported here (as @font-face CSS) so the engine's document.fonts.load
// finds the faces; the runner then guarantees they're ready before first paint.
import "../src/fonts";

import {
  TemplateRunner,
  cuesForTemplate,
  renderCuesToBuffer,
  createFontRegistry,
  exportTemplate,
  detectCapabilities,
  readCanvasRGBA,
  ExportCancelledError,
  TRANSPARENT_BG,
  type Aspect,
  type Capabilities,
  type ExportProfile,
  type SoundPack,
  type Values,
} from "@jima/engine";
import { getTemplate } from "@jima/templates";
import { Input, BufferSource, ALL_FORMATS } from "mediabunny";

interface ExportOut {
  base64: string;
  byteLength: number;
  width: number;
  height: number;
  frames: number;
  format: string;
  filename: string;
}
interface ProbeOut {
  width: number;
  height: number;
  packetCount: number;
  duration: number;
  audioPacketCount: number;
  transparent: boolean;
}
interface AudioStats {
  profile: string;
  cues: number;
  seconds: number;
  /** Peak sample magnitude across both channels. >= 1 means the bake clipped. */
  peak: number;
  /** Root-mean-square level — near 0 means the track is effectively silent. */
  rms: number;
  /** Fraction of the track that is below -60 dBFS. */
  silentFraction: number;
}
interface HarnessApi {
  ready: boolean;
  renderAt: (t: number) => void;
  duration: number;
  canvas: HTMLCanvasElement;
  export: (profile: ExportProfile, speed?: number, sound?: boolean, transparent?: boolean, motionBlur?: boolean) => Promise<ExportOut>;
  exportExpectCancel: (profile: ExportProfile) => Promise<string>;
  probe: (base64: string) => Promise<ProbeOut | null>;
  /** Min alpha (0–255) across the four canvas corners at the current frame. */
  cornerAlpha: () => number;
  caps: () => Promise<Capabilities>;
  /** Bake the template's cue sheet offline and measure it. */
  audio: (pack?: SoundPack, music?: boolean) => Promise<AudioStats | null>;
  /** Bed level just after each loud cue vs. between them — proves the duck. */
  duckProbe: () => Promise<{ underHits: number; underHitsNoDuck: number; away: number; awayNoDuck: number; hits: number } | null>;
  /** Render one frame with/without motion blur and report its edge energy. */
  blurProbe: (t: number, frameDur: number, samples: number) => { sharp: number; blurred: number };
}

declare global {
  interface Window {
    __jimaHarnessReady?: boolean;
    __jima?: HarnessApi;
    __jimaError?: string;
    /** Raw canvas pixels, for tests that need to inspect what was painted. */
    __jimaReadCanvas?: () => { rgba: Uint8Array; width: number; height: number };
  }
}

function param(name: string, fallback = ""): string {
  return new URLSearchParams(location.search).get(name) ?? fallback;
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function main(): Promise<void> {
  const templateId = param("template", "kinetic-headline");
  const aspect = (param("aspect", "1:1") as Aspect) || "1:1";
  const t = Number(param("t", "0"));
  const res = Number(param("res", "0.5")) || 0.5;
  const paletteId = param("palette") || undefined;
  const fontId = param("font") || undefined;
  const seed = Number(param("seed", "6682")) || 6682;
  const energyParam = param("energy");
  const trimParam = param("trim");
  const holdParam = param("hold");

  let values: Values | undefined;
  const raw = param("v");
  if (raw) {
    try {
      values = JSON.parse(raw) as Values;
    } catch {
      values = undefined;
    }
  }

  const def = getTemplate(templateId);
  if (!def) throw new Error(`Unknown template "${templateId}"`);

  // transparent=1 renders the live canvas with alpha (bg rect blanked), so the
  // per-template alpha sweep can read corner transparency straight off the canvas.
  const transparentParam = param("transparent") === "1";
  const effectiveValues: Values | undefined = transparentParam
    ? { ...(values ?? {}), background: TRANSPARENT_BG }
    : values;

  const runnerConfig = {
    aspect,
    ...(paletteId ? { paletteId } : {}),
    ...(effectiveValues ? { values: effectiveValues } : {}),
    ...(fontId ? { fonts: createFontRegistry({ headline: fontId }) } : {}),
    ...(transparentParam ? { transparent: true } : {}),
    ...(energyParam !== "" ? { energy: Number(energyParam) } : {}),
    ...(trimParam !== "" ? { trim: Number(trimParam) } : {}),
    ...(holdParam !== "" ? { hold: Number(holdParam) } : {}),
    seed,
  };

  const runner = await TemplateRunner.create(def, { ...runnerConfig, resolution: res });
  const stage = document.getElementById("stage");
  if (!stage) throw new Error("#stage not found");
  runner.canvas.id = "jima-canvas";
  stage.appendChild(runner.canvas);
  runner.renderAt(t);

  window.__jima = {
    ready: true,
    renderAt: (time) => runner.renderAt(time),
    duration: runner.duration,
    canvas: runner.canvas,
    export: async (profile, speed, sound, transparent, motionBlur) => {
      const result = await exportTemplate({ def, runner: runnerConfig, profile, ...(speed ? { speed } : {}), ...(sound ? { sound: true } : {}), ...(transparent ? { transparent: true } : {}), ...(motionBlur ? { motionBlur: true } : {}) });
      return {
        base64: toBase64(result.bytes),
        byteLength: result.bytes.byteLength,
        width: result.width,
        height: result.height,
        frames: result.frames,
        format: result.format,
        filename: result.filename,
      };
    },
    exportExpectCancel: async (profile) => {
      const controller = new AbortController();
      controller.abort();
      try {
        await exportTemplate({ def, runner: runnerConfig, profile, signal: controller.signal });
        return "NO_THROW";
      } catch (err) {
        if (err instanceof ExportCancelledError) return "ExportCancelledError";
        return err instanceof Error ? err.name : String(err);
      }
    },
    probe: async (base64) => {
      const bytes = fromBase64(base64);
      const input = new Input({ source: new BufferSource(bytes.buffer as ArrayBuffer), formats: ALL_FORMATS });
      const track = await input.getPrimaryVideoTrack();
      if (!track) return null;
      const stats = await track.computePacketStats();
      const duration = await input.computeDuration();
      const audioTrack = await input.getPrimaryAudioTrack();
      const audioStats = audioTrack ? await audioTrack.computePacketStats() : null;
      const transparent = await track.canBeTransparent();
      return {
        width: track.displayWidth,
        height: track.displayHeight,
        packetCount: stats.packetCount,
        duration,
        audioPacketCount: audioStats ? audioStats.packetCount : 0,
        transparent,
      };
    },
    cornerAlpha: () => {
      const { rgba, width, height } = readCanvasRGBA(runner.canvas);
      const alphaAt = (x: number, y: number) => rgba[(y * width + x) * 4 + 3] ?? 255;
      return Math.min(
        alphaAt(0, 0),
        alphaAt(width - 1, 0),
        alphaAt(0, height - 1),
        alphaAt(width - 1, height - 1),
      );
    },
    duckProbe: async () => {
      const sheet = cuesForTemplate(def, runner.timeline, runner.timelineDuration);
      // The honest experiment: the *same* bed with ducking on and off, compared
      // in the same windows. Measuring "quiet under the hit" alone conflates the
      // duck with the bed simply having a gap there.
      const render = (duck: boolean) =>
        renderCuesToBuffer(sheet.cues, runner.timelineDuration, {
          profile: sheet.profile,
          musicOnly: true,
          ...(duck ? {} : { duck: false }),
        });
      const [ducked, flat] = await Promise.all([render(true), render(false)]);
      if (!ducked || !flat) return null;
      const data = ducked.getChannelData(0);
      const raw = flat.getChannelData(0);
      const sr = ducked.sampleRate;
      const loud = new Set(["impact", "sub", "pop", "bell", "chime", "riser"]);
      const hits = sheet.cues.filter((c) => loud.has(c.sound) && c.gain > 0.25).map((c) => c.time);
      const rmsOf = (buf: Float32Array, from: number, to: number): number => {
        const a = Math.max(0, Math.floor(from * sr));
        const b = Math.min(buf.length, Math.floor(to * sr));
        let sum = 0;
        let n = 0;
        for (let i = a; i < b; i++) {
          const v = buf[i] ?? 0;
          sum += v * v;
          n++;
        }
        return n > 0 ? Math.sqrt(sum / n) : 0;
      };
      // Just after each hit the bed should be at its floor; a window well clear
      // of every hit should be at full level.
      let under = 0;
      let underFlat = 0;
      for (const t of hits) {
        under += rmsOf(data, t + 0.02, t + 0.16);
        underFlat += rmsOf(raw, t + 0.02, t + 0.16);
      }
      const n = Math.max(1, hits.length);
      // Away from every hit the two renders must be the same bed.
      let away = 0;
      let awayFlat = 0;
      let awayN = 0;
      for (let t = 0.05; t < runner.timelineDuration - 0.2; t += 0.1) {
        if (hits.some((h) => t > h - 0.2 && t < h + 0.5)) continue;
        away += rmsOf(data, t, t + 0.1);
        awayFlat += rmsOf(raw, t, t + 0.1);
        awayN++;
      }
      return {
        underHits: under / n,
        underHitsNoDuck: underFlat / n,
        away: awayN > 0 ? away / awayN : 0,
        awayNoDuck: awayN > 0 ? awayFlat / awayN : 0,
        hits: hits.length,
      };
    },
    blurProbe: (time, frameDur, samples) => {
      // Sobel-ish edge energy: motion blur must lower it (smeared edges) while
      // leaving the frame non-empty.
      const energy = (): number => {
        const { rgba, width, height } = readCanvasRGBA(runner.canvas);
        let sum = 0;
        for (let y = 1; y < height - 1; y += 2) {
          for (let x = 1; x < width - 1; x += 2) {
            const i = (y * width + x) * 4;
            const r = rgba[i] ?? 0;
            const rx = rgba[i + 4] ?? 0;
            const ry = rgba[i + width * 4] ?? 0;
            sum += Math.abs(r - rx) + Math.abs(r - ry);
          }
        }
        return sum / (width * height);
      };
      runner.renderAt(time);
      const sharp = energy();
      runner.renderBlurredAt(time, samples, frameDur * 0.5);
      const blurred = energy();
      return { sharp, blurred };
    },
    caps: () => detectCapabilities(),
    audio: async (pack, music) => {
      const sheet = cuesForTemplate(def, runner.timeline, runner.timelineDuration);
      const buf = await renderCuesToBuffer(sheet.cues, runner.timelineDuration, {
        profile: sheet.profile,
        ...(pack ? { pack } : {}),
        ...(music ? { music: true } : {}),
      });
      if (!buf) return null;
      let peak = 0;
      let sumSq = 0;
      let quiet = 0;
      let n = 0;
      const win = Math.max(1, Math.floor(buf.sampleRate * 0.02));
      for (let ch = 0; ch < buf.numberOfChannels; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] ?? 0);
          if (v > peak) peak = v;
          sumSq += v * v;
          n++;
        }
      }
      // Silence measured in 20ms windows on channel 0 — a per-sample test would
      // call every zero crossing silent.
      const ch0 = buf.getChannelData(0);
      let windows = 0;
      for (let i = 0; i < ch0.length; i += win) {
        let w = 0;
        for (let j = i; j < Math.min(i + win, ch0.length); j++) w = Math.max(w, Math.abs(ch0[j] ?? 0));
        windows++;
        if (w < 0.001) quiet++;
      }
      return {
        profile: sheet.profile,
        cues: sheet.cues.length,
        seconds: buf.duration,
        peak,
        rms: Math.sqrt(sumSq / Math.max(1, n)),
        silentFraction: quiet / Math.max(1, windows),
      };
    },
  };
  // Raw pixels, for tests that inspect what was actually painted.
  window.__jimaReadCanvas = () => readCanvasRGBA(runner.canvas);
  window.__jimaHarnessReady = true;
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  window.__jimaError = message;
  const pre = document.createElement("pre");
  pre.style.color = "#DC2626";
  pre.textContent = `Harness error: ${message}`;
  document.body.appendChild(pre);
  window.__jimaHarnessReady = true;
});

export {};

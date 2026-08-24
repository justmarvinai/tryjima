# Jima Architecture

Everything runs in the browser. No backend. Target browsers: Chromium ≥ 113 (Chrome/Edge/Brave/Arc) — the only engines with stable WebCodecs `VideoEncoder`. Firefox/Safari get a graceful "not yet supported for export" notice (transcription + preview may still work; export requires WebCodecs).

## 1. End-to-End Pipeline

```
┌──────────┐   ┌────────────┐   ┌───────────────┐   ┌─────────────┐   ┌────────────┐
│  Upload   │→ │  Validate   │→ │  Transcribe    │→ │   Editor     │→ │   Export    │
│ dropzone  │  │ type/size/  │  │ Whisper worker │  │ preview +    │  │ export      │
│           │  │ duration    │  │ word timings   │  │ style/text   │  │ worker      │
└──────────┘   └────────────┘   └───────────────┘   └─────────────┘   └────────────┘
```

### Stage A — Upload & Validate (`lib/video/`)
1. Accept via drag-drop or file picker. Accept only `video/mp4` / `.mp4`.
2. Check `file.size <= 200 * 1024 * 1024`.
3. Probe metadata by loading into an off-DOM `<video>` (`loadedmetadata`): duration ≤ 60 s (allow small tolerance, e.g. 60.99), read width/height/duration. Reject files with no audio track (detect via mediabunny probe) with a clear message.
4. Keep the `File` in memory; create one object URL for the preview `<video>`.

### Stage B — Audio Extraction + Transcription (`lib/transcribe/`)
1. Main thread: `file.arrayBuffer()` → `AudioContext.decodeAudioData` → downmix to mono → resample to **16 kHz** via `OfflineAudioContext` → `Float32Array`.
2. Transfer (transferable) the Float32Array to the **whisper worker**.
3. Worker: transformers.js `pipeline('automatic-speech-recognition', 'onnx-community/whisper-base_timestamped')` (the `_timestamped` export includes cross-attentions, required for word timestamps), options: `{ language: 'en' | 'de' | undefined (auto), task: 'transcribe', return_timestamps: 'word', chunk_length_s: 30, stride_length_s: 5 }`.
   - Try WebGPU device first; catch and retry with WASM.
   - Model files (~150 MB for base) download once from HF hub and are cached by transformers.js (browser Cache API). Show download progress (`progress_callback`) distinctly from transcription progress.
4. Worker posts: `{ type: 'model-progress' | 'progress' | 'done' | 'error' }`. `done` carries `Word[] = { text, start, end }[]`.
5. Language: UI offers Auto / English / German before transcribing. Auto = let Whisper detect; report detected language back.

### Stage C — Cue Grouping (`lib/captions/grouping.ts`, pure + unit-tested)
Convert words → display cues suited to short-form style:
- Group words into cues of **max ~4 words / ~18 chars**, breaking at gaps > 0.6 s or punctuation.
- Cue timing: `start` of first word → `end` of last word; enforce min display 0.3 s; clamp overlaps.
- Keep per-word timings inside each cue (enables karaoke-style active-word highlight).
- Sanitize Whisper artifacts: trim whitespace, drop empty/`[Music]`-style tokens, fix missing end timestamps (fallback: next word's start, or +0.35 s).

### Stage D — Editor (React, `pages/Editor.tsx` + components)
- **Preview**: `<video>` element (muted-not, plays source audio) with a `<canvas>` overlay absolutely positioned to the video's rendered box. A `requestVideoFrameCallback` loop calls `drawCaptions(ctx, video.currentTime, state)`. Canvas backing store = video native resolution, CSS-scaled — so preview text is pixel-identical to export.
- **Style panel** (right side): font (curated list of ~6 self-hosted fonts), size (relative to video height), text color, stroke color + width, background pill toggle, uppercase toggle, active-word highlight color, vertical position (slider, % of height; horizontal always centered).
- **Transcript panel** (left side): list of cues; click a cue → seek video to cue start; inline-edit text; merge/split cues; nudge cue start/end by ±0.1 s; delete cue. Active cue auto-highlights and scrolls during playback.
- Editing text re-distributes word timings proportionally within the cue.

### Stage E — Export (`lib/export/`, dedicated worker)
1. Worker receives: the `File`, the caption state (cues + style), source metadata.
2. **mediabunny**: open input → iterate decoded video frames (it wraps WebCodecs `VideoDecoder`); create output mp4 with a video track (`VideoEncoder`, codec `avc1.640028` or source-matched level, bitrate = max(source bitrate, heuristic ~10 Mbps @1080p scaled by pixel count)) and the **audio track copied via packet passthrough** (no audio re-encode when source is AAC; else re-encode AAC 192 kbps).
3. Per frame: draw `VideoFrame` onto an `OffscreenCanvas` at native resolution → `drawCaptions(ctx, frameTimestampSec, state)` → `new VideoFrame(canvas, { timestamp })` → encode. Close every frame promptly (memory!).
4. Progress = framesProcessed / totalFrames, posted to UI.
5. Finalize → `Blob` → transfer back → `URL.createObjectURL` → download as `jima-<originalname>.mp4`.
6. Fonts: worker cannot use `document.fonts`; load fonts in the worker via `new FontFace(...).load()` + `self.fonts.add()` (supported in Chromium workers). `packages/captions/src/fonts/loader.ts` serves both contexts and must resolve the set as `document.fonts` **first**, `self.fonts` second — there is no `window.fonts`, so looking only at the global finds nothing on the main thread and the loader silently no-ops, leaving the editor preview in a fallback face while the export uses the real one. See the pitfall in `CLAUDE.md`.

## 2. Data Model (`lib/captions/types.ts`)

```ts
interface Word { text: string; start: number; end: number }          // seconds
interface Cue  { id: string; start: number; end: number; words: Word[] }
interface CaptionStyle {
  fontFamily: string;        // key into FONTS registry
  fontSizePct: number;       // % of video height, default ~5.5
  fontWeight: number;
  textColor: string; strokeColor: string; strokeWidthPct: number;
  highlightColor: string; highlightEnabled: boolean;   // active word
  backgroundEnabled: boolean; backgroundColor: string; backgroundRadiusPct: number;
  uppercase: boolean;
  positionYPct: number;      // 0 top … 100 bottom, default ~78
  maxWidthPct: number;       // line wrap width, default 85
}
```

Zustand store slices: `project` (file, metadata, objectURL), `transcription` (status, progress, language, cues), `style` (CaptionStyle), `playback` (currentTime mirror, playing), `export` (status, progress, resultUrl). Undo/redo (small history stack) for cue edits only — style changes are trivially reversible via controls.

## 3. The One Renderer Rule

`drawCaptions(ctx, timeSec, { cues, style, videoWidth, videoHeight })` in `lib/captions/render.ts`:
- Pure, DOM-free, works on `CanvasRenderingContext2D` **and** `OffscreenCanvasRenderingContext2D`.
- Finds active cue (binary search), wraps text to `maxWidthPct`, draws stroke-then-fill per word, highlight color for the word whose `[start,end)` contains `timeSec`.
- All sizes derived from `videoHeight` percentages → resolution-independent, preview === export guaranteed.
- Unit-test the layout math (line breaking, active-word lookup) with a mocked `measureText`.

## 4. Worker Message Protocols

Typed discriminated unions in `lib/transcribe/protocol.ts` and `lib/export/protocol.ts`. Every worker: `init` → progress events → `done | error`; main thread wrapper exposes a Promise + `onProgress` callback and always `terminate()`s on completion/cancel. Export supports `cancel` (flush + abort cleanly).

## 5. Risks & Fallbacks

| Risk | Mitigation |
|---|---|
| No WebCodecs (Firefox/Safari) | Startup capability check → supported-browser notice before user invests time |
| Whisper model download size (~150 MB) | Progress UI + "only downloaded once" copy; `whisper-base` not `small` for v1 |
| WebGPU unavailable/broken | Automatic WASM fallback (slower but works) |
| Memory blowups on 60 s 4K export | Stream frames (decode→draw→encode→close one at a time), bounded encoder queue (`encodeQueueSize` backpressure) |
| Audio passthrough codec mismatch | Detect; fall back to AAC re-encode |
| German umlauts/ß rendering | Fonts must include Latin Extended; test cases in unit tests |
| Whisper hallucinated/garbage words at silence | Grouping-stage sanitation + user can delete cues |

## 6. What v1 Deliberately Excludes

Multi-line simultaneous cues, animations beyond active-word highlight, SRT import/export (nice-to-have, see roadmap stretch), mobile-browser export, languages beyond EN/DE, project persistence across reloads.

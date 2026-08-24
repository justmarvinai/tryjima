<div align="center">

# Jima

**Caption it. Animate it. Post it.**

Two free browser tools for short-form video — on-device auto-captions and 495
motion-graphics templates. No account, no watermark, and nothing is ever
uploaded, because there is no server to upload it to.

</div>

---

## The two tools

### Jima Captions — `/captions`

Drop in an `.mp4` and get word-perfect, word-*timed* captions.

- Whisper runs **on your device** (WebGPU, falling back to WebAssembly) and
  returns a timestamp per word, so the karaoke highlight lands on the syllable.
- English and German, detected automatically and overridable.
- Fix the words: edit a line, split a cue, merge it with the next, nudge a
  start or end, or strip every "um" in one click — all undoable.
- Style it: typeface, size, colour, outline, karaoke highlight (recolour or
  box), background pill, entrance animation, and position you can just drag.
- Export burns in at your **source resolution** with the audio track copied
  through untouched — or write a `.srt` / `.vtt` instead.

### Jima Motion — `/motion`

Start from a designed template and end with an animation that looks made.

- **495 templates** across nine use cases, every one editable down to the last
  colour.
- 1:1, 4:5, 9:16 and 16:9 from the same project — the layout re-fits rather
  than cropping.
- Editable speed (0.25×–3×), motion energy, trim, hold and loop, all honoured by
  the export.
- Optional sound, **synthesised** from each template's own timeline beats — no
  sample files, so it stays as private as everything else.
- Export MP4, WebM (including transparent WebM for overlaying onto footage) or
  GIF, up to 1080p.

### Shared

One landing page, one design system, one ⌘K palette — plus:

- **A brand kit.** Three colours and two typefaces, saved once, applied in
  Motion templates *and* caption styles. Both tools carry the same twelve
  typefaces so a caption and a title card can genuinely match.
- **A projects library.** Everything you have open in either tool, in one list.

---

## Privacy

Jima has no backend. What is deployed is a folder of static files — HTML, JS,
fonts and a WebAssembly runtime. There is no application server, no database and
no storage bucket, so there is nothing that could receive your footage even if
someone asked it to.

You do not have to take that on trust: open your browser's network tab while you
work, or disconnect from the internet after the page has loaded. Both tools keep
working.

The one network request beyond our own assets is the first transcription, which
downloads an open-source Whisper model (~150 MB) from the Hugging Face CDN and
caches it in your browser. That request is identical for every user and contains
none of your data. Afterwards, transcription works offline.

No cookies. No analytics. No error reporting.

---

## Browser support

| Browser | Captions | Motion |
|---|---|---|
| Chrome / Edge 113+ | Everything | Everything |
| Safari 16.4+ | Everything | Everything |
| Firefox | Not yet — no video encode | Edit and export WebM / GIF |

Both tools check what they need on load and say so up front rather than failing
at the export step.

---

## Development

Requires **Node ≥ 20.11** and **pnpm 10**.

```bash
pnpm install
pnpm dev            # Vite dev server
pnpm check          # typecheck + lint + test + build — the pre-push gate
pnpm test:golden    # Playwright: golden frames, exports, a11y, smoke flows
```

### Layout

```
apps/web/           the only deployable — one SPA
packages/engine     @jima/engine    — Motion render + export engine (Pixi v8)
packages/templates  @jima/templates — the 495 templates
packages/captions   @jima/captions  — transcription, cue model, caption renderer
tests/              Playwright suites + golden-frame baselines
```

Start with [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and
[`docs/DESIGN_SYSTEM.md`](./docs/DESIGN_SYSTEM.md); `CLAUDE.md` holds the
working agreement and the pitfalls worth not rediscovering.

### Deployment

Static SPA on Vercel — `vercel.json` builds with `pnpm build` and serves
`apps/web/dist`. Cross-origin isolation headers
(`COOP: same-origin`, `COEP: credentialless`) are set on every route so
Captions' WASM backend can use `SharedArrayBuffer`; keep `vercel.json` and
`apps/web/vite.config.ts` in sync.

---

## Licence

Jima is a personal project. The bundled typefaces are OFL-1.1. Everything you
export is yours, for any use, with no attribution required.

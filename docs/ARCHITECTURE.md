# Jima architecture

How the merged product is put together. For the deep detail on each engine, see
[`MOTION_ARCHITECTURE.md`](./MOTION_ARCHITECTURE.md) and
[`CAPTIONS_ARCHITECTURE.md`](./CAPTIONS_ARCHITECTURE.md) — both carried over
from the predecessor repos and still authoritative for their own pipelines.

---

## 1. Shape of the repo

```
jima/
├── apps/web/                  the only deployable — one SPA
│   ├── harness.html           headless render harness (test-only, never shipped)
│   ├── public/
│   │   ├── fonts/             caption typefaces (self-hosted woff2)
│   │   └── ort/               onnxruntime-web runtime (generated, gitignored)
│   └── src/
│       ├── App.tsx            the route table
│       ├── shell/             chrome shared by everything
│       ├── ui/                the one component kit
│       ├── landing/           the single landing page
│       ├── captions/          Jima Captions UI + its store
│       ├── motion/            Jima Motion UI + its store
│       ├── brand/             the shared brand kit
│       ├── projects/          the unified projects view
│       ├── content/           release notes data
│       └── routes/            one file per route, all lazily loaded
├── packages/
│   ├── engine/                @jima/engine    — Motion render + export engine
│   ├── templates/             @jima/templates — 495 templates
│   └── captions/              @jima/captions  — transcription + caption engine
├── tests/                     Playwright: golden frames, exports, a11y, smoke
└── scripts/                   ORT runtime copy/prune
```

`packages/*` are framework-free and consumed **from source** — Vite bundles
them, there is no build step and no `dist`. That keeps types exact and
`pnpm typecheck` meaningful across the whole workspace.

---

## 2. One app, two tools

| Route | What it is |
|---|---|
| `/` | The Jima landing page — the only one. |
| `/captions` | Jima Captions. |
| `/motion` | Jima Motion (gallery, or the editor when `?t=<template>`). |
| `/projects` | Both tools' saved work, one list. |
| `/brand` | The shared brand kit. |
| `/whats-new` · `/help` · `/privacy` · `/terms` | Content pages. |
| `/app` → `/captions`, `/studio` → `/motion`, `/news` → `/whats-new` | Redirects for the predecessors' bookmarks. |

Every route is its own lazy chunk. That matters more here than in either
predecessor: a visitor who only opens Captions should never download Pixi and
495 template modules, and a visitor who only opens Motion should never download
transformers.js. **The landing pulls neither** — its template marquee is a
separate chunk that loads below the fold, and the template *count* it prints
comes from `@jima/templates/durations`, a small data module, not from the
registry.

### What is genuinely shared

Not much code, and that is deliberate: the two pipelines have almost nothing in
common. What they share is everything the *user* experiences as one product.

- **The design system** — one `@theme`, one `ui/` kit (§ 7 of DESIGN_SYSTEM.md).
- **`ToolBar`** — the 52px chrome bar, identical in both editors, with the
  product switcher always in the same place.
- **The brand kit** (`src/brand/kit.ts`) — three colours and two typefaces in
  `localStorage`, applied to Motion templates *and* caption styles. Both tools
  carry the same twelve typefaces so this can actually work; the mapping is
  `captionFontForMotionId` in `@jima/captions/fonts`.
- **The projects library** (`src/projects/registry.ts`) — a *view* over each
  tool's own storage, not a third store. Each tool stays honest about what it
  can really save.
- **The command palette** — ⌘K from anywhere.

---

## 3. Jima Captions pipeline

```
.mp4  →  validate (≤200 MB, ≤60 s, mp4 only)
      →  decode audio (AudioContext → 16 kHz mono Float32)
      →  Whisper worker (transformers.js, WebGPU → WASM fallback)
      →  word-level transcript  →  group into cues
      →  editor: <video> + canvas overlay, style + text editing
      →  export worker (mediabunny demux → per-frame drawCaptions → VideoEncoder → mux)
      →  Blob download
```

The load-bearing detail: **`drawCaptions` is one pure function**, used by both
the live preview (`CanvasRenderingContext2D`) and the export worker
(`OffscreenCanvasRenderingContext2D`). All geometry is expressed as percentages
of the video's pixel dimensions, so preview and export are the same frames at
different resolutions. `tests/captions.smoke.spec.ts` asserts it paints and that
re-drawing the same timestamp is byte-identical.

Audio is copied through untouched wherever the codec allows; only the video
track is re-encoded.

The model (`onnx-community/whisper-base_timestamped` — the `_timestamped`
variant, exported with cross-attentions, which is what `return_timestamps:
"word"` needs) is fetched once from the Hugging Face CDN and cached by the
browser. The ONNX runtime itself is served from our own origin, copied out of
`node_modules` by `scripts/copy-ort-wasm.mjs`.

## 4. Jima Motion pipeline

```
template definition  →  TemplateRunner (Pixi v8 + JimaTimeline)
                     →  preview: PreviewPlayer, looping, on-screen only
                     →  export: offscreen render at exact output size
                             → VideoEncoder (MP4/WebM) or gifenc worker (GIF)
                             → Mediabunny mux
```

Templates are pure `f(t, values, aspect, seed)`. `Date.now`, `Math.random`,
network and DOM reads are banned in `packages/engine` and `packages/templates`
and enforced by ESLint. Golden-frame diffs without an intentional change are a
P1 bug.

---

## 5. Cross-origin isolation

`Cross-Origin-Opener-Policy: same-origin` and
`Cross-Origin-Embedder-Policy: credentialless` are set on **every** route, in
both `vite.config.ts` (dev + preview) and `vercel.json` (production).

Captions needs it: the transformers.js WASM backend only goes multithreaded when
`SharedArrayBuffer` is available, which requires the document to be
cross-origin isolated. `credentialless` rather than `require-corp` is what lets
the cross-origin model download through without every response carrying a CORP
header.

It is set on *every* route, not just `/captions`, because isolation is a property
of the document that was loaded — a user who lands on `/` and client-side
navigates into Captions would otherwise arrive without it. Nothing else in the
app loads cross-origin subresources, so there is no cost.

---

## 6. Storage

Everything is on-device. There is no server, so there is nowhere else for it to
be.

| Key | Holds |
|---|---|
| `jima.v2.motion.projects` | Motion projects, one per template |
| `jima.v2.captions.projects` | Captions transcripts + styles, keyed by file identity |
| `jima.brandKit` | the shared brand kit (name inherited from Motion v1.17) |
| `jima.style` / `jima.language` | caption style + language preferences |
| IndexedDB `jima/blobs` | images added to Motion projects |

**The source video is never written to storage.** It exists only in memory while
the tab is open. Resuming a Captions project therefore asks for the file again
and checks its name and size before restoring the transcript — so you never get
one video wearing another's captions. That is the honest trade for nothing ever
being uploaded, and the projects list says so on the card.

Motion projects used to be a single autosave slot, so editing a second template
threw the first away. They are now a map keyed by template id, migrated once
from the old `jima.v1.project` key.

---

## 7. Testing

| Command | Covers |
|---|---|
| `pnpm test` | Vitest, Node. Pure logic in all three packages plus the gallery's facets and the caption model. |
| `pnpm test:golden` | Playwright. 495 templates × determinism + 4 poster baselines each, real exports, audio bakes, a11y, and both tools' smoke flows. |
| `pnpm check` | typecheck + lint + test + build — the pre-push gate. |

The golden suite drives `apps/web/harness.html` — a headless render harness that
exists only for tests and is never part of the deployed bundle. WebGL runs on
SwiftShader in CI.

Two coverage tests are worth knowing about, because the bug they now catch
shipped undetected for a release: `TEMPLATE_DURATIONS` and the golden baseline
list are each asserted against **the registry**, not against each other. Before
the merge they were compared to one another, so 50 templates that were in
neither list passed silently — and quietly dropped out of every length filter in
the gallery.

---

## 8. Deployment

Static SPA on Vercel. `vercel.json` at the root: `pnpm build` →
`apps/web/dist`, SPA rewrites for everything that is not a real file, the
isolation headers above, and immutable caching for `/assets` and `/fonts`.

No serverless functions. No backend of any kind.

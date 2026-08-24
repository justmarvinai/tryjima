# Jima Motion — Technical Architecture

**Status:** approved plan, pre-code (2026-07-21). Version numbers were verified against registries
in July 2026; re-verify exact minors at Phase 0 scaffold time. Decisions below are binding unless a
newer ADR (§ 16) supersedes them.

---

## 1. Constraints → requirements

Product constraints (from `PRODUCT_BRIEF.md`) that drive every technical choice:

| Product constraint | Technical requirement |
|---|---|
| 100 % free, no accounts, no payments | No backend, no auth, no database. Static hosting only. |
| No watermark, no export limits | Rendering must cost us ~nothing → all rendering client-side. |
| User content never leaves the device | No uploads. No content telemetry. Fonts/assets self-hosted. |
| Landing → export < 60 s | Instant editor load (code-split), no render queue, faster-than-realtime export where hardware allows. |
| Deterministic templates, golden-frame testable | Pure `f(t)` rendering, seeded randomness, fixed frame grid. |
| Personal deployment — owner + friends/family, no SEO/marketing (ADR-011) | Simplest modern app stack; the landing is part of the product experience, not an acquisition channel. |
| Must run for years unattended | Boring, maintained, permissively-licensed dependencies. |

## 2. System overview

There is exactly one deployable artifact: a **static site**. No servers, no functions, no APIs.

```mermaid
flowchart LR
  subgraph Static site (Vercel)
    L[Landing route\nReact, lazy chunks] --> S[/studio route\nReact editor/]
  end
  S --> E[Engine\nPixiJS v8 scene + Jima Timeline]
  E --> P[Preview player\nrAF, 60fps]
  E --> X[Exporter\nframe-by-frame render]
  X --> W1[WebCodecs VideoEncoder\n→ Mediabunny mux → MP4/WebM]
  X --> W2[gifenc worker\n→ GIF]
  X -.fallback.-> W3[ffmpeg.wasm (lazy)\n/ MediaRecorder]
  U[(User text & images\nstay in browser\nlocalStorage autosave)] --> S
```

## 3. Stack decisions (with rejected alternatives)

| Layer | Decision | Why | Rejected |
|---|---|---|---|
| Site framework | **Vite 8 + React 19 SPA** (React Router, static build) | The product is an app and SEO is explicitly a non-goal (ADR-011) — so the simplest modern stack wins: one mental model, first-class workers/wasm/code-split DX, instant HMR; landing and Studio are lazy route chunks | Astro islands (its zero-JS-landing advantage is moot without SEO; adds a second mental model); Next.js static export (server abstractions for zero benefit here) |
| UI runtime | **React 19 + TypeScript (strict)** | R3F v9 requires React 19; team/AI familiarity; typed template SDK | Svelte/Solid (ecosystem fit with R3F/tooling) |
| Styling | **Tailwind CSS 4** + design tokens (`DESIGN_ARCHITECTURE.md`) | Speed, consistency, light-mode enforcement via tokens | CSS modules only |
| State | **Zustand** | Tiny, MIT, no boilerplate; single store for editor state | Redux (weight), Context-only (perf) |
| 2D render engine | **PixiJS v8** — WebGL backend | GPU filters/particles at 1080p60; deterministic seek-render; `renderer.extract` readback; healthy monthly releases | Canvas 2D (no GPU effects; kept as conceptual fallback), Konva (CPU filters), Three.js (overkill for 2D), DOM/HTML capture (non-exportable accurately) |
| Animation timeline | **Custom `JimaTimeline`** (in-house, ~small) | Deterministic `evaluate(t)`; export needs exact seeking anyway; **GSAP is legally unavailable** (§ 16 ADR-001) | GSAP (license bars no-code animation tools), anime.js/motion.dev (usable but still wrap-for-determinism; not worth the dependency for a tween evaluator) |
| Video mux/encode | **WebCodecs `VideoEncoder` + Mediabunny** | Hardware encode; Mediabunny (MPL-2.0) is the maintained successor to mp4-muxer/webm-muxer (both deprecated); tree-shakes to ~5 kB+; also gives demux for testing | mp4-muxer/webm-muxer (deprecated), Remotion (license: per-render fees > 3 employees; forbids derivative editors), server rendering (violates constraints) |
| GIF encode | **gifenc** in a Web Worker | Fastest pure-JS (~2× gif.js), PnnQuant suits flat template art; MIT | gif.js (unmaintained since 2016); modern-gif kept as evaluated alternative if photo templates band (has dithering, active 2026) |
| Fallback encoder | **@ffmpeg/ffmpeg 0.12.x single-thread, lazy-loaded** only when WebCodecs path unavailable | ~31 MB download, so last resort; single-thread avoids COOP/COEP | ffmpeg-mt (needs cross-origin isolation; revisit only if telemetry demands) |
| Last-resort capture | **MediaRecorder + `canvas.captureStream`**, labeled "preview quality" | Realtime-only, non-deterministic, frame drops — but works on the tail (Firefox Android, old Safari) | Nothing (better a labeled degraded path than a dead end) |
| Landing hero 3D | **three r185 + @react-three/fiber 9 + drei 10** | React-19-native R3F line; shader-gradient hero; lazy island | Raw WebGL (slower to build), heavy postprocessing (banned for budget) |
| Landing micro-motion | CSS transitions/keyframes first; **`motion` (motion.dev, MIT)** where springs/scroll-orchestration is needed | Small, MIT, no license risk | GSAP on the marketing site (legally fine, but one animation stack fewer to audit) |
| Fonts | Self-hosted **OFL static-instance woff2** | Canvas rasterization needs local faces; OFL permits embedding in exports; static instances because canvas `font` can't express variable axes | Google Fonts CDN (privacy + COEP hazards), variable fonts on canvas (spec gap) |
| Hosting | **Vercel** (owner decision) | Zero-config Git deploys of the static build, per-PR preview URLs, headers via `vercel.json` (keeps the ffmpeg-mt/COOP+COEP option open) | GitHub Pages (no headers), Cloudflare Pages/Netlify (equally capable — owner uses Vercel) |
| CI | **GitHub Actions** | typecheck/lint/test/golden-frames/Lighthouse budgets + Pages deploy | — |
| Analytics | **None.** | Privacy is a headline feature, and a personal deployment needs no metrics anyway | Any tracking (banned) |
| Package manager | **pnpm** workspaces | Monorepo (§ 5) | npm/yarn |

### 3.1 Verified dependency snapshot (2026-07; re-pin at scaffold)

| Package | Version | License | Note |
|---|---|---|---|
| `pixi.js` | 8.19.x | MIT | WebGL backend forced for export (§ 8.6) |
| `three` / `@react-three/fiber` / `@react-three/drei` | 0.185.x / 9.6.x / 10.7.x | MIT | R3F 9 peers `react >=19 <19.3` |
| `mediabunny` | 1.50.x | **MPL-2.0** | File-level copyleft only — safe to bundle; do not modify its files without publishing those files |
| `gifenc` | 1.0.3 | MIT | Frozen but stable; wrap behind our own interface |
| `@ffmpeg/ffmpeg` + `@ffmpeg/core` | 0.12.x | MIT | Lazy chunk, never in initial bundle |
| `vite`, `react`, `react-router`, `tailwindcss`, `zustand`, `typescript`, `vitest`, `playwright` | latest at scaffold | MIT/Apache | — |

**License policy:** runtime deps must be MIT / Apache-2.0 / BSD / ISC / MPL-2.0; fonts OFL-1.1 (or
Apache-2.0). **Banned:** GPL/AGPL/SSPL runtime deps (Etro is GPL-3.0 — reference only), Remotion
(source-available, per-render company fees, forbids derivative editors), **GSAP anywhere in the
product** (ADR-001), code copied from dual-licensed references (omniclip → MIT ok to read;
openvideodev/DesignCombo → reference only, no code reuse).

## 4. Browser support matrix (verified 2026-07)

| Capability | Chrome/Edge desktop | Chrome Android | Firefox desktop | Firefox Android | Safari macOS | Safari iOS |
|---|---|---|---|---|---|---|
| WebCodecs `VideoEncoder` | ✅ 94+ | ✅ 94+ | ✅ 130+ | ❌ | ✅ 16.4+ | ✅ 16.4+ |
| H.264 encode | ✅ (OpenH264/HW) | ✅ | ⚠️ unreliable (probe can lie) | ❌ | ✅ (VideoToolbox HW) | ✅ |
| VP9/VP8 encode | ✅ | ✅ | ✅ (libvpx) | ❌ | ❌ assume no | ❌ |
| OffscreenCanvas (full) | ✅ 69+ | ✅ | ✅ 105+ | ✅ | ✅ 17+ | ✅ 17+ |
| WebGL2 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Support tiers** (drives capability messaging, § 8.7):
- **Tier A (full):** Chrome/Edge 94+, Safari 16.4+ → MP4 (H.264) + GIF (+ WebM on Chromium).
- **Tier B:** Firefox desktop 130+ → WebM (VP9) + GIF; MP4 only if the H.264 smoke test passes,
  else offered via lazy ffmpeg.wasm ("slower, ~31 MB download") or user takes WebM.
- **Tier C (degraded):** Firefox Android, Safari ≤ 16.3, misc → GIF (always works: pure JS) +
  MediaRecorder "preview quality" WebM/MP4. Honest banner, no dead ends.
- Minimum floor to open the Studio at all: WebGL2 + ES2020. Below floor → friendly message + link
  to supported browsers.

## 5. Repository structure (pnpm workspace)

```
jima-motion/
├─ apps/
│  └─ web/                     # Vite + React SPA — the ONLY deployable
│     ├─ src/routes/           # / (landing), /studio — lazy route chunks
│     ├─ src/landing/          # hero, template rail, sections, FAQ
│     ├─ src/studio/           # gallery, editor, inspector, export UI
│     ├─ src/styles/           # Tailwind config, tokens (from DESIGN_ARCHITECTURE.md)
│     └─ public/fonts/         # OFL woff2 static instances (+ LICENSE files per family)
├─ packages/
│  ├─ engine/                  # @jima/engine — DOM-light, no React
│  │  ├─ src/runtime/          # stage setup, renderer mgmt, context-loss recovery
│  │  ├─ src/timeline/         # JimaTimeline, easings, springs, stagger, seeded RNG
│  │  ├─ src/layout/           # aspect layout helpers, safe zones, text fitting
│  │  ├─ src/text/             # font registry, loading, measuring, crisp rasterization
│  │  ├─ src/export/           # frame loop, encoders (webcodecs/gif/ffmpeg/recorder), capability detection
│  │  └─ src/preview/          # rAF player (play/pause/seek/loop/speed)
│  └─ templates/               # @jima/templates — one module per template + registry
│     └─ src/kinetic-headline/ …(×12, per TEMPLATE_LIBRARY.md)
├─ tests/                      # Playwright: golden frames, export smoke, a11y, budgets
└─ .github/workflows/          # ci.yml (deploys happen via Vercel Git integration)
```

Boundary rules: `engine` never imports React; `templates` import only `engine`'s SDK
surface; `apps/web` is the only place React lives. This keeps the engine runnable headless in
Playwright for golden tests and build-time poster generation.

## 6. The motion engine

### 6.1 Determinism rules (non-negotiable, enforced by lint + review)
1. Rendering is a pure function: `render(t, values, aspect, seed)` → pixels. No hidden state
   across frames at equal inputs.
2. **Banned in `engine`/`templates`:** `Date.now()`, `performance.now()` (outside the preview
   clock), `Math.random()`, network fetches, DOM reads. Randomness comes from a seeded PRNG
   (mulberry32) provided in the template context; the seed is part of project state.
3. Time is quantized on export to the frame grid: `t = frameIndex / fps` exactly. Preview may run
   continuous `t`, but must produce identical results at grid times.
4. Everything time-driven derives from `t` (no physics integrators with per-frame deltas; springs
   are closed-form/precomputed curves).

### 6.2 Scene & timeline model
- A **TemplateInstance** = a Pixi container tree + a `JimaTimeline` + a `layout(aspect)` function.
- `JimaTimeline` is a flat list of **tweens**: `{ target, prop, from, to, start, duration, ease }`
  plus `set` events and stagger/sequence helpers to author them tersely. `evaluate(t)` writes all
  animated properties; it never accumulates.
- **Easing set:** standard families (`linear`, quad/cubic/quint/expo in/out/in-out), `out-back(s)`,
  closed-form damped `spring(damping)` approximations, `steps(n)` — all pure `(u: 0..1) => number`.
- **Speed control** maps user speed `s` to `evaluate(t · s)` with duration scaled `1/s`; computed
  durations (T05, T11) recompute on value change and are surfaced to the UI.
- **Loop handling:** loopable templates guarantee `state(0) ≡ state(duration)`; the player wraps,
  the exporter emits exactly `duration × fps` frames.

### 6.3 Canvas, resolution & text crispness (the classic pitfalls, pre-decided)
- The scene is authored in **logical units**: 1080×1080 / 1080×1350 / 1080×1920 / 1920×1080.
- **Preview:** renderer at `resolution = min(devicePixelRatio, 2)`, `autoDensity`, fitted into the
  viewport. **Export:** render into an offscreen render target at the exact output size — **never
  read back the DPR-scaled preview canvas**.
- Pixi `Text` rasterizes via Canvas2D at a set `resolution`: text objects re-rasterize at export
  scale so glyphs stay crisp; no scaling up preview textures.
- Readback via `renderer.extract` (avoids `preserveDrawingBuffer`); export forces the **WebGL**
  backend (WebGPU readback is async and adds cross-device variability — WebGPU may be evaluated
  for preview later, ADR-004).
- WebGL context-loss: listener re-creates the renderer and re-renders current `t` from state
  (state lives in the store, never in the GL context).

### 6.4 Fonts
- Bundled families (roles → families in `DESIGN_ARCHITECTURE.md` § 4): OFL static instances,
  self-hosted woff2, one file per used weight.
- Before first paint of a template and before export: `await document.fonts.load('<weight> 64px <family>', sample)`
  **per family+weight actually used** (`document.fonts.ready` alone does NOT fetch unused faces —
  the classic "first export renders fallback font" bug), then verify with `document.fonts.check()`.
- No variable-axis rendering on canvas in v1 (canvas `font` string cannot express arbitrary axes).
- User-uploaded fonts: post-v1 (`FontFace(name, buffer)` + `document.fonts.add()`), parked.

### 6.5 User images
- Ingest via `<input type=file>`/drag-drop → `createImageBitmap` → Pixi texture. EXIF orientation
  respected; downscale to ≤ 2048px longest side on ingest (memory + GIF perf); object-fit
  cover/contain per slot. Files never leave the browser; autosave stores them as blobs in
  IndexedDB (localStorage holds only JSON state + blob refs).

## 7. Template SDK (the contract `TEMPLATE_LIBRARY.md` implements)

Illustrative shape (final signatures at Phase 1):

```ts
type Aspect = '1:1' | '4:5' | '9:16' | '16:9';

interface TemplateField {
  key: string;
  type: 'text' | 'textarea' | 'textlist' | 'image' | 'color' | 'select' | 'slider' | 'toggle';
  label: string;
  default: unknown;
  // per-type constraints: maxLength, minItems/maxItems, options, min/max/step, optional…
}

interface TemplateDefinition {
  id: string;                       // 'kinetic-headline'
  name: string; tagline: string;
  category: TemplateCategory;
  aspects: Aspect[];                // all four for v1 templates
  defaultAspect: Aspect;
  duration(values: Values): number; // seconds at speed 1 (constant for most)
  loopable: boolean;
  posterTime: number;               // seconds — gallery thumbnail frame
  fields: TemplateField[];
  palettes: Palette[];              // ≥ 4 one-click color schemes
  fontRoles?: Record<string, FontRole>;
  build(ctx: TemplateContext): TemplateInstance; // nodes + timeline + layout(aspect)
}
```

- `TemplateContext` provides: Pixi stage root, logical size, `values`, `rng(seed)`, font registry,
  asset helpers. `build` runs once per (template, aspect); value changes re-run cheap `apply(values)`
  updates where possible, else rebuild (< 50 ms budget).
- **Registry:** `@jima/templates` exports `templates: TemplateDefinition[]`; the gallery, Studio
  routes, poster generation, and golden tests all iterate the registry — adding template #13 is
  one folder + one registry line, no app changes.

## 8. Export pipeline

### 8.1 Profiles (user-facing)
| Profile | Container/codec | Resolution | fps | Notes |
|---|---|---|---|---|
| **MP4 (default)** | MP4 / H.264 high | 1080p (720p option) | 30 (60 option) | ~10 Mbps @1080p30, ~14 @60; keyframe every 2 s |
| **WebM** | WebM / VP9 | 1080p (720p option) | 30 (60) | default on Tier B; option elsewhere (Chromium) |
| **GIF** | GIF | 480p default, 720p option | 15 (12 option) | ≤ 10 s enforced by template durations; loop flag on |

Optional **motion-matched sound track** (ADR-012, supersedes ADR-006): when Sound is on, MP4/WebM
mux a procedurally-synthesized audio track — AAC (MP4) / Opus (WebM) — baked offline from the
timeline's beats via `OfflineAudioContext`. GIF stays silent; browsers without an AudioEncoder
export silent video (probed, never assumed). No sample files are bundled or fetched.

Cues are voiced through the template's **sound profile** (ADR-012a) and one of three packs
(Crisp/Soft/Retro), then summed through a shared high-pass → procedural room → limiter chain. The
cue → voice mapping is a pure function, so the live preview and the baked export render an
identical graph.

Optional **transparent (alpha) export** (ADR-013): a "Transparent background" toggle exports a
**WebM with an alpha channel** (VP9, `alpha: 'keep'` → alpha as packet side data, which Mediabunny
uses to mark the track transparent). The export runner clears the canvas with alpha 0 and a shared
`TRANSPARENT_BG` sentinel blanks each template's full-frame background rect, so only the foreground
carries through — droppable over footage in an NLE. MP4/H.264 and GIF can't carry smooth alpha, so
the toggle forces WebM.

### 8.2 Flow (deterministic offline loop — never `captureStream` for real exports)
```
for frame in 0..(duration*fps):
  timeline.evaluate(frame / fps)
  renderer.render(stage → offscreen target at exact export size)
  MP4/WebM: new VideoFrame(canvas, { timestamp: frame * 1e6 / fps }) → VideoEncoder
            → Mediabunny (Mp4OutputFormat | WebMOutputFormat) → Blob
  GIF:      readback RGBA → post to gifenc worker (quantize + encode)
  await backpressure (encoder.encodeQueueSize / worker ack); frame.close()
yield to UI every N frames → progress = frame/total, cancelable
→ Blob → object URL → <a download> ("jima-<template>-<aspect>.<ext>")
```
- **Threading (ADR-005):** v1 exports on the **main thread** with cooperative yielding — worker
  font support is patchy outside Chromium and the export modal blocks editing anyway. The engine
  stays DOM-light so the loop can move into a Worker+OffscreenCanvas (Chrome/FF/Safari 17+) in a
  post-v1 iteration. GIF quantization *does* run in a worker from day one (pure pixel work).
- **Memory:** stream chunks into Mediabunny's buffer target; close every `VideoFrame`; cap encoder
  queue (~4 in flight); 1080p60×10s stays well under mobile memory limits.

### 8.3 GIF specifics
- gifenc PnnQuant; **global palette** sampled from ~10 evenly-spaced frames (stable colors, no
  per-frame flicker), per-frame palette as debug option. No dithering v1 (flat template art);
  known risk: photo banding in T06 Ken Burns → if QA fails, switch GIF path to `modern-gif`
  (active 2026, dithering) behind the same interface.
- Budget: default GIF ≤ 8 MB (`TEMPLATE_LIBRARY.md` QA gate).

### 8.4 Capability detection (module `engine/src/export/capabilities.ts`)
- Probe at Studio load, cache per session: `'VideoEncoder' in window` → `isConfigSupported()`
  for avc1 / vp09 → **then a real `configure()` + tiny encode smoke test** (Firefox's
  `isConfigSupported` can return true for H.264 and then fail — verified bug pattern).
- Output: `{ mp4: 'native'|'wasm'|'none', webm: 'native'|'recorder'|'none', gif: 'always' }` →
  drives which format cards are enabled and what the messaging says. Never show a format that will
  fail; never dead-end (GIF is universal).

### 8.5 ffmpeg.wasm fallback (lazy)
- Only loaded on user request when native MP4 is unavailable (Tier B/C): single-thread core
  (~31 MB, no COOP/COEP needed), explicit UI warning about download size + speed (a 10 s 1080p
  encode may take ~30 s–2 min). Input: raw RGBA frames or re-encode of a recorded WebM. Vercel
  `vercel.json` headers keep the multithread option available later without re-platforming.

### 8.6 Export determinism tests
- Golden: export 1 s @ 12 fps of two templates in CI (Chromium), demux with Mediabunny, assert
  frame count, duration, dimensions; decode first/last frames and fuzzy-compare against golden
  render targets (tolerance for encoder loss).

## 9. Studio application (React island)

- **Routes:** `/studio` (gallery) and `/studio?t=<id>` (editor) — one lazy route chunk, state-driven views;
  template links from landing deep-link with the template preselected.
- **Store (Zustand):** `{ templateId, values, aspect, speed, playback: {t, playing, loop},
  capability, exportJob, history }`. History = bounded undo/redo stack of value patches (50 steps).
- **Autosave:** debounced 500 ms → localStorage (JSON state, schema-versioned `jima.v1.*`) +
  IndexedDB for image blobs; restore prompt on return ("Continue where you left off?"). Reset per
  template. Clear-all in footer ("Your data lives only in this browser").
- **Favourites:** `jima.favourites` in localStorage — a plain id array behind a module-level
  subscriber set (`studio/state/favourites.ts`), so cards and the chip count stay in sync without
  lifting the state through the whole gallery. Never blocking: a write that fails (quota, private
  mode) is swallowed.
- **Library facets:** `studio/gallery/facets.ts` derives every filter from the `TemplateDefinition`;
  lengths come from `@jima/templates/durations`, a table the golden suite asserts against the real
  built duration for all 445 templates (plus a completeness check), so the gallery can filter on
  length without building a scene and the table cannot silently go stale.
- **Preview player:** rAF loop sets `t`; play/pause/scrub/loop; pauses when tab hidden; respects
  `prefers-reduced-motion` (autoplay off, manual play always allowed).
- **Gallery previews:** poster frames rendered on mount (cheap, single frame at `posterTime`);
  hover/focus plays live via **one shared preview renderer** migrating between cards (never N
  live canvases; keeps GPU/battery sane).
- Full UX spec: `DESIGN_ARCHITECTURE.md` § 6.

## 10. Landing page tech

- The landing is the SPA's index route, kept lean: hero and template rail load as lazy chunks
  after first paint; everything else is CSS-first.
- **Hero chunk** (lazy, mounted when scrolled into view): R3F Canvas — a fullscreen plane with a custom
  gradient-noise `ShaderMaterial` (fbm/simplex in-fragment, brand pastel ramp — zero textures) +
  5–8 floating soft shapes (drei `Float`); pointer parallax; `dpr={[1, 1.5]}`;
  `frameloop="demand"`-style idling when off-screen/plateaued; **no postprocessing**.
  Budget: hero chunk ≤ 180 kB gz total.
- **Fallbacks:** `prefers-reduced-motion: reduce` → static CSS gradient (render one frame, then
  freeze); no WebGL → same CSS gradient. Both must look intentional, not broken.
- **Live template rail:** the marquee of template previews is rendered by `@jima/engine` itself
  (the site demos the product) — one shared renderer paints visible cards; off-screen cards show
  build-time-generated poster images (generated by the same engine in CI — dogfooding).
- Meta: `color-scheme: light only`; title + OG card (engine-rendered) so links look good when
  shared in chats with friends. No SEO work — no sitemap, JSON-LD, or programmatic pages (ADR-011).

## 11. Performance budgets (CI-enforced once code exists)

| Surface | Budget |
|---|---|
| Landing route initial JS (React runtime + landing UI, excl. lazy hero) | ≤ 220 kB gz |
| Hero chunk (three+R3F+shader, lazy) | ≤ 180 kB gz |
| Studio route chunk (UI + store; React shared, engine lazy) | ≤ 250 kB gz |
| Engine+templates chunk (lazy with Studio) | ≤ 250 kB gz |
| ffmpeg.wasm | never in any initial bundle; on-demand only |
| Landing LCP (mid-tier mobile, 4G) | ≤ 2.5 s; CLS < 0.1 |
| Lighthouse (landing, mobile) | ≥ 90 perf, ≥ 95 a11y/best-practices (SEO score not tracked — ADR-011) |
| Preview | 60 fps @ preview res on 2020 mid-range laptop (reference: M1 Air / Ryzen 4500U) |
| Export speed | ≥ realtime for 1080p30 on reference hardware (Tier A) |
| Editor first interaction (template open → editable) | ≤ 2 s on reference hardware, warm cache |

## 12. Privacy & security posture

- No cookies, no accounts, no user-content network calls. CSP: `default-src 'self'` (+
  `worker-src 'self' blob:`, `wasm-unsafe-eval` only if ffmpeg chunk requires it), no third-party
  origins at all. All fonts/scripts/styles self-hosted.
- localStorage/IndexedDB only, documented in a plain-language privacy page ("your work is stored
  in your browser; we never see it — there is nothing to see it with").
- Analytics: none (ADR-009) — and the personal scope (ADR-011) makes even aggregate counters
  pointless. The privacy page states it plainly.
- Supply chain: pinned versions + lockfile, Dependabot, `pnpm audit` in CI; license-checker CI
  gate enforcing § 3.1 policy.

## 13. Testing strategy

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | timeline math, easings, springs (closed-form values), layout/fitting, seeded RNG stability, capability detection (mocked), GIF palette utils |
| Golden frames | Playwright (Chromium + WebKit) | every template × 4 aspects × 5 time points (0/25/50/75/100 %) screenshot-compared to committed goldens; run twice to prove determinism |
| Export smoke | Playwright (Chromium) | 1 s MP4 + GIF export; demux via Mediabunny; assert frames/duration/size; fuzzy first/last frame compare |
| A11y | Playwright + axe | landing + Studio critical flows; keyboard-only export run |
| Budgets | Lighthouse CI + size-limit | § 11 budgets as PR gates |
| Cross-browser manual matrix | QA checklist | Tier A/B/C flows incl. Firefox H.264 probe behavior, Safari 16.x main-thread path, FF Android GIF-only messaging |

Golden-frame determinism is why the engine rules in § 6.1 exist — treat any golden diff without an
intentional template change as a P1 bug.

## 14. CI/CD

- `ci.yml`: typecheck → lint (ESLint + banned-API rule for § 6.1) → unit → build → golden frames →
  export smoke → size-limit → Lighthouse (on built preview).
- Deploys: **Vercel Git integration** — production on `main`, preview URL per PR; no deploy
  workflow needed. `vercel.json`: long-cache immutable assets; COOP/COEP intentionally **off** in
  v1 (single-thread wasm only), toggling headers is a one-line change if ffmpeg-mt is ever needed.
- Release = tag + `CHANGELOG.md` entry (Keep a Changelog discipline per `CLAUDE.md`).

## 15. Failure modes & handling (design-level)

| Failure | Handling |
|---|---|
| WebGL context lost mid-session | auto-recreate renderer, re-render from store state, toast only if visible glitch |
| Encoder error mid-export | abort cleanly, offer next tier (MP4→WebM→GIF), keep project state intact |
| Firefox H.264 probe passes but configure fails | caught by smoke test at detection time → treated as Tier B before user ever sees MP4 card |
| Out-of-memory on long/60 fps exports | preflight estimate (frames × size) with warning; suggest 30 fps/720p; chunked encoding keeps peak bounded |
| Fonts fail to load (offline/adblock edge) | export blocked until `fonts.check()` passes; visible retry; never silently render fallback fonts |
| localStorage full/unavailable (private mode) | Studio works statelessly; autosave disabled with a gentle note |
| Browser below floor | full-page friendly capability message with copy-link to open elsewhere |

## 16. Architecture Decision Records (summary)

- **ADR-001 — No GSAP in the product.** GSAP's post-Webflow "Standard No-Charge" license (since
  3.13, Apr 2025) prohibits use "in tools that allow users to build visual animations without
  code" / products competing with Webflow's visual animation builder — Jima is exactly that.
  Custom `JimaTimeline` instead; also avoided on the marketing site to keep one audited stack.
- **ADR-002 — Mediabunny over mp4-muxer/webm-muxer.** Both older libs are officially deprecated by
  their author in favor of Mediabunny (MPL-2.0, active, Remotion itself migrated to it).
- **ADR-003 (amended 2026-07-21) — Vite + React SPA.** Originally Astro + React island, chosen
  for its zero-JS SEO landing; superseded when the owner descoped SEO entirely (ADR-011). With
  SEO moot, the simplest modern app stack wins: Vite 8 + React 19 + React Router 7, static build.
  Astro/Next remain documented alternatives if the scope ever changes.
- **ADR-004 — Pixi v8 on WebGL for render/export; WebGPU deferred.** Deterministic sync readback
  and cross-device consistency beat WebGPU gains today; revisit post-v1 for preview only.
- **ADR-005 — Main-thread export loop in v1.** Worker font loading is uneven outside Chromium;
  modal UX blocks editing during export anyway; engine kept worker-ready for post-v1 migration.
  GIF quantization in a worker from day one.
- **ADR-006 (superseded 2026-07-21 by ADR-012) — No audio in v1.** Social feeds autoplay muted;
  video-only muxing removed the hardest cross-browser surface (AudioEncoder gaps). Held through
  v1.4; superseded when the owner requested motion-matched sound.
- **ADR-007 — Custom deterministic timeline.** Export must seek exactly; tween evaluator is small;
  removes third-party license/maintenance risk from the core.
- **ADR-008 (amended 2026-07-21) — Vercel static hosting.** Owner decision; zero-config Git
  deploys + per-PR previews; headers via `vercel.json`; `*.vercel.app` URL until a custom domain
  exists. No lock-in (any static host works).
- **ADR-009 — No analytics at launch; user content never measured, ever.**
- **ADR-010 — OFL static-instance fonts, self-hosted.** Canvas can't drive variable axes; OFL
  permits rasterizing into user exports; per-family LICENSE files ship in `public/fonts/`.
- **ADR-011 — Personal-scope deployment (2026-07-21, owner decision).** Jima Motion is built to
  the quality bar of a real Jitter/Ccleaf competitor but deployed privately for the owner plus
  friends/family. Consequences: SEO, marketing/launch assets, trademark checks and discovery work
  are out of scope; English-only UI; no custom domain (Vercel URL). Product quality bars —
  a11y, performance, determinism, the free/no-account principles — are unchanged.
- **ADR-012 — Procedural, motion-matched sound (2026-07-21, owner request; supersedes ADR-006).**
  Every animation gets an optional sound track that fits its motion, toggleable on/off. **No sample
  files** are bundled, licensed, or fetched (keeps CSP airtight and the "client-side only, free"
  rules intact) — SFX are **synthesized with the Web Audio API** from recipe graphs (oscillators,
  filtered seeded noise, envelopes). Cues are **auto-derived from each template's timeline beats**
  (`JimaTimeline.beats()` → `cuesFromBeats`). This scales to the whole library with zero
  per-template authoring and stays deterministic (seeded noise; sound is never part of the visual
  render, so golden frames are unaffected). Preview plays cues live via an `AudioContext` unlocked on the first play/toggle
  gesture; export bakes the same cues offline (`OfflineAudioContext` → `AudioBuffer`) and muxes them
  with Mediabunny (`AudioBufferSource`: **AAC** for MP4, **Opus** for WebM). AudioEncoder gaps —
  the original ADR-006 worry — degrade gracefully: capability is probed like video, and a browser
  without it (or GIF, which has no audio) simply exports silent. Sound defaults on but is a
  persisted global preference, not a per-template/undoable value.
- **ADR-012a — Sound profiles + a two-layer synth (amends ADR-012, 2026-07-26, owner request:
  "the sounds don't fit the animations and aren't high quality enough").** Two changes, one per
  complaint.
  *Fit*: beats now carry **how hard and how fast**, not just what moved (`dur`, `scaleToSmall`,
  `fadeOut`, `moveAxis`/`moveSign`, `rotateAmount`), and every template resolves a **sound profile**
  — `ui | type | impact | data | airy | warm | cinematic` — from its category, overridable per
  template via `TemplateDefinition.sound`. The profile fixes the instrument family, the musical
  scale, the brightness and the density, so a chart steps up a marimba while an opener swells and
  lands. Pitched cues **walk that scale** across a run rather than repeating one hardcoded
  frequency (the old mapper fired the identical 360 Hz tap for all 16 letters of a stagger), the
  first hit of a run is accented and the rest ducked, exits sound different from entrances, impacts
  are spaced so they stay punctuation, and the closing chime only fires **when the tail is actually
  quiet** — it used to be appended unconditionally at `duration − 0.55`.
  *Quality*: a cue is no longer one oscillator. `audio/voices.ts` is a **pure** cue → `VoiceSpec[]`
  mapping (unit-tested in Node, and the reason preview and export provably bake the same graph);
  `audio/sfx.ts` renders it. Every percussive sound is a **transient + body**; air uses **pink**
  noise; bells get inharmonic partials; and all of it runs through a shared master chain —
  high-pass, **procedurally-generated convolution room**, soft limiter. The room is generated from
  seeded noise, so ADR-012's no-sample-files rule still holds. The limiter is load-bearing: a dozen
  cues can land within a few frames and the sum used to clip. Measured across 36 templates, all
  seven profiles and all three packs, baked peaks now sit at 0.19–0.61 with no clipping and no
  silent tracks (`tests/audio.smoke.spec.ts` enforces this).
- **ADR-013 — Transparent (alpha) export via WebM/VP9 (2026-07-21, owner request).** A
  "Transparent background" toggle exports the animation with **no background**, to overlay on footage
  in an editor. Implemented as **VP9 WebM with alpha** (WebCodecs `alpha: 'keep'`; Mediabunny writes
  the alpha as VP9 packet side data and marks the WebM track transparent) — the only alpha-capable
  path our client-side stack can produce (H.264/MP4 has no alpha; GIF only 1-bit). Transparency is an
  **export property, not a template edit**: the export runner clears with alpha 0
  (`RunnerConfig.transparent`) and injects a shared `TRANSPARENT_BG` (`#00000000`) sentinel into
  `values.background`, blanking the uniform full-frame background rect every template draws — so
  91/95 go fully transparent with zero per-template code, and the 4 full-bleed photo/panel designs
  (ken-burns, before-after-slider, split-duo, split-showcase) legitimately stay opaque where content
  fills the frame. Determinism is untouched (export-only; golden frames unchanged). **Known limit,
  surfaced in the UI:** Premiere Pro often imports WebM alpha as opaque; After Effects / DaVinci
  Resolve / CapCut / OBS / web read it correctly. A PNG-sequence export (universal alpha incl.
  Premiere) is the documented fallback if that becomes a need.

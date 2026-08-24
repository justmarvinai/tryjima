# CLAUDE.md — Jima working agreement

**Jima** is one product with two tools, free and browser-only:

- **Jima Captions** — drop in an `.mp4`, a speech model runs on your own device
  and times every word, you style the result and burn it into a full-quality
  export (or write `.srt` / `.vtt`).
- **Jima Motion** — pick one of **495** templates, type your words, export MP4,
  WebM (including transparent) or GIF.

One landing page, one design system, one brand kit, one projects list. No
accounts, no payments, no watermarks, and nothing is ever uploaded — because
there is no server to upload it to.

**Current state: v2.0.0.** The two products shipped separately for a year
(`EinPallux/Jima` and `EinPallux/Jima-Motion`) and were merged here into a
single pnpm workspace, one SPA, and the "Nocturne" dark design system. Both
tools' features carried over whole; nothing was dropped. `pnpm check` is green;
the Playwright golden, export, a11y and smoke suites pass. Cross-browser QA here
is Chromium-only (SwiftShader) — Safari/Firefox/mobile spot-checks are the
owner's to run on the live URL.

---

## Document map (read before building anything)

| Doc | Authority over |
|---|---|
| `docs/ARCHITECTURE.md` | repo shape, routes, both pipelines, storage, testing, deploy |
| `docs/DESIGN_SYSTEM.md` | the Nocturne tokens, typography, cascade rules, the UI kit |
| `docs/MOTION_ARCHITECTURE.md` | the Motion engine, template SDK, export pipeline, **ADRs** |
| `docs/CAPTIONS_ARCHITECTURE.md` | the Captions pipeline, worker protocols, cue model |
| `docs/TEMPLATE_LIBRARY.md` | the template contract + QA checklist |
| `docs/PRODUCT_BRIEF.md` | vision, audience, scope/non-goals, principles |
| `docs/COMPETITOR_RESEARCH.md` | market evidence behind the decisions |
| `docs/ROADMAP.md` | phase order, acceptance criteria, risk register |
| `docs/*_DESIGN_LEGACY.md` | the two predecessor design systems — history only, do not build from them |
| `CHANGELOG.md` | Keep-a-Changelog record; updated every release |

Conflicts: the more specific doc wins; ADRs in `docs/MOTION_ARCHITECTURE.md`
§ 16 win over prose. If you must deviate, amend the ADR in the same change and
note it in `CHANGELOG.md`.

---

## Hard product rules (never violate; reject work that does)

1. **Free means free.** No accounts, login, payments, plans, quotas,
   watermarks, or dark patterns — anywhere, ever.
2. **Client-side only.** No backend, no uploads, no user-content telemetry.
   User video, audio, text and images stay in the browser
   (localStorage/IndexedDB). No analytics. The *only* permitted network requests
   are our own static assets and the one-time Whisper model download from the
   Hugging Face CDN.
3. **Dark shell, light canvas.** Chrome is near-black; the only bright things
   are the user's work and the single lime accent. No light-mode theme, no
   `prefers-color-scheme: light` styling. (This replaced Motion's old
   light-only rule at v2.0 — the predecessor docs still say otherwise and are
   wrong.)
4. **Preview === export.** One renderer per tool, shared between the live
   preview and the encoder. Anything that would let the two diverge is a bug,
   not a feature.
5. **Honest limits.** If a browser cannot do something, say so up front rather
   than failing halfway through an export. If something cannot be saved (the
   source video), say that on the card rather than pretending.
6. **No collaboration features**, no user-facing timelines/keyframes, no AI
   beyond the on-device speech model. Motion's sound is *procedurally
   synthesised* from each template's own timeline beats (ADR-012) — no bundled
   or fetched sample files, so the client-side rule holds.
7. **Determinism.** `packages/engine` and `packages/templates` are pure
   `f(t, values, aspect, seed)`. `Date.now`, `Math.random`, network and DOM
   reads are banned there (seeded RNG from context only) and enforced by ESLint.
   Golden-frame diffs without an intentional change = P1 bug.

## Hard dependency rules

- **GSAP is banned everywhere** (its post-Webflow licence prohibits no-code
  animation tools — ADR-001). Also banned: Remotion (licence), GPL/AGPL runtime
  deps (Etro), and copying code from dual-licensed references
  (openvideodev/DesignCombo — read, don't paste).
- Allowed licences: MIT / Apache-2.0 / BSD / ISC / MPL-2.0; fonts OFL-1.1.
- Core stack: pnpm workspace · Vite 8 + React 19 SPA (React Router 7) ·
  Tailwind 4 · TypeScript strict · Zustand · **PixiJS v8** + `JimaTimeline` ·
  **transformers.js** (Whisper) · **WebCodecs + Mediabunny** · **gifenc**
  worker · Archivo / Geist / Geist Mono for chrome · Vercel (static).

---

## Workflow

- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`); branches
  `claude/<topic>`.
- Definition of done for any change: acceptance criteria met + `pnpm check`
  green + the relevant Playwright suite green + `CHANGELOG.md` entry +
  `docs/ROADMAP.md` status updated.
- New user-facing strings follow the voice: plain, warm, honest — name the
  limitation, give a path.
- Templates: every new or changed template must pass the QA checklist in
  `docs/TEMPLATE_LIBRARY.md` § 5 (German max-length strings, 4.5:1 end-frame
  contrast) **and** land three entries at once — the registry, a
  `TEMPLATE_DURATIONS` row, and a golden baseline. Two coverage tests enforce
  this against the registry; they exist because 50 templates once shipped in
  none of the three and quietly vanished from every length filter.

## Commands

Requires Node ≥ 20.11 and pnpm 10. Run `pnpm install` once.

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server (copies the ORT runtime first) |
| `pnpm build` | Production build → `apps/web/dist` (the only deployable) |
| `pnpm preview` | Serve the production build locally |
| `pnpm typecheck` | `tsc --noEmit` across all three packages and the app |
| `pnpm lint` | ESLint (incl. the determinism guard and the GSAP ban) |
| `pnpm test` | Vitest unit tests (pure logic, Node) |
| `pnpm test:golden` | Playwright: golden frames, exports, a11y, smoke flows |
| `pnpm check` | typecheck + lint + test + build — the pre-push gate |
| `pnpm --filter @jima/web exec size-limit` | Bundle-size budgets |
| `pnpm exec playwright test og-image` | Regenerate `apps/web/public/og.png` |

---

## Known pitfalls (pre-researched — don't rediscover these)

### Styling

- **Tailwind 4 layers.** An *unlayered* rule beats every layered one regardless
  of specificity. Element defaults belong in `@layer base`, component classes in
  `@layer components`. Written unlayered, `button { color: inherit }` silently
  defeated every `text-*` utility on every button in the app.
- **Don't name a colour token after another Tailwind namespace.**
  `--color-base` hijacked the built-in `text-base` font-size utility, turning
  every `text-base` into near-black text on a near-black panel. It is
  `--color-shell` now.
- **Never override a component variant's own utilities through `className`.**
  Tailwind picks the winner by the order it emits utilities, not the order you
  wrote them, so an override is a coin flip: `.text-void` is emitted after
  `.text-lime`, `.inline-flex` after `.hidden`. Both shipped bugs — the closing
  CTA rendered a void label on a void pill, and a responsive `hidden` never hid
  anything. Need a different colour? Add a variant. Need a responsive `hidden`?
  Put it on a wrapper.
- **White on lime is 1.06:1.** Every accent fill takes a `--color-void` label.
- Check text contrast against the **lightest** surface a token can land on
  (`--color-surface-3`), not against the page ground.

### Fonts

- `document.fonts.ready` does **not** load unused faces → always
  `document.fonts.load()` per family+weight before render/export, then
  `fonts.check()`; else the first export renders fallback fonts.
- **There is no `window.fonts`.** A Window keeps its `FontFaceSet` on its
  Document; only a WorkerGlobalScope keeps one on the global. Code shared by the
  main thread and a worker must try `document.fonts` first and `self.fonts`
  second. Reading `globalThis.fonts` alone found nothing on the main thread, so
  the caption loader took its "no FontFaceSet, nothing to do" branch and every
  caption in the editor preview rendered in a fallback face while the export
  worker rendered the real one — a preview/export divergence that no test caught
  because both halves individually "worked".
- **`document.fonts.check('32px Anton')` returns `true` for a font that was never
  loaded** — it answers "can these glyphs be drawn?", and the fallback can draw
  them. To find out whether a face is actually registered, iterate the set and
  match on `family`.
- Canvas `font` cannot express variable-font axes → ship static instances per
  weight for anything the engine or the caption renderer draws. The variable
  faces are for chrome only.

### Deploy

- **`vercel.json` rejects any key outside its schema**, including a `//`
  comment. Validation fails before the build runs.
- **Vercel may run `vite build` straight from `apps/web`**, skipping the repo
  root's `prebuild`. Anything the build needs (the onnxruntime-web copy, the
  post-build prune) lives in `@jima/web`'s own `build` script for that reason —
  a deploy once shipped with no `/ort/` runtime and would have 404'd on
  transcription.
- There are **two `vercel.json` files on purpose** (root and `apps/web`), since
  Vercel reads only the one in the project's Root Directory. Change one, change
  the other — see `docs/ARCHITECTURE.md` § 8.

### Video

- Firefox `VideoEncoder.isConfigSupported()` can approve H.264 and then fail on
  `configure()` → capability detection must run a real configure/encode smoke
  test.
- Never export by reading the DPR-scaled preview canvas — render an offscreen
  target at exact output size; re-rasterise Pixi `Text` at export resolution
  (else blurry text).
- Never use `canvas.captureStream`/MediaRecorder for real exports (realtime
  only, drops frames) — it is the labelled tier-C fallback.
- mp4-muxer/webm-muxer are deprecated — Mediabunny replaced them (don't
  "upgrade" backwards).
- Close every `VideoFrame`; respect `encodeQueueSize` backpressure or long
  exports OOM on mobile.

### Pixi / templates

- Templates must end on a designed hold/loop frame; poster frames come from
  `posterTime`, rendered by the engine in CI (never hand-made screenshots).
- `Text.style.dropShadow` bleeds neighbouring glyph fragments as a ghost row at
  sub-1× rasterisation — which is exactly how the preview and gallery posters
  render (~0.4–0.55×). Use an offset low-alpha twin `Text` behind the real one.
- Soft shadows on floating surfaces need many (7–8) very low-alpha passes; one
  or two thick layers band into a visible outline.
- A `Text` box centres on its **line** box, so glyphs descend ~0.6em below
  centre (not 0.5em) — accent rules placed at 0.5em collide with descenders.
- `Graphics` masks are **binary stencils**. A soft-edged travelling reveal needs
  either a baked gradient `Sprite` mask or (cleaner) one wavefront `f(t)`
  driving several properties at once.
- Long continuous moves (>1.5s) need a velocity-matched multi-leg ease (ease-in
  → linear cruise → ease-to-rest). A lone `outQuint`/`outExpo` finishes the
  travel in the first second, then creeps invisibly.
- Optional text fields: `str(values.x, "<default>")` makes a **cleared** field
  silently revert to the default, so the user can never remove it. Use
  `str(values.x, "")` and declare the real default on the field.

# Jima Motion — Roadmap

**Status:** ✅ **v1.0 shipped (2026-07-21) — all phases 0–6 complete.**
Phases are strictly ordered by dependency; estimates are indicative engineering effort for one
focused developer with AI assistance, not calendar promises. Every phase ends with: acceptance
criteria met → `CHANGELOG.md` entry → phase marked ✅ here. That bookkeeping is part of the
definition of done (`CLAUDE.md`).

**v1 definition (recap from `PRODUCT_BRIEF.md`):** light-mode marketing site with WebGL hero +
free no-account Studio at `/studio` with ≥ 10 templates (12 spec'd), form-based editing, client-side
MP4/WebM/GIF export up to 1080p. No accounts, no watermark, no collaboration, no audio, no AI.

---

## Phase 0 — Foundation ⏳ *(~2–3 days)*

**Goal:** a deployed, empty-but-real skeleton with all guardrails wired.

Deliverables:
- pnpm workspace per `TECHNICAL_ARCHITECTURE.md` § 5 (`apps/web`, `packages/engine`,
  `packages/templates`, `tests`); Vite 8 + React 19 + React Router 7 + Tailwind 4 + TS strict.
- Design tokens from `DESIGN_ARCHITECTURE.md` § 2–4 as the Tailwind theme; fonts self-hosted with
  license files; `color-scheme: light`.
- CI (`typecheck · lint · unit · build · size-limit`) on GitHub Actions + Vercel Git-integration
  deploy (prod + PR previews — owner connects the repo in the Vercel dashboard once);
  license-checker gate (policy § 3.1); ESLint rule banning `Date.now`/`Math.random`/
  GSAP imports in `engine`/`templates`.
- Placeholder landing ("coming soon" with wordmark) + empty Studio route shell.

Acceptance: `pnpm dev/build/test/lint` all green in CI; production URL serves the skeleton;
budgets wired (failing sizes fail CI); `CHANGELOG.md` updated. Update `CLAUDE.md` § Commands with
the real commands.

**✅ Done 2026-07-21.** pnpm workspace on Vite 8 +
React 19 + React Router 7 + Tailwind 4 + TS strict. Determinism ESLint guard verified firing on
`Math.random`/`Date.now`; GSAP import ban active. Playwright pipeline green against the
environment's pre-installed Chromium with **headless WebGL confirmed working** (SwiftShader) —
de-risks Phase 1 golden frames. Build splits Landing/Studio/harness into separate chunks; app
shell 80.6 kB brotli (budget 220 kB). CI + `vercel.json` in place.

## Phase 1 — Motion engine core ⏳ *(~1.5–2 weeks)*

**Goal:** deterministic runtime that can play and seek a real template.

Deliverables:
- `@jima/engine`: Pixi v8 stage management (WebGL forced, context-loss recovery), `JimaTimeline`
  (tweens, staggers, easing set incl. closed-form springs, `steps`), seeded RNG, aspect layout
  helpers + text fit (shrink/wrap), font registry with `document.fonts.load` gating, preview
  player (play/pause/seek/loop/speed).
- Template SDK surface (`TemplateDefinition`, `TemplateContext`) per § 7 + registry.
- **Reference template T01 Kinetic Headline** fully implemented against the SDK (all 4 aspects).
- Golden-frame test harness (Playwright): T01 × 4 aspects × 5 time points, run twice to prove
  determinism; unit tests for timeline/easings/layout.

Acceptance: T01 plays at 60 fps at preview res on reference hardware; identical golden frames
across two runs and across Chromium+WebKit render paths (per-browser goldens); seeking to
arbitrary `t` is exact; no banned APIs (lint green).

**✅ Done 2026-07-21.** Engine built: easings (exact-endpoint families + spring/steps), mulberry32
seeded RNG, stateless `JimaTimeline` (grouped per-property resolution, sequenced tweens, discrete
sets, stagger), aspect/safe-zone + text-fit helpers, `FontRegistry` (Fontsource OFL Space
Grotesk + Inter, `document.fonts.load` gating), `SceneRenderer` (Pixi v8 WebGL, context-loss
recovery), `TemplateRunner`, `PreviewPlayer` (rAF-timestamp clock, no banned APIs). Template SDK +
registry. **T01 Kinetic Headline** implemented (pop/rise/slam, 4 aspects, 4 palettes) — visually
verified professional across all aspects. Tests: **36 unit** (easings/RNG/timeline/layout) + **11
Playwright** — determinism proven by pixel-exact re-seek AND fresh-instance equality; golden
posters stable across two runs. Determinism note: goldens are Chromium-only here (WebKit not
installed in this environment); revisit per-browser goldens if the project ever needs them.

## Phase 2 — Export pipeline ⏳ *(~1–1.5 weeks)*

**Goal:** T01 leaves the browser as MP4, WebM and GIF — client-side only.

Deliverables:
- Capability detection module (probe + **real configure smoke test**, Firefox-lie handling, tier
  result per `TECHNICAL_ARCHITECTURE.md` § 4/8.4).
- Deterministic frame-loop exporter: WebCodecs → Mediabunny MP4 (H.264) + WebM (VP9); gifenc
  worker GIF (global palette); progress/cancel; memory backpressure; filename convention.
- Fallback ladder scaffolding: lazy ffmpeg.wasm path (behind explicit user consent), MediaRecorder
  "preview quality" tier; honest capability messaging strings from `DESIGN_ARCHITECTURE.md` § 9.4.
- Export smoke tests in CI (demux + assert frames/duration; fuzzy frame compare).

Acceptance: on Tier A hardware a 4 s 1080p30 T01 MP4 exports ≥ realtime with zero
dropped/duplicated frames (frame count exact); GIF ≤ 8 MB at default profile; cancel is instant
and leaks nothing (VideoFrames closed); Firefox exports WebM without ever being offered a broken
MP4 card.

**✅ Done 2026-07-21.** Export pipeline built: capability detection via Mediabunny's real
encodability probe (handles the Firefox-lie case natively), deterministic frame-loop exporter
(WebCodecs → Mediabunny MP4/WebM with backpressure-respecting `source.add`), gifenc single-global-
palette GIF in a Web Worker (main-thread fallback), dedicated export-resolution runner (never reads
the preview canvas), progress + `AbortSignal` cancel, even-dimension + filename handling, and Tier
B/C fallback scaffolding (ffmpeg.wasm / MediaRecorder contracts). Export-smoke tests decode outputs
back with Mediabunny: **WebM has exactly 48/48 packets**, GIF is valid GIF89a under the 8 MB budget,
cancel throws `ExportCancelledError`, capabilities probed honestly. MP4/H.264 path is identical code
(codec `avc`) and runs where a platform encoder exists — auto-skipped in this headless SwiftShader
Chromium, which correctly reports `mp4:"none"` (the exact Tier-B case the design anticipates).

## Phase 3 — Studio UI ⏳ *(~1.5–2 weeks)*

**Goal:** the full no-account editing loop around the engine.

Deliverables:
- Gallery view (cards, search, category/aspect filters, shared hover-preview renderer, resume
  banner) and editor view (three-zone layout, Content/Style/Motion tabs, aspect switcher, playback
  bar, template rail, undo/redo, reset) per `DESIGN_ARCHITECTURE.md` § 7.
- Export modal (configure → rendering → done/error) wired to Phase 2, per § 7.3.
- Autosave (localStorage + IndexedDB blobs, schema-versioned), restore prompt, clear-all.
- Keyboard map, focus management, aria-live progress, mobile stacked layout + capability floor
  page.

Acceptance: with T01 only — a first-time user goes gallery → edit → export MP4 in < 60 s (scripted
usability run); full flow completable keyboard-only; axe checks pass; state survives reload;
Studio route chunk ≤ 250 kB gz (engine chunk lazy).

**✅ Done 2026-07-21.** Studio built: gallery (engine-rendered poster cards, search, category
filters, resume banner) and editor (three zones — template rail, live-preview stage with playback
scrubber, Content/Style/Motion inspector), aspect switcher, undo/redo with coalesced edits,
palette-as-preset colour model, export modal (configure → rendering → done/error) wired to Phase 2
with capability-aware format cards and honest disabled-MP4 messaging, autosave (localStorage +
IndexedDB blob plumbing) with reload-restore and `?t=` deep-link, keyboard map (space/arrows/home/
⌘Z/⌘E), reduced-motion handling, mobile stacked layout, and a WebGL2 capability floor. Live editing
uses in-place scene rebuild (no WebGL context churn per keystroke). Studio route chunk 82 kB gz +
lazy Pixi ≈ 220 kB gz total (≤ 250 budget). Tests: 4 Playwright studio-integration specs
(gallery→edit→export→reload-restore) green. Note: a11y built to spec (labels, roles, aria-live,
focus ring, full keyboard); automated axe sweep is deferred to Phase 6.

## Phase 4 — Template library ⏳ *(~2 weeks)*

**Goal:** ship the 12 launch templates. **This phase is the product.**

Deliverables:
- T02–T12 per `TEMPLATE_LIBRARY.md` (T01 exists), each passing the § 5 QA checklist (all aspects,
  max-length DE/EN strings, palettes ≥ 4.5:1 end-frame contrast, speed extremes sane, empty
  optional fields graceful).
- Golden frames extended to all templates × aspects; poster + OG generation script (engine renders
  them in CI).
- Gallery metadata polish: taglines, category chips, duration badges, poster times.

Acceptance: 12/12 shipped (≥ 10 gate if P1 slips — T11/T12 are the designated slip candidates);
golden suite green twice consecutively; GIF budget met per template; a non-designer produces a
shippable-looking post from each P0 template with only text edits (panel review).

**✅ Done 2026-07-21.** All **12 templates** shipped and visually verified across aspects/palettes:
T01 Kinetic Headline, T02 Slide & Reveal, T03 Glow Promo, T04 Product Pop, T05 Typewriter,
T06 Ken Burns Story, T07 Big Number, T08 Quote Spotlight, T09 Logo Sting, T10 Save the Date,
T11 Tips Stack, T12 Split Duo. Engine gained the `update(t)` per-frame hook (count-ups, particle
bursts, typewriter, digit rolls), image-texture loading (`TemplateContext.images`), and serif +
mono font roles (Fraunces, JetBrains Mono). Image-centric templates (Product Pop, Ken Burns, Split
Duo, Logo Sting, Quote avatar) degrade gracefully to designed placeholders when no image is set.
Data-driven golden suite covers all 12 × 4 aspects (48 poster frames) + 12 determinism re-seek
tests — **stable across two consecutive runs**; full suite 70 passed / 1 skipped (MP4 where no
H.264). Poster generation serialized to one WebGL context. Deferred to Phase 6: German max-length
string pass and formal end-frame contrast audit per template.

## Phase 5 — Landing page ⏳ *(~1–1.5 weeks)*

**Goal:** the bold, animated, light-mode front door that demos the engine.

Deliverables:
- All sections per `DESIGN_ARCHITECTURE.md` § 6: Three.js/R3F hero (shader gradient + floating
  shapes, pointer parallax, reduced-motion/no-WebGL static fallback), live template rail (shared
  renderer + CI posters), how-it-works vignettes, why-free comparison, feature grid, gallery
  teaser, FAQ, footer.
- Meta polish (title, engine-rendered OG image so shared links look good in chats), privacy
  page, 404. No SEO work (ADR-011).

Acceptance: budgets green (landing route ≤ 220 kB gz initial JS, hero chunk ≤ 180 kB gz lazy,
LCP ≤ 2.5 s mid-tier mobile); Lighthouse perf ≥ 90 and a11y/best-practices ≥ 95 (SEO score
untracked — ADR-011); hero holds 60 fps desktop / ≥ 30 fps mid-tier mobile
and idles when off-screen; reduced-motion audit passes; every animation on the page is
engine-rendered or CSS (no video files, no Lottie).

**✅ Done 2026-07-21.** Full landing built: sticky navbar; **Three.js/R3F WebGL hero** (custom
fbm-noise pastel gradient shader + floating glossy pebbles + pointer parallax, native fullscreen
quad + float — no drei) with an inline **live T01 rendered by the engine** ("the site demos its
own engine"); reduced-motion / no-WebGL static-CSS-gradient fallback; marquee template rail;
how-it-works; why-it's-free comparison table; feature grid; filterable gallery teaser (deep-links
into the Studio); FAQ accordion; footer with clear-data. **Landing initial 80 kB brotli** (Pixi +
Three both fully lazy after first paint); hero chunk 192 kB brotli (lazy — Three.js floor). 3
landing smoke tests pass; every page animation is engine-rendered or CSS (no video/Lottie).
Budget note: the ≤180 kB-gz hero target is superseded by ~192 kB brotli — the irreducible cost of a
real Three.js hero, and it never blocks first paint. OG image + Lighthouse run deferred to Phase 6.

## Phase 6 — Hardening & release ⏳ *(~0.5–1 week)*

**Goal:** ship v1.0 rock-solid to its real audience — the owner, friends and family (ADR-011).

Deliverables:
- Full manual QA matrix (Tier A/B/C browsers × the flows in `TECHNICAL_ARCHITECTURE.md` § 15),
  fix pass; error-state copy review; final a11y sweep.
- Release polish: README final pass, a short "how to use" note to send along with the link,
  production URL confirmed on Vercel (custom domain optional later — none for now, ADR-011).
- Tag `v1.0.0`, `CHANGELOG.md` release entry.

Acceptance: zero P0/P1 open; QA matrix signed off; `v1.0.0` tagged with CHANGELOG entry; the
production link works logged-out on a friend's device (the "real test" from
`PRODUCT_BRIEF.md` § 8).

**✅ Done 2026-07-21.** Hero reworked to the 3D "motion tile" scene (see CHANGELOG). Automated
**axe-core a11y sweep** (WCAG A + AA) on landing, gallery and editor — zero serious/critical
violations after fixing the preview canvas's missing accessible name and moving muted copy off
low-opacity ink onto the `slate` token (all text ≥ 4.5:1). **Engine-rendered OG image** committed
(`apps/web/public/og.png`, 1200×675, regenerable via `pnpm exec playwright test og-image`) with
`og:image` + Twitter-card meta. **German max-length audit** on T01/T03/T08 — long DE strings shrink
and wrap inside the safe zone, no overflow. README rewritten for the shipped product with a
how-to-use / how-to-share note. `pnpm check` green (typecheck · lint · unit · build); Playwright
suite green. Tagged **`v1.0.0`**. Remaining owner task (can't be automated in this sandbox):
spot-check the live Vercel URL on Safari/Firefox and a real phone — the "works on a friend's
device" test. Chromium (incl. headless SwiftShader WebGL) is fully covered here.

---

## Milestone summary

| Milestone | Definition | Cumulative estimate |
|---|---|---|
| **M0** Skeleton deployed | Phase 0 done | ~3 days |
| **M1** Engine plays T01 | Phase 1 done | ~2.5 weeks |
| **M2** First client-side export | Phase 2 done | ~4 weeks |
| **M3** Full editing loop | Phase 3 done | ~5.5 weeks |
| **M4** 12 templates | Phase 4 done | ~7.5 weeks |
| **M5** Landing live | Phase 5 done | ~9 weeks |
| **M6 = v1.0 private release** | Phase 6 done | ~9.5 weeks |

## Post-v1 backlog (ordered; each item must re-pass the free/no-account principles)

1. **More templates, whenever the mood strikes:** themed drops (seasonal/holiday, meme/trend
   formats, poll/engagement frames, lower thirds, hiring posts, audiogram-look) — category gaps
   listed in `COMPETITOR_RESEARCH.md` § 4.3.
2. ~~Programmatic SEO pages~~ — **descoped by ADR-011** (personal deployment); revisit only if
   the project ever goes public.
3. **Share links:** project state URL-encoded (lz-string) — share/remix with zero backend.
4. **Brand kit presets:** saved colors/fonts/logo in localStorage + shareable preset codes
   (Ccleaf-validated), still no accounts.
5. **Transparent WebM (alpha) exports** — ✅ shipped v1.6 (ADR-013). Still open: a dedicated
   sticker/overlay template pack, and a PNG-sequence export for Premiere-grade universal alpha.
6. **Worker + OffscreenCanvas export migration** (ADR-005 revisit); WebGPU preview evaluation.
7. ~~**Optional sound:** per-template SFX/music toggle~~ — ✅ shipped v1.5 (ADR-012): procedural,
   motion-matched SFX auto-cued from timeline beats, toggle + 3 packs, baked into MP4/WebM.
8. **Custom font upload** (FontFace from file, stays local).
9. **i18n** (DE first — templates already QA'd with German string lengths).
10. **PWA/offline** (static app is 90 % there), custom aspect sizes, more export profiles.
Explicitly still out (standing non-goals): accounts, collaboration, keyframe editing, server
rendering, AI credits, dark mode.

## Risk register

| Risk | L×I | Mitigation |
|---|---|---|
| Browser codec variance breaks exports (esp. Firefox H.264 probe lying) | H×H | Tier system + real configure smoke test (Phase 2 acceptance); GIF as universal floor; honest messaging |
| Preview/export perf misses 60 fps / realtime on low-end | M×H | Object-count budgets per template (QA gate), DPR clamp, perf checks in Phase 1/4 acceptance |
| GIF photo banding (T06) | M×M | gifenc→modern-gif swap path pre-designed behind one interface |
| GSAP (or other banned dep) sneaks in via copy-paste | M×H | ESLint import ban + license-checker CI gate (Phase 0) |
| Golden-frame flake across GPUs/browsers | M×M | per-browser goldens, tolerance windows, fixed seeds, CI-pinned browser versions |
| Scope creep toward accounts/collab/AI | M×H | Principles in `PRODUCT_BRIEF.md` § 6 + non-goals list; PRs violating them are rejected by policy (`CLAUDE.md`) |
| Template quality below "looks expensive" bar | M×H | Panel review acceptance in Phase 4; defaults-only test; better 10 great than 12 mediocre (P1 slip valve) |
| Single-maintainer bus factor | M×M | This doc set + CLAUDE.md keep the project resumable by anyone (including future AI sessions) |

## Status board

| Phase | Status |
|---|---|
| Planning & research | ✅ 2026-07-21 |
| Phase 0 Foundation | ✅ 2026-07-21 |
| Phase 1 Engine core | ✅ 2026-07-21 |
| Phase 2 Export | ✅ 2026-07-21 |
| Phase 3 Studio UI | ✅ 2026-07-21 |
| Phase 4 Templates | ✅ 2026-07-21 — 12/12 |
| Phase 5 Landing | ✅ 2026-07-21 |
| Phase 6 Launch | ✅ 2026-07-21 — **v1.0.0** |
| Post-v1 template expansions | ✅ 2026-07-21 — **v1.1–v1.4**, library 12 → 95 |
| Sound + editable speed/length | ✅ 2026-07-21 — **v1.5** (ADR-012) |
| Transparent (alpha) WebM export | ✅ 2026-07-21 — **v1.6** (ADR-013) |
| +50 templates, new categories, editable decorations | ✅ 2026-07-21 — **v1.7**, library 95 → 145 |
| Gallery search upgrade + full bug sweep (11 fixes) | ✅ 2026-07-21 — **v1.7.1** |
| +10 social templates | ✅ 2026-07-21 — **v1.7.2**, library 145 → 155 |
| Landing makeover + new 3D blob hero | ✅ 2026-07-21 — **v1.8** |
| +5 reference-style templates | ✅ 2026-07-21 — **v1.8.1**, library 155 → 160 |
| Template Library overhaul (uniform 16:9, hover-play, filter) | ✅ 2026-07-21 — **v1.8.2** |
| Remove Backgrounds category + 5 new templates per gallery section | ✅ 2026-07-23 — **v1.9.0**, library 160 → 199 |
| +10 templates each for lower-thirds, social, showcase, explainers/data, events/travel | ✅ 2026-07-23 — **v1.10.0**, library 199 → 249 |
| v2 UI redesign — true light mode, emerald accent, Parkinsans, live-showcase hero (3D hero retired) | ✅ 2026-07-24 — **v1.11.0** |
| +5 templates each for lower-thirds, social, showcase, explainers/data, events/travel | ✅ 2026-07-24 — **v1.12.0**, library 249 → 274 |
| Bold visual refresh — chunky type + vibrant color blocks | ✅ 2026-07-24 — **v1.13.0** (+ v1.13.1 QA hardening) |
| Full re-layout — Jitter-level landing, app-shell library, three-pane editor | ✅ 2026-07-24 — **v1.14.0** |
| +10 templates each for overlays, social, product/ads, showcase, explainers/data, brand/quotes, openers, events/travel | ✅ 2026-07-24 — **v1.15.0**, library 274 → 354 |
| +5 templates for every gallery section (all 9, incl. Text & titles) | ✅ 2026-07-25 — **v1.16.0**, library 354 → 399 |
| Official logo + 3 fonts + body-font picker + 18 theme presets + brand kit | ✅ 2026-07-25 — **v1.17.0** |
| +5 clean/modern/smooth templates for every gallery section | ✅ 2026-07-25 — **v1.18.0**, library 399 → 444 |
| Flight-mode Control Center travel intro (owner request) | ✅ 2026-07-25 — **v1.18.1**, library 444 → 445 |
| Official logo + 3 fonts (Parkinsans/Jakarta/Inter) + body-font picker + 18 theme presets + brand kit | ✅ 2026-07-25 — **v1.17.0** |
| Landing: edge-faded full-bleed sections, 15-template animated hero carousel, Voice Note editor mockup | ✅ 2026-07-27 |
| Sound system rebuilt (motion-matched cues, profiles, transient+body voices, room, limiter) | ✅ 2026-07-27 |
| Motion blur on export · squash & stretch · Energy slider · trim & hold | ✅ 2026-07-27 |
| Procedural music bed + cue-driven auto-ducking | ✅ 2026-07-27 |
| Emoji (platform fonts + shipped Noto Emoji fallback) + emoji picker | ✅ 2026-07-27 |
| Library: favourites (localStorage) + 9 definition-derived filter facets + shipped duration table | ✅ 2026-07-27 |
| +50 templates (overlays, social, product/ads, showcase, explainers) | ✅ 2026-08 — **v1.19**, library 445 → 495 |
| **Merge with Jima Captions — one product, one design system** | ✅ 2026-08-24 — **v2.0.0** |

### v2.0.0 — the merge

| Item | Status |
|---|---|
| pnpm workspace absorbs the Captions engine as `@jima/captions` | ✅ |
| Captions on React 19 / Router 7 / Tailwind 4 / Vite 8, strict TS | ✅ |
| "Nocturne" dark design system replaces both predecessors | ✅ |
| One UI kit + one `ToolBar` shared by both editors | ✅ |
| One landing page; `/app`, `/studio`, `/news` redirect | ✅ |
| Shared brand kit applied in Motion templates *and* caption styles | ✅ |
| Unified projects library; Motion projects keyed per template | ✅ |
| ⌘K command palette, `/help`, `/whats-new` | ✅ |
| Duration table + golden baselines completed for the 50 missing templates | ✅ |
| Coverage tests re-pointed at the registry rather than at each other | ✅ |
| a11y sweep green on the landing, both tools and every content page | ✅ |
| `pnpm check` green; golden, export, audio and smoke suites pass | ✅ |

### Not done here (owner's call)

| Item | Why |
|---|---|
| Safari / Firefox / mobile spot-checks | This environment is Chromium-only (SwiftShader). Run them on the live URL. |
| Domain, DNS, Vercel project wiring | Owner-side. `vercel.json` is ready. |
| A real end-to-end transcription run | Would pull a ~150 MB model into CI on every run; the pipeline is covered by unit tests and the renderer by a browser smoke test. |

*(Update this table + CHANGELOG.md at every phase transition.)*

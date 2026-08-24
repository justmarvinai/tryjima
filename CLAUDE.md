# CLAUDE.md — Jima Motion working agreement

Jima Motion is a **100 % free, no-account, browser-only motion-graphics tool for social media
managers**: pick a template → type your text / drop images → export MP4/WebM/GIF, rendered
entirely client-side. Brand = "Jima Motion"; the editor = "Jima Studio" ("the Studio").
**Current state: v1.0.0 shipped — all phases 0–6 complete; template library since expanded to 445,
plus a v1.5 sound + editable-speed release, a v1.6 transparent-export release, a v1.7
+50-template / editable-decorations release, a v1.7.2 +10-social-template release, a v1.8 landing
makeover (new 3D hero) + Template-Library overhaul, a v1.9 release that removed the Backgrounds
category and added 45 templates (5 new per gallery section), a v1.10 release that added 50
templates (10 new each for lower-thirds, social, showcase, explainers/data and events/travel), a
v1.11 landing + Studio redesign (true light mode, emerald, Parkinsans), a v1.12 release that
added 25 templates (5 new each for the same five sections), a v1.13 bold visual refresh (chunky
oversized type + vibrant coral/pink/amber/mint/indigo color blocks, still fully light + emerald), a
v1.14 full re-layout of the landing, library & editor to a Jitter-level pro-SaaS bar (still fully
light + emerald), a v1.15 release that added 80 templates (10 new each for overlays, social,
product/ads, showcase, explainers/data, brand/quotes, openers and events/travel), and a v1.16
release that added 45 templates (5 new for **every** gallery section, Text & titles included), a
v1.17 release (official Jima logo, +3 fonts, body-font picker, 18 theme presets, brand kit), and a
v1.18 release that added 45 clean/modern/smooth templates (5 new for every gallery section) plus a
one-off owner-requested flight-mode intro (v1.18.1).**
Workspace/CI/guardrails; deterministic motion engine + **445 templates** (12 launch + a 23-template
expansion + a 20-template smooth-text pack + a 20-template explainer/showcase/product/ad pack + a
20-template showcase & product-presentation pack + a 50-template pack adding overlays/lower-thirds,
intros/openers, and more text/social/product/stat/brand + a 10-template
social pack — profiles, reposts, story quiz/Q&A, live reactions, DMs, link-in-bio, verified,
giveaways, trending + a 5-template reference pack — comment threads, named chat convos, search-bar
typing, glowing retro-TV/vlog frames, tiled-watermark product drops + a 45-template v1.9 pack — 5
new per gallery section spanning text, overlays, social, product/ads, showcase, data, brand,
openers and events + a 50-template v1.10 pack — 10 new each for lower-thirds, social, showcase,
explainers & data, and events & travel + a 25-template v1.12 pack — 5 new each for lower-thirds
(chapter marker, KPI/QR/sponsor bars), social (save, share sheet, engagement rail, goal, notif
stack), showcase (phone scroll, device family, coverflow, detail zoom, contact sheet), explainers &
data (checklist, mind map, tier list, scatter plot, stacked bar) and events & travel (webinar,
lanyard badge, birthday, city guide, world clocks) + an 80-template v1.15 pack — 10 new each for
overlays (weather bug, breaking banner, poll/countdown/stat/donation/dateline/key-point/subscribe
bars), social (unmute, screen-record, green-screen, pinned, close-friends, live-shopping,
creator-like, use-this-sound, this-or-that, story highlights), product/ads (restock, BOGO,
ingredients, subscription box, wishlist, limited edition, cashback, gift card, bestseller, app
promo), showcase (code editor, terminal, dashboard, pricing tiers, smartwatch, home widgets, photo
mosaic, slideshow, photo flip, magazine spread), explainers & data (waterfall, heatmap, leaderboard,
cycle, org chart, roadmap, word cloud, quadrant, survey, radar), brand & quotes (logo
assemble/flip/morph, award laurels, coming soon, social end card, brand palette, review stack/badge,
video testimonial), openers (curtain, light sweep, ink, panel, spotlight, countdown ring, burst,
grid, title card, sparkle) and events & travel (wedding, anniversary, speaker lineup, holiday, grand
opening, graduation, packing list, destination reveal, currency, trip map) + a 45-template v1.16
pack — 5 new for every section: text (ransom note, text swing, shadow pop, echo zoom, stand up),
overlays (up next, frame corners, karaoke caption, key press, arrow callout), social (streak, year
recap, voice note, avatar stack, on this day), product/ads (spin to win, loyalty card, order
confirmed, exploded view, waitlist), showcase (blueprint, parallax layers, cube spin, window
cascade, iso layers), explainers/data (bubble chart, slope graph, gantt, dot stats, iceberg),
brand/quotes (crest monogram, ribbon banner, foil card, trophy shelf, press clipping), openers (page
turn, marquee bulbs, shatter, unfold, flash cut) and events/travel (metro map, airmail envelope,
event menu, sunrise scene, race bib) + a 45-template v1.18 pack built to a deliberately calm
clean/modern/smooth brief — 5 new for every section: text (liquid headline, weight shift, slow pan,
depth stack, unfold line), overlays (glass bar, hairline, pill, side rail, soft scrim), social
(collab post, profile grid, scroll stop, quote reel, feed scroll), product/ads (studio pedestal,
float, swatch fan, value stack, product story), showcase (image morph, split scroll, colour grade,
UI states, grid to hero), explainers/data (sankey, treemap, bell curve, journey map, stat morph),
brand/quotes (brand gradient, manifesto, brand values, quote portrait, logo orbit), openers
(gradient wash, hairline, column rise, zoom through, liquid) and events/travel (seat map, compass,
season shift, skyline, horizon pan));
two added categories — **overlay** (lower-thirds), **intro** (openers);
the seldom-used **loop/Backgrounds** category was retired in v1.9;
**per-template toggles to switch off decorative accents** (accent bar/dot, badges, frames, glows…);
editable headline **and body** fonts (10 OFL families incl. Parkinsans, Plus Jakarta Sans, Inter),
**18 global theme presets** (apply to any template via the conventional `background`/`textColor`/
`accent` keys, all contrast-checked), a **brand kit** (save your colors + fonts, reapply anywhere,
localStorage-only), a live **contrast hint**, a use-case-grouped gallery, and per-element color pickers;
the **official Jima logo** across landing + Studio (inlined `JimaLogo`/`JimaMark`, currentColor) —
source art in `assets/`;
**optional procedural, motion-matched sound (ADR-012) — synthesized SFX auto-cued from each
template's timeline beats, toggleable with 3 packs, baked into MP4/WebM exports; GIF silent**;
**editable animation speed/length (0.25×–3×) that the export honours**;
**optional transparent (alpha) WebM export (ADR-013) for overlaying animations onto footage**;
client-side MP4/WebM/GIF export; the full Jima Studio UI;
a modern, light-mode SaaS UI (v2 redesign: **true white** — no tint — with an **emerald** accent and
**Parkinsans** UI type across landing + Studio; a live template-showcase hero replaced the retired
3D/WebGL blob; in-repo shadcn-style Tailwind components in `apps/web/src/ui/`; **v1.13 bold refresh** —
chunky oversized headlines + vibrant color-block sections, a bright-emerald final CTA band, still
fully light + emerald; **v1.14 full re-layout** — a scroll-animated landing (live hero strip, editor
mockup, bento sections), an app-shell template library with a persistent category rail, and a
refined three-pane editor (segmented aspect switch, dotted stage, floating playback), still fully
light + emerald); and Phase 6 hardening
(axe-core a11y sweep with zero serious/critical violations, engine-rendered OG image, German
max-length audit, README polish). All golden, determinism, export-smoke, studio-, landing-integration
and a11y tests pass; `pnpm check` green. Cross-browser QA here is Chromium-only (SwiftShader);
Safari/Firefox/mobile spot-checks are the owner's to run on the live URL.
**Scope (ADR-011):** built to the quality bar of a real Jitter/Ccleaf competitor, but deployed
privately for the owner + friends/family on Vercel — no SEO, marketing, or launch work anywhere;
English-only UI.

## Document map (read before building anything)

| Doc | Authority over |
|---|---|
| `PRODUCT_BRIEF.md` | vision, audience, positioning, scope/non-goals, principles |
| `COMPETITOR_RESEARCH.md` | market evidence behind decisions (Jitter, Ccleaf, landscape, SEO) |
| `TECHNICAL_ARCHITECTURE.md` | stack, engine, template SDK, export pipeline, budgets, **ADRs** |
| `DESIGN_ARCHITECTURE.md` | brand tokens, landing spec, Studio UX, a11y, canonical copy |
| `TEMPLATE_LIBRARY.md` | the 12 launch templates, template contract + QA checklist |
| `ROADMAP.md` | phase order, acceptance criteria, risk register, status board |
| `CHANGELOG.md` | Keep-a-Changelog record; updated every phase/release |

Conflicts: the more specific doc wins; ADRs in `TECHNICAL_ARCHITECTURE.md` § 16 win over prose.
If you must deviate, add/amend an ADR in the same PR and note it in `CHANGELOG.md`.

## Hard product rules (never violate; reject work that does)

1. **Free means free:** no accounts, login, payments, plans, quotas, watermarks, or dark patterns
   — anywhere, ever.
2. **Client-side only:** no backend, no uploads, no user-content telemetry. User text/images stay
   in the browser (localStorage/IndexedDB). No analytics at launch (ADR-009).
3. **Light/white-mode only.** No dark theme, no `prefers-color-scheme: dark` styling.
4. **No collaboration features** (Jitter's turf — explicit non-goal), no timelines/keyframes for
   users, no AI. (Audio: shipped post-v1 as optional **procedurally-synthesized, motion-matched**
   sound — ADR-012. Still no bundled/fetched sample files, so the client-side + free rules hold.)
5. **v1 ships ≥ 10 templates** (12 spec'd; T11/T12 are the only allowed slips).
6. **Determinism:** engine/templates are pure `f(t, values, aspect, seed)`. `Date.now`,
   `Math.random`, network/DOM reads are banned in `packages/engine` and `packages/templates`
   (seeded RNG from context only). Golden-frame diffs without an intentional change = P1 bug.

## Hard dependency rules

- **GSAP is banned everywhere** (its post-Webflow license prohibits no-code animation tools —
  ADR-001). Also banned: Remotion (license), GPL/AGPL runtime deps (Etro), copying code from
  dual-licensed references (openvideodev/DesignCombo — read, don't paste).
- Allowed licenses: MIT / Apache-2.0 / BSD / ISC / MPL-2.0; fonts OFL-1.1. CI license-checker
  enforces this.
- Core stack (verified 2026-07, scaffolded on current majors): Vite 8 + React 19 SPA (React Router 7),
  Tailwind 4, TypeScript strict, Zustand, **PixiJS v8 (WebGL)** + custom `JimaTimeline`,
  **WebCodecs + Mediabunny** (MP4/WebM), **gifenc** worker (GIF), lazy ffmpeg.wasm fallback,
  **Parkinsans** (variable) for UI type + in-repo shadcn-style Tailwind components (the old
  three/@react-three landing hero was removed in the v2 redesign), pnpm workspace, Vercel (static).

## Workflow

- Follow `ROADMAP.md` phase order; don't start a phase before the prior one's acceptance criteria
  pass. Definition of done for any phase/PR: acceptance criteria met + tests green + budgets green
  + `CHANGELOG.md` entry + ROADMAP status board updated.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`, `test:`); branches `claude/<topic>`.
- Copy/strings: use the canonical copy deck (`DESIGN_ARCHITECTURE.md` § 9) verbatim; new
  user-facing strings follow its voice rules (plain, warm, honest — name limitations, give a path).
- Templates: every new/changed template must pass the QA checklist in `TEMPLATE_LIBRARY.md` § 5
  (incl. German max-length strings and 4.5:1 end-frame contrast) and update golden frames
  intentionally.

## Commands

Requires Node ≥ 20.11 and pnpm 10. Run `pnpm install` once.

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server for the web app (landing + Studio) |
| `pnpm build` | Production build → `apps/web/dist` (the only deployable) |
| `pnpm preview` | Serve the production build locally |
| `pnpm typecheck` | `tsc --noEmit` across engine, templates, web |
| `pnpm lint` | ESLint (incl. determinism guard + GSAP ban) |
| `pnpm test` | Vitest unit tests (pure logic, Node) |
| `pnpm test:golden` | Playwright golden-frame + export-smoke tests (real browser) |
| `pnpm check` | typecheck + lint + test + build (the pre-push gate) |
| `pnpm --filter @jima/web exec size-limit` | Bundle-size budgets |

Notes: `pnpm posters` (engine-rendered gallery/OG images) arrives with Phase 4/5. Golden tests use
the environment's pre-installed Chromium automatically (see `playwright.config.ts`); WebGL runs on
SwiftShader headless.

## Known pitfalls (pre-researched — don't rediscover these)

- `document.fonts.ready` does **not** load unused faces → always `document.fonts.load()` per
  family+weight before render/export, then `fonts.check()`; else first export renders fallback fonts.
- Firefox `VideoEncoder.isConfigSupported()` can approve H.264 and then fail on `configure()` →
  capability detection must run a real configure/encode smoke test.
- Never export by reading the DPR-scaled preview canvas — render an offscreen target at exact
  output size; re-rasterize Pixi `Text` at export resolution (else blurry text).
- Never use `canvas.captureStream`/MediaRecorder for real exports (realtime-only, drops frames) —
  it's the labeled tier-C fallback only.
- Canvas `font` cannot express variable-font axes → ship static instances per weight.
- mp4-muxer/webm-muxer are deprecated — Mediabunny replaced them (don't "upgrade" backwards).
- Close every `VideoFrame`; respect `encodeQueueSize` backpressure or long exports OOM on mobile.
- Templates must end on a designed hold/loop frame; poster frames come from `posterTime`, rendered
  by the engine in CI (never hand-made screenshots).
- Pixi `Text.style.dropShadow` bleeds neighbouring glyph fragments as a ghost row at sub-1×
  rasterisation — which is exactly how the Studio preview and gallery posters render (~0.4–0.55×).
  Use an offset low-alpha twin `Text` behind the real one instead.
- Soft shadows on floating surfaces need many (7–8) very low-alpha passes; one or two thick layers
  band into a visible grey outline on white.
- A Pixi `Text` box centres on its **line** box, so glyphs descend ~0.6em below centre (not 0.5em) —
  accent rules placed at 0.5em collide with descenders.
- Pixi `Graphics` masks are **binary stencils**. A soft-edged travelling reveal needs either a baked
  gradient `Sprite` mask or (cleaner) one wavefront `f(t)` driving several properties at once.
- Long continuous moves (>1.5s) need a velocity-matched multi-leg ease (ease-in → linear cruise →
  ease-to-rest). A lone `outQuint`/`outExpo` finishes the travel in the first second, then creeps
  invisibly — three separate template authors hit this independently.
- Optional text fields: `str(values.x, "<default>")` makes a **cleared** field silently revert to the
  default, so the user can never remove it. Use `str(values.x, "")` and declare the real default on
  the field.

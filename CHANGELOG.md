# Changelog

All notable changes to **Jima** are documented in this file.

Jima Captions and Jima Motion shipped as separate products until 2.0.0 merged
them. Everything below 2.0.0 is Jima Motion's history; Jima Captions' own
releases (1.0–1.2) are recorded in `apps/web/src/content/whatsNew.ts`, which is
what the site's /whats-new page renders.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
the project uses [Semantic Versioning](https://semver.org/). Every release must
add an entry here — this file is part of the definition of done (see
`CLAUDE.md`).

## [2.0.0] — 2026-08-24 · Two tools, one Jima

`EinPallux/Jima` (captions) and `EinPallux/Jima-Motion` merged into one product,
one domain and one design system. Nothing was dropped from either.

### Added

- **One landing page.** A single Jima landing at `/` explains the pair and hands
  you the tool you came for. Neither product has a marketing page of its own any
  more — two would rebuild exactly the seam this merge removes.
- **A shared brand kit** (`/brand`). Three colours and two typefaces, saved once
  and applied in Motion templates *and* caption styles. Both tools now offer the
  same twelve typefaces so a caption and a title card can genuinely match; the
  editor shows both engines rendering your kit live, side by side.
- **A unified projects library** (`/projects`). Captions and Motion work in one
  list, with resume and delete. Motion projects are now keyed per template
  rather than a single autosave slot, so editing a second template no longer
  throws the first away. Captions saves your corrected transcript and style and
  asks for the video again on resume — matching it by name and size, because the
  video itself is never written to storage.
- **A product switcher** in both editors, in the same place in the same 52px
  chrome bar, plus a **⌘K command palette** app-wide.
- **`/help`** — getting started for both tools, browser support, and the
  failures people actually hit.
- **`/whats-new`** — both products' release histories on one filterable
  timeline.
- Legacy redirects: `/app` → `/captions`, `/studio` → `/motion`,
  `/news` → `/whats-new`.

### Changed

- **A new design system, "Nocturne"** (`docs/DESIGN_SYSTEM.md`): near-black
  chrome, a light canvas for the user's work, and one electric-lime accent.
  It replaces Motion's white/emerald/Parkinsans and Captions'
  white/indigo-gradient/Space-Grotesk entirely. Type is Archivo (display),
  Geist (UI) and Geist Mono (numerals).
- One component kit (`apps/web/src/ui/`) and one chrome shell
  (`apps/web/src/shell/`) serve the landing and both tools. The two tools'
  duplicate button, select, slider, toggle and colour-field implementations are
  gone.
- Jima Captions moved onto the workspace toolchain: React 19, React Router 7,
  Tailwind 4, Vite 8, and the stricter TS config
  (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`). Its engine is now
  the framework-free `@jima/captions` package.
- Documentation reorganised into `docs/`; each predecessor's design doc is kept
  as `*_DESIGN_LEGACY.md` for history.
- **The hero's Captions demo is a real device now** — a drawn iPhone at true
  19.5:9 with a titanium rail, bezel, Dynamic Island, side buttons, status bar
  and home indicator, turned about fifteen degrees off-axis and tilting under
  the pointer. The stand-in footage behind the captions went from a two-stop
  gradient to a graded night scene with rack-focus bokeh, a slow push and film
  grain, and the transport now reads as one cue inside a longer clip rather than
  running the counter to the end. Still no bundled video and still no WebGL: it
  is CSS, one webfont and a timer, because the hero has to paint before the
  Motion engine is even downloaded.

### Fixed

- **50 templates were missing from the duration table**, so the whole v1.19 pack
  silently dropped out of the gallery's "short" and "long" filters. Their real
  lengths were measured from the engine through the render harness and added.
  The library is **495** templates, not 445 — every count in the UI now reads
  from data rather than a hard-coded number.
- **The coverage tests were checking the wrong thing.** `TEMPLATE_DURATIONS` and
  the golden baseline list were compared against *each other*, so a template
  missing from both passed. Both are now asserted against the registry, and the
  50 missing golden baselines were generated.
- **Every `text-*` utility on a `<button>` was being silently overridden.** The
  element defaults were unlayered CSS, which beats Tailwind's `utilities` layer
  regardless of specificity — so a lime button's black label rendered chalk, at
  1.06:1. Element defaults now live in `@layer base`.
- **A colour token was shadowing a font-size utility.** `--color-base` made
  Tailwind resolve `text-base` to `color: #0B0D10`: near-black text on a
  near-black panel. Renamed to `--color-shell`.
- Text tokens are now checked against the lightest surface they can land on
  rather than the page ground; `--color-dim` was 4.47:1 on a raised panel.
- The landing no longer statically imports the 2.7 MB template registry — the
  count comes from a small data module and the poster marquee is a lazy chunk.
- Three pre-existing lint errors in the v1.19 template pack, and a `<ul>` on the
  landing whose children were `<div>`s.
- **The deploy shipped without the ONNX runtime.** Vercel runs `vite build`
  straight from `apps/web`, which skips the repo root's `prebuild` — so `/ort/`
  was missing and transcription would have 404'd on the live site. The copy and
  the post-build prune now live in `@jima/web`'s own `build` script.
- **`vercel.json` rejected a `//` comment key.** Its schema permits nothing
  outside itself, and validation runs before the build. The explanation moved to
  `docs/ARCHITECTURE.md` § 8.
- **The closing CTA's left button rendered black on black.** Tailwind picks
  between two competing utilities by the order it *emits* them, not the order
  they were written, and `.text-void` lands after `.text-lime` — so a colour
  override passed through `className` beat the variant it was meant to lose to.
  There are now `onAccent` / `onAccentQuiet` button variants for the lime band.
- **The hero's wide template previews flickered on hover, and the rail's left
  edge had no fade.** Both came from the same `mask-image`: a mask pulls every
  descendant into one layer, so the four live WebGL canvases could not composite
  independently, and each card's `transition-all` then animated `box-shadow` and
  `border-color` across them. The fades are ordinary overlay gradients now — one
  per side, both always drawn, which is also what gives the arrows a ground to
  sit on — and a card's hover moves nothing but a `transform`.
- **Caption fonts never loaded on the main thread.** The loader looked for the
  `FontFaceSet` at `globalThis.fonts`, which is where a *worker* keeps it; a
  window keeps it on `document`. So the loader silently no-opped and the editor
  preview drew captions in a fallback face while the export worker drew them in
  the real one — a preview/export divergence, which this codebase treats as a
  bug rather than a rough edge. It resolves `document.fonts` first now, with
  unit tests for both contexts.

### Removed

- Jima Motion's light-mode-only rule, and both predecessor landing pages.

## [Unreleased]

### Added

- **Motion blur on export.** Each output frame can be rendered as the average of
  eight poses spread across a 180° shutter, so fast slides, spins and whip pans smear the way real
  motion graphics do instead of strobing. Only moving elements blur — a headline that has already
  settled stays crisp while a word still sliding in smears, because the blur comes from the actual
  per-element motion rather than a post-process. Off by default, on a toggle in the export dialog,
  and available for GIF too, where 12–15 fps is exactly where un-blurred motion strobes worst.

  This is nearly free architecturally: the timeline is a pure `f(t)` with no per-frame state, so a
  sub-frame is just another evaluation. The average is accumulated as an incremental mean
  (`1/(i+1)` alpha per sub-frame, which is exactly the running mean), with each pose rendered to an
  offscreen target first and blitted as one sprite — a Container's `alpha` multiplies each *child*
  separately, and doing it per-child would blend overlapping elements into each other. Premultiplied
  alpha means it holds for transparent exports too. It costs one render per sample, hence
  export-only.

- **Velocity-driven squash and stretch.** A new SDK helper (`squashStretch`) elongates a node along
  its direction of travel and thins it across, in proportion to how fast it is actually moving —
  the oldest read in animation for "this has weight". It costs no keyframing: the timeline is a pure
  `f(t)`, so sampling a node's position a hair either side of the current frame gives its velocity.
  Volume-preserving, capped, and it fades to nothing on the diagonal, where `scale.x`/`scale.y`
  cannot express the axis. Wired into `side-slide` and `drop-letters` behind a per-template
  "Squash & stretch" toggle; `JimaTimeline.valueAt()` is the new primitive that makes it possible.

- **An Energy slider, 0–200%, on every template.** One control for "calmer" or "punchier" without
  ever showing a keyframe. It reshapes the finished timeline rather than asking 445 templates to
  implement anything, so every template gets it and none of them can get it wrong.

  Two transforms, both chosen because they leave the endpoints exactly where the author put them.
  Ease character: `ease'(u) = u + (ease(u) − u) · g` — the term `ease(u) − u` is the ease's whole
  personality, its deviation from a straight line, which is both the acceleration *and* the
  overshoot; scaling it scales both together, and since that deviation is zero at both ends the
  tween still starts and lands where it did. Travel: `from' = to + (from − to) · g` on position,
  scale and rotation, so a slide starts closer in or further out but lands in exactly the same
  place. Alpha is deliberately excluded — fading in from 0.4 instead of 0 doesn't read as calmer, it
  reads as broken.

  Timing is untouched, which keeps Energy orthogonal to Speed: one changes how the motion *feels*,
  the other how long it *takes*. At 100% the transform is the exact identity, so posters and golden
  frames are unaffected.

- **Trim and hold.** "Start at" skips a slow intro; "Hold last frame" leaves the end card on screen
  long enough to actually read. Both reshape the *output clock* rather than the motion: the runner
  maps output time to timeline time (`min(timelineDuration, trim + t)`), so the player, the scrubber
  and both export loops count in output seconds and never need to know either control exists. The
  sound layer is re-based to match — cues shift with the trim, and cues from before the new in-point
  are dropped rather than piled onto t=0, which would fire a burst of exactly what the trim was
  meant to skip. The Motion tab shows the resulting output length live.

- **A procedural music bed, with automatic ducking.** An optional loop written from the template's
  own sound profile — its key, its scale, its tempo — and locked to the animation's exact length.
  Still no audio files: it is a generated note list the same synth voices, so ADR-012's
  no-sample-files rule holds and a given (profile, length, seed) always produces the same bed.

  Tempo is derived from the animation rather than imposed on it: a whole number of four-beat bars is
  fitted to the duration, so the loop lands where the motion lands instead of being cut off
  mid-phrase. Each profile gets its own progression, tempo and layers — open fifths at 76bpm for
  cinematic openers, a brisk minor loop with an arpeggio for data, no arpeggio at all on warm quotes.

  It ducks itself under the effects. The cue sheet already knows exactly when the loud hits are, so
  this needs no envelope following: the bed reaches its floor precisely on the hit, holds briefly,
  and recovers — anchored open just beforehand so it reads as a dip rather than a slow fade. A
  cluster of hits stays down for the whole cluster instead of pumping once per hit. Measured on the
  real baked audio: under a hit the ducked bed is quieter than the identical un-ducked bed, and away
  from every hit the two are bit-for-bit the same, so the duck genuinely recovers rather than just
  turning the music down.

- **Emoji.** Template families are Latin webfonts with no emoji coverage at all, so an emoji in a
  headline had nothing to resolve to but whatever the browser happened to fall back to. Every font
  role now carries an explicit emoji chain — the platform's colour fonts first (someone typing 😂
  wants the yellow face their phone shows, not a monochrome outline), with Jima's own shipped
  **Noto Emoji** (OFL-1.1) last, purely so a machine with no emoji font at all draws a glyph rather
  than tofu.

  The shipped face costs nothing on a normal device: it is last in the chain, and it is only
  *fetched* when the text actually contains emoji **and** a width probe shows the platform can't
  draw them itself. Fontsource splits it into ten unicode-range subsets, so even then the browser
  pulls one small file rather than the megabyte. The stack goes to the measuring canvas as well as
  to Pixi, so emoji measure against the same faces they are painted with and text still fits.

  The Studio's text fields also gained a small emoji picker — thirty that actually turn up in social
  copy, not a 3,000-glyph grid the OS already does better.

- **Favourites.** A star on every card and a Favourites filter in the library. 445 templates is well
  past the point where scrolling is a strategy, and a shortlist is the cheapest fix. It lives in
  `localStorage` like every other preference here — no account, nothing leaves the browser. The star
  is a sibling of the card button rather than a child (a button inside a button is invalid HTML and
  would open the template on every star click), it rides along with the card's hover lift, and it
  stays visible on touch, where a hover-only control is just an invisible tap target.

- **Filters that describe what a template actually is.** Nine chips across three groups — length
  (under 4s / over 4.5s), shape (vertical / square-4:5 / widescreen) and content (takes a photo /
  takes a list / alpha-safe / lots to tweak) — combining with the category rail and the search box.
  Every one is *derived from the template definition*, not from hand-written tags, so a new template
  is classified correctly by construction and the filters can never drift from the library.

  Each chip carries the count it would leave, computed against the **other** active filters, so the
  number is what pressing it gives you rather than what you already have; a chip that would empty
  the grid goes inert instead of becoming a dead end. The set was chosen by measuring the real
  library, not by guessing: two candidates were cut for failing that check — "cinematic sound" was
  really just the Openers category under another name, and "six or more fields" matched 87% of the
  library, which is not a filter. Every shipped chip now matches between 15% and 45% of the library,
  and a Playwright test enforces that as the library grows.

- **Template lengths ship as data** (`@jima/templates/durations`). The gallery needs a length to
  filter on and cannot build 445 scenes to find one, and only 76 templates carried an
  `estimateDuration`, so a duration filter built on that would have been wrong for the other 369.
  The figures now live in one table that the golden suite asserts against the duration the engine
  really produces — for every template, plus a check that the table covers exactly the library. A
  template whose timing changes, or a new one that never lands in the table, fails CI instead of
  quietly filtering wrong.

### Changed

- **The sound system is rebuilt (ADR-012a).** The owner's report was that the sounds didn't fit the
  animations and weren't well enough made; those are two different problems and both are addressed.

  **Fit.** Motion beats now record *how hard and how fast*, not just what moved — tween duration,
  collapse and fade-out (so exits stop sounding like entrances), travel axis and direction, rotation
  amount. On top of that every template resolves a **sound profile** (`ui`, `type`, `impact`,
  `data`, `airy`, `warm`, `cinematic`) from its category, overridable per template via
  `TemplateDefinition.sound`. The profile fixes the instrument family, the musical scale, the
  brightness and the density: a chart now steps up a marimba, an opener swells and lands on a low
  hit, a lower-third stays out of the way. Pitched cues **walk the profile's scale** across a run
  instead of repeating one hardcoded frequency — the old mapper played the identical 360 Hz tap for
  all sixteen letters of a stagger. The first hit of a run is accented and the rest ducked; impacts
  are spaced so they read as punctuation rather than texture; and the closing chime only fires when
  the tail is genuinely quiet, where it used to be appended unconditionally at `duration − 0.55`
  whatever was on screen.

  **Quality.** A cue is no longer a single oscillator with an envelope. Every percussive sound is a
  **transient plus a body** — the short filtered tick is what makes a sound read as an object rather
  than a beep. Air uses **pink** noise instead of white, bells get inharmonic partials, marimbas get
  their characteristic fourth partial, and everything runs through a shared master chain:
  high-pass, a **procedurally generated convolution room**, and a soft limiter. The room is
  synthesized from seeded noise, so there are still no sample files to bundle, fetch or license. The
  limiter is not polish — a dozen cues can land within a few frames and the sum used to clip.

  The cue → voice mapping is a **pure function** (`audio/voices.ts`), unit-tested in Node, which is
  also what makes the live preview and the baked export provably render the same graph.

  The three packs are now real characters rather than a swapped waveform: **Crisp** (bright, punchy,
  modern app UI), **Soft** (rounded, longer tails, more space) and **Retro** (chiptune pulses, dry
  and close).

  Verified by baking the real Web Audio graph in a browser across 36 templates, all seven profiles
  and all three packs: peaks land at 0.19–0.61 with no clipping and no silent tracks.
  `tests/audio.smoke.spec.ts` (10 tests) keeps it that way; 86 unit tests cover cue selection and
  voice specs. Golden frames are untouched — sound never takes part in the render.

### Fixed

- **Toggle knobs sat outside their pill in the Studio.** Measured: a 44px track with a 20px knob
  drawn at x+42..x+62 — 18px clear of the right end when on, flush against it when off. The knob is
  absolutely positioned but had no `left`, so it fell back to its static position, and a `<button>`
  centres its inline content: computed style showed `left: 22px` on an element that never set it.
  All four switches (template decorations, sound, loop, transparent export) shared the copy-pasted
  markup, so the fix lands as a shared `Switch` primitive.

### Added

- **The hero strip is now a template carousel — twelve templates, all of them animating.** Previous
  arrow buttons page the rail (it still scrolls and swipes directly); the fade lifts on whichever
  side has run out of cards, so a visible fade always means "there is more this way". Every card on
  screen plays its real animation instead of a still: cards start a live preview only while they are
  genuinely visible — an IntersectionObserver against the viewport, which also accounts for the
  rail's own horizontal clipping — so about four WebGL contexts exist at a time rather than twelve,
  and all of them are released when the hero scrolls away. A cached poster frame sits underneath as
  the placeholder, so a card is never blank while its context boots, and is what a reduced-motion
  visitor sees (arrows still page, instantly).
- The twelve are a new set, one per use case (statement, product, app, social, data ×2, opener ×2,
  photo, showcase, travel) in mixed aspects, chosen as much for motion as for looks: candidates were
  measured frame-by-frame over a full loop and rejected when they snapped into place early and held
  (bar-race holds 2.8s of 4.6s, gallery-strip 2.6s of 4.2s). Overlays are excluded for the reason
  they are overlays — a bar on an empty frame reads as an empty card.

### Changed

- **Landing: the hero strip and the template marquee now sit inside the page's content column.**
  Both were full-bleed and hard-cut at the viewport; they now share the same width as every other
  section and dissolve at the left/right edges via a new `.edge-fade-x` mask utility (a mask, not
  two opaque gradient overlays, so the fade works over any background and needs no colour matching).
  Each side is separately overridable so a scroller can drop the fade where it has run out of cards.
- **The Studio mockup now shows Voice Note (Social) instead of a generic headline template**, and
  the faux inspector shows that template's real fields at their real defaults — Sender name "Maya",
  Reply "Hahaha love this 😂", its palette's own accent (so the swatch matches the blue waveform
  beside it) and the `noteLen` slider at 7s on its 3–30s range. Template-specific controls make the
  "everything is a simple field" point better than Headline/Subline did. The panel also gained the
  editor's real "Editing / <name> / <category>" header, and the preview now sits on the Studio's
  actual dotted stage as a centred canvas card rather than filling the pane edge to edge.
- Hero cards are sized for that narrower column: a viewport-tracking height
  (`clamp(184px, 19vw, 248px)`) with widths from the aspect ratio, instead of a fixed 300px. The
  per-card float animation is gone — a horizontal scroller has to clip its vertical axis, and every
  card now carries its own motion anyway.

## [1.18.1] — 2026-07-25 · Flight Mode — an iOS Control Center travel-vlog intro

One owner-requested template for **Events & travel**: `flight-mode`. A light-mode iOS-style Control
Center tile drops in with a soft bounce; the Flight Mode button presses with a heavy, bouncy impact
and turns airplane-orange (WiFi, cellular and Bluetooth dim in sympathy — airplane mode really does
kill the radios); a "Flight Mode: On" pill pops; then the plane lifts vertically off its button,
banks, and accelerates out of frame, handing over to an editable title + subline end card
("Off to Tokyo · A travel film"). Designed as an intro/transition for travel vlogs; ~5.4 s.

The takeoff flies a quadratic bezier whose start tangent is vertical and whose end tangent is
up-and-right, so one continuous curve gives both the lift off the button and the bank away — no
two-phase seam. Position, bank and scale all derive from the same parameter in a pure `update(t)`,
which is why the nose always points exactly along the path, and a short ghost trail fades up only
once the plane is genuinely moving fast.

The airplane silhouette is one closed mirrored path rather than a fuselage plus separate wing
polys — the overlapping fills showed hairline seams at the wing roots that the scaled-up takeoff
magnified badly. The departing plane also starts in the button's white and only turns accent once
it is clear of the orange disc; an orange plane on an orange circle is invisible.

All four aspects, 4 light palettes, per-element colours, status-pill + shadow toggles; the drawn
airplane/WiFi/Bluetooth/cellular glyphs are Graphics, no image assets. Golden: 4 baselines,
determinism verified, existing 444 untouched.

## [1.18.0] — 2026-07-25 · +45 clean/modern/smooth templates → 444

Five new templates for every gallery section, built to a deliberately calmer brief than the earlier
packs: **clean, modern, unique, smooth**. Long eased moves (`outExpo`/`inOutCubic`, 0.7–1.4 s heroes,
60–120 ms staggers), generous negative space, hairlines over heavy rules, muted palettes with one
confident accent — and no bounces, overshoots or strobes anywhere in the pack.

### Added
- **Text & titles (5):** liquid headline (organic wave-edge mask), weight shift (light→bold
  typographic morph), slow pan, depth stack (parallax convergence), unfold line.
- **Overlays (5):** glass bar, hairline, pill, side rail (the library's first *vertical*
  lower-third), soft scrim.
- **Social (5):** collab post, profile grid, scroll stop, quote reel, feed scroll.
- **Product & ads (5):** studio pedestal, float, swatch fan, value stack, product story (a 3-beat
  problem → product → result narrative).
- **Showcase (5):** image morph, split scroll (counter-scrolling columns), colour grade, UI states,
  grid to hero.
- **Explainers & data (5):** sankey flow, treemap, bell curve, journey map, stat morph.
- **Brand & quotes (5):** brand gradient (a living mesh field), manifesto, brand values, quote
  portrait, logo orbit.
- **Openers (5):** gradient wash, hairline, column rise, zoom through, liquid.
- **Events & travel (5):** seat map, compass, season shift, skyline, horizon pan.

### Notes
- Every duration was read back off a live `TemplateRunner` and every template's re-seek verified
  pixel-identical before baselines were written. 180 new golden baselines; the existing 399 are
  byte-for-byte unchanged.
- `treemap` carries an adaptive contrast ramp: it is the only template placing text on accent-tinted
  surfaces, and mid-tone tints are exactly where neither a light nor a dark ink clears 4.5:1.
- Several engine-level lessons from this pack were added to the pitfalls list in `CLAUDE.md` — Pixi
  `Text.dropShadow` ghosting at sub-1× rasterisation, line-box descender geometry, binary-stencil
  `Graphics` masks, velocity-matched multi-leg easing for long moves, and the cleared-optional-field
  default bug.

## [1.17.0] — 2026-07-25 · Official logo, 3 new fonts, theme presets & brand kit

The official Jima logo lands across the site, the font picker grows, and the Style tab gains two
features that make every one of the 399 templates substantially more editable.

### Added
- **The official Jima logo.** Inlined from `assets/` as a `JimaLogo` (full lockup) / `JimaMark`
  (glyph) component and used everywhere the old placeholder leaf mark was — landing nav, footer,
  Studio library rail, editor top bar, legal pages, capability screen — plus a real favicon and
  apple-touch-icon. Inlined rather than `<img>` so it paints with the first render, costs no extra
  request, and inherits `currentColor` (one asset serves ink-on-white and white-on-emerald).
- **Three new fonts: Parkinsans, Plus Jakarta Sans and Inter.** Selectable for headlines. Parkinsans
  ships as *static* instances (family "Parkinsans") deliberately separate from the variable face that
  drives app chrome — a canvas `font` string can't express variable axes, so template text needs real
  static weights or it silently falls back.
- **A body-font picker.** The body role (sublines, captions, labels) is now swappable too, not just
  the headline — so a project's whole type pairing is the user's choice. Honoured identically by the
  preview and the export.
- **18 global theme presets.** Unlike the per-template palettes, these apply to *any* template:
  they drive the three colour fields virtually every template declares by convention (`background`,
  `textColor`, `accent`) and skip bespoke keys, so a preset can never break a layout it doesn't
  understand. 12 light + 6 dark, each with text ≥ 4.5:1 and accent ≥ 3:1 on its background —
  asserted by unit tests, not by eye.
- **Brand kit.** Save your colours + fonts once and reapply them to any template in a tap. Stored in
  this browser only (localStorage), like the sound preference — nothing leaves the device.
- **A readability hint.** The Style tab now shows the live contrast ratio of your text on your
  background, and names the problem when it's too low. Guidance, not a block — some templates put
  text on a card rather than the background.

### Fixed
- **Font weights are no longer claimed without being loaded.** Each selectable font now declares the
  static weights actually shipped for it, and the default registry registers the weights templates
  really draw at (notably display 600 and body 700). Previously an unregistered weight was *measured*
  against a fallback face while *painting* with the real one, so any template that measures text to
  compute its own wrapping got the wrong width.
- **Testimonial Slide no longer clips its quote.** The visible symptom of the above: in 16:9 the
  quote overflowed the right edge and was cut off mid-word, because the wrap width was measured
  against a fallback face. It now wraps onto two lines as designed. This is the one intentional
  golden-baseline update in this release — the old baseline had captured the bug. The full
  1,995-test golden suite is otherwise unchanged.

## [1.16.0] — 2026-07-25 · +45 templates (5 per section, all nine) → 399

Five new templates for **every** gallery section this time — Text & titles included — taking the
library from 354 to **399**. Same contract as the rest: deterministic (pure `f(t)`, seeded RNG only),
all 4 aspects, 4 palettes with ≥4.5:1 end-frame contrast, per-element colour fields, decorative
toggles and a designed hold/poster frame.

### Added
- **Text & titles (5):** ransom note (per-letter cut-paper tiles), text swing (hinged sign plates),
  shadow pop (hard flat offset print layers), echo zoom (outlined ripples), stand up (rises off the
  floor in perspective with a cast shadow).
- **Overlays & lower-thirds (5):** up next (broadcast queue card), frame corners (drawing brackets),
  karaoke caption (travelling per-word highlight), key press (depressing keycaps), arrow callout
  (freehand scribble + arrow).
- **Social (5):** streak counter (flickering flame + day ticks), year recap (wrapped-style stat
  takeover), voice note (playing waveform bubble), avatar stack (overlapping pile-up + count),
  on this day (taped memory card).
- **Product & ads (5):** spin to win (prize wheel that deterministically lands the winner), loyalty
  card (punch stamps), order confirmed (success check + stepper), exploded view (parts separate and
  reassemble), waitlist (typed email + queue position).
- **Showcase (5):** blueprint reveal (wireframe → filled), parallax layers, cube spin (stepped
  faux-3D faces), window cascade (OS windows open into a cascade), iso layers (isometric exploded
  stack).
- **Explainers & data (5):** bubble chart, slope graph (before → after), gantt chart (with a today
  line), dot stats (100-dot isotype), iceberg model.
- **Brand & quotes (5):** crest monogram (type-on-a-circle crest), ribbon banner (unfurl with folds),
  foil card (tilting holo shine), trophy shelf, press clipping (torn newsprint quote).
- **Openers (5):** page turn (corner peel), marquee bulbs (chasing theatre bulbs), shatter intro
  (cracking pane + falling shards), unfold intro (hinged panels), flash cut (photo-flash montage).
- **Events & travel (5):** metro map (schematic transit route), airmail envelope (flap opens, invite
  rises, postmark stamps), event menu, sunrise scene, race bib (pinned marathon bib).

### Notes
- Golden determinism + poster entries added for all 45; 180 new baselines generated and the existing
  354 baselines are byte-for-byte unchanged. Every new template's duration was probed against the
  live engine and its re-seek pixel-identity verified before the baselines were written.

## [1.15.0] — 2026-07-24 · +80 templates (10 per non-Text section) → 354

Ten new templates for every gallery section **except Text & titles**, taking the library from 274 to
**354**. Each is deterministic (pure `f(t)`, seeded RNG only), light-mode, ships all 4 aspects and 4
palettes with ≥4.5:1 end-frame contrast, per-element colour fields, decorative toggles and a designed
hold/poster frame — same contract as the rest of the library.

### Added
- **Overlays & lower-thirds (10):** weather bug, breaking banner, poll bar, countdown strip, now
  speaking, stat strip, donation alert, dateline, key point, subscribe reminder.
- **Social (10):** unmute tap, screen record, green screen, pinned post, close friends, live
  shopping, creator like, use this sound, this-or-that, story highlights.
- **Product & ads (10):** restock alert, BOGO offer, ingredients, subscription box, wishlist add,
  limited edition, cashback offer, gift card, bestseller tag, app promo.
- **Showcase (10):** code editor, terminal, dashboard, pricing tiers, smartwatch showcase, home
  widgets, photo mosaic, slideshow, photo flip, magazine spread.
- **Explainers & data (10):** waterfall chart, heatmap, leaderboard, cycle diagram, org chart,
  roadmap, word cloud, quadrant, survey results, radar chart.
- **Brand & quotes (10):** logo assemble, award laurels, logo flip, coming soon, social end card,
  brand palette, logo morph, review stack, review badge, video testimonial.
- **Openers (10):** curtain intro, light sweep, ink reveal, panel slide, spotlight reveal, countdown
  ring, burst intro, grid intro, title card, sparkle reveal.
- **Events & travel (10):** wedding invite, anniversary card, speaker lineup, holiday card, grand
  opening, graduation card, packing list, destination reveal, currency card, trip map.

### Notes
- Golden-frame baselines + determinism entries added for all 80 (poster frames across every aspect);
  existing 274 baselines unchanged. The overlay templates default to a transparent background so they
  export as alpha WebM overlays.

## [1.14.0] — 2026-07-24 · Full re-layout — Jitter-level landing, library & editor

A ground-up **re-layout** (not just a restyle) of all three surfaces, benchmarked against a
professional motion-SaaS bar. Still **fully light mode**, still **emerald-branded**, still 100% free /
client-side / no-account — no product rules touched. The render engine and template library are
unchanged; this is chrome only.

### Added
- **Scroll-motion foundation.** A reusable `Reveal` component + `useInView` (IntersectionObserver)
  hook drive staggered scroll-reveal across the landing; a `.marker-hl` animated highlighter swipe
  (`Marker`), floaty idle transforms, and shimmer keyframes. Everything collapses to static under
  `prefers-reduced-motion`.
- **New landing primitives.** `MockupFrame` (faux app window), `BentoCard` (vibrant hover-lift tile),
  and a `LivePreview` that now accepts an `aspect` prop so previews render in their native ratio.
- **New landing sections.** A mixed-aspect floating live-template **hero strip** (replaces the single
  showcase), a faux-Studio **EditorShowcase** mockup, two animated **pull-quotes**, a bento **Features**
  grid, and a richer multi-column footer.

### Changed
- **Landing — full re-layout.** Centered marker-underlined hero + CTA pills → live hero strip →
  labelled template marquee ("Templates for every post") → "From idea to export" bento → editor
  mockup → pull-quote → Features bento → "not a trick" comparison → gallery teaser → pull-quote → FAQ
  → emerald final CTA → footer.
- **Library — app-shell re-layout.** The gallery is now a true app layout: a persistent left
  **category rail** (colour-dotted, counted, sticky full-height) + a sticky search header + a wider
  responsive grid. Category chips remain on mobile where the rail is hidden.
- **Editor — pro three-pane re-layout.** Cleaner top bar (app mark + template name + category badge +
  segmented aspect switch + grouped actions), a labelled left **Library** thumbnail rail, a dotted
  **stage** backdrop with the artboard on a floating card + a floating playback pill, and a titled
  Inspector panel header. All roles, labels, keyboard behaviour and autosave are unchanged.
- Centralised the category-label map in `gallery/groups.ts` (`categoryLabel`), shared by the card,
  editor top bar and inspector.

## [1.13.1] — 2026-07-24 · QA hardening pass (bug fixes from a full code review)

A round of fixes from a full QA/code review (no CRITICALs found; the high-risk export/determinism
paths were verified clean). No template or golden-frame changes.

### Fixed
- **Live preview no longer breaks on a malformed hex color.** `engineValues` now blanks an invalid
  hex (e.g. a half-typed `#3` or `red`) → the template falls back to its palette color, and
  `TemplateRunner.rebuildScene` builds the new scene before destroying the old one, so a throwing
  build can never tear down the live root. (HIGH)
- **Keyboard operability in the Studio.** Space / arrows / Home no longer hijack a focused button,
  radio (aspect), switch (sound/loop) or slider; and Cmd/Ctrl+Z yields to native undo inside text
  fields. (HIGH)
- **Export cancels properly.** Closing the export modal mid-render (e.g. Escape) now aborts the
  export — no surprise download, no leaked blob URL. Capability detection no longer clobbers a format
  the user already picked.
- **Image handling.** Picked-image object URLs are revoked on replace/remove/unmount (were leaking);
  upload failures (e.g. storage full) surface an error and are size-guarded (≤20 MB).
- **Counters parse correctly.** `parseTargetNumber` now understands decimals and K/M/B/T suffixes
  (`1.2M` → 1,200,000 instead of 12); `groupThousands` handles very large magnitudes.
- **Engine robustness.** Capability probe is memoized per export resolution (not shared); image
  bitmaps/textures are freed on runner teardown; `fps=0` and GIF palette (256) guards added.
- **Reset / resume.** "Reset template" also restores font + loop; resuming a project merges current
  template defaults so newly-added fields aren't blank in the inspector.
- **A11y / polish.** FinalCta focus ring is now ink (≥6:1 on the emerald band); the template marquee
  hides its duplicated row from assistive tech and pauses on keyboard focus; cross-page `/#…` links
  scroll to their section; route-loading copy is generic; `indigo` token darkened for text contrast.

### Changed (guardrails)
- Determinism ESLint guard broadened to also ban `Intl`/`crypto`/`navigator`/`localStorage`/
  `sessionStorage`/`XMLHttpRequest`/`WebSocket` in engine + templates. The CI license-checker step is
  now blocking (was warn-only).

## [1.13.0] — 2026-07-24 · Bold visual refresh — chunky type + vibrant color blocks

A bolder, more modern evolution of the v2 UI across the landing page and Studio, inspired by
contemporary bold-SaaS landing design. Still **fully light mode** and still **emerald-branded** — no
dark theme, no dark-mode toggle. The template library and render engine are unchanged.

### Changed
- **Bolder foundation.** New vibrant color-block tokens (`coral`/`pink`/`amber`/`mint`/`indigo`, each
  with a light `-tint`), a chunky `rounded-bento` radius and a punchy `shadow-bold`, plus tighter,
  larger display type (`headline-xl`) — all added to `apps/web/src/styles/index.css`.
- **Bolder primitives.** `Button` (heavier weight + press), `Card` (optional `tone` tint + `bold`
  2px-ink-border treatment), `Badge` (vibrant tones), and a bigger/bolder `SectionHeading` with an
  eyebrow pill (`apps/web/src/ui/`).
- **Landing.** Oversized hero headline with a marker-highlight accent; "How it works" is now three
  chunky color-block cards (mint/amber/coral); the "why it's free" comparison table leads with a bold
  emerald column; feature cards get vibrant icon chips; the FAQ uses chunkier accordion cards; and a
  new **bright-emerald final CTA band** ("It's time to make something move") closes the page. Every
  existing section is kept (live hero showcase, template marquee, comparison, gallery teaser, FAQ).
- **Studio.** Bigger/bolder gallery heading + chunkier chips and cards, emerald active states across
  the aspect toggle / inspector segments / export options, a `rounded-bento` export modal and preview
  frame — while the editing surface stays calm and neutral for focus.

### Notes
- axe-core: zero serious/critical violations on landing, gallery, editor, privacy and terms (the new
  vibrant colors are used as light tints with dark ink text, or as accents — all ≥4.5:1). `pnpm
  check`, size-limit, and the landing + Studio smoke suites are green.

## [1.12.0] — 2026-07-24 · +25 templates — 5 each for five sections (249 → 274)

Five new templates apiece for **Lower-thirds, Social, Showcase, Explainers & data, and Events &
Travel**, taking the library to **274**. All deterministic, all 4 aspects, ≥3 palettes (mostly 4),
per-element color fields, decorative toggles, ≥4.5:1 end-frame contrast.

### Added — 25 templates

- **Lower-thirds** (`overlay`, transparent-export-friendly): `chapter-marker` (video-chapter kicker
  + title + rule), `metric-bar` (one-KPI pill with count-up + delta chip), `social-bar` ("Follow
  along" handle chips), `qr-callout` (faux-QR scan card), `sponsor-bar` ("Sponsored by" logo lockup).
- **Social**: `save-post` (bookmark save + toast + count), `share-sheet` (native share tray),
  `action-rail` (vertical Reels/TikTok engagement rail), `goal-tracker` (follower-goal progress bar),
  `notif-stack` (cascading notification pills).
- **Showcase**: `phone-scroll` (scrolling phone mockup), `device-family` (laptop + tablet + phone
  responsive set), `coverflow` (perspective coverflow carousel), `detail-zoom` (guided ken-burns
  with callouts), `contact-sheet` (photo contact sheet with a selected frame).
- **Explainers & data**: `checklist` (ticking checkbox cascade), `mind-map` (central node + branch
  spider), `tier-list` (S/A/B/C tier rows), `scatter-plot` (bubble scatter + trend line),
  `stacked-bar` (100% segmented breakdown + legend).
- **Events & Travel**: `webinar-invite` (register card + host avatars), `lanyard-badge` (swinging
  conference badge), `birthday-card` (confetti celebration), `city-guide` (destination highlights),
  `time-zones` ("meanwhile" world clocks).

### Notes
- Engine, export pipeline and the existing 249 templates are unchanged. `pnpm check` (typecheck +
  lint + unit + build) and size-limit are green; the golden suite for the 25 new templates
  (determinism re-seek + posters, all 4 aspects — 125 tests) passes.

## [1.11.0] — 2026-07-24 · v2 UI redesign — true light mode · emerald · Parkinsans

A full ground-up redesign of the entire app UI (landing + Studio) into a modern-SaaS look. The
template library and render engine are unchanged (all 249 templates render identically).

### Changed
- **True light mode.** Retired the tinted `porcelain`/`mist` surfaces and the ember/orange +
  rainbow-gradient palette for a neutral, un-tinted white/grey system with a single **emerald**
  accent (design tokens rebuilt in `apps/web/src/styles/index.css`; accent text uses emerald-700 for
  ≥4.5:1 on white).
- **Parkinsans** is now the UI/layout typeface across landing + Studio (self-hosted variable font,
  `@fontsource-variable/parkinsans`).
- **In-repo component primitives** (`apps/web/src/ui/`) — `Button`, `Card`, `Badge`, `Container`,
  `SectionHeading`, `Wordmark`/`LeafMark` — shadcn-style, built on Tailwind, no new runtime deps.
- **New landing page** on pure white: a hero with a **live template-showcase** (real animations
  playing in a browser frame), a template marquee, a three-step "how it works", a "why it's free"
  comparison table, a feature grid, a 249-template gallery teaser, an FAQ accordion, and a footer.
- **New brand mark** — an emerald leaf/spark `LeafMark` + Parkinsans wordmark, replacing the ember ✦.
- **Redesigned Studio** — gallery, editor shell (topbar / preview stage / playback bar), inspector +
  field controls, and export modal all restyled to the new emerald/light system.

### Removed
- The three.js / `@react-three/fiber` **3D WebGL hero** and those dependencies — replaced by the
  live template-showcase hero (landing initial + hero chunks both well under budget).

### Notes
- All flows/behaviour preserved. axe-core: zero serious/critical on landing, gallery + editor; the
  landing + Studio smoke suites pass; `pnpm check`, size-limit, and the full golden suite are green.

## [1.10.0] — 2026-07-23 · +50 templates — 10 each for five sections (199 → 249)

Ten new templates apiece for **Lower-thirds, Social, Showcase, Explainers & data, and Events &
Travel**, taking the library to **249**. All deterministic, all 4 aspects, ≥3 palettes (mostly 4),
per-element color fields, decorative toggles, ≥4.5:1 end-frame contrast.

### Added — 50 templates

- **Lower-thirds** (`overlay`, transparent-export-friendly): `ticker-bar` (scrolling news ticker),
  `handle-bar` (social @handle pill), `now-playing` (music overlay + progress + EQ), `caption-pop`
  (karaoke word-by-word), `alert-banner` (drop-down alert), `speaker-card` (speaker intro + avatar),
  `score-bug` (sports score), `logo-bug` (corner channel bug), `timer-badge` (count-up/down badge),
  `topic-chips` (hashtag chips).
- **Social**: `live-badge` (going-live + viewers), `stream-chat` (live chat + superchat),
  `swipe-carousel` (IG carousel), `pinned-comment`, `music-sticker` (spinning disc + marquee + EQ),
  `countdown-sticker`, `slider-sticker` (emoji slider), `new-follower` (toast stack), `tip-jar`
  (super-thanks), `add-yours` (story chain).
- **Showcase**: `laptop-mockup` (lid opens), `tablet-showcase`, `photo-stack-swipe` (swipe cards),
  `grid-zoom` (tile → fullscreen), `spec-sheet`, `hotspot-tour` (numbered hotspots), `feature-tabs`
  (tab switcher), `film-strip` (sprocketed strip), `masonry-reveal`, `orbit-showcase` (orbiting
  features).
- **Explainers & data**: `pie-chart`, `area-chart`, `gauge-meter` (needle + count-up),
  `funnel-chart`, `venn-diagram`, `flowchart` (branching decision), `pyramid-levels`, `radial-bars`
  (concentric rings), `comparison-table`, `growth-arrow` (+% count-up). All count-ups pure in `t`.
- **Events & Travel**: `event-countdown`, `itinerary` (day timeline), `flight-board` (split-flap
  departures), `luggage-tag` (pendulum swing), `weather-forecast`, `hotel-card`, `road-trip` (route
  + travelling car), `rsvp-card`, `event-schedule`, `globe-spin` (spinning globe + pin).

### Changed
- Golden suite now covers **249 templates** (249 determinism re-seek tests + 996 poster frames).

## [1.9.0] — 2026-07-23 · Backgrounds category removed · +45 templates (160 → 199)

Retired the seldom-used **Backgrounds** category and grew every other gallery section by five, for a
net **160 → 199** templates.

### Removed
- **Backgrounds (loop) category** and its six templates (`bokeh-drift`, `confetti-loop`,
  `floating-shapes`, `gradient-flow`, `grid-pulse`, `wave-lines`), plus the `loop` `TemplateCategory`,
  their golden baselines, and the gallery's "Openers & backgrounds" section (now just **Openers**).

### Added — 45 templates (5 per gallery section)
All deterministic, all 4 aspects, ≥3 palettes (mostly 4), per-element color fields, and decorative
toggles — verified for ≥4.5:1 end-frame contrast.
- **Text & titles:** `blur-focus` (camera-snap defocus→sharp), `mask-wipe` (light-edge wipe),
  `stretch-in` (springy vertical unfold), `type-cursor` (typing → caret-morph underline),
  `tape-highlight` (highlighter tape behind a key word).
- **Overlays & lower-thirds:** `corner-tag`, `news-lower-third` (broadcast kicker + LIVE flag),
  `progress-overlay` (chapter/step bar), `side-label` (right-edge bookmark tab), `location-tag`
  (pin-drop callout) — transparent-export-friendly by default.
- **Social:** `reaction-bar` (TikTok action rail + count-ups), `story-progress` (IG story frame),
  `duet-split` (reaction split-screen), `reply-sticker` (comment + slapped reply), `poll-results`
  (animated result bars + winner).
- **Product & ads:** `spec-callouts` (radial leader lines), `swatch-switch` (color cycling),
  `add-to-cart` (button press → flying dot → cart badge), `bundle-stack` (fanned bundle + price),
  `deal-countdown` (t-derived digit roll).
- **Showcase:** `app-screens` (tilted phone row), `photo-fan` (card fan-out), `feature-rotator`
  (spotlight dial), `browser-window` (chrome + URL type + scroll), `photo-develop` (Polaroid develop).
- **Explainers & data:** `donut-chart`, `line-graph`, `process-arrows`, `pros-cons`, `kpi-tiles`
  (all count-ups derived purely from `t`).
- **Brand & quotes:** `quote-mark`, `logo-draw` (monogram stroke-on), `rating-reveal`,
  `brand-lockup`, `signature-sign` (handwriting stroke reveal).
- **Openers:** `film-countdown` (rotating sweep + grain), `iris-open`, `glitch-intro` (seeded
  RGB-split), `zoom-punch` (slam + flash), `blinds-open` (venetian slats).
- **Events & travel:** `ticket-stub` (perforated tear), `boarding-pass` (flip + travelling plane),
  `map-route` (drawn route + marker), `calendar-flip` (page flips to date), `passport-stamp`
  (slam + ink-spread).

### Changed
- Golden suite now covers **199 templates** (199 determinism re-seek tests + 796 poster frames).

## [1.8.2] — 2026-07-21 · Template Library (Studio gallery) overhaul

A full rework of the Studio's template picker for browsing 160 templates.

### Changed
- **Uniform 16:9 previews.** Every card now renders its poster at 16:9, so the grid is even instead
  of ragged (previously each card used the template's default aspect — mixed 9:16 / 1:1 / 16:9).
- **Hover to preview.** Hovering (or keyboard-focusing) a card now plays the template's default
  animation live, looping, via a new `LivePreview` (a short-lived on-hover runner, so at most one
  live WebGL context exists at a time). Respects `prefers-reduced-motion` (static poster only), with
  a "▶ Preview" hint and a small hover-intent delay so scanning the grid doesn't spin up a runner
  per card.
- **Cleaner filtering.** Replaced the stacked grouped sections with a **single sticky toolbar** —
  concept/synonym-aware search (Esc to clear), a horizontal row of **use-case chips with live
  counts** (All 160 · Text 33 · Overlays 7 · Social 28 · …), and a result count — over one uniform
  grid. Empty state offers a one-click "Clear filters".

Studio smoke + axe-core a11y (zero serious/critical) and `pnpm check` all green.

## [1.8.1] — 2026-07-21 · +5 reference-style templates (155 → 160)

Five polished, modern templates modelled on high-quality reference animations (all deterministic,
4 aspects, ≥3 palettes, per-element colors, decorative toggles):

- **`comment-thread`** (social) — a TikTok/IG comment section: stacked comment cards (avatar,
  @username · timestamp, text, heart + like-count, Reply) spring in staggered, with a live
  like-count tick and a bouncing green "NEW" badge.
- **`chat-convo`** (social) — a named DM conversation on a dark backdrop: a pink "Sender" bubble and
  a blue "Replier" bubble (with avatars + tails) pop in, and the last message types out with a caret.
- **`search-type`** (social) — a sleek search bar on a dark glow/scanline background: a query types
  in letter-by-letter with a caret and a nudging mouse cursor.
- **`retro-tv`** (social) — a glowing retro-CRT / vlog frame that powers on, with a staggered row of
  colorful app-icon tiles, a stamped caption pill, and a "Day N" counter.
- **`watermark-drop`** (product) — a product floating (with a soft contact shadow) over a tiled,
  diagonal brand-watermark backdrop that adapts its repeat to the watermark length.

### Changed
- Golden suite now covers **160 templates** (160 determinism re-seek tests + 640 poster frames).

## [1.8.0] — 2026-07-21 · Landing page makeover + new 3D hero

A full visual refresh of the marketing landing page, led by a new hero.

### Changed — Hero
- Replaced the old orange "motion tile" WebGL hero with a **bento layout**: a copy column beside a
  grid of rounded cards. The showpiece card holds a **glossy, iridescent liquid-metal 3D blob** — a
  high-detail icosahedron morphed by GPU simplex-noise displacement (`onBeforeCompile`), finished
  with a clearcoat + iridescence physical material and lit by a **gradient reflection map** in the
  brand anchors. Pure three.js, **no drei, no external HDR/assets** (client-side + CSP + size-budget
  safe; the lazy hero chunk is 192 kB brotli, under its 250 kB limit). Reduced-motion / no-WebGL
  falls back to a soft CSS gradient orb.
- Two supporting bento cards: a "155 templates" stat (lime→sky) and an "every size & format" card
  (MP4/WebM/GIF + aspect chips).

### Changed — rest of the page
- **Navbar** is now a floating rounded-pill bar (frosted on scroll) with a dark primary CTA.
- **How it works** and **Features** cards get gradient number/icon chips, larger radii and a hover
  lift; section headings gain a brand gradient accent — tying the whole page to the hero's gradient
  language.

Landing smoke + axe-core a11y (zero serious/critical), `pnpm check` and both size budgets all green.

## [1.7.2] — 2026-07-21 · +10 social templates (145 → 155)

Ten more **Social** templates (the category grows 14 → 24), all 9:16-first, deterministic, across
all 4 aspects with ≥3 palettes, per-element colors and decorative on/off toggles:

- **`profile-card`** — profile header: avatar (image or placeholder) + name/handle + Follow button +
  a Posts/Followers/Following stat row that counts up.
- **`share-repost`** — a post card + a share icon arcing into a "Reposted" check pill.
- **`story-quiz`** — Instagram story quiz sticker; the correct option highlights with a check.
- **`qa-box`** — "Ask me anything" sticker with a typewriter question + blinking caret.
- **`emoji-float`** — a live-style rising stream of heart/star reactions over a label.
- **`dm-chat`** — a DM conversation: alternating incoming/outgoing bubbles + a typing indicator.
- **`link-in-bio`** — a "Link in bio" pill with a nudging pointer.
- **`verified-pop`** — an account name + a verified checkmark badge that pops in with a ring flash.
- **`giveaway`** — a gift badge + prize line + "how to enter" steps (per-aspect vertical scaling so
  the gift stays in the safe area).
- **`trending-now`** — a "Trending" header + a ranked #1/#2/#3 list, top row emphasized.

### Changed
- Golden suite now covers **155 templates** (155 determinism re-seek tests + 620 poster frames).

## [1.7.1] — 2026-07-21 · Gallery search upgrade + full bug sweep

A smarter gallery search for the 145-template library, and a codebase-wide bug hunt (engine, Studio,
landing, and all templates) with every confirmed defect fixed.

### Changed — Gallery search
- Concept/synonym-aware matching: each template's search haystack now includes its group label and a
  per-category keyword set, so natural queries land ("lower third", "caption", "background",
  "transparent", "intro", "opener" all resolve). Multi-word queries match on every term (AND). Added
  a live result count and Esc-to-clear.

### Fixed — Studio / landing (5)
- **Speed slider ate undo history:** dragging the Motion-tab speed slider fired ~40–55 change events,
  each pushing an undo snapshot and evicting the 50-entry history — real edits became un-undoable.
  Now coalesced into one undo entry per drag (like text edits).
- **Reset blanked the color pickers:** "Reset template" now overlays the palette's colors (like
  opening a template) instead of showing empty/black swatches.
- **Repeated-export blob leak:** each "Export another" now revokes the previous result's object URL
  instead of leaking multi-MB blobs until the modal closed.
- **Stuck transparent toggle:** the error screen's "Try GIF instead" now clears the transparent
  (WebM-only) toggle instead of leaving it on with a non-alpha format.
- **Landing hero WebGL churn:** the hero probed WebGL2 in its render body, minting a throwaway
  context every render; now probed once.

### Fixed — Engine (2)
- **Corrupt GIF on worker failure:** the GIF worker path transfers (detaches) frame buffers; if the
  worker failed *after* the transfer, the inline fallback read empty buffers and emitted a blank GIF.
  It now only falls back when the buffers are intact, else surfaces the real error.
- **Silent opening SFX in preview:** a sound cue at exactly t=0 was skipped on the first play
  (half-open interval) but present in the export; the first pass now fires it, matching the export.

### Fixed — Templates (4)
- **`intro-bars`** revealed its title for ~0.2s *before* the bars covered the frame (title stayed at
  full opacity, hidden only by z-order); it's now hidden until the stack fully covers, so it pops out
  as the bars clear — as intended.
- **Contrast:** white text on the brand orange/pink/blue accent fell below the 4.5:1 QA floor on
  `price-slash`, `discount-burst`, `milestone-counter`, `new-drop` and `unbox-reveal` (incl. their
  default palettes). Darkened those accent shades to clear 5.4–6.0:1 (matching `shipping-badge`).
- **`swipe-up`** poster moved off a mid-nudge frame to the settled resting stack.
- **`feature-tags`** required ≥2 tags before overriding the default, so a single tag can't leave a
  lopsided 2-slot layout.

_No crashes, determinism violations, or toggle-off failures were found — the toggle guarding added in
1.7.0 verified correct across all 145 templates._

## [1.7.0] — 2026-07-21 · +50 templates (95 → 145), new categories & editable decorations

The biggest content drop yet: **50 new templates** across the whole library plus **three new
categories**, and every existing template's decorative accents (the little orange bar, dots, badges…)
are now **switchable on/off**.

### Added — 50 new templates (library 95 → 145)
- **Overlays & lower-thirds (new category `overlay`, 7):** `lower-third`, `name-tag`, `subtitle-bar`,
  `cta-bar`, `topic-bug`, `stat-callout`, `speech-pop` — built for the fresh transparent-WebM export
  (v1.6): drop them straight onto footage. Their plates use palette-only colors so they survive the
  alpha bake even as the background blanks.
- **Openers (new category `intro`, 6):** `channel-intro`, `countdown-intro`, `logo-lines`,
  `neon-sign`, `clap-intro`, `intro-bars`.
- **Background loops (new category `loop`, 6):** `gradient-flow`, `floating-shapes`, `bokeh-drift`,
  `wave-lines`, `grid-pulse`, `confetti-loop` — seamless (frame at t=duration == t=0), driven by
  periodic `update(t)` math seeded once so they stay deterministic.
- **Text & titles (7):** `highlight-sweep`, `outline-fill`, `stamp-text`, `rotating-headline`,
  `gradient-text`, `split-flap`, `underline-grow`.
- **Social (6):** `story-poll`, `hashtag-pop`, `followers-count`, `swipe-up`, `mention-tag`,
  `sticker-pop`.
- **Product & promo (6):** `new-drop`, `feature-tags`, `discount-burst`, `price-slash`,
  `limited-stock`, `shipping-badge`.
- **Data & stats (5):** `progress-ring`, `bar-race`, `percent-fill`, `rating-bars`,
  `milestone-counter`.
- **Testimonial / brand / event (7):** `quote-cards`, `testimonial-slide`, `logo-grid-reveal`,
  `thank-you`, `logo-reveal-mask`, `end-screen`, `event-lineup`.
- Every new template: deterministic, all 4 aspects, ≥3 palettes, per-element color pickers, image→
  placeholder degradation where relevant, German-length-safe, and decorative accents already
  toggleable.

### Added — editable decorations on existing templates
- Purely decorative elements can now be **switched off** per template — the requested "deactivate the
  small orange bar below the text," plus accent dots, badges/stamps, frames, glows, sparkles,
  dividers and connector lines. ~57 of the 95 existing templates gained one or more `toggle` fields
  (e.g. `kinetic-headline` → **Accent bar** + **Accent dot**). All default **on**, so existing looks
  and golden frames are unchanged; flip one off for a cleaner cut.

### Changed
- Gallery gains two sections — **Overlays & lower-thirds** and **Openers & backgrounds** — mapping
  the new `overlay` / `intro` / `loop` categories.
- Golden suite now covers **145 templates** (145 determinism re-seek tests + 580 poster frames).

## [1.6.0] — 2026-07-21 · Transparent (alpha) WebM export

Export any animation with a **transparent background** so it can be dropped straight onto footage in
a video editor — no green-screen keying.

### Added — Transparent background (ADR-013)
- **"Transparent background" toggle** in the Export dialog. When on, the export is a **WebM with a
  real alpha channel** (VP9, alpha kept as packet side data); the Studio blanks the template's
  full-frame background so only the animation's foreground carries through. The result preview sits
  on a checkerboard so the transparency is visible.
- **Fully client-side**, no new deps: the export runner clears the canvas with alpha 0
  (`RunnerConfig.transparent`), a shared `TRANSPARENT_BG` sentinel blanks the background rect across
  the library (91/95 templates have a solid background that goes fully transparent; the other 4 are
  full-bleed photo/panel designs with nothing to knock out), and Mediabunny marks the WebM track
  transparent from the first alpha packet.
- **Honest format guidance in the UI:** transparency needs an alpha-capable codec, so the toggle
  snaps the format to WebM (MP4/H.264 and GIF can't carry smooth alpha). The note also flags that
  **Premiere Pro may import WebM alpha as opaque** — it works in After Effects, DaVinci Resolve,
  CapCut, OBS and the web.

### Changed
- `Capabilities` and the export/harness paths thread a `transparent` flag; export-smoke now asserts
  a transparent WebM is a real alpha track (`canBeTransparent()`), an opaque one is not, and a
  transparent render blanks the background (corner alpha 0). Golden frames unaffected (transparency
  is export-only).

## [1.5.0] — 2026-07-21 · Motion-matched sound + editable speed/length

Two owner-requested capabilities across all 95 templates: **fitting sound effects you can toggle**,
and **editable animation speed/length that the export honours**.

### Added — Sound (ADR-012, supersedes ADR-006 "no audio in v1")
- **Procedural, motion-matched SFX for every template.** Sound is **synthesized with the Web Audio
  API** — no sample files are bundled, licensed or fetched (CSP-safe; the client-side + free rules
  hold). Cues are **auto-derived from each template's timeline beats** (`JimaTimeline.beats()` →
  `cuesFromBeats`), so the audio fits the motion — a springy scale-in → a pop, a slide → a swoosh,
  the settle → a ding — with zero per-template authoring.
- **On/off toggle + three sound packs** (Pop, Soft, Retro) in the Motion tab; a persisted global
  preference (defaults on), not a per-template/undoable value.
- **Preview** plays cues live via an `AudioContext` unlocked on the first play/toggle gesture.
- **Export** bakes the same cues offline (`OfflineAudioContext` → `AudioBuffer`) and muxes them with
  Mediabunny — **AAC** for MP4, **Opus** for WebM. GIF stays silent; a browser without an
  AudioEncoder exports silent video (capability probed, never assumed).

### Added — Editable speed / length
- The **Speed & length** slider (0.25×–3×) now shows the resulting clip length and, crucially,
  **changes the exported video** — export remaps frame times by speed (fewer/longer or more/shorter
  frames), so a 2× clip really is half the length. Previously speed only affected the live preview.

### Changed
- `Capabilities` gains `mp4AudioCodec` / `webmAudioCodec` (probed AAC/Opus support).
- Export-smoke suite now asserts a real audio track is muxed when Sound is on (and none when off);
  determinism unaffected — sound is never part of the visual render, so golden frames are identical.

## [1.4.0] — 2026-07-21 · Showcase & product-presentation pack (75 → 95)

Added **20 more templates** — 10 in **Showcase**, 10 for **Product presentation** — all
deterministic (pixel-exact re-seek), all 4 aspects, 4 palettes, image→placeholder degradation,
per-element color fields.

### Added — Showcase
- **Photo Grid** (image mosaic), **Polaroid Stack**, **Before/After Slider** (divider reveal),
  **Carousel Cover** (IG carousel), **Team Grid**, **Testimonial Wall** (star reviews),
  **Feature Spotlight**, **Image Reveal** (scrim + title), **Split Showcase**, **Mockup Tilt**
  (perspective device float)

### Added — Product presentation
- **Product Carousel**, **Product 360** (turntable), **Color Variants** (swatch switch),
  **Product Lineup** (family shot), **Bundle Offer** (computed savings), **Product Detail**
  (magnifier callout), **Unbox Reveal** (box opens), **Size Compare** (dimension guides),
  **Product Review** (stars + quote), **Shop Grid** (collection)

### Changed
- Golden suite now covers **95 templates** (95 determinism re-seek tests + 380 poster frames)

## [1.3.0] — 2026-07-21 · Explainer/showcase/ad pack + editor upgrades (55 → 75)

Added **20 templates for real use-cases beyond text** — explainers, showcases, product
presentations and ads — plus three editor upgrades: editable fonts, a regrouped gallery, and
clearer per-element colors.

### Added — templates (all deterministic, 4 aspects, 4 palettes, images degrade to placeholders)
- **Explainers:** Step Flow, Timeline, Before / After, Comparison (vs table), Feature Callouts
- **Showcases:** Product Showcase, Gallery Strip, Feature Grid, Device Mockup, Review Stars
- **Product & ads:** Product Hero, Pricing Card, New Arrival, Spec Sheet, Spotlight Reveal
- **Data / brand / ads:** Stat Trio, Logo Wall, Countdown (pure-`f(t)` digits), End Card, Sale Banner
- New `showcase` category; the golden suite now covers **75 templates** (75 determinism + 300 posters)

### Added — editor
- **Editable headline fonts** — a "Font" picker in the Style tab swaps the display font across the
  whole template, from 7 curated OFL families (Space Grotesk, Archivo, Sora, Poppins, Outfit,
  Fraunces, JetBrains Mono). New engine `createFontRegistry({headline})` + `FONT_CHOICES`; app and
  render harness load all faces (weights 400–700) so a swap never falls back. Threaded through
  preview, export, persistence, and undo/redo.
- **Gallery regrouped** into browsable use-case sections (Text & titles · Social · Product & ads ·
  Showcase · Explainers & data · Brand & quotes · Events & travel) with a group filter + search;
  the landing teaser uses the same groups.
- **Colors** — a clearer Style-tab "Colors" section for picking background/text/object colors
  individually (palettes are presets); dropped the misleading "(optional)" tag on color fields.

### Fixed
- Three Stats: shrink big numbers to fit their column (the count-up's final value could overflow).
- Logo Wall: use a loaded display weight so chip wordmarks measure correctly and don't clip.

## [1.2.0] — 2026-07-21 · Smooth-text pack (35 → 55)

Added **20 clean, motion-animated text templates** — a focused set of smooth kinetic typography.
Every one is deterministic (pixel-exact re-seek proven in the golden suite), handles all four
aspects, ships 4 palettes, and settles on a clean end-hold.

### Added — engine-side building block
- `layoutChars()` in `shared/words.ts` — kerning-accurate per-glyph layout (word-wrapped), so
  letters can animate individually (used by the per-letter reveals, drops, wave, and decode)

### Added — text templates
- **Word/line reveals:** Fade Cascade, Line Rise (mask reveal), Side Slide, Stacked Build, Focus In,
  Spacing Expand, Push In (dolly)
- **Per-letter:** Letter Reveal, Drop In, Wave (seamless loop), Text Scramble (decode)
- **Word motion:** Flip In, Scale In, Bounce In, Message Rotator (looping crossfade), Emphasis Line
- **Sweeps/reveals (masking):** Shine Sweep, Split Reveal, Curtain Wipe, Box Wipe

### Changed
- Gallery reordered to interleave the text templates with the rest (no single-category block)
- Golden suite now covers **55 templates** (55 determinism re-seek tests + 220 poster frames)
- README / CLAUDE template counts refreshed

## [1.1.0] — 2026-07-21 · Template expansion (12 → 35)

Added **23 new templates**, nearly tripling the library, plus the shared building blocks behind
them. Every new template is deterministic (pixel-exact re-seek proven in the golden suite), handles
all four aspects, ships 4 palettes, and passes the German max-length bar.

### Added — shared engine-side building blocks
- `shared/icons.ts` — a 16-glyph vector icon library drawn from Pixi primitives (play, heart, thumb,
  bell, star, bolt, check, plus, cart, comment, share, bookmark, pin, plane, folder, user);
  deterministic and resolution-independent
- `shared/ui.ts` — `dashedPath`/`arcPoints` (coupon perforations, dashed flight routes), `makePill`,
  `avatar`, `pointerCursor`
- New template categories: **social** and **travel** (with gallery labels)

### Added — templates
- **Social engagement:** Subscribe Bell (YouTube subscribe → bell ring → count-up), Like Spark,
  Follow Pop (TikTok), Double-Tap Heart, Comment Drop
- **Social UI wireframes:** YouTube Frame, Reel Frame (IG/TikTok), Notification Pop
- **Kinetic text:** Kinetic Type, Keynote Reveal (Apple-keynote style), Word Swap (looping),
  Marker Highlight
- **Promo:** Special Offer (starburst seal + price slash), Flash Sale, Coupon Reveal
- **Brand & icon:** Icon Pop, Icon Grid, Badge Stamp
- **Tech:** Folder Open, Card Cascade
- **Travel:** Travel Postcard (dashed flight arc + moving plane), Location Pin
- **Stat:** Stat Bars (animated bar chart with count-ups)

### Changed
- Gallery reordered to lead with a diverse, high-impact mix across categories
- Golden suite now covers **35 templates** (35 determinism re-seek tests + 140 poster frames);
  landing/README/CLAUDE template counts refreshed

## [1.0.0] — 2026-07-21 · v1.0 — private release

First complete release: the full Jima Studio, all 12 templates, client-side MP4/WebM/GIF export,
and the animated WebGL landing page — free, no account, rendered entirely in the browser. Phases
0–6 below are the road to this tag.

### Added — Phase 0 · Foundation (2026-07-21)
- pnpm workspace: `apps/web` (Vite 8 + React 19 + React Router 7 + Tailwind 4, TS strict),
  `packages/engine`, `packages/templates`, `tests`
- Light-mode design tokens (DESIGN_ARCHITECTURE.md §2–4) wired as the Tailwind 4 theme;
  `color-scheme: light`, reduced-motion global handling
- Determinism ESLint guard (bans `Date.now`/`Math.random`/`performance.now`/argless `new Date()`
  in engine + templates) and the GSAP import ban (ADR-001) — both verified firing
- GitHub Actions CI (typecheck · lint · unit · build · size-limit · license policy · golden-frame job)
- `vercel.json` (SPA rewrites, immutable asset caching); size-limit budget (app shell ≤ 220 kB)
- Playwright harness pipeline verified in this environment: **headless WebGL works** (SwiftShader),
  using the pre-installed Chromium — de-risks Phase 1 golden frames
- Placeholder landing + Studio route shells (lazy-split), headless render-harness entry

### Added — Phase 1 · Motion engine core + T01 (2026-07-21)
- `@jima/engine` timeline: exact-endpoint easing families, `spring`/`steps`, mulberry32 seeded
  RNG, and the stateless `JimaTimeline` evaluator (per-property grouped resolution, sequenced
  tweens, discrete sets, stagger) — `evaluate(t)` is a pure function of t
- Layout: aspect sizes, platform safe zones, shrink-to-fit + word-wrap text helpers
- Text: `FontRegistry` with `document.fonts.load` gating (self-hosted OFL Space Grotesk + Inter
  via Fontsource); crisp role-based `makeText`
- Runtime: `SceneRenderer` (Pixi v8, WebGL forced, context-loss recovery), `TemplateRunner`
  (build → seekable `renderAt(t)`), `PreviewPlayer` (rAF-timestamp clock, play/pause/seek/loop/speed)
- Template SDK types + registry; **T01 Kinetic Headline** (pop/rise/slam entrances, 4 aspects,
  4 palettes)
- Render harness (`/harness.html`) driven by URL params, for golden + export tests
- Tests: 36 Vitest unit + 11 Playwright — determinism proven by pixel-exact re-seek and
  fresh-instance equality; golden posters stable across two runs

### Added — Phase 2 · Client-side export pipeline (2026-07-21)
- Capability detection using Mediabunny's real encodability probe (a genuine
  `VideoEncoder.configure` under the hood — the Firefox "claims H.264 then fails" case is
  reported honestly as `mp4:"none"`)
- Deterministic frame-loop exporter: WebCodecs → Mediabunny for **MP4 (H.264)** and **WebM (VP9)**,
  awaiting `source.add` so encoder/writer backpressure is respected (no OOM on long exports)
- **GIF** via gifenc with one global palette sampled across the clip, encoded in a Web Worker
  (main-thread fallback); pure and deterministic
- Orchestrator builds a dedicated runner at the exact output resolution (never reads the
  DPR-scaled preview canvas), reports per-frame progress, cancels via `AbortSignal`, forces even
  dimensions, and names files `jima-<id>-<w>x<h>.<ext>`
- Tier B/C fallback scaffolding (ffmpeg.wasm / MediaRecorder contracts) with honest messaging hooks
- Tests: GIF-encoder unit test (Node) + export-smoke suite that decodes outputs back with
  Mediabunny — WebM verified at exactly 48/48 packets, GIF valid GIF89a under the 8 MB budget,
  cancellation throws `ExportCancelledError`, MP4 auto-skips where no H.264 encoder exists
- Build: the test-only render harness is excluded from the production bundle (app shell 78.6 kB brotli)

### Added — Phase 3 · Studio UI (2026-07-21)
- Gallery: engine-rendered poster cards, search, category filters, resume banner
- Editor: three-zone layout (template rail · live-preview stage with playback scrubber ·
  Content/Style/Motion inspector), aspect switcher, undo/redo with coalesced edits
- All eight field controls (text, textarea, textlist, image dropzone, color, select, slider, toggle)
- Palette-as-preset colour model — selecting a palette fills the color fields (single source of truth)
- Export modal (configure → rendering → done/error) on the Phase 2 pipeline, with capability-aware
  format cards and honest disabled-MP4 messaging; progress + cancel; auto-download
- Autosave to localStorage (+ IndexedDB blob plumbing for images), reload-restore, `?t=` deep-link
- Keyboard map (space/←→/Home/⌘Z/⌘E), reduced-motion handling, mobile stacked layout,
  WebGL2 capability floor
- Live editing rebuilds the scene in place (no WebGL context churn per keystroke)
- `eslint-plugin-react-hooks` added; 4 Playwright studio-integration specs (gallery→edit→export→reload)

### Added — Phase 4 · Template library, batch 1 (2026-07-21)
- **T03 Glow Promo** — living gradient-blob background (resolution-independent radial-glow
  sprites), letter-spacing kicker, slam headline, spring CTA pill; loopable (seamless tail fade)
- **T07 Big Number** — count-up (`update(t)`) with deterministic thousands grouping, landing beat,
  and seeded confetti-burst physics computed as a pure function of t
- **T08 Quote Spotlight** — multi-line word-by-word reveal in Fraunces serif, quote-mark watermark,
  optional circle-cropped avatar from a user image
- Engine: `BuiltTemplate.update(t)` per-frame hook (count-ups/particles as pure f(t)); image-texture
  loading into `TemplateContext.images`; `serif` font role (self-hosted Fraunces); shared glow-texture
  + number-format helpers; poster rendering serialized (one WebGL context at a time)
- Data-driven golden suite over the whole registry (determinism re-seek + poster frames), stable
  across two runs; 4 of 12 templates now shipped (T01, T03, T07, T08)

### Added — Phase 4 · Template library, batch 2 (2026-07-21) → library complete (12/12)
- **T02 Slide & Reveal** (clip-mask line reveals, accent bar), **T04 Product Pop** (card + spring
  product drop + price chip; drifting pattern; image or placeholder), **T05 Typewriter** (mono
  type-on with blinking caret + terminal chrome; prompt lines in accent), **T06 Ken Burns Story**
  (cover-fit photo with a slow zoom/pan, gradient scrim, safe-zone caption; gradient placeholder),
  **T09 Logo Sting** (spring logo pop + shape/ring burst), **T10 Save the Date** (clockwise border
  draw, masked event name, rolling date groups), **T11 Tips Stack** (built-in checklist with
  check/number/arrow markers; duration scales with items), **T12 Split Duo** (vertical/diagonal
  panels wipe to the seam, punch/spin VS badge; images or color)
- Engine: `mono` font role (self-hosted JetBrains Mono); shared vertical-scrim texture helper
- Golden suite now covers all 12 templates × 4 aspects (48 poster frames) + 12 determinism
  re-seek tests, stable across two runs

### Added — Phase 5 · Landing page (2026-07-21)
- Sticky navbar; **Three.js/R3F WebGL hero** — custom fbm-noise pastel gradient shader + floating
  glossy pebbles + pointer parallax (native fullscreen quad + float, drei dropped); inline **live
  T01 rendered by the engine**; reduced-motion / no-WebGL static-gradient fallback
- Marquee template rail, how-it-works, why-it's-free comparison table, feature grid, filterable
  gallery teaser (deep-links into the Studio), FAQ accordion, footer with clear-data
- Engine (Pixi) and Three.js are both lazy-loaded after first paint — landing initial 80 kB brotli;
  hero chunk 192 kB brotli (lazy). Every page animation is engine-rendered or CSS (no video/Lottie)
- 3 landing smoke tests (CTA → Studio, gallery deep-link, FAQ accordion)

### Changed — Hero rework (2026-07-21)
- Rebuilt the landing hero into a **3D "motion tile"** scene (Three.js/R3F): an ember rounded-rect
  card with a play glyph swaying gently above an isometric grid platform, a soft contact shadow, and
  a frosted-glass pill nav + FORMATS strip — replacing the earlier gradient-shader-and-pebbles hero,
  in the Jima ember palette. Static-image fallback for reduced-motion / no-WebGL is unchanged in spirit
- `HeroBackground` is still fully lazy (Three.js never blocks first paint); the old `LiveTemplate`
  inline render was removed with the shader hero

### Added — Phase 6 · Hardening & v1.0 release (2026-07-21)
- **Accessibility sweep:** automated axe-core (WCAG 2.0/2.1 A + AA) pass over landing, gallery, and
  editor — zero serious/critical violations. Fixes: the live-preview `<canvas>` now carries a
  descriptive `aria-label`; muted body copy moved off low-opacity ink onto the `slate` token so every
  text/background pair clears 4.5:1
- **Engine-rendered OG image** (`apps/web/public/og.png`, 1200×675) so shared links preview well —
  a real T01 render, regenerable via `pnpm exec playwright test og-image`; `og:image` + Twitter
  summary-card meta wired into `index.html`
- **German max-length + end-frame contrast audit** across the templates — long DE strings
  (`Benachrichtigungen`, `Veröffentlichungen`, `SOMMERSCHLUSSVERKAUF`, `Motion-Design-Studio`) shrink
  and wrap inside the safe zone without overflow on T01/T03/T08 spot-checks
- README rewritten for the shipped product with a short "how to use / how to share" note

### Fixed — Phase 6
- The preview canvas's accessible name is now a generic "Live animation preview" — embedding the
  template name (e.g. "Kinetic Headline") collided with form-field labels like "Headline" under
  accessible-name lookups (tripped Studio integration tests)
- Playwright test timeout raised to 60s + one CI retry: Studio end-to-end flows are CPU-bound under
  headless SwiftShader WebGL and can overrun a 30s budget when workers overlap

### Known limitations at v1.0
- Automated cross-browser QA in this environment is Chromium-only (headless SwiftShader); Safari,
  Firefox and real mobile devices are for the owner to spot-check. MP4/H.264 export depends on a
  platform encoder — where none exists the Studio honestly offers WebM + GIF instead

## [0.1.1] — 2026-07-21 · Owner decisions folded in

### Changed
- Re-scoped as a **personal project** (owner + friends/family) — SEO, marketing, launch assets
  and trademark checks removed from all docs; new **ADR-011** records the decision
- Stack: Astro + React island → **Vite 8 + React 19 SPA** (ADR-003 amended — SEO descoped)
- Hosting: Cloudflare Pages → **Vercel** via Git integration (ADR-008 amended)
- Confirmed by owner: Ember brand palette, English-only UI, no custom domain for now; work mode =
  Phases 0–2 autonomous (on explicit go-ahead), then pause for visual review

## [0.1.0] — 2026-07-21 · Planning drop

### Added
- `README.md` — project overview and doc map
- `CLAUDE.md` — working agreement, guardrails, and conventions for AI-assisted development
- `PRODUCT_BRIEF.md` — vision, audience, positioning, scope and non-goals for v1
- `COMPETITOR_RESEARCH.md` — deep research: Jitter, Ccleaf, and the wider template-motion market
- `TECHNICAL_ARCHITECTURE.md` — stack decisions, motion engine, template SDK, client-side export pipeline
- `DESIGN_ARCHITECTURE.md` — brand system, light-mode design tokens, landing page and Studio UX specs
- `TEMPLATE_LIBRARY.md` — specification of the 12 launch templates (10 × P0, 2 × P1)
- `ROADMAP.md` — phased build plan with milestones, acceptance criteria, and risk register
- `CHANGELOG.md` — this file

### Decided
- Product is 100 % free: no account, no login, no payment, no watermark
- All rendering and export happens client-side in the browser; user content never leaves the device
- Website is light/white-mode only
- v1 explicitly excludes collaboration, accounts, timelines/keyframe editing, and server rendering

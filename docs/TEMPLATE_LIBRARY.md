# Jima Motion — Template Library Specification (v1)

This document specifies the **12 launch templates** that ship with Jima Studio v1 (requirement: ≥ 10).
It is the implementation contract for Phase 4 of `ROADMAP.md`. The runtime/schema that executes these
templates is specified in `TECHNICAL_ARCHITECTURE.md` (§ Template SDK).

Every template must satisfy the **template contract** (below) and pass the **golden-frame test policy**
before it counts as shipped.

---

## 1. Design principles for templates

1. **Look expensive, edit trivially.** Every template must produce a result that looks professionally
   motion-designed with *zero* settings touched — defaults are the product.
2. **Form-based editing, not timelines.** Users edit *fields* (text, image, colors, speed). They never
   see keyframes. All timing intelligence lives inside the template definition.
3. **Deterministic.** A template render is a pure function of `(time, values, aspect, seed)`. Same
   inputs → identical pixels. No `Date.now()`, no unseeded randomness (see Technical Architecture).
4. **Aspect-adaptive.** Each template implements layout for all four aspects: `1:1` (1080×1080),
   `4:5` (1080×1350), `9:16` (1080×1920), `16:9` (1920×1080). Layout may differ per aspect
   (not naive scaling): safe margins, stack direction, and font scale adapt.
5. **Loop-aware.** Templates declare `loopable: true|false`. Loopable templates end on a frame that
   cuts cleanly back to frame 0 (for GIFs and auto-looping social players). Non-loopable templates
   end on a designed hold frame.
6. **Fast.** Preview must hold 60 fps on a 2020 mid-range laptop at preview resolution. Max ~120
   display objects alive per template; particles use a single batched container.
7. **Text-first.** Text must remain crisp at 1080p export (see font/rasterization rules in
   Technical Architecture). Long-text behavior is defined per field (shrink-to-fit or wrap), never
   overflow.

---

## 2. Shared vocabulary

### 2.1 Field types (the only editing primitives in v1)

| Type       | UI control                          | Notes |
|------------|-------------------------------------|-------|
| `text`     | Single-line input                   | `maxLength`, `shrinkToFit` behavior |
| `textarea` | Multi-line input                    | `maxLines`, wrap rules |
| `textlist` | Repeatable text rows                | `minItems`/`maxItems`, add/remove/reorder |
| `image`    | Upload dropzone (PNG/JPG/WebP/SVG)  | Stays in-browser; object-fit mode; optional = slot hidden gracefully |
| `color`    | Color swatch + picker               | Always also settable via palette presets |
| `select`   | Segmented control or dropdown       | Enumerated variants |
| `slider`   | Range slider                        | `min`/`max`/`step`, e.g. speed, intensity |
| `toggle`   | Switch                              | Boolean features |

### 2.2 Settings every template gets for free (injected by the Studio, not declared per template)

- **Aspect ratio**: `1:1`, `4:5`, `9:16`, `16:9`
- **Speed**: `0.5×–2.0×` multiplier over the template's base timeline (slider)
- **Palette**: template-declared palette presets (≥ 4 each) + full manual color override
- **Font pairing**: choose from the bundled font set where the template declares font slots
- **Background color**: unless the template owns a generated background (noted per template)

### 2.3 Bundled font roles (final list in `DESIGN_ARCHITECTURE.md` § Fonts)

Templates reference *roles*, not families: `display` (bold geometric), `body` (neutral sans),
`serif` (editorial), `mono` (code/terminal), `script` (casual accent). All bundled fonts are
OFL-licensed and self-hosted.

### 2.4 Storyboard notation

Timings below assume **speed 1.0** and the template's default duration. `t=` marks are seconds.
Easing names refer to the shared easing set (`out-expo`, `out-back`, `in-out-quint`, `spring(s)`
etc.) defined in the engine.

---

## 3. The 12 launch templates

Priority `P0` = must ship for v1 launch; `P1` = ship in v1 if on schedule, else first post-launch
drop (v1 must still total ≥ 10 — P0 count is 10).

---

### T01 · Kinetic Headline  —  `kinetic-headline`  ·  P0
- **Category:** Announcement · **Duration:** 4.0 s (range 3–6 s) · **Loopable:** no (hold ending)
- **Pitch:** Big word-by-word kinetic typography. The default "make text move" template and the
  hero demo on the landing page.
- **Fields:**
  - `headline` (text, ≤ 60 chars, shrink-to-fit) — default "Say it with motion."
  - `subline` (text, ≤ 80 chars, optional) — default "Made in Jima Studio"
  - `accent` (color) + `background` (color) + `textColor` (color)
  - `style` (select: `pop` | `rise` | `slam`) — entrance flavor
- **Storyboard (pop, t in s):**
  - 0.00–0.35 background settles (2 % scale ease-out); accent dot drops in top-left with `out-back`
  - 0.35–2.00 words enter one-by-one, 0.18 s stagger: scale 0.6→1.0 `out-back(1.6)` + 8° rotation
    settle + opacity 0→1
  - 2.00–2.40 accent underline sweeps beneath the last word, `out-expo`
  - 2.40–3.00 subline fades up 12 px
  - 3.00–4.00 hold; underline breathes ±2 % — designed end-card frame
- **Layout per aspect:** left-aligned block at 55 % width (16:9), centered at 80 % width (1:1, 4:5),
  centered with larger type and vertical centering (9:16).
- **Palettes:** Ink-on-white / White-on-orange / Ink-on-lime / Violet-on-cream.
- **Poster frame:** t = 3.2 s.

---

### T02 · Slide & Reveal  —  `slide-reveal`  ·  P0
- **Category:** Statement / editorial · **Duration:** 4.5 s · **Loopable:** no
- **Pitch:** Elegant line-by-line mask reveal with a sliding accent bar. The "serious brand" template.
- **Fields:**
  - `lines` (textlist, 1–4 items, ≤ 40 chars each) — default ["Design is", "how it", "moves."]
  - `attribution` (text, optional)
  - `accent`, `background`, `textColor` (colors)
  - `alignment` (select: `left` | `center`)
  - `fontRole` (select: `display` | `serif`)
- **Storyboard:**
  - 0.00–0.40 accent bar wipes in horizontally (`out-expo`), then thins to a 4 px rule
  - 0.40–2.20 each line reveals from under a clip mask, 0.35 s stagger, `out-quint`, with a subtle
    2 px y-settle; the rule slides down to sit under the active line
  - 2.20–2.80 attribution types on (per-character fade, 18 ms/char)
  - 2.80–4.50 hold; bar pulses once at 3.5 s
- **Palettes:** Editorial ink / Cream+burgundy / Paper+cobalt / Mist+forest.
- **Poster frame:** t = 2.6 s.

---

### T03 · Glow Promo  —  `glow-promo`  ·  P0
- **Category:** Sale / promo · **Duration:** 5.0 s · **Loopable:** yes
- **Pitch:** Vivid animated gradient-blob background with a punchy offer stack and CTA pill.
  The "SALE –30 %" workhorse. Template owns its background (generated gradient).
- **Fields:**
  - `kicker` (text, ≤ 24 chars) — default "SUMMER SALE"
  - `headline` (text, ≤ 32 chars, shrink-to-fit) — default "30% OFF"
  - `detail` (text, ≤ 60 chars) — default "Everything. This week only."
  - `cta` (text, ≤ 20 chars) — default "Shop now"
  - `gradient` (select: 4 curated gradient sets) + `blobEnergy` (slider 0–1)
- **Storyboard:**
  - Background: 3 soft radial blobs drift on seeded noise paths, full-loop period = duration
  - 0.00–0.50 kicker letter-spaces in (tracking 0.6 em→0.08 em)
  - 0.50–1.10 headline slams in, scale 1.35→1.0 `out-back`, micro camera shake (2 px, 120 ms)
  - 1.10–1.60 detail fades up
  - 1.60–2.10 CTA pill springs in, then idles with ±1.5 % scale breath every 1.2 s
  - 4.60–5.00 all text micro-fades 8 % and back — loop seam is invisible
- **Palettes (gradient sets):** Tangerine dusk / Berry pop / Lagoon / Sunset lime.
- **Poster frame:** t = 2.2 s.

---

### T04 · Product Pop  —  `product-pop`  ·  P0
- **Category:** Product showcase · **Duration:** 5.0 s · **Loopable:** no
- **Pitch:** A product image drops onto a card with a spring, price tag punches in. E-commerce staple.
- **Fields:**
  - `productImage` (image, object-fit contain, transparent PNG encouraged)
  - `name` (text, ≤ 40 chars) — default "Aura Headphones"
  - `price` (text, ≤ 12 chars) — default "€129"
  - `cta` (text, ≤ 20 chars, optional) — default "In stock →"
  - `cardColor`, `background`, `accent` (colors)
  - `pattern` (select: `dots` | `grid` | `none`) — drifting background texture
- **Storyboard:**
  - 0.00–0.60 background pattern fades in, drifting at 6 px/s diagonally (loops seamlessly)
  - 0.30–1.00 card rises 40 px with soft shadow growing (`out-quint`)
  - 0.80–1.50 product image drops from −12 % y with `spring(0.55)`, one overshoot bounce;
    shadow ellipse squashes in sync
  - 1.50–2.10 name slides in; 2.10–2.60 price tag rotates in −8°→0° `out-back` on an accent chip
  - 2.60–3.10 CTA underline draws
  - 3.10–5.00 hold; product idles with 1° tilt sway, 2.4 s period
- **Empty-image behavior:** slot renders a soft placeholder blob so the template still previews well.
- **Palettes:** Studio white / Butter / Sage / Charcoal-pop (dark card on light bg — page stays light).
- **Poster frame:** t = 3.0 s.

---

### T05 · Typewriter  —  `typewriter`  ·  P0
- **Category:** Tech / minimal announcement · **Duration:** 5.0 s (auto-extends with text length) · **Loopable:** no
- **Pitch:** Monospace type-on with blinking caret, optional terminal window chrome and keyword
  highlight. Loved by dev-tool and startup accounts.
- **Fields:**
  - `lines` (textlist, 1–3 items, ≤ 48 chars) — default ["npm install future", "> shipping v2.0 today"]
  - `highlight` (text, ≤ 24 chars, optional) — substring rendered in accent with soft glow
  - `chrome` (toggle: terminal window frame with traffic lights) — default on
  - `background`, `textColor`, `accent` (colors)
  - `typeSpeed` (slider 20–80 ms/char)
- **Storyboard:**
  - 0.00–0.40 window chrome scales in 0.96→1.0, shadow settles
  - 0.40→ typing: per-character reveal at `typeSpeed`, caret blinks at 530 ms; line breaks pause 260 ms
  - highlight substring gets accent color + 6 px glow as it is typed
  - last 1.2 s: caret keeps blinking on hold frame
  - Duration = intro + Σ(chars × typeSpeed) + hold, clamped 3–10 s; Studio shows computed duration live
- **Palettes:** Paper terminal (light) / Solarized-light / Mint console / Blueprint.
- **Poster frame:** 65 % through typing.

---

### T06 · Ken Burns Story  —  `ken-burns`  ·  P0
- **Category:** Photo story · **Duration:** 6.0 s · **Loopable:** no
- **Pitch:** A photo comes alive with a slow cinematic zoom-pan, gradient scrim and a lower-third
  caption. The Instagram-story bread-and-butter.
- **Fields:**
  - `photo` (image, object-fit cover — required for good results; placeholder landscape otherwise)
  - `caption` (text, ≤ 70 chars) — default "Golden hour in Lisbon"
  - `handle` (text, ≤ 24 chars, optional) — default "@jimamotion"
  - `move` (select: `zoom-in` | `zoom-out` | `pan-left` | `pan-right`)
  - `scrim` (slider 0–1) + `accent` (color, caption bar)
- **Storyboard:**
  - 0.00–6.00 photo transforms 1.00→1.12 scale (or pan equivalent), linear with eased ends
  - 0.00–0.60 scrim gradient fades to set opacity (bottom 40 %)
  - 0.60–1.20 accent bar wipes in; caption slides up behind it (`out-quint`)
  - 1.40–1.80 handle fades in above caption at 70 % opacity
  - 5.40–6.00 caption block nudges 6 px down and fades 10 % — designed out-frame
- **Aspect note:** 9:16 is the hero aspect here; caption sits above the platform-UI safe zone
  (bottom 400 px at 1080×1920 kept clear — Jima safe-zone standard, `COMPETITOR_RESEARCH.md` § 4.4).
- **Palettes:** affect scrim tint + accent only (photo untouched): Neutral / Warm / Cool / Duotone-plum.
- **Poster frame:** t = 2.0 s.

---

### T07 · Big Number  —  `big-number`  ·  P0
- **Category:** Stat / milestone · **Duration:** 4.5 s · **Loopable:** no
- **Pitch:** A number counts up with weight and lands with a tick of confetti. For "10K users",
  "98 % satisfaction", "$2M raised".
- **Fields:**
  - `value` (text, digits + separators, ≤ 12 chars) — default "10,000"
  - `prefix` (text, ≤ 4 chars, optional; e.g. "$") · `suffix` (text, ≤ 8 chars, optional; e.g. "+", "%")
  - `label` (text, ≤ 48 chars) — default "happy customers"
  - `context` (text, ≤ 60 chars, optional) — default "and counting"
  - `background`, `numberColor`, `accent` (colors)
  - `celebrate` (toggle: confetti tick) — default on
- **Storyboard:**
  - 0.00–0.40 label's underline rule draws in
  - 0.30–2.30 count-up from 0 with `out-expo` on the value curve (fast start, dramatic slowdown);
    digits roll on a vertical slot-machine mask; thousands separators respected
  - 2.30 landing beat: number scales 1.0→1.06→1.0 (120 ms); if `celebrate`, 24 seeded confetti
    rects burst and fall with 0.8 s life
  - 2.50–3.00 label + context settle in
  - 3.00–4.50 hold
- **Palettes:** Ink / Coral / Cobalt / Emerald.
- **Poster frame:** t = 2.5 s (post-landing).

---

### T08 · Quote Spotlight  —  `quote-spotlight`  ·  P0
- **Category:** Testimonial / quote · **Duration:** 6.0 s · **Loopable:** no
- **Pitch:** An oversized quotation mark, staggered quote lines, author with optional avatar.
  The testimonial standard.
- **Fields:**
  - `quote` (textarea, ≤ 160 chars, auto-wraps to ≤ 4 lines, shrink-to-fit)
    — default "Jima made our launch posts look like we hired a motion studio."
  - `author` (text, ≤ 32 chars) — default "Sam Rivera" · `role` (text, ≤ 40 chars, optional)
  - `avatar` (image, optional, circle-cropped)
  - `background`, `textColor`, `accent` (colors) · `fontRole` (select: `serif` | `display`)
- **Storyboard:**
  - 0.00–0.70 giant “ glyph drifts in from −20 px at 8 % opacity → 12 %, parks as watermark
  - 0.50–2.60 quote reveals per-word (0.045 s/word, `out-quint`, 6 px rise)
  - 2.60–3.20 accent rule draws; author slides in; role fades at 60 %
  - 3.00–3.40 avatar circle scales in `out-back` (skipped cleanly if empty)
  - 3.40–6.00 hold; “ glyph breathes ±1 % (6 s period)
- **Palettes:** Paper+ink / Cream+espresso / Porcelain+navy / Blush+plum.
- **Poster frame:** t = 3.5 s.

---

### T09 · Logo Sting  —  `logo-sting`  ·  P0
- **Category:** Brand intro/outro · **Duration:** 3.5 s · **Loopable:** no
- **Pitch:** Logo lands with an elastic pop and a shape burst, tagline follows. The video end-card
  every brand needs.
- **Fields:**
  - `logo` (image — falls back to `brandText` if empty)
  - `brandText` (text, ≤ 24 chars) — default "jima"
  - `tagline` (text, ≤ 48 chars, optional) — default "motion for everyone"
  - `background`, `accent` (colors) · `burst` (select: `shapes` | `ring` | `none`)
- **Storyboard:**
  - 0.00–0.80 logo scales 0→1.0 with `spring(0.45)` double-settle
  - 0.55 burst fires: 12 seeded shapes (circles/triangles/rects) fly outward, 0.7 s life,
    rotation + gravity fade — or a ring wipe expands (variant)
  - 0.90–1.40 tagline letter-spaces in below
  - 1.40–3.50 hold; logo micro-floats ±3 px (3 s period) — clean end-card
- **Palettes:** White+ink / Accent-wash / Duo-split / Soft-gradient.
- **Poster frame:** t = 1.6 s.

---

### T10 · Save the Date  —  `save-the-date`  ·  P0
- **Category:** Event · **Duration:** 5.0 s · **Loopable:** no
- **Pitch:** A date rolls into place on split-flap style digits with event name and place.
  Webinars, launches, meetups, weddings.
- **Fields:**
  - `eyebrow` (text, ≤ 24 chars) — default "SAVE THE DATE"
  - `eventName` (text, ≤ 48 chars, shrink-to-fit) — default "Jima Live 2026"
  - `date` (text, ≤ 16 chars) — default "12 · 09 · 2026" (rendered as rolling digit groups)
  - `place` (text, ≤ 48 chars, optional) — default "Online · 6 PM CET"
  - `background`, `textColor`, `accent` (colors) · `frame` (toggle: thin border frame) — default on
- **Storyboard:**
  - 0.00–0.50 border frame draws clockwise from top-left (`in-out-quint`)
  - 0.40–0.90 eyebrow tracks in with 0.4 em→0.12 em letter-spacing
  - 0.90–1.50 event name rises under clip mask
  - 1.50–2.70 date digit groups roll like split-flap boards, 0.15 s stagger per group,
    3 flips each, `out-quint`, tick accent on each landing
  - 2.70–3.20 place fades in
  - 3.20–5.00 hold; accent dot between date groups pulses at 1.5 s period
- **Palettes:** Invitation ivory / Ink formal / Coral festive / Sage calm.
- **Poster frame:** t = 3.0 s.

---

### T11 · Tips Stack  —  `tips-stack`  ·  P1
- **Category:** Educational / listicle · **Duration:** 7.0 s (scales with item count) · **Loopable:** no
- **Pitch:** "5 tips for better reels" — title, then checklist items slide in one at a time with
  check-draw animations. The engagement-bait format.
- **Fields:**
  - `title` (text, ≤ 48 chars) — default "3 rules for better posts"
  - `items` (textlist, 2–5 items, ≤ 60 chars each)
  - `marker` (select: `check` | `number` | `arrow`)
  - `background`, `textColor`, `accent` (colors)
- **Storyboard:**
  - 0.00–0.70 title slides in; underline draws
  - From 0.90, per item (1.1 s each): row card slides from right 24 px + fades; marker animates
    (check = stroke-draw 0.3 s; number = flip-in; arrow = draw + nudge); previous rows dim to 85 %
  - Final 1.2 s: all rows re-brighten, accent frame pulse — "screenshot me" end state
  - Duration = 1.0 + items × 1.1 + 1.4, clamped 4–10 s (Studio shows computed duration)
- **Palettes:** Notebook / Citrus / Slate / Bubblegum.
- **Poster frame:** all items visible (t = duration − 0.8 s).

---

### T12 · Split Duo  —  `split-duo`  ·  P1
- **Category:** Comparison / before-after · **Duration:** 5.0 s · **Loopable:** no
- **Pitch:** The screen splits, two sides face off, a VS badge punches in. Before/after, this-or-that,
  old-vs-new.
- **Fields:**
  - `leftLabel` / `rightLabel` (text, ≤ 24 chars) — defaults "Before" / "After"
  - `leftImage` / `rightImage` (image, optional cover-fit; colored panels if empty)
  - `leftColor` / `rightColor` (colors, used as panel fill and/or image tint scrim)
  - `badge` (text, ≤ 8 chars) — default "VS" · `badgeStyle` (select: `punch` | `spin` | `none`)
  - `split` (select: `vertical` | `diagonal`)
- **Storyboard:**
  - 0.00–0.70 both panels wipe in toward the seam (left from left, right from right), `out-expo`;
    seam line overshoots 6 px and settles
  - 0.70–1.20 labels rise inside each panel with 0.15 s offset
  - 1.20–1.55 badge punches in at seam center: scale 1.6→1.0 `out-back` + 1 px shake (or 180° spin variant)
  - 1.55–4.40 panels breathe alternately (images scale 1.0↔1.03, 2.4 s period, counter-phased)
  - 4.40–5.00 labels bold-pulse once — end frame
- **Palettes:** Coral-vs-cobalt / Ink-vs-lime / Peach-vs-teal / Mono duo.
- **Poster frame:** t = 1.8 s.

---

## 4. Coverage matrix

| # | Template | Category | Image slots | Text-only OK | Loopable | Priority |
|---|----------|----------|------------|--------------|----------|----------|
| T01 | Kinetic Headline | Announcement | – | ✅ | – | P0 |
| T02 | Slide & Reveal | Statement | – | ✅ | – | P0 |
| T03 | Glow Promo | Sale/Promo | – | ✅ | ✅ | P0 |
| T04 | Product Pop | Product | 1 | ✅ (placeholder) | – | P0 |
| T05 | Typewriter | Tech | – | ✅ | – | P0 |
| T06 | Ken Burns Story | Photo story | 1 | ⚠️ placeholder | – | P0 |
| T07 | Big Number | Stat | – | ✅ | – | P0 |
| T08 | Quote Spotlight | Testimonial | 1 (optional) | ✅ | – | P0 |
| T09 | Logo Sting | Brand | 1 (optional) | ✅ | – | P0 |
| T10 | Save the Date | Event | – | ✅ | – | P0 |
| T11 | Tips Stack | Educational | – | ✅ | – | P1 |
| T12 | Split Duo | Comparison | 2 (optional) | ✅ | – | P1 |

10 × P0 satisfies the "≥ 10 templates" launch requirement even if P1 slips; target is all 12.

## 5. Template QA checklist (every template, before "shipped")

- [ ] Renders correctly in all 4 aspects; no text overflow with max-length content in DE/EN
      (German strings run ~30 % longer — test with them)
- [ ] Defaults look shippable with zero edits; poster frame is attractive
- [ ] Deterministic: golden-frame snapshots at t = {0 %, 25 %, 50 %, 75 %, last frame} stable
      across two runs and across preview/export paths
- [ ] Empty optional fields degrade gracefully (no gaps, no broken layout)
- [ ] Speed 0.5×/2.0× produce sane motion (no physics blowups)
- [ ] 60 fps preview on reference laptop; export at 1080p produces no dropped/duplicated frames
- [ ] All 4 palettes verified for contrast (text ≥ 4.5:1 against its background in end frame)
- [ ] GIF export ≤ 8 MB at default settings (480p/12.5fps GIF profile) — see export profiles
- [ ] Entered in `packages/templates/src/durations.ts` with the length the runner actually reports
      (the gallery's length filters read it; the golden suite fails if it is missing or wrong)

## 6. Post-v1 template backlog (not in scope now; parked ideas)

Ranked candidates for the first content drops after launch: Lower Third (talking-head overlay),
Hiring Post ("We're hiring"), Podcast Audiogram (fake waveform — no audio in v1), Price Table Pop,
Emoji Rain Reaction, Sticker Pack (animated arrows/circles/underline overlays with transparent
WebM export), Carousel Cover Loop, Year-in-Review Counter, Menu of the Day, App Screenshot Tilt.

## 7. v1.1 expansion pack — 23 templates (2026-07-21)

The library grew from 12 → **35**. These follow the same contract (§2) and pass the §5 QA checklist
(all deterministic — pixel-exact re-seek in the golden suite, all 4 aspects, 4 palettes, DE
max-length). Two engine-side helpers back the pack: `shared/icons.ts` (a 16-glyph vector icon
library) and `shared/ui.ts` (`dashedPath`/`arcPoints`, `makePill`, `avatar`, `pointerCursor`). Two
new categories were added: **social** and **travel**.

| # | Template | `id` | Category | Default | What it does |
|---|---|---|---|---|---|
| T13 | Icon Pop | `icon-pop` | brand | 1:1 | A bold icon springs onto an accent disc with a ring/particle burst + label |
| T14 | Subscribe Bell | `subscribe-bell` | social | 16:9 | Cursor clicks Subscribe → button flips to Subscribed, bell rings, subs count up |
| T15 | Special Offer | `special-offer` | promo | 4:5 | Starburst discount seal stamps in over an old→new price slash + CTA |
| T16 | Kinetic Type | `kinetic-type` | statement | 9:16 | Word-by-word kinetic typography with an accent highlight on the emphasis word |
| T17 | Keynote Reveal | `keynote-reveal` | statement | 16:9 | Calm Apple-keynote word reveal + accent divider + muted subline |
| T18 | Word Swap | `word-swap` | statement | 1:1 | A phrase with one looping word that rolls through a list inside an accent pill |
| T19 | Marker Highlight | `marker-highlight` | statement | 4:5 | Editorial lines with a hand-drawn marker swipe behind a key phrase |
| T20 | YouTube Frame | `youtube-frame` | social | 16:9 | A YouTube video card assembles: thumbnail, play, progress, title, channel, actions |
| T21 | Reel Frame | `reel-frame` | social | 9:16 | IG/TikTok Reel UI: action rail (heart/comment/share/save), caption, audio row, progress |
| T22 | Notification Pop | `notification-pop` | social | 1:1 | iOS-style push banners drop and stack with a spring |
| T23 | Like Spark | `like-spark` | social | 1:1 | A like button gets clicked — bounce, accent flip, +1, count-up, confetti |
| T24 | Follow Pop | `tiktok-follow` | social | 9:16 | TikTok avatar + red "+" tapped → morphs to a check, hearts float up |
| T25 | Double-Tap Heart | `double-tap-heart` | social | 9:16 | The IG double-tap: big heart pops, hearts burst, like count ticks (loopable) |
| T26 | Comment Drop | `comment-drop` | social | 4:5 | A live comment feed — bubbles pop in and push the stack upward |
| T27 | Icon Grid | `icon-grid` | brand | 1:1 | A grid of icon tiles pops in staggered with one accent hero tile |
| T28 | Badge Stamp | `badge-stamp` | brand | 1:1 | A seal/badge stamps down with an impact ring and a shake settle |
| T29 | Folder Open | `folder-open` | tech | 16:9 | A folder opens and labelled file cards fan out |
| T30 | Card Cascade | `card-cascade` | tech | 4:5 | A stack of cards cascades into a neat numbered list |
| T31 | Travel Postcard | `travel-postcard` | travel | 4:5 | Destination + from→to with a plane flying a dashed arc to a pin + AIR MAIL stamp |
| T32 | Location Pin | `location-pin` | travel | 9:16 | A map pin drops with ripple rings + place name and coordinates |
| T33 | Flash Sale | `flash-sale` | promo | 9:16 | High-energy sale with lightning bolts and a draining urgency bar + CTA |
| T34 | Coupon Reveal | `coupon-reveal` | promo | 1:1 | A perforated coupon ticket reveals a mono code + discount + CTA |
| T35 | Stat Bars | `stat-bars` | stat | 4:5 | An animated bar chart — bars grow and values count up, top bar highlighted |

## 8. Smooth-text pack — 20 templates (2026-07-21)

The library grew from 35 → **55** with a focused set of clean, smooth kinetic-typography templates
(all `category: "statement"`). Two techniques back the pack beyond the standard `layoutWords`:
`layoutChars()` (kerning-accurate per-glyph layout, in `shared/words.ts`) for per-letter motion, and
Pixi container masking (a `Graphics` rect as `container.mask`) for wipe/reveal effects. All are
deterministic (pixel-exact re-seek), all 4 aspects, 4 palettes, smooth eases, clean end-hold.

| # | Template | `id` | Default | Motion |
|---|---|---|---|---|
| T36 | Fade Cascade | `fade-cascade` | 1:1 | Words fade + drift up, one soft beat at a time |
| T37 | Letter Reveal | `letter-reveal` | 16:9 | Each character pops into place in sequence (accent last word) |
| T38 | Line Rise | `line-rise` | 16:9 | Each line slides up from behind a clean masked edge |
| T39 | Focus In | `focus-in` | 16:9 | Per-word letterSpacing collapse + fade — a lens focusing |
| T40 | Side Slide | `side-slide` | 4:5 | Lines slide in from alternating sides and settle |
| T41 | Scale In | `scale-in` | 1:1 | The headline scales up smoothly then breathes |
| T42 | Flip In | `flip-words` | 16:9 | Words flip in on the X-axis (squash-open) |
| T43 | Shine Sweep | `shine-text` | 16:9 | A bright band sweeps across the letters (masked) |
| T44 | Split Reveal | `split-reveal` | 16:9 | Each line assembles from a top/bottom split (masked) |
| T45 | Wave | `wave-text` | 16:9 | Letters bob in a seamless continuous sine wave (loop) |
| T46 | Bounce In | `bounce-in` | 1:1 | Words drop and settle with a soft spring + squash |
| T47 | Drop In | `drop-letters` | 1:1 | Letters drop from above with a soft-bounce landing |
| T48 | Curtain Wipe | `curtain-wipe` | 16:9 | An accent curtain bar sweeps off to reveal the text (masked) |
| T49 | Stacked Build | `stacked-build` | 4:5 | A statement builds upward, line by line |
| T50 | Push In | `push-in` | 16:9 | A cinematic dolly-in scale settle, then a slow drift |
| T51 | Text Scramble | `text-scramble` | 16:9 | A left-to-right decode — glyphs scramble then resolve |
| T52 | Emphasis Line | `emphasis-line` | 4:5 | A muted sentence with one keyword popping in accent |
| T53 | Spacing Expand | `spacing-expand` | 16:9 | An airy kicker whose letter-spacing expands + headline |
| T54 | Message Rotator | `message-rotator` | 1:1 | A line crossfades through a list of phrases (loop) |
| T55 | Box Wipe | `box-wipe` | 16:9 | An accent bar wipes across, revealing each line (masked) |

## 9. Explainer / showcase / product / ad pack — 20 templates (2026-07-21)

The library grew from 55 → **75**. Beyond text: explainers, showcases, product presentations and
ads. Same contract (§2), same QA bar (§5); all deterministic (pixel-exact re-seek), all 4 aspects,
4 palettes, exposing `background`/`textColor`/`accent` color fields. Image templates cover-fit a
user image (masked to a rounded rect) and degrade to a designed placeholder when empty. Adds the
`showcase` category.

| # | Template | `id` | Category | Default | What it does |
|---|---|---|---|---|---|
| T56 | Step Flow | `step-flow` | educational | 16:9 | Numbered process steps connected by drawing arrows |
| T57 | Timeline | `timeline-flow` | educational | 16:9 | A timeline baseline with milestone dots + dates (zigzag) |
| T58 | Before / After | `before-after` | comparison | 1:1 | Two states revealed with a wipe + labels (optional images) |
| T59 | Comparison | `comparison-vs` | comparison | 4:5 | A this-vs-that table with checks/crosses + a VS badge |
| T60 | Feature Callouts | `feature-callouts` | educational | 1:1 | A product with annotation leader-lines to feature labels (image) |
| T61 | Product Showcase | `product-showcase` | showcase | 1:1 | A product floats on a lit pedestal with name/price (image) |
| T62 | Gallery Strip | `gallery-strip` | showcase | 4:5 | 3–4 image cards cascade into a neat strip (images) |
| T63 | Feature Grid | `feature-grid` | showcase | 1:1 | A grid of icon feature cards (`icon \| title \| blurb`) |
| T64 | Device Mockup | `device-mockup` | showcase | 9:16 | A phone/browser frame around a screenshot (image) |
| T65 | Review Stars | `review-stars` | testimonial | 4:5 | A 5-star rating + a serif review + author row |
| T66 | Product Hero | `product-hero` | product | 16:9 | Product image + name + tagline + CTA (image) |
| T67 | Pricing Card | `price-card` | product | 4:5 | A plan card: price + feature list + CTA + badge |
| T68 | New Arrival | `new-arrival` | product | 1:1 | A "NEW" burst + product reveal + shop CTA (image) |
| T69 | Spec Sheet | `spec-list` | product | 9:16 | A product + a two-column spec list ticking in (image) |
| T70 | Spotlight Reveal | `reveal-spotlight` | product | 16:9 | A spotlight sweeps to reveal a product on dark (image) |
| T71 | Stat Trio | `three-stats` | stat | 16:9 | Three big count-up stats with dividers |
| T72 | Logo Wall | `logo-wall` | brand | 16:9 | "Trusted by" + a grid of client wordmark chips |
| T73 | Countdown | `countdown-timer` | promo | 1:1 | A DD:HH:MM:SS countdown (pure `f(t)` digits) + CTA |
| T74 | End Card | `cta-endcard` | brand | 16:9 | An outro: logo/brand + CTA + social handles |
| T75 | Sale Banner | `sale-banner` | promo | 16:9 | A bold sale with diagonal stripes + discount + CTA |

## 10. Showcase & product-presentation pack — 20 templates (2026-07-21)

Library 75 → **95**. Same contract; deterministic, all 4 aspects, 4 palettes, image→placeholder
degradation, per-element color fields.

| # | Template | `id` | Category | Default | What it does |
|---|---|---|---|---|---|
| T76 | Photo Grid | `photo-grid` | showcase | 1:1 | A mosaic of images tiles in, staggered |
| T77 | Polaroid Stack | `polaroid-stack` | showcase | 4:5 | Polaroid photos fan out with captions |
| T78 | Before/After Slider | `before-after-slider` | showcase | 1:1 | A divider sweeps to reveal after-over-before |
| T79 | Carousel Cover | `carousel-cover` | showcase | 4:5 | An IG carousel cover with peeking cards + swipe |
| T80 | Team Grid | `team-grid` | showcase | 16:9 | Meet-the-team avatar cards with name/role |
| T81 | Testimonial Wall | `testimonial-wall` | showcase | 1:1 | Star-rated review cards pop into place |
| T82 | Feature Spotlight | `feature-spotlight` | showcase | 16:9 | One hero feature: big icon + title + blurb |
| T83 | Image Reveal | `image-reveal` | showcase | 16:9 | A hero image reveals under a scrim + title |
| T84 | Split Showcase | `split-showcase` | showcase | 16:9 | Split screen: image + title + bullet points |
| T85 | Mockup Tilt | `mockup-tilt` | showcase | 1:1 | A screenshot floats at a 3D tilt (skew) |
| T86 | Product Carousel | `product-carousel` | product | 1:1 | Product images cycle with name + price + dots |
| T87 | Product 360 | `product-360` | product | 1:1 | Product on a rotating turntable + "360° view" |
| T88 | Color Variants | `color-variants` | product | 4:5 | Backdrop switches through color swatches |
| T89 | Product Lineup | `product-lineup` | product | 16:9 | A family lineup of products with prices |
| T90 | Bundle Offer | `bundle-offer` | product | 1:1 | Products bundled + computed savings + CTA |
| T91 | Product Detail | `product-detail` | product | 1:1 | A magnifier callout on a product detail + buy |
| T92 | Unbox Reveal | `unbox-reveal` | product | 9:16 | A box opens and the product rises out |
| T93 | Size Compare | `size-compare` | product | 1:1 | Drafting-style H×W×D dimension guides |
| T94 | Product Review | `product-review` | product | 4:5 | Product + star rating + customer quote |
| T95 | Shop Grid | `shop-grid` | product | 4:5 | A shop collection grid with prices + CTA |

## 19. +45 templates — clean/modern/smooth, 5 each for all nine sections (2026-07-25, v1.18.0)

Library 399 → **444**. A deliberately calmer pack: the brief was **clean, modern, unique and
smooth**, so these favour long eased moves (`outExpo`/`inOutCubic`, 0.7–1.4 s heroes, 60–120 ms
staggers), generous negative space, hairlines over heavy rules, and muted palettes with a single
confident accent. No bounces, overshoots or strobes anywhere in the pack.

- **Text & titles** (`statement`): `liquid-headline` (organic wave-edge mask), `weight-shift`
  (light→bold typographic morph), `slow-pan-type`, `depth-stack-text` (parallax convergence),
  `unfold-line`.
- **Overlays** (`overlay`): `glass-bar`, `hairline-third`, `pill-expand`, `side-rail` (the library's
  first vertical lower-third), `soft-scrim`.
- **Social** (`social`): `collab-post`, `profile-grid`, `scroll-stop`, `quote-reel`, `feed-scroll`.
- **Product & ads** (`product`/`promo`): `studio-pedestal`, `float-product`, `swatch-fan`,
  `value-stack`, `product-story` (a 3-beat narrative).
- **Showcase** (`photo`/`showcase`/`tech`): `image-morph`, `split-scroll`, `color-grade`,
  `ui-states`, `grid-to-hero`.
- **Explainers & data** (`stat`/`educational`): `sankey-flow`, `treemap`, `bell-curve`,
  `journey-map`, `stat-morph`.
- **Brand & quotes** (`brand`/`testimonial`): `brand-gradient`, `manifesto`, `brand-values`,
  `quote-portrait`, `logo-orbit`.
- **Openers** (`intro`): `gradient-wash`, `hairline-intro`, `column-rise`, `zoom-through`,
  `liquid-intro`.
- **Events & travel** (`travel`): `seat-map`, `compass-bearing`, `season-shift`, `skyline-build`,
  `horizon-pan`.

All 45 had their duration read back off a live `TemplateRunner` and their re-seek verified
pixel-identical before baselines were written. 4 aspects, 4 palettes, per-element colours,
decorative toggles, ≥4.5:1 end-frame contrast throughout; `treemap` carries an adaptive contrast
ramp because mid-tone tints are the case where neither a light nor a dark ink clears 4.5:1.

## 18. +45 templates — 5 each for all nine sections (2026-07-25, v1.16.0)

Library 354 → **399**. Five new templates apiece for **every** gallery section, Text & titles included:

- **Text & titles** (`statement`/`announcement`): `ransom-note`, `text-swing`, `shadow-pop`, `echo-zoom`, `stand-up-text`.
- **Overlays & lower-thirds** (`overlay`): `up-next`, `frame-corners`, `karaoke-caption`, `key-press`, `arrow-callout`.
- **Social** (`social`): `streak-flame`, `wrapped-recap`, `voice-note`, `avatar-stack`, `on-this-day`.
- **Product & ads** (`promo`/`product`): `spin-wheel`, `loyalty-card`, `order-confirmed`, `exploded-view`, `waitlist-card`.
- **Showcase** (`tech`/`showcase`): `blueprint-reveal`, `parallax-layers`, `cube-spin`, `window-cascade`, `iso-layers`.
- **Explainers & data** (`stat`/`comparison`/`educational`): `bubble-chart`, `slope-graph`, `gantt-chart`, `dot-stats`, `iceberg-model`.
- **Brand & quotes** (`brand`/`testimonial`): `crest-monogram`, `ribbon-banner`, `foil-card`, `trophy-shelf`, `press-clipping`.
- **Openers** (`intro`): `page-turn`, `marquee-bulbs`, `shatter-intro`, `unfold-intro`, `flash-cut`.
- **Events & travel** (`travel`/`event`): `metro-map`, `airmail-envelope`, `event-menu`, `sunrise-scene`, `race-bib`.

All deterministic (re-seek pixel-identity verified per template), 4 aspects, 4 palettes, per-element colors, decorative toggles, ≥4.5:1 end-frame contrast. Overlays default to a transparent background (alpha-WebM ready).

## 17. +80 templates — 10 each for eight sections (2026-07-24, v1.15.0)

Library 274 → **354**. Ten new templates apiece for every gallery section **except Text & titles**:

- **Overlays & lower-thirds** (`overlay`): `weather-bug`, `breaking-banner`, `poll-bar`, `countdown-strip`, `now-speaking`, `stat-strip`, `donation-alert`, `dateline`, `key-point`, `subscribe-reminder`.
- **Social** (`social`): `unmute-tap`, `screen-record`, `green-screen`, `pinned-post`, `close-friends`, `live-shopping`, `creator-like`, `use-this-sound`, `this-or-that`, `story-highlights`.
- **Product & ads** (`product`/`promo`): `restock-alert`, `bogo-offer`, `ingredients`, `subscription-box`, `wishlist-add`, `limited-edition`, `cashback-offer`, `gift-card`, `bestseller-tag`, `app-promo`.
- **Showcase** (`tech`/`showcase`/`photo`): `code-editor`, `terminal`, `dashboard`, `pricing-tiers`, `smartwatch-showcase`, `home-widgets`, `photo-mosaic`, `slideshow`, `photo-flip`, `magazine-spread`.
- **Explainers & data** (`stat`/`educational`/`comparison`): `waterfall-chart`, `heatmap`, `leaderboard`, `cycle-diagram`, `org-chart`, `roadmap`, `word-cloud`, `quadrant`, `survey-results`, `radar-chart`.
- **Brand & quotes** (`brand`/`testimonial`): `logo-assemble`, `award-laurels`, `logo-flip`, `coming-soon`, `social-endcard`, `brand-palette`, `logo-morph`, `review-stack`, `review-badge`, `video-testimonial`.
- **Openers** (`intro`): `curtain-intro`, `light-sweep`, `ink-reveal`, `panel-slide`, `spotlight-reveal`, `countdown-ring`, `burst-intro`, `grid-intro`, `title-card`, `sparkle-reveal`.
- **Events & travel** (`event`/`travel`): `wedding-invite`, `anniversary-card`, `speaker-lineup`, `holiday-card`, `grand-opening`, `graduation-card`, `packing-list`, `destination-reveal`, `currency-card`, `trip-map`.

All deterministic, 4 aspects, 4 palettes, per-element colors, decorative toggles, ≥4.5:1 end-frame contrast. Overlay templates default to a transparent background (alpha-WebM ready).

## 16. +25 templates — 5 each for five sections (2026-07-24, v1.12.0)

Library 249 → **274**. Five new templates apiece for the same five gallery sections:

- **Lower-thirds** (`overlay`): `chapter-marker`, `metric-bar`, `social-bar`, `qr-callout`, `sponsor-bar`.
- **Social** (`social`): `save-post`, `share-sheet`, `action-rail`, `goal-tracker`, `notif-stack`.
- **Showcase** (`tech`/`photo`/`showcase`): `phone-scroll`, `device-family`, `coverflow`, `detail-zoom`, `contact-sheet`.
- **Explainers & data** (`educational`/`comparison`/`stat`): `checklist`, `mind-map`, `tier-list`, `scatter-plot`, `stacked-bar`.
- **Events & Travel** (`event`/`travel`): `webinar-invite`, `lanyard-badge`, `birthday-card`, `city-guide`, `time-zones`.

All deterministic, 4 aspects, ≥3 palettes (mostly 4), per-element colors, decorative toggles, ≥4.5:1 end-frame contrast.

## 15. +50 templates — 10 each for five sections (2026-07-23, v1.10.0)

Library 199 → **249**. Ten new templates apiece for five gallery sections:

- **Lower-thirds** (`overlay`): `ticker-bar`, `handle-bar`, `now-playing`, `caption-pop`, `alert-banner`, `speaker-card`, `score-bug`, `logo-bug`, `timer-badge`, `topic-chips`.
- **Social** (`social`): `live-badge`, `stream-chat`, `swipe-carousel`, `pinned-comment`, `music-sticker`, `countdown-sticker`, `slider-sticker`, `new-follower`, `tip-jar`, `add-yours`.
- **Showcase** (`tech`/`photo`/`showcase`): `laptop-mockup`, `tablet-showcase`, `photo-stack-swipe`, `grid-zoom`, `spec-sheet`, `hotspot-tour`, `feature-tabs`, `film-strip`, `masonry-reveal`, `orbit-showcase`.
- **Explainers & data** (`stat`/`educational`/`comparison`): `pie-chart`, `area-chart`, `gauge-meter`, `funnel-chart`, `venn-diagram`, `flowchart`, `pyramid-levels`, `radial-bars`, `comparison-table`, `growth-arrow`.
- **Events & Travel** (`event`/`travel`): `event-countdown`, `itinerary`, `flight-board`, `luggage-tag`, `weather-forecast`, `hotel-card`, `road-trip`, `rsvp-card`, `event-schedule`, `globe-spin`.

All deterministic, 4 aspects, ≥3 palettes, per-element colors, decorative toggles, ≥4.5:1 end-frame contrast.

## 14. Backgrounds retired · +45 templates — 5 per gallery section (2026-07-23, v1.9.0)

Library 160 → **199**. The **Backgrounds** (`loop`) category and its six templates (`bokeh-drift`,
`confetti-loop`, `floating-shapes`, `gradient-flow`, `grid-pulse`, `wave-lines`) were retired, then
every remaining gallery section gained five new templates:

- **Text & titles** (`statement`): `blur-focus`, `mask-wipe`, `stretch-in`, `type-cursor`, `tape-highlight`.
- **Overlays & lower-thirds** (`overlay`): `corner-tag`, `news-lower-third`, `progress-overlay`, `side-label`, `location-tag`.
- **Social** (`social`): `reaction-bar`, `story-progress`, `duet-split`, `reply-sticker`, `poll-results`.
- **Product & ads** (`product`/`promo`): `spec-callouts`, `swatch-switch`, `add-to-cart`, `bundle-stack`, `deal-countdown`.
- **Showcase** (`tech`/`photo`/`showcase`): `app-screens`, `photo-fan`, `feature-rotator`, `browser-window`, `photo-develop`.
- **Explainers & data** (`stat`/`educational`/`comparison`): `donut-chart`, `line-graph`, `process-arrows`, `pros-cons`, `kpi-tiles`.
- **Brand & quotes** (`brand`/`testimonial`): `quote-mark`, `logo-draw`, `rating-reveal`, `brand-lockup`, `signature-sign`.
- **Openers** (`intro`): `film-countdown`, `iris-open`, `glitch-intro`, `zoom-punch`, `blinds-open`.
- **Events & travel** (`event`/`travel`): `ticket-stub`, `boarding-pass`, `map-route`, `calendar-flip`, `passport-stamp`.

All deterministic, 4 aspects, ≥3 palettes, per-element colors, decorative toggles, ≥4.5:1 end-frame contrast.

## 13. Reference-style pack — 5 templates (2026-07-21, v1.8.1)

Library 155 → **160**. Five polished templates modelled on high-quality reference animations:
`comment-thread` (TikTok/IG comment section + NEW badge, social), `chat-convo` (named Sender/Replier
DM on dark, social), `search-type` (search-bar typewriter + cursor on dark, social), `retro-tv`
(glowing CRT/vlog frame + app-icon row + caption stamp + Day N, social), and `watermark-drop`
(product over a tiled diagonal brand-watermark backdrop, product). Deterministic, 4 aspects, ≥3
palettes, per-element colors, decorative toggles.

## 12. Social expansion — 10 templates (2026-07-21, v1.7.2)

Library 145 → **155**. Ten more **social** templates: `profile-card` (profile header + stat count-up),
`share-repost`, `story-quiz` + `qa-box` (Instagram story stickers), `emoji-float` (live-style
reaction stream), `dm-chat` (DM bubbles), `link-in-bio`, `verified-pop` (verified badge), `giveaway`
(prize + entry steps), and `trending-now` (ranked list). All 9:16-first, deterministic, 4 aspects,
≥3 palettes, per-element colors, decorative toggles. Social category: 14 → 24.

## 11. Overlays / openers / loops / more — 50 templates (2026-07-21)

Library 95 → **145**, plus three new categories — **overlay** (lower-thirds/callouts, built to be
exported transparent), **intro** (openers/stingers), **loop** (seamless backgrounds) — and a
codebase-wide editability pass: purely decorative elements (accent bars/dots, badges, frames, glows,
sparkles, dividers, connectors) now have per-template on/off `toggle` fields, all defaulting on.
Same contract; deterministic (loops use periodic `update(t)` seeded once so `frame(duration)==frame(0)`),
all 4 aspects, ≥3 palettes, per-element colors, German-length-safe, 4.5:1 end-frame contrast.

| Category | Templates (`id`) |
|---|---|
| Overlays / lower-thirds (`overlay`) | `lower-third`, `name-tag`, `subtitle-bar`, `cta-bar`, `topic-bug`, `stat-callout`, `speech-pop` |
| Openers (`intro`) | `channel-intro`, `countdown-intro`, `logo-lines`, `neon-sign`, `clap-intro`, `intro-bars` |
| Background loops (`loop`) | `gradient-flow`, `floating-shapes`, `bokeh-drift`, `wave-lines`, `grid-pulse`, `confetti-loop` |
| Text & titles (`statement`) | `highlight-sweep`, `outline-fill`, `stamp-text`, `rotating-headline`, `gradient-text`, `split-flap`, `underline-grow` |
| Social (`social`) | `story-poll`, `hashtag-pop`, `followers-count`, `swipe-up`, `mention-tag`, `sticker-pop` |
| Product & promo (`product`/`promo`) | `new-drop`, `feature-tags`, `discount-burst`, `price-slash`, `limited-stock`, `shipping-badge` |
| Data & stats (`stat`) | `progress-ring`, `bar-race`, `percent-fill`, `rating-bars`, `milestone-counter` |
| Testimonial / brand / event | `quote-cards`, `testimonial-slide`, `logo-grid-reveal`, `thank-you`, `logo-reveal-mask`, `end-screen`, `event-lineup` |

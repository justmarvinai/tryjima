# Jima Motion — Design Architecture

> **v2 redesign (2026-07, v1.11.0) — this doc's brand/color/type sections below describe the
> original "ember sticker" system and are partly historical.** The shipped UI is now a **modern-SaaS,
> true-light-mode** system: neutral un-tinted white/grey surfaces, a single **emerald** accent
> (`#10b981`; accent text/buttons use emerald-700 `#047857` for ≥4.5:1 on white), **Parkinsans**
> (variable) as the UI/layout typeface, tighter radii, and soft neutral shadows. The **source of
> truth for tokens is `apps/web/src/styles/index.css`** (`@theme`), with shadcn-style primitives in
> `apps/web/src/ui/`. The landing hero is a **live template showcase** (the old 3D/WebGL blob was
> retired). Template render fonts/palettes are unchanged. §§ below are kept for history + the
> Studio-UX/copy/a11y guidance, which still applies.

**Scope:** brand system, design tokens, landing-page spec, Studio UX spec, accessibility, and copy
guidelines. Light/white-mode only — there is no dark theme anywhere, by product decision.
Competitor design context is in `COMPETITOR_RESEARCH.md` (Jitter: light base, black type, site
demos the product, Awwwards-grade motion).

---

## 1. Brand foundation

- **Name usage:** the brand and website are **Jima Motion**. The editor is **Jima Studio** — in UI
  copy, "the Studio". Never "Jima Motion Studio". Domain-style wordmark: lowercase **jima**.
- **Personality:** *Bold, instant, generous.* A tool that gives, not gates. Confident like a
  motion studio, friendly like a favorite free tool. Playful, never childish; energetic, never loud.
- **The core brand behavior:** everything animated on the site is made by the engine itself.
  Motion IS the brand — buttons settle with overshoot, cards pop, the logo's spark spins. Static
  where calm is needed (forms, docs), alive where attention should go.
- **Voice:** plain, warm, sure of itself. Short sentences. No hype-words ("revolutionary",
  "supercharge"), no exclamation stacking, no dark patterns (never fake scarcity, never guilt-trip
  copy, never "limited time"). We state the free promise with the *reason* so it's believable:
  "Free because your device does the rendering — there's nothing for us to charge for."

### 1.1 Logo
- **Wordmark:** "jima" in Space Grotesk Bold, tight tracking, ink; followed by a **spark glyph ✦**
  in Ember, optically aligned to the x-height. Lockup variant: "jima ✦ motion".
- **The spark is the motion mascot:** it spins 180° with `out-back` on hover/load; in the Studio
  top bar it rotates continuously *only* while an export renders (progress cue).
- Favicon/app icon: ember spark on white, 32/180/512 sizes. Monochrome fallback: ink spark.

## 2. Color system (light-only)

Design tokens (Tailwind theme names in parentheses). The page is white; color arrives through
content, gradients and the ember accent — generous whitespace everywhere.

| Token | Hex | Use |
|---|---|---|
| `paper` | `#FFFFFF` | page background, cards |
| `porcelain` | `#FAF9F7` | alternating sections, Studio panels |
| `mist` | `#EBEAF2` | hairline borders, dividers |
| `ink` | `#101014` | headlines, body text, primary-button text |
| `slate` | `#5B5B68` | secondary text, labels (4.5:1+ on paper) |
| `ember` | `#FF4D1C` | THE brand accent: primary buttons, spark, highlights, large display type |
| `ember-deep` | `#E13D0E` | hover/active fills |
| `ember-text` | `#B93000` | inline text links & small accents on white (6.0:1 — AA) |
| `ember-tint` | `#FFEDE6` | soft accent backgrounds, chips, focus tints |
| `candy` | `#FF2E9E` | gradient anchor 2 |
| `violet` | `#7C5CFF` | gradient anchor 3 |
| `sky` | `#38C7FF` | gradient anchor 4 |
| `lime-pop` | `#D8F34D` | rare celebratory badge accent (with ink text) |
| `success` / `warning` / `error` | `#17A34A` / `#D97706` / `#DC2626` | semantic states |

- **Brand gradient:** `ember → candy → violet → sky` — used *pastelized* (soft, desaturated blooms
  on near-white) for the hero shader and section auras; used at full punch only inside template
  artwork and small UI moments.
- **Contrast rules (enforced in review):** body text = ink/slate on paper. Small text accents use
  `ember-text`, never raw `ember` (`ember` on white is 3.3:1 — display/large-text only). **Primary
  buttons are `ember` fill with `ink` text** (5.7:1) — this ink-on-ember combination is a
  signature of the brand. Disabled = mist fill + slate text.
- `color-scheme: light` is set globally; OS dark mode does not alter the site.

## 3. Typography

| Role | Family (all OFL, self-hosted; weights as static woff2) | Use |
|---|---|---|
| Display | **Space Grotesk** 500/700 | headlines, wordmark, big numbers |
| UI/Body | **Inter** 400/500/600 | everything interface + long-form |
| Template roles | `display` Space Grotesk · alt-display **Archivo** (incl. Black 900) · **Sora** 600/800 · `serif` **Fraunces** 500/600 · `mono` **JetBrains Mono** 400/700 · `script` **Caveat** 600 · `body` Inter | fonts selectable inside templates (`TEMPLATE_LIBRARY.md`) |

Type scale (fluid): `h1 clamp(2.75rem, 6.5vw, 5.5rem)` / `h2 clamp(2rem, 4vw, 3.25rem)` /
`h3 1.5rem` / body `1.0625rem/1.65` / small `0.875rem`. Display tracking −2 %; UI tracking normal.
Numerals: tabular in counters and progress readouts.

## 4. Space, shape, elevation

- Spacing: 4 px base grid; section padding `clamp(4rem, 10vw, 8rem)`.
- Radius: inputs/buttons **12 px**, cards **20 px**, modals/canvas frame **28 px**, chips pill.
  Chunky rounded geometry is part of the look.
- Elevation (light theme = soft, warm, never gray-muddy):
  `shadow-card: 0 2px 8px rgb(16 16 20 / 4%), 0 12px 32px rgb(16 16 20 / 6%)`;
  `shadow-pop: 0 8px 16px rgb(16 16 20 / 8%), 0 24px 56px rgb(255 77 28 / 10%)` (ember-warmed for
  hero/CTA moments). Borders: 1 px mist on porcelain surfaces.
- Iconography: 1.75 px stroke rounded icons (Lucide), ink; filled ember variants for active states.

## 5. Motion language (the UI itself)

- **Feel:** springy-but-quick. Enter with slight overshoot (`out-back`, scale 0.97→1), exit fast
  and boring (`in-out-quint`, opacity). Nothing bounces twice except celebration moments.
- Durations: micro (hover/press) 120–160 ms · element enter 240–320 ms · section reveal 400–600 ms
  · page-level 500 ms max. Stagger children 40–60 ms.
- Scroll reveals: rise 16 px + fade, once, CSS-first (`animation-timeline` where supported,
  IntersectionObserver fallback) — `motion` (motion.dev) only where springs/orchestration demand.
- Hover on template cards: poster crossfades into live playback (150 ms), card lifts 4 px.
- **`prefers-reduced-motion: reduce`:** all autoplay stops (hero freezes to a designed frame,
  rails become static grids, cards show posters, scroll reveals become plain fades ≤ 150 ms).
  Play buttons still work — reduced motion never removes capability, only autoplay.

## 6. Landing page specification (route `/`)

Narrative arc: **Wow → How → Proof → Trust → Act.** Every section has one job; every CTA opens the
Studio. Copy strings live in § 9.

1. **Navbar** (sticky, white with 80 % opacity + blur, hairline mist bottom border on scroll):
   logo · Templates · How it works · Why it's free · FAQ · **[Open the Studio]** (primary button).
   Mobile: logo + CTA + sheet menu.
2. **Hero** (bento layout on white; the only WebGL on the site — spec in
   `TECHNICAL_ARCHITECTURE.md` § 10). Left column: eyebrow chip, H1 + subline, primary CTA
   **Open the Studio** + secondary "Browse templates →", and the trust chips ("100 % free" ·
   "No account" · "No watermark" · "Private by design"). Right column: a bento of rounded cards —
   a **showpiece card** on a deep-violet gradient holding a **glossy, iridescent liquid-metal 3D
   blob** (a high-detail icosahedron morphed by GPU simplex-noise displacement, lit by a gradient
   reflection map in the brand anchors — no external HDR/assets), plus a frosted label + arrow;
   and two supporting cards (a "155 templates" stat on a lime→sky gradient, and an "every size &
   format" card with MP4/WebM/GIF + aspect chips). Reduced-motion/no-WebGL → a soft CSS gradient
   orb in the showpiece card (must look intentional).
3. **Live template rail:** full-bleed marquee (two rows, opposite directions, slow) of template
   cards rendered live by the engine (shared renderer; posters off-screen). Hover pauses the rail
   and plays that card; click deep-links `/studio?t=<id>`. Caption: "12 templates at launch — all
   free, all yours."
4. **How it works** (3 steps, each with a small looping engine-rendered vignette):
   ① Pick a template → ② Type your words, drop your images → ③ Export MP4 or GIF.
   Sub-caption: "No timeline. No keyframes. No tutorial needed."
5. **Why it's free** (the trust section — the "catch" killer): split layout. Left: plain-language
   explanation — rendering happens on *your* device, so we have no server bills, so we have
   nothing to charge you for; your content never uploads. Right: a compact comparison table
   (Jima vs "typical motion tools" vs "design suites"): price for clean 1080p, account, watermark,
   export limits, where files go. Factual, unnamed columns on the landing (named teardowns live in
   research/compare content later).
6. **Feature grid** (6 cards, icon + two lines): Free forever · No account, ever · 1080p, no
   watermark · MP4 + GIF (+ WebM) · Private by design · Every aspect ratio (1:1, 4:5, 9:16, 16:9).
7. **Template gallery teaser:** filterable grid (category chips) of all 12, poster + hover-play,
   each card → Studio deep link. CTA: "Open the full gallery in the Studio".
8. **FAQ** (accordion; questions in § 9.3).
9. **Footer** (porcelain): logo + one-liner, footer links (Templates, Studio, FAQ, Privacy,
   Changelog, GitHub), line: "Made with the Jima engine — every animation on this page is a Jima
   template." + "Your work stays in your browser. [Clear saved data]".

**Meta:** `<title>Jima Motion — Free animated post maker. No account, no watermark.</title>`;
OG image 1200×630 = engine-rendered T01 frame, so links shared in chats with friends look great.
No SEO work — no sitemap, JSON-LD, or programmatic pages (ADR-011, personal deployment).

## 7. Jima Studio UX specification (route `/studio`)

### 7.1 Gallery view (Studio home)
- "Pick a template" + a **sticky toolbar**: concept/synonym-aware search (Esc clears) + a horizontal
  row of **use-case group chips with live counts** (All · Text & titles · Overlays & lower-thirds ·
  Social · Product & ads · Showcase · Explainers & data · Brand & quotes · Openers & backgrounds ·
  Events & travel) + a result count — filtering **one uniform grid** (no stacked sections).
- Below the title, a row of **facet chips** in four groups — Favourites · length (Under 4s ·
  Over 4.5s) · shape (Vertical · Square/4:5 · Widescreen) · content (Takes a photo · Takes a list ·
  Alpha-safe · Lots to tweak). They intersect with each other, with the group rail and with the
  search box. Each carries the count it *would* leave (computed against the other active filters);
  a chip that would empty the grid is disabled rather than a dead end. Every facet is derived from
  the template definition, so the filters cannot drift from the library.
- Card: a **uniform 16:9 poster** (engine-rendered at `posterTime`, lazy via IntersectionObserver),
  name, tagline, category chip, and a **favourite star** (top-left; visible on hover, always on
  touch, `localStorage` only). **Hover/focus plays the default animation live** (a short-lived
  `LivePreview` runner — at most one live WebGL context at a time; `prefers-reduced-motion` → static
  poster). Click → editor.
- If a saved project exists: top banner "Continue where you left off — *Kinetic Headline*, edited
  2 h ago. [Resume] [Start fresh]".

### 7.2 Editor layout (desktop ≥ 1024 px) — three zones
```
┌────────────────────────────────────────────────────────────────────┐
│ Topbar: [← Templates] [✦] Template name · aspect switcher          │
│         (1:1 · 4:5 · 9:16 · 16:9)      [undo/redo]  [Export ▸]     │
├──────────┬─────────────────────────────────┬───────────────────────┤
│ Template │        Preview canvas           │ Inspector (360 px)    │
│ rail     │  (letterboxed on porcelain,     │ ┌ Tabs ─────────────┐ │
│ (72 px,  │   white artboard, soft shadow,  │ │ Content│Style│Motion││
│ icon     │   safe-zone toggle on 9:16)     │ └───────────────────┘ │
│ posters, │                                 │ · text fields         │
│ current  │  ▶ ⏸  ────●────────  0:02.4/4.0 │ · image dropzones     │
│ high-    │  loop ⟳ · restart ⟲             │ · palette swatches    │
│ lighted) │                                 │ · colors, font role   │
│          │                                 │ · speed slider        │
│          │                                 │ · template options    │
│          │                                 │ [Reset template]      │
└──────────┴─────────────────────────────────┴───────────────────────┘
```
- **Content tab:** the template's text/textlist/image fields in author-defined order. Text inputs
  update the canvas live per keystroke (< 50 ms apply budget). Image dropzones: drag-drop/click,
  thumbnail, replace/remove; helper "Images never leave your browser."
- **Style tab:** palette presets (4+ swatch rows, one-click), then individual color pickers, font
  role select where the template allows.
- **Motion tab:** speed slider (0.5–2×, live), template-specific selects/toggles/sliders,
  computed-duration readout for T05/T11, loop toggle where `loopable`.
- **Playback:** autoplays looping on open (unless reduced-motion); scrubbing pauses; keyboard:
  `Space` play/pause · `←/→` frame step (`Shift` = 1 s) · `Home` restart · `⌘/Ctrl+Z / +Shift+Z`
  undo/redo · `⌘/Ctrl+E` export · `Esc` closes modals.
- **Template switching** keeps field values where keys match (headline stays when hopping between
  T01/T02); a toast offers undo after switch.

### 7.3 Export modal (the make-or-break flow — three states)
1. **Configure:** format cards **MP4 · WebM · GIF** — enabled per capability detection, each with
   a one-line sublabel ("Best for Instagram & TikTok" / "Smallest video" / "Loops anywhere,
   ≤ 10 s"). Disabled cards say *why* + what to do ("MP4 isn't available in Firefox yet — WebM
   plays everywhere Firefox does, or grab the GIF"). Options per format: resolution
   (1080p default / 720p), fps (30 / 60 video; 15 / 12 GIF), GIF size (480p default / 720p).
   Estimated file size + duration shown. Primary: **Export** (ink-on-ember).
2. **Rendering:** determinate progress bar (aria-live), frame counter "148 / 240 · faster than
   realtime", spark spinning in topbar, **Cancel** always visible and instant. UI behind modal
   inert. Never a spinner-with-no-numbers.
3. **Done:** inline looping preview of the artifact, filename `jima-kinetic-headline-1080x1080.mp4`,
   big **Download** (auto-triggered once, button for re-download), "Make another aspect" shortcut
   re-opens configure with the next aspect preselected, small celebratory burst (engine-rendered,
   reduced-motion-aware). Failure → apologetic plain-language error + automatic suggestion of the
   next tier ("MP4 hit a snag on this device — WebM is ready to go instead") — never a dead end.

### 7.4 States, edge cases, mobile
- **Autosave** indicator in topbar ("Saved in this browser · just now"); restore prompt on return;
  Reset template per § 7.2; global "Clear all my data" in Studio footer.
- **Unsupported browser floor:** full-screen friendly card (copy § 9.4), never a broken editor.
- **Mobile/tablet (< 1024 px):** gallery fully usable; editor stacks Preview (top, sticky) over
  tabbed Inspector; template rail becomes a horizontal strip; export supported where the platform
  allows (iOS Safari 16.4+ = MP4 ✓; Firefox Android → GIF path with honest note). A dismissible
  hint: "The Studio is comfiest on a desktop — but everything works here too." Never block mobile.
- **Empty required image** (T06): canvas shows designed placeholder + inspector nudge, export
  allowed (placeholder renders) with a gentle confirm.

## 8. Accessibility (WCAG 2.2 AA commitments)

- Full keyboard operability incl. a complete export run; visible focus (2 px ember-text ring,
  2 px offset); skip-to-content on landing.
- Forms: real `<label>`s, grouped fieldsets, error text tied via `aria-describedby`.
- Canvas previews: `role="img"` + template-aware `aria-label` ("Animated preview: Kinetic
  Headline with your text 'Say it with motion'"); playback state announced; progress via
  `aria-live="polite"`.
- Contrast per § 2 rules; text over template artwork always on scrim ≥ 4.5:1 (template QA gate).
- All autoplaying motion pausable; reduced-motion behavior per § 5; no flashing > 3 Hz anywhere
  (template QA gate).
- Touch targets ≥ 44 px; hover-only affordances always have focus/tap equivalents.

## 9. Copy deck (canonical strings — keep this exact tone)

### 9.1 Hero
- **H1:** "Motion graphics for social media. **In seconds.**"
- Sub: "Pick a template, type your words, drop in your images — export an MP4 or GIF. 100 % free,
  no account, no watermark. Nothing you make ever leaves your browser."
- CTAs: "Open the Studio" · "Browse templates". Chips: "100 % free" · "No account" ·
  "No watermark" · "Private by design".

### 9.2 Why-free section
- H2: "Free forever. Here's why that's not a trick."
- Body: "Video tools charge because rendering on their servers costs them money. Jima renders on
  your device instead — instant previews, no upload, no queue, no server bill. There's nothing to
  charge you for, so we don't. No account, no watermark, no 'Pro' button hiding anywhere."

### 9.3 FAQ
1. *Is it really 100 % free? What's the catch?* — Yes, and there isn't one… (renders-on-your-device
   explanation; no account, no watermark, no upsell).
2. *Do I need an account?* — No. There's no login to create — the Studio just opens.
3. *Can I use the videos commercially?* — Yes. Everything you export is yours, for any use.
   Templates and fonts are licensed for it.
4. *Where are my text and images stored?* — Only in your browser (autosave). We never receive
   them; there's no server that could.
5. *What can I export?* — MP4 or WebM video and GIF, up to 1080p / 60 fps, in 1:1, 4:5, 9:16 and
   16:9.
6. *Which browsers work best?* — Chrome, Edge and Safari 16.4+ do everything; Firefox exports WebM
   and GIF today. GIF works everywhere.
7. *How is this different from Canva or Jitter?* — They're bigger tools with accounts, watermarks
   or paid tiers on the way to a clean export. Jima does one job — animated posts from templates —
   with zero friction.
8. *Can I request a template?* — Yes — new templates ship regularly; request via GitHub/feedback
   link.

### 9.4 Capability & error microcopy (honesty rules: name the limitation, give the path)
- Firefox: "Firefox can't export MP4 here yet — WebM and GIF are ready, same quality."
- Below floor: "Your browser can't run the Studio (it needs WebGL2). It works great in current
  Chrome, Edge, Firefox or Safari — here's a link to copy."
- Export failure: "That export hit a snag on this device. Your work is safe. Try [WebM] — or make
  the video 720p and try again."
- Private-mode/no storage: "Heads up: this browser won't remember your work after you close the
  tab. Exporting still works fine."

## 10. Asset production checklist (Phase 5 exit)

- Logo SVG (wordmark, spark, lockup) + favicon set (32/180/512, `.ico`) + maskable icon.
- OG image: home (1200×630), engine-rendered in CI (per-template versions optional).
- Template posters ×12 ×4 aspects (engine-rendered in CI — never hand-exported).
- Hero shader ramp swatches; 404 page (spark looking around — engine-rendered, reduced-motion
  static); `humans.txt` credit line; per-font OFL license files shipped in `public/fonts/`.

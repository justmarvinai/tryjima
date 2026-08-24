# Jima Design Language — v2

Modern light-mode **tech-startup SaaS**. The reference class is Captions.ai / Mojo / OpusClip: crisp white, near-black ink, one vivid accent family, pill buttons, floating cards, soft layered shadows, and smooth GPU-only motion. Confident and product-led — the captioned phone mock *is* the brand.

## Feel

White space + high contrast + one signature gradient. Surfaces float (cards on a soft gray canvas) instead of being divided by hard borders. Everything interactive is a pill or a rounded card that lifts slightly on hover. Motion is constant but quiet: entrances stagger, the hero device floats and tilts, sections reveal on scroll.

## Tokens (`src/styles/tokens.css`)

- **Surfaces**: page `#FFFFFF`; editor app canvas `#F6F7F9`; cards `#FFFFFF`; nested chips `#F3F4F7`; border `#E9EBF0`.
- **Ink**: `#0B0C0F`; secondary `#62687A`.
- **Accent**: vivid indigo `#6E56F8` (hover `#5A45E6`; soft tint `#EFECFE`).
- **Signature gradient**: `135deg, #6E56F8 → #B84DF7 → #FF6B4A` (indigo → violet → coral). Used for: the logo tile, gradient headline words, the highest-value CTA, progress bars, glows. Never for body text.
- **Semantic**: success `#179955`, error `#E5484D`.
- **Radii**: controls 12px, cards 20px (hero surfaces up to 28–34px), buttons **fully pill**.
- **Shadows**: three layers — `subtle` (resting cards), `card` (hover/floating chips), `pop` (hero device, modals, dark banner).
- **Type**: Display — *Space Grotesk* (tight tracking). UI — *Inter*. Timestamps — *IBM Plex Mono*. Captions — *Anton* (also used in marketing visuals).

## Components

- **Buttons** (`buttonClasses`): pill-shaped. `primary` = ink black; `gradient` = signature gradient (one per view, highest-value action); `secondary` = white + border; `ghost`. Hover: lift `-translate-y-0.5` + stronger shadow.
- **Wordmark**: gradient rounded-square "J" tile + "Jima".
- **Segmented controls**: gray track (`surface-2`), active option = white pill + subtle shadow.
- **Sliders**: custom range styling — 5px track, white thumb with accent ring, grows on hover.
- **Chips**: rounded-full `surface-2` with 12–13px medium text.

## Landing hero variants

The hero is swappable via `ACTIVE_HERO` in **`src/config/release.ts`**:

- **`default`** (`heroes/DefaultHero.tsx`): the evergreen product hero — phone mock, floating chips.
- **`update`** (`heroes/UpdateHero.tsx`): the release-announcement hero — a raw-WebGL "brand aurora" shader (domain-warped fbm noise flowing through the signature gradient over ink, pointer-reactive, DPR-capped; static frame under reduced motion, CSS-gradient fallback without WebGL) behind a dark glass composition: "New · Jima x.y" badge, gradient headline, and a live looping demo of the release feature. Release copy lives in `RELEASE` in the same config file.

Workflow: ship a major version → edit `RELEASE`, set `ACTIVE_HERO = 'update'`; after the release window → flip back to `'default'`.

## Landing (`/`)

1. **Floating glass nav**: fixed, pill-shaped, `bg-white/75 backdrop-blur`, wordmark left, ghost "How it works" + black pill CTA right.
2. **Hero** (centered): badge pill ("100% on-device AI · Free") → display headline with the last line in gradient → one-sentence sub → gradient CTA + secondary → mono trust line ("English & German · No account · No uploads").
3. **Hero visual**: white-bezel phone mock with animated karaoke captions (gold active word), pulsing gradient glow behind, pointer tilt + float, and three floating glass chips (style swatches, word-timing chip, "Exported · Full quality" badge).
4. **Bento grid** (4 cards): word-perfect timing (inline karaoke demo), make it yours (style swatches), private by design ("0 uploads" stat with gradient), full-quality export (chip row). Cards lift on hover.
5. **How it works**: 3 cards with gradient number pills. Copy unchanged from v1.
6. **Privacy banner**: dark ink rounded-[28px] card with a gradient glow bleeding from the top, white headline, gradient CTA.
7. **Footer**: one mono line each side.

All entrances: staggered `fade-up`; below the fold: `Reveal` (IntersectionObserver). Everything respects `prefers-reduced-motion`.

## Editor (`/app`)

A **floating-card workspace**: `bg-app` canvas with 12px padding and 12px gaps; every zone is a white rounded-2xl card with a hairline border + subtle shadow (no full-bleed panel borders).

- **Top bar** (card): wordmark · filename chip (mono, pill) — right: ghost Replace, language pill, **gradient Export pill**.
- **Left card — Transcript**: semibold header with undo/redo icon buttons; cue rows are rounded cards with pill timestamp chips; the active cue gets `border-accent` left bar + `accent-soft` fill; hover reveals split/merge/delete and ±0.1s nudge steppers.
- **Center card — Stage**: video in a rounded-[22px] frame with `shadow-pop`; transport is a **floating pill bar** (ink play button, custom scrubber, mono time).
- **Right card — Style**: grouped sections as soft `surface-2` inset cards (Font / Colors / Background / Layout); white controls sit on the gray insets; accent toggles; color swatches with white ring.
- **Dropzone** (empty state): dashed rounded card, gradient icon tile that scales on hover/drag, "Processed 100% on your device" chip.
- **Export dialog**: rounded-[24px] card over a blurred ink scrim, gradient progress bar and gradient Download.

## Copy Voice

Unchanged: short, direct, a little playful. "Analyzing your audio — locally, promise." Never corporate, never breathless.

# Jima design system — "Nocturne"

The single visual language for the whole product: the landing page, Jima
Captions and Jima Motion. It replaced two separate systems in v2.0 — Motion's
white/emerald/Parkinsans and Captions' white/indigo-gradient/Space-Grotesk —
neither of which survives anywhere.

Implemented in `apps/web/src/styles/index.css`. That file is the source of
truth; this document explains the reasoning.

---

## 1. The idea

**Dark shell, light canvas.**

Every piece of chrome — nav, panels, rails, inspectors, modals, cards — is
near-black. The only bright things on screen are:

1. **the user's own work** — the video stage in Captions, the artboard in
   Motion, a poster thumbnail in the gallery; and
2. **one electric-lime accent**, used sparingly.

That is the whole system. It is why an editor built on it reads as an
instrument rather than a document, and it is why the two tools feel like one
product: they share a ground, and the thing that changes between them is what
you are working on.

The corollary is a rule: **never make chrome bright to draw attention.** If
something needs emphasis, it gets the accent, a hairline, or elevation — not a
lighter fill. On near-black, a "raised white card" has nowhere left to go.

---

## 2. Colour

### Base — the dark shell

| Token | Value | Use |
|---|---|---|
| `--color-void` | `#08090B` | page background, the deepest ground |
| `--color-shell` | `#0B0D10` | app chrome background (rails, inspectors) |
| `--color-surface` | `#111419` | panels, cards |
| `--color-surface-2` | `#171B21` | raised: inputs, hover fills |
| `--color-surface-3` | `#1E232B` | pressed / selected fills |
| `--color-line` | `#262B33` | hairline borders |
| `--color-line-2` | `#343B45` | stronger dividers on raised surfaces |

Neutral, with a couple of points of blue so lime reads warm against it.

> **Naming trap, learned the hard way.** This token was originally
> `--color-base`, which silently hijacked Tailwind's built-in `text-base`
> font-size utility: every `text-base` in the app resolved to
> `color: #0B0D10` — near-black text on a near-black panel. Never name a colour
> token after a utility that already exists in another Tailwind namespace
> (`text-*` sizes, `leading-*`, `tracking-*`).

### Text on dark

| Token | Value | Contrast on `surface-3` | Use |
|---|---|---|---|
| `--color-chalk` | `#F2F3F5` | 13.9:1 | primary text, headings |
| `--color-silver` | `#C2C6CE` | 8.9:1 | strong body |
| `--color-ash` | `#9AA0AA` | 6.0:1 | secondary body |
| `--color-dim` | `#888E9A` | 4.8:1 | tertiary, placeholders, captions |

Every value is checked against `--color-surface-3` (`#1E232B`) — the *lightest*
surface it can land on — not against the page ground. A value that clears
4.5:1 on near-black can still fail on a raised panel, which is exactly the bug
the a11y suite caught during the merge.

`dim` is the floor. Nothing below it carries body copy.

### The accent

| Token | Value | Use |
|---|---|---|
| `--color-lime` | `#C8FF3D` | THE accent — fills, active states, focus |
| `--color-lime-bright` | `#DEFF8C` | hover |
| `--color-lime-deep` | `#A5DB1E` | pressed |
| `--color-lime-dim` | `#86B016` | lime on a *light* canvas (4.6:1 on white) |
| `--color-lime-tint` | `#1A2410` | dark tinted accent surface |

Lime is 16.7:1 on void — it needs no help standing out, so it is used *once* per
region, never as a background for large areas outside the one closing CTA band.

**A lime fill always takes a `--color-void` label.** White on `#C8FF3D` is
1.06:1 — a total failure — and it is the single easiest mistake to make in this
system. `Button`'s `primary` variant and the `text-on-lime` utility both encode
the rule so no call site has to remember it.

### Light canvas

| Token | Value | Use |
|---|---|---|
| `--color-artboard` | `#FFFFFF` | the Motion artboard, a video stage |
| `--color-artboard-2` | `#F4F4F5` | secondary light surface |

Deliberately **not** called `paper`: Motion's own vocabulary already uses
`paper` for a card surface in ~30 places, and pointing that name at white turned
every Studio card white with chalk text on it.

### Supporting hues

`violet`, `cyan`, `amber`, `coral`, `mint`, `pink`, `indigo`, each with a `-tint`
dark surface variant. **Decorative only** — category dots, tags, illustration.
They never compete with lime for "this is the action".

### Semantic

`success` `#7BE38B` · `warning` `#FBBF24` · `error` `#FF6B6B`, each with a
`-tint` dark surface.

---

## 3. Typography

| Role | Family | Notes |
|---|---|---|
| Display | **Archivo Variable** | `font-stretch: 108–112%`, weight 700–800. Wide and heavy is the brand's signature. |
| UI | **Geist Variable** | Neutral and crisp at 12–16px on dark, where a quirkier face turns to mush. |
| Numerals | **Geist Mono Variable** | Timecodes, durations, dimensions, bitrates, counts. |

All three are self-hosted (`@fontsource-variable/*`). Nothing is fetched from a
font CDN — that would hand a third party the visitor's IP on every page load,
which is exactly what this product promises not to do.

None of the predecessor faces (Parkinsans, Space Grotesk, Inter) drive chrome
any more. They remain available to **users** as template and caption fonts,
which is a different job — see § 6.

`.headline-xl` is the oversized hero/section treatment: Archivo at width 112%,
weight 800, `-0.035em` tracking, `0.94` line-height.

---

## 4. Shape and elevation

Radii: `--radius-input` 10px · `card` 14px · `panel` 18px · `modal` 22px ·
`bento` 28px (the oversized landing tile).

On near-black a drop shadow barely reads, so depth comes from **a light
hairline on top plus a deep, wide shadow underneath**:

- `--shadow-card` — inset top highlight + soft drop
- `--shadow-pop` — a 1px light ring + a deep shadow, for modals and hovers
- `--shadow-glow` — reserved for the accent (focused / active / primary)
- `--shadow-stage` — a *real* drop shadow, used only under the light artboard,
  where the surface genuinely is lighter than its ground

---

## 5. Cascade and layers

Tailwind 4 declares `@layer theme, base, components, utilities`, and **an
unlayered rule beats every layered one regardless of specificity.**

Consequences, both of which bit during the merge:

- Element defaults (`html`, `body`, `button`, `input`, form controls,
  scrollbars) live in `@layer base`. Written unlayered, `button { color:
  inherit }` silently defeated every `text-*` utility on every button in the
  app.
- Component classes (`.reveal`, `.marker-hl`) live in `@layer components`, so a
  utility on the same element still wins.
- `@utility` blocks are placed in the utilities layer by Tailwind itself.
- The `prefers-reduced-motion` overrides stay unlayered *and* `!important` — on
  purpose. Reduced motion must beat everything.

---

## 6. Legacy token aliases

Jima Motion's v2 token names (`paper`, `porcelain`, `canvas`, `subtle`, `mist`,
`ink`, `graphite`, `slate`, `muted`, `emerald*`, `primary*`, `ember*`) are
aliased at the bottom of `@theme` onto the dark values. That is what let ~700
existing utility usages across the Studio restyle from one place instead of one
file at a time.

They are a migration aid, not a vocabulary. **New code uses the names in § 2.**

Anywhere the alias would have been semantically wrong the call site was fixed by
hand: a `text-white` label on what is now a lime fill, a `bg-ink/55` scrim that
is now light (those moved to `--color-scrim`).

---

## 7. Shared components

`apps/web/src/ui/` is the one kit, used by the landing and both tools:

- `Button` / `IconButton` / `buttonClasses` — variants `primary` (lime),
  `chalk`, `secondary`, `ghost`, `danger`
- `controls.tsx` — `Field`, `TextInput`, `TextArea`, `Select`, `Segmented`,
  `Slider`, `Switch`, `Toggle`, `ColorField`
- `layout.tsx` — `Container`, `Card`, `Panel`, `BentoCard`, `Badge`,
  `SectionHeading`, `Marker`, `MockupFrame`, `EmptyState`, `Kbd`
- `feedback.tsx` — `ProgressBar`, `Spinner`, `RouteFallback`, `Notice`
- `icons.tsx` — one stroke weight (1.75), one 24-grid, round caps
- `JimaLogo.tsx` — `JimaLogo`, `JimaMark`, `Wordmark`, `ProductLockup`

Import from `@/ui`, never from the individual files.

`apps/web/src/shell/` holds the chrome: `SiteHeader`, `SiteFooter`, `PageShell`,
`ToolBar` (the 52px bar both editors share), `ProductSwitcher`,
`CommandPalette`, `CapabilityFloor`, `RootBoundary`. `SiteHeader` takes an
optional `banner` — a slim strip above the nav row that collapses on the first
scroll. Only the landing passes one.

---

## 7a. The landing stage

The landing does not use the flat `bg-void` the app chrome uses, and it is not
built from the two-column hero / feature-card-grid / stat-card vocabulary the
rest of the category shares. Its own language, in `apps/web/src/landing/`:

**Ground** (`stage/StageGround.tsx`). Three layers, in order: `painted-dark`
(void plus three very low accent washes, drifting on `aurora-drift`), a waveform
drawn 72 bars wide across the bottom with the part behind the playhead lit lime,
and `brush-grain` over the top. The grain has to be above the waveform or the
bars read as printed onto a clean surface rather than being part of it. The
whole thing is bounded by the stage box — it must not run behind the template
rail, where 72 bars at full strength fight a dozen bright poster frames.

**Depth** (`stage/useStageParallax.ts`). The stage publishes `--px`/`--py`
(pointer, −0.5…0.5) and `--sy` (its own scroll progress, 0…1) as custom
properties on one element. Layers pick their own depth in plain CSS —
`translate3d(calc(var(--px) * 30px), …)`. Deliberately not React state: a dozen
layers reading a state variable would re-render the hero on every pointer move.

**Interleaving** (`stage/Fragments.tsx`). Pieces of the two tools — a transcript
cue, an aspect card — float at declared depths, and at least one of them passes
in *front* of both the headline (z-10) and the device (z-20). A layer that
crosses two other layers is what turns a background into a space; without it the
composition is just a screenshot beside some text.

**The headline** (`stage/CaptionedHeadline.tsx`) is a caption line, with a
draggable transport under it. Two separate timelines: a one-shot entrance
(`word-in`, staggered, never resting at a partial opacity — a half-faded
headline is a contrast failure, and axe evaluates whatever state it samples) and
the highlight, which either auto-plays once or follows the scrubber.

Type at this scale uses `headline-mega` (118% width, −0.045em, 0.86 line-height)
rather than `headline-xl`; `headline-xl`'s tracking opens up too far past ~5rem.

---

## 8. Accessibility

- Every text token clears 4.5:1 on the lightest surface it can land on (§ 2).
- Focus is a 2px lime outline at 2px offset, which clears 3:1 against every
  surface token.
- `tests/a11y.spec.ts` runs axe-core over the landing, both tools and every
  content page, at WCAG 2.1 A/AA. Zero serious or critical violations is the
  gate, and it is not advisory — three real bugs in this document were found by
  it rather than by eye.
- Motion is honoured: `prefers-reduced-motion` disables reveals, floats,
  marquees and live template previews (a reduced-motion visitor sees poster
  frames, and no WebGL context is created at all).

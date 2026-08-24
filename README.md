# Jima Motion ✦

**Motion graphics for social media — in seconds. 100 % free, no account, no watermark, and nothing
you make ever leaves your browser.**

Jima Motion is a browser tool for social media managers: open the **Studio**, pick a motion
template, type your own text, drop in your images, tweak colors and speed if you like, and export
an MP4, WebM or GIF — up to 1080p. Every frame is rendered client-side on your own device, which is
exactly why it can be free: there are no render servers, no accounts, and no paid tier, because
there is nothing to meter.

> **Status: v1.0 shipped** ✅ — the full Studio, **249 templates**, client-side MP4/WebM/GIF export,
> and a modern light-mode SaaS landing page are all built and passing tests. See the
> [changelog](CHANGELOG.md) and [roadmap](ROADMAP.md).
>
> **Scope:** a personal project — built to the quality bar of a real Jitter/Ccleaf competitor,
> but deployed privately on Vercel for the owner, friends and family. No public launch, no SEO.

## Why it exists

Every mainstream option taxes the user before a clean export: watermarked free tiers (VEED,
Kapwing, Jitter…), HD paywalls, signup walls, server render queues with cooldowns and monthly
download quotas (Ccleaf), or $10–110/month subscriptions. Client-side rendering deletes the cost
that those paywalls exist to recover. Full evidence: [COMPETITOR_RESEARCH.md](COMPETITOR_RESEARCH.md).

## The v1 experience

Landing page → **Open the Studio** → choose one of **249 templates** (announcements, promos,
social-engagement moments, 20 smooth kinetic-text animations, explainers & timelines, product
showcases & ads, pricing cards, device mockups, countdowns, travel cards…) → edit
text/images/colors in a simple form, **pick a font**, tweak speed — no timeline, no keyframes →
export MP4/WebM/GIF in 1:1, 4:5, 9:16 or 16:9.

Principles: free means free · defaults are the product · form fields, not timelines · nothing
leaves the device · fast is a feature · true light-mode, modern-SaaS design in Parkinsans + emerald ([design](DESIGN_ARCHITECTURE.md)).

## How to use it (send this with the link)

1. **Open the link** in a modern browser — Chrome, Edge, Safari or Firefox — on desktop or phone.
   Nothing to install, no sign-up, no email. It just opens.
2. **Click "Open the Studio"** and pick a template from the gallery. With 445 to choose from, the
   filter chips narrow it fast — by length, by shape (vertical, square, widescreen), or by what a
   template takes (a photo, a list, a transparent background). Star the ones you like and they
   come back under **Favourites**, saved in your browser.
3. **Type your words** into the form on the right, and drop in an image if the template uses one.
   In the **Style** tab, pick a palette or set the background/text/object colors individually, and
   choose a **font** for the headline; nudge the speed in **Motion**. The preview updates live.
4. **Choose an aspect ratio** (1:1 for feed, 4:5 for portrait, 9:16 for Stories/Reels/TikTok, 16:9
   for YouTube/landscape) — one project exports to any of them.
5. **Hit Export**, pick MP4, WebM or GIF, and the file renders on your own device and downloads.
   Post it.

Good to know: your text and images **never leave your browser** — there's no server and no upload.
Work autosaves in that browser, so closing the tab won't lose it (use **Clear saved data** in the
footer to wipe it). MP4 needs a browser with an H.264 encoder; where that's missing, the Studio
quietly offers WebM + GIF instead, which play everywhere. There's no watermark, ever.

## Running it yourself

Requires Node ≥ 20.11 and pnpm 10.

```bash
pnpm install      # once
pnpm dev          # local dev server (landing + Studio)
pnpm build        # production build → apps/web/dist  (the only deployable)
pnpm check        # typecheck · lint · unit tests · build  (the pre-push gate)
pnpm test:golden  # Playwright golden-frame + export-smoke + a11y tests (real browser)
```

Deploy is a static build on **Vercel** (Root Directory `apps/web`); every push to the default
branch ships. See [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) for the full stack.

## Documentation

| Doc | What's in it |
|---|---|
| [PRODUCT_BRIEF.md](PRODUCT_BRIEF.md) | Vision, audience, positioning, scope & non-goals |
| [COMPETITOR_RESEARCH.md](COMPETITOR_RESEARCH.md) | Deep research: Jitter, Ccleaf, the wider market, SEO gaps |
| [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) | Stack & ADRs: Vite + React SPA, PixiJS v8 engine, WebCodecs + Mediabunny export, budgets |
| [DESIGN_ARCHITECTURE.md](DESIGN_ARCHITECTURE.md) | Brand system, tokens, landing & Studio UX specs, copy deck |
| [TEMPLATE_LIBRARY.md](TEMPLATE_LIBRARY.md) | The 12 launch templates, spec'd storyboard-level |
| [ROADMAP.md](ROADMAP.md) | Phases 0–6 with acceptance criteria, risks, status |
| [CLAUDE.md](CLAUDE.md) | Working agreement & guardrails for (AI-assisted) development |
| [CHANGELOG.md](CHANGELOG.md) | Keep-a-Changelog record |

## License

Code license: TBD by the project owner (private personal project).
Bundled fonts will be OFL-1.1; dependency license policy is defined in
[TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) § 3.1.

# Jima Motion — Competitor & Market Research

**Research date:** 2026-07-21. Compiled from four parallel research passes (Jitter teardown, Ccleaf
teardown, market landscape, technical verification). Facts below come from vendor pages, help
centers, changelogs, review platforms (G2, Trustpilot, Product Hunt, Capterra), and traffic/company
trackers, via search-indexed content; direct page fetches were partially blocked in the research
environment, so items that could not be confirmed against live pages are marked *(unverified)*.
Pricing changes frequently — treat numbers as 2026-07 snapshots.

This document is the evidence base for `PRODUCT_BRIEF.md` (positioning), `TECHNICAL_ARCHITECTURE.md`
(stack), `DESIGN_ARCHITECTURE.md` (landing/UX) and `TEMPLATE_LIBRARY.md` (category coverage).

---

## 1. Jitter (jitter.video) — the category leader

**What it is.** "A fast and simple motion design tool on the web" — browser motion design with an
event-based timeline, repeatedly described as "Figma for motion". Founded 2020 (YC W20, Paris) by
Sébastien Robaszkiewicz and Étienne Albert (originally "Snack This"); ~24 people and ~$3.6M revenue
in 2024 (GetLatka estimate); ~1.3M site visits/month (Semrush, late 2025). Still independent.

**Who it targets.** Product/brand **design teams** — case studies are Ramp, Perplexity, Deliveroo.
The 2025–26 roadmap (all-new Figma plugins incl. Buzz/Draw, components, UI-motion template
collections, credit-metered AI) chases designers, not social media managers. The Figma plugin has
300K+ users and is a genuine moat.

**Editor model.** Deliberately **not keyframes**: named animation blocks ("Slide in", "Fade out")
attached per layer on a timeline, In/Out presets (move/fade/scale/mask/blur), custom easing curves,
infinite canvas, components, animated counters. 120 s max scene duration. Reviewers consistently
call it "minutes to learn" — "more advanced than Canva animation but simpler and quicker than
After Effects" (G2).

**Templates.** 300+ templates plus community templates; category pages include Social media, Text,
Icons, Logos, Brand, Buttons, Ads, UI elements, Websites, Video titles. Monthly named "collections"
(The Stack, The Prompt, The Click…) create recurring launch/SEO moments. Library skews toward
UI/product motion.

**Free tier & pricing.** Editor can be tried without an account, but **saving requires signup**;
free exports carry a **watermark** and cap at **720p/30fps** with 3 workspace files. Pro
(~$16–19/mo) unlocks 1080p/60fps + watermark removal; Max adds 4K/120fps, transparent
WebM/MOV/GIF, ProRes, PNG sequences; Ultra is an AI-credit tier; Enterprise custom. Formats across
plans: MP4, MOV, WebM, GIF, Lottie (+ APNG/PNG-seq/ProRes paid).

**Key architectural intel.** Jitter's own help center: export runs **"primarily in the browser"**;
only transparent/ProRes formats render on their servers. Browser/OS/memory variability is their
documented export failure mode. → Client-side MP4/GIF rendering is *proven at market-leader scale*.

**Landing page.** Full redesign April 2025 by Antinomy Studio, built in **React + GSAP**, all
micro-interactions designed in Jitter itself and exported as Lottie — the site demos the product.
Signature: a large horizontal-scroll template showcase. Awwwards Site of the Day (7.61).

**Loved / complained.** Loved: ease, speed, templates, Figma import (PH launch #2 of the day,
1,800+ upvotes). Complaints: watermark + free caps, "limited export options in the free version",
occasional glitches, depth ceiling for advanced users.

## 2. Ccleaf (ccleaf.com) — the template-library subscription

**What it is.** Premium browser-based motion-graphics **template customizer** ("ccLeaf Limited
Partnership", New Jersey). "The #1 Animation Editor for Creators — trusted by 31K+ users, powering
1B+ views" *(their claim; numbers have inflated inconsistently over time)*. v3 relaunch Aug 2024;
**v4 full rebuild Feb–Mar 2026**. Explicitly anti-AI positioning ("no guessing, regenerating"),
anti-hiring ("animators cost $1K+, ccLeaf starts at $21").

**Who it targets.** YouTubers, streamers, editors — strongest niche is **gaming creators
(Minecraft/Roblox/eSports)**. It produces *clips with transparent backgrounds + pre-synced sound
effects* that creators drop into Premiere/Resolve/CapCut timelines — an asset generator feeding
other editors, **not** a social-post maker. Social media managers are not its center of gravity.

**Editor model (validates ours).** Pure **form-based editing**: "no keyframes, no timelines, no
technical knowledge required." Pick animation → edit text/colors/images/timing values → live
preview → server render → download. Presets are savable and shareable via codes (plan-capped
90/1,500/unlimited). Editor themes/cursors as gamified plan perks. No AI features.

**Templates.** 500+ hand-crafted animations, gated by plan (100+/200+/all); categories: Gaming,
Basics, Insights, Challenges; functional types: pop-ups & reveals, stat/counter/timer overlays,
captions, chapter screens/transitions, Discord/UI overlays, subscribe prompts, intros. Pre-synced
**sound effects are the headline quality cue** users rave about. Free adjacent asset site
(McIcons/Vault) drives goodwill. Public roadmap/changelog/suggestion board (Featurebase).

**Friction stack (their biggest weakness).**
- Account required **even for the demo**; demo exports ship **without your edits applied**.
- Watermark below paid *(watermark exact behavior unverified — demo can't export edits anyway)*.
- **Server-side rendering** → preview cooldowns of 30/15/5 s *between previews* by plan, monthly
  download quotas **40/100/150 on paid plans**, upload caps, a status page for render outages.
- Pricing: Essential **$19.88**/mo (1080p cap), Plus **$64.88**, Ultimate **$109.88**; annual −17 %.
- Refund only if zero usage within 7 days (any preview voids it).

**Export.** **MP4 and transparent MOV only — no GIF, no WebM, no Lottie.** 720p→4K (4K paid),
16–60 fps.

**Loved / complained.** Trustpilot ~4.4/5 (small n): "super easy", "high quality shots in less than
a minute", founder-led fast support. Canonical complaint: "So expensive… takes so long to process
simple changes and EVERYTHING IS PAID."

**Distribution note.** Never launched on Product Hunt; ~705 X followers; grew via YouTube tutorial
ecosystem + Discord within one niche. Credibility leaks: inconsistent trust numbers, default
"ccleaf-landing" page titles, spam-indexed URLs.

## 3. The wider market (condensed)

### 3.1 Design-suite giants
| Tool | Motion for social | Free-tier friction | Paid |
|---|---|---|---|
| **Canva** | Massive animated template galleries (16.5K "announcement" IG templates alone); Magic Animate is **Pro-only** | Account wall; premium-asset watermark grid; MP4 ≤1080p; GIF ≤10 s; ~10 renders/week *(unverified)*; server queue; reviewers report freezes on heavy designs | Pro ~$15/mo *(sources conflict $13–18)* |
| **Adobe Express** | Animated templates + per-element presets (pop/slide/wobble), "animate all" | Account; **no watermark on free** (only via premium content); shallow motion depth | Premium $9.99/mo |
| **VistaCreate** | 50K+ free templates incl. animated; best free deal among suites | Account; standard assets export clean | Pro $10–13/mo |
| **Figma Buzz** | Brand-locked marketing templates; motion mostly via… a Jitter plugin | Org-oriented; video features paid | per-seat |
| **Kittl Video** (2026) | Prompt-to-animate static designs via licensed AI models | Paid AI credits | n/a |

### 3.2 Online video editors SMMs use
| Tool | Free tier | Paid | Notes |
|---|---|---|---|
| **CapCut web** | 1080p; plain exports clean but Pro templates/effects watermark *(rules conflict across sources)* | Standard $9.99, Pro $19.99/mo | Template virality culture; brand-trust issues |
| **Kapwing** | **Watermark on all exports**, 720p, short caps | Pro ~$16/mo annual | 2.2M visits/mo from programmatic SEO tool pages |
| **VEED** | **"Made with VEED" watermark on every export**, 720p, 10-min cap | Basic $12/mo annual | ~3.5M visits/mo, ~73 % via ~250 free-tool pages — the pSEO benchmark |
| **Clipchamp** (Microsoft) | **Unlimited 1080p, no watermark** — but Microsoft account + timeline editor, generic templates | Premium $11.99/mo | The strongest free incumbent; maintains a "video editor no watermark" landing page — proof of that keyword's value |
| **FlexClip / Flixier / Typito / Motionbox / Wave.video** | 720p + watermark + export-minute quotas in varying mixes | ~$8–39/mo | Long tail of the same model |
| **InVideo (AI) / Pictory** | Prompt-to-video; watermarked/limited free | $19–120/mo | Adjacent (footage generation, not branded motion templates) |

### 3.3 Template-first, server-rendered (older generation)
- **Renderforest**: free = **360p** + watermark + ≤1 min; paid tiers still cap HD export counts.
  Trustpilot horror stories: surprise auto-renewals (236 €), buried cancellation, days-long render
  outages. The cautionary tale for server rendering + billing traps.
- **Biteable**: killed its free plan entirely (trial only) — $29/mo. **Powtoon**: free has **no MP4
  download at all**; paid Lite still capped at 5 exports/mo. **Animaker**: 3 watermarked
  downloads/mo free; paid tiers cap premium downloads. **Animoto**: 720p + watermark free.
  **PosterMyWall**: pay-per-download ($5.99/video) — interesting honesty, heavy watermark on free
  video. **Placeit**: subscription unlimited (~$90/yr).

### 3.4 Motion-native browser tools (closest technical neighbors)
- **LottieFiles Creator / Lottielab**: Lottie-centric, product/web focus; free exports watermarked
  (Lottielab) or capped (~5 exports *(unverified)*); $12–20/mo. **SVGator**: free video capped at
  1024×576 + watermark. **Rive**: interactive runtime animation for apps/games — different job;
  exports need paid. **Linearity Move**: Mac/iPad native, hunts Jitter switchers.
- **Fable (fable.app) — DEAD.** $15M Series A collaborative browser motion platform; wound down
  Oct 2024 (free tier had capped exports at 5 seconds). Lesson: pro browser motion with seat
  pricing struggled; survivors are template-first (Jitter) — or free-utility (our bet).
- **Motionity (motionity.app)** — open-source proof of concept: free, no signup, fully client-side
  browser motion editor (by Alyssa X). Proves Jima's architecture is feasible, but has no polished
  template library, dated UX, uncertain export quality, low maintenance. **Jima = Motionity's
  freedoms + Jitter's template quality + Canva's ease.**
- **Easymotion.io** (2025–26 entrant): chat-AI motion graphics, multi-aspect MP4; no free
  generation, from $10/mo — the metered-AI pattern we position against.

## 4. Synthesis

### 4.1 The universal friction stack (what every tool taxes)
1. **Watermarks on free exports** — the #1 upgrade lever at VEED, Kapwing, InVideo, Renderforest,
   Animoto, FlexClip, Flixier, Wave.video, Powtoon, Animaker, Typito, Jitter, Lottielab, SVGator,
   PosterMyWall. Clean free exports exist only behind account walls (Clipchamp/Express/VistaCreate).
2. **HD paywalls** — free tiers at 720p (many), 576p (SVGator), even 360p (Renderforest), below the
   1080p platform standard.
3. **Export quotas — including on paid plans** (Ccleaf 40–150/mo paid; Powtoon Lite 5/mo paid;
   Renderforest Lite ~5 HD/mo paid; Animaker, Typito, Flixier minute/count caps).
4. **Signup walls before export, everywhere** — forced early registration can lose >85 % of
   low-brand-trust visitors (Interaction Design Foundation).
5. **Server rendering = queues, cooldowns, outages** (Ccleaf cooldowns; Kapwing/Canva instability
   reviews; Renderforest multi-day render outages).
6. **Billing traps** (auto-renew surprises, hidden cancellation, refund-voiding rules).
7. **Template bait** — build free with premium assets, then watermark/block at export (Canva,
   CapCut).

### 4.2 The gap (verbatim conclusion)
**No mainstream tool combines: template-picker UX + real motion design + $0 + no account + no
watermark + 1080p + instant export.** The frontier points: Clipchamp (free/clean/1080p but
Microsoft account + timeline editor + weak motion templates), Jitter/Ccleaf (right product shape;
clean export *is* the paywall), Motionity (right freedoms; no templates/polish). Every competitor's
paywall largely recoups **server rendering cost** — fully client-side rendering makes marginal cost
≈ 0, which is what makes "100 % free, no watermark" sustainable where Biteable and Fable retreated.
Bonus: content never leaves the browser — a privacy claim no cloud editor can make.

**Who switches:** freelance SMMs and solo founders stuck on Canva free / CapCut watermark roulette;
drive-by searchers with "free / no watermark / no sign up" intent (VEED's 3.5M and Kapwing's 2.2M
monthly visits prove the demand — and their free pages structurally can't deliver the promise);
billing-trap refugees; designers needing a one-off logo sting without a Jitter seat.

**Honest risk:** the moat is template quality + distribution, not the tech — Canva/CapCut could
locally drop paywalls. Counters: instant zero-upload speed, zero-friction sharing, and owning the
"actually free" SERPs they can't honestly serve.

### 4.3 Demanded template categories → Jima coverage (v1 = `TEMPLATE_LIBRARY.md`)
| Market category (evidence-ranked) | Jima v1 template |
|---|---|
| Announcement / launch | T01 Kinetic Headline (+T02) |
| Sale / promo / discount | T03 Glow Promo |
| Countdown / date tease | T10 Save the Date |
| Quote / motivational | T08 Quote Spotlight (also = testimonial) |
| Logo sting / intro-outro | T09 Logo Sting |
| Tips list / educational | T11 Tips Stack |
| Stat / data callout | T07 Big Number |
| Testimonial / UGC | T08 Quote Spotlight |
| Event promo / invitation | T10 Save the Date |
| Product showcase / drop | T04 Product Pop |
| Before/after transformation | T12 Split Duo |
| Kinetic text / titles | T01 / T02 / T05 Typewriter |
| Photo story | T06 Ken Burns Story |
| Poll / engagement prompt | ⏭ post-v1 backlog (platform stickers do the interaction) |
| Seasonal / holiday, meme/trend formats | ⏭ post-v1 drops (monthly cadence) |

12 templates cover 13 of the top 15 demanded categories.

### 4.4 Platform specs that templates must respect
- **Aspects:** 9:16 (1080×1920 — Stories/Reels/TikTok/Shorts), 4:5 (1080×1350 — preferred feed),
  1:1 (1080×1080 — cross-platform safe), 16:9 (1920×1080 — YouTube/X/LinkedIn).
- **Safe zones (9:16):** platform UI covers roughly the bottom 350–400 px and edges; keep key
  content in the center ~1080×1420. Jima standard: **keep text/logos out of the bottom 400 px and
  top 220 px on 9:16**; Studio shows an optional safe-zone overlay.
- **Durations:** Reels 7–15 s for completion (15–45 s typical), Stories 15 s segments, TikTok
  ~10–30 s sweet spot. → Jima defaults of 3.5–7 s with a 0.5–2× speed control sit in the
  high-completion zone; GIF exports ≤ 10 s.
- **Format:** MP4 H.264 30 fps is the universal accept; GIF for feed/email loops.

### 4.5 SEO keyword opportunities (volumes unverified — verify with a keyword tool later)
Flagship: `video maker free no watermark no sign up` (no incumbent can honestly deliver it).
Cluster: `animated instagram post maker`, `free video editor no watermark`, `text animation maker`,
`quote video maker`, `logo reveal maker free`, `animated social media templates`, `instagram story
maker free`, `countdown video maker`, `promo video maker free`, `sale announcement video template`,
`animated quote maker`, `gif maker`, `canva alternative for animation`, `jitter free alternative`,
`capcut template alternative no watermark`, `free motion graphics tool online`.
Playbook (proven by VEED's ~250 tool pages): one indexable, instantly-usable page per template
category × platform (e.g. `/templates/instagram-story/countdown`) — post-v1 phase in `ROADMAP.md`.

## 5. Decision log — what Jima adopts, counters, and ignores

**Adopt (validated patterns):**
- Form-based template editing, zero timelines/keyframes (Ccleaf's model, Jitter's ease reviews).
- Client-side MP4/GIF export (Jitter does it in production; Motionity/omniclip prove it OSS).
- "The website demos the product": landing animations rendered by our own engine (Jitter's
  Awwwards site lesson — without their server-side Lottie pipeline).
- Template collections cadence + per-category SEO pages (Jitter collections, VEED pSEO) — post-v1.
- Presets/shareable brand values (Ccleaf presets) — post-v1 as localStorage "brand kit".
- Public changelog + honest docs (both competitors benefit; Ccleaf's sloppiness hurts them).

**Counter-position (their structure, our weapon):**
- Every gate they charge for is free: no account (Ccleaf demands one to demo), no watermark
  (Jitter/VEED/Kapwing…), no export caps (Ccleaf paid quotas), no cooldowns (Ccleaf 5–30 s), no
  HD paywall (720p ceilings), no billing traps (Renderforest), GIF included (Ccleaf has none).
- No metered AI. Instant deterministic templates beat credit-gated generation for this job.

**Ignore (their turf, our non-goals):**
- Jitter's designer canvas, Figma plugins, collaboration, components, 4K/ProRes/Lottie pipelines.
- Ccleaf's gaming-niche SFX overlay packs and transparent-MOV NLE workflow (v1; free alpha-WebM is
  a post-v1 candidate).
- Prompt-to-video AI footage generation (Kittl/InVideo/Easymotion territory).

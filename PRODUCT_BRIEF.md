# Jima Motion — Product Brief

**One-liner:** Jima Motion turns your text and images into polished motion-graphics videos for social
media in under a minute — 100 % free, no account, no watermark, and nothing you make ever leaves
your browser.

**The product surface:** a bold, animated marketing site at the root, and **Jima Studio** — the free
editor — at `/studio`. "Jima Motion" is the brand and website; "the Studio" (Jima Studio) is what we
call the editor everywhere in UI and copy.

---

## 1. The problem

Social media managers need animated posts constantly — announcements, promos, quotes, stats,
countdowns — because motion outperforms static images in feeds. Their real options today all tax
them before they can download a single clip:

- **Motion design tools (Jitter):** superb output, but free exports are watermarked and capped at
  720p/30fps; clean 1080p starts at ~$16–19/month; saving requires an account; the editor is a
  designer-grade canvas that social managers don't need. Jitter's roadmap (Figma plugins, UI-motion
  collections, credit-metered AI) chases product-design teams, not social managers.
  (Evidence: `COMPETITOR_RESEARCH.md` § Jitter.)
- **Template animation libraries (Ccleaf):** validated "no keyframes, no timeline" form editing —
  but an account is required even to demo, demo exports ship *without your edits*, rendering is
  server-side with 5–30 s preview cooldowns, paid plans from $19.88/month still meter downloads
  (40–150/month), and there is no GIF export at all. (Evidence: `COMPETITOR_RESEARCH.md` § Ccleaf.)
- **All-in-one design suites (Canva, Adobe Express, CapCut, VEED…):** accounts, upsells, watermarks
  or paywalled HD on many features, heavyweight editors, and motion that looks like everyone else's
  presets. (Evidence: `COMPETITOR_RESEARCH.md` § Market landscape.)

The pattern across the whole market: **the friction is the business model** — signup walls,
watermarks, render-server queues, download quotas, monthly plans. A tool that renders in the user's
own browser has none of those costs, so it can genuinely delete all of that friction.

## 2. The insight that makes "free" credible

Rendering client-side is not a compromise — the market leader already proves it works: Jitter
renders MP4/GIF "primarily in the browser" and only uses servers for exotic formats. Ccleaf's every
limitation (cooldowns, quotas, paywalled rendering) exists to meter *their* server cost. Jima has no
render servers, no accounts database, no billing system: a static site plus the user's own GPU.
That is why "100 % free, forever, no catch" is an economic fact, not a promo.

## 3. Audience

**Deployment reality (owner decision, ADR-011):** Jima Motion is a personal project — the real
users are the owner plus friends and family. The personas below remain the *design lens* (build it
as a true Jitter/Ccleaf-class competitor), not a go-to-market target.

**Primary persona — "Maya", solo social media manager (SMB/agency).**
Runs 3–6 brand accounts. Needs 5–15 animated posts/stories a week. Has Canva muscle-memory, no
After Effects skills, no motion budget. Success = a post that looks custom-made, delivered in
minutes, in the right aspect ratio, with brand colors. Buys nothing without a fight with finance —
"free, no login" removes her biggest blockers: procurement and password fatigue.

**Secondary — "Ben", freelance creator/one-person brand.**
Posts reels/stories daily. Wants scroll-stopping text animations and quick logo stings. Hates
watermarks with a passion; they scream "amateur".

**Tertiary — "Ana", founder/marketer generalist.**
Ships a product-launch post or event announcement a few times a month. Zero patience for tools;
will use whatever produces something good in 60 seconds from a link someone sent her.

**Explicit non-audience for v1:** motion designers wanting keyframe control (Jitter serves them),
gaming YouTubers wanting SFX-baked overlay packs (Ccleaf serves them), video editors cutting
long-form footage (CapCut/Premiere serve them).

## 4. Jobs to be done

1. "Turn this announcement into a feed-ready animated post *right now*."
2. "Make our quarterly numbers look impressive in a story."
3. "Give this customer quote some life for LinkedIn."
4. "Produce the same promo in 1:1, 4:5 and 9:16 without redoing it."
5. "Export a GIF small enough to drop in an email/newsletter."

## 5. Positioning

> For social media managers who need scroll-stopping animated posts in minutes, **Jima Motion** is a
> free browser Studio that turns their own text and images into professionally-designed motion
> templates — unlike Jitter and Ccleaf, it needs no account, adds no watermark, has no paid tier,
> and renders everything on the user's device.

| | **Jima Motion** | Jitter (free) | Ccleaf | Canva-class suites |
|---|---|---|---|---|
| Price for clean 1080p export | **$0** | ~$16–19/mo | from $19.88/mo | freemium/upsell |
| Account required | **Never** | to save (and to escape limits) | even for the demo | yes |
| Watermark on free | **Never** | yes | yes (below paid) | on premium assets |
| Where rendering happens | **Your browser** | browser + servers | their servers (cooldowns, quotas) | their servers |
| Export limits | **None** | 720p/30fps free cap | 40–150 downloads/mo (paid!) | varies |
| GIF export | **Yes, free** | yes (watermarked, ≤720p) | **none** | limited |
| Editing model | **Form fields, no timeline at all** | event-timeline canvas | form fields | full canvas editor |
| Learning curve | **~60 seconds** | minutes–hours | minutes | minutes–hours |

**Message hierarchy** (landing page, in order):
1. *Motion graphics for social media — in seconds.*
2. *100 % free. No account. No watermark. No catch.*
3. *Private by design: your text and images never leave your browser.*
4. *Pick a template → type your text → export MP4 or GIF.*

## 6. Product principles (bind every later decision)

1. **Free means free.** No account, login, payment, watermark, quota, "pro" tier, or dark pattern.
   Anywhere. Ever. If a feature can't be free, it doesn't ship.
2. **The default is the product.** Every template must look shippable with zero edits. Settings are
   optional seasoning, never required work.
3. **Form fields, not timelines.** Users edit text, images, colors, speed. Motion intelligence is
   the template author's job, not the user's.
4. **Nothing leaves the device.** No uploads, no telemetry on user content, no render queue.
   Privacy is a headline feature, not a policy page.
5. **Fast is a feature.** Landing → first export in under 60 seconds on a mid-range laptop.
   Preview at 60 fps. Export faster than realtime where hardware allows.
6. **The website demos the engine.** Template previews on the landing page are live renders by the
   same runtime that exports the video (Jitter's site-as-demo lesson, executed with zero servers).
7. **Light, bold, confident.** Fully light/white-mode brand; motion and color carry the boldness.
   No dark mode.

## 7. v1 scope

### The user flow (canonical, from the top)
1. **Land** on jimamotion site → animated Three.js/WebGL hero, live template wall.
2. **Open the Studio** (one click, no gate).
3. **Choose a template** from the gallery (≥ 10 at launch; spec'd 12 in `TEMPLATE_LIBRARY.md`).
4. **Insert own text and/or images** via the form panel; live preview updates instantly.
5. **Optionally adjust settings**: aspect ratio (1:1, 4:5, 9:16, 16:9), colors/palette, fonts,
   speed, template-specific options.
6. **Export** as MP4 (or WebM) video or GIF → file downloads. Done.

### In scope (v1)
- Landing page: WebGL hero, live template showcase, how-it-works, features, FAQ.
- Jima Studio: template gallery, form-based editor, live canvas preview with play/pause/scrub,
  aspect switching, palette presets, speed control.
- 12 templates across the categories social managers actually post (announcement, promo, product,
  quote, stat, event, photo story, brand sting, tips, comparison, typewriter, statement).
- Client-side export: MP4 (H.264 where supported), WebM fallback, GIF. 1080p, 30/60 fps.
- Autosave of the current project to localStorage (no accounts ≠ losing work).
- Graceful capability detection with honest messaging on unsupported browsers.

### Out of scope (v1) — explicit non-goals
- Accounts, login, payments, plans, quotas, watermarks (never, per principles).
- Collaboration/multiplayer, comments, sharing workspaces (Jitter's territory; explicitly excluded).
- Timeline/keyframe editing, blank-canvas creation, custom animation authoring by users.
- Server-side rendering, uploads, URL-based project sharing (parked: post-v1 via URL-encoded state).
- Audio/music (templates are silent v1; social feeds autoplay muted).
- AI generation of any kind (the market meters it; our counter-position is instant + free).
- Mobile *editing* optimization (Studio is desktop-first; landing fully responsive; mobile Studio
  gets a friendly "best on desktop" path, not a broken one).
- Dark mode (light-only brand decision).
- Template marketplace / user-submitted templates (post-v1 candidate).
- Transparent-alpha exports (post-v1 candidate; Ccleaf's premium moat — ours would be free WebM alpha).

## 8. Success criteria (v1)

| Criterion | Target | How checked (no analytics — ADR-009) |
|---|---|---|
| Time from landing → downloaded export (first-time user) | < 60 s median | manual QA protocol |
| Export success on supported browsers | > 95 % of attempts | QA matrix runs |
| Preview frame rate on reference laptop | 60 fps sustained | perf CI + manual QA |
| Templates at v1 | ≥ 10 shipped (12 spec'd) | repo |
| Lighthouse (landing, mobile) | ≥ 90 perf / ≥ 95 a11y | CI |
| The real test | a friend/family member makes and downloads a post unaided | observed session |

There are no analytics of any kind (ADR-009); every check above is manual or CI. No user content
is ever measured — nothing exists that could measure it.

## 9. Sustainability (the "what's the catch" answer)

Static hosting + client-side rendering ≈ near-zero marginal cost per user. No render farm, no
storage, no auth infrastructure. The FAQ answers this honestly: *"It's free because it costs us
almost nothing to run — your device does the rendering. No catch, no data harvesting."* With the
personal-scope decision (ADR-011) there is nothing to sustain beyond a free Vercel project;
monetization of any kind stays a non-topic (Principle 1).

## 10. Open questions / risks (tracked in ROADMAP risk register)

- **Browser floor:** H.264-in-WebCodecs coverage varies; WebM/GIF fallbacks and honest messaging
  are specified in `TECHNICAL_ARCHITECTURE.md`.
- **"Free forever" trust:** the promise must appear with the reason (client-side rendering) or it
  reads as bait; copy guidelines in `DESIGN_ARCHITECTURE.md`.
- **Template quality bar:** 12 great beats 50 mediocre; cadence for post-launch drops in ROADMAP.

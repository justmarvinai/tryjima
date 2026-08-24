import { test, expect, type Page } from "@playwright/test";
import type { Aspect } from "@jima/engine";
import { TEMPLATE_DURATIONS } from "../packages/templates/src/durations";
import { templates } from "../packages/templates/src/index";

// Data-driven golden-frame + determinism suite over the whole template library.
// Determinism proof: pixel-exact re-seek (the timeline + update(t) are pure in
// t). Screenshot baselines guard against visual regressions.
//
// Lengths are not repeated here: they ship as data in @jima/templates/durations
// (the gallery filters on them) and this suite is what proves them true.

interface T {
  id: string;
  palette: string;
  poster: number;
}

const TEMPLATES: T[] = [
  { id: "kinetic-headline", palette: "ink-white", poster: 3.2 },
  { id: "slide-reveal", palette: "editorial-ink", poster: 2.6 },
  { id: "glow-promo", palette: "tangerine", poster: 2.2 },
  { id: "product-pop", palette: "studio-white", poster: 3.0 },
  { id: "typewriter", palette: "paper-terminal", poster: 2.2 },
  { id: "ken-burns", palette: "neutral", poster: 2.0 },
  { id: "big-number", palette: "ink", poster: 2.6 },
  { id: "quote-spotlight", palette: "paper-ink", poster: 3.5 },
  { id: "logo-sting", palette: "white-ink", poster: 1.6 },
  { id: "save-the-date", palette: "ivory", poster: 3.0 },
  { id: "tips-stack", palette: "notebook", poster: 3.6 },
  { id: "split-duo", palette: "coral-cobalt", poster: 1.8 },
  // Expansion pack (v1.1) — 23 new templates.
  { id: "icon-pop", palette: "punch", poster: 1.4 },
  { id: "subscribe-bell", palette: "light", poster: 2.4 },
  { id: "special-offer", palette: "ember", poster: 2.5 },
  { id: "kinetic-type", palette: "ink-white", poster: 2.6 },
  { id: "keynote-reveal", palette: "keynote-light", poster: 3.0 },
  { id: "word-swap", palette: "ink-ember", poster: 1.5 },
  { id: "marker-highlight", palette: "lime", poster: 2.8 },
  { id: "youtube-frame", palette: "light", poster: 2.6 },
  { id: "reel-frame", palette: "sunset-ember", poster: 2.6 },
  { id: "notification-pop", palette: "cloud", poster: 2.2 },
  { id: "like-spark", palette: "light", poster: 1.8 },
  { id: "tiktok-follow", palette: "light", poster: 2.0 },
  { id: "double-tap-heart", palette: "dark-rose", poster: 1.4 },
  { id: "comment-drop", palette: "light", poster: 3.0 },
  { id: "icon-grid", palette: "ember", poster: 2.2 },
  { id: "badge-stamp", palette: "ember", poster: 1.6 },
  { id: "folder-open", palette: "ember", poster: 2.4 },
  { id: "card-cascade", palette: "ember", poster: 2.8 },
  { id: "travel-postcard", palette: "sky", poster: 3.2 },
  { id: "location-pin", palette: "paper", poster: 2.2 },
  { id: "flash-sale", palette: "ember", poster: 2.4 },
  { id: "coupon-reveal", palette: "ember", poster: 2.6 },
  { id: "stat-bars", palette: "ink", poster: 3.2 },
  // Smooth-text pack (v1.2) — 20 kinetic-typography templates.
  { id: "fade-cascade", palette: "ink-white", poster: 2.6 },
  { id: "letter-reveal", palette: "ink-white", poster: 2.4 },
  { id: "line-rise", palette: "ink-white", poster: 2.6 },
  { id: "focus-in", palette: "ink-white", poster: 2.4 },
  { id: "side-slide", palette: "ink-white", poster: 2.6 },
  { id: "scale-in", palette: "ink-white", poster: 2.2 },
  { id: "flip-words", palette: "ink-white", poster: 2.4 },
  { id: "shine-text", palette: "ink-white", poster: 2.6 },
  { id: "split-reveal", palette: "ink-white", poster: 2.6 },
  { id: "wave-text", palette: "ink-white", poster: 1.5 },
  { id: "bounce-in", palette: "ink-white", poster: 2.2 },
  { id: "drop-letters", palette: "ink-white", poster: 2.2 },
  { id: "curtain-wipe", palette: "ink-white", poster: 2.6 },
  { id: "stacked-build", palette: "ink-white", poster: 2.8 },
  { id: "push-in", palette: "ink-white", poster: 2.6 },
  { id: "text-scramble", palette: "ink-white", poster: 2.4 },
  { id: "emphasis-line", palette: "ink-white", poster: 2.6 },
  { id: "spacing-expand", palette: "ink-white", poster: 2.4 },
  { id: "message-rotator", palette: "ink-white", poster: 1.6 },
  { id: "box-wipe", palette: "ink-white", poster: 2.6 },
  // Explainer / showcase / product / ad pack (v1.3).
  { id: "step-flow", palette: "ember", poster: 3.0 },
  { id: "timeline-flow", palette: "ember", poster: 2.8 },
  { id: "before-after", palette: "ember", poster: 3.2 },
  { id: "comparison-vs", palette: "ember", poster: 3.2 },
  { id: "feature-callouts", palette: "ember", poster: 3.2 },
  { id: "product-showcase", palette: "studio", poster: 3.0 },
  { id: "gallery-strip", palette: "ember", poster: 3.2 },
  { id: "feature-grid", palette: "ember", poster: 2.8 },
  { id: "device-mockup", palette: "ember", poster: 3.0 },
  { id: "review-stars", palette: "paper-ink", poster: 3.4 },
  { id: "product-hero", palette: "studio-white", poster: 3.0 },
  { id: "price-card", palette: "studio-white", poster: 3.2 },
  { id: "new-arrival", palette: "fresh-white", poster: 3.0 },
  { id: "spec-list", palette: "studio-white", poster: 3.2 },
  { id: "reveal-spotlight", palette: "spotlight-ink", poster: 3.4 },
  { id: "three-stats", palette: "ink", poster: 3.2 },
  { id: "logo-wall", palette: "ink", poster: 2.8 },
  { id: "countdown-timer", palette: "ember", poster: 3.0 },
  { id: "cta-endcard", palette: "ink", poster: 2.8 },
  { id: "sale-banner", palette: "ember", poster: 3.0 },
  // Showcase + product expansion (v1.4).
  { id: "photo-grid", palette: "ember", poster: 2.6 },
  { id: "polaroid-stack", palette: "sunset", poster: 2.8 },
  { id: "before-after-slider", palette: "studio", poster: 2.6 },
  { id: "carousel-cover", palette: "ember", poster: 2.6 },
  { id: "team-grid", palette: "paper", poster: 2.8 },
  { id: "testimonial-wall", palette: "ember", poster: 3.0 },
  { id: "feature-spotlight", palette: "ember", poster: 2.6 },
  { id: "image-reveal", palette: "ember", poster: 2.6 },
  { id: "split-showcase", palette: "ember", poster: 2.8 },
  { id: "mockup-tilt", palette: "ember", poster: 2.6 },
  { id: "product-carousel", palette: "studio-white", poster: 2.4 },
  { id: "product-360", palette: "studio", poster: 2.6 },
  { id: "color-variants", palette: "studio-white", poster: 2.8 },
  { id: "product-lineup", palette: "fresh-white", poster: 2.8 },
  { id: "bundle-offer", palette: "fresh-white", poster: 2.8 },
  { id: "product-detail", palette: "studio-white", poster: 3.0 },
  { id: "unbox-reveal", palette: "kraft", poster: 2.8 },
  { id: "size-compare", palette: "studio-white", poster: 3.0 },
  { id: "product-review", palette: "studio-white", poster: 3.0 },
  { id: "shop-grid", palette: "studio-white", poster: 2.8 },
  // v1.7 pack (50) — overlays, intros, loops, text, social, product/promo, stats, brand.
  { id: "lower-third", palette: "ink-white", poster: 2.6 },
  { id: "name-tag", palette: "cloud", poster: 2.2 },
  { id: "subtitle-bar", palette: "midnight-caption", poster: 2.8 },
  { id: "cta-bar", palette: "ink-white", poster: 2.4 },
  { id: "topic-bug", palette: "classic-live", poster: 2.4 },
  { id: "stat-callout", palette: "ink-white", poster: 2.6 },
  { id: "speech-pop", palette: "cloud", poster: 2.2 },
  { id: "channel-intro", palette: "midnight", poster: 2.6 },
  { id: "countdown-intro", palette: "ink", poster: 3.6 },
  { id: "logo-lines", palette: "ink", poster: 2.8 },
  { id: "neon-sign", palette: "midnight-pink", poster: 3.0 },
  { id: "clap-intro", palette: "classic-slate", poster: 3.0 },
  { id: "intro-bars", palette: "ink-trio", poster: 3.2 },
  { id: "highlight-sweep", palette: "lime", poster: 3.0 },
  { id: "outline-fill", palette: "ink-white", poster: 2.8 },
  { id: "stamp-text", palette: "ink-white", poster: 2.2 },
  { id: "rotating-headline", palette: "ink-white", poster: 4.2 },
  { id: "gradient-text", palette: "sunset", poster: 3.0 },
  { id: "split-flap", palette: "departure-navy", poster: 3.0 },
  { id: "underline-grow", palette: "ink-white", poster: 3.0 },
  { id: "story-poll", palette: "classic", poster: 3.2 },
  { id: "hashtag-pop", palette: "light", poster: 2.6 },
  { id: "followers-count", palette: "light", poster: 3.0 },
  { id: "swipe-up", palette: "midnight", poster: 2.4 },
  { id: "mention-tag", palette: "light", poster: 2.2 },
  { id: "sticker-pop", palette: "sun-pop", poster: 2.2 },
  { id: "discount-burst", palette: "ember", poster: 2.6 },
  { id: "new-drop", palette: "studio-white", poster: 3.0 },
  { id: "price-slash", palette: "ember", poster: 2.8 },
  { id: "feature-tags", palette: "studio-white", poster: 3.4 },
  { id: "limited-stock", palette: "ember", poster: 3.0 },
  { id: "shipping-badge", palette: "ember", poster: 2.6 },
  { id: "progress-ring", palette: "ink", poster: 3.0 },
  { id: "bar-race", palette: "ink", poster: 3.4 },
  { id: "percent-fill", palette: "citrus", poster: 3.0 },
  { id: "rating-bars", palette: "ink", poster: 3.2 },
  { id: "milestone-counter", palette: "ember", poster: 3.4 },
  { id: "quote-cards", palette: "studio-white", poster: 3.0 },
  { id: "logo-grid-reveal", palette: "paper", poster: 3.2 },
  { id: "testimonial-slide", palette: "paper-ink", poster: 3.0 },
  { id: "event-lineup", palette: "ivory", poster: 3.8 },
  { id: "thank-you", palette: "cream-ink", poster: 3.0 },
  { id: "logo-reveal-mask", palette: "ink-white", poster: 2.8 },
  { id: "end-screen", palette: "signal-red", poster: 3.2 },
  // Social expansion (v1.7.2).
  { id: "profile-card", palette: "light", poster: 3.4 },
  { id: "share-repost", palette: "light", poster: 2.8 },
  { id: "story-quiz", palette: "sunny", poster: 3.4 },
  { id: "qa-box", palette: "peach", poster: 3.0 },
  { id: "emoji-float", palette: "midnight", poster: 2.8 },
  { id: "dm-chat", palette: "daylight", poster: 3.6 },
  { id: "link-in-bio", palette: "ember", poster: 2.6 },
  { id: "verified-pop", palette: "sky", poster: 2.8 },
  { id: "giveaway", palette: "confetti", poster: 3.8 },
  { id: "trending-now", palette: "light", poster: 3.4 },
  // Reference-style pack (v1.8.1).
  { id: "comment-thread", palette: "daylight", poster: 3.8 },
  { id: "chat-convo", palette: "midnight", poster: 4.2 },
  { id: "search-type", palette: "noir-cyan", poster: 3.4 },
  { id: "retro-tv", palette: "crt-green", poster: 3.4 },
  { id: "watermark-drop", palette: "paper-light", poster: 3.0 },
  // v1.9 pack (45) — 5 new templates per gallery section.
  { id: "blur-focus", palette: "ink-white", poster: 2.4 },
  { id: "mask-wipe", palette: "ink-white", poster: 2.5 },
  { id: "stretch-in", palette: "ink-white", poster: 2.4 },
  { id: "type-cursor", palette: "ink-white", poster: 2.4 },
  { id: "tape-highlight", palette: "ink-white", poster: 2.4 },
  { id: "corner-tag", palette: "cloud", poster: 2.6 },
  { id: "news-lower-third", palette: "newsroom-navy", poster: 3.2 },
  { id: "progress-overlay", palette: "carbon", poster: 3.0 },
  { id: "side-label", palette: "ink", poster: 2.8 },
  { id: "location-tag", palette: "paper-map", poster: 2.6 },
  { id: "reaction-bar", palette: "light", poster: 1.7 },
  { id: "story-progress", palette: "midnight", poster: 3.4 },
  { id: "duet-split", palette: "coral-cobalt", poster: 1.9 },
  { id: "reply-sticker", palette: "daylight", poster: 1.9 },
  { id: "poll-results", palette: "light", poster: 2.6 },
  { id: "spec-callouts", palette: "studio-white", poster: 3.8 },
  { id: "swatch-switch", palette: "studio-white", poster: 3.4 },
  { id: "add-to-cart", palette: "studio-white", poster: 3.0 },
  { id: "bundle-stack", palette: "studio-white", poster: 3.3 },
  { id: "deal-countdown", palette: "studio-white", poster: 3.4 },
  { id: "app-screens", palette: "ember", poster: 2.8 },
  { id: "photo-fan", palette: "sunset", poster: 2.5 },
  { id: "feature-rotator", palette: "ember", poster: 3.2 },
  { id: "browser-window", palette: "ember", poster: 3.6 },
  { id: "photo-develop", palette: "warm", poster: 2.5 },
  { id: "donut-chart", palette: "ink", poster: 2.4 },
  { id: "line-graph", palette: "ink", poster: 2.8 },
  { id: "process-arrows", palette: "ember", poster: 2.8 },
  { id: "pros-cons", palette: "ink", poster: 2.1 },
  { id: "kpi-tiles", palette: "ink", poster: 2.7 },
  { id: "quote-mark", palette: "paper-ink", poster: 3.1 },
  { id: "logo-draw", palette: "ink-white", poster: 2.5 },
  { id: "rating-reveal", palette: "paper-ink", poster: 2.9 },
  { id: "brand-lockup", palette: "ink-white", poster: 2.7 },
  { id: "signature-sign", palette: "paper-ink", poster: 3.3 },
  { id: "film-countdown", palette: "silver-screen", poster: 3.5 },
  { id: "iris-open", palette: "ink-white", poster: 2.8 },
  { id: "glitch-intro", palette: "terminal-dark", poster: 2.5 },
  { id: "zoom-punch", palette: "blaze-ink", poster: 2.4 },
  { id: "blinds-open", palette: "ink-orange", poster: 2.5 },
  { id: "ticket-stub", palette: "boxoffice", poster: 2.4 },
  { id: "boarding-pass", palette: "runway-navy", poster: 2.5 },
  { id: "map-route", palette: "atlas-paper", poster: 2.7 },
  { id: "calendar-flip", palette: "paper-red", poster: 2.2 },
  { id: "passport-stamp", palette: "parchment-crimson", poster: 1.8 },
  // v1.10 pack (50) — 10 new per section: Lower-thirds, Social, Showcase, Explainers & data, Events & Travel.
  // Lower-thirds
  { id: "ticker-bar", palette: "newsroom-red", poster: 3.5 },
  { id: "handle-bar", palette: "cloud", poster: 2.8 },
  { id: "now-playing", palette: "carbon", poster: 3.2 },
  { id: "caption-pop", palette: "midnight", poster: 2.5 },
  { id: "alert-banner", palette: "midnight", poster: 2.9 },
  { id: "speaker-card", palette: "newsroom-navy", poster: 2.8 },
  { id: "score-bug", palette: "broadcast-navy", poster: 2.9 },
  { id: "logo-bug", palette: "channel-onyx", poster: 2.5 },
  { id: "timer-badge", palette: "onyx-timer", poster: 2.9 },
  { id: "topic-chips", palette: "onyx-tags", poster: 2.7 },
  // Social
  { id: "live-badge", palette: "midnight", poster: 2.4 },
  { id: "stream-chat", palette: "midnight", poster: 2.7 },
  { id: "swipe-carousel", palette: "cloud", poster: 3.3 },
  { id: "pinned-comment", palette: "daylight", poster: 2.5 },
  { id: "music-sticker", palette: "midnight", poster: 2.9 },
  { id: "countdown-sticker", palette: "grape-night", poster: 3.4 },
  { id: "slider-sticker", palette: "cloud", poster: 3 },
  { id: "new-follower", palette: "daylight", poster: 2.4 },
  { id: "tip-jar", palette: "warm", poster: 2.8 },
  { id: "add-yours", palette: "cloud", poster: 2.6 },
  // Showcase
  { id: "laptop-mockup", palette: "ember", poster: 2.9 },
  { id: "tablet-showcase", palette: "ember", poster: 2.8 },
  { id: "photo-stack-swipe", palette: "sunset", poster: 2.9 },
  { id: "grid-zoom", palette: "sunset", poster: 3.3 },
  { id: "spec-sheet", palette: "studio-white", poster: 3.15 },
  { id: "hotspot-tour", palette: "paper", poster: 3 },
  { id: "feature-tabs", palette: "ember", poster: 4.5 },
  { id: "film-strip", palette: "noir", poster: 2.5 },
  { id: "masonry-reveal", palette: "sunwash", poster: 2.3 },
  { id: "orbit-showcase", palette: "ember", poster: 2.5 },
  // Explainers & data
  { id: "pie-chart", palette: "ink", poster: 2.5 },
  { id: "area-chart", palette: "ink", poster: 2.7 },
  { id: "gauge-meter", palette: "ink", poster: 2.9 },
  { id: "funnel-chart", palette: "ink", poster: 2.8 },
  { id: "venn-diagram", palette: "ember", poster: 2.1 },
  { id: "flowchart", palette: "ink", poster: 3.9 },
  { id: "pyramid-levels", palette: "ink", poster: 2.7 },
  { id: "radial-bars", palette: "ink", poster: 3 },
  { id: "comparison-table", palette: "ember", poster: 3.8 },
  { id: "growth-arrow", palette: "ink", poster: 2.8 },
  // Events & Travel
  { id: "event-countdown", palette: "ink-white", poster: 2.6 },
  { id: "itinerary", palette: "paper-trail", poster: 2.5 },
  { id: "flight-board", palette: "midnight-board", poster: 3.2 },
  { id: "luggage-tag", palette: "sky-transit", poster: 3.1 },
  { id: "weather-forecast", palette: "clear-sky", poster: 2.4 },
  { id: "hotel-card", palette: "sunlit-ivory", poster: 3 },
  { id: "road-trip", palette: "coastal-highway", poster: 3 },
  { id: "rsvp-card", palette: "champagne-ivory", poster: 3.2 },
  { id: "event-schedule", palette: "paper-conference", poster: 3.4 },
  { id: "globe-spin", palette: "atlas-sky", poster: 3.1 },
  // v1.12 pack — 5 new per section: Lower-thirds, Social, Showcase, Explainers & data, Events & Travel.
  { id: "chapter-marker", palette: "cloud", poster: 2.4 },
  { id: "metric-bar", palette: "cloud", poster: 2.6 },
  { id: "social-bar", palette: "cloud", poster: 2.4 },
  { id: "qr-callout", palette: "cloud", poster: 2.2 },
  { id: "sponsor-bar", palette: "cloud", poster: 2.0 },
  { id: "save-post", palette: "light", poster: 2.4 },
  { id: "share-sheet", palette: "light", poster: 2.2 },
  { id: "action-rail", palette: "light", poster: 2.4 },
  { id: "goal-tracker", palette: "light", poster: 2.6 },
  { id: "notif-stack", palette: "light", poster: 2.2 },
  { id: "phone-scroll", palette: "aura", poster: 3.6 },
  { id: "device-family", palette: "ember", poster: 2.9 },
  { id: "coverflow", palette: "gallery", poster: 3.0 },
  { id: "detail-zoom", palette: "sunrise", poster: 3.9 },
  { id: "contact-sheet", palette: "darkroom", poster: 3.3 },
  { id: "checklist", palette: "paper", poster: 3.9 },
  { id: "mind-map", palette: "ink", poster: 3.0 },
  { id: "tier-list", palette: "ink", poster: 2.9 },
  { id: "scatter-plot", palette: "ink", poster: 2.9 },
  { id: "stacked-bar", palette: "ink", poster: 2.8 },
  { id: "webinar-invite", palette: "live-light", poster: 2.6 },
  { id: "lanyard-badge", palette: "classic-red", poster: 3.0 },
  { id: "birthday-card", palette: "confetti-cream", poster: 2.2 },
  { id: "city-guide", palette: "sand", poster: 2.6 },
  { id: "time-zones", palette: "daybreak", poster: 2.8 },
  // v1.15 pack — +80 templates (10 per non-Text section).
  { id: "weather-bug", palette: "cloud", poster: 2.2 },
  { id: "breaking-banner", palette: "paper", poster: 2.4 },
  { id: "poll-bar", palette: "light", poster: 2.6 },
  { id: "countdown-strip", palette: "paper", poster: 2.4 },
  { id: "now-speaking", palette: "cloud", poster: 2.4 },
  { id: "stat-strip", palette: "paper", poster: 2.6 },
  { id: "donation-alert", palette: "warm", poster: 2.6 },
  { id: "dateline", palette: "paper", poster: 2.4 },
  { id: "key-point", palette: "paper", poster: 2.4 },
  { id: "subscribe-reminder", palette: "youtube", poster: 2.4 },
  { id: "unmute-tap", palette: "cloud", poster: 2.0 },
  { id: "screen-record", palette: "daylight", poster: 2.4 },
  { id: "green-screen", palette: "chroma-green", poster: 2.4 },
  { id: "pinned-post", palette: "cloud", poster: 2.6 },
  { id: "close-friends", palette: "cloud", poster: 2.2 },
  { id: "live-shopping", palette: "daylight", poster: 2.6 },
  { id: "creator-like", palette: "daylight", poster: 2.4 },
  { id: "use-this-sound", palette: "paper", poster: 2.2 },
  { id: "this-or-that", palette: "cloud", poster: 3.4 },
  { id: "story-highlights", palette: "cloud", poster: 2.2 },
  { id: "restock-alert", palette: "studio-white", poster: 2.6 },
  { id: "bogo-offer", palette: "ember", poster: 2.4 },
  { id: "ingredients", palette: "studio-white", poster: 3.0 },
  { id: "subscription-box", palette: "kraft", poster: 3.2 },
  { id: "wishlist-add", palette: "blush", poster: 2.4 },
  { id: "limited-edition", palette: "studio-white", poster: 2.6 },
  { id: "cashback-offer", palette: "mint", poster: 2.6 },
  { id: "gift-card", palette: "festive", poster: 3.0 },
  { id: "bestseller-tag", palette: "studio-white", poster: 2.8 },
  { id: "app-promo", palette: "studio-white", poster: 2.8 },
  { id: "code-editor", palette: "daylight", poster: 3.2 },
  { id: "terminal", palette: "paper", poster: 4.3 },
  { id: "dashboard", palette: "cloud", poster: 3.0 },
  { id: "pricing-tiers", palette: "cloud", poster: 3.0 },
  { id: "smartwatch-showcase", palette: "coral", poster: 3.2 },
  { id: "home-widgets", palette: "dawn", poster: 2.8 },
  { id: "photo-mosaic", palette: "sunset", poster: 2.9 },
  { id: "slideshow", palette: "bloom", poster: 3.3 },
  { id: "photo-flip", palette: "pop", poster: 3.2 },
  { id: "magazine-spread", palette: "editorial", poster: 2.8 },
  { id: "waterfall-chart", palette: "light", poster: 3.2 },
  { id: "heatmap", palette: "light", poster: 2.4 },
  { id: "leaderboard", palette: "light", poster: 2.7 },
  { id: "cycle-diagram", palette: "ink", poster: 2.6 },
  { id: "org-chart", palette: "ink", poster: 2.8 },
  { id: "roadmap", palette: "ink", poster: 2.5 },
  { id: "word-cloud", palette: "light", poster: 2.9 },
  { id: "quadrant", palette: "light", poster: 2.5 },
  { id: "survey-results", palette: "light", poster: 2.5 },
  { id: "radar-chart", palette: "light", poster: 2.6 },
  { id: "logo-assemble", palette: "cloud", poster: 2.6 },
  { id: "award-laurels", palette: "cream", poster: 2.8 },
  { id: "logo-flip", palette: "cloud", poster: 2.9 },
  { id: "coming-soon", palette: "cloud", poster: 2.6 },
  { id: "social-endcard", palette: "cloud", poster: 2.6 },
  { id: "brand-palette", palette: "cloud", poster: 2.8 },
  { id: "logo-morph", palette: "cloud", poster: 2.8 },
  { id: "review-stack", palette: "cloud", poster: 4.2 },
  { id: "review-badge", palette: "cloud", poster: 3.0 },
  { id: "video-testimonial", palette: "cloud", poster: 2.9 },
  { id: "curtain-intro", palette: "rouge", poster: 2.6 },
  { id: "light-sweep", palette: "dawn", poster: 2.4 },
  { id: "ink-reveal", palette: "ink-rose", poster: 2.7 },
  { id: "panel-slide", palette: "punch", poster: 2.7 },
  { id: "spotlight-reveal", palette: "warm", poster: 2.5 },
  { id: "countdown-ring", palette: "ignite", poster: 3.4 },
  { id: "burst-intro", palette: "volt", poster: 2.4 },
  { id: "grid-intro", palette: "coral", poster: 2.8 },
  { id: "title-card", palette: "paper", poster: 2.7 },
  { id: "sparkle-reveal", palette: "champagne", poster: 2.6 },
  { id: "wedding-invite", palette: "ivory-gold", poster: 2.8 },
  { id: "anniversary-card", palette: "gold-cream", poster: 2.6 },
  { id: "speaker-lineup", palette: "paper", poster: 2.8 },
  { id: "holiday-card", palette: "evergreen", poster: 2.6 },
  { id: "grand-opening", palette: "festive-red", poster: 3.2 },
  { id: "graduation-card", palette: "navy-gold", poster: 2.8 },
  { id: "packing-list", palette: "paper", poster: 3.4 },
  { id: "destination-reveal", palette: "sunset", poster: 2.6 },
  { id: "currency-card", palette: "mint-cash", poster: 2.4 },
  { id: "trip-map", palette: "atlas", poster: 3.2 },
  // v1.16 pack — +45 templates (5 per gallery section, all 9 sections).
  // Text & titles
  { id: "ransom-note", palette: "magazine-paper", poster: 4.0 },
  { id: "text-swing", palette: "signpainter", poster: 4.0 },
  { id: "shadow-pop", palette: "print-cream", poster: 3.9 },
  { id: "echo-zoom", palette: "studio-white", poster: 3.8 },
  { id: "stand-up-text", palette: "gallery-white", poster: 3.2 },
  // Overlays & lower-thirds
  { id: "up-next", palette: "studio", poster: 2.8 },
  { id: "frame-corners", palette: "noir", poster: 2.6 },
  { id: "karaoke-caption", palette: "noir-pop", poster: 4.0 },
  { id: "key-press", palette: "carbon", poster: 3.3 },
  { id: "arrow-callout", palette: "marker-red", poster: 2.9 },
  // Social
  { id: "streak-flame", palette: "ember", poster: 3.6 },
  { id: "wrapped-recap", palette: "poster-cream", poster: 4.0 },
  { id: "voice-note", palette: "paper", poster: 3.6 },
  { id: "avatar-stack", palette: "porcelain", poster: 3.7 },
  { id: "on-this-day", palette: "album-cream", poster: 3.4 },
  // Product & ads
  { id: "spin-wheel", palette: "carnival", poster: 4.0 },
  { id: "loyalty-card", palette: "espresso-cream", poster: 3.85 },
  { id: "order-confirmed", palette: "mint-receipt", poster: 3.7 },
  { id: "exploded-view", palette: "studio-white", poster: 3.1 },
  { id: "waitlist-card", palette: "violet-paper", poster: 4.6 },
  // Showcase
  { id: "blueprint-reveal", palette: "blueprint", poster: 3.7 },
  { id: "parallax-layers", palette: "porcelain", poster: 3.3 },
  { id: "cube-spin", palette: "frost", poster: 4.0 },
  { id: "window-cascade", palette: "slate", poster: 3.5 },
  { id: "iso-layers", palette: "circuit", poster: 3.4 },
  // Explainers & data
  { id: "bubble-chart", palette: "ink", poster: 2.6 },
  { id: "slope-graph", palette: "emerald", poster: 3.2 },
  { id: "gantt-chart", palette: "ink", poster: 3.4 },
  { id: "dot-stats", palette: "ink", poster: 3.3 },
  { id: "iceberg-model", palette: "arctic", poster: 3.4 },
  // Brand & quotes
  { id: "crest-monogram", palette: "ivory", poster: 3.5 },
  { id: "ribbon-banner", palette: "emerald", poster: 3.0 },
  { id: "foil-card", palette: "onyx-gold", poster: 3.9 },
  { id: "trophy-shelf", palette: "gallery", poster: 3.4 },
  { id: "press-clipping", palette: "newsprint", poster: 3.6 },
  // Openers
  { id: "page-turn", palette: "notebook", poster: 3.0 },
  { id: "marquee-bulbs", palette: "matinee", poster: 3.4 },
  { id: "shatter-intro", palette: "tangerine", poster: 3.0 },
  { id: "unfold-intro", palette: "linen", poster: 3.2 },
  { id: "flash-cut", palette: "editorial", poster: 3.3 },
  // Events & travel
  { id: "metro-map", palette: "transit-cream", poster: 4.0 },
  { id: "airmail-envelope", palette: "postal-cream", poster: 3.6 },
  { id: "event-menu", palette: "ivory", poster: 3.5 },
  { id: "sunrise-scene", palette: "dawn-blue", poster: 3.6 },
  { id: "race-bib", palette: "classic-red", poster: 4.0 },
  // v1.18 pack — +45 templates (5 per gallery section; clean/modern/smooth brief).
  // Text & titles
  { id: "liquid-headline", palette: "porcelain", poster: 3.4 },
  { id: "weight-shift", palette: "paper", poster: 3.8 },
  { id: "slow-pan-type", palette: "editorial", poster: 4.1 },
  { id: "depth-stack-text", palette: "chalk", poster: 3.6 },
  { id: "unfold-line", palette: "bone", poster: 3.5 },
  // Overlays & lower-thirds
  { id: "glass-bar", palette: "smoke", poster: 3.0 },
  { id: "hairline-third", palette: "ink", poster: 2.6 },
  { id: "pill-expand", palette: "ink", poster: 2.6 },
  { id: "side-rail", palette: "ink", poster: 2.8 },
  { id: "soft-scrim", palette: "ink", poster: 2.8 },
  // Social
  { id: "collab-post", palette: "porcelain", poster: 3.6 },
  { id: "profile-grid", palette: "porcelain", poster: 3.4 },
  { id: "scroll-stop", palette: "porcelain", poster: 3.6 },
  { id: "quote-reel", palette: "porcelain", poster: 3.8 },
  { id: "feed-scroll", palette: "porcelain", poster: 4.1 },
  // Product & ads
  { id: "studio-pedestal", palette: "studio-linen", poster: 3.6 },
  { id: "float-product", palette: "studio-linen", poster: 3.4 },
  { id: "swatch-fan", palette: "studio-linen", poster: 4.2 },
  { id: "value-stack", palette: "studio-linen", poster: 4.6 },
  { id: "product-story", palette: "studio-linen", poster: 5.2 },
  // Showcase
  { id: "image-morph", palette: "dune", poster: 4.2 },
  { id: "split-scroll", palette: "studio", poster: 4.4 },
  { id: "color-grade", palette: "studio-light", poster: 4.4 },
  { id: "ui-states", palette: "daylight", poster: 4.6 },
  { id: "grid-to-hero", palette: "gallery", poster: 4.6 },
  // Explainers & data
  { id: "sankey-flow", palette: "ink", poster: 3.2 },
  { id: "treemap", palette: "ink", poster: 3.2 },
  { id: "bell-curve", palette: "ink", poster: 3.5 },
  { id: "journey-map", palette: "ink", poster: 3.7 },
  { id: "stat-morph", palette: "ink", poster: 4.3 },
  // Brand & quotes
  { id: "brand-gradient", palette: "aurora", poster: 3.4 },
  { id: "manifesto", palette: "paper", poster: 4.6 },
  { id: "brand-values", palette: "chalk", poster: 4.95 },
  { id: "quote-portrait", palette: "linen", poster: 3.6 },
  { id: "logo-orbit", palette: "cloud", poster: 4.35 },
  // Openers
  { id: "gradient-wash", palette: "porcelain", poster: 3.4 },
  { id: "hairline-intro", palette: "bone", poster: 3.0 },
  { id: "column-rise", palette: "paper", poster: 3.4 },
  { id: "zoom-through", palette: "frost", poster: 3.6 },
  { id: "liquid-intro", palette: "mist", poster: 3.8 },
  // Events & travel
  { id: "seat-map", palette: "cabin-light", poster: 3.6 },
  { id: "compass-bearing", palette: "bone-navy", poster: 4.2 },
  { id: "season-shift", palette: "nordic-day", poster: 4.7 },
  { id: "skyline-build", palette: "dusk-indigo", poster: 4.2 },
  { id: "horizon-pan", palette: "alpine-dawn", poster: 4.0 },
  // v1.18.1 — owner-requested one-off.
  { id: "flight-mode", palette: "daylight", poster: 5.0 },

  { id: "arc-text", palette: "cream", poster: 3.2 },
  { id: "knockout-text", palette: "coral", poster: 3.0 },
  { id: "chroma-split", palette: "print", poster: 2.9 },
  { id: "justify-lock", palette: "editorial", poster: 3.2 },
  { id: "vertical-type", palette: "bone", poster: 3.4 },
  { id: "band-slip", palette: "paper", poster: 2.9 },
  { id: "backspace-fix", palette: "paper", poster: 3.2 },
  { id: "pen-stroke", palette: "ivory", poster: 3.6 },
  { id: "half-tone-type", palette: "punch", poster: 2.9 },
  { id: "redact-reveal", palette: "dossier", poster: 3.6 },
  { id: "waveform-bar", palette: "studio", poster: 3.0 },
  { id: "recipe-step", palette: "kitchen", poster: 3.4 },
  { id: "translation-bar", palette: "night", poster: 3.2 },
  { id: "circle-highlight", palette: "marker", poster: 2.4 },
  { id: "focus-vignette", palette: "cinema", poster: 2.6 },
  { id: "peel-sticker", palette: "sunny", poster: 2.6 },
  { id: "product-pin", palette: "clean", poster: 2.4 },
  { id: "bracket-label", palette: "blueprint", poster: 2.6 },
  { id: "fact-check", palette: "verified", poster: 3.2 },
  { id: "leader-line", palette: "spec", poster: 3.4 },
  { id: "super-chat", palette: "gold", poster: 3.4 },
  { id: "badge-unlock", palette: "gold", poster: 2.9 },
  { id: "shoutout", palette: "warm", poster: 3.2 },
  { id: "views-spike", palette: "analytics", poster: 3.6 },
  { id: "thread-numbers", palette: "ink", poster: 2.2 },
  { id: "stitch-cut", palette: "ink", poster: 1.35 },
  { id: "community-post", palette: "paper", poster: 3.4 },
  { id: "music-player", palette: "night", poster: 3.6 },
  { id: "going-live", palette: "live", poster: 4.4 },
  { id: "repost-quote", palette: "ink", poster: 3.6 },
  { id: "pre-order", palette: "ink", poster: 3.6 },
  { id: "referral-offer", palette: "mint", poster: 3.4 },
  { id: "pay-in-four", palette: "mint", poster: 3.6 },
  { id: "trust-badges", palette: "paper", poster: 3.4 },
  { id: "service-card", palette: "ink", poster: 3.8 },
  { id: "booking-slots", palette: "sage", poster: 3.6 },
  { id: "menu-board", palette: "chalk", poster: 3.6 },
  { id: "opening-hours", palette: "sign", poster: 3.4 },
  { id: "delivery-track", palette: "parcel", poster: 3.6 },
  { id: "scratch-reveal", palette: "silver", poster: 2.4 },
  { id: "kanban-board", palette: "board", poster: 4.0 },
  { id: "vinyl-sleeve", palette: "night", poster: 3.4 },
  { id: "business-card", palette: "ink", poster: 3.4 },
  { id: "apparel-mockup", palette: "studio", poster: 3.6 },
  { id: "packaging-mockup", palette: "studio", poster: 3.4 },
  { id: "billboard-mockup", palette: "day", poster: 3.4 },
  { id: "project-index", palette: "paper", poster: 2.6 },
  { id: "book-mockup", palette: "press", poster: 3.4 },
  { id: "email-mockup", palette: "inbox", poster: 3.8 },
  { id: "type-specimen", palette: "paper", poster: 3.8 },];

const ASPECTS: Aspect[] = ["1:1", "4:5", "9:16", "16:9"];
const FRACTIONS = [0, 0.25, 0.5, 0.75, 1];

async function load(page: Page, id: string, aspect: Aspect, palette: string, res = 0.4) {
  await page.goto(`/harness.html?template=${id}&aspect=${aspect}&t=0&res=${res}&palette=${palette}`);
  await page.waitForFunction(() => window.__jimaHarnessReady === true, undefined, { timeout: 20000 });
  const err = await page.evaluate(() => window.__jimaError);
  if (err) throw new Error(`harness error: ${err}`);
}

async function frameAt(page: Page, t: number): Promise<string> {
  return page.evaluate((time) => {
    window.__jima!.renderAt(time);
    return window.__jima!.canvas.toDataURL("image/png");
  }, t);
}

test("the shipped duration table covers exactly the library", () => {
  // The gallery filters on TEMPLATE_DURATIONS without building anything, so a
  // template missing from it silently drops out of every length filter.
  //
  // This compares against the REGISTRY, not against the golden list below: it
  // used to check the two hand-kept lists against each other, so 50 templates
  // that were in neither passed unnoticed for a whole release.
  expect(Object.keys(TEMPLATE_DURATIONS).sort()).toEqual(templates.map((t) => t.id).sort());
});

test("every template in the library has a golden baseline", () => {
  // Same failure mode, one level up: a template with no entry here renders no
  // poster baseline and is never diffed against.
  expect(TEMPLATES.map((t) => t.id).sort()).toEqual(templates.map((t) => t.id).sort());
});

test.describe("determinism (re-seek is pixel-exact)", () => {
  for (const tpl of TEMPLATES) {
    test(`${tpl.id}`, async ({ page }) => {
      await load(page, tpl.id, "1:1", tpl.palette);
      const duration = await page.evaluate(() => window.__jima!.duration);
      // ...and the figures in it have to be the ones the engine really produces.
      expect(duration, `${tpl.id} runs a different length than durations.ts claims`).toBeCloseTo(
        TEMPLATE_DURATIONS[tpl.id]!,
        1,
      );
      for (const frac of FRACTIONS) {
        const t = frac * duration;
        const first = await frameAt(page, t);
        await frameAt(page, t === 0 ? duration : 0);
        await frameAt(page, t * 0.41 + 0.17);
        const second = await frameAt(page, t);
        expect(second, `${tpl.id} @ t=${t}s must be identical after re-seek`).toBe(first);
      }
    });
  }
});

test.describe("poster frames", () => {
  for (const tpl of TEMPLATES) {
    for (const aspect of ASPECTS) {
      test(`${tpl.id} — ${aspect}`, async ({ page }) => {
        await load(page, tpl.id, aspect, tpl.palette);
        await frameAt(page, tpl.poster);
        await expect(page.locator("#jima-canvas")).toHaveScreenshot(
          `${tpl.id}-${aspect.replace(":", "x")}.png`,
          { maxDiffPixelRatio: 0.02 },
        );
      });
    }
  }
});

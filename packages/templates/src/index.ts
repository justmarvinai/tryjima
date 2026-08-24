// @jima/templates — the launch template registry.
// Consumers (gallery, Studio routes, poster generation, golden tests) iterate
// this array — adding a template is one entry here plus its folder.

import type { TemplateDefinition } from "@jima/engine";
import { kineticHeadline } from "./kinetic-headline/index";
import { slideReveal } from "./slide-reveal/index";
import { glowPromo } from "./glow-promo/index";
import { productPop } from "./product-pop/index";
import { typewriter } from "./typewriter/index";
import { kenBurns } from "./ken-burns/index";
import { bigNumber } from "./big-number/index";
import { quoteSpotlight } from "./quote-spotlight/index";
import { logoSting } from "./logo-sting/index";
import { saveTheDate } from "./save-the-date/index";
import { tipsStack } from "./tips-stack/index";
import { splitDuo } from "./split-duo/index";
import { iconPop } from "./icon-pop/index";
import { subscribeBell } from "./subscribe-bell/index";
import { specialOffer } from "./special-offer/index";
import { kineticType } from "./kinetic-type/index";
import { keynoteReveal } from "./keynote-reveal/index";
import { wordSwap } from "./word-swap/index";
import { markerHighlight } from "./marker-highlight/index";
import { youtubeFrame } from "./youtube-frame/index";
import { reelFrame } from "./reel-frame/index";
import { notificationPop } from "./notification-pop/index";
import { likeSpark } from "./like-spark/index";
import { tiktokFollow } from "./tiktok-follow/index";
import { doubleTapHeart } from "./double-tap-heart/index";
import { commentDrop } from "./comment-drop/index";
import { travelPostcard } from "./travel-postcard/index";
import { locationPin } from "./location-pin/index";
import { flashSale } from "./flash-sale/index";
import { couponReveal } from "./coupon-reveal/index";
import { statBars } from "./stat-bars/index";
import { iconGrid } from "./icon-grid/index";
import { badgeStamp } from "./badge-stamp/index";
import { folderOpen } from "./folder-open/index";
import { cardCascade } from "./card-cascade/index";
import { photoGrid } from "./photo-grid/index";
import { polaroidStack } from "./polaroid-stack/index";
import { beforeAfterSlider } from "./before-after-slider/index";
import { carouselCover } from "./carousel-cover/index";
import { teamGrid } from "./team-grid/index";
import { testimonialWall } from "./testimonial-wall/index";
import { featureSpotlight } from "./feature-spotlight/index";
import { imageReveal } from "./image-reveal/index";
import { splitShowcase } from "./split-showcase/index";
import { mockupTilt } from "./mockup-tilt/index";
import { productCarousel } from "./product-carousel/index";
import { product360 } from "./product-360/index";
import { colorVariants } from "./color-variants/index";
import { productLineup } from "./product-lineup/index";
import { bundleOffer } from "./bundle-offer/index";
import { productDetail } from "./product-detail/index";
import { unboxReveal } from "./unbox-reveal/index";
import { sizeCompare } from "./size-compare/index";
import { productReview } from "./product-review/index";
import { shopGrid } from "./shop-grid/index";
import { fadeCascade } from "./fade-cascade/index";
import { letterReveal } from "./letter-reveal/index";
import { lineRise } from "./line-rise/index";
import { focusIn } from "./focus-in/index";
import { sideSlide } from "./side-slide/index";
import { scaleIn } from "./scale-in/index";
import { flipWords } from "./flip-words/index";
import { dropLetters } from "./drop-letters/index";
import { curtainWipe } from "./curtain-wipe/index";
import { stackedBuild } from "./stacked-build/index";
import { shineText } from "./shine-text/index";
import { splitReveal } from "./split-reveal/index";
import { waveText } from "./wave-text/index";
import { bounceIn } from "./bounce-in/index";
import { pushIn } from "./push-in/index";
import { textScramble } from "./text-scramble/index";
import { emphasisLine } from "./emphasis-line/index";
import { spacingExpand } from "./spacing-expand/index";
import { messageRotator } from "./message-rotator/index";
import { boxWipe } from "./box-wipe/index";
import { stepFlow } from "./step-flow/index";
import { timelineFlow } from "./timeline-flow/index";
import { beforeAfter } from "./before-after/index";
import { comparisonVs } from "./comparison-vs/index";
import { featureCallouts } from "./feature-callouts/index";
import { productShowcase } from "./product-showcase/index";
import { galleryStrip } from "./gallery-strip/index";
import { featureGrid } from "./feature-grid/index";
import { deviceMockup } from "./device-mockup/index";
import { reviewStars } from "./review-stars/index";
import { productHero } from "./product-hero/index";
import { priceCard } from "./price-card/index";
import { newArrival } from "./new-arrival/index";
import { specList } from "./spec-list/index";
import { revealSpotlight } from "./reveal-spotlight/index";
import { threeStats } from "./three-stats/index";
import { logoWall } from "./logo-wall/index";
import { countdownTimer } from "./countdown-timer/index";
import { ctaEndcard } from "./cta-endcard/index";
import { saleBanner } from "./sale-banner/index";
// v1.7 pack — overlays/lower-thirds, intros, and more text/social/product/stat.
import { barRace } from "./bar-race/index";
import { channelIntro } from "./channel-intro/index";
import { clapIntro } from "./clap-intro/index";
import { countdownIntro } from "./countdown-intro/index";
import { ctaBar } from "./cta-bar/index";
import { discountBurst } from "./discount-burst/index";
import { eventLineup } from "./event-lineup/index";
import { featureTags } from "./feature-tags/index";
import { followersCount } from "./followers-count/index";
import { hashtagPop } from "./hashtag-pop/index";
import { highlightSweep } from "./highlight-sweep/index";
import { limitedStock } from "./limited-stock/index";
import { logoGridReveal } from "./logo-grid-reveal/index";
import { logoLines } from "./logo-lines/index";
import { lowerThird } from "./lower-third/index";
import { mentionTag } from "./mention-tag/index";
import { milestoneCounter } from "./milestone-counter/index";
import { nameTag } from "./name-tag/index";
import { neonSign } from "./neon-sign/index";
import { newDrop } from "./new-drop/index";
import { outlineFill } from "./outline-fill/index";
import { percentFill } from "./percent-fill/index";
import { priceSlash } from "./price-slash/index";
import { progressRing } from "./progress-ring/index";
import { quoteCards } from "./quote-cards/index";
import { ratingBars } from "./rating-bars/index";
import { shippingBadge } from "./shipping-badge/index";
import { speechPop } from "./speech-pop/index";
import { statCallout } from "./stat-callout/index";
import { storyPoll } from "./story-poll/index";
import { subtitleBar } from "./subtitle-bar/index";
import { swipeUp } from "./swipe-up/index";
import { testimonialSlide } from "./testimonial-slide/index";
import { topicBug } from "./topic-bug/index";
import { stampText } from "./stamp-text/index";
import { rotatingHeadline } from "./rotating-headline/index";
import { gradientText } from "./gradient-text/index";
import { splitFlap } from "./split-flap/index";
import { underlineGrow } from "./underline-grow/index";
import { thankYou } from "./thank-you/index";
import { logoRevealMask } from "./logo-reveal-mask/index";
import { introBars } from "./intro-bars/index";
import { stickerPop } from "./sticker-pop/index";
import { endScreen } from "./end-screen/index";
// Social expansion (v1.7.2).
import { profileCard } from "./profile-card/index";
import { shareRepost } from "./share-repost/index";
import { storyQuiz } from "./story-quiz/index";
import { qaBox } from "./qa-box/index";
import { emojiFloat } from "./emoji-float/index";
import { dmChat } from "./dm-chat/index";
import { linkInBio } from "./link-in-bio/index";
import { verifiedPop } from "./verified-pop/index";
import { giveaway } from "./giveaway/index";
import { trendingNow } from "./trending-now/index";
// Reference-style pack (v1.8.1).
import { commentThread } from "./comment-thread/index";
import { chatConvo } from "./chat-convo/index";
import { searchType } from "./search-type/index";
import { retroTv } from "./retro-tv/index";
import { watermarkDrop } from "./watermark-drop/index";
// v1.9 pack — 5 new templates per gallery section (Backgrounds removed).
import { blurFocus } from "./blur-focus/index";
import { maskWipe } from "./mask-wipe/index";
import { stretchIn } from "./stretch-in/index";
import { typeCursor } from "./type-cursor/index";
import { tapeHighlight } from "./tape-highlight/index";
import { cornerTag } from "./corner-tag/index";
import { newsLowerThird } from "./news-lower-third/index";
import { progressOverlay } from "./progress-overlay/index";
import { sideLabel } from "./side-label/index";
import { locationTag } from "./location-tag/index";
import { reactionBar } from "./reaction-bar/index";
import { storyProgress } from "./story-progress/index";
import { duetSplit } from "./duet-split/index";
import { replySticker } from "./reply-sticker/index";
import { pollResults } from "./poll-results/index";
import { specCallouts } from "./spec-callouts/index";
import { swatchSwitch } from "./swatch-switch/index";
import { addToCart } from "./add-to-cart/index";
import { bundleStack } from "./bundle-stack/index";
import { dealCountdown } from "./deal-countdown/index";
import { appScreens } from "./app-screens/index";
import { photoFan } from "./photo-fan/index";
import { featureRotator } from "./feature-rotator/index";
import { browserWindow } from "./browser-window/index";
import { photoDevelop } from "./photo-develop/index";
import { donutChart } from "./donut-chart/index";
import { lineGraph } from "./line-graph/index";
import { processArrows } from "./process-arrows/index";
import { prosCons } from "./pros-cons/index";
import { kpiTiles } from "./kpi-tiles/index";
import { quoteMark } from "./quote-mark/index";
import { logoDraw } from "./logo-draw/index";
import { ratingReveal } from "./rating-reveal/index";
import { brandLockup } from "./brand-lockup/index";
import { signatureSign } from "./signature-sign/index";
import { filmCountdown } from "./film-countdown/index";
import { irisOpen } from "./iris-open/index";
import { glitchIntro } from "./glitch-intro/index";
import { zoomPunch } from "./zoom-punch/index";
import { blindsOpen } from "./blinds-open/index";
import { ticketStub } from "./ticket-stub/index";
import { boardingPass } from "./boarding-pass/index";
import { mapRoute } from "./map-route/index";
import { calendarFlip } from "./calendar-flip/index";
import { passportStamp } from "./passport-stamp/index";
// v1.10 pack — 10 new templates each for Lower-thirds, Social, Showcase, Explainers & data, Events & Travel.
import { tickerBar } from "./ticker-bar/index";
import { handleBar } from "./handle-bar/index";
import { nowPlaying } from "./now-playing/index";
import { captionPop } from "./caption-pop/index";
import { alertBanner } from "./alert-banner/index";
import { speakerCard } from "./speaker-card/index";
import { scoreBug } from "./score-bug/index";
import { logoBug } from "./logo-bug/index";
import { timerBadge } from "./timer-badge/index";
import { topicChips } from "./topic-chips/index";
import { liveBadge } from "./live-badge/index";
import { streamChat } from "./stream-chat/index";
import { swipeCarousel } from "./swipe-carousel/index";
import { pinnedComment } from "./pinned-comment/index";
import { musicSticker } from "./music-sticker/index";
import { countdownSticker } from "./countdown-sticker/index";
import { sliderSticker } from "./slider-sticker/index";
import { newFollower } from "./new-follower/index";
import { tipJar } from "./tip-jar/index";
import { addYours } from "./add-yours/index";
import { laptopMockup } from "./laptop-mockup/index";
import { tabletShowcase } from "./tablet-showcase/index";
import { photoStackSwipe } from "./photo-stack-swipe/index";
import { gridZoom } from "./grid-zoom/index";
import { specSheet } from "./spec-sheet/index";
import { hotspotTour } from "./hotspot-tour/index";
import { featureTabs } from "./feature-tabs/index";
import { filmStrip } from "./film-strip/index";
import { masonryReveal } from "./masonry-reveal/index";
import { orbitShowcase } from "./orbit-showcase/index";
import { pieChart } from "./pie-chart/index";
import { areaChart } from "./area-chart/index";
import { gaugeMeter } from "./gauge-meter/index";
import { funnelChart } from "./funnel-chart/index";
import { vennDiagram } from "./venn-diagram/index";
import { flowchart } from "./flowchart/index";
import { pyramidLevels } from "./pyramid-levels/index";
import { radialBars } from "./radial-bars/index";
import { comparisonTable } from "./comparison-table/index";
import { growthArrow } from "./growth-arrow/index";
import { eventCountdown } from "./event-countdown/index";
import { itinerary } from "./itinerary/index";
import { flightBoard } from "./flight-board/index";
import { luggageTag } from "./luggage-tag/index";
import { weatherForecast } from "./weather-forecast/index";
import { hotelCard } from "./hotel-card/index";
import { roadTrip } from "./road-trip/index";
import { rsvpCard } from "./rsvp-card/index";
import { eventSchedule } from "./event-schedule/index";
import { globeSpin } from "./globe-spin/index";
// v1.12 pack — 5 new templates each for Lower-thirds, Social, Showcase, Explainers & data, Events & Travel.
import { chapterMarker } from "./chapter-marker/index";
import { metricBar } from "./metric-bar/index";
import { socialBar } from "./social-bar/index";
import { qrCallout } from "./qr-callout/index";
import { sponsorBar } from "./sponsor-bar/index";
import { savePost } from "./save-post/index";
import { shareSheet } from "./share-sheet/index";
import { actionRail } from "./action-rail/index";
import { goalTracker } from "./goal-tracker/index";
import { notifStack } from "./notif-stack/index";
import { phoneScroll } from "./phone-scroll/index";
import { deviceFamily } from "./device-family/index";
import { coverflow } from "./coverflow/index";
import { detailZoom } from "./detail-zoom/index";
import { contactSheet } from "./contact-sheet/index";
import { checklist } from "./checklist/index";
import { mindMap } from "./mind-map/index";
import { tierList } from "./tier-list/index";
import { scatterPlot } from "./scatter-plot/index";
import { stackedBar } from "./stacked-bar/index";
import { webinarInvite } from "./webinar-invite/index";
import { lanyardBadge } from "./lanyard-badge/index";
import { birthdayCard } from "./birthday-card/index";
import { cityGuide } from "./city-guide/index";
import { timeZones } from "./time-zones/index";
import { weatherBug } from "./weather-bug/index";
import { breakingBanner } from "./breaking-banner/index";
import { pollBar } from "./poll-bar/index";
import { countdownStrip } from "./countdown-strip/index";
import { nowSpeaking } from "./now-speaking/index";
import { statStrip } from "./stat-strip/index";
import { donationAlert } from "./donation-alert/index";
import { dateline } from "./dateline/index";
import { keyPoint } from "./key-point/index";
import { subscribeReminder } from "./subscribe-reminder/index";
import { unmuteTap } from "./unmute-tap/index";
import { screenRecord } from "./screen-record/index";
import { greenScreen } from "./green-screen/index";
import { pinnedPost } from "./pinned-post/index";
import { closeFriends } from "./close-friends/index";
import { liveShopping } from "./live-shopping/index";
import { creatorLike } from "./creator-like/index";
import { useThisSound } from "./use-this-sound/index";
import { thisOrThat } from "./this-or-that/index";
import { storyHighlights } from "./story-highlights/index";
import { restockAlert } from "./restock-alert/index";
import { bogoOffer } from "./bogo-offer/index";
import { ingredients } from "./ingredients/index";
import { subscriptionBox } from "./subscription-box/index";
import { wishlistAdd } from "./wishlist-add/index";
import { limitedEdition } from "./limited-edition/index";
import { cashbackOffer } from "./cashback-offer/index";
import { giftCard } from "./gift-card/index";
import { bestsellerTag } from "./bestseller-tag/index";
import { appPromo } from "./app-promo/index";
import { codeEditor } from "./code-editor/index";
import { terminal } from "./terminal/index";
import { dashboard } from "./dashboard/index";
import { pricingTiers } from "./pricing-tiers/index";
import { smartwatchShowcase } from "./smartwatch-showcase/index";
import { homeWidgets } from "./home-widgets/index";
import { photoMosaic } from "./photo-mosaic/index";
import { slideshow } from "./slideshow/index";
import { photoFlip } from "./photo-flip/index";
import { magazineSpread } from "./magazine-spread/index";
import { waterfallChart } from "./waterfall-chart/index";
import { heatmap } from "./heatmap/index";
import { leaderboard } from "./leaderboard/index";
import { cycleDiagram } from "./cycle-diagram/index";
import { orgChart } from "./org-chart/index";
import { roadmap } from "./roadmap/index";
import { wordCloud } from "./word-cloud/index";
import { quadrant } from "./quadrant/index";
import { surveyResults } from "./survey-results/index";
import { radarChart } from "./radar-chart/index";
import { logoAssemble } from "./logo-assemble/index";
import { awardLaurels } from "./award-laurels/index";
import { logoFlip } from "./logo-flip/index";
import { comingSoon } from "./coming-soon/index";
import { socialEndcard } from "./social-endcard/index";
import { brandPalette } from "./brand-palette/index";
import { logoMorph } from "./logo-morph/index";
import { reviewStack } from "./review-stack/index";
import { reviewBadge } from "./review-badge/index";
import { videoTestimonial } from "./video-testimonial/index";
import { curtainIntro } from "./curtain-intro/index";
import { lightSweep } from "./light-sweep/index";
import { inkReveal } from "./ink-reveal/index";
import { panelSlide } from "./panel-slide/index";
import { spotlightReveal } from "./spotlight-reveal/index";
import { countdownRing } from "./countdown-ring/index";
import { burstIntro } from "./burst-intro/index";
import { gridIntro } from "./grid-intro/index";
import { titleCard } from "./title-card/index";
import { sparkleReveal } from "./sparkle-reveal/index";
import { weddingInvite } from "./wedding-invite/index";
import { anniversaryCard } from "./anniversary-card/index";
import { speakerLineup } from "./speaker-lineup/index";
import { holidayCard } from "./holiday-card/index";
import { grandOpening } from "./grand-opening/index";
import { graduationCard } from "./graduation-card/index";
import { packingList } from "./packing-list/index";
import { destinationReveal } from "./destination-reveal/index";
import { currencyCard } from "./currency-card/index";
import { tripMap } from "./trip-map/index";
import { ransomNote } from "./ransom-note/index";
import { textSwing } from "./text-swing/index";
import { shadowPop } from "./shadow-pop/index";
import { echoZoom } from "./echo-zoom/index";
import { standUpText } from "./stand-up-text/index";
import { upNext } from "./up-next/index";
import { frameCorners } from "./frame-corners/index";
import { karaokeCaption } from "./karaoke-caption/index";
import { keyPress } from "./key-press/index";
import { arrowCallout } from "./arrow-callout/index";
import { streakFlame } from "./streak-flame/index";
import { wrappedRecap } from "./wrapped-recap/index";
import { voiceNote } from "./voice-note/index";
import { avatarStack } from "./avatar-stack/index";
import { onThisDay } from "./on-this-day/index";
import { spinWheel } from "./spin-wheel/index";
import { loyaltyCard } from "./loyalty-card/index";
import { orderConfirmed } from "./order-confirmed/index";
import { explodedView } from "./exploded-view/index";
import { waitlistCard } from "./waitlist-card/index";
import { blueprintReveal } from "./blueprint-reveal/index";
import { parallaxLayers } from "./parallax-layers/index";
import { cubeSpin } from "./cube-spin/index";
import { windowCascade } from "./window-cascade/index";
import { isoLayers } from "./iso-layers/index";
import { bubbleChart } from "./bubble-chart/index";
import { slopeGraph } from "./slope-graph/index";
import { ganttChart } from "./gantt-chart/index";
import { dotStats } from "./dot-stats/index";
import { icebergModel } from "./iceberg-model/index";
import { crestMonogram } from "./crest-monogram/index";
import { ribbonBanner } from "./ribbon-banner/index";
import { foilCard } from "./foil-card/index";
import { trophyShelf } from "./trophy-shelf/index";
import { pressClipping } from "./press-clipping/index";
import { pageTurn } from "./page-turn/index";
import { marqueeBulbs } from "./marquee-bulbs/index";
import { shatterIntro } from "./shatter-intro/index";
import { unfoldIntro } from "./unfold-intro/index";
import { flashCut } from "./flash-cut/index";
import { metroMap } from "./metro-map/index";
import { airmailEnvelope } from "./airmail-envelope/index";
import { eventMenu } from "./event-menu/index";
import { sunriseScene } from "./sunrise-scene/index";
import { raceBib } from "./race-bib/index";
import { liquidHeadline } from "./liquid-headline/index";
import { weightShift } from "./weight-shift/index";
import { slowPanType } from "./slow-pan-type/index";
import { depthStackText } from "./depth-stack-text/index";
import { unfoldLine } from "./unfold-line/index";
import { glassBar } from "./glass-bar/index";
import { hairlineThird } from "./hairline-third/index";
import { pillExpand } from "./pill-expand/index";
import { sideRail } from "./side-rail/index";
import { softScrim } from "./soft-scrim/index";
import { collabPost } from "./collab-post/index";
import { profileGrid } from "./profile-grid/index";
import { scrollStop } from "./scroll-stop/index";
import { quoteReel } from "./quote-reel/index";
import { feedScroll } from "./feed-scroll/index";
import { studioPedestal } from "./studio-pedestal/index";
import { floatProduct } from "./float-product/index";
import { swatchFan } from "./swatch-fan/index";
import { valueStack } from "./value-stack/index";
import { productStory } from "./product-story/index";
import { imageMorph } from "./image-morph/index";
import { splitScroll } from "./split-scroll/index";
import { colorGrade } from "./color-grade/index";
import { uiStates } from "./ui-states/index";
import { gridToHero } from "./grid-to-hero/index";
import { sankeyFlow } from "./sankey-flow/index";
import { treemap } from "./treemap/index";
import { bellCurve } from "./bell-curve/index";
import { journeyMap } from "./journey-map/index";
import { statMorph } from "./stat-morph/index";
import { brandGradient } from "./brand-gradient/index";
import { manifesto } from "./manifesto/index";
import { brandValues } from "./brand-values/index";
import { quotePortrait } from "./quote-portrait/index";
import { logoOrbit } from "./logo-orbit/index";
import { gradientWash } from "./gradient-wash/index";
import { hairlineIntro } from "./hairline-intro/index";
import { columnRise } from "./column-rise/index";
import { zoomThrough } from "./zoom-through/index";
import { liquidIntro } from "./liquid-intro/index";
import { seatMap } from "./seat-map/index";
import { compassBearing } from "./compass-bearing/index";
import { seasonShift } from "./season-shift/index";
import { skylineBuild } from "./skyline-build/index";
import { horizonPan } from "./horizon-pan/index";
import { flightMode } from "./flight-mode/index";
// v1.19 — 10 new per gallery section.
import { arcText } from "./arc-text/index";
import { knockoutText } from "./knockout-text/index";
import { chromaSplit } from "./chroma-split/index";
import { justifyLock } from "./justify-lock/index";
import { verticalType } from "./vertical-type/index";
import { bandSlip } from "./band-slip/index";
import { backspaceFix } from "./backspace-fix/index";
import { penStroke } from "./pen-stroke/index";
import { halfToneType } from "./half-tone-type/index";
import { redactReveal } from "./redact-reveal/index";
import { waveformBar } from "./waveform-bar/index";
import { recipeStep } from "./recipe-step/index";
import { translationBar } from "./translation-bar/index";
import { circleHighlight } from "./circle-highlight/index";
import { focusVignette } from "./focus-vignette/index";
import { peelSticker } from "./peel-sticker/index";
import { productPin } from "./product-pin/index";
import { bracketLabel } from "./bracket-label/index";
import { factCheck } from "./fact-check/index";
import { leaderLine } from "./leader-line/index";
import { superChat } from "./super-chat/index";
import { badgeUnlock } from "./badge-unlock/index";
import { shoutout } from "./shoutout/index";
import { viewsSpike } from "./views-spike/index";
import { threadNumbers } from "./thread-numbers/index";
import { stitchCut } from "./stitch-cut/index";
import { communityPost } from "./community-post/index";
import { musicPlayer } from "./music-player/index";
import { goingLive } from "./going-live/index";
import { repostQuote } from "./repost-quote/index";
import { preOrder } from "./pre-order/index";
import { referralOffer } from "./referral-offer/index";
import { payInFour } from "./pay-in-four/index";
import { trustBadges } from "./trust-badges/index";
import { serviceCard } from "./service-card/index";
import { bookingSlots } from "./booking-slots/index";
import { menuBoard } from "./menu-board/index";
import { openingHours } from "./opening-hours/index";
import { deliveryTrack } from "./delivery-track/index";
import { scratchReveal } from "./scratch-reveal/index";
import { kanbanBoard } from "./kanban-board/index";
import { vinylSleeve } from "./vinyl-sleeve/index";
import { businessCard } from "./business-card/index";
import { apparelMockup } from "./apparel-mockup/index";
import { packagingMockup } from "./packaging-mockup/index";
import { billboardMockup } from "./billboard-mockup/index";
import { projectIndex } from "./project-index/index";
import { bookMockup } from "./book-mockup/index";
import { emailMockup } from "./email-mockup/index";
import { typeSpecimen } from "./type-specimen/index";

// Ordered for the gallery (roughly by how commonly social managers reach for them).
export const templates: TemplateDefinition[] = [
  kineticHeadline,
  keynoteReveal,
  specialOffer,
  fadeCascade,
  subscribeBell,
  reelFrame,
  bigNumber,
  letterReveal,
  youtubeFrame,
  glowPromo,
  flipWords,
  iconPop,
  quoteSpotlight,
  flashSale,
  shineText,
  tiktokFollow,
  doubleTapHeart,
  kineticType,
  scaleIn,
  productPop,
  statBars,
  travelPostcard,
  lineRise,
  likeSpark,
  markerHighlight,
  notificationPop,
  bounceIn,
  commentDrop,
  slideReveal,
  focusIn,
  typewriter,
  textScramble,
  iconGrid,
  couponReveal,
  wordSwap,
  sideSlide,
  locationPin,
  cardCascade,
  curtainWipe,
  folderOpen,
  emphasisLine,
  kenBurns,
  spacingExpand,
  saveTheDate,
  badgeStamp,
  waveText,
  messageRotator,
  tipsStack,
  splitReveal,
  dropLetters,
  splitDuo,
  pushIn,
  stackedBuild,
  boxWipe,
  logoSting,
  // Explainer / showcase / product / ad pack.
  stepFlow,
  timelineFlow,
  beforeAfter,
  comparisonVs,
  featureCallouts,
  productShowcase,
  galleryStrip,
  featureGrid,
  deviceMockup,
  reviewStars,
  productHero,
  priceCard,
  newArrival,
  specList,
  revealSpotlight,
  threeStats,
  logoWall,
  countdownTimer,
  ctaEndcard,
  saleBanner,
  photoGrid,
  polaroidStack,
  beforeAfterSlider,
  carouselCover,
  teamGrid,
  testimonialWall,
  featureSpotlight,
  imageReveal,
  splitShowcase,
  mockupTilt,
  productCarousel,
  product360,
  colorVariants,
  productLineup,
  bundleOffer,
  productDetail,
  unboxReveal,
  sizeCompare,
  productReview,
  shopGrid,
  // v1.7 pack — Overlays & lower-thirds
  lowerThird,
  nameTag,
  subtitleBar,
  ctaBar,
  topicBug,
  statCallout,
  speechPop,
  // Openers (intros)
  channelIntro,
  countdownIntro,
  logoLines,
  neonSign,
  clapIntro,
  introBars,
  // Text
  highlightSweep,
  outlineFill,
  stampText,
  rotatingHeadline,
  gradientText,
  splitFlap,
  underlineGrow,
  // Social
  storyPoll,
  hashtagPop,
  followersCount,
  swipeUp,
  mentionTag,
  stickerPop,
  // Product & promo
  discountBurst,
  newDrop,
  priceSlash,
  featureTags,
  limitedStock,
  shippingBadge,
  // Data & stats
  progressRing,
  barRace,
  percentFill,
  ratingBars,
  milestoneCounter,
  // Testimonial / brand / event
  quoteCards,
  logoGridReveal,
  testimonialSlide,
  eventLineup,
  thankYou,
  logoRevealMask,
  endScreen,
  // Social expansion (v1.7.2).
  profileCard,
  shareRepost,
  storyQuiz,
  qaBox,
  emojiFloat,
  dmChat,
  linkInBio,
  verifiedPop,
  giveaway,
  trendingNow,
  // Reference-style pack (v1.8.1).
  commentThread,
  chatConvo,
  searchType,
  retroTv,
  watermarkDrop,
  // v1.9 pack — 5 new templates per gallery section.
  // Text & titles
  blurFocus,
  maskWipe,
  stretchIn,
  typeCursor,
  tapeHighlight,
  // Overlays & lower-thirds
  cornerTag,
  newsLowerThird,
  progressOverlay,
  sideLabel,
  locationTag,
  // Social
  reactionBar,
  storyProgress,
  duetSplit,
  replySticker,
  pollResults,
  // Product & ads
  specCallouts,
  swatchSwitch,
  addToCart,
  bundleStack,
  dealCountdown,
  // Showcase
  appScreens,
  photoFan,
  featureRotator,
  browserWindow,
  photoDevelop,
  // Explainers & data
  donutChart,
  lineGraph,
  processArrows,
  prosCons,
  kpiTiles,
  // Brand & quotes
  quoteMark,
  logoDraw,
  ratingReveal,
  brandLockup,
  signatureSign,
  // Openers
  filmCountdown,
  irisOpen,
  glitchIntro,
  zoomPunch,
  blindsOpen,
  // Events & travel
  ticketStub,
  boardingPass,
  mapRoute,
  calendarFlip,
  passportStamp,
  // v1.10 pack — 10 new per section: Lower-thirds, Social, Showcase, Explainers & data, Events & Travel.
  // Lower-thirds
  tickerBar,
  handleBar,
  nowPlaying,
  captionPop,
  alertBanner,
  speakerCard,
  scoreBug,
  logoBug,
  timerBadge,
  topicChips,
  // Social
  liveBadge,
  streamChat,
  swipeCarousel,
  pinnedComment,
  musicSticker,
  countdownSticker,
  sliderSticker,
  newFollower,
  tipJar,
  addYours,
  // Showcase
  laptopMockup,
  tabletShowcase,
  photoStackSwipe,
  gridZoom,
  specSheet,
  hotspotTour,
  featureTabs,
  filmStrip,
  masonryReveal,
  orbitShowcase,
  // Explainers & data
  pieChart,
  areaChart,
  gaugeMeter,
  funnelChart,
  vennDiagram,
  flowchart,
  pyramidLevels,
  radialBars,
  comparisonTable,
  growthArrow,
  // Events & Travel
  eventCountdown,
  itinerary,
  flightBoard,
  luggageTag,
  weatherForecast,
  hotelCard,
  roadTrip,
  rsvpCard,
  eventSchedule,
  globeSpin,
  // v1.12 pack — 5 new per section: Lower-thirds, Social, Showcase, Explainers & data, Events & Travel.
  // Lower-thirds
  chapterMarker,
  metricBar,
  socialBar,
  qrCallout,
  sponsorBar,
  // Social
  savePost,
  shareSheet,
  actionRail,
  goalTracker,
  notifStack,
  // Showcase
  phoneScroll,
  deviceFamily,
  coverflow,
  detailZoom,
  contactSheet,
  // Explainers & data
  checklist,
  mindMap,
  tierList,
  scatterPlot,
  stackedBar,
  // Events & Travel
  webinarInvite,
  lanyardBadge,
  birthdayCard,
  cityGuide,
  timeZones,
  // v1.15 pack — +80 templates (10 per non-Text section).
  // Overlays & lower-thirds
  weatherBug,
  breakingBanner,
  pollBar,
  countdownStrip,
  nowSpeaking,
  statStrip,
  donationAlert,
  dateline,
  keyPoint,
  subscribeReminder,
  // Social
  unmuteTap,
  screenRecord,
  greenScreen,
  pinnedPost,
  closeFriends,
  liveShopping,
  creatorLike,
  useThisSound,
  thisOrThat,
  storyHighlights,
  // Product & ads
  restockAlert,
  bogoOffer,
  ingredients,
  subscriptionBox,
  wishlistAdd,
  limitedEdition,
  cashbackOffer,
  giftCard,
  bestsellerTag,
  appPromo,
  // Showcase
  codeEditor,
  terminal,
  dashboard,
  pricingTiers,
  smartwatchShowcase,
  homeWidgets,
  photoMosaic,
  slideshow,
  photoFlip,
  magazineSpread,
  // Explainers & data
  waterfallChart,
  heatmap,
  leaderboard,
  cycleDiagram,
  orgChart,
  roadmap,
  wordCloud,
  quadrant,
  surveyResults,
  radarChart,
  // Brand & quotes
  logoAssemble,
  awardLaurels,
  logoFlip,
  comingSoon,
  socialEndcard,
  brandPalette,
  logoMorph,
  reviewStack,
  reviewBadge,
  videoTestimonial,
  // Openers
  curtainIntro,
  lightSweep,
  inkReveal,
  panelSlide,
  spotlightReveal,
  countdownRing,
  burstIntro,
  gridIntro,
  titleCard,
  sparkleReveal,
  // Events & travel
  weddingInvite,
  anniversaryCard,
  speakerLineup,
  holidayCard,
  grandOpening,
  graduationCard,
  packingList,
  destinationReveal,
  currencyCard,
  tripMap,
  // v1.16 pack — +45 templates (5 per gallery section, all 9 sections).
  // Text & titles
  ransomNote,
  textSwing,
  shadowPop,
  echoZoom,
  standUpText,
  // Overlays & lower-thirds
  upNext,
  frameCorners,
  karaokeCaption,
  keyPress,
  arrowCallout,
  // Social
  streakFlame,
  wrappedRecap,
  voiceNote,
  avatarStack,
  onThisDay,
  // Product & ads
  spinWheel,
  loyaltyCard,
  orderConfirmed,
  explodedView,
  waitlistCard,
  // Showcase
  blueprintReveal,
  parallaxLayers,
  cubeSpin,
  windowCascade,
  isoLayers,
  // Explainers & data
  bubbleChart,
  slopeGraph,
  ganttChart,
  dotStats,
  icebergModel,
  // Brand & quotes
  crestMonogram,
  ribbonBanner,
  foilCard,
  trophyShelf,
  pressClipping,
  // Openers
  pageTurn,
  marqueeBulbs,
  shatterIntro,
  unfoldIntro,
  flashCut,
  // Events & travel
  metroMap,
  airmailEnvelope,
  eventMenu,
  sunriseScene,
  raceBib,
  // v1.18 pack — +45 templates (5 per gallery section; clean/modern/smooth brief).
  // Text & titles
  liquidHeadline,
  weightShift,
  slowPanType,
  depthStackText,
  unfoldLine,
  // Overlays & lower-thirds
  glassBar,
  hairlineThird,
  pillExpand,
  sideRail,
  softScrim,
  // Social
  collabPost,
  profileGrid,
  scrollStop,
  quoteReel,
  feedScroll,
  // Product & ads
  studioPedestal,
  floatProduct,
  swatchFan,
  valueStack,
  productStory,
  // Showcase
  imageMorph,
  splitScroll,
  colorGrade,
  uiStates,
  gridToHero,
  // Explainers & data
  sankeyFlow,
  treemap,
  bellCurve,
  journeyMap,
  statMorph,
  // Brand & quotes
  brandGradient,
  manifesto,
  brandValues,
  quotePortrait,
  logoOrbit,
  // Openers
  gradientWash,
  hairlineIntro,
  columnRise,
  zoomThrough,
  liquidIntro,
  // Events & travel
  seatMap,
  compassBearing,
  seasonShift,
  skylineBuild,
  horizonPan,
  // v1.18.1 — owner-requested one-off: iOS Control Center travel-vlog intro.
  flightMode,

  // ── v1.19 ────────────────────────────────────────────────────────────────
  // Text & titles
  arcText,
  knockoutText,
  chromaSplit,
  justifyLock,
  verticalType,
  bandSlip,
  backspaceFix,
  penStroke,
  halfToneType,
  redactReveal,
  // Overlays & lower-thirds
  waveformBar,
  recipeStep,
  translationBar,
  circleHighlight,
  focusVignette,
  peelSticker,
  productPin,
  bracketLabel,
  factCheck,
  leaderLine,
  // Social
  superChat,
  badgeUnlock,
  shoutout,
  viewsSpike,
  threadNumbers,
  stitchCut,
  communityPost,
  musicPlayer,
  goingLive,
  repostQuote,
  // Product & ads
  preOrder,
  referralOffer,
  payInFour,
  trustBadges,
  serviceCard,
  bookingSlots,
  menuBoard,
  openingHours,
  deliveryTrack,
  scratchReveal,
  // Showcase
  kanbanBoard,
  vinylSleeve,
  businessCard,
  apparelMockup,
  packagingMockup,
  billboardMockup,
  projectIndex,
  bookMockup,
  emailMockup,
  typeSpecimen,
];

export function getTemplate(id: string): TemplateDefinition | undefined {
  return templates.find((t) => t.id === id);
}

// Length at default values, as data — the gallery filters on it without paying
// to build 495 scenes. Also importable as "@jima/templates/durations" by tools
// that want the numbers without pulling in Pixi and the whole library.
export { TEMPLATE_DURATIONS, templateDuration } from "./durations";

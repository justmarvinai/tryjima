import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Aspect, TemplateDefinition } from "@jima/engine";
import { getTemplate } from "@jima/templates";
import { LivePreview } from "@/motion/components/LivePreview";
import { PosterThumb } from "@/motion/components/PosterThumb";
import { cn, useReducedMotion, Container, ChevronLeftIcon, ChevronRightIcon } from "@/ui";

/**
 * The hero's template carousel — a dozen templates under the headline, each one
 * playing its real animation rather than showing a still. Arrows page through
 * the rest; the row also scrolls and swipes directly.
 *
 * Two things keep "everything animates" affordable. A card only starts a live
 * preview while it is genuinely on screen — an IntersectionObserver against the
 * viewport, which also accounts for the rail's own horizontal clipping — so
 * roughly four WebGL contexts exist at a time instead of twelve, and every one
 * of them is released when the hero scrolls out of view. And a cached poster
 * frame sits underneath as the placeholder, so a card is never blank while its
 * context boots (and is all a reduced-motion visitor ever sees).
 *
 * ── Everything here is written so that hovering a card repaints NOTHING ──
 *
 * Four live WebGL canvases sit in this rail. A canvas is normally handed
 * straight to the compositor, but that only survives while nothing above it
 * forces a re-rasterisation. Two things used to force one on hover, and the
 * wide 16:9 cards — nearly three times the pixel area of the 9:16 ones —
 * flickered as a result:
 *
 *   1. The rail carried `edge-fade-x`, a `mask-image`. A mask pulls every
 *      descendant into the masked layer, so the canvases could not composite
 *      independently and Chrome re-evaluated layerisation each time a sibling
 *      card started or finished its lift. The fades are now two overlay
 *      gradients painted *over* the rail instead — same look, and the canvases
 *      are left alone.
 *   2. `transition-all` animated `box-shadow` and `border-color` — both paint
 *      properties — for 300ms across a box containing a live canvas, and the
 *      hover chip's `backdrop-blur` read that canvas back every frame.
 *
 * So: the lift is a `transform` and nothing else, the border and the shadow are
 * static or cross-faded through `opacity`, the clip lives on a child that never
 * moves, and each card is promoted up front rather than at hover time. All four
 * are composited operations.
 */
type Item = { id: string; aspect: Aspect };

// One template from each of ten use cases, in mixed aspects — and picked as much
// for motion that carries a whole loop as for how they look. Templates are
// required to end on a designed hold frame, so a second or so of stillness is
// normal; what disqualifies a candidate here is snapping into place early and
// holding for most of the loop. Overlays are out for the same reason they're
// overlays: they're a bar on an empty frame, which reads as an empty card.
const ITEMS: Item[] = [
  { id: "kinetic-type", aspect: "16:9" },
  { id: "unbox-reveal", aspect: "4:5" },
  { id: "phone-scroll", aspect: "9:16" },
  { id: "subscribe-bell", aspect: "16:9" },
  { id: "donut-chart", aspect: "1:1" },
  { id: "countdown-ring", aspect: "9:16" },
  { id: "line-graph", aspect: "16:9" },
  { id: "photo-fan", aspect: "4:5" },
  { id: "orbit-showcase", aspect: "1:1" },
  { id: "boarding-pass", aspect: "16:9" },
  { id: "sparkle-reveal", aspect: "4:5" },
  { id: "wave-text", aspect: "16:9" },
];

// Uniform card height; each card's width follows its aspect ratio.
const CARD_H = "clamp(176px, 18vw, 236px)";
const RATIO: Record<Aspect, number> = { "1:1": 1, "4:5": 0.8, "9:16": 9 / 16, "16:9": 16 / 9 };

type Card = Item & { def: TemplateDefinition };

function StripCard({ card, reduced }: { card: Card; reduced: boolean }) {
  const ref = useRef<HTMLAnchorElement | null>(null);
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setOnScreen(true);
      return;
    }
    // No explicit root: the viewport already gives us both axes — a card paged
    // out of the rail is clipped by its overflow, and the whole rail stops
    // counting once the hero scrolls past. Both free the WebGL context.
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e) setOnScreen(e.isIntersecting);
      },
      // Zero threshold plus a generous margin, so a card under the edge fade is
      // still moving (or the rail reads as "some of these are stills") and, more
      // importantly, so no card ever sits *at* the boundary: at a threshold the
      // hover lift is itself enough to cross it, which would tear the context
      // down and rebuild it on every hover.
      { threshold: 0, rootMargin: "160px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <Link
      ref={ref}
      to={`/motion?t=${card.def.id}`}
      aria-label={`Edit ${card.def.name}`}
      // `will-change` up front, not on hover: promoting the card at the moment
      // the pointer arrives is exactly the re-layerisation we are avoiding.
      style={{ height: CARD_H, aspectRatio: RATIO[card.aspect], willChange: "transform" }}
      className="group relative shrink-0 rounded-bento bg-surface shadow-card transition-transform duration-300 ease-out hover:-translate-y-1.5"
    >
      {/* The clip sits on a child that never moves, so the rounded mask over the
          canvas is computed once instead of every frame of the lift. */}
      <div className="absolute inset-0 overflow-hidden rounded-bento">
        <PosterThumb
          def={card.def}
          aspect={card.aspect}
          paletteId={card.def.palettes[0]?.id}
          alt={card.def.name}
          className="absolute inset-0 h-full w-full"
        />
        {onScreen && !reduced && (
          <LivePreview def={card.def} paletteId={card.def.palettes[0]?.id} aspect={card.aspect} />
        )}
      </div>

      {/* Border and hover accent as stacked rings cross-faded by opacity — a
          `border-color` transition would repaint the card, canvas included. */}
      <div className="pointer-events-none absolute inset-0 rounded-bento ring-1 ring-inset ring-line" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 rounded-bento opacity-0 ring-2 ring-inset ring-lime/50 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />

      {/* Opaque, not blurred: a `backdrop-filter` here would read the live canvas
          back on every frame it is visible. */}
      <span className="absolute bottom-2 left-2 z-10 rounded-full bg-void/90 px-2.5 py-1 text-xs font-semibold text-chalk opacity-0 transition-opacity duration-200 group-hover:opacity-100">
        {card.def.name}
      </span>
    </Link>
  );
}

export default function TemplateStrip() {
  const reduced = useReducedMotion();
  const cards = useMemo(
    () => ITEMS.map((it) => ({ ...it, def: getTemplate(it.id) })).filter((c): c is Card => Boolean(c.def)),
    [],
  );

  const railRef = useRef<HTMLDivElement | null>(null);
  const [ends, setEnds] = useState({ start: true, end: false });

  const syncEnds = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setEnds({ start: el.scrollLeft <= 2, end: el.scrollLeft >= max - 2 });
  }, []);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    syncEnds();
    // Card widths come from a clamped height, so the reachable scroll range
    // moves with the viewport — re-measure on resize, not just on scroll.
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(syncEnds);
    ro.observe(el);
    return () => ro.disconnect();
  }, [syncEnds, cards.length]);

  const page = useCallback(
    (dir: -1 | 1) => {
      const el = railRef.current;
      if (!el) return;
      el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: reduced ? "auto" : "smooth" });
    },
    [reduced],
  );

  return (
    <Container>
      <div className="relative">
        <div
          ref={railRef}
          onScroll={syncEnds}
          className="flex items-center gap-4 overflow-x-auto pb-8 pt-4 sm:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((c) => (
            <StripCard key={c.id} card={c} reduced={reduced} />
          ))}
        </div>

        {/* Both edges keep a scrim at all times — it is the ground the arrows sit
            on, and the previous behaviour (drop the fade entirely on whichever
            side has run out) left the left-hand arrow at rest floating on a
            bright card with nothing behind it. "There is more this way" is
            carried by opacity here, and by the arrow itself, which dims and goes
            inert when its side is spent. */}
        {(["left", "right"] as const).map((dir) => {
          const spent = dir === "left" ? ends.start : ends.end;
          return (
            <div
              key={`fade-${dir}`}
              aria-hidden
              className={cn(
                "pointer-events-none absolute inset-y-0 z-10 w-16 transition-opacity duration-300 sm:w-24",
                dir === "left"
                  ? "left-0 bg-gradient-to-r from-void via-void/80 to-transparent"
                  : "right-0 bg-gradient-to-l from-void via-void/80 to-transparent",
                spent ? "opacity-55" : "opacity-100",
              )}
            />
          );
        })}

        {(["left", "right"] as const).map((dir) => {
          const spent = dir === "left" ? ends.start : ends.end;
          const Chevron = dir === "left" ? ChevronLeftIcon : ChevronRightIcon;
          return (
            <button
              key={dir}
              type="button"
              onClick={() => !spent && page(dir === "left" ? -1 : 1)}
              aria-disabled={spent}
              aria-label={dir === "left" ? "Show previous templates" : "Show more templates"}
              className={cn(
                "absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-surface-2 shadow-pop ring-1 ring-inset ring-line-2 transition duration-200 sm:grid",
                dir === "left" ? "left-0" : "right-0",
                spent
                  ? "cursor-default text-dim opacity-70"
                  : "text-chalk hover:scale-110 hover:bg-surface-3 hover:ring-lime/45",
              )}
            >
              <Chevron />
            </button>
          );
        })}
      </div>
    </Container>
  );
}

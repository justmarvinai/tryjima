import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
 * The rail is held to the page's content column and masked at both ends, so it
 * dissolves into the page instead of hard-cutting; the fade lifts on whichever
 * side has run out of cards.
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
      // Low threshold on purpose: a card only half-visible under the edge fade
      // should still be moving, or the rail reads as "some of these are stills".
      { threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <Link
      ref={ref}
      to={`/motion?t=${card.def.id}`}
      aria-label={`Edit ${card.def.name}`}
      style={{ height: CARD_H, aspectRatio: RATIO[card.aspect] }}
      className="group relative shrink-0 overflow-hidden rounded-bento border border-line bg-surface shadow-card transition-all duration-300 hover:-translate-y-1.5 hover:border-lime/40 hover:shadow-pop"
    >
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
      <span className="absolute bottom-2 left-2 z-10 rounded-full bg-void/85 px-2.5 py-1 text-xs font-semibold text-chalk opacity-0 backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
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
          // The mask lifts on whichever side has nothing left to scroll to, so
          // the first and last cards sit crisp at rest and the fade only ever
          // means "there is more this way".
          style={
            {
              ...(ends.start ? { "--edge-fade-l": "0px" } : null),
              ...(ends.end ? { "--edge-fade-r": "0px" } : null),
            } as CSSProperties
          }
          className="edge-fade-x flex items-center gap-4 overflow-x-auto pb-8 pt-4 sm:gap-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {cards.map((c) => (
            <StripCard key={c.id} card={c} reduced={reduced} />
          ))}
        </div>

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
                "absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-surface shadow-pop transition-transform duration-200 sm:grid",
                dir === "left" ? "left-0" : "right-0",
                spent ? "cursor-default text-dim" : "text-chalk hover:scale-110 hover:border-lime/40",
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

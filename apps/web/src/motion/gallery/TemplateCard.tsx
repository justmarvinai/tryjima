import { memo, useRef, useState } from "react";
import type { TemplateDefinition } from "@jima/engine";
import { PosterThumb } from "../components/PosterThumb";
import { LivePreview } from "../components/LivePreview";
import { useReducedMotion } from "@/ui";
import { categoryLabel } from "./groups";
import { toggleFavourite, useIsFavourite } from "../state/favourites";
import { Badge, cn } from "../../ui";

// Memoised: all 495 cards are mounted at once, so any gallery-level state change
// — a keystroke in the search box, a filter chip, a star — would otherwise
// re-render the entire grid. `def` comes from the registry and `onOpen` from the
// route above the gallery, so both are stable across those updates.
export const TemplateCard = memo(function TemplateCard({
  def,
  onOpen,
}: {
  def: TemplateDefinition;
  onOpen: (def: TemplateDefinition) => void;
}) {
  const reduced = useReducedMotion();
  const paletteId = def.palettes[0]?.id;
  const [live, setLive] = useState(false);
  const timer = useRef<number | null>(null);
  const starred = useIsFavourite(def.id);

  const start = () => {
    // Bail if a timer is already pending (mouseenter + focus can both fire) so
    // the first one isn't orphaned and left to mount a stray live preview.
    if (reduced || live || timer.current) return;
    // A short intent delay so scanning across the grid doesn't spin up a runner
    // for every card the pointer passes over.
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setLive(true);
    }, 130);
  };
  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setLive(false);
  };

  return (
    // The star is a *sibling* of the card button, not a child: a button inside a
    // button is invalid HTML, and nesting would make every star click also open
    // the template. The lift lives on this wrapper so the star rides along with
    // the card instead of staying behind while it moves.
    <div className="group relative transition-transform duration-200 hover:-translate-y-1 focus-within:-translate-y-1">
      <button
        type="button"
        aria-pressed={starred}
        aria-label={`Favourite ${def.name}`}
        onClick={() => toggleFavourite(def.id)}
        className={cn(
          "absolute left-2.5 top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full text-base leading-none backdrop-blur-sm transition-opacity",
          "focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-paper",
          starred
            ? "bg-scrim/80 text-amber opacity-100"
            : // Hidden until the card is hovered on a mouse, but always visible on
              // touch — a hover-only control is an invisible tap target on a phone.
              "bg-scrim/60 text-chalk/85 opacity-0 pointer-coarse:opacity-100 hover:bg-scrim/85 group-hover:opacity-100",
        )}
      >
        <span aria-hidden>{starred ? "★" : "☆"}</span>
      </button>

      <button
        type="button"
        // Named explicitly: without this the button's accessible name is its
        // whole contents — poster alt, name, category badge and tagline read
        // back as one run-on string — and it would collide with the star's.
        aria-label={`Open ${def.name}`}
        onClick={() => onOpen(def)}
        onMouseEnter={start}
        onMouseLeave={stop}
        onFocus={start}
        onBlur={stop}
        className={cn(
          "flex w-full flex-col overflow-hidden rounded-card border border-mist bg-paper text-left shadow-xs transition-[box-shadow,border-color] duration-200",
          "group-hover:border-ink/15 group-hover:shadow-bold",
          "focus-visible:shadow-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-ring focus-visible:ring-offset-2",
        )}
      >
        {/* Uniform 16:9 preview — static poster, with a live loop on hover. */}
        <div className="relative aspect-video w-full overflow-hidden bg-canvas">
          {/* Decorative: the button that wraps it already carries the name. */}
          <PosterThumb def={def} aspect="16:9" paletteId={paletteId} alt="" className="absolute inset-0 h-full w-full" />
          {live && <LivePreview def={def} paletteId={paletteId} />}
          {!reduced && (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute right-2.5 top-2.5 flex h-7 items-center gap-1 rounded-full bg-scrim/85 px-2.5 text-[11px] font-semibold text-chalk backdrop-blur-sm transition-opacity duration-200",
                live ? "opacity-0" : "opacity-0 group-hover:opacity-100",
              )}
            >
              ▶ Preview
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h3 className="min-w-0 truncate font-display text-[15px] font-bold text-ink">{def.name}</h3>
            <Badge tone="neutral" className="shrink-0 px-2 py-0.5 text-[11px]">
              {categoryLabel(def.category)}
            </Badge>
          </div>
          <p className="line-clamp-2 text-[13px] leading-snug text-slate">{def.tagline}</p>
        </div>
      </button>
    </div>
  );
});

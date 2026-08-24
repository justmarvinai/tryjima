import type { TemplateDefinition } from "@jima/engine";
// The durations subpath only — importing the registry here would drag the whole
// library (and Pixi) into anything that just wants to classify a definition.
import { templateDuration } from "@jima/templates/durations";

/**
 * Filters derived from what a template *is*, rather than from hand-written tags.
 *
 * Every facet is computed from the definition (or, for length, from a table CI
 * proves against the real build), so they cannot drift from the library: add a
 * template and it is classified correctly by construction. That matters at 495
 * and would matter more at 600.
 *
 * The set itself was chosen by measuring: a facet matching 3% or 90% of the
 * library isn't a filter. `facets.test.ts` and the Motion smoke suite hold that
 * line as templates are added.
 */
export type FacetId =
  | "favourites"
  | "short"
  | "long"
  | "vertical"
  | "square"
  | "wide"
  | "image"
  | "list"
  | "overlay"
  | "editable";

export interface Facet {
  id: FacetId;
  label: string;
  hint: string;
  /** Grouped in the UI so related filters sit together. */
  group: "yours" | "length" | "shape" | "content";
}

export const FACETS: Facet[] = [
  { id: "favourites", label: "Favourites", hint: "Templates you starred", group: "yours" },

  { id: "short", label: "Under 4s", hint: "Snappy — good for a scroll-stopper", group: "length" },
  { id: "long", label: "Over 4.5s", hint: "Room for a longer message to land", group: "length" },

  { id: "vertical", label: "Vertical", hint: "Made for 9:16 — Reels, TikTok, Stories", group: "shape" },
  { id: "square", label: "Square / 4:5", hint: "Feed posts", group: "shape" },
  { id: "wide", label: "Widescreen", hint: "16:9 — YouTube, presentations, sites", group: "shape" },

  { id: "image", label: "Takes a photo", hint: "Has a slot for your own image", group: "content" },
  { id: "list", label: "Takes a list", hint: "Steps, tips, features — as many lines as you need", group: "content" },
  { id: "overlay", label: "Alpha-safe", hint: "Exports transparent, to sit over footage", group: "content" },
  { id: "editable", label: "Lots to tweak", hint: "Nine or more editable fields", group: "content" },
];

/** Enough fields that the template is a kit rather than a fill-in-the-blank. */
const DEEPLY_EDITABLE = 9;

/**
 * Length at default values, in seconds.
 *
 * Building 495 scenes to time them is not something a gallery can do, so the
 * figures ship as data (`@jima/templates/durations`) and the golden suite keeps
 * them honest. `estimateDuration` — where a template offers one — is the more
 * precise answer once the user's own values are in play, but the library view
 * only ever sees defaults, so the table is both cheaper and equally true here.
 */
function lengthOf(def: TemplateDefinition): number | undefined {
  return templateDuration(def.id);
}

/**
 * Alpha-safe means the template is *designed* to sit over footage: it is a
 * lower-third or an opener, and it offers a background colour the transparent
 * export can blank. Everything renders with alpha, but a full-bleed photo
 * collage over someone's video is not what anyone means by "overlay".
 */
const isAlphaSafe = (def: TemplateDefinition): boolean =>
  (def.category === "overlay" || def.category === "intro") &&
  def.fields.some((f) => f.key === "background" && f.type === "color");

export function matchesFacet(def: TemplateDefinition, facet: FacetId, favourites: readonly string[]): boolean {
  switch (facet) {
    case "favourites":
      return favourites.includes(def.id);
    // A template with no figure matches neither bucket rather than being
    // guessed into one — a wrong length is worse than an absent one.
    case "short":
      return (lengthOf(def) ?? Infinity) < 4;
    case "long":
      return (lengthOf(def) ?? 0) > 4.5;
    case "vertical":
      return def.defaultAspect === "9:16";
    case "square":
      return def.defaultAspect === "1:1" || def.defaultAspect === "4:5";
    case "wide":
      return def.defaultAspect === "16:9";
    case "image":
      return def.fields.some((f) => f.type === "image");
    case "list":
      return def.fields.some((f) => f.type === "textlist");
    case "overlay":
      return isAlphaSafe(def);
    case "editable":
      return def.fields.length >= DEEPLY_EDITABLE;
  }
}

/** A template passes when it matches every active facet. */
export function matchesAll(
  def: TemplateDefinition,
  active: readonly FacetId[],
  favourites: readonly string[],
): boolean {
  return active.every((f) => matchesFacet(def, f, favourites));
}

/** How many templates each facet would leave, given the rest of the filters. */
export function facetCounts(
  templates: readonly TemplateDefinition[],
  active: readonly FacetId[],
  favourites: readonly string[],
): Map<FacetId, number> {
  const counts = new Map<FacetId, number>();
  for (const facet of FACETS) {
    // Count against the other active facets, not including this one — so a chip
    // shows what turning it on would give you, not what it already gave you.
    const others = active.filter((a) => a !== facet.id);
    let n = 0;
    for (const t of templates) {
      if (matchesAll(t, others, favourites) && matchesFacet(t, facet.id, favourites)) n++;
    }
    counts.set(facet.id, n);
  }
  return counts;
}

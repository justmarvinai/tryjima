import { useMemo, useState } from "react";
import type { TemplateDefinition } from "@jima/engine";
import { TemplateCard } from "./TemplateCard";
import { GROUPS, groupOf } from "./groups";
import { FACETS, facetCounts, matchesAll, type FacetId } from "./facets";
import { useFavourites } from "../state/favourites";
import type { PersistedProject } from "../state/persistence";
import { Button, Card, cn, SearchIcon } from "@/ui";
import { ProductSwitcher } from "@/shell/ProductSwitcher";
import { Link } from "react-router-dom";

// Concept keywords per category so natural searches match intent, not just the
// literal name/tagline (e.g. "lower third", "caption", "background", "intro").
const CATEGORY_KEYWORDS: Record<string, string> = {
  overlay: "overlay lower third lower-third nametag name tag caption subtitle callout banner transparent alpha broadcast chyron",
  intro: "intro opener stinger countdown logo reveal channel opening title card",
  statement: "text title headline typography kinetic type quote words",
  announcement: "announcement headline text title",
  social: "social instagram tiktok youtube reel story follow like subscribe hashtag mention poll comment chat dm search",
  product: "product ecommerce shop store item price feature watermark",
  promo: "promo sale discount offer deal coupon price shipping",
  stat: "stat data chart number percentage graph metric counter progress rating",
  educational: "explainer steps how-to tutorial process timeline",
  comparison: "compare comparison versus vs before after",
  testimonial: "testimonial review quote rating stars customer",
  brand: "brand logo end card thank you outro",
  event: "event date invite save the date lineup schedule",
  travel: "travel trip location postcard destination",
  photo: "photo image picture gallery grid",
  tech: "tech app device mockup screen phone",
  showcase: "showcase gallery feature spotlight present",
};

// A vibrant accent dot per group, so the category rail reads as a lively index
// rather than a flat list. Keys are group ids from groups.ts.
const GROUP_DOT: Record<string, string> = {
  all: "bg-lime",
  text: "bg-indigo",
  overlays: "bg-coral",
  social: "bg-pink",
  product: "bg-amber",
  showcase: "bg-mint",
  explain: "bg-violet",
  brand: "bg-coral",
  openers: "bg-amber",
  events: "bg-cyan",
};

function searchText(t: TemplateDefinition): string {
  return `${t.name} ${t.tagline} ${t.category} ${groupOf(t.category).label} ${CATEGORY_KEYWORDS[t.category] ?? ""}`.toLowerCase();
}

export function Gallery({
  templates,
  resume,
  onOpen,
  onResume,
  onDismissResume,
}: {
  templates: TemplateDefinition[];
  resume: PersistedProject | null;
  onOpen: (def: TemplateDefinition) => void;
  onResume: () => void;
  onDismissResume: () => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [facets, setFacets] = useState<FacetId[]>([]);
  const favourites = useFavourites();

  const toggleFacet = (id: FacetId): void =>
    setFacets((cur) => (cur.includes(id) ? cur.filter((f) => f !== id) : [...cur, id]));

  // Count templates per group (for the rail badges).
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of templates) {
      const id = groupOf(t.category).id;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [templates]);

  // Only groups that actually have templates, in the curated order.
  const activeGroups = useMemo(() => GROUPS.filter((g) => (counts.get(g.id) ?? 0) > 0), [counts]);

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const terms = q ? q.split(/\s+/).filter(Boolean) : [];
    return templates.filter((t) => {
      if (group !== "all" && groupOf(t.category).id !== group) return false;
      if (!matchesAll(t, facets, favourites.ids)) return false;
      if (terms.length === 0) return true;
      const hay = searchText(t);
      return terms.every((term) => hay.includes(term));
    });
  }, [templates, group, q, facets, favourites.ids]);

  // Counts are computed against the group + the *other* facets, so a chip says
  // what turning it on would give you rather than what you already have.
  const inGroup = useMemo(
    () => (group === "all" ? templates : templates.filter((t) => groupOf(t.category).id === group)),
    [templates, group],
  );
  const facetTotals = useMemo(() => facetCounts(inGroup, facets, favourites.ids), [inGroup, facets, favourites.ids]);

  const resumeDef = resume ? templates.find((t) => t.id === resume.templateId) : null;
  const activeGroup = group === "all" ? null : GROUPS.find((g) => g.id === group);
  const railItems = [{ id: "all", label: "All templates", blurb: "The whole library" }, ...activeGroups];

  return (
    <div className="flex min-h-dvh bg-void">
      {/* Persistent category rail (desktop). A real <nav> landmark. */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-line bg-shell xl:flex">
        <div className="flex h-13 items-center border-b border-line px-2.5">
          <ProductSwitcher current="motion" />
        </div>

        <nav aria-label="Template categories" className="flex-1 overflow-y-auto px-3 py-4">
          <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-dim">Browse</p>
          <ul className="flex flex-col gap-0.5">
            {railItems.map((g) => {
              const active = g.id === group;
              return (
                <li key={g.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => setGroup(g.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors",
                      active ? "bg-lime text-void" : "text-silver hover:bg-surface-2 hover:text-chalk",
                    )}
                  >
                    <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", GROUP_DOT[g.id] ?? "bg-ash", active && "ring-2 ring-void/25")} />
                    <span className="min-w-0 flex-1 truncate">{g.label}</span>
                    <span className={cn("shrink-0 font-mono text-xs tabular-nums", active ? "text-void/65" : "text-dim")}>
                      {g.id === "all" ? templates.length : counts.get(g.id) ?? 0}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-line px-5 py-4">
          <p className="text-xs leading-relaxed text-dim">
            <span className="font-semibold text-lime">100% free</span> · no account · nothing leaves your browser.
          </p>
          <Link to="/projects" className="mt-2 inline-block text-xs font-semibold text-ash hover:text-chalk">
            Your projects →
          </Link>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Search bar — sticky, with the wordmark on mobile where the rail is hidden. */}
        <header className="sticky top-0 z-20 border-b border-line bg-void/85 px-4 py-3 backdrop-blur sm:px-6 xl:px-8">
          <div className="flex items-center gap-3">
            <span className="xl:hidden">
              <ProductSwitcher current="motion" />
            </span>
            <div className="relative flex-1">
              <SearchIcon
                width={16}
                height={16}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-dim"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setQuery("");
                }}
                placeholder={`Search ${templates.length} templates by name, style or use-case…`}
                aria-label="Search templates"
                className="w-full rounded-full border border-line bg-surface py-2.5 pl-11 pr-4 text-[15px] text-chalk outline-none transition-colors placeholder:text-dim hover:border-line-2 focus:border-lime/60 focus:bg-surface-2"
              />
            </div>
            <span className="hidden shrink-0 font-mono text-[13px] text-dim tabular-nums sm:inline" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? "result" : "results"}
            </span>
          </div>

          {/* Category chips — mobile/tablet only (the rail replaces these on xl). */}
          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-0.5 xl:hidden" role="group" aria-label="Filter by use-case">
            <Chip label="All" count={templates.length} tone="all" active={group === "all"} onClick={() => setGroup("all")} />
            {activeGroups.map((g) => (
              <Chip key={g.id} label={g.label} count={counts.get(g.id) ?? 0} tone={g.id} active={group === g.id} onClick={() => setGroup(g.id)} />
            ))}
          </div>
        </header>

        <main className="flex-1 px-4 pb-20 sm:px-6 xl:px-8">
          {resumeDef && resume && (
            <Card tone="lime" className="mt-6 flex flex-wrap items-center justify-between gap-3 p-5">
              <p className="text-sm text-chalk">
                Continue where you left off — <span className="font-semibold">{resumeDef.name}</span>
                <span className="text-dim"> · {timeAgo(resume.updatedAt)}</span>
              </p>
              <div className="flex gap-2">
                <Button size="sm" onClick={onResume}>
                  Resume
                </Button>
                <Button variant="ghost" size="sm" onClick={onDismissResume} title="Deletes this saved project">
                  Discard
                </Button>
              </div>
            </Card>
          )}

          <div className="flex flex-wrap items-end justify-between gap-4 pt-7">
            <div className="min-w-0">
              <h1 className="headline-xl text-4xl text-chalk sm:text-5xl">Pick a template</h1>
              <p className="mt-3 max-w-xl text-[15px] text-ash">
                {activeGroup ? (
                  <>
                    <span className="font-semibold text-chalk">{activeGroup.label}</span> — {activeGroup.blurb}. Hover any card to see it move.
                  </>
                ) : (
                  <>Hover any card to see it move. {templates.length} to choose from — every one free and fully editable.</>
                )}
              </p>
            </div>
            <span className="shrink-0 font-mono text-[13px] text-dim tabular-nums sm:hidden" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? "result" : "results"}
            </span>
          </div>

          {/* Facet chips. Everything here is derived from the template definition,
              so the filters can never drift from the library. */}
          {/* Scrolls sideways on a phone, where nine chips would wrap into five
              rows and push the grid off screen; wraps everywhere else, so no
              filter is ever hidden behind a scroll nobody notices. */}
          <div
            className="-mx-1 mt-5 flex items-center gap-1.5 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:gap-y-2 sm:overflow-x-visible"
            role="group"
            aria-label="Filter by length, shape and content"
          >
            {FACETS.map((f, i) => {
              const on = facets.includes(f.id);
              const n = facetTotals.get(f.id) ?? 0;
              // A chip that would empty the grid is shown, but inert — it still
              // tells you the library has nothing of that kind here.
              const dead = n === 0 && !on;
              const newGroup = i > 0 && FACETS[i - 1]!.group !== f.group;
              return (
                <span key={f.id} className="flex shrink-0 items-center gap-1.5">
                  {newGroup && <span aria-hidden className="mx-1 h-4 w-px bg-line" />}
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={dead}
                    title={f.hint}
                    onClick={() => toggleFacet(f.id)}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[13px] font-bold transition-colors",
                      on
                        ? "border-lime/45 bg-lime-tint text-chalk"
                        : "border-line bg-surface text-silver hover:border-line-2 hover:text-chalk",
                      dead && "cursor-default text-dim hover:border-line hover:text-dim",
                    )}
                  >
                    {f.id === "favourites" && <span aria-hidden>{on ? "★" : "☆"}</span>}
                    {f.label}
                    <span className={cn("font-mono tabular-nums", on ? "text-lime" : "text-dim")}>{n}</span>
                  </button>
                </span>
              );
            })}
            {facets.length > 0 && (
              <button
                type="button"
                onClick={() => setFacets([])}
                className="shrink-0 whitespace-nowrap rounded-full px-2.5 py-1.5 text-[13px] font-bold text-lime underline-offset-2 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {filtered.length > 0 ? (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((t) => (
                <TemplateCard key={t.id} def={t} onOpen={onOpen} />
              ))}
            </div>
          ) : (
            <div className="mt-7 rounded-bento border border-dashed border-line-2 bg-surface py-16 text-center">
              <p className="text-base font-medium text-silver">
                {facets.includes("favourites") && favourites.ids.length === 0
                  ? "You haven’t starred anything yet — tap the ☆ on any card to keep it here."
                  : `No templates match ${q ? `“${query}”` : "this filter"}.`}
              </p>
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => {
                  setQuery("");
                  setGroup("all");
                  setFacets([]);
                }}
              >
                Clear filters
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

const CHIP_DOT: Record<string, string> = GROUP_DOT;

function Chip({
  label,
  count,
  tone,
  active,
  onClick,
}: {
  label: string;
  count: number;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors",
        active ? "bg-lime text-void shadow-xs" : "border border-line bg-surface text-ash hover:border-line-2 hover:text-chalk",
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", CHIP_DOT[tone] ?? "bg-ash")} />
      {label}
      <span className={cn("font-mono text-xs tabular-nums", active ? "text-void/65" : "text-dim")}>{count}</span>
    </button>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}
